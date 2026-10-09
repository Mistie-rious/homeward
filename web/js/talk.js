// Talk: role-play conversations with Claude in Yoruba, with gentle corrections that feed reviews.
import { structured } from "./claude.js";
import { get, run, tx } from "./db.js";
import { addCard } from "./srs.js";
import { LEVEL_GUIDE, YORUBA_RULES } from "./content.js";
import { nfc } from "./nlp.js";
import { CATEGORIES, NATURAL_RULES, locate } from "./correction.js";

// register: "ẹ" = respectful (elders, strangers, shopkeepers), "o" = informal (friends, younger people)
export const SCENARIOS = [
  { id: "market", emoji: "🧺", title: "At the market", role: "a friendly market trader selling rice, fish and vegetables", setting: "a busy morning market in a Nigerian town", goal: "Greet the trader, ask the price of two things, buy them and say thank you.", register: "ẹ" },
  { id: "elders", emoji: "🙏", title: "Greeting elders", role: "a kind older man (Bàbá Kẹ́mi), a neighbour of your family", setting: "outside your family's house in the morning", goal: "Greet him respectfully, ask about his health and his family, and say goodbye politely.", register: "ẹ" },
  { id: "family", emoji: "👨‍👩‍👧", title: "Your family", role: "a new friend (Tọ́lá) who is curious about your family", setting: "a relaxed chat at a friend's house", goal: "Say who is in your family, how many brothers and sisters you have, and ask about theirs.", register: "o" },
  { id: "taxi", emoji: "🚕", title: "In a taxi", role: "a taxi driver", setting: "a taxi on its way to the market", goal: "Say where you want to go, ask the price, and tell the driver where to stop.", register: "ẹ" },
  { id: "directions", emoji: "🧭", title: "Asking the way", role: "a passer-by who knows the neighbourhood", setting: "a street corner in Ibadan", goal: "Ask how to get to the hospital (or the market) and check you understood the directions.", register: "ẹ" },
  { id: "food", emoji: "🍲", title: "Eating out", role: "a woman who runs a small food stall", setting: "a small local restaurant at lunchtime", goal: "Say what you want to eat and drink, ask the price and pay.", register: "ẹ" },
  { id: "doctor", emoji: "🩺", title: "At the clinic", role: "a calm, kind doctor", setting: "a doctor's office", goal: "Say how you feel (headache, tired, stomach ache) and understand the advice.", register: "ẹ" },
  { id: "neighbour", emoji: "🏠", title: "A new neighbour", role: "a chatty new neighbour who just moved in next door", setting: "the compound outside your building", goal: "Introduce yourself, ask their name and where they come from.", register: "o" },
  { id: "friend", emoji: "📞", title: "Phone a friend", role: "a close friend (Adé)", setting: "a phone call in the evening", goal: "Ask how your friend is, say what you did today and make a plan for tomorrow.", register: "o" },
  { id: "time", emoji: "📅", title: "Days & plans", role: "a friend who is planning the week with you", setting: "a chat about what you will each do this week", goal: "Say what you will do on three different days of the week.", register: "o" },
  { id: "libre", emoji: "✨", title: "Free chat", role: "a warm, curious Yoruba friend", setting: "a relaxed chat about anything: your day, plans, interests", goal: "Just talk! Keep the conversation going.", register: "o" },
];

/** Free chat: no scene, no goal; questions about Yoruba (in English) are welcome. */
export const CHAT = {
  id: "chat", emoji: "💬", title: "Chat with Tọ́lá", mode: "chat", register: "o",
  role: "Tọ́lá, a warm, funny Yoruba woman in her thirties who lives in Ibadan and loves helping people learn Yoruba",
  setting: "a relaxed chat", goal: "",
};

export const scenarioById = (id) => (id === "chat" ? CHAT : SCENARIOS.find((s) => s.id === id));

/** Start a conversation (no Claude call yet). Returns its id. */
export function startConversation(scenario, level) {
  const setup = { role: scenario.role, setting: scenario.setting, goal: scenario.goal, register: scenario.register, emoji: scenario.emoji, mode: scenario.mode || "scene" };
  return run("INSERT INTO conversation(scenario, title, setup, level, messages, created_at) VALUES (?,?,?,?,?,?)", [
    scenario.id, scenario.title, JSON.stringify(setup), level, "[]", Date.now(),
  ]);
}

export function getConversation(id) {
  const c = get("SELECT * FROM conversation WHERE id = ?", [id]);
  if (!c) return null;
  return { ...c, setup: JSON.parse(c.setup), messages: JSON.parse(c.messages) };
}

const save = (c) => run("UPDATE conversation SET messages = ? WHERE id = ?", [JSON.stringify(c.messages), c.id]);

const SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "Your next line in the conversation, in Yoruba" },
    corrections: {
      type: "array",
      description: "Real errors in the learner's LAST message only; empty if it was fine or there was none",
      items: {
        type: "object",
        properties: {
          original: { type: "string", description: "Exact substring of the learner's message" },
          suggestion: { type: "string" },
          category: { type: "string", enum: CATEGORIES },
          explanation: { type: "string", description: "One short sentence in simple English" },
        },
      },
    },
    suggestion: { type: "string", description: "One natural thing the learner could say next, in Yoruba at their level" },
    goal_done: { type: "boolean", description: "True once the learner has achieved the scenario goal" },
  },
};

const system = (c) => {
  const s = c.setup;
  const you = s.register === "ẹ" ? 'the respectful "ẹ"' : 'the informal "o"';
  if (s.mode === "chat") {
    return `You are ${s.role}. You're chatting with an adult English-speaking Yoruba learner at level ${c.level} (${LEVEL_GUIDE[c.level]}).
- Reply in Yoruba at that level, using ${you} for "you". Be natural, curious and a bit playful; share your own (invented) life and opinions too.
- Keep replies short (1-3 short sentences) and usually end with a question so the chat keeps going.
- If the learner asks something ABOUT Yoruba (often in English: a word, "how do I say…", a tone, a grammar question), answer it clearly and briefly in English first, with a Yoruba example, then continue the chat in Yoruba. If you are not sure, say so.
- If the learner writes in English for other things, gently answer in simple Yoruba and encourage them to try in Yoruba.
- Never correct the learner inside your reply; corrections go in "corrections" only (real errors in their Yoruba, not style; ignore English text).
- goal_done is always false.
${YORUBA_RULES}
How to correct the learner's last message:
${NATURAL_RULES}`;
  }
  return `You are role-playing ${s.role}. Setting: ${s.setting}.
You're talking with an adult English-speaking Yoruba learner at level ${c.level} (${LEVEL_GUIDE[c.level]}).
- Speak only Yoruba, in that level's vocabulary and grammar. Address the learner with ${you}.
- Keep each reply short (1-2 short sentences) and natural, like real speech. Ask questions to keep things going. Stay in character.
- The learner's goal: ${s.goal} Help them get there naturally, without lecturing.
- Never correct the learner inside your reply; corrections go in "corrections" only (real errors, not style).
${YORUBA_RULES}
How to correct the learner's last message:
${NATURAL_RULES}`;
};

const transcript = (c) => {
  const msgs = c.messages.slice(-14); // keep requests small and cheap
  return msgs.map((m) => `${m.role === "ai" ? "You" : "Learner"}: ${m.text}`).join("\n");
};

/** Get Claude's next turn. If `said` is given, it's appended as the learner's message first. */
export async function takeTurn(c, said, { claude = structured } = {}) {
  if (said) {
    said = nfc(said);
    c.messages.push({ role: "me", text: said });
    save(c);
  }
  const user = c.messages.length
    ? `Conversation so far:\n${transcript(c)}\n\nWrite your next line and check the learner's last message.`
    : "Open the conversation with your first line (the learner hasn't spoken yet; corrections must be empty).";
  const res = await claude({ system: system(c), user, schema: SCHEMA, purpose: "talk", maxTokens: 1200 });
  const last = c.messages.at(-1);
  if (last?.role === "me") {
    last.corrections = res.corrections.filter((e) => locate(last.text, e.original) !== -1);
    logMistakes(c, last);
  }
  c.messages.push({ role: "ai", text: res.reply, suggestion: res.suggestion, goalDone: res.goal_done });
  save(c);
  return c;
}

/** Each correction becomes an error (for stats) and a mistake card, like in Write. */
function logMistakes(c, msg) {
  if (!msg.corrections?.length) return;
  tx(() => {
    if (!c.submission_id) {
      c.submission_id = run("INSERT INTO submission(modality, prompt, raw_text, summary, grader, created_at) VALUES ('speak',?,?,?,?,?)", [
        c.title, "", "Conversation practice", "claude", Date.now(),
      ]);
      run("UPDATE conversation SET submission_id = ? WHERE id = ?", [c.submission_id, c.id]);
    }
    const sub = get("SELECT raw_text FROM submission WHERE id = ?", [c.submission_id]);
    const offset = sub.raw_text.length ? sub.raw_text.length + 1 : 0;
    run("UPDATE submission SET raw_text = ? WHERE id = ?", [sub.raw_text ? `${sub.raw_text}\n${msg.text}` : msg.text, c.submission_id]);
    const at = Date.now();
    for (const e of msg.corrections) {
      const pos = locate(msg.text, e.original);
      run("INSERT INTO error(submission_id, start, end, original, suggestion, category, explanation, created_at) VALUES (?,?,?,?,?,?,?,?)", [
        c.submission_id, offset + pos, offset + pos + e.original.length, e.original, e.suggestion, e.category, e.explanation, at,
      ]);
      const front = `${msg.text.slice(0, pos)}[[${msg.text.slice(pos, pos + e.original.length)}]]${msg.text.slice(pos + e.original.length)}`;
      const back = `${msg.text.slice(0, pos)}[[${e.suggestion}]]${msg.text.slice(pos + e.original.length)}`;
      const itemId = run("INSERT INTO item(kind, front, back, note, category, submission_id, created_at) VALUES ('mistake',?,?,?,?,?,?)", [
        front, back, e.explanation, e.category, c.submission_id, at,
      ]);
      addCard(itemId, "fix", at);
    }
  });
}

export function endConversation(c) {
  run("UPDATE conversation SET ended_at = ? WHERE id = ?", [Date.now(), c.id]);
}

export const allCorrections = (c) => c.messages.filter((m) => m.role === "me").flatMap((m) => (m.corrections || []).map((e) => ({ ...e, said: m.text })));
