// Pronunciation guide worked out from the spelling. Yoruba orthography is very regular (one letter ≈ one sound, tone marks
// written on every vowel), so syllables, tones and an English-style respelling can be derived by rules, offline, for any
// text: course words, sentences, your own words, generated stories. It is a guide, not a recording: listen to a native speaker.
import { LS_PREFIX } from "./util.js";
import { nfc } from "./nlp.js";

const KEY = `${LS_PREFIX}pron`;
export const showPron = () => {
  try { return localStorage.getItem(KEY) !== "0"; } catch { return true; }
};
export const setShowPron = (on) => {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch {}
};

const CONS_IPA = { b: "b", d: "d", f: "f", g: "ɡ", gb: "ɡ͡b", h: "h", j: "dʒ", k: "k", l: "l", m: "m", n: "n", p: "k͡p", r: "ɾ", s: "s", ṣ: "ʃ", t: "t", w: "w", y: "j" };
const CONS_SAY = { gb: "gb", p: "kp", j: "j", ṣ: "sh", r: "r", y: "y" };
const VOW_IPA = { a: "a", e: "e", ẹ: "ɛ", i: "i", o: "o", ọ: "ɔ", u: "u" };
const VOW_SAY = { a: "ah", e: "ay", ẹ: "eh", i: "ee", o: "oh", ọ: "aw", u: "oo" };
const ACUTE = "́", GRAVE = "̀", TILDE = "̃", SYLLABIC = "̩";

/** Split a string into letter units: {c: "gb"|"ṣ"|"ẹ"|…, tone: "h"|"m"|"l"} (consonants and vowels, with their marks). */
function units(word) {
  const out = [];
  const d = nfc(word).toLowerCase().normalize("NFD");
  for (let i = 0; i < d.length; ) {
    const base = d[i++];
    if (!/\p{L}/u.test(base)) continue;
    let dot = false, tone = "m";
    while (i < d.length && /\p{M}/u.test(d[i])) {
      if (d[i] === "̣") dot = true;
      else if (d[i] === ACUTE) tone = "h";
      else if (d[i] === GRAVE) tone = "l";
      i++;
    }
    let c = base;
    if (dot) c = base === "e" ? "ẹ" : base === "o" ? "ọ" : base === "s" ? "ṣ" : base;
    out.push({ c, tone, marked: tone !== "m" });
  }
  // g + b = the single letter "gb"
  const merged = [];
  for (let i = 0; i < out.length; i++) {
    if (out[i].c === "g" && out[i + 1]?.c === "b") { merged.push({ c: "gb", tone: "m", marked: false }); i++; }
    else merged.push(out[i]);
  }
  return merged;
}
const isVowel = (u) => u && u.c in VOW_IPA;

/** Syllables of one word: [{tone, ipa, say, text}]. Every vowel is a syllable; a lone n/m with a tone mark is its own syllable. */
export function syllables(word) {
  const parts = nfc(word).split(/[-'’]/).filter(Boolean);
  const out = [];
  for (const part of parts) {
    const u = units(part);
    let onset = "", i = 0;
    while (i < u.length) {
      const x = u[i];
      if (isVowel(x)) {
        let nasal = false;
        const n = u[i + 1];
        // vowel + n that isn't followed by a vowel = nasal vowel (kan, ẹ̀rin, ọgbọ̀n)
        if (n && n.c === "n" && !n.marked && !isVowel(u[i + 2])) { nasal = true; i++; }
        const o = onset ? CONS_IPA[onset] : "";
        const tone = x.tone;
        const mark = tone === "h" ? ACUTE : tone === "l" ? GRAVE : "";
        const ipa = `${o}${VOW_IPA[x.c]}${nasal ? TILDE : ""}${mark}`;
        const say = `${onset ? CONS_SAY[onset] ?? onset : ""}${VOW_SAY[x.c]}${nasal ? "n" : ""}`;
        out.push({ tone, ipa, say, text: nfc(`${onset}${x.c}`) });
        onset = "";
        i++;
      } else if ((x.c === "n" || x.c === "m") && x.marked && !isVowel(u[i + 1])) {
        // ń, ǹ: a syllable made of just a nasal
        out.push({ tone: x.tone, ipa: `${x.c}${SYLLABIC}${x.tone === "h" ? ACUTE : GRAVE}`, say: x.c, text: nfc(x.c) });
        i++;
      } else {
        onset = x.c; // a consonant starts the next syllable (a stray earlier one is dropped from the guide)
        i++;
      }
    }
  }
  return out;
}

const words = (text) => nfc(text).match(/[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*/gu) || [];

/** {ipa, say, tones}: IPA with dots between syllables, English-style respelling, and the tone of each syllable (h/m/l). */
export function pronounce(text) {
  const ws = words(text).map(syllables).filter((s) => s.length);
  return {
    ipa: nfc(ws.map((s) => s.map((x) => x.ipa).join(".")).join(" ")), // NFC: á as one character where one exists
    say: ws.map((s) => s.map((x) => x.say).join("·")).join(" "),
    words: ws,
  };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * HTML for the guide under a word or sentence: the respelling with each syllable raised (high), level (mid) or lowered (low),
 * and the IPA below. Returns "" when the guide is switched off or there's nothing to show.
 */
export function pronHtml(text, { ipa = true } = {}) {
  if (!showPron()) return "";
  const p = pronounce(text);
  if (!p.words.length) return "";
  const line = p.words
    .map((w) => `<span class="pw">${w.map((s) => `<span class="t-${s.tone}">${esc(s.say)}</span>`).join('<i>·</i>')}</span>`)
    .join(" ");
  return `<span class="pron" aria-label="Pronunciation guide"><span class="pron-say">${line}</span>${ipa ? `<span class="pron-ipa">/${esc(p.ipa)}/</span>` : ""}</span>`;
}
