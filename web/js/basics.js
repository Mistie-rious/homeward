// Basics: adding course words and sentences to the review cards, and per-unit progress.
import { UNITS, unitById } from "./course.js";
import { all, get, kvGet, run, tx } from "./db.js";
import { addCard, settings } from "./srs.js";
import { nfc } from "./nlp.js";

export const refOf = (unitId, kind, i) => `${unitId}:${kind}:${i}`;

/** Does the learner get typing cards (English → Yoruba) for course items? On by default: typing is how marks are learned. */
export const typingCards = () => kvGet("typing_cards", true);

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The example sentence with the word marked [[like this]] (whole word only). */
export function markIn(sentence, word) {
  const re = new RegExp(`(?<![\\p{L}\\p{M}])${escRe(word)}(?![\\p{L}\\p{M}])`, "iu");
  return sentence.replace(re, (m) => `[[${m}]]`);
}

function ensureProduce(itemId, at) {
  if (!get("SELECT id FROM card WHERE item_id = ? AND template = 'produce'", [itemId])) addCard(itemId, "produce", at);
}

/** Add one course word ("w") or phrase ("p") to the reviews. Returns {itemId, created}. Safe to call twice. */
export function addCourseItem(unitId, kind, index, { typing = typingCards() } = {}) {
  const unit = unitById(unitId);
  const x = (kind === "w" ? unit?.words : unit?.phrases)?.[index];
  if (!x) throw new Error("Unknown course item");
  const ref = refOf(unitId, kind, index);
  const at = Date.now();
  const isWord = kind === "w";
  const existing = isWord
    ? get("SELECT id, ref FROM item WHERE kind = 'word' AND lemma = ?", [nfc(x.yo)])
    : get("SELECT id, ref FROM item WHERE kind = 'sentence' AND front = ?", [nfc(x.yo)]);
  if (existing) {
    if (!existing.ref) run("UPDATE item SET ref = ? WHERE id = ?", [ref, existing.id]);
    if (typing) ensureProduce(existing.id, at);
    return { itemId: existing.id, created: false };
  }
  return tx(() => {
    const itemId = isWord
      ? run("INSERT INTO item(kind, lemma, front, back, context, context_en, ref, created_at) VALUES ('word',?,?,?,?,?,?,?)", [
          x.yo, x.yo, x.en, markIn(x.ex, x.yo), x.exEn, ref, at,
        ])
      : run("INSERT INTO item(kind, front, back, note, ref, created_at) VALUES ('sentence',?,?,?,?,?)", [x.yo, x.en, x.note || null, ref, at]);
    addCard(itemId, "recog", at);
    if (typing) addCard(itemId, "produce", at);
    return { itemId, created: true };
  });
}

/** Add every word and phrase of a unit that isn't in the reviews yet. Returns how many were new. */
export function addUnit(unitId, opts) {
  const unit = unitById(unitId);
  const have = addedRefs(unitId);
  let n = 0;
  unit.words.forEach((_, i) => { if (!have.has(refOf(unitId, "w", i)) && addCourseItem(unitId, "w", i, opts).created) n++; });
  unit.phrases.forEach((_, i) => { if (!have.has(refOf(unitId, "p", i)) && addCourseItem(unitId, "p", i, opts).created) n++; });
  return n;
}

/** Refs of this unit's items that are in the reviews. */
export const addedRefs = (unitId) =>
  new Set(all("SELECT ref FROM item WHERE ref LIKE ? AND suspended = 0", [`${unitId}:%`]).map((r) => r.ref));

/** Per-unit progress: {id, total, added, known}. "known" = the recognition card has settled (stability ≥ knownDays). */
export function progress() {
  const rows = all(
    `SELECT item.ref AS ref, card.state AS state, card.stability AS stability
     FROM item LEFT JOIN card ON card.item_id = item.id AND card.template = 'recog'
     WHERE item.ref IS NOT NULL AND item.suspended = 0`,
  );
  const known = settings().knownDays;
  return UNITS.map((u) => {
    const mine = rows.filter((r) => r.ref.startsWith(`${u.id}:`));
    return {
      id: u.id,
      total: u.words.length + u.phrases.length,
      added: mine.length,
      known: mine.filter((r) => r.state === 2 && r.stability >= known).length,
    };
  });
}

/** A different sentence every day (same all day), as {unit, index, item}. */
export function phraseOfDay(date = new Date()) {
  const all = UNITS.flatMap((unit) => unit.phrases.map((item, index) => ({ unit, index, item })));
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  return all[day % all.length];
}

/** Course items added today (for the Today checklist). */
export const addedToday = (since) => get("SELECT COUNT(*) AS n FROM item WHERE ref IS NOT NULL AND created_at >= ?", [since]).n;
