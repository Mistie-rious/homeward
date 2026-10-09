// Reading texts, word/sentence lookups, saving, writing prompts. Everything adapts to the chosen level.
import { structured } from "./claude.js";
import { all, get, kvGet, kvSet, run, scalar } from "./db.js";
import { addCard } from "./srs.js";
import { lookup, nfc } from "./nlp.js";
import { BUILTIN_TEXTS, LEVELS, PROMPTS_BY_LEVEL, THEMES } from "./seed.js";
import { hashtext, localDate } from "./util.js";

export { LEVELS };
export const level = () => kvGet("level", "A1");
export const shiftLevel = (lv, delta) => LEVELS[Math.min(LEVELS.length - 1, Math.max(0, LEVELS.indexOf(lv) + delta))];

export const LEVEL_GUIDE = {
  A1: "very short simple sentences (subject + verb + object), only the present, the progressive with ń, the perfect with ti and the future with máa, the few hundred most common words, concrete everyday topics",
  A2: "short clear sentences with the main tense markers (ń, ti, máa, kò), common question words, simple joined sentences with àti and ṣùgbọ́n, high-frequency everyday vocabulary",
  B1: "varied sentences, reasons with nítorí pé, relative clauses with tí, serial verbs, common idioms, everyday and cultural topics",
  B2: "natural flowing Yoruba with longer sentences, proverbs (òwe), polite and formal registers, abstract topics",
};

/** Appended to every prompt that makes Yoruba: Claude is lower-resource in Yoruba, so it must not guess. */
export const YORUBA_RULES = `Yoruba writing rules:
- Write standard Yoruba orthography with full tone marks (à á è é ẹ̀ ẹ́ ì í ò ó ọ̀ ọ́ ù ú ń ǹ) and underdots (ẹ, ọ, ṣ, gb). Use Unicode NFC text. Never drop marks.
- Use only words, spellings and tones you are sure of. Prefer common vocabulary and short sentences. If you are unsure of a word, a tone or a construction, use a simpler one you are sure of instead of guessing.
- Use "ẹ" (plural/respectful you) for elders and strangers and "o" for friends and younger people, as the situation calls for.`;

const BASE_WORDS = { A1: 50, A2: 90, B1: 150, B2: 220 };
export const LENGTHS = { short: 0.6, medium: 1, long: 1.6 };
const WRITE_WORDS = { A1: 25, A2: 50, B1: 90, B2: 140 };
const words = (lv, length = "medium") => Math.round((BASE_WORDS[lv] * (LENGTHS[length] ?? 1)) / 10) * 10;

// ---------- texts ----------

export const addText = (title, body, source) =>
  run("INSERT INTO text(source, title, body, created_at) VALUES (?,?,?,?)", [source, nfc(title).trim() || "Untitled", nfc(body).trim().replace(/\r\n/g, "\n"), Date.now()]);

/** Saved words that aren't solid yet, weakest first. */
export const learningLemmas = (limit = 8) =>
  all(
    `SELECT DISTINCT item.lemma FROM item JOIN card ON card.item_id = item.id
     WHERE item.kind = 'word' AND item.suspended = 0 AND (card.stability IS NULL OR card.stability < 21)
     ORDER BY card.stability IS NOT NULL, card.stability LIMIT ?`,
    [limit],
  ).map((r) => r.lemma);

const TEXT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short title in Yoruba" },
    body: { type: "string", description: "The Yoruba text; paragraphs separated by blank lines" },
  },
};
const textSystem = (lv) =>
  `You write Yoruba reading texts for an adult English-speaking learner at level ${lv}: ${LEVEL_GUIDE[lv]}. Texts are natural and interesting (everyday life in Nigeria, culture, stories, dialogues), never childish.
${YORUBA_RULES}`;

export async function generateText({ length = "medium" } = {}) {
  const lv = level();
  const recent = all("SELECT title FROM text ORDER BY created_at DESC LIMIT 10").map((r) => r.title);
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  const res = await structured({
    system: textSystem(lv),
    user: `Write a text of about ${words(lv, length)} words.
Words I'm learning (use those that fit naturally at this level): ${learningLemmas().join(", ") || "(none yet)"}
Also introduce 3-5 useful new ${lv} words.
Topic idea: ${theme}. Avoid these recent titles: ${recent.join("; ") || "(none)"}`,
    schema: TEXT_SCHEMA,
    purpose: "text",
  });
  return addText(res.title, res.body, "claude");
}

const REWRITES = {
  easier: (lv) => `Rewrite it one level easier, for a ${shiftLevel(lv, -1)} learner (${LEVEL_GUIDE[shiftLevel(lv, -1)]}). Keep the story and roughly the same length.`,
  harder: (lv) => `Rewrite it one level harder, for a ${shiftLevel(lv, 1)} learner (${LEVEL_GUIDE[shiftLevel(lv, 1)]}). Keep the story and roughly the same length.`,
  shorter: () => "Rewrite it about half as long, keeping the main story and the same difficulty.",
  longer: () => "Rewrite it about 1.5x longer: add detail or a further development, same difficulty.",
};
const SUFFIX = { easier: "easier", harder: "harder", shorter: "short", longer: "long" };

/** New text that is an easier/harder/shorter/longer version of text `id`. */
export async function rewriteText(id, change) {
  const doc = get("SELECT title, body FROM text WHERE id = ?", [id]);
  const lv = level();
  const res = await structured({
    system: textSystem(lv),
    user: `Here is a Yoruba text:\n<<<\n${doc.body}\n>>>\n${REWRITES[change](lv)}`,
    schema: TEXT_SCHEMA,
    purpose: "rewrite",
  });
  const base = doc.title.replace(/ \((easier|harder|short|long)\)$/, "");
  return addText(`${base} (${SUFFIX[change]})`, res.body, "claude");
}

/** Next unused built-in dialogue (no key / offline). */
export function nextBuiltinText() {
  const have = new Set(all("SELECT title FROM text WHERE source = 'builtin'").map((r) => r.title));
  const t = BUILTIN_TEXTS.find((t) => !have.has(t.title));
  return t ? addText(t.title, t.body, "builtin") : null;
}

// ---------- lookups ----------

const cacheGet = (key) => {
  const hit = scalar("SELECT data FROM gloss_cache WHERE key = ?", [key]);
  return hit ? JSON.parse(hit) : null;
};
const cacheSet = (key, data) => run("INSERT OR REPLACE INTO gloss_cache(key, data) VALUES (?, ?)", [key, JSON.stringify(data)]);

// Kept short on purpose: fewer output tokens = faster answers.
const GLOSS_SCHEMA = {
  type: "object",
  properties: {
    lemma: { type: "string", description: "Dictionary form, with tone marks and underdots" },
    pos: { type: "string", description: "noun, verb, adjective, adverb, pronoun, particle, preposition, expression, ..." },
    meaning: { type: "string", description: "English meaning of the word as used in this sentence (a few words)" },
    lemma_meaning: { type: "string", description: "Short English gloss of the lemma (1-3 senses)" },
    note: { type: "string", description: "Only if really useful (tone pattern, idiom, a word that changes form); else empty. Max 12 words. Say so if you are unsure." },
  },
};

/** Contextual word gloss from Claude (cached). Only called from the "Ask Claude" button. */
export async function claudeGloss(word, sentence) {
  const key = hashtext(`w3|${word}|${sentence}`);
  let g = cacheGet(key);
  if (!g) {
    const hint = lookup(word).slice(0, 3).map((d) => `${d.lemma} (${d.pos}): ${d.gloss}`).join(" | ");
    g = await structured({
      system: `Terse Yoruba-English learner's dictionary for a ${level()} learner. Explain the word as used in the sentence.\n${YORUBA_RULES}`,
      user: `Word: ${word}\nSentence: ${sentence}\nDictionary hints: ${hint || "(none)"}`,
      schema: GLOSS_SCHEMA,
      purpose: "word",
      maxTokens: 400,
    });
    cacheSet(key, g);
  }
  return g;
}

// ---------- grammar explanations (on demand) ----------

/** Claude's explanation of a sentence: translation + up to 3 notes. Only called from the "Explain grammar" button. */
export async function explainSentence(sentence) {
  const key = hashtext(`g2|${level()}|${sentence}`);
  const hit = cacheGet(key);
  if (hit) return hit;
  const res = await structured({
    system: `You help a ${level()} Yoruba learner understand a sentence. Translate it naturally, then explain the 1-3 things most worth noticing (tone marks, tense markers, word order, idiom, tricky word). Short, concrete, in English. If the sentence has errors or you are unsure of something, say so.\n${YORUBA_RULES}`,
    user: sentence,
    schema: {
      type: "object",
      properties: {
        translation: { type: "string" },
        notes: { type: "array", items: { type: "string" }, description: "1-3 notes, max 20 words each" },
      },
    },
    purpose: "grammar",
    maxTokens: 600,
  });
  cacheSet(key, res);
  return res;
}

// ---------- saving ----------

/**
 * Save a word as a review item. `g` = {lemma, pos, lemma_meaning, sentence_en?, note?, example_yo?, example_en?}.
 * Returns {itemId, created}.
 */
export function saveWord({ word, sentence, textId, g, mine = false }) {
  const lemma = nfc(g.lemma);
  const existing = get("SELECT id FROM item WHERE kind = 'word' AND lemma = ?", [lemma]);
  if (existing) {
    if (mine) run("UPDATE item SET mine = 1 WHERE id = ?", [existing.id]);
    return { itemId: existing.id, created: false };
  }
  const note = [g.note, g.example_yo && `${g.example_yo} — ${g.example_en}`].filter(Boolean).join(" · ");
  const at = Date.now();
  sentence = nfc(sentence || "");
  const itemId = run(
    "INSERT INTO item(kind, lemma, front, back, context, context_en, note, text_id, mine, created_at) VALUES ('word',?,?,?,?,?,?,?,?,?)",
    [lemma, lemma, g.lemma_meaning, sentence.replace(word, `[[${word}]]`), g.sentence_en || null, note || null, textId ?? null, mine ? 1 : 0, at],
  );
  addCard(itemId, "recog", at);
  return { itemId, created: true };
}

/** Save a whole sentence (Yoruba -> English card). */
export function saveSentence({ sentence, translation, notes, textId, mine = false }) {
  sentence = nfc(sentence);
  const existing = get("SELECT id FROM item WHERE kind = 'sentence' AND front = ?", [sentence]);
  if (existing) {
    if (mine) run("UPDATE item SET mine = 1 WHERE id = ?", [existing.id]);
    return { itemId: existing.id, created: false };
  }
  const at = Date.now();
  const itemId = run("INSERT INTO item(kind, front, back, note, text_id, mine, created_at) VALUES ('sentence',?,?,?,?,?,?)", [
    sentence, translation, notes || null, textId ?? null, mine ? 1 : 0, at,
  ]);
  addCard(itemId, "recog", at);
  return { itemId, created: true };
}

export const savedLemmas = () => new Set(all("SELECT lemma FROM item WHERE kind = 'word'").map((r) => r.lemma));
export const savedSentences = () => new Set(all("SELECT front FROM item WHERE kind = 'sentence'").map((r) => r.front));

// ---------- writing prompt ----------

/** Writing level: one below the reading level unless changed with Easier/Harder (producing is harder than understanding). */
export const writeLevel = () => kvGet("write_level", null) ?? shiftLevel(level(), -1);

/** Today's prompt: fixed for the day unless changed with newPrompt(). */
export function todaysPrompt() {
  const today = localDate();
  const saved = kvGet("prompt_today", null);
  if (saved?.date === today && (saved.manual || saved.level === writeLevel())) return saved;
  const lv = writeLevel();
  const list = PROMPTS_BY_LEVEL[lv];
  const [y, m, d] = today.split("-").map(Number);
  const p = { date: today, level: lv, text: list[Math.floor(Date.UTC(y, m - 1, d) / 86400000) % list.length] };
  kvSet("prompt_today", p);
  return p;
}

/** Replace today's prompt: change = "easier" | "harder" | "new". Uses Claude if possible, else the built-in lists. */
export async function newPrompt(change, { useClaude = true } = {}) {
  const cur = todaysPrompt();
  const lv = change === "easier" ? shiftLevel(cur.level, -1) : change === "harder" ? shiftLevel(cur.level, 1) : cur.level;
  if (lv !== cur.level) kvSet("write_level", lv); // Easier/Harder sticks for future days too
  let text;
  if (useClaude) {
    const res = await structured({
      system: `You write short writing prompts for an adult English-speaking Yoruba learner at level ${lv}: ${LEVEL_GUIDE[lv]}.
Write the prompt itself in simple English. After it, in brackets, give 2-4 short Yoruba hints (words or phrase starts) that the learner can use.
${YORUBA_RULES}`,
      user: `Give one new prompt at ${lv} level. Expected answer length: about ${WRITE_WORDS[lv]} words${lv === "A1" ? "; keep it very simple" : ""}.
It must be different from: "${cur.text}". Make it about everyday life, opinions or stories. Format: "Prompt in English. (hint · hint · hint)"`,
      schema: { type: "object", properties: { prompt: { type: "string" } } },
      purpose: "prompt",
      maxTokens: 500,
    });
    text = res.prompt;
  } else {
    const list = PROMPTS_BY_LEVEL[lv].filter((p) => p !== cur.text);
    text = list[Math.floor(Math.random() * list.length)];
  }
  const p = { date: localDate(), level: lv, text, manual: true };
  kvSet("prompt_today", p);
  return p;
}

export const wordTarget = (lv) => WRITE_WORDS[lv];

/** A few sentence starters to get going, by level. */
export const STARTERS = {
  A1: ["Orúkọ mi ni…", "Mo ń gbé ní…", "Mo fẹ́ràn…", "Mo ní…", "Mo jẹ́…"],
  A2: ["Ní àná, mo…", "Ní ọ̀la, mo máa…", "Mo fẹ́ lọ sí…", "Mo ń kọ́ Yorùbá nítorí…", "Ọ̀rẹ́ mi…"],
  B1: ["Mo rò pé…", "Nítorí pé…", "Ṣùgbọ́n…", "Fún àpẹẹrẹ…", "Mo fẹ́ràn…"],
  B2: ["Mo rò pé…", "Nítorí pé…", "Ṣùgbọ́n…", "Fún àpẹẹrẹ…", "Lóòótọ́,…"],
};
