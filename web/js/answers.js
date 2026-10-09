// Checking typed answers. Tone marks and underdots are the hardest part of Yoruba spelling, so an answer that is
// right except for missing marks (e instead of ẹ, o instead of ọ, no tone marks) counts as "marks", not wrong.
import { lc, stripMarks } from "./nlp.js";

const PUNCT = /[.,!?;:…«»"“”]+/g;
const loose = (s) => lc(s).replace(/[’`]/g, "'").replace(PUNCT, " ").replace(/\s+/g, " ").trim();
const bare = (s) => stripMarks(loose(s));

/** Compare a typed answer with the accepted answers: "ok" | "marks" (right apart from tone marks/dots) | "wrong". Case and punctuation don't matter. */
export function checkTyped(accepted, typed) {
  const t = loose(typed);
  if (!t) return "wrong";
  if (accepted.map(loose).includes(t)) return "ok";
  if (accepted.map(bare).includes(bare(t))) return "marks";
  return "wrong";
}

export const MARKS_NOTE = "Right letters, but check the tone marks and underdots (ẹ, ọ, ṣ).";

/** Accepted answers for a fix-the-mistake card: the corrected bit, or the whole corrected sentence. */
export function fixAnswers(back) {
  const part = back.match(/\[\[(.*?)\]\]/)?.[1];
  const whole = back.replace(/\[\[|\]\]/g, "");
  return part != null ? [part, whole] : [whole];
}

// Little words that are easy to drop or swap (stored without marks).
const SMALL = new Set("ni n ti ko kò mo o a e wo si ati ni ma maa ye".split(" "));
const toWords = (s) => loose(s).split(" ").filter(Boolean);
const q = (w) => `« ${w.trim()} »`;

/**
 * Local (free) grading of a fix-the-mistake answer: {verdict: "ok"|"almost"|"wrong", note}.
 * Missing tone marks/dots, or one word off (missing, extra or different, e.g. a forgotten "ni"), count as "almost".
 */
export function gradeFix(back, typed) {
  const accepted = fixAnswers(back);
  const basic = checkTyped(accepted, typed);
  if (basic === "ok") return { verdict: "ok", note: "" };
  if (basic === "marks") return { verdict: "almost", note: MARKS_NOTE };
  const t = toWords(typed);
  if (!t.length) return { verdict: "wrong", note: "" };
  for (const a of accepted) {
    const e = toWords(a);
    // longest common subsequence on mark-free words
    const n = e.length, m = t.length;
    const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
      L[i][j] = stripMarks(e[i]) === stripMarks(t[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const missing = [], extra = [];
    let i = 0, j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && stripMarks(e[i]) === stripMarks(t[j])) { i++; j++; }
      else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) extra.push(t[j++]);
      else missing.push(e[i++]);
    }
    if (n < 2 || missing.length + extra.length === 0) continue;
    if (missing.length === 1 && extra.length === 0) return { verdict: "almost", note: `You missed ${q(missing[0])}.` };
    if (missing.length === 0 && extra.length === 1) return { verdict: "almost", note: `${q(extra[0])} isn't needed.` };
    if (missing.length === 1 && extra.length === 1 && (SMALL.has(stripMarks(missing[0])) || SMALL.has(stripMarks(extra[0])) || stripMarks(missing[0]).slice(0, 3) === stripMarks(extra[0]).slice(0, 3)))
      return { verdict: "almost", note: `${q(extra[0])} → ${q(missing[0])}.` };
  }
  return { verdict: "wrong", note: "" };
}
