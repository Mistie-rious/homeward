// A row of Yoruba letters (ẹ ọ ṣ and tone-marked vowels) pinned just above the on-screen keyboard.
// It shows while a text field is focused and inserts at the cursor, so the same row works in every input.
// Positioned with visualViewport: on iPhone the keyboard doesn't resize the page, only the visual viewport.

export const CHARS = ["ẹ", "ọ", "ṣ", "à", "á", "è", "é", "ẹ̀", "ẹ́", "ì", "í", "ò", "ó", "ọ̀", "ọ́", "ù", "ú", "ǹ", "ń"].map((c) => c.normalize("NFC"));

/** Fields that take free text (not passwords, numbers, emails or fields that opt out with data-nochars). */
export function wantsChars(el) {
  if (!el || el.disabled || el.readOnly || el.dataset?.nochars != null) return false;
  if (el.tagName === "TEXTAREA") return true;
  return el.tagName === "INPUT" && ["text", "search"].includes(el.type);
}

/** Put `ch` at the cursor of `el` (replacing the selection) and tell the page the value changed. */
export function insertAtCursor(el, ch) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  el.setRangeText(ch, start, end, "end");
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export function startCharBar() {
  const bar = document.createElement("div");
  bar.className = "charbar";
  bar.hidden = true;
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "Yoruba letters and tone marks");
  document.body.append(bar);

  let target = null;
  let upper = false;
  const label = (c) => (upper ? c.toLocaleUpperCase() : c);
  const paint = () => {
    bar.innerHTML = `<button type="button" class="shift${upper ? " on" : ""}" data-shift aria-label="Capital letters">⇧</button>${CHARS.map(
      (c) => `<button type="button" data-c="${c}">${label(c)}</button>`,
    ).join("")}`;
  };
  paint();

  const place = () => {
    const vv = window.visualViewport;
    // distance between the bottom of the layout viewport and the bottom of what the user can see (the keyboard's height)
    const lift = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    bar.style.bottom = `${Math.round(lift)}px`;
  };
  const show = (el) => {
    target = el;
    bar.hidden = false;
    document.documentElement.classList.add("charbar-on");
    place();
  };
  const hide = () => {
    target = null;
    bar.hidden = true;
    document.documentElement.classList.remove("charbar-on");
  };

  document.addEventListener("focusin", (e) => (wantsChars(e.target) ? show(e.target) : bar.contains(e.target) || hide()));
  document.addEventListener("focusout", () => {
    // wait a beat: focus may be moving to another field
    setTimeout(() => !wantsChars(document.activeElement) && hide(), 120);
  });
  window.visualViewport?.addEventListener("resize", place);
  window.visualViewport?.addEventListener("scroll", place);
  window.addEventListener("scroll", place, { passive: true });

  // keep the keyboard (and the field's cursor) where they are when a letter is tapped
  bar.addEventListener("mousedown", (e) => e.preventDefault());
  bar.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || !target || !target.isConnected) return;
    if (b.dataset.shift != null) {
      upper = !upper;
      paint();
      return;
    }
    target.focus();
    insertAtCursor(target, label(b.dataset.c));
    if (upper) {
      upper = false; // one capital at a time, like a phone keyboard
      paint();
    }
  });
}
