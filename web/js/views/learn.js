import { all, kvGet, kvSet, scalar } from "../db.js";
import { explainSentence, saveSentence, saveWord } from "../content.js";
import { hasKey } from "../claude.js";
import { isShort, translateFull } from "../translate.js";
import { UNITS, unitById } from "../course.js";
import { addCourseItem, addUnit, addedRefs, progress, refOf } from "../basics.js";
import { GROUPS, LESSONS, lessonById } from "../lessons.js";
import { lemmaCandidates, lookup } from "../nlp.js";
import { pictureFor } from "../pictures.js";
import { canSpeak, speak } from "../speech.js";
import { queue, settings } from "../srs.js";
import { myItemIds } from "../progress.js";
import { openAsk } from "./ask.js";
import { busy, fmtDay, go, html, mark, raw, toast } from "../util.js";
export { speak };

// 🔊 buttons are always rendered but CSS hides them unless the phone has a Yoruba voice (see speech.js).
const sayBtn = (text) => html`<button class="say" data-say="${text}" aria-label="Pronounce">🔊</button>`;

// ---------- hub ----------

export function learnHub(root) {
  const due = queue(settings().reviewCap).length;
  const mineIds = myItemIds();
  const mineDue = mineIds.length ? queue(100, { itemIds: mineIds }).length : 0;
  const prog = progress();
  const added = prog.reduce((n, p) => n + p.added, 0);
  const total = prog.reduce((n, p) => n + p.total, 0);
  root.innerHTML = html`
    <h1>Learn</h1>
    <a href="#/learn/basics" class="card hub c-coral"><span class="hub-icon">🌱</span>
      <span class="grow"><strong>Basics</strong><small>Words and sentences to start with · ${added} of ${total} in your reviews</small></span><span class="chev">→</span></a>
    <a href="#/review" class="card hub c-purple"><span class="hub-icon">↻</span>
      <span class="grow"><strong>Review</strong><small>${due ? `${due} cards due` : "nothing due right now"}</small></span><span class="chev">→</span></a>
    <a href="#/learn/add" class="card hub c-purple"><span class="hub-icon">＋</span>
      <span class="grow"><strong>Add your own</strong><small>Type a Yoruba word or sentence, see what it means, save it to review</small></span><span class="chev">→</span></a>
    ${mineIds.length ? html`<a href="#/review?mine=1" class="card hub c-purple"><span class="hub-icon">★</span>
      <span class="grow"><strong>Review my words</strong><small>${mineDue ? `${mineDue} of yours to review` : "all caught up"}</small></span><span class="chev">→</span></a>` : ""}
    <a href="#/learn/tips" class="card hub c-mustard"><span class="hub-icon">✦</span>
      <span class="grow"><strong>Lessons</strong><small>${LESSONS.length} short lessons: alphabet and tones, greetings, grammar</small></span><span class="chev">→</span></a>`;
}

// ---------- basics ----------

export function basicsView(root) {
  const prog = progress();
  root.innerHTML = html`
    <h1>Basics</h1>
    <p class="muted small">Start here. Each unit has words and short sentences. Add one item, or a whole unit, to your review cards; they will come up in Review.</p>
    <ul class="list">${UNITS.map((u, i) => {
      const p = prog[i];
      const pct = Math.round((100 * p.added) / p.total);
      return html`<li><a href="#/learn/basics/${u.id}" class="card unit">
        <span class="unit-emoji">${u.emoji}</span>
        <span class="grow"><strong>${u.title}</strong>
          <small class="muted">${u.words.length} words · ${u.phrases.length} sentences</small>
          <span class="track"><span style="width:${pct}%"></span></span>
          <small class="muted">${p.added} of ${p.total} in reviews${p.known ? ` · ${p.known} known` : ""}</small></span>
        <span class="chev">→</span></a></li>`;
    })}</ul>
    <p class="small muted">The course was written without a native speaker's review. Use “Ask a question” in Review and Read to double-check anything that looks wrong.</p>`;
}

export function unitView(root, { params: [id], query }) {
  const u = unitById(id);
  if (!u) return go("#/learn/basics");
  const tab = query.get("tab") === "phrases" ? "phrases" : "words";
  const items = tab === "words" ? u.words : u.phrases;
  const kind = tab === "words" ? "w" : "p";
  let have = addedRefs(u.id);
  const total = u.words.length + u.phrases.length;
  root.innerHTML = html`
    <a href="#/learn/basics" class="back small">← Basics</a>
    <h1>${u.emoji} ${u.title}</h1>
    <p class="muted small">${u.blurb}</p>
    <div class="card stack">
      <p class="small" id="unit-count"></p>
      <button class="wide" id="add-all"></button>
      <label class="small muted check"><input type="checkbox" id="typing" ${kvGet("typing_cards", true) ? "checked" : ""}> Also make typing cards (English → Yoruba), to practise tone marks and underdots</label>
    </div>
    <div class="segmented">
      <button class="${tab === "words" ? "on" : ""}" data-href="#/learn/basics/${u.id}">Words (${u.words.length})</button>
      <button class="${tab === "phrases" ? "on" : ""}" data-href="#/learn/basics/${u.id}?tab=phrases">Sentences (${u.phrases.length})</button>
    </div>
    <ul class="list" id="items">${items.map((x, i) => html`
      <li class="card word-card" data-i="${i}">
        <div class="row between gap">
          ${pictureFor(x.yo) ? html`<div class="pic-tile">${raw(pictureFor(x.yo, 64))}</div>` : ""}
          <div class="grow">
            <p class="big yo">${x.yo} ${sayBtn(x.yo)}</p>
            <p>${x.en}${x.pos ? html` <small class="muted inline">${x.pos}</small>` : ""}</p>
            ${x.ex ? html`<p class="ex yo">${x.ex} ${sayBtn(x.ex)}<span>${x.exEn}</span></p>` : ""}
            ${x.note ? html`<p class="small muted">${x.note}</p>` : ""}
          </div>
          <button class="small-btn add-one"></button>
        </div>
      </li>`)}</ul>`;

  const countEl = root.querySelector("#unit-count");
  const allBtn = root.querySelector("#add-all");
  const paint = () => {
    countEl.textContent = `${have.size} of ${total} in your reviews.`;
    allBtn.textContent = have.size >= total ? "Whole unit is in your reviews ✓" : `Add the whole unit (${total - have.size} left)`;
    allBtn.disabled = have.size >= total;
    root.querySelectorAll("#items li").forEach((li) => {
      const done = have.has(refOf(u.id, kind, Number(li.dataset.i)));
      const b = li.querySelector(".add-one");
      b.textContent = done ? "✓" : "Add";
      b.disabled = done;
      b.classList.toggle("done", done);
    });
  };
  paint();
  root.querySelector("#typing").onchange = (e) => kvSet("typing_cards", e.target.checked);
  root.querySelector("#items").onclick = (e) => {
    const b = e.target.closest(".add-one");
    if (!b) return;
    const i = Number(b.closest("li").dataset.i);
    addCourseItem(u.id, kind, i);
    have = addedRefs(u.id);
    paint();
  };
  allBtn.onclick = () => {
    const n = addUnit(u.id);
    have = addedRefs(u.id);
    paint();
    toast(n ? `Added ${n} to your reviews ✓` : "Already in your reviews");
  };
}

// ---------- lessons ----------

export function tipsView(root) {
  root.innerHTML = html`
    <h1>Lessons</h1>
    ${GROUPS.map((g) => html`
      <h2>${g}</h2>
      <ul class="list">${LESSONS.filter((l) => l.group === g).map((l) => html`
        <li><a href="#/learn/tips/${l.id}" class="card row between gap">
          <span class="grow"><strong>${l.title}</strong></span><span class="pill">${l.level}</span>
        </a></li>`)}</ul>`)}`;
}

export function lessonView(root, { params: [id] }) {
  const l = lessonById(id);
  if (!l) return go("#/learn/tips");
  const idx = LESSONS.indexOf(l);
  const next = LESSONS[idx + 1];
  root.innerHTML = html`
    <p class="kind">${l.group} · ${l.level}</p>
    <h1>${l.title}</h1>
    <article class="lesson yo">${raw(l.body)}</article>
    ${hasKey() ? html`<button class="secondary wide" id="ask-lesson">💬 Ask about this lesson</button>` : ""}
    ${next ? html`<a class="card row between" href="#/learn/tips/${next.id}"><span><small class="muted">Next</small>${next.title}</span><span class="chev">→</span></a>` : ""}`;
  const askBtn = root.querySelector("#ask-lesson");
  if (askBtn) {
    askBtn.onclick = () => openAsk({
      label: l.title,
      context: `Lesson "${l.title}" (${l.group}, ${l.level}):\n${root.querySelector(".lesson").innerText}`,
      starters: ["Explain this more simply", "Can you quiz me?", "Give me more examples"],
    });
  }
  // 🔊 on every example line (hidden by CSS unless the phone has a Yoruba voice)
  root.querySelectorAll(".lesson .ex[data-say]").forEach((p) => {
    const b = document.createElement("button");
    b.className = "say";
    b.dataset.say = p.dataset.say;
    b.textContent = "🔊";
    b.setAttribute("aria-label", "Pronounce");
    p.prepend(b);
  });
}

// ---------- add your own words & sentences ----------

export async function addView(root) {
  const recent = all(`SELECT id, kind, front, back, created_at FROM item WHERE mine = 1
                      ORDER BY created_at DESC LIMIT 10`);
  const mineDue = queue(100, { itemIds: myItemIds() }).length;
  root.innerHTML = html`
    <h1>Add your own</h1>
    <p class="muted small">Type a Yoruba word or sentence you've come across (tone marks and underdots are optional; the letter row above the keyboard helps). You'll see what it means, then you can save it to your reviews.</p>
    <div class="card stack">
      <textarea id="yo" rows="2" placeholder="e.g. ọ̀rẹ́ / Inú mi dùn" autocapitalize="off" spellcheck="false"></textarea>
      <button id="go" class="wide">Translate</button>
      <div id="result"></div>
    </div>
    ${recent.length ? html`
      ${mineDue ? html`<a href="#/review?mine=1" class="button wide">Review my words (${mineDue}) →</a>` : ""}
      <h2>Recently added</h2>
      <ul class="list">${recent.map((r) => html`
        <li class="card"><strong>${r.kind === "word" ? r.front : mark(r.front)}</strong><br><span class="muted">${r.back}</span>
          <small class="muted">${r.kind} · ${fmtDay(r.created_at)}</small></li>`)}</ul>` : ""}`;

  const input = root.querySelector("#yo");
  const out = root.querySelector("#result");
  input.focus();
  const run = async () => {
    const typed = input.value.trim().replace(/\s+/g, " ");
    if (!typed) return input.focus();
    out.innerHTML = html`<p class="loading small">Translating</p>`;
    let t = { yo: typed, en: "", literal: "" };
    try { t = await translateFull(typed); } catch (e) { toast(e.message, 4000); }
    const text = t.yo, en = t.en, literal = t.literal;
    const isWord = isShort(text);
    // shown above the meaning: the spelling fix (if any) and the idiom's literal meaning (also saved on the card)
    const extra = html`${text !== typed ? html`<p class="small muted">Corrected from « ${typed} »</p>` : ""}
      ${literal ? html`<p class="small muted">Literally: ${literal}</p>` : ""}`;

    if (isWord) {
      const entries = lookup(text).slice(0, 3);
      const first = entries[0];
      out.innerHTML = html`
        <p class="big">${text} <button class="say" data-say="${text}">🔊</button></p>
        ${extra}
        <label class="small muted">Meaning to learn<input id="meaning" value="${en || (first ? first.gloss.split(/;\s*/).slice(0, 2).join("; ") : "")}"></label>
        ${entries.length ? html`<p class="small muted">Dictionary (tap one to use it):</p>
          <ul class="dict pick">${entries.map((d) => html`
          <li data-gloss="${d.gloss}"><span class="grow"><strong>${d.lemma}</strong> <small class="muted inline">${d.pos}${d.approx ? " · without marks" : ""}</small> — ${d.gloss}</span></li>`)}</ul>` : ""}
        <button class="wide" id="save">Save to review</button>`;
      out.querySelector(".dict.pick")?.addEventListener("click", (e) => {
        const li = e.target.closest("[data-gloss]");
        if (li) out.querySelector("#meaning").value = li.dataset.gloss;
      });
      out.querySelector("#save").onclick = (e) => {
        const meaning = out.querySelector("#meaning").value.trim();
        if (!meaning) return toast("Add a meaning first");
        const lemma = first?.lemma || lemmaCandidates(text)[0] || text.toLowerCase();
        const res = saveWord({
          word: text, sentence: first?.ex_yo || "", textId: null,
          mine: true,
          g: { lemma, pos: first?.pos || "", lemma_meaning: meaning, sentence_en: first?.ex_en || null,
               note: literal && `Literally: ${literal}` },
        });
        e.target.disabled = true;
        e.target.textContent = res.created ? "Saved ✓" : "Already saved ✓";
      };
    } else {
      out.innerHTML = html`
        <p class="context">${text} <button class="say" data-say="${text}">🔊</button></p>
        ${extra}
        <label class="small muted">Translation<textarea id="meaning" rows="2">${en}</textarea></label>
        <div id="notes"></div>
        <div class="row gap">
          <button class="grow" id="save">Save to review</button>
          ${hasKey() ? html`<button class="secondary" id="explain">✦ Explain grammar</button>` : ""}
        </div>
        ${hasKey() ? html`<button class="secondary wide" id="chat">💬 Ask a question</button>` : ""}`;
      out.querySelector("#chat")?.addEventListener("click", () => openAsk({
        label: text,
        context: `Yoruba sentence: "${text}"\nTranslation: ${out.querySelector("#meaning").value.trim() || en}${notes ? `\nThe app's grammar notes (the learner may find these confusing):\n- ${notes.join("\n- ")}` : ""}`,
      }));
      let notes = null;
      out.querySelector("#explain")?.addEventListener("click", (e) => busy(e.target, "…", async () => {
        const r = await explainSentence(text);
        notes = r.notes;
        if (!out.querySelector("#meaning").value.trim()) out.querySelector("#meaning").value = r.translation;
        out.querySelector("#notes").innerHTML = html`<p class="small muted">Claude: ${r.translation}</p><ul class="notes">${r.notes.map((n) => html`<li>${n}</li>`)}</ul>`;
        e.target.remove();
      }));
      out.querySelector("#save").onclick = (e) => {
        const translation = out.querySelector("#meaning").value.trim();
        if (!translation) return toast("Add a translation first");
        const res = saveSentence({ sentence: text, translation, notes: [literal && `Literally: ${literal}`, ...(notes || [])].filter(Boolean).join(" · "), textId: null, mine: true });
        e.target.disabled = true;
        e.target.textContent = res.created ? "Saved ✓" : "Already saved ✓";
      };
    }
  };
  root.querySelector("#go").onclick = (e) => busy(e.target, "Translating…", run);
  input.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      root.querySelector("#go").click();
    }
  };
}
