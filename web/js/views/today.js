import { get, scalar } from "../db.js";
import { hasKey } from "../claude.js";
import { todaysPrompt } from "../content.js";
import { backupDue, reviewedToday, streak, todaysMistakeIds } from "../progress.js";
import { queue, settings } from "../srs.js";
import { WEEKDAYS, UNITS } from "../course.js";
import { addCourseItem, addedRefs, addedToday, phraseOfDay, progress, refOf } from "../basics.js";
import { pictureFor } from "../pictures.js";
import { pronHtml } from "../pronounce.js";
import { nextUnreadEpisode } from "../story.js";
import { dayStart, html, raw, toast } from "../util.js";

export default function today(root) {
  const start = dayStart();
  const cap = settings().reviewCap;
  const reviewed = reviewedToday();
  const dueNow = queue(cap).length;
  const ep = nextUnreadEpisode();
  const unread = ep ? { id: ep.id, title: `📖 Episode ${ep.episode} · ${ep.title}` } : get("SELECT id, title FROM text WHERE read_at IS NULL ORDER BY created_at DESC LIMIT 1");
  const readToday = scalar("SELECT COUNT(*) FROM text WHERE read_at >= ?", [start]);
  const wrote = get("SELECT id FROM submission WHERE modality = 'write' AND created_at >= ? ORDER BY created_at DESC LIMIT 1", [start]);
  const mistakeIds = todaysMistakeIds();
  const drillLeft = mistakeIds.length ? queue(100, { itemIds: mistakeIds }).length : 0;

  const prog = progress();
  const nextUnit = UNITS.find((u, i) => prog[i].added < prog[i].total);
  const steps = [
    {
      title: "Warm-up review", href: "#/review",
      done: dueNow === 0 || reviewed >= cap,
      detail: dueNow ? `${dueNow} due` : `${reviewed} reviewed`,
    },
    {
      title: "Read", href: unread && !readToday ? `#/read/${unread.id}` : "#/read",
      done: readToday > 0,
      detail: readToday ? "done" : unread ? unread.title : "pick or generate a text",
    },
    {
      title: "Learn something new", href: nextUnit ? `#/learn/basics/${nextUnit.id}` : "#/learn/basics",
      done: addedToday(start) > 0,
      detail: nextUnit ? `Basics · ${nextUnit.title}` : "Basics · all units added",
    },
    {
      title: "Write", href: wrote ? `#/write/${wrote.id}` : "#/write",
      done: !!wrote,
      detail: todaysPrompt().text,
    },
    {
      title: "Drill today's mistakes", href: "#/review?drill=1",
      done: !!wrote && drillLeft === 0,
      detail: drillLeft ? `${drillLeft} to drill` : wrote ? "done" : "after writing",
    },
  ];
  const n = streak();
  const hour = new Date().getHours();
  // Yoruba greetings by time of day (see the Greetings lesson)
  const greeting = hour < 12 ? "Ẹ káàárọ̀" : hour < 16 ? "Ẹ káàsán" : "Ẹ kúùrọ̀lẹ́";
  const date = `Òní: ${WEEKDAYS[new Date().getDay()]} · ${new Date().toLocaleDateString(undefined, { day: "numeric", month: "long" })}`;
  const potd = phraseOfDay();
  const inReviews = addedRefs(potd.unit.id).has(refOf(potd.unit.id, "p", potd.index));
  const colors = ["c-purple", "c-coral", "c-sky", "c-mustard", "c-sage"];
  const doneCount = steps.filter((s) => s.done).length;

  root.innerHTML = html`
    <header class="hero">
      <p class="wordmark">Homeward</p>
      <h1 class="yo">${greeting}!</h1>
      <p class="date yo">${date}</p>
      <div class="sticker"><div><b>${n}</b><small>day${n === 1 ? "" : "s"} <svg class="leaf" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 14C2 7 6 2 14 2c0 8-4 12-10 12" fill="currentColor"/><path d="M2 14L9 7" stroke="var(--sticker-vein, #16241d)" stroke-width="1.2" stroke-linecap="round" fill="none"/></svg></small></div></div>
    </header>
    <div class="card potd" id="potd">
      ${pictureFor(potd.item.yo) ? html`<div class="pic-tile">${raw(pictureFor(potd.item.yo, 64))}</div>` : ""}
      <div class="grow">
        <p class="kind">Òní · phrase of the day</p>
        <p class="phrase yo">${potd.item.yo} <button class="say" data-say="${potd.item.yo}" aria-label="Pronounce">🔊</button></p>
        ${raw(pronHtml(potd.item.yo, { ipa: false }))}
        <p class="en">${potd.item.en}</p>
        <button class="small-btn secondary" id="potd-add" ${inReviews ? "disabled" : ""}>${inReviews ? "In your reviews ✓" : "Add to my reviews"}</button>
      </div>
    </div>
    <div class="progress" aria-label="${doneCount} of ${steps.length} done">${steps.map((s) => html`<span class="${s.done ? "on" : ""}"></span>`)}</div>
    ${doneCount === steps.length ? html`<div class="card done-banner">Ó dára! That's everything for today. ✨</div>` : ""}
    ${backupDue() ? html`<a href="#/data" class="card warn">💾 Time for a backup. Your data only lives on this phone →</a>` : ""}
    <ol class="steps">
      ${steps.map((s, i) => html`
        <li class="${s.done ? "done" : ""}">
          <a href="${s.href}" class="card step ${colors[i]}">
            <span class="num">0${i + 1}</span>
            <span class="grow"><strong>${s.title}</strong><small>${s.detail}</small></span>
            ${s.done ? html`<span class="stamp">done ✓</span>` : ""}
            <span class="chev">→</span>
          </a>
        </li>`)}
    </ol>
    ${hasKey() ? "" : html`<p class="muted small">No Claude key yet: reading uses the built-in dialogues, word lookups use the offline dictionary, and writing corrections, chat and conversations are unavailable. <a href="#/settings">Add a key →</a></p>`}
  `;

  root.querySelector("#potd-add")?.addEventListener("click", (e) => {
    addCourseItem(potd.unit.id, "p", potd.index);
    e.target.disabled = true;
    e.target.textContent = "In your reviews ✓";
    toast("Ó dára! Added to your reviews");
  });
}
