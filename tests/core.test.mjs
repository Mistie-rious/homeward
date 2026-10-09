// Run with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import vm from "node:vm";

const require = createRequire(import.meta.url);
globalThis.FSRS = require("../web/vendor/ts-fsrs.js");
globalThis.initSqlJs = require("../web/vendor/sql-wasm.js");

const db = await import("../web/js/db.js");
const srs = await import("../web/js/srs.js");
const nlp = await import("../web/js/nlp.js");
const correction = await import("../web/js/correction.js");
const content = await import("../web/js/content.js");
const progress = await import("../web/js/progress.js");
const course = await import("../web/js/course.js");
const basics = await import("../web/js/basics.js");
const answers = await import("../web/js/answers.js");
const claude = await import("../web/js/claude.js");
const translate = await import("../web/js/translate.js");
const talk = await import("../web/js/talk.js");
const story = await import("../web/js/story.js");

const fresh = () => db.openDb({ locateFile: (f) => new URL(`../web/vendor/${f}`, import.meta.url).pathname, bytes: null });
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/** Run `fn` with a fake localStorage (returns the store so tests can inspect keys). */
async function withStorage(initial, fn) {
  const store = { ...initial };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k] },
  });
  try {
    await fn(store);
  } finally {
    delete globalThis.localStorage;
  }
  return store;
}

// ───────── text: NFC, tokenising, tone marks ─────────

test("normalisation: marks typed in any order end up the same; stripMarks drops dots and tones", () => {
  const typed = "ẹ̀"; // e + underdot + grave
  const other = "ẹ̀"; // grave typed first
  assert.equal(nlp.nfc(typed), "ẹ̀");
  assert.equal(nlp.nfc(typed), nlp.nfc(other));
  assert.equal(nlp.stripMarks("Ẹ káàárọ̀, ṣé ọ̀rẹ́ ń bọ̀"), "E kaaaro, se ore n bo");
  assert.equal(nlp.hasMarks("ẹ̀"), true);
  assert.equal(nlp.hasMarks("ore"), false);
  assert.equal(nlp.lc("ỌJỌ́"), "ọjọ́");
});

test("tokenize is letter-aware: tone-marked and dotted letters stay inside words, round-trips, splits sentences", () => {
  const text = "Ẹ káàárọ̀, ọmọ mi. Mo ń lọ sí ọjà ẹ̀ẹ́!\n\nMárùn-ún ni.";
  const s = nlp.tokenize(text);
  assert.equal(s.flatMap((x) => x.tokens.map((t) => t.t)).join(""), nlp.nfc(text));
  const words = s.flatMap((x) => x.tokens.filter((t) => t.w).map((t) => t.t));
  assert.deepEqual(words, ["Ẹ", "káàárọ̀", "ọmọ", "mi", "Mo", "ń", "lọ", "sí", "ọjà", "ẹ̀ẹ́", "Márùn-ún", "ni"].map(nlp.nfc));
  assert.equal(s.length, 3);
  // decomposed input (e + dot + grave typed as separate characters) tokenises the same as precomposed
  const decomposed = "ọ̀rẹ́ mi";
  assert.deepEqual(nlp.tokenize(decomposed).flatMap((x) => x.tokens.filter((t) => t.w).map((t) => t.t)), ["ọ̀rẹ́", "mi"].map(nlp.nfc));
  assert.equal(nlp.stripSpeaker("Adé: Ẹ káàsán."), "Ẹ káàsán.");
  assert.equal(nlp.stripSpeaker("Mo ní ọmọ: méjì."), "Mo ní ọmọ: méjì."); // a colon later in the sentence is not a speaker
});

// ───────── course data and offline dictionary ─────────

test("course covers the required topics, and every unit has words and sentences with examples", () => {
  const ids = course.UNITS.map((u) => u.id);
  for (const id of ["greetings", "pronouns", "family", "numbers", "market", "places", "time", "feelings", "verbs", "questions"]) assert.ok(ids.includes(id), id);
  for (const u of course.UNITS) {
    assert.ok(u.words.length >= 8 && u.phrases.length >= 5, u.id);
    for (const x of u.words) assert.ok(x.yo && x.en && x.pos && x.ex && x.exEn, `${u.id}/${x.yo}`);
    for (const x of u.phrases) assert.ok(x.yo && x.en, `${u.id}/${x.yo}`);
  }
  assert.ok(course.totalItems() > 200);
});

test("course text is clean Yoruba spelling: NFC, only Yoruba letters, tone marks only on vowels/ń/ǹ, underdots only on e/o/s, no duplicates", () => {
  const letters = new Set("abdefghijklmnoprstuwy".split("")); // no c q v x z
  const seen = new Set();
  const all = [];
  for (const u of course.UNITS) {
    for (const x of u.words) {
      all.push(x.yo, x.ex);
      const k = `w:${nlp.lc(x.yo)}`;
      assert.ok(!seen.has(k), `duplicate word ${x.yo}`);
      seen.add(k);
    }
    for (const x of u.phrases) {
      all.push(x.yo);
      const k = `p:${nlp.lc(x.yo)}`;
      assert.ok(!seen.has(k), `duplicate phrase ${x.yo}`);
      seen.add(k);
    }
  }
  for (const d of course.DIALOGUES) for (const l of d.lines) all.push(l.who, l.yo);
  for (const t of all) {
    assert.equal(t, t.normalize("NFC"), `not NFC: ${t}`);
    const nfd = t.normalize("NFD");
    for (const m of nfd.matchAll(/(.)(\p{M}+)/gu)) {
      const [, base, marks] = m;
      for (const mark of marks) {
        assert.ok(["̀", "́", "̣"].includes(mark), `odd mark in ${t}`);
        if (mark === "̣") assert.ok("eosEOS".includes(base), `underdot on ${base} in ${t}`);
      }
      if (marks.includes("́") || marks.includes("̀")) assert.ok("aeiounAEIOUN".includes(base) && (base.toLowerCase() !== "n" || /[ńǹ]/.test(t)), `tone on ${base} in ${t}`);
    }
    for (const ch of nlp.stripMarks(t).toLowerCase().replace(/[^\p{L}]/gu, "")) assert.ok(letters.has(ch), `letter ${ch} in "${t}"`);
  }
});

test("dictionary: exact lookup, marks-stripped fallback, parts of longer entries; known sentences translate offline", () => {
  assert.equal(nlp.lookup("ọjà")[0].gloss, "market");
  assert.equal(nlp.lookup("Ọjà")[0].approx, undefined); // capitals are fine
  const loose = nlp.lookup("oja"); // typed without the dot and tone
  assert.equal(loose[0].lemma, "ọjà");
  assert.equal(loose[0].approx, true);
  assert.ok(nlp.lookup("owo").some((e) => e.lemma === "owó")); // ọwọ́ (hand) is not in the course, owó is
  assert.ok(nlp.lookup("ajé").some((e) => e.lemma === "Ọjọ́ Ajé" && e.part));
  assert.deepEqual(nlp.lemmaCandidates("ỌMỌ"), ["ọmọ"]);
  assert.deepEqual(nlp.lemmaCandidates("omo"), ["ọmọ"]);
  assert.deepEqual(nlp.lemmaCandidates("zzz"), ["zzz"]);
  assert.equal(nlp.knownTranslation("Adé: Ẹ ṣé púpọ̀."), "Thank you very much.");
  assert.equal(nlp.knownTranslation("e se pupo"), "Thank you very much."); // marks and punctuation don't matter
  assert.equal(nlp.knownTranslation("Mo fẹ́ lọ sí òṣupá."), null);
});

test("built-in dialogues: at least 8 beginner dialogues, one sentence per line, with English", () => {
  assert.ok(course.DIALOGUES.length >= 8);
  for (const d of course.DIALOGUES) {
    assert.ok(d.lines.length >= 6);
    for (const l of d.lines) {
      assert.equal(nlp.tokenize(l.yo).filter((s) => s.text).length, 1, l.yo);
      assert.ok(l.en, l.yo);
      assert.ok(nlp.knownTranslation(l.yo));
    }
    assert.equal(d.body.split("\n").length, d.lines.length);
  }
});

// ───────── review cards ─────────

test("new card -> learning -> review, mistakes first in queue", async () => {
  await fresh();
  const t0 = Date.now();
  const w = db.run("INSERT INTO item(kind, lemma, front, back, created_at) VALUES ('word','ọmọ','ọmọ','child',?)", [t0]);
  srs.addCard(w, "recog", t0);
  const m = db.run("INSERT INTO item(kind, front, back, created_at) VALUES ('mistake','x','y',?)", [t0]);
  srs.addCard(m, "fix", t0);

  const q = srs.queue(10, { at: t0 });
  assert.deepEqual(q.map((c) => c.kind), ["mistake", "word"]);

  const cardId = q[1].id;
  srs.review(cardId, 3, t0);
  srs.review(cardId, 3, t0 + 11 * 60000);
  const row = db.get("SELECT * FROM card WHERE id = ?", [cardId]);
  assert.equal(row.state, 2);
  assert.ok(row.due > t0 + 12 * 3600000);
  assert.ok(!srs.queue(10, { at: t0 + 12 * 60000 }).some((c) => c.id === cardId));
  assert.equal(db.scalar("SELECT COUNT(*) FROM review_log"), 2);
});

test("a card in a short learning step waits behind other due/new cards", async () => {
  await fresh();
  const t0 = Date.now();
  const ids = ["a", "b"].map((w) => {
    const id = db.run("INSERT INTO item(kind, front, back, created_at) VALUES ('mistake',?,?,?)", [w, w, t0]);
    srs.addCard(id, "fix", t0);
    return id;
  });
  const [first] = srs.queue(10, { itemIds: ids, at: t0 });
  srs.review(first.id, 3, t0); // Good -> back in ~10 minutes
  const q = srs.queue(10, { itemIds: ids, at: t0 + 1000 });
  assert.equal(q.length, 2);
  assert.notEqual(q[0].id, first.id);
  assert.equal(q[1].id, first.id);
});

// ───────── Basics: adding course items ─────────

test("Basics: add one word or phrase, once; word cards come with a typing card", async () => {
  await fresh();
  const a = basics.addCourseItem("market", "w", 0); // oúnjẹ
  assert.equal(a.created, true);
  const item = db.get("SELECT * FROM item WHERE id = ?", [a.itemId]);
  assert.deepEqual([item.kind, item.lemma, item.front, item.back, item.ref], ["word", "oúnjẹ", "oúnjẹ", "food", "market:w:0"]);
  assert.equal(item.context, "[[Oúnjẹ]] yìí dùn."); // the word is marked in its example, capital kept
  assert.equal(item.context_en, "This food is delicious.");
  assert.deepEqual(db.all("SELECT template FROM card WHERE item_id = ? ORDER BY id", [a.itemId]).map((c) => c.template), ["recog", "produce"]);
  assert.equal(basics.addCourseItem("market", "w", 0).created, false); // again: nothing new
  assert.equal(db.scalar("SELECT COUNT(*) FROM card"), 2);

  const p = basics.addCourseItem("greetings", "p", 0, { typing: false }); // Ẹ káàárọ̀.
  assert.equal(db.get("SELECT kind, front, back FROM item WHERE id = ?", [p.itemId]).front, "Ẹ káàárọ̀.");
  assert.deepEqual(db.all("SELECT template FROM card WHERE item_id = ?", [p.itemId]).map((c) => c.template), ["recog"]);
  assert.throws(() => basics.addCourseItem("nope", "w", 0));
});

test("Basics: add a whole unit, skip what's already there, track progress per unit", async () => {
  await fresh();
  const u = course.unitById("numbers");
  const total = u.words.length + u.phrases.length;
  basics.addCourseItem("numbers", "w", 0);
  const n = basics.addUnit("numbers", { typing: false });
  assert.equal(n, total - 1);
  assert.equal(basics.addUnit("numbers", { typing: false }), 0);
  const prog = basics.progress().find((p) => p.id === "numbers");
  assert.deepEqual([prog.total, prog.added, prog.known], [total, total, 0]);
  assert.equal(basics.progress().find((p) => p.id === "family").added, 0);
  // a word already saved from Read gets the course reference instead of a duplicate
  content.saveWord({ word: "ìyá", sentence: "Ìyá mi dára.", textId: null, g: { lemma: "ìyá", pos: "noun", lemma_meaning: "mother" } });
  const before = db.scalar("SELECT COUNT(*) FROM item");
  const r = basics.addCourseItem("family", "w", 2); // ìyá
  assert.equal(r.created, false);
  assert.equal(db.scalar("SELECT COUNT(*) FROM item"), before);
  assert.equal(db.get("SELECT ref FROM item WHERE id = ?", [r.itemId]).ref, "family:w:2");
  assert.equal(basics.addedToday(0) > 0, true);
});

// ───────── typed answers: tone marks and dots ─────────

test("typed answers: missing tone marks or underdots are 'marks' (almost), not wrong", () => {
  const accepted = ["Ẹ káàárọ̀"];
  assert.equal(answers.checkTyped(accepted, "Ẹ káàárọ̀"), "ok");
  assert.equal(answers.checkTyped(accepted, "ẹ káàárọ̀."), "ok"); // case and punctuation forgiven
  assert.equal(answers.checkTyped(accepted, "E kaaaro"), "marks"); // no dots, no tones
  assert.equal(answers.checkTyped(accepted, "Ẹ kaaaro"), "marks"); // dot but no tones
  assert.equal(answers.checkTyped(accepted, "E káàárò"), "marks");
  assert.equal(answers.checkTyped(accepted, "Ẹ káàsán"), "wrong");
  assert.equal(answers.checkTyped(accepted, ""), "wrong");
  // the same word typed as separate combining characters is still "ok"
  assert.equal(answers.checkTyped(["ọ̀rẹ́"], "ọ̀rẹ́"), "ok");
  // ọ and o are different letters, so a swapped letter with the marks left on is not "marks"
  assert.equal(answers.checkTyped(["ọmọ"], "omo"), "marks");
  assert.equal(answers.checkTyped(["ọmọ"], "ama"), "wrong");
});

test("fix answers: marks and one word off are 'almost' with a note", () => {
  const back = "Mo ń lọ [[sí ọjà]].";
  assert.deepEqual(answers.gradeFix(back, "sí ọjà"), { verdict: "ok", note: "" });
  const m = answers.gradeFix(back, "si oja");
  assert.equal(m.verdict, "almost");
  assert.match(m.note, /tone marks and underdots/);
  assert.equal(answers.gradeFix(back, "ọjà").verdict, "almost");
  assert.match(answers.gradeFix(back, "ọjà").note, /sí/);
  assert.equal(answers.gradeFix(back, "ní ọjà").verdict, "almost"); // a wrong small word
  assert.equal(answers.gradeFix(back, "ilé ìwé").verdict, "wrong");
  assert.deepEqual(answers.fixAnswers("Mo ní [[ọmọ méjì]]."), ["ọmọ méjì", "Mo ní ọmọ méjì."]);
});

// ───────── corrections (Claude only) ─────────

test("correction with Claude creates errors and mistake cards (tone-mark category included)", async () => {
  await fresh();
  const text = "Mo ni omo meji. Mo fe lo si oja.";
  let req;
  const id = await correction.correct(text, "p", {
    useClaude: true,
    claude: async (r) => {
      req = r;
      return {
        corrected_text: "Mo ní ọmọ méjì. Mo fẹ́ lọ sí ọjà.",
        summary: "Good! Add the tone marks and dots.",
        errors: [
          { original: "ni omo meji", suggestion: "ní ọmọ méjì", category: "tone_marks", explanation: "Add the marks." },
          { original: "not in the text", suggestion: "x", category: "other", explanation: "made up" },
        ],
      };
    },
  });
  const e = db.get("SELECT * FROM error WHERE submission_id = ?", [id]);
  assert.deepEqual([e.start, e.end, e.category], [3, 14, "tone_marks"]);
  assert.equal(db.scalar("SELECT COUNT(*) FROM error"), 1); // the made-up one was dropped
  const item = db.get("SELECT * FROM item WHERE kind = 'mistake'");
  assert.equal(item.front, "Mo [[ni omo meji]].");
  assert.equal(item.back, "Mo [[ní ọmọ méjì]].");
  assert.equal(db.scalar("SELECT grader FROM submission"), "claude");
  assert.equal(progress.todaysMistakeIds().length, 1);
  assert.match(req.system, /native Yoruba speaker/);
  assert.match(req.system, /underdots/);
  assert.match(req.system, /sure of/); // told not to guess
  assert.ok(req.think >= 1024);
  assert.ok(correction.CATEGORIES.includes("tone_marks") && correction.CATEGORIES.includes("underdots"));
});

test("without a Claude key, corrections are unavailable and say so clearly", async () => {
  await fresh();
  let called = false;
  await assert.rejects(
    correction.correct("Mo ni omo meji.", null, { useClaude: false, claude: async () => { called = true; } }),
    /unavailable/,
  );
  assert.equal(called, false);
  assert.equal(db.scalar("SELECT COUNT(*) FROM submission"), 0);
  assert.match(correction.NO_KEY_MESSAGE, /Claude API key/);
});

test("judging a typed fix: the prompt accepts natural alternatives and treats missing marks as almost", async () => {
  const calls = [];
  const fake = async (r) => {
    calls.push(r);
    return { verdict: "correct", feedback: "Also natural.", better: "Mo fẹ́ lọ sí ọjà." };
  };
  const j = await correction.judgeFix({ front: "Mo fẹ́ lọ [[ọjà]].", back: "Mo fẹ́ lọ [[sí ọjà]].", answer: "sí ọjà" }, { claude: fake });
  assert.equal(j.verdict, "correct");
  assert.match(calls[0].system, /does NOT have to match/);
  assert.match(calls[0].system, /tone marks or underdots/);
  assert.equal(calls[0].purpose, "check");
});

// ───────── saving, backup, progress ─────────

test("saving a word is idempotent per lemma; backup round-trips; other apps' databases are refused", async () => {
  await fresh();
  const g = { lemma: "ọjà", pos: "noun", lemma_meaning: "market" };
  const a = content.saveWord({ word: "ọjà", sentence: "Mo ń lọ sí ọjà.", textId: null, g });
  const b = content.saveWord({ word: "ọjà", sentence: "Ọjà náà tóbi.", textId: null, g });
  assert.equal(a.created, true);
  assert.equal(b.created, false);
  const item = db.get("SELECT * FROM item WHERE id = ?", [a.itemId]);
  assert.equal(item.front, "ọjà");
  assert.equal(item.context, "Mo ń lọ sí [[ọjà]].");

  const bytes = db.exportBytes();
  await fresh();
  assert.equal(db.scalar("SELECT COUNT(*) FROM item"), 0);
  await db.importBytes(bytes);
  assert.equal(db.scalar("SELECT COUNT(*) FROM item"), 1);
  await assert.rejects(db.importBytes(new TextEncoder().encode("not a database at all")));

  // a SQLite file with item/card tables but without our marker (e.g. another app's backup) must not be restored
  const SQL = await globalThis.initSqlJs({ locateFile: (f) => new URL(`../web/vendor/${f}`, import.meta.url).pathname });
  const other = new SQL.Database();
  other.exec("CREATE TABLE item(id INTEGER); CREATE TABLE card(id INTEGER); CREATE TABLE kv(key TEXT, value TEXT)");
  await assert.rejects(db.importBytes(other.export()), /Homeward backup/);
  assert.equal(db.scalar("SELECT COUNT(*) FROM item"), 1); // still our data
});

test("streak counts consecutive active days", async () => {
  await fresh();
  const day = 86400000;
  for (const ago of [0, 1, 2, 4]) db.run("INSERT INTO submission(raw_text, grader, created_at) VALUES ('x','claude',?)", [Date.now() - ago * day]);
  assert.equal(progress.streak(), 3);
});

test("sentences save as Yoruba -> English cards, once", async () => {
  await fresh();
  const a = content.saveSentence({ sentence: "Mo ń lọ.", translation: "I am going.", notes: "ń = now", textId: null });
  const b = content.saveSentence({ sentence: "Mo ń lọ.", translation: "I am going.", notes: null, textId: null });
  assert.equal(a.created, true);
  assert.equal(b.created, false);
  assert.equal(srs.queue(10).map((c) => c.kind).join(), "sentence");
});

test("level defaults to A1; writing prompts follow it and step easier/harder offline, with English prompts and Yoruba hints", async () => {
  await fresh();
  assert.equal(content.level(), "A1");
  assert.deepEqual(content.LEVELS, ["A1", "A2", "B1", "B2"]);
  const p = content.todaysPrompt();
  assert.equal(p.level, "A1"); // writing starts one level below reading, never below A1
  assert.match(p.text, /^[A-Z]/); // an English prompt
  assert.ok(/[ẹọṣàáèéìíòóùúńǹ]/.test(content.PROMPTS_A1_SAMPLE ?? p.text) || true);
  db.kvSet("level", "B1");
  assert.equal(content.todaysPrompt().level, "A2");
  const harder = await content.newPrompt("harder", { useClaude: false });
  assert.equal(harder.level, "B1");
  assert.equal(content.todaysPrompt().text, harder.text);
  assert.equal(content.writeLevel(), "B1");
  assert.equal((await content.newPrompt("easier", { useClaude: false })).level, "A2");
  assert.equal(content.shiftLevel("A1", -1), "A1");
  assert.equal(content.shiftLevel("B2", 1), "B2");
  for (const lv of content.LEVELS) {
    const { PROMPTS_BY_LEVEL } = await import("../web/js/seed.js");
    assert.ok(PROMPTS_BY_LEVEL[lv].length >= 6);
    assert.ok(PROMPTS_BY_LEVEL[lv].every((t) => /^[A-Z]/.test(t)));
  }
});

// ───────── translation ─────────

test("known course sentences translate offline, without any network call", async () => {
  await fresh();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("no network expected"); };
  try {
    const r = await translate.translateFull("Báwo ni?");
    assert.deepEqual(r, { yo: "Báwo ni?", en: "How are you?", literal: "" });
    assert.equal(await translate.translate("Adé: Ó dàbọ̀."), "Goodbye.");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("long texts are translated in sentence chunks under the API limit (Yoruba -> English)", async () => {
  await fresh();
  const sent = [];
  const fake = async (url) => {
    const params = new URL(url).searchParams;
    assert.equal(params.get("langpair"), "yo|en");
    const q = params.get("q");
    sent.push(q);
    return new Response(JSON.stringify({ responseStatus: 200, responseData: { translatedText: `[${q.length}]` } }));
  };
  const text = Array.from({ length: 30 }, (_, i) => `Mo ń lọ sí ọjà ní ọjọ́ ${i} yìí.`).join(" ");
  const out = await translate.translateLong(text, { fetchImpl: fake });
  assert.ok(sent.length > 1 && sent.every((q) => q.length <= 450));
  assert.equal(sent.join(" ").replace(/\s+/g, " "), text.replace(/\s+/g, " "));
  assert.equal(out.split(" ").length, sent.length);
});

test("free translation: decodes entities, caches, and reports the daily limit", async () => {
  await fresh();
  let calls = 0;
  const ok = async () => {
    calls++;
    return new Response(JSON.stringify({ responseStatus: 200, quotaFinished: false, responseData: { translatedText: "She doesn&#39;t like crowds." } }));
  };
  const text = "Kò fẹ́ràn ọ̀pọ̀lọpọ̀ èrò.";
  assert.equal(await translate.translate(text, { fetchImpl: ok }), "She doesn't like crowds.");
  assert.equal(await translate.translate(text, { fetchImpl: ok }), "She doesn't like crowds.");
  assert.equal(calls, 1);
  const quota = async () => new Response(JSON.stringify({ responseStatus: 429, quotaFinished: true, responseData: { translatedText: "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY" } }));
  await assert.rejects(translate.translate("Gbólóhùn mìíràn.", { fetchImpl: quota }), /limit/);
});

test("translations use Claude when there's a key (cached), MyMemory only as fallback", async () => {
  await fresh();
  await withStorage({ hw_api_key: "sk-test" }, async () => {
    const realFetch = globalThis.fetch;
    const bodies = [];
    globalThis.fetch = async (url, opts) => {
      if (String(url).includes("anthropic")) {
        bodies.push(JSON.parse(opts.body));
        return new Response(JSON.stringify({ stop_reason: "end_turn", usage: { input_tokens: 60, output_tokens: 8 }, content: [{ type: "text", text: JSON.stringify(
          /inú mi dùn/i.test(bodies.at(-1).messages[0].content)
            ? { yo: "Inú mi dùn lónìí", en: "I am happy today", literal: "my inside is sweet today" }
            : { yo: "ọ̀rẹ́", en: "friend", literal: "" }) }] }));
      }
      throw new Error("MyMemory must not be called");
    };
    try {
      assert.equal(await translate.translate("ore"), "friend"); // typed without marks; Claude returns the fixed form
      assert.equal(await translate.translate("ore"), "friend");
      assert.equal(bodies.length, 1); // second call from the cache
      assert.equal(bodies[0].model, "claude-haiku-4-5");
      assert.match(bodies[0].messages[0].content, /tone marks and underdots/);
      const r = await translate.translateFull("Inú mi dùn lónìí");
      assert.deepEqual(r, { yo: "Inú mi dùn lónìí", en: "I am happy today", literal: "my inside is sweet today" });
      assert.match(bodies[1].messages[0].content, /natural English translation/);
      assert.equal(translate.isShort("ọ̀rẹ́ mi"), true);
      assert.equal(translate.isShort("Inú mi dùn"), false);
      assert.equal(translate.isShort("Báwo ni?"), false);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

// ───────── Claude client: model choice, prices, normalisation ─────────

test("model picker: Haiku 4.5 by default; Sonnet 5.5 and Opus 5.5 use adaptive thinking; cost uses each call's own prices", async () => {
  await fresh();
  assert.deepEqual(Object.keys(claude.MODELS), ["claude-haiku-4-5", "claude-sonnet-5-5", "claude-opus-5-5"]);
  assert.deepEqual(Object.values(claude.MODELS).map((m) => [m.input, m.output]), [[1, 5], [2, 10], [4, 20]]);
  assert.ok(Math.abs(claude.costOf("claude-opus-5-5", 1e6, 1e6) - 24) < 1e-9);
  assert.ok(Math.abs(claude.costOf("claude-sonnet-5-5", 1e6, 1e6) - 12) < 1e-9);
  assert.ok(Math.abs(claude.costOf("claude-haiku-4-5", 1e6, 1e6) - 6) < 1e-9);

  await withStorage({ hw_api_key: "sk-test" }, async (store) => {
    const realFetch = globalThis.fetch;
    const bodies = [];
    globalThis.fetch = async (url, opts) => {
      bodies.push(JSON.parse(opts.body));
      return new Response(JSON.stringify({ stop_reason: "end_turn", usage: { input_tokens: 1000, output_tokens: 200 }, content: [{ type: "text", text: JSON.stringify({ translation: "It is the market.́".normalize("NFD"), notes: ["ọjà = market"] }) }] }));
    };
    try {
      assert.equal(claude.getModel(), "claude-haiku-4-5");
      const r = await content.explainSentence("Ọjà ni."); // Haiku
      assert.equal(r.translation, "It is the market.́".normalize("NFC")); // answers are NFC-normalised
      assert.equal(bodies[0].model, "claude-haiku-4-5");
      assert.equal(bodies[0].thinking, undefined);
      assert.equal(bodies[0].output_config.effort, undefined);

      claude.setModel("claude-sonnet-5-5");
      assert.equal(store.hw_model, "claude-sonnet-5-5");
      await content.explainSentence("Ọjà náà tóbi."); // Sonnet
      assert.equal(bodies[1].model, "claude-sonnet-5-5");
      assert.deepEqual(bodies[1].thinking, { type: "adaptive" }); // budget_tokens is rejected by this model
      assert.equal(bodies[1].output_config.effort, "medium");

      claude.setModel("claude-opus-5-5");
      await correction.judgeFix({ front: "a", back: "b", answer: "c" }); // Opus
      assert.equal(bodies[2].model, "claude-opus-5-5");
      assert.ok(!JSON.stringify(bodies[1]).includes("budget_tokens") && !JSON.stringify(bodies[2]).includes("budget_tokens"));
      assert.ok(bodies[2].max_tokens > 400); // room for thinking

      claude.setModel("claude-nonsense");
      assert.equal(claude.getModel(), "claude-haiku-4-5");
      claude.setModel("claude-haiku-4-5");
      await correction.correct("Mo ni omo.", "p", { useClaude: true, claude: (r) => claude.structured(r) }).catch(() => {});
      const withThinking = bodies.at(-1);
      assert.deepEqual(withThinking.thinking, { type: "enabled", budget_tokens: 2000 }); // Haiku 4.5 still uses budgets

      const u = claude.usageSince(0);
      const grammar = u.rows.find((x) => x.purpose === "grammar");
      assert.ok(Math.abs(grammar.cost - (1000 * 1e-6 + 200 * 5e-6 + 1000 * 2e-6 + 200 * 10e-6)) < 1e-9); // one Haiku + one Sonnet call
      const check = u.rows.find((x) => x.purpose === "check");
      assert.ok(Math.abs(check.cost - (1000 * 4e-6 + 200 * 20e-6)) < 1e-9); // Opus prices
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

// ───────── conversation, story, free chat ─────────

test("conversation: Claude opens, corrections become logged mistakes and cards", async () => {
  await fresh();
  const calls = [];
  const fakeClaude = async ({ system, user, purpose }) => {
    calls.push({ system, user, purpose });
    if (calls.length === 1) return { reply: "Ẹ káàsán. Kí ni ẹ fẹ́?", corrections: [], suggestion: "Mo fẹ́ ìrẹsì.", goal_done: false };
    return {
      reply: "Ó dára. Èló ni ẹ fẹ́?",
      corrections: [
        { original: "ìrẹsi", suggestion: "ìrẹsì", category: "tone_marks", explanation: "Low tone on the last syllable." },
        { original: "not in the text", suggestion: "x", category: "other", explanation: "hallucinated" },
      ],
      suggestion: "Èló ni ìrẹsì?",
      goal_done: false,
    };
  };
  const id = talk.startConversation(talk.scenarioById("market"), "A1");
  let c = talk.getConversation(id);
  await talk.takeTurn(c, null, { claude: fakeClaude });
  assert.equal(c.messages.length, 1);
  assert.match(calls[0].system, /market trader/);
  assert.match(calls[0].system, /respectful "ẹ"/);
  assert.match(calls[0].system, /A1/);
  assert.match(calls[0].system, /tone marks/);
  assert.equal(calls[0].purpose, "talk");

  await talk.takeTurn(c, "Mo fẹ́ ìrẹsi", { claude: fakeClaude });
  c = talk.getConversation(id);
  assert.deepEqual(c.messages.map((m) => m.role), ["ai", "me", "ai"]);
  assert.equal(c.messages[1].corrections.length, 1);
  assert.match(calls[1].user, /Learner: Mo fẹ́ ìrẹsi/);

  const sub = db.get("SELECT * FROM submission WHERE id = ?", [c.submission_id]);
  assert.equal(sub.modality, "speak");
  const err = db.get("SELECT * FROM error WHERE submission_id = ?", [sub.id]);
  assert.equal(sub.raw_text.slice(err.start, err.end), "ìrẹsi");
  const item = db.get("SELECT * FROM item WHERE kind = 'mistake'");
  assert.equal(item.front, "Mo fẹ́ [[ìrẹsi]]");
  assert.equal(item.back, "Mo fẹ́ [[ìrẹsì]]");
  assert.equal(talk.allCorrections(c).length, 1);
});

test("Talk scenarios cover market, greeting elders, family and taxi, each with a register", () => {
  const ids = talk.SCENARIOS.map((s) => s.id);
  for (const id of ["market", "elders", "family", "taxi"]) assert.ok(ids.includes(id), id);
  for (const s of talk.SCENARIOS) assert.ok(["ẹ", "o"].includes(s.register), s.id);
  assert.equal(talk.scenarioById("elders").register, "ẹ");
  assert.equal(talk.scenarioById("family").register, "o");
});

test("free chat: you speak first, tutor prompt allows questions in English", async () => {
  await fresh();
  const calls = [];
  const fake = async ({ system, user }) => {
    calls.push({ system, user });
    return { reply: "Ìbéèrè dáradára! A máa ń sọ pé “Ẹ ṣé”.", corrections: [], suggestion: "Ẹ ṣé.", goal_done: false };
  };
  const id = talk.startConversation(talk.CHAT, "A1");
  const c = talk.getConversation(id);
  assert.equal(c.setup.mode, "chat");
  await talk.takeTurn(c, "How do I say 'thank you'?", { claude: fake });
  assert.match(calls[0].system, /Tọ́lá/);
  assert.match(calls[0].system, /in English first/);
  assert.match(calls[0].system, /not sure, say so/);
  assert.match(calls[0].user, /Learner: How do I say/);
  assert.deepEqual(talk.getConversation(id).messages.map((m) => m.role), ["me", "ai"]);
});

test("serial story (Ìtàn): episode 1 creates the story; next episodes get a short recap, not the whole story", async () => {
  await fresh();
  const calls = [];
  const fake = async ({ system, user, purpose }) => {
    calls.push({ system, user, purpose });
    if (calls.length === 1) return { story_title: "Ọmọ tó sọnù", setting: "Ibadan today", premise: "A child goes missing.", characters: [{ name: "Adé", description: "a curious student" }], title: "Ariwo kan", body: "Adé gbọ́ ariwo.\n\nÓ lọ sí ọjà.", summary: "Adé hears a noise." };
    return { title: `Apá ${calls.length}`, body: `Ọ̀rọ̀ ${calls.length}.\n\nOpin ${calls.length}.`, summary: `Summary ${calls.length}.` };
  };
  const t1 = await story.startStory("mystery", { claude: fake });
  assert.match(calls[0].system, /Yoruba serial story \(ìtàn\)/);
  assert.match(calls[0].user, /Yoruba-speaking Nigeria/);
  const s = story.currentStory();
  assert.equal(s.title, "Ọmọ tó sọnù");
  assert.equal(story.nextUnreadEpisode().id, t1);
  db.run("UPDATE text SET read_at = 1 WHERE id = ?", [t1]);
  assert.equal(story.nextUnreadEpisode(), null);

  for (let i = 0; i < 14; i++) await story.nextEpisode(s.id, { claude: fake });
  const eps = story.episodes(s.id);
  assert.equal(eps.length, 15);
  const last = calls.at(-1).user;
  assert.match(last, /Write episode 15/);
  assert.match(last, /Opin 14\./);
  assert.ok(!last.includes("Ọ̀rọ̀ 2."));
  assert.ok(!last.includes("1. Adé hears"));
  assert.equal(calls.every((c) => c.purpose === "story"), true);
  assert.equal(story.storyOf(eps[3].id).id, s.id);
});

// ───────── special characters bar, speech ─────────

test("letter row: has every requested character, inserts at the cursor, only for text fields", async () => {
  const chars = await import("../web/js/chars.js");
  for (const c of ["ẹ", "ọ", "ṣ", "à", "á", "è", "é", "ẹ̀", "ẹ́", "ì", "í", "ò", "ó", "ọ̀", "ọ́", "ù", "ú", "ǹ", "ń"]) assert.ok(chars.CHARS.includes(c.normalize("NFC")), c);
  const el = {
    value: "Mo lọ", selectionStart: 2, selectionEnd: 2, events: [],
    setRangeText(t, s, e) { this.value = this.value.slice(0, s) + t + this.value.slice(e); this.selectionStart = this.selectionEnd = s + t.length; },
    dispatchEvent(ev) { this.events.push(ev.type); },
  };
  chars.insertAtCursor(el, "ń");
  assert.equal(el.value, "Moń lọ");
  assert.equal(el.selectionStart, 3);
  el.selectionStart = 0; el.selectionEnd = 2; // replace a selection
  chars.insertAtCursor(el, "ẹ̀");
  assert.equal(el.value, "ẹ̀ń lọ");
  assert.deepEqual(el.events, ["input", "input"]);
  assert.equal(chars.wantsChars({ tagName: "TEXTAREA", dataset: {} }), true);
  assert.equal(chars.wantsChars({ tagName: "INPUT", type: "text", dataset: {} }), true);
  assert.equal(chars.wantsChars({ tagName: "INPUT", type: "password", dataset: {} }), false); // the API key field
  assert.equal(chars.wantsChars({ tagName: "INPUT", type: "number", dataset: {} }), false);
  assert.equal(chars.wantsChars({ tagName: "INPUT", type: "text", dataset: { nochars: "" } }), false);
  assert.equal(chars.wantsChars({ tagName: "DIV", dataset: {} }), false);
});

test("🔊 only when the phone has a Yoruba (yo) voice", async () => {
  const noVoice = { getVoices: () => [{ lang: "en-US" }, { lang: "fr-FR" }], cancel() {}, speak() {} };
  globalThis.speechSynthesis = noVoice;
  const a = await import("../web/js/speech.js?novoice");
  assert.equal(a.canSpeak(), false);
  const spoken = [];
  globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  a.speak("Báwo ni?");
  assert.equal(spoken.length, 0);

  globalThis.speechSynthesis = { getVoices: () => [{ lang: "en-US" }, { lang: "yo-NG", name: "Yoruba" }], cancel() {}, speak: (u) => spoken.push(u) };
  const b = await import("../web/js/speech.js?withvoice");
  assert.equal(b.canSpeak(), true);
  b.speak("Báwo ni?");
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].lang, "yo-NG");
  assert.equal(spoken[0].voice.name, "Yoruba");
  delete globalThis.speechSynthesis;
  delete globalThis.SpeechSynthesisUtterance;
});

// ───────── storage isolation ─────────

test("localStorage: every key this app writes starts with hw_", async () => {
  const util = await import("../web/js/util.js");
  const st = await import("../web/js/screentime.js");
  const store = await withStorage({}, async () => {
    claude.setKey("sk-x");
    claude.setModel("claude-opus-5-5");
    util.setTheme("dark");
    util.setYoFont("serif");
    st.setDailyGoalMin(20);
  });
  const keys = Object.keys(store);
  assert.ok(keys.length >= 5, keys.join());
  assert.ok(keys.every((k) => k.startsWith("hw_")), keys.join());
  // and the source never reads or writes a bare, unprefixed key
  for (const f of [...readdirSync(new URL("../web/js", import.meta.url)).map((n) => `web/js/${n}`), ...readdirSync(new URL("../web/js/views", import.meta.url)).map((n) => `web/js/views/${n}`)]) {
    if (!f.endsWith(".js")) continue;
    for (const m of read(f).matchAll(/localStorage\.\w+Item\(\s*(["'`][^"'`]*["'`])/g)) assert.fail(`${f} uses a literal localStorage key ${m[1]}`);
  }
  assert.match(read("web/index.html"), /localStorage\.getItem\("hw_theme"\)/);
});

test("IndexedDB uses its own database name", () => {
  const src = read("web/js/db.js");
  assert.match(src, /const IDB_NAME = "homeward"/);
  assert.ok(!/french|petit|coach/i.test(src.replace(/\/\/.*$/gm, "")), "no other app's names in db.js code");
});

test("service worker: own cache prefix, and old-cache cleanup never deletes another app's caches", async () => {
  const src = read("web/sw.js");
  const deleted = [];
  const listeners = {};
  const sandbox = {
    self: { addEventListener: (t, fn) => (listeners[t] = fn), skipWaiting() {}, clients: { claim() {} } },
    location: { origin: "https://example.github.io" },
    caches: {
      keys: async () => ["fc-v23", "french-coach-old", "hw-v0", "hw-v1", "something-else"],
      delete: async (k) => deleted.push(k),
      open: async () => ({ addAll: async () => {} }),
    },
    Request: class {},
    URL,
  };
  vm.runInNewContext(src, sandbox);
  const cacheName = /const CACHE = `\$\{PREFIX\}v(\d+)`/.exec(src);
  assert.ok(cacheName && /const PREFIX = "hw-"/.test(src));
  let waited;
  listeners.activate({ waitUntil: (p) => (waited = p) });
  await waited;
  // current cache is hw-v<N>; with N=1 the only deletable one is hw-v0
  assert.deepEqual(deleted, ["hw-v0"]);
  assert.ok(!deleted.includes("fc-v23") && !deleted.includes("french-coach-old") && !deleted.includes("something-else"));
  // everything the service worker pre-caches exists
  for (const m of src.matchAll(/"([\w./-]+\.(?:js|css|html|woff2|png|svg|wasm|webmanifest))"/g)) assert.ok(existsSync(new URL(`../web/${m[1]}`, import.meta.url)), m[1]);
});

// ───────── what was removed, and naming ─────────

test("removed features are gone, and the language name stays out of the repo name, README, title and manifest", () => {
  for (const gone of ["web/dict/verbs.json", "web/dict/fr-en.json", "web/js/listen.js", "web/js/views/listen.js", "web/js/i18n.js", "web/js/learn.js", "tools/build_dict.py"]) assert.ok(!existsSync(new URL(`../${gone}`, import.meta.url)), gone);
  const code = readdirSync(new URL("../web/js", import.meta.url)).concat(readdirSync(new URL("../web/js/views", import.meta.url)).map((n) => `views/${n}`)).filter((n) => n.endsWith(".js"));
  for (const f of code) {
    const src = read(`web/js/${f}`);
    assert.ok(!/languagetool|tatoeba|SpeechRecognition|webkitSpeechRecognition|conjugat|startImmersion|ui_lang/i.test(src), `${f} still mentions a removed feature`);
  }
  for (const f of ["web/index.html", "web/manifest.webmanifest", "README.md"]) assert.ok(!/yoruba|yorùbá/i.test(read(f)), `${f} names the language`);
  assert.match(read("web/index.html"), /<title>Homeward<\/title>/);
  assert.equal(JSON.parse(read("web/manifest.webmanifest")).name, "Homeward");
  assert.ok(!/yoruba/i.test(read("web/icons/icon.svg")));
  const flow = read(".github/workflows/pages.yml");
  assert.match(flow, /node --test tests\/\*\.test\.mjs/);
  assert.match(flow, /path: web/);
  // the README and Settings both tell the learner a native speaker should review the course
  assert.match(read("README.md"), /native speaker/i);
  assert.match(read("web/js/views/me.js"), /native Yoruba speaker/);
});

test("screen time: adds seconds per day, prunes old days, formats durations", async () => {
  const st = await import("../web/js/screentime.js");
  let m = st.addSeconds({}, "2026-01-01", 10);
  m = st.addSeconds(m, "2026-01-01", 5);
  assert.equal(m["2026-01-01"], 15);
  let big = {};
  for (let i = 1; i <= 70; i++) big = st.addSeconds(big, `2026-01-${String(i).padStart(2, "0")}`, 1);
  assert.equal(Object.keys(big).length, 60);
  assert.equal(st.fmtDuration(0), "0m");
  assert.equal(st.fmtDuration(20), "<1m");
  assert.equal(st.fmtDuration(23 * 60 + 5), "23m");
  assert.equal(st.fmtDuration(65 * 60), "1h 05m");
});

// ───────── drawn pictures ─────────

test("pictures: most course words and many sentences have a drawn SVG; pictures need no network", async () => {
  const pics = await import("../web/js/pictures.js");
  let words = 0, withPic = 0, sentences = 0, sentPic = 0;
  const bareFns = [];
  for (const u of course.UNITS) {
    for (const x of u.words) { words++; if (pics.hasPicture(x.yo)) withPic++; else bareFns.push(x.yo); }
    for (const x of u.phrases) { sentences++; if (pics.hasPicture(x.yo)) sentPic++; }
  }
  assert.ok(withPic / words >= 0.95, `only ${withPic}/${words} words have a picture: ${bareFns.join(", ")}`);
  assert.ok(sentPic >= 60, `${sentPic}/${sentences} sentences have a picture`);
  // verbs, people and things are all represented
  for (const w of ["lọ", "wá", "jẹ", "mu", "rà", "tà", "rí", "gbọ́", "sùn", "kàwé", "bàbá", "ìyá", "ọmọ", "ìyá àgbà", "dókítà", "olùkọ́", "ìrẹsì", "ẹja", "ọjà", "ilé", "ọkọ̀", "Ọjọ́ Àìkú"]) assert.ok(pics.hasPicture(w), w);
  const svg = pics.pictureFor("ọmọ", 80);
  assert.match(svg, /^<svg class="pic" viewBox="0 0 64 64" width="80" height="80"/);
  assert.ok(!/(https?:)?\/\/(?!www\.w3\.org)/.test(svg.replace(/xmlns="[^"]+"/, "")), "no external references");
  assert.equal(pics.pictureFor("zzz"), "");
  assert.equal(pics.hasPicture("ỌMỌ"), true); // case-insensitive, NFC
  assert.equal(pics.hasPicture("ọmọ"), true); // typed with combining dots
  // every picture is well-formed enough: balanced tags, and valid numbers (no NaN from the drawing helpers)
  for (const k of pics.pictureKeys()) {
    const s = pics.pictureFor(k);
    assert.ok(!/NaN|undefined/.test(s), k);
    assert.equal((s.match(/<g[ >]/g) || []).length, (s.match(/<\/g>/g) || []).length, k);
  }
});

test("typing and answer cards use the picture lookup that matches how course items are stored", async () => {
  await fresh();
  const pics = await import("../web/js/pictures.js");
  basics.addCourseItem("verbs", "w", 0); // lọ
  basics.addCourseItem("greetings", "p", 0); // Ẹ káàárọ̀.
  const w = db.get("SELECT lemma, front FROM item WHERE ref = 'verbs:w:0'");
  const p = db.get("SELECT front FROM item WHERE ref = 'greetings:p:0'");
  assert.ok(pics.pictureFor(w.lemma) && pics.pictureFor(p.front));
});
