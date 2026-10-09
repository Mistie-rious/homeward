// Short Yoruba basics lessons. Bodies are trusted HTML written here. <p class="ex" data-say="…"> lines get a 🔊 button
// (only shown if the phone has a Yoruba voice). Like the course, this needs a native speaker's review.

const ex = (yo, en) => `<p class="ex" data-say="${yo.replace(/<[^>]+>/g, "").replace(/"/g, "&quot;")}">${yo}<span>${en}</span></p>`;

export const GROUPS = ["Sounds & writing", "Greetings & politeness", "Grammar"];

export const LESSONS = [
  // ───────── Sounds & writing ─────────
  {
    id: "alphabet", group: "Sounds & writing", level: "A1", title: "The alphabet and the underdots",
    body: `
<p>Yoruba is written with the Latin alphabet, with three extra letters that carry an <b>underdot</b>: <b>ẹ</b>, <b>ọ</b> and <b>ṣ</b>. There are 25 letters:</p>
<p class="ex">a b d e <b>ẹ</b> f g gb h i j k l m n o <b>ọ</b> p r s <b>ṣ</b> t u w y</p>
<p>There is no c, q, v, x or z. <b>gb</b> counts as one letter.</p>
<h3>The sounds (roughly)</h3>
<ul>
<li><b>e</b> is like the "ay" in <i>say</i> (without the glide); <b>ẹ</b> is like the "e" in <i>bed</i>.</li>
<li><b>o</b> is like the "o" in <i>go</i> (without the glide); <b>ọ</b> is like the "aw" in <i>law</i>.</li>
<li><b>ṣ</b> is "sh"; <b>j</b> is "j"; <b>y</b> is as in <i>yes</i>; <b>r</b> is a quick tap.</li>
<li><b>gb</b> and <b>p</b> are pronounced with the lips and the back of the tongue at the same time (like "gb" and "kp"). Listen to a speaker for these.</li>
<li>A vowel followed by <b>n</b> at the end of a syllable is nasal, as in <i>kan</i>, <i>ẹ̀rin</i> and <i>ọgbọ̀n</i>. A lone <b>ń</b> or <b>ǹ</b> is a syllable by itself (<i>Mo ń jẹun</i>).</li>
</ul>
<h3>Why the dots matter</h3>
<p>An underdot changes the word. Compare:</p>
${ex("oko", "farm")}
${ex("ọkọ", "husband")}
${ex("ṣe", "to do, to make")}
${ex("sè", "to cook")}
<p>When you type, leave the marks out if you must: the app counts a right answer with missing marks as <b>almost</b>, not wrong. But try to add them. The row of letters above the keyboard (ẹ ọ ṣ and the tone marks) works in every text box.</p>`,
  },
  {
    id: "tones", group: "Sounds & writing", level: "A1", title: "The three tones",
    body: `
<p>Yoruba is a tonal language. Every syllable has one of three tones, and the tone is part of the word.</p>
<table class="mini"><tr><th>Tone</th><th>Mark</th><th>Pitch</th><th>Example</th></tr>
<tr><td>High</td><td><b>´</b> (acute)</td><td>high</td><td>rẹ́ in ọ̀rẹ́</td></tr>
<tr><td>Mid</td><td>none</td><td>middle</td><td>ọmọ (both syllables)</td></tr>
<tr><td>Low</td><td><b>\`</b> (grave)</td><td>low</td><td>ì in ìyá</td></tr></table>
<p>Mid is the default: an unmarked vowel is mid tone. The same letters with different tones are different words:</p>
${ex("ọkọ", "husband (mid, mid)")}
${ex("ọkọ̀", "vehicle (mid, low)")}
${ex("ọkọ́", "hoe (mid, high)")}
${ex("owó · òwò · ọwọ́", "money · trade · hand")}
<h3>Tips</h3>
<ul>
<li>Learn each new word <b>with its tones</b>, by ear if you can. Try humming the pitch pattern.</li>
<li>Sentences flow, and tones affect each other a little in fast speech, but the written tones stay the same.</li>
<li>Don't worry about being perfect at first: people will understand you from context, and tones become natural with listening.</li>
</ul>`,
  },

  // ───────── Greetings & politeness ─────────
  {
    id: "greetings", group: "Greetings & politeness", level: "A1", title: "Greetings by time of day",
    body: `
<p>Greeting is very important. Greet people when you meet them, and the greeting changes through the day (roughly):</p>
<table class="mini"><tr><th>When</th><th>Greeting</th></tr>
<tr><td>morning</td><td>Ẹ káàárọ̀</td></tr>
<tr><td>afternoon</td><td>Ẹ káàsán</td></tr>
<tr><td>evening</td><td>Ẹ kúùrọ̀lẹ́</td></tr>
<tr><td>night, saying goodnight</td><td>Ó dàárọ̀ (lit. “until morning”)</td></tr>
<tr><td>goodbye</td><td>Ó dàbọ̀</td></tr></table>
${ex("Ẹ káàárọ̀, Bàbá.", "Good morning, Father/sir.")}
${ex("Ẹ káàsán.", "Good afternoon.")}
<p>You answer a greeting by saying the same greeting back, often with <b>Ẹ ṣé</b> (thank you).</p>
<h3>Asking how someone is</h3>
${ex("Báwo ni?", "How are you?")}
${ex("Ṣé àlàáfíà ni?", "Are you well?")}
${ex("Àlàáfíà ni.", "I am well. (lit. it is peace)")}
<p><b>Ẹ kú</b> + something is a common way to greet people about what they are doing: <b>Ẹ kú iṣẹ́</b> to someone working.</p>`,
  },
  {
    id: "respect", group: "Greetings & politeness", level: "A1", title: "Ẹ or o? Being respectful",
    body: `
<p>Yoruba has two ways to say “you”:</p>
<table class="mini"><tr><th></th><th>one person you know well, or younger</th><th>several people, or one person you respect</th></tr>
<tr><td>you (before a verb)</td><td><b>o</b></td><td><b>ẹ</b></td></tr>
<tr><td>your (after a noun)</td><td><b>rẹ</b></td><td><b>yín</b></td></tr></table>
${ex("O wà dáadáa.", "You are fine. (to a friend)")}
${ex("Ẹ wà dáadáa.", "You are fine. (to an elder, or to several people)")}
${ex("Ilé rẹ dára.", "Your house is nice. (to a friend)")}
${ex("Ilé yín dára.", "Your house is nice. (to an elder)")}
<h3>When to use ẹ</h3>
<ul>
<li>With anyone older than you, with strangers, in shops and offices, and with teachers.</li>
<li>With groups of people, whatever their age.</li>
<li>If you are not sure, use <b>ẹ</b>. It is never rude to be too respectful.</li>
</ul>
<h3>Titles</h3>
<p>Elders are addressed as <b>Bàbá</b> (father) or <b>Ìyá</b> (mother), often with a name: <b>Ìyá Tọ́lá</b> is “Tọ́lá's mother”. Greeting elders with a bow or a curtsey is part of the tradition in many families; ask a Yoruba friend what is expected.</p>
<p>The app's Talk scenarios tell you which register the other person uses, so you can practise both.</p>`,
  },

  // ───────── Grammar ─────────
  {
    id: "pronouns", group: "Grammar", level: "A1", title: "Pronouns and “to be”",
    body: `
<table class="mini"><tr><th></th><th>before a verb</th><th>emphatic</th><th>after a noun (my…)</th></tr>
<tr><td>I</td><td>mo</td><td>èmi</td><td>mi</td></tr>
<tr><td>you</td><td>o</td><td>ìwọ</td><td>rẹ</td></tr>
<tr><td>he/she</td><td>ó</td><td>òun</td><td>rẹ̀</td></tr>
<tr><td>we</td><td>a</td><td>àwa</td><td>wa</td></tr>
<tr><td>you (pl./respect)</td><td>ẹ</td><td>ẹ̀yin</td><td>yín</td></tr>
<tr><td>they</td><td>wọ́n</td><td>àwọn</td><td>wọn</td></tr></table>
<p>Yoruba has no he/she difference: <b>ó</b> means both. After a verb you use <b>mi</b> (me), <b>ọ</b> (you) and <b>i</b> (him/her/it): <i>Mo rí ọ</i> “I see you”.</p>
<h3>Three ways to say “to be”</h3>
<ul>
<li><b>jẹ́</b>: is, with a noun. ${ex("Mo jẹ́ akẹ́kọ̀ọ́.", "I am a student.")}</li>
<li><b>wà</b>: is somewhere, or exists. ${ex("Mo wà ní ilé.", "I am at home.")}</li>
<li><b>ni</b>: “it is…”, to identify or stress. ${ex("Èmi ni Adé.", "I am Adé.")}</li>
</ul>
<p>Adjectives act like verbs, so no “to be” is needed: <i>Ilé náà tóbi</i> “The house is big”.</p>`,
  },
  {
    id: "order", group: "Grammar", level: "A1", title: "Sentence order",
    body: `
<p>The basic order is <b>subject + verb + object</b>, like English:</p>
${ex("Mo jẹ ìrẹsì.", "I ate rice.")}
${ex("Ó rà ẹja.", "He/she bought fish.")}
<p>Inside a noun phrase the noun comes <b>first</b>, and everything that describes it follows:</p>
<table class="mini"><tr><th>Yoruba</th><th>English</th></tr>
<tr><td>ilé <b>mi</b></td><td>my house</td></tr>
<tr><td>ilé <b>Adé</b></td><td>Adé's house</td></tr>
<tr><td>ilé <b>yìí</b></td><td>this house</td></tr>
<tr><td>ilé <b>náà</b></td><td>the (that) house</td></tr>
<tr><td>ọmọ <b>méjì</b></td><td>two children</td></tr></table>
<p>So the owner comes after the thing owned: “house Adé” for “Adé's house”.</p>
${ex("Ìdílé wa tóbi.", "Our family is big.")}`,
  },
  {
    id: "negation", group: "Grammar", level: "A1", title: "Saying no: kò",
    body: `
<p>The negative word is <b>kò</b>, placed after the subject. With some pronouns it shortens:</p>
<table class="mini"><tr><th></th><th>Yoruba</th></tr>
<tr><td>I don't go</td><td>Mi ò lọ</td></tr>
<tr><td>you don't go</td><td>O kò lọ</td></tr>
<tr><td>he/she doesn't go</td><td>Kò lọ</td></tr></table>
<p>The other persons work the same way: pronoun + <b>kò</b> (we: <i>A ò lọ</i>, you pl.: <i>Ẹ kò lọ</i>).</p>
${ex("Mi ò mọ̀.", "I don't know.")}
${ex("Mi ò fẹ́.", "I don't want it.")}
${ex("Kò wá.", "He/she didn't come.")}
${ex("Kò sí omi.", "There is no water.")}
<p>For “no” as an answer, say <b>Rárá</b>; for “yes”, <b>Bẹ́ẹ̀ni</b>.</p>`,
  },
  {
    id: "questions", group: "Grammar", level: "A1", title: "Question words",
    body: `
<p><b>Yes/no questions</b> start with <b>ṣé</b>:</p>
${ex("Ṣé o mọ̀?", "Do you know?")}
${ex("Ṣé ara rẹ yá?", "Are you well?")}
<h3>Question words</h3>
<table class="mini"><tr><th>word</th><th>meaning</th><th>example</th></tr>
<tr><td>kí</td><td>what</td><td>Kí ni èyí?</td></tr>
<tr><td>ta</td><td>who</td><td>Ta ni èyí?</td></tr>
<tr><td>ibo</td><td>where</td><td>Ibo ni ọjà wà?</td></tr>
<tr><td>báwo</td><td>how</td><td>Báwo ni o ṣe wà?</td></tr>
<tr><td>mélòó</td><td>how many</td><td>Ọmọ mélòó ni o ní?</td></tr>
<tr><td>èló</td><td>how much (price)</td><td>Èló ni èyí?</td></tr>
<tr><td>èwo</td><td>which</td><td>Èwo ni o fẹ́?</td></tr>
<tr><td>nígbà wo</td><td>when</td><td>Nígbà wo?</td></tr></table>
<p>Notice that the question word usually comes first, followed by <b>ni</b>.</p>`,
  },
  {
    id: "tense", group: "Grammar", level: "A1", title: "Tense markers: ń, ti, máa",
    body: `
<p>Yoruba verbs <b>never change form</b>. Small words before the verb tell you the time:</p>
<table class="mini"><tr><th>marker</th><th>meaning</th><th>example</th></tr>
<tr><td>(none)</td><td>a finished action, or a state</td><td>Mo jẹ ìrẹsì. I ate rice.<br>Mo fẹ́ omi. I want water.</td></tr>
<tr><td><b>ń</b></td><td>happening now</td><td>Mo ń jẹun. I am eating.</td></tr>
<tr><td><b>ti</b></td><td>already</td><td>Mo ti jẹun. I have eaten.</td></tr>
<tr><td><b>máa</b></td><td>will; usually</td><td>Mo máa lọ ní ọ̀la. I will go tomorrow.</td></tr>
<tr><td><b>kò</b></td><td>not</td><td>Kò wá. He/she didn't come.</td></tr></table>
${ex("Wọ́n ń bọ̀.", "They are coming.")}
${ex("Ó ti dé.", "He/she has arrived.")}
<p>The little <b>ń</b> carries a tone mark because it is a syllable by itself (a high-tone “n”).</p>`,
  },
  {
    id: "numbers", group: "Grammar", level: "A1", title: "Numbers and counting forms",
    body: `
<p>Yoruba has two forms of the numbers 1–10: one for <b>counting</b> by itself and one for <b>counting things</b> (after a noun).</p>
<table class="mini"><tr><th></th><th>counting</th><th>with a noun</th></tr>
<tr><td>1</td><td>ọ̀kan</td><td>kan</td></tr>
<tr><td>2</td><td>èjì</td><td>méjì</td></tr>
<tr><td>3</td><td>ẹ̀ta</td><td>mẹ́ta</td></tr>
<tr><td>4</td><td>ẹ̀rin</td><td>mẹ́rin</td></tr>
<tr><td>5</td><td>àrún</td><td>márùn-ún</td></tr>
<tr><td>6</td><td>ẹ̀fà</td><td>mẹ́fà</td></tr>
<tr><td>7</td><td>èje</td><td>méje</td></tr>
<tr><td>8</td><td>ẹ̀jọ</td><td>mẹ́jọ</td></tr>
<tr><td>9</td><td>ẹ̀sàn-án</td><td>mẹ́sàn-án</td></tr>
<tr><td>10</td><td>ẹ̀wá</td><td>mẹ́wàá</td></tr></table>
${ex("Mo ní ọmọ méjì.", "I have two children.")}
${ex("Mo rà ẹyin mẹ́fà.", "I bought six eggs.")}
<h3>Bigger numbers</h3>
<p>ogún 20 · ọgbọ̀n 30 · ọgọ́rùn-ún 100 · igba 200 · ẹgbẹ̀rún 1000.</p>
<p>Above 30 Yoruba builds numbers from twenties (40 is “two twenties”), so 40, 50, 60 and so on are formed by a different pattern. Learn them later, with a teacher or a native speaker.</p>`,
  },
];

export const lessonById = (id) => LESSONS.find((l) => l.id === id);
