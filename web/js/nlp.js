// Yoruba text handling: NFC normalisation, letter-aware tokenising (Latin letters + combining tone marks/underdots),
// and the offline dictionary, built from the course data (course.js).
import { UNITS, DIALOGUES } from "./course.js";

/** Canonical form: ẹ̀ typed as e + underdot + grave, or as ẹ + grave, is always the same string. */
export const nfc = (s) => String(s ?? "").normalize("NFC");

/** Lower-case NFC. */
export const lc = (s) => nfc(s).toLocaleLowerCase();

/** Without tone marks and underdots: ẹ̀ → e, ṣ → s, ń → n. Used for tolerant matching. */
export const stripMarks = (s) => nfc(s).normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");

/** Does the text have a letter that isn't plain a–z (an underdot or a tone mark)? */
export const hasMarks = (s) => nfc(s) !== stripMarks(s);

const L = "\\p{L}\\p{M}";
// word (letters + marks, inner hyphens/apostrophes) | anything else
const TOKEN_RE = new RegExp(`[${L}]+(?:[-'’][${L}]+)*|[^${L}]+`, "gu");
const WORD_START = /^\p{L}/u;

/** Sentences of tokens: [{text, tokens: [{t, w}]}]; concatenating every t reproduces the (NFC) input. */
export function tokenize(text) {
  text = nfc(text);
  // A sentence ends at . ! ? … (plus closing quotes) or a line break, and keeps its trailing whitespace.
  const parts = text.match(/[^.!?…\n]*(?:[.!?…]+["»”)\]]*|\n|$)\s*/g).filter(Boolean);
  return parts.map((s) => {
    const tokens = [];
    for (const piece of s.match(TOKEN_RE) || []) tokens.push({ t: piece, w: WORD_START.test(piece) });
    return { text: s.trim(), tokens };
  });
}

/** "Adé: Ẹ káàsán." → "Ẹ káàsán." (dialogue lines start with a capitalised speaker name, one or two words). */
export const stripSpeaker = (s) => s.replace(/^\p{Lu}[\p{L}\p{M}]*(?: \p{Lu}[\p{L}\p{M}]*)?:\s+/u, "");

// ---------- dictionary (offline, from the course) ----------

const ENTRIES = new Map(); // lower-case NFC → entries
const LOOSE = new Map(); // marks-stripped → entries
const PARTS = new Map(); // single word inside a multi-word entry → entries
export const PHRASES = new Map(); // marks-stripped, punctuation-free sentence → English

const key = (s) => stripMarks(lc(s)).replace(/[.,!?;:…"“”«»]+/g, " ").replace(/\s+/g, " ").trim();
const push = (map, k, v) => {
  const list = map.get(k);
  if (list) list.push(v);
  else map.set(k, [v]);
};

for (const u of UNITS) {
  for (const x of u.words) {
    const e = { lemma: x.yo, pos: x.pos, gloss: x.en, ex_yo: x.ex, ex_en: x.exEn, unit: u.id };
    push(ENTRIES, lc(x.yo), e);
    push(LOOSE, stripMarks(lc(x.yo)), e);
    const parts = lc(x.yo).split(/\s+/);
    if (parts.length > 1) parts.forEach((p) => push(PARTS, p, e));
    PHRASES.set(key(x.ex), x.exEn);
  }
  for (const x of u.phrases) PHRASES.set(key(x.yo), x.en);
}
for (const d of DIALOGUES) for (const l of d.lines) PHRASES.set(key(l.yo), l.en);

/** English for a known course sentence/phrase (tone marks and punctuation don't matter), else null. */
export const knownTranslation = (text) => PHRASES.get(key(stripSpeaker(text))) ?? null;

export const loadDict = () => Promise.resolve(true); // kept async so views can await it; nothing to download
export const setDict = () => {}; // tests used to swap the dictionary; it's static now

/** Candidate dictionary forms for a surface word (exact first). */
export function lemmaCandidates(word) {
  const w = lc(word);
  const exact = ENTRIES.get(w);
  if (exact) return [...new Set(exact.map((e) => lc(e.lemma)))];
  const loose = LOOSE.get(stripMarks(w));
  return loose ? [...new Set(loose.map((e) => lc(e.lemma)))] : [w];
}

/**
 * Entries for a word: [{lemma, pos, gloss, ex_yo, ex_en, approx?, part?}].
 * Exact match first; otherwise a match ignoring tone marks and underdots (flagged `approx`);
 * words inside multi-word entries (Ọjọ́ Ajé → Ajé) come last, flagged `part`.
 */
export function lookup(word) {
  const w = lc(word);
  const exact = ENTRIES.get(w) || [];
  const loose = exact.length ? [] : (LOOSE.get(stripMarks(w)) || []).map((e) => ({ ...e, approx: true }));
  const parts = [...(PARTS.get(w) || []), ...(exact.length || loose.length ? [] : PARTS.get(stripMarks(w)) || [])]
    .filter((e) => !exact.includes(e))
    .map((e) => ({ ...e, part: true }));
  return [...exact, ...loose, ...parts];
}
