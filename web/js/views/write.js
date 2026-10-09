import { all, get } from "../db.js";
import { hasKey } from "../claude.js";
import { NO_KEY_MESSAGE, correct } from "../correction.js";
import { STARTERS, newPrompt, todaysPrompt, wordTarget } from "../content.js";
import { translateLong } from "../translate.js";
import { openAsk } from "./ask.js";
import { LS_PREFIX, busy, fmtDay, go, html } from "../util.js";

const DRAFT = `${LS_PREFIX}draft`;

export function write(root) {
  const p = todaysPrompt();
  const past = all(`SELECT s.id, s.raw_text, s.created_at, COUNT(e.id) AS n FROM submission s
                    LEFT JOIN error e ON e.submission_id = s.id WHERE s.modality = 'write' GROUP BY s.id ORDER BY s.created_at DESC LIMIT 30`);
  root.innerHTML = html`
    <h1>Write</h1>
    <div class="card prompt">
      <span class="pill">${p.level}</span>
      <p class="yo">${p.text}</p>
      <div class="row gap wrap">
        <span class="grow"></span>
        <button class="secondary small-btn" data-change="easier" ${p.level === "A1" ? "disabled" : ""}>Easier</button>
        <button class="secondary small-btn" data-change="harder" ${p.level === "C1" ? "disabled" : ""}>Harder</button>
        <button class="secondary small-btn" data-change="new">New</button>
      </div>
    </div>
    <p class="small muted">Stuck? Tap a starter:</p>
    <div class="chips" id="starters">${STARTERS[p.level].map((st) => html`<button class="chip" data-starter="${st}">${st}</button>`)}</div>
    ${hasKey() ? "" : html`<div class="card warn">${NO_KEY_MESSAGE} <a href="#/settings">Add a key →</a></div>`}
    <textarea id="text" class="yo" rows="8" placeholder="Write about ${wordTarget(p.level)} words in Yoruba…" autocapitalize="sentences" spellcheck="false"></textarea>
    <div class="row between">
      <small class="muted" id="count">0 words</small>
      <button id="go" ${hasKey() ? "" : "disabled"}>Correct it</button>
    </div>
    ${past.length ? html`
      <details class="past">
        <summary>Past writing (${past.length})</summary>
        <ul class="list">${past.map((s) => html`
          <li><a href="#/write/${s.id}" class="card row between gap">
            <span class="grow ellipsis">${s.raw_text.slice(0, 80)}</span>
            <small class="muted">${fmtDay(s.created_at)}</small>
            <span class="pill">${s.n} err</span>
          </a></li>`)}</ul>
      </details>` : ""}`;

  const t = root.querySelector("#text");
  const count = root.querySelector("#count");
  try { t.value = localStorage.getItem(DRAFT) || ""; } catch {}
  const upd = () => (count.textContent = `${(t.value.match(/\S+/g) || []).length} / ~${wordTarget(p.level)} words`);
  const save = () => { try { localStorage.setItem(DRAFT, t.value); } catch {} };
  t.oninput = () => { upd(); save(); };
  upd();
  root.querySelector("#starters").onclick = (e) => {
    const st = e.target.dataset.starter;
    if (!st) return;
    const insert = st.replace(/…$/, "") + (st.endsWith("…") ? " " : "");
    t.value = `${t.value}${t.value && !/\s$/.test(t.value) ? " " : ""}${insert}`;
    t.focus();
    upd(); save();
  };
  root.querySelectorAll("[data-change]").forEach((b) => {
    b.onclick = () => busy(b, "…", async () => {
      await newPrompt(b.dataset.change, { useClaude: hasKey() });
      go("#/write");
    });
  });
  root.querySelector("#go").onclick = (e) => {
    const text = t.value.trim();
    if (!text) return;
    busy(e.target, "Correcting… (~15s)", async () => {
      const id = await correct(text, p.text, { level: p.level });
      try { localStorage.removeItem(DRAFT); } catch {}
      go(`#/write/${id}`);
    });
  };
}

const GRADER = { claude: "Claude", claude_only: "Claude" };

export function feedback(root, { params: [id] }) {
  const sub = get("SELECT * FROM submission WHERE id = ?", [Number(id)]);
  if (!sub) return go("#/write");
  const errors = all("SELECT * FROM error WHERE submission_id = ? ORDER BY start", [sub.id]);

  // Split the original into plain / error segments for highlighting.
  const segs = [];
  let pos = 0;
  errors.forEach((e, i) => {
    if (e.start < pos) return; // overlapping; still listed below
    segs.push(sub.raw_text.slice(pos, e.start));
    segs.push(html`<a href="#e${i + 1}" class="err" data-jump="${i + 1}">${sub.raw_text.slice(e.start, e.end)}<sup>${i + 1}</sup></a>`);
    pos = e.end;
  });
  segs.push(sub.raw_text.slice(pos));

  root.innerHTML = html`
    <h1>Correction</h1>
    ${sub.prompt ? html`<p class="muted small">${sub.prompt}</p>` : ""}
    <div class="card reading yo">${segs}</div>
    ${sub.summary ? html`<div class="card note">${sub.summary}</div>` : ""}
    <h2>${errors.length} correction${errors.length === 1 ? "" : "s"}</h2>
    <ol class="errors">${errors.map((e, i) => html`
      <li id="e${i + 1}" class="card">
        <span class="pill">${i + 1} · ${e.category.replace("_", " ")}</span>
        <p class="yo"><s>${e.original}</s> → <strong class="good">${e.suggestion}</strong></p>
        ${e.explanation ? html`<p class="small">${e.explanation}</p>` : ""}
      </li>`)}</ol>
    ${sub.corrected_text ? html`
      <details class="card" open>
        <summary>Corrected text</summary>
        <p class="reading yo">${sub.corrected_text}</p>
        <div class="row gap"><button class="secondary small-btn" id="fb-en">🇬🇧 Show in English</button><button class="secondary small-btn" data-say="${sub.corrected_text}">🔊</button></div>
        <p class="small muted" id="fb-en-text" hidden></p>
      </details>` : ""}
    ${hasKey() ? html`<button class="secondary wide" id="ask-fb">💬 Ask a question (double-check this)</button>` : ""}
    ${errors.length ? html`<a href="#/review?drill=1" class="button wide">Drill these mistakes →</a>` : html`<a href="#/" class="button wide">Back to today</a>`}
    <p class="muted small center">Checked with ${GRADER[sub.grader] || sub.grader}. Claude can be wrong about Yoruba, so double-check anything surprising with “Ask a question”.</p>`;

  root.querySelector("#ask-fb")?.addEventListener("click", () => openAsk({
    label: "Your writing and its corrections",
    context: `The learner's Yoruba text:\n${sub.raw_text}\n\nCorrected version (by the app, may contain mistakes):\n${sub.corrected_text || ""}\n\nCorrections:\n${errors.map((e) => `- ${e.original} → ${e.suggestion} (${e.category}): ${e.explanation || ""}`).join("\n")}`,
    starters: ["Is the corrected text right?", "Explain the corrections more simply", "Are the tone marks right?"],
  }));
  root.querySelector("#fb-en")?.addEventListener("click", (e) => busy(e.target, "…", async () => {
    const el = root.querySelector("#fb-en-text");
    el.textContent = await translateLong(sub.corrected_text);
    el.hidden = false;
    e.target.hidden = true;
  }));
  // In-page anchors would fight the hash router; scroll manually.
  root.querySelectorAll("[data-jump]").forEach((a) => {
    a.onclick = (ev) => {
      ev.preventDefault();
      root.querySelector(`#e${a.dataset.jump}`).scrollIntoView({ behavior: "smooth", block: "center" });
    };
  });
}
