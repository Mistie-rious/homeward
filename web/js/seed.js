// Built-in content: writing prompts per level (English, with Yoruba hints), text themes, and the beginner dialogues.
import { DIALOGUES } from "./course.js";

const PROMPTS_A1 = [
  "Introduce yourself: your name and where you live. (Orúkọ mi ni… · Mo ń gbé ní…)",
  "Describe your family. (Mo ní… · Bàbá mi… · Ìyá mi…)",
  "Say what you like to eat and drink. (Mo fẹ́ràn… · Mo fẹ́ jẹ… · Mo fẹ́ mu…)",
  "Say how you feel today. (Inú mi dùn · Ó rẹ̀ mí · Ebi ń pa mí)",
  "Greet three people at different times of the day. (Ẹ káàárọ̀ · Ẹ káàsán · Ẹ kúùrọ̀lẹ́)",
  "You are at the market. Ask the price of rice and eggs. (Èló ni…? · Mo fẹ́ ra…)",
  "Write about your best friend. (Ọ̀rẹ́ mi… · Ó dára)",
  "Say what you do in the morning. (Mo jí ní àárọ̀ · Mo ń…)",
  "Count things around you, from one to ten. (Mo ní… · ọmọ méjì · ẹyin mẹ́ta)",
  "Say where you are going today. (Mo ń lọ sí…)",
  "Say what day it is today and what you will do tomorrow. (Òní ni… · Mo máa… ní ọ̀la)",
  "Describe your home. (Ilé mi… · tóbi · dára)",
  "Ask someone three questions about themselves. (Kí ni…? · Ibo ni…? · Ṣé o…?)",
  "Write a short thank-you message to a friend. (Ẹ ṣé púpọ̀ · Mo fẹ́ràn…)",
  "Say what you can and cannot do. (Mo lè… · Mi ò mọ̀)",
];

const PROMPTS_A2 = [
  "What did you do yesterday? (Ní àná, mo… · Mo ti…)",
  "Describe your last weekend.",
  "Describe your town or neighbourhood. (Ìlú mi… · Ibi yìí…)",
  "Write a message inviting a friend to a meal. (Ṣé o lè wá…? · oúnjẹ)",
  "Describe your daily routine from morning to night. (Ní àárọ̀… · Ní ọ̀sán… · Ní òru…)",
  "Tell a friend what you are learning and why. (Mo ń kọ́ Yorùbá nítorí…)",
  "You feel ill. Explain to a doctor how you feel. (Orí ń fọ́ mi · Ikùn ń dùn mí)",
  "Ask for directions to the hospital and write the answer you imagine. (Ibo ni… wà? · Yà sí ọ̀tún)",
  "Describe the people in your family and what they do. (Ẹ̀gbọ́n mi jẹ́… · Ó ń ṣiṣẹ́…)",
  "Plan next week: what will you do on three different days? (Mo máa… · Ọjọ́ Ajé…)",
];

const PROMPTS_B1 = [
  "Tell a story about a day when something went wrong.",
  "Write about a festival or tradition you know and why it matters.",
  "Compare life in a town and in a village. (ìlú · abúlé)",
  "Write a letter to an elder you respect, asking about their health and family. (Ẹ káàárọ̀, Bàbá… · Báwo ni ẹbí?)",
  "What are your plans for the next year? (Mo máa… · Mo fẹ́…)",
  "Describe a person who inspires you.",
  "Explain how to prepare a meal you like.",
  "Is it better to learn by listening or by reading? Give your opinion. (Mo rò pé… · nítorí pé…)",
];

const PROMPTS_B2 = [
  "Write about a change you would like to see in your community, with reasons. (Mo rò pé… · nítorí pé… · ṣùgbọ́n…)",
  "Tell the story of a journey, with a beginning, a problem and an end.",
  "Describe a proverb (òwe) you know and what it teaches.",
  "Write a short speech to thank the guests at a family event.",
  "Argue for or against learning a language with apps. (Fún àpẹẹrẹ…)",
  "Reflect on what has been hardest about learning Yoruba, and how you cope.",
];

export const LEVELS = ["A1", "A2", "B1", "B2"];
export const PROMPTS_BY_LEVEL = { A1: PROMPTS_A1, A2: PROMPTS_A2, B1: PROMPTS_B1, B2: PROMPTS_B2 };

export const THEMES = [
  "a day at the market",
  "a family gathering",
  "a journey by road",
  "a school day",
  "a neighbourhood shop",
  "a festival or celebration",
  "a visit to an elder",
  "cooking a meal together",
  "a phone call with a friend",
  "going to the doctor",
  "a football match",
  "a rainy day",
  "moving to a new town",
  "a wedding",
];

export const BUILTIN_TEXTS = DIALOGUES.map((d) => ({ title: d.title, body: d.body, en: d.en }));
