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
  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.findIndex((s) => !s.done);
  const allDone = doneCount === steps.length;
  const leaf = '<svg class="leaf" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 14C2 7 6 2 14 2c0 8-4 12-10 12" fill="currentColor"/><path d="M2 14L9 7" stroke="rgba(0,0,0,.35)" stroke-width="1.2" stroke-linecap="round" fill="none"/></svg>';
  const houseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10.5V20h12v-9.5" fill="currentColor"/></svg>';

  root.innerHTML = html`
    <header class="welcome">
      <div class="welcome-top">
        <span class="wordmark">Homeward</span>
        <span class="streak">${raw(leaf)} ${n} day${n === 1 ? "" : "s"}</span>
      </div>
      <h1 class="yo">${greeting}!</h1>
      <p class="date yo">${date}</p>
      <div class="potd" id="potd">
        ${pictureFor(potd.item.yo) ? html`<div class="pic-tile">${raw(pictureFor(potd.item.yo, 64))}</div>` : ""}
        <div class="grow">
          <p class="kind">Òní · phrase of the day</p>
          <p class="phrase yo">${potd.item.yo} <button class="say" data-say="${potd.item.yo}" aria-label="Pronounce">🔊</button></p>
          ${raw(pronHtml(potd.item.yo, { ipa: false }))}
          <p class="en">${potd.item.en}</p>
          <button class="small-btn" id="potd-add" ${inReviews ? "disabled" : ""}>${inReviews ? "In your reviews ✓" : "Add to my reviews"}</button>
        </div>
      </div>
    </header>
    ${backupDue() ? html`<a href="#/data" class="card warn">💾 Time for a backup. Your data only lives on this phone →</a>` : ""}
    <h2 class="path-title">Today's path</h2>
    <ol class="trail">
      ${steps.map((s, i) => html`
        <li class="stop ${s.done ? "done" : i === next ? "next" : ""}">
          <a href="${s.href}">
            <span class="node">${s.done ? "✓" : i + 1}</span>
            <span class="grow"><strong>${s.title}</strong><small>${s.detail}</small></span>
            <span class="chev">›</span>
          </a>
        </li>`)}
      <li class="stop home ${allDone ? "reached" : ""}">
        <div class="stop-row">
          <span class="node">${raw(houseIcon)}</span>
          <span class="grow"><strong>${allDone ? "Ó dára! You made it home." : "Home"}</strong><small>${allDone ? "That's everything for today." : `${doneCount} of ${steps.length} stops done`}</small></span>
        </div>
      </li>
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
