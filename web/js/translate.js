// Yoruba -> English translations. Order: the offline course (exact known phrases, free), then Claude when there's a key,
// then MyMemory (free, crowd-sourced, often poor for Yoruba) only as a last resort.
import { kvGet, run, scalar } from "./db.js";
import { hashtext } from "./util.js";
import { ClaudeError, hasKey, structured } from "./claude.js";
import { knownTranslation, nfc } from "./nlp.js";
import { YORUBA_RULES } from "./content.js";

export class TranslateError extends Error {}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: " " };
const decode = (s) => s.replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e) =>
  ENTITIES[e.toLowerCase()] ?? (e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : m));

const cacheGet = (key) => {
  const hit = scalar("SELECT data FROM gloss_cache WHERE key = ?", [key]);
  return hit ? JSON.parse(hit) : null;
};
const cacheSet = (key, data) => run("INSERT OR REPLACE INTO gloss_cache(key, data) VALUES (?, ?)", [key, JSON.stringify(data)]);

/** A word or short expression (gets meanings + a dictionary lookup), rather than a sentence (gets a translation). */
export const isShort = (text) => text.trim().split(/\s+/).length <= 2 && !/[.!?…]$/.test(text.trim());

// Bump when the prompt changes, so old cached answers are asked again.
const PROMPT_VERSION = 3;

const WORD_PROMPT = (text) => `Yoruba word or expression, typed by a learner (tone marks and underdots may be missing, may have typos): ${text}
- yo: the correctly written Yoruba they meant, with full tone marks and underdots (ẹ, ọ, ṣ); as typed if already correct.
- en: its common English meaning(s), most common first, separated by "; " (at most 3).
- literal: if it's an idiom whose word-for-word meaning differs, that literal meaning in English; otherwise "".
If you are not sure what the word is, say so in "en" instead of guessing.`;

const SENTENCE_PROMPT = (text) => `Yoruba text, possibly typed by a learner (tone marks and underdots may be missing, may have typos):
${text}
- yo: the text with spelling, tone marks and underdots fixed; don't change the wording or grammar. As given if already correct.
- en: a natural English translation.
- literal: if it contains an idiom, its word-for-word meaning, e.g. "Inú mi dùn: lit. 'my inside is sweet'"; otherwise "".
If any part is unclear to you, say so in "en" instead of guessing.`;

/**
 * Yoruba -> English as {yo, en, literal}: `yo` is the input with marks/typos fixed, `literal` explains idioms (or "").
 * Cached forever. Known course phrases are answered offline. Then Claude if there's a key, else (or if Claude fails) MyMemory, which only fills `en`.
 */
export async function translateFull(text, opts = {}) {
  text = nfc(text);
  const known = knownTranslation(text);
  if (known) return { yo: text, en: known, literal: "" };
  if (hasKey()) {
    const key = hashtext(`cl${PROMPT_VERSION}|${text}`);
    const hit = cacheGet(key);
    if (hit) return hit;
    try {
      const res = await structured({
        system: `You translate Yoruba into natural English for a learner. Be accurate and idiomatic; never add commentary.\n${YORUBA_RULES}`,
        user: isShort(text) ? WORD_PROMPT(text) : SENTENCE_PROMPT(text),
        schema: { type: "object", properties: { yo: { type: "string" }, en: { type: "string" }, literal: { type: "string" } } },
        purpose: "translate",
        maxTokens: 600,
      });
      const out = { yo: res.yo.trim() || text, en: res.en, literal: res.literal.trim() };
      cacheSet(key, out);
      return out;
    } catch (e) {
      if (!(e instanceof ClaudeError)) throw e;
      console.warn("Claude translation failed, using MyMemory", e);
    }
  }
  return { yo: text, en: await myMemory(text, opts), literal: "" };
}

/** Yoruba -> English, natural (just the English). */
export const translate = async (text, opts) => (await translateFull(text, opts)).en;

/** Free fallback: MyMemory. ~5,000 characters/day anonymous, ~50,000 with an email (Settings). */
async function myMemory(text, { fetchImpl = fetch } = {}) {
  const key = hashtext(`mm|${text}`);
  const hit = cacheGet(key);
  if (hit) return hit.en;

  const params = new URLSearchParams({ q: text.slice(0, 500), langpair: "yo|en" });
  const email = kvGet("mymemory_email", "");
  if (email) params.set("de", email);
  let data;
  try {
    const resp = await fetchImpl(`https://api.mymemory.translated.net/get?${params}`);
    data = await resp.json();
  } catch {
    throw new TranslateError("Translation service unreachable (offline?)");
  }
  const raw = data?.responseData?.translatedText;
  const en = raw && decode(raw);
  if (data?.quotaFinished || data?.responseStatus !== 200 || !en || /MYMEMORY WARNING/i.test(en)) {
    throw new TranslateError("Free translation failed or its daily limit is reached (it is weak for Yoruba; a Claude key gives much better translations)");
  }
  cacheSet(key, { en });
  return en;
}

/** Longer texts: translate in chunks of whole sentences (the free API takes ≤500 characters per request). */
export async function translateLong(text, opts) {
  const sentences = text.match(/[^.!?…]+(?:[.!?…]+["»”)]*|$)\s*/g) || [text];
  const chunks = [];
  for (const s of sentences) {
    if (chunks.length && (chunks.at(-1) + s).length <= 450) chunks[chunks.length - 1] += s;
    else chunks.push(s);
  }
  const out = [];
  for (const c of chunks.filter((c) => c.trim())) out.push(await translate(c.trim(), opts));
  return out.join(" ");
}
