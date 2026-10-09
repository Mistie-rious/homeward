// "Ask Claude": a follow-up chat sheet that already knows what you're looking at (a card, a sentence, a lesson,
// an explanation). Not saved; closing it discards the conversation.
import { converse } from "../claude.js";
import { level, LEVEL_GUIDE, YORUBA_RULES, saveSentence, saveWord } from "../content.js";
import { nfc } from "../nlp.js";
import { esc, html, raw, toast } from "../util.js";

const STARTERS = ["Explain it more simply", "Why is it said this way?", "Give me more examples", "Add this to my reviews"];

/** Chat text → safe HTML: paragraphs, line breaks and **bold** only. */
export const fmt = (text) =>
  raw(esc(text).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")}</p>`).join(""));

const system = (context) => `You are a patient Yoruba tutor chatting with an adult English-speaking learner at level ${level()} (${LEVEL_GUIDE[level()]}).
The learner is looking at this in their study app and has a question about it:
---
${context}
---
- Answer in English, in plain, friendly language. Assume they found the explanation above confusing, so use a different angle: a simple rule of thumb, a comparison with English, or a quick example.
- Put Yoruba in **bold** with its English meaning, always with full tone marks and underdots. Keep answers short (under ~120 words) unless asked for more.
- This chat is also how the learner double-checks the app's course content, which was written without a native speaker's review. If they ask whether something is right, check it honestly. If something in the material looks wrong, say so plainly and give the better form. If you are not sure about a word, a tone or a construction, say you are not sure and suggest asking a native speaker; never bluff.
- If the question is about something else in Yoruba, answer that instead. Stay on Yoruba learning.
- When the learner asks you to add, save or drill something, use the tools: they put it in the learner's review cards ("My words"). Choose accurate dictionary forms and short, natural meanings and examples at their level. Never save anything they didn't ask for. After saving, confirm in one short line.
${YORUBA_RULES}`;

const TOOLS = [
  {
    name: "save_word",
    description: "Add a Yoruba word or expression to the learner's review cards.",
    input_schema: {
      type: "object",
      properties: {
        lemma: { type: "string", description: "Dictionary form with tone marks and underdots, e.g. ọmọ, ṣiṣẹ́" },
        meaning: { type: "string", description: "Short English meaning" },
        pos: { type: "string", enum: ["noun", "verb", "adjective", "adverb", "pronoun", "particle", "phrase", "other"] },
        example_yo: { type: "string", description: "A short natural example sentence containing the word, with full tone marks" },
        example_en: { type: "string", description: "English translation of the example" },
      },
      required: ["lemma", "meaning", "pos", "example_yo", "example_en"],
    },
  },
  {
    name: "save_sentence",
    description: "Add a whole Yoruba sentence (Yoruba -> English) to the learner's review cards.",
    input_schema: {
      type: "object",
      properties: {
        yoruba: { type: "string" },
        english: { type: "string" },
        note: { type: "string", description: "Optional one-line grammar note, or empty" },
      },
      required: ["yoruba", "english", "note"],
    },
  },
];

/** Run one tool call. Returns {result: string for Claude, saved: label for the learner or null}. */
function runTool({ name, input: i }) {
  try {
    if (name === "save_word") {
      const lemma = nfc(i.lemma);
      const example = nfc(i.example_yo || "");
      const word = example.split(/[\s,.;:!?«»"]+/).find((w) => w.toLowerCase() === lemma.toLowerCase()) || lemma;
      const r = saveWord({ word, sentence: example || lemma, textId: null, mine: true,
        g: { lemma, pos: i.pos, lemma_meaning: i.meaning, sentence_en: i.example_en || null } });
      return { result: r.created ? "Saved to the learner's review cards." : "Already in the learner's cards (now also in My words).", saved: `${i.lemma} · ${i.meaning}`, created: r.created };
    }
    if (name === "save_sentence") {
      const r = saveSentence({ sentence: i.yoruba, translation: i.english, notes: i.note, textId: null, mine: true });
      return { result: r.created ? "Saved to the learner's review cards." : "Already in the learner's cards (now also in My words).", saved: `${i.yoruba} · ${i.english}`, created: r.created };
    }
  } catch (err) {
    console.error(err);
    return { result: `Failed: ${err.message}`, saved: null };
  }
  return { result: "Unknown tool", saved: null };
}

/** Drop old turns for cost, but never start mid tool exchange (a tool_result needs its tool_use). */
function recent(history, n = 12) {
  let h = history.slice(-n);
  while (h.length && !(h[0].role === "user" && typeof h[0].content === "string")) h = h.slice(1);
  return h;
}

/**
 * Open the chat sheet.
 * @param {string} context  plain-text description of what the learner is looking at (sent to Claude, not shown in full)
 * @param {string} label    short line shown at the top, e.g. the sentence being discussed
 */
export function openAsk({ context, label, starters = STARTERS }) {
  document.querySelector(".ask-backdrop")?.remove();
  const wrap = document.createElement("div");
  wrap.className = "ask-backdrop";
  wrap.innerHTML = html`
    <section class="ask" role="dialog" aria-label="Ask a question">
      <header class="row between">
        <strong>✦ Ask a question</strong>
        <button class="link" id="ask-close" aria-label="Close">✕</button>
      </header>
      <p class="ask-ctx small muted">${label}</p>
      <div class="chat" id="ask-chat"></div>
      <div class="chips" id="ask-chips">${starters.map((s) => html`<button class="chip" type="button">${s}</button>`)}</div>
      <div class="row gap compose-row">
        <textarea id="ask-input" rows="1" placeholder="Ask anything about this…" autocapitalize="sentences" spellcheck="false"></textarea>
        <button id="ask-send" aria-label="Send">➤</button>
      </div>
    </section>`.toString();
  document.body.append(wrap);

  const chat = wrap.querySelector("#ask-chat");
  const input = wrap.querySelector("#ask-input");
  const sendBtn = wrap.querySelector("#ask-send");
  const history = []; // [{role, content}]
  let working = false;

  const close = () => {
    wrap.remove();
    window.removeEventListener("hashchange", close);
  };
  window.addEventListener("hashchange", close);
  wrap.querySelector("#ask-close").onclick = close;
  wrap.onclick = (e) => e.target === wrap && close();

  const bubble = (role, inner) => {
    const b = document.createElement("div");
    b.className = `bubble ${role === "user" ? "me" : "ai"}`;
    b.innerHTML = inner.toString();
    chat.append(b);
    b.scrollIntoView({ block: "end", behavior: "smooth" });
    return b;
  };

  const ask = async (text) => {
    text = text.trim();
    if (!text || working) return;
    working = true;
    sendBtn.disabled = true;
    wrap.querySelector("#ask-chips")?.remove();
    input.value = "";
    bubble("user", html`<p>${text}</p>`);
    history.push({ role: "user", content: text });
    const typing = bubble("ai", html`<p class="typing-dots"><span></span><span></span><span></span></p>`);
    const mark = history.length - 1; // roll back to here if anything fails
    try {
      let bubbleEl = typing;
      for (let step = 0; step < 4; step++) {
        const { text: answer, content, toolUses } = await converse({ system: system(context), messages: recent(history), tools: TOOLS, purpose: "ask" });
        history.push({ role: "assistant", content });
        if (answer) bubbleEl.innerHTML = fmt(answer).toString();
        else bubbleEl.remove();
        if (!toolUses.length) break;
        const results = toolUses.map((tu) => {
          const r = runTool(tu);
          if (r.saved) {
            const chip = document.createElement("div");
            chip.className = "saved-chip";
            chip.textContent = `${r.created ? "✓ Added to your reviews" : "✓ Already in your reviews"}: ${r.saved}`;
            chat.append(chip);
          }
          return { type: "tool_result", tool_use_id: tu.id, content: r.result };
        });
        history.push({ role: "user", content: results });
        bubbleEl = bubble("ai", html`<p class="typing-dots"><span></span><span></span><span></span></p>`);
        bubbleEl.scrollIntoView({ block: "end", behavior: "smooth" });
      }
      if (!bubbleEl.innerHTML.trim() || bubbleEl.querySelector(".typing-dots")) bubbleEl.remove();
    } catch (err) {
      history.length = mark;
      chat.querySelector(".typing-dots")?.closest(".bubble")?.remove();
      toast(err.message, 5000);
    }
    working = false;
    sendBtn.disabled = false;
    input.focus();
  };

  sendBtn.onclick = () => ask(input.value);
  input.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask(input.value);
    }
  };
  wrap.querySelector("#ask-chips").onclick = (e) => {
    const b = e.target.closest(".chip");
    if (b) ask(b.textContent);
  };
  input.focus();
}
