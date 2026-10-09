import { get } from "../db.js";
import { hasKey } from "../claude.js";
import { backupDue, streak, todaysMistakeIds } from "../progress.js";
import { queue, settings } from "../srs.js";
import { WEEKDAYS, UNITS } from "../course.js";
import { addCourseItem, addedRefs, phraseOfDay, progress, refOf } from "../basics.js";
import { pictureFor } from "../pictures.js";
import { pronHtml } from "../pronounce.js";
import { nextUnreadEpisode } from "../story.js";
import { html, raw, toast } from "../util.js";

const ico = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  review: ico('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
  learn: ico('<path d="M12 21v-9"/><path d="M12 12c0-4 3-7 8-7 0 4-3 7-8 7z"/><path d="M12 15c0-3-2-5-6-5 0 3 2 5 6 5z"/>'),
  read: ico('<path d="M2 5c3-1.5 6-1.5 10 1 4-2.5 7-2.5 10-1v14c-3-1.5-6-1.5-10 1-4-2.5-7-2.5-10-1z"/><path d="M12 6v14"/>'),
  write: ico('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
  drill: ico('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>'),
};
const LEAF = '<svg class="leaf" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 14C2 7 6 2 14 2c0 8-4 12-10 12" fill="currentColor"/><path d="M2 14L9 7" stroke="rgba(0,0,0,.35)" stroke-width="1.2" stroke-linecap="round" fill="none"/></svg>';

export default function today(root) {
  const dueNow = queue(settings().reviewCap).length;
  const ep = nextUnreadEpisode();
  const unread = ep ? { id: ep.id, title: `Episode ${ep.episode} · ${ep.title}` } : get("SELECT id, title FROM text WHERE read_at IS NULL ORDER BY created_at DESC LIMIT 1");
  const drillLeft = todaysMistakeIds().length ? queue(100, { itemIds: todaysMistakeIds() }).length : 0;
  const prog = progress();
  const nextUnit = UNITS.find((u, i) => prog[i].added < prog[i].total);

  // One suggestion, picked for you: cards that are due first, then something new to learn, then reading.
  const go = dueNow
    ? { href: "#/review", title: "Review", detail: `${dueNow} card${dueNow === 1 ? "" : "s"} ready`, icon: ICON.review }
    : nextUnit
    ? { href: `#/learn/basics/${nextUnit.id}`, title: "Learn something new", detail: nextUnit.title, icon: ICON.learn }
    : unread
    ? { href: `#/read/${unread.id}`, title: "Read", detail: unread.title, icon: ICON.read }
    : { href: "#/read", title: "Read", detail: "Pick a dialogue or a text", icon: ICON.read };

  const tiles = [
    { href: "#/review", title: "Review", detail: dueNow ? `${dueNow} due` : "all caught up", icon: ICON.review, c: "coral" },
    { href: "#/learn/basics", title: "Basics", detail: nextUnit ? nextUnit.title : "all added", icon: ICON.learn, c: "sage" },
    { href: unread ? `#/read/${unread.id}` : "#/read", title: "Read", detail: unread ? unread.title : "dialogues and texts", icon: ICON.read, c: "sky" },
    { href: "#/write", title: "Write", detail: "get it corrected", icon: ICON.write, c: "mustard" },
    ...(drillLeft ? [{ href: "#/review?drill=1", title: "Drill", detail: `${drillLeft} mistake${drillLeft === 1 ? "" : "s"} from today`, icon: ICON.drill, c: "coral" }] : []),
  ];

  const n = streak();
  const hour = new Date().getHours();
  // Yoruba greetings by time of day (see the Greetings lesson)
  const greeting = hour < 12 ? "Ẹ káàárọ̀" : hour < 16 ? "Ẹ káàsán" : "Ẹ kúùrọ̀lẹ́";
  const date = `Òní: ${WEEKDAYS[new Date().getDay()]} · ${new Date().toLocaleDateString(undefined, { day: "numeric", month: "long" })}`;
  const potd = phraseOfDay();
  const inReviews = addedRefs(potd.unit.id).has(refOf(potd.unit.id, "p", potd.index));

  root.innerHTML = html`
    <header class="welcome">
      <div class="welcome-top">
        <span class="wordmark">Homeward</span>
        <span class="streak">${raw(LEAF)} ${n} day${n === 1 ? "" : "s"}</span>
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
    <a href="${go.href}" class="continue">
      <span class="continue-icon">${raw(go.icon)}</span>
      <span class="grow"><small>Next up</small><strong>${go.title}</strong><span class="continue-detail">${go.detail}</span></span>
      <span class="chev">›</span>
    </a>
    <div class="tiles-grid">
      ${tiles.map((t, i) => html`
        <a href="${t.href}" class="tile-link t-${t.c} v${i % 4}">
          <span class="tile-icon">${raw(t.icon)}</span>
          <strong>${t.title}</strong>
          <small>${t.detail}</small>
        </a>`)}
    </div>
    ${hasKey() ? "" : html`<p class="muted small">No Claude key yet: reading uses the built-in dialogues, word lookups use the offline dictionary, and writing corrections, chat and conversations are unavailable. <a href="#/settings">Add a key →</a></p>`}
  `;

  root.querySelector("#potd-add")?.addEventListener("click", (e) => {
    addCourseItem(potd.unit.id, "p", potd.index);
    e.target.disabled = true;
    e.target.textContent = "In your reviews ✓";
    toast("Ó dára! Added to your reviews");
  });
}
