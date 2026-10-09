// Pronunciation through the phone's built-in text-to-speech, but only if it has a Yoruba (yo) voice.
// Everything audio-related stays hidden otherwise (CSS hides .say unless <html data-voice>).

let voice;
function yorubaVoice() {
  if (voice !== undefined) return voice;
  if (typeof speechSynthesis === "undefined") return (voice = null);
  const vs = speechSynthesis.getVoices().filter((v) => /^yo([-_]|$)/i.test(v.lang || ""));
  voice = vs.find((v) => /yo[-_]NG/i.test(v.lang)) || vs[0] || null;
  return voice;
}

/** True once the phone reports a Yoruba voice. Also flags <html data-voice> so 🔊 buttons appear. */
export function canSpeak() {
  const ok = !!yorubaVoice();
  if (typeof document !== "undefined") document.documentElement.toggleAttribute("data-voice", ok);
  return ok;
}

export function speak(text, rate = 0.85) {
  const v = yorubaVoice();
  if (!v) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = v;
  u.lang = v.lang;
  u.rate = rate;
  speechSynthesis.speak(u);
}

/** Read several texts one after another; onStart(i) fires as each begins, onDone when finished or stopped. */
let seq = 0;
export function speakSequence(texts, { onStart = () => {}, onDone = () => {}, rate = 0.85 } = {}) {
  const v = yorubaVoice();
  if (!v) return onDone();
  speechSynthesis.cancel();
  const run = ++seq;
  const next = (i) => {
    if (run !== seq) return;
    if (i >= texts.length) return onDone();
    const u = new SpeechSynthesisUtterance(texts[i]);
    u.voice = v;
    u.lang = v.lang;
    u.rate = rate;
    u.onstart = () => run === seq && onStart(i);
    u.onend = () => next(i + 1);
    u.onerror = () => run === seq && onDone();
    speechSynthesis.speak(u);
  };
  next(0);
}

export function stopSpeaking() {
  seq++;
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}

if (typeof speechSynthesis !== "undefined") {
  speechSynthesis.onvoiceschanged = () => {
    voice = undefined;
    canSpeak();
  };
  canSpeak();
}
