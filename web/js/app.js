// Boot + hash router.
import { openDb, saveNow } from "./db.js";
import { applyTheme, esc } from "./util.js";
import { startCharBar } from "./chars.js";
import { startScreenTime } from "./screentime.js";
import today from "./views/today.js";
import review from "./views/review.js";
import { readList, reader } from "./views/read.js";
import { write, feedback } from "./views/write.js";
import { stats, data, settingsView } from "./views/me.js";
import { talkChat, talkHome } from "./views/talk.js";
import { addView, basicsView, learnHub, lessonView, tipsView, unitView } from "./views/learn.js";
import { speak, stopSpeaking } from "./speech.js";

const ROUTES = [
  [/^\/$/, today, "today"],
  [/^\/review$/, review, "learn"],
  [/^\/learn$/, learnHub, "learn"],
  [/^\/learn\/basics$/, basicsView, "learn"],
  [/^\/learn\/basics\/([\w-]+)$/, unitView, "learn"],
  [/^\/learn\/add$/, addView, "learn"],
  [/^\/learn\/tips$/, tipsView, "learn"],
  [/^\/learn\/tips\/([\w-]+)$/, lessonView, "learn"],
  [/^\/read$/, readList, "read"],
  [/^\/read\/(\d+)$/, reader, "read"],
  [/^\/write$/, write, "write"],
  [/^\/write\/(\d+)$/, feedback, "write"],
  [/^\/talk$/, talkHome, "talk"],
  [/^\/talk\/(\d+)$/, talkChat, "talk"],
  [/^\/me$/, stats, "me"],
  [/^\/data$/, data, "me"],
  [/^\/settings$/, settingsView, "me"],
];

const root = document.getElementById("view");

async function route() {
  const [path, qs] = (location.hash.slice(1) || "/").split("?");
  const match = ROUTES.find(([re]) => re.test(path));
  if (!match) return (location.hash = "#/");
  const [re, view, tab] = match;
  document.querySelectorAll(".tabbar a").forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
  window.scrollTo(0, 0);
  stopSpeaking(); // don't keep reading a text after leaving it
  try {
    await view(root, { params: path.match(re).slice(1), query: new URLSearchParams(qs) });
  } catch (e) {
    console.error(e);
    root.innerHTML = `<h1>Something went wrong</h1><p class="error">${esc(e.message)}</p><a href="#/">Back to today</a>`;
  }
}

async function boot() {
  applyTheme();
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);
  await openDb();
  navigator.storage?.persist?.(); // ask the browser not to evict our data
  window.addEventListener("hashchange", route);
  // 🔊 buttons anywhere: pronounce with the phone's Yoruba voice (the buttons only show if there is one).
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-say]");
    if (!b) return;
    e.stopPropagation();
    speak(b.dataset.say);
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-href]");
    if (b) location.hash = b.dataset.href;
  });
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && saveNow());
  startScreenTime();
  startCharBar(); // row of ẹ ọ ṣ and tone marks above the keyboard
  await route();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
}

boot().catch((e) => {
  console.error(e);
  root.innerHTML = `<h1>Couldn't start</h1><p class="error">${esc(e.message)}</p>`;
});
