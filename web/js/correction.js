// Writing correction. Claude is the only corrector (there is no free Yoruba checker), so without a key
// corrections are unavailable. Every error becomes a 'mistake' review card.
import { structured, hasKey, ClaudeError } from "./claude.js";
import { run, tx } from "./db.js";
import { addCard } from "./srs.js";
import { nfc, tokenize } from "./nlp.js";
import { LEVEL_GUIDE, YORUBA_RULES } from "./content.js";

export const CATEGORIES = [
  "tone_marks", "underdots", "spelling", "word_order", "tense_markers", "negation", "pronouns",
  "questions", "vocabulary", "respect", "punctuation", "other",
];

export const NO_KEY_MESSAGE = "Corrections need a Claude API key. Without one they are unavailable (there is no free Yoruba checker). Add a key in Settings.";

const SCHEMA = {
  type: "object",
  properties: {
    corrected_text: { type: "string", description: "The full text with all listed fixes applied" },
    errors: {
      type: "array",
      description: "In text order",
      items: {
        type: "object",
        properties: {
          original: { type: "string", description: "Exact substring copied verbatim from the learner's text, as short as possible while unambiguous" },
          suggestion: { type: "string", description: "Replacement for `original`" },
          category: { type: "string", enum: CATEGORIES },
          explanation: { type: "string", description: "1-2 sentences naming the rule, addressed to the learner" },
        },
      },
    },
    summary: { type: "string", description: "2-3 sentences of overall feedback: what went well, what to focus on next" },
  },
};

export const NATURAL_RULES = `- Aim for what a native Yoruba speaker would naturally say, keeping the learner's meaning and as much of their own wording as possible.
- Missing tone marks and underdots (e → ẹ, o → ọ, s → ṣ, a missing grave or acute) are real but minor errors: report them (category "tone_marks" or "underdots"), one error per word.
- Missing small words are errors too: pronouns (mo, o, ó), tense markers (ń, ti, máa), ní/sí, the negative kò. Include a neighbouring word in \`original\` so the fix can be shown.
- Word-for-word English phrasing that no Yoruba speaker would say is an error (category "vocabulary"): give the natural expression.
- Don't flag choices that are already correct and natural, even if you'd phrase them differently.
- If you are not sure something is an error, do not flag it. Never invent a rule; if you are unsure of a word or tone yourself, say so in the explanation.`;

const SYSTEM = (level) => `You are a kind, precise Yoruba teacher correcting an English-speaking CEFR-style ${level} learner's writing. The learner may type without tone marks or underdots; that is common and not a big problem.
- Find every real error: spelling, tone marks, underdots, tense markers, word order, pronouns, negation, question form, missing words, and unnatural phrasing.
${NATURAL_RULES}
- \`original\` must be copied exactly from the learner's text so it can be located; keep it short.
- corrected_text must read as natural, correct Yoruba with full tone marks and underdots.
- Explanations in ${level.startsWith("A") ? "very simple English, one short sentence, with a mini example if helpful" : "concise English naming the rule"}.
- The summary is encouraging and names the one or two things to focus on.
The learner's level is ${level}: ${LEVEL_GUIDE[level]}.
${YORUBA_RULES}`;

/** Find `needle` in `text`, preferring at/after `from`; tolerant of whitespace/case. */
export function locate(text, needle, from = 0) {
  if (!needle) return -1;
  let pos = text.indexOf(needle, from);
  if (pos === -1) pos = text.indexOf(needle);
  if (pos === -1 && needle.trim()) {
    const re = new RegExp(needle.trim().split(/\s+/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"), "i");
    pos = text.search(re);
  }
  return pos;
}

/** The sentence containing `offset` as [start, end). */
export function sentenceSpan(text, offset) {
  let start = 0;
  for (const s of tokenize(text)) {
    const len = s.tokens.reduce((n, t) => n + t.t.length, 0);
    if (offset < start + len) {
      const lead = s.tokens.map((t) => t.t).join("").search(/\S/);
      return [start + Math.max(0, lead), start + len];
    }
    start += len;
  }
  return [0, text.length];
}

async function withClaude(text, prompt, level, claude) {
  const res = await claude({
    system: SYSTEM(level),
    user: `Prompt: ${prompt || "(free writing)"}\n\nLearner text:\n<<<\n${text}\n>>>`,
    schema: SCHEMA,
    purpose: "correction",
    maxTokens: 6000,
    think: 2000, // a little reasoning time noticeably improves corrections
  });
  const errors = [];
  let cursor = 0;
  for (const e of res.errors) {
    const pos = locate(text, e.original, cursor);
    if (pos === -1) continue;
    cursor = pos + e.original.length;
    errors.push({ start: pos, end: pos + e.original.length, ...e });
  }
  return { grader: "claude", corrected: res.corrected_text, summary: res.summary, errors };
}

/** Correct, persist, and create mistake cards. Returns the submission id. */
export async function correct(text, prompt, { level = "A1", modality = "write", claude = structured, useClaude = hasKey() } = {}) {
  if (!useClaude) throw new ClaudeError(NO_KEY_MESSAGE);
  text = nfc(text);
  const result = await withClaude(text, prompt, level, claude);

  const at = Date.now();
  return tx(() => {
    const subId = run("INSERT INTO submission(modality, prompt, raw_text, corrected_text, summary, grader, created_at) VALUES (?,?,?,?,?,?,?)", [
      modality, prompt || null, text, result.corrected, result.summary, result.grader, at,
    ]);
    for (const e of result.errors) {
      run("INSERT INTO error(submission_id, start, end, original, suggestion, category, explanation, created_at) VALUES (?,?,?,?,?,?,?,?)", [
        subId, e.start, e.end, e.original, e.suggestion, e.category, e.explanation, at,
      ]);
      const [s, end] = sentenceSpan(text, e.start);
      const sent = text.slice(s, end).trimEnd();
      const a = e.start - s;
      const b = e.end - s;
      const itemId = run("INSERT INTO item(kind, front, back, note, category, submission_id, created_at) VALUES ('mistake',?,?,?,?,?,?)", [
        `${sent.slice(0, a)}[[${sent.slice(a, b)}]]${sent.slice(b)}`,
        `${sent.slice(0, a)}[[${e.suggestion}]]${sent.slice(b)}`,
        e.explanation, e.category, subId, at,
      ]);
      addCard(itemId, "fix", at);
    }
    return subId;
  });
}

// ---------- judging a typed fix in Review/Drill ----------

/**
 * Ask Claude whether the learner's answer to a fix-the-mistake card is correct, natural Yoruba,
 * even if it differs from the stored answer. Returns {verdict: "correct"|"almost"|"wrong", feedback, better}.
 */
export async function judgeFix({ front, back, answer, level = "A1" }, { claude = structured } = {}) {
  const plain = (s) => s.replace(/\[\[|\]\]/g, "");
  return claude({
    system: `You check an English-speaking Yoruba learner's (level ${level}) answer to a correction exercise. Judge meaning and natural Yoruba, not exact wording.
- "correct": their version fixes the error and is correct, natural Yoruba (it does NOT have to match the expected answer).
- "almost": right idea but a small slip: missing or wrong tone marks or underdots (e for ẹ, o for ọ, s for ṣ), or a missing or wrong small word (mo, ń, ti, ní, sí, kò).
- "wrong": the error isn't fixed, or new errors were introduced.
feedback: one short, kind sentence in English saying exactly what was right or what's missing (quote the word). If you are unsure whether their version is acceptable, say so.
better: the full corrected sentence using the learner's version if it was acceptable, otherwise the natural correct sentence, with full tone marks and underdots.
${YORUBA_RULES}`,
    user: `Sentence with the error marked [[like this]]: ${front}
Expected correction: ${plain(back)}
The learner's answer (for the marked part, or a whole sentence): ${answer}`,
    schema: {
      type: "object",
      properties: {
        verdict: { type: "string", enum: ["correct", "almost", "wrong"] },
        feedback: { type: "string" },
        better: { type: "string" },
      },
    },
    purpose: "check",
    maxTokens: 400,
  });
}
