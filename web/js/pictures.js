// Hand-drawn flat pictures (inline SVG, 64×64) for course words and sentences: people, things, places, actions.
// Drawn in code so they work offline, scale on any phone and follow the app's colours. A word or sentence without
// a picture simply shows none. Keys are the course text (matched with NFC + lower case).
import { lc } from "./nlp.js";

// ── palette ──
const SK = ["#8a5a3c", "#6b4226", "#a56a46"];
const EGG = "#fbf3df", INK = "#2b2430", WHITE = "#ffffff", GREY = "#a29eab", LGREY = "#d9d5de";
const CORAL = "#e8664c", SKY = "#3a85c9", MUSTARD = "#e0a526", SAGE = "#3f9468", PURPLE = "#7357e8";
const RED = "#d63b3b", GREEN = "#4a9d5b", YELLOW = "#f2c94c", BROWN = "#8b5a2b", WATER = "#6bb7e8", ORANGE = "#f08a24", PAPER = "#f6efe3";

// ── drawing helpers (return SVG strings) ──
const el = (t, a) => `<${t} ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(" ")}/>`;
const C = (cx, cy, r, fill, x = {}) => el("circle", { cx, cy, r, fill, ...x });
const E = (cx, cy, rx, ry, fill, x = {}) => el("ellipse", { cx, cy, rx, ry, fill, ...x });
const R = (x, y, width, height, fill, rx = 0, o = {}) => el("rect", { x, y, width, height, rx, fill, ...o });
const P = (d, fill = "none", o = {}) => el("path", { d, fill, ...o });
const L = (x1, y1, x2, y2, stroke = INK, w = 2.5) => el("line", { x1, y1, x2, y2, stroke, "stroke-width": w, "stroke-linecap": "round" });
const S = (d, stroke = INK, w = 2.5) => P(d, "none", { stroke, "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round" });
const T = (x, y, s, size = 14, fill = INK) => `<text x="${x}" y="${y}" font-size="${size}" font-weight="700" text-anchor="middle" fill="${fill}" font-family="system-ui,-apple-system,sans-serif">${s}</text>`;
const G = (tf, ...c) => `<g transform="${tf}">${c.join("")}</g>`;
const at = (x, y, k, ...c) => G(`translate(${x} ${y}) scale(${k})`, ...c);

/** A person: feet at y+18k, head top near y-26k. kind: man | woman | elder | child | baby. */
function person({ x = 32, y = 38, k = 1, skin = SK[0], shirt = CORAL, kind = "man", arms, held = "", flip = false } = {}) {
  if (kind === "child") k *= 0.72;
  const pants = "#3d3a4a";
  let hair = P("M-6.2 -21 a6.2 6.2 0 0 1 12.4 0 z", INK);
  if (kind === "woman") hair = E(0, -25.5, 7.6, 3.8, MUSTARD);
  if (kind === "elder") hair = P("M-6.2 -21 a6.2 6.2 0 0 1 12.4 0 z", "#dedae3");
  const head = C(0, -20, 6.2, skin) + hair;
  let body, legs;
  if (kind === "woman") {
    body = P("M-6 -13 h12 l5.5 25 h-23 z", shirt);
    legs = R(-3.8, 12, 3, 6, skin) + R(0.8, 12, 3, 6, skin);
  } else if (kind === "baby") {
    return at(x, y, k, E(0, 0, 9, 11, MUSTARD), C(0, -14, 7, skin), P("M-7 -16 a7 7 0 0 1 14 0 z", INK));
  } else {
    body = R(-7, -13, 14, 18, shirt, 4);
    legs = R(-6, 5, 5, 13, pants) + R(1, 5, 5, 13, pants);
  }
  const a = arms || [[-7, -11, -10.5, 2], [7, -11, 10.5, 2]];
  const armSvg = a.map(([x1, y1, x2, y2]) => L(x1, y1, x2, y2, skin, 3.6)).join("");
  const cane = kind === "elder" ? L(12, -2, 14, 18, BROWN, 2.2) : "";
  return at(x, y, k, flip ? G("scale(-1 1)", legs, body, head, armSvg, cane, held) : legs + body + head + armSvg + cane + held);
}

const dots = (n, cx = 32, cy = 32, r = 4.2, fill = CORAL) => {
  const cols = n <= 3 ? n : n <= 6 ? Math.ceil(n / 2) : Math.ceil(n / 2);
  const rows = Math.ceil(n / cols);
  const gap = r * 2.6;
  let out = "";
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols), col = i % cols;
    const inRow = row === rows - 1 ? n - cols * (rows - 1) : cols;
    out += C(cx + (col - (inRow - 1) / 2) * gap, cy + (row - (rows - 1) / 2) * gap, r, fill, fill === EGG ? { stroke: "#cdbf9f", "stroke-width": 1.2 } : {});
  }
  return out;
};
const arrow = (x1, y1, x2, y2, c = INK, w = 3) => {
  const ang = Math.atan2(y2 - y1, x2 - x1), h = 6;
  const p = (da) => `${(x2 - h * Math.cos(ang + da)).toFixed(1)} ${(y2 - h * Math.sin(ang + da)).toFixed(1)}`;
  return L(x1, y1, x2, y2, c, w) + S(`M${p(0.5)} L${x2} ${y2} L${p(-0.5)}`, c, w);
};
const heart = (x, y, s = 1, fill = CORAL) => at(x, y, s, P("M0 6 C-12 -3 -6 -11 0 -4 C6 -11 12 -3 0 6z", fill));
const sun = (x, y, r = 8, fill = YELLOW) => C(x, y, r, fill) + [0, 45, 90, 135, 180, 225, 270, 315].map((d) => G(`rotate(${d} ${x} ${y})`, L(x, y - r - 3, x, y - r - 6, fill, 2))).join("");
const q = (x, y, s = 1, fill = PURPLE) => T(x, y, "?", 22 * s, fill);
const cloud = (x, y, s = 1) => at(x, y, s, E(0, 0, 10, 5, WHITE), C(-5, -3, 5, WHITE), C(3, -5, 6, WHITE));
const house = (x = 32, y = 40, k = 1, wall = SAGE, roof = CORAL) =>
  at(x, y, k, R(-14, -6, 28, 20, wall), P("M-18 -5 L0 -22 L18 -5 z", roof), R(-4, 3, 8, 11, PAPER, 3));
const bowl = (x, y, k = 1, fill = WHITE, content = "") => at(x, y, k, content, P("M-12 0 h24 a12 12 0 0 1 -24 0z", fill, { stroke: LGREY, "stroke-width": 1 }));
const coin = (x, y, r = 5) => C(x, y, r, YELLOW, { stroke: MUSTARD, "stroke-width": 1.5 });
const note = (x, y, k = 1) => at(x, y, k, R(-12, -7, 24, 14, SAGE, 2), C(0, 0, 4, "#b8dcc4"), T(-8, 3, "₦", 7, WHITE));
const book = (x, y, k = 1, open = true) => at(x, y, k, open ? P("M-12 -8 q6 -3 12 0 q6 -3 12 0 v16 q-6 -3 -12 0 q-6 -3 -12 0z", WHITE, { stroke: SKY, "stroke-width": 1.8 }) + L(0, -8, 0, 8, SKY, 1.5) : R(-8, -10, 16, 20, SKY, 2));
const clock = (x, y, r = 12, h = 0, m = 0) => C(x, y, r, WHITE, { stroke: INK, "stroke-width": 2.2 }) + L(x, y, x + 0.55 * r * Math.sin(h), y - 0.55 * r * Math.cos(h), INK, 2) + L(x, y, x + 0.8 * r * Math.sin(m), y - 0.8 * r * Math.cos(m), INK, 1.6);
const tree = (x, y, k = 1) => at(x, y, k, R(-2, 0, 4, 12, BROWN), C(0, -6, 9, GREEN));
const palm = (x, y, k = 1) => at(x, y, k, P("M-1 14 Q2 0 0 -10", "none", { stroke: BROWN, "stroke-width": 3 }), [-70, -35, 0, 35, 70].map((d) => G(`rotate(${d} 0 -10)`, E(0, -17, 2.6, 8, GREEN))).join(""));
const cross = (x, y, s = 1, fill = RED) => at(x, y, s, R(-3, -9, 6, 18, fill, 1), R(-9, -3, 18, 6, fill, 1));
const speech = (x, y, w = 24, h = 16, fill = WHITE, tail = true) => R(x - w / 2, y - h / 2, w, h, fill, 6, { stroke: LGREY, "stroke-width": 1.2 }) + (tail ? P(`M${x - 4} ${y + h / 2 - 1} l-3 6 l8 -5z`, fill) : "");
const check = (x, y, c = GREEN) => S(`M${x - 8} ${y} l6 7 l11 -14`, c, 4.5);
const cross2 = (x, y, c = RED) => S(`M${x - 7} ${y - 7} l14 14 M${x + 7} ${y - 7} l-14 14`, c, 4.5);
const person2 = (o1 = {}, o2 = {}) => person({ x: 22, k: 0.95, shirt: SKY, ...o1 }) + person({ x: 42, k: 0.95, kind: "woman", skin: SK[1], shirt: PURPLE, ...o2 });
const speechMark = (x, y) => C(x, y, 7, WHITE, { stroke: LGREY, "stroke-width": 1.2 }) + q(x, y + 6, 0.6);

// ── the pictures ──
const RAW = {
  // greetings
  "káàbọ̀": person({ kind: "woman", shirt: SAGE, arms: [[-7, -11, -16, -20], [7, -11, 16, -20]] }) + house(10, 18, 0.5) ,
  "ẹ ṣé": person({ shirt: PURPLE, arms: [[-7, -11, 2, -6], [7, -11, 2, -6]] }) + heart(48, 16, 1.2),
  "jọ̀ọ́": person({ kind: "woman", shirt: CORAL, arms: [[-7, -11, 0, -8], [7, -11, 0, -8]] }) + L(30, 14, 34, 14, MUSTARD, 3) + sun(50, 14, 5),
  "pẹ̀lẹ́": person({ shirt: SKY, arms: [[-7, -11, -2, -16], [7, -11, 10, 2]] }) + S("M27 -2 q5 -3 10 0", INK, 1.8) + at(32, 30, 1, S("M-3 -26 q3 -3 6 0", INK, 1.5)) + heart(50, 14, 0.9, GREY),
  "má bínú": person({ kind: "woman", shirt: PURPLE, arms: [[-7, -11, -3, -7], [7, -11, 10, 2]] }) + speech(48, 14, 22, 14) + T(48, 19, "…", 14),
  "dáadáa": person({ shirt: SAGE, arms: [[-7, -11, -10, 2], [7, -11, 15, -17]] }) + sun(14, 14, 5),
  "bẹ́ẹ̀ni": C(32, 32, 22, SAGE) + check(32, 32, WHITE),
  "rárá": C(32, 32, 22, RED) + cross2(32, 32, WHITE),
  "orúkọ": R(10, 20, 44, 28, WHITE, 5, { stroke: LGREY, "stroke-width": 1.5 }) + C(22, 34, 6, SK[0]) + R(32, 28, 16, 3, GREY, 1.5) + R(32, 35, 12, 3, LGREY, 1.5) + R(10, 20, 44, 7, CORAL, 5),
  "àlàáfíà": C(32, 32, 22, YELLOW) + C(24, 27, 2.6, INK) + C(40, 27, 2.6, INK) + S("M21 36 q11 12 22 0", INK, 3),

  // pronouns
  "mo": person({ shirt: CORAL, arms: [[-7, -11, -10, 2], [7, -11, 1, -6]] }) + T(50, 18, "1", 14, GREY),
  "o": person({ x: 20, shirt: SKY, arms: [[-7, -11, -10, 2], [7, -11, 17, -12]] }) + person({ x: 48, shirt: GREY, k: 0.95 }),
  "ó": person({ x: 36, shirt: SAGE }) + person({ x: 14, shirt: GREY, k: 0.8, y: 42 }) + arrow(18, 14, 30, 16, INK, 2.2),
  "a": person({ x: 21, shirt: CORAL, k: 0.9 }) + person({ x: 43, kind: "woman", shirt: SKY, k: 0.9, skin: SK[1] }),
  "ẹ": person({ x: 18, kind: "elder", shirt: SKY, k: 0.85 }) + person({ x: 33, kind: "woman", shirt: PURPLE, k: 0.85 }) + person({ x: 48, shirt: SAGE, k: 0.85, skin: SK[2] }),
  "wọ́n": person({ x: 14, shirt: SAGE, k: 0.8 }) + person({ x: 32, kind: "woman", shirt: CORAL, k: 0.8, skin: SK[1] }) + person({ x: 50, shirt: SKY, k: 0.8 }),
  "olùkọ́": R(8, 10, 48, 26, "#2f5d50", 3) + L(14, 18, 34, 18, WHITE, 2) + L(14, 25, 28, 25, WHITE, 2) + person({ x: 46, y: 48, k: 0.8, shirt: PURPLE, kind: "woman", arms: [[-7, -11, -16, -18], [7, -11, 10, 2]] }),
  "akẹ́kọ̀ọ́": person({ shirt: SKY, arms: [[-7, -11, -4, -4], [7, -11, 4, -4]], held: book(0, -4, 0.7, false) }),

  // family
  "ìdílé": person({ x: 20, k: 0.7, shirt: SKY, y: 38 }) + person({ x: 44, k: 0.7, kind: "woman", shirt: PURPLE, y: 38, skin: SK[1] }) + person({ x: 32, k: 0.6, kind: "child", shirt: MUSTARD, y: 42 }) + heart(32, 12, 0.9),
  "ẹbí": person({ x: 14, k: 0.6, shirt: SKY, y: 40 }) + person({ x: 28, k: 0.6, kind: "woman", shirt: PURPLE, y: 40, skin: SK[1] }) + person({ x: 42, k: 0.5, kind: "child", shirt: MUSTARD, y: 42 }) + person({ x: 54, k: 0.6, kind: "elder", shirt: SAGE, y: 40 }),
  "bàbá": person({ shirt: SKY, k: 1.05 }),
  "ìyá": person({ kind: "woman", shirt: PURPLE, k: 1.05, skin: SK[1] }),
  "ọmọ": person({ kind: "child", shirt: MUSTARD, y: 42, k: 1.15 }),
  "ọkọ": person({ shirt: SKY, k: 0.95 }) + C(50, 18, 5, "none", { stroke: YELLOW, "stroke-width": 3 }),
  "ìyàwó": person({ kind: "woman", shirt: PURPLE, k: 0.95, skin: SK[1] }) + C(50, 18, 5, "none", { stroke: YELLOW, "stroke-width": 3 }),
  "arákùnrin": person({ kind: "child", shirt: SKY, y: 42, k: 1.15 }),
  "arábìnrin": person({ kind: "child", shirt: PURPLE, y: 42, k: 1.15 }) + E(32, 20, 8, 3, MUSTARD),
  "ẹ̀gbọ́n": person({ x: 22, k: 1, shirt: SKY }) + person({ x: 46, kind: "child", y: 44, k: 0.8, shirt: MUSTARD }) + arrow(36, 14, 46, 14, GREY, 2),
  "àbúrò": person({ x: 20, k: 1, kind: "child", y: 42, shirt: MUSTARD }) + person({ x: 46, k: 0.95, shirt: SKY }) + arrow(32, 14, 22, 14, GREY, 2),
  "ọ̀rẹ́": person({ x: 20, shirt: SKY, arms: [[-7, -11, 6, -2], [7, -11, 10, 2]] }) + person({ x: 44, kind: "woman", shirt: PURPLE, skin: SK[1], arms: [[-7, -11, -6, -2], [7, -11, 10, 2]] }) + heart(32, 12, 0.8),
  "ìyá àgbà": person({ kind: "elder", shirt: PURPLE, k: 1.05, skin: SK[1] }),
  "bàbá àgbà": person({ kind: "elder", shirt: SAGE, k: 1.05 }),
  "ọmọbìnrin": person({ kind: "child", shirt: CORAL, y: 42, k: 1.15 }) + C(26, 20, 2.4, MUSTARD) + C(38, 20, 2.4, MUSTARD),
  "ọmọkùnrin": person({ kind: "child", shirt: SKY, y: 42, k: 1.15 }),

  // numbers
  "ọ̀kan": dots(1, 32, 32, 7), "èjì": dots(2, 32, 32, 7), "ẹ̀ta": dots(3, 32, 32, 7), "ẹ̀rin": dots(4, 32, 32, 6.5), "àrún": dots(5, 32, 32, 6),
  "ẹ̀fà": dots(6, 32, 32, 6), "èje": dots(7, 32, 32, 5.2), "ẹ̀jọ": dots(8, 32, 32, 5.5), "ẹ̀sàn-án": dots(9, 32, 32, 5), "ẹ̀wá": dots(10, 32, 32, 5),
  "ogún": T(32, 42, "20", 28, CORAL), "ọgbọ̀n": T(32, 42, "30", 28, SKY), "ọgọ́rùn-ún": T(32, 42, "100", 24, SAGE), "igba": T(32, 42, "200", 24, PURPLE), "ẹgbẹ̀rún": T(32, 42, "1000", 19, MUSTARD),

  "èmi": person({ shirt: CORAL, k: 1.05, arms: [[-7, -11, -10, 2], [7, -11, 1, -6]] }) + heart(50, 14, 0.8, CORAL),
  "ìwọ": person({ x: 18, shirt: GREY, k: 0.85 }) + person({ x: 46, shirt: SKY, k: 1.05, arms: [[-7, -11, -10, 2], [7, -11, -14, -8]], flip: true }),
  "òun": person({ x: 14, shirt: GREY, k: 0.8 }) + person({ x: 42, kind: "woman", shirt: SAGE, k: 1.0, skin: SK[1] }) + arrow(8, 12, 30, 20, INK, 2),
  "àwa": person({ x: 18, shirt: CORAL, k: 0.85 }) + person({ x: 46, kind: "woman", shirt: SKY, k: 0.85, skin: SK[1] }) + arrow(32, 8, 32, 14, INK, 2) + C(32, 34, 27, "none", { stroke: LGREY, "stroke-width": 1.5, "stroke-dasharray": "3 4" }),
  "ẹ̀yin": person({ x: 14, shirt: SKY, k: 0.8 }) + person({ x: 32, kind: "woman", shirt: PURPLE, k: 0.8, skin: SK[1] }) + person({ x: 50, shirt: SAGE, k: 0.8 }) + arrow(32, 6, 32, 12, INK, 2),
  "àwọn": person({ x: 14, shirt: GREY, k: 0.8 }) + person({ x: 32, kind: "woman", shirt: GREY, k: 0.8, skin: SK[1] }) + person({ x: 50, shirt: GREY, k: 0.8 }),
  "mi": person({ x: 18, shirt: CORAL, k: 0.9, arms: [[-7, -11, -10, 2], [7, -11, 1, -6]] }) + house(46, 40, 0.8) + P("M30 38 H36", "none", { stroke: CORAL, "stroke-width": 2.5, "stroke-linecap": "round" }),
  "rẹ": person({ x: 46, shirt: SKY, k: 0.9 }) + house(18, 40, 0.8, MUSTARD) + arrow(32, 40, 34, 40, SKY, 2),
  "rẹ̀": person({ x: 46, kind: "woman", shirt: SAGE, k: 0.9, skin: SK[1] }) + house(18, 40, 0.8, SKY) + arrow(32, 40, 34, 40, SAGE, 2),
  "wa": person({ x: 14, shirt: CORAL, k: 0.6, y: 42 }) + person({ x: 26, kind: "woman", shirt: SKY, k: 0.6, y: 42, skin: SK[1] }) + house(48, 36, 0.9),
  "yín": person({ x: 14, shirt: SKY, k: 0.6, y: 42 }) + person({ x: 26, kind: "woman", shirt: PURPLE, k: 0.6, y: 42, skin: SK[1] }) + house(48, 36, 0.9, MUSTARD) + arrow(36, 10, 44, 18, INK, 2),
  "wọn": person({ x: 14, shirt: GREY, k: 0.6, y: 42 }) + person({ x: 26, kind: "woman", shirt: GREY, k: 0.6, y: 42, skin: SK[1] }) + house(48, 36, 0.9, SKY),
  "jẹ́": person({ x: 20, shirt: PURPLE, kind: "woman", k: 0.9 }) + T(38, 36, "=", 22, INK) + book(52, 34, 0.7, false),
  "wà": person({ x: 20, shirt: SKY, k: 0.9 }) + at(46, 30, 0.9, P("M0 22 q-14 -14 -14 -22 a14 14 0 0 1 28 0 q0 8 -14 22z", RED), C(0, 0, 5, WHITE)),
  "ni": person({ x: 32, shirt: CORAL, k: 1.05 }) + arrow(32, 4, 32, 10, INK, 2.5) + C(32, 32, 26, "none", { stroke: PURPLE, "stroke-width": 2.5 }),
  "àti": C(16, 32, 9, ORANGE) + T(32, 40, "+", 24, INK) + C(48, 32, 9, GREEN),
  "gan-an": heart(14, 34, 1.1) + heart(32, 34, 1.4) + heart(50, 34, 1.1),
  "sí": person({ x: 14, shirt: SKY, k: 0.7, y: 44 }) + arrow(26, 40, 40, 40, INK, 2.5) + house(52, 38, 0.8),
  "láti": house(12, 38, 0.8) + arrow(24, 40, 38, 40, INK, 2.5) + person({ x: 50, shirt: SKY, k: 0.7, y: 44 }),

  // food & market
  "oúnjẹ": C(32, 34, 20, WHITE, { stroke: LGREY, "stroke-width": 2 }) + C(32, 34, 12, "#f4e6c8") + L(8, 14, 8, 50, GREY, 2.5) + L(56, 14, 56, 50, GREY, 2.5),
  "omi": P("M18 14 h28 l-3 36 q0 4 -4 4 h-14 q-4 0 -4 -4z", "#dff0fb", { stroke: WATER, "stroke-width": 2 }) + P("M20.5 28 h23 l-1.8 22 q0 2 -2 2 h-15 q-2 0 -2 -2z", WATER),
  "ìrẹsì": bowl(32, 30, 1.3, SKY, C(0, -2, 10, WHITE) + [[-4, -4], [2, -6], [5, -1], [-2, 0], [0, -9]].map(([a, b]) => E(a, b, 1.8, 0.9, LGREY)).join("")),
  "ẹran": P("M14 38 q-6 -16 10 -22 q18 -6 24 8 q3 12 -12 16 q-8 2 -12 8z", "#b3523d") + C(46, 26, 5, "#f2dcc7") + L(48, 24, 56, 16, "#f2dcc7", 3.5),
  "ẹja": E(30, 32, 17, 10, SKY) + P("M46 32 l12 -9 v18z", SKY) + C(21, 29, 2.2, WHITE) + C(21, 29, 1, INK) + S("M30 24 q4 8 0 16", WATER, 2),
  "ẹyin": E(32, 34, 12, 16, EGG, { stroke: "#cdbf9f", "stroke-width": 1.8 }),
  "ẹ̀wà": P("M10 40 q10 -24 40 -14 q-14 6 -26 22z", GREEN) + [[22, 36], [30, 32], [38, 30]].map(([a, b]) => C(a, b, 3.2, "#d6e8b0")).join(""),
  "iṣu": P("M12 38 q2 -16 24 -16 q18 0 18 12 q-2 12 -22 12 q-18 2 -20 -8z", "#a8744a") + S("M20 34 q6 -4 12 0 M34 40 q6 -3 12 0", "#7d5232", 1.8),
  "búrẹ́dì": P("M10 40 q0 -18 22 -18 q22 0 22 18 q0 6 -6 6 h-32 q-6 0 -6 -6z", "#d9a05b") + S("M22 28 l4 8 M32 26 l4 9 M42 28 l3 7", "#b8803f", 2.2),
  "ata": P("M26 14 q4 -4 8 0 q14 6 8 24 q-4 12 -10 14 q-12 -6 -14 -22 q0 -10 8 -16z", RED) + P("M30 12 q2 -6 6 -4", "none", { stroke: GREEN, "stroke-width": 3, "stroke-linecap": "round" }),
  "iyọ̀": R(24, 20, 16, 26, WHITE, 4, { stroke: LGREY, "stroke-width": 1.5 }) + R(22, 14, 20, 8, GREY, 3) + [[29, 17], [35, 17]].map(([a, b]) => C(a, b, 1, INK)).join("") + C(29, 33, 1.3, GREY) + C(35, 38, 1.3, GREY),
  "ọsàn": C(32, 36, 17, ORANGE) + P("M32 19 q8 -8 14 -2 q-6 6 -14 2z", GREEN),
  "ọjà": R(6, 30, 52, 22, PAPER, 2) + P("M4 30 L10 14 H54 L60 30z", CORAL) + [0, 1, 2, 3].map((i) => R(10 + i * 12.5, 14, 6.5, 16, WHITE, 0, { opacity: 0.85 })).join("") + C(18, 42, 5, ORANGE) + C(30, 42, 5, GREEN) + C(42, 42, 5, YELLOW),
  "owó": note(22, 28, 0.95) + coin(44, 40, 7) + coin(38, 46, 5),
  "díẹ̀": dots(2, 32, 32, 5, SKY),
  "púpọ̀": dots(10, 32, 30, 4.4, SKY),

  // places
  "ilé": house(32, 38, 1.5),
  "ilé-ìwé": R(8, 24, 48, 28, "#e9c46a", 2) + P("M4 24 L32 8 L60 24z", CORAL) + R(26, 36, 12, 16, PAPER, 2) + L(32, 8, 32, 0, INK, 2) + P("M32 0 h9 v5 h-9z", SAGE) + R(13, 31, 8, 8, SKY, 1) + R(43, 31, 8, 8, SKY, 1),
  "ilé-ìwòsàn": R(10, 22, 44, 32, WHITE, 3, { stroke: LGREY, "stroke-width": 1.5 }) + cross(32, 34, 1.2) + R(26, 42, 12, 12, SKY, 2),
  "ìlú": R(6, 32, 10, 22, SKY) + R(18, 20, 12, 34, CORAL) + R(32, 28, 10, 26, MUSTARD) + R(44, 14, 12, 40, SAGE) + [[21, 26], [21, 34], [47, 20], [47, 28], [47, 36]].map(([a, b]) => R(a, b, 4, 4, WHITE)).join(""),
  "abúlé": at(20, 40, 1, P("M-12 8 v-12 a12 12 0 0 1 24 0 v12z", "#c9955d"), P("M-14 -4 L0 -18 L14 -4z", "#a8744a"), R(-3, 0, 6, 8, INK, 1)) + palm(48, 38, 1),
  "ọ̀nà": P("M26 6 L38 6 L58 58 L6 58z", "#6b6672") + [14, 26, 38, 50].map((y, i) => R(31 - i * 0.2, y - 4, 2 + i * 0.7, 5 + i, WHITE)).join(""),
  "ọkọ̀": P("M6 38 q0 -10 10 -12 l8 -8 h18 l10 8 q10 2 10 12v6h-56z", SKY) + R(22, 21, 8, 7, "#d6ecfb") + R(34, 21, 10, 7, "#d6ecfb") + C(18, 46, 6, INK) + C(46, 46, 6, INK) + C(18, 46, 2.3, GREY) + C(46, 46, 2.3, GREY),
  "ibi": P("M32 56 q-18 -20 -18 -30 a18 18 0 0 1 36 0 q0 10 -18 30z", RED) + C(32, 26, 7, WHITE),
  "ibo": P("M32 56 q-18 -20 -18 -30 a18 18 0 0 1 36 0 q0 10 -18 30z", RED) + T(32, 33, "?", 18, WHITE),
  "ọ̀tún": R(6, 6, 52, 52, "#eae4f5", 10) + arrow(14, 32, 50, 32, PURPLE, 5),
  "òsì": R(6, 6, 52, 52, "#eae4f5", 10) + arrow(50, 32, 14, 32, PURPLE, 5),
  "tààrà": R(6, 6, 52, 52, "#eae4f5", 10) + arrow(32, 50, 32, 14, PURPLE, 5),
  "níbí": at(32, 22, 1, P("M0 22 q-14 -14 -14 -22 a14 14 0 0 1 28 0 q0 8 -14 22z", RED), C(0, 0, 5, WHITE)) + arrow(32, 58, 32, 50, INK, 2.5),
  "níbẹ̀": person({ x: 14, k: 0.7, y: 44, shirt: GREY }) + L(24, 44, 40, 44, GREY, 2) + at(50, 34, 0.8, P("M0 22 q-14 -14 -14 -22 a14 14 0 0 1 28 0 q0 8 -14 22z", RED), C(0, 0, 5, WHITE)),
  "jìn": person({ x: 10, k: 0.6, y: 44, shirt: SKY }) + P("M18 44 H46", "none", { stroke: GREY, "stroke-width": 2, "stroke-dasharray": "3 4", "stroke-linecap": "round" }) + house(52, 46, 0.5),

  // time
  "ọjọ́": sun(32, 24, 11) + R(10, 46, 44, 10, SAGE, 3) ,
  "òní": R(10, 10, 44, 46, WHITE, 6, { stroke: LGREY, "stroke-width": 1.5 }) + R(10, 10, 44, 12, CORAL, 6) + C(32, 40, 9, SAGE) + check(32, 40, WHITE),
  "ọ̀la": sun(18, 26, 8) + arrow(30, 40, 56, 40, INK, 3) + C(48, 22, 8, "#cde6f7") ,
  "àná": sun(46, 26, 8) + arrow(34, 40, 8, 40, GREY, 3) + C(16, 22, 8, "#eee"),
  "àárọ̀": P("M8 44 a24 24 0 0 1 48 0z", ORANGE) + R(4, 44, 56, 12, SAGE) + sun(32, 22, 0.01) + [-50, -25, 0, 25, 50].map((d) => G(`rotate(${d} 32 44)`, L(32, 14, 32, 8, YELLOW, 3))).join(""),
  "ọ̀sán": sun(32, 26, 13) + R(8, 50, 48, 6, SAGE, 3),
  "ìrọ̀lẹ́": P("M8 44 a24 24 0 0 1 48 0z", CORAL) + R(4, 44, 56, 12, "#2f5d50") + L(14, 40, 50, 40, "#f6b26b", 2),
  "òru": R(0, 0, 64, 64, "#2b2f5b", 12) + C(26, 28, 14, YELLOW) + C(32, 24, 12, "#2b2f5b") + C(48, 14, 2, WHITE) + C(50, 40, 1.8, WHITE) + C(14, 48, 1.8, WHITE) + C(40, 52, 2, WHITE),
  "ọ̀sẹ̀": [0, 1, 2, 3, 4, 5, 6].map((i) => R(4 + i * 8.2, 22, 7, 20, i === 6 ? CORAL : "#eae4f5", 2)).join(""),
  "oṣù": R(0, 0, 64, 64, "#2b2f5b", 12) + C(30, 32, 18, "#f7e8a6") + C(38, 28, 15, "#2b2f5b") + C(48, 14, 1.8, WHITE) + C(50, 44, 1.8, WHITE),
  "ọdún": R(8, 10, 48, 46, WHITE, 6, { stroke: LGREY, "stroke-width": 1.5 }) + R(8, 10, 48, 12, SKY, 6) + T(32, 46, "365", 14, SKY),
  "wákàtí": clock(32, 32, 20, 0.5, 3.14),
  "nísinsìnyí": clock(32, 32, 20, 1.0, 0) + P("M32 8 l-3 -5 h6z", CORAL),
  "ọjọ́ ajé": week(0), "ọjọ́ ìṣẹ́gun": week(1), "ọjọ́rú": week(2), "ọjọ́bọ̀": week(3), "ọjọ́ ẹtì": week(4), "ọjọ́ àbámẹ́ta": week(5), "ọjọ́ àìkú": week(6),

  // feelings & health
  "ara": person({ shirt: PURPLE, k: 1.05, arms: [[-7, -11, -13, -2], [7, -11, 13, -2]] }) + [[16, 18], [48, 18], [14, 46], [50, 46]].map(([a, b]) => S(`M${a - 2} ${b} l4 0`, SAGE, 2)).join(""),
  "orí": person({ shirt: SKY, k: 1.1, y: 42, arms: [[-7, -11, -5, -22], [7, -11, 5, -22]] }) + S("M14 12 l5 4 l-5 4 M50 12 l-5 4 l5 4", RED, 2.5),
  "ikùn": person({ shirt: SKY, arms: [[-7, -11, -2, -2], [7, -11, 2, -2]] }) + S("M24 26 l4 3 l-4 3 M40 26 l-4 3 l4 3", RED, 2.2),
  "ebi": bowl(32, 34, 1.3, WHITE, "") + S("M22 18 q10 -8 20 0", GREY, 2.2) + at(32, 12, 1, S("M-6 0 q6 -6 12 0", GREY, 2)),
  "òùngbẹ": P("M18 14 h28 l-3 36 q0 4 -4 4 h-14 q-4 0 -4 -4z", "#eaf6fd", { stroke: WATER, "stroke-width": 2 }) + P("M30 54 q-2 -6 2 -10 q4 4 2 10z", WATER) + S("M24 22 l16 0", GREY, 1.5),
  "oorun": person({ shirt: SKY, k: 0.8, y: 46, arms: [[-7, -11, -9, 2], [7, -11, 9, 2]] }) + T(46, 22, "Z", 14, PURPLE) + T(54, 14, "z", 11, PURPLE),
  "àìsàn": P("M26 6 h12 v34 a10 10 0 1 1 -12 0z", WHITE, { stroke: LGREY, "stroke-width": 2 }) + C(32, 46, 6.5, RED) + R(30, 18, 4, 26, RED),
  "oògùn": R(10, 20, 24, 12, CORAL, 6, { transform: "rotate(-30 22 26)" }) + R(30, 34, 24, 12, WHITE, 6, { stroke: LGREY, "stroke-width": 1.5, transform: "rotate(20 42 40)" }) + C(18, 48, 6, SAGE),
  "dókítà": person({ shirt: WHITE, kind: "woman", skin: SK[1], arms: [[-7, -11, -10, 2], [7, -11, 10, 2]] }) + cross(46, 16, 0.7),
  "dùn": C(32, 32, 22, YELLOW) + C(24, 27, 2.4, INK) + C(40, 27, 2.4, INK) + S("M22 37 q10 9 20 0", INK, 3),
  "dára": C(32, 32, 22, SAGE) + check(32, 32, WHITE),
  "ayọ̀": C(32, 32, 22, YELLOW) + S("M22 28 q3 -4 6 0 M36 28 q3 -4 6 0", INK, 2.5) + P("M20 36 q12 16 24 0z", INK) + heart(50, 12, 0.7),

  // verbs
  "lọ": person({ x: 24, shirt: SKY, arms: [[-7, -11, -12, -4], [7, -11, 12, 0]] }) + arrow(36, 32, 58, 32, INK, 3),
  "wá": person({ x: 42, shirt: SKY, flip: true, arms: [[-7, -11, -12, -4], [7, -11, 12, 0]] }) + arrow(24, 32, 4, 32, INK, 3),
  "jẹ": person({ shirt: CORAL, arms: [[-7, -11, -10, 2], [7, -11, 3, -17]] }) + bowl(48, 42, 0.8, WHITE, C(0, -2, 8, "#f4e6c8")),
  "mu": person({ shirt: SKY, arms: [[-7, -11, -10, 2], [7, -11, 4, -19]] }) + P("M3 -21 h8 l-1 9 h-6z", WATER, { transform: "translate(32 38) scale(1)" }),
  "rà": person({ x: 20, shirt: PURPLE, kind: "woman", arms: [[-7, -11, -10, 2], [7, -11, 16, -6]] }) + coin(42, 26, 5) + R(44, 30, 14, 14, "#c9955d", 2) + C(51, 28, 4, GREEN),
  "tà": R(6, 28, 36, 26, "#c9955d", 2) + P("M4 28 L8 16 H40 L44 28z", CORAL) + C(16, 36, 5, ORANGE) + C(28, 36, 5, GREEN) + coin(52, 22, 6) + arrow(44, 30, 50, 26, INK, 2),
  "rí": E(32, 32, 24, 14, WHITE, { stroke: INK, "stroke-width": 2.5 }) + C(32, 32, 9, SKY) + C(32, 32, 4, INK),
  "gbọ́": P("M24 20 a12 12 0 1 1 20 8 q-6 6 -6 12 a7 7 0 0 1 -14 0", "none", { stroke: SK[2], "stroke-width": 6, "stroke-linecap": "round" }) + S("M48 20 q5 5 0 12 M53 15 q9 11 0 22", GREY, 2.2),
  "mọ̀": person({ shirt: SKY, y: 44, k: 0.95 }) + C(32, 8, 7, YELLOW) + R(29, 14, 6, 4, GREY, 1) + [-40, 0, 40].map((d) => G(`rotate(${d} 32 8)`, L(32, -2, 32, -5, YELLOW, 2))).join(""),
  "fẹ́": person({ x: 22, shirt: PURPLE, kind: "woman", arms: [[-7, -11, -10, 2], [7, -11, 16, -12]] }) + heart(50, 24, 1.3) + C(50, 44, 7, ORANGE),
  "ní": person({ shirt: SAGE, arms: [[-7, -11, -4, -3], [7, -11, 4, -3]] }) + coin(32, 30, 6),
  "sùn": R(6, 40, 52, 10, SKY, 3) + E(16, 36, 7, 5, WHITE) + C(18, 34, 5, SK[0]) + R(24, 33, 30, 8, PURPLE, 4) + T(46, 22, "Z", 14, PURPLE) + T(54, 13, "z", 11, PURPLE),
  "jí": sun(46, 16, 7) + person({ shirt: SKY, k: 1, arms: [[-7, -11, -14, -22], [7, -11, 14, -22]] }),
  "kọ́": person({ shirt: SKY, kind: "woman", skin: SK[1], y: 40, k: 0.9, x: 22 }) + book(46, 30, 1) + arrow(36, 20, 46, 26, GREY, 2),
  "sọ": person({ shirt: CORAL, x: 22, arms: [[-7, -11, -10, 2], [7, -11, 12, -14]] }) + speech(46, 18, 26, 18) + S("M39 18 h14 M39 22 h9", GREY, 1.8),
  "kàwé": book(32, 34, 1.9),
  "kọ̀wé": R(12, 16, 32, 40, WHITE, 3, { stroke: LGREY, "stroke-width": 1.5 }) + S("M18 26 h20 M18 34 h20 M18 42 h12", LGREY, 2) + P("M40 40 l14 -14 l6 6 l-14 14 l-8 2z", MUSTARD) + P("M32 48 l8 -2 l-6 -6z", "#f2dcc7"),
  "ṣiṣẹ́": person({ shirt: MUSTARD, x: 24, arms: [[-7, -11, -10, 2], [7, -11, 15, -14]] }) + R(40, 22, 14, 7, GREY, 2, { transform: "rotate(-30 47 25)" }) + L(36, 40, 54, 16, BROWN, 3),
  "dúró": person({ shirt: SKY, x: 24, arms: [[-7, -11, -10, 2], [7, -11, 14, -22]] }) + C(48, 24, 11, RED) + R(41, 22, 14, 4, WHITE, 1),
  "gbé": house(24, 36, 1.0) + person({ x: 48, k: 0.8, shirt: SAGE, y: 42 }) + L(34, 46, 40, 46, GREY, 2),
  "lè": person({ shirt: CORAL, arms: [[-7, -11, -13, -18], [7, -11, 13, -18]] }) + check(52, 14, GREEN) ,
  "ń": person({ x: 26, shirt: SKY, arms: [[-7, -11, -12, -4], [7, -11, 12, 0]] }) + S("M42 24 h12 M44 32 h12 M42 40 h12", GREY, 2.5),
  "ti": clock(22, 32, 13, 0.5, 3.14) + check(48, 30, GREEN),
  "máa": clock(20, 34, 12, 0.5, 1.5) + arrow(34, 34, 58, 34, PURPLE, 3.5),
  "kò": C(32, 32, 21, "none", { stroke: RED, "stroke-width": 5 }) + L(17, 47, 47, 17, RED, 5),

  // questions
  "kí": R(14, 16, 36, 32, "#eae4f5", 8) + q(32, 42, 1.6),
  "ta": person({ shirt: GREY, k: 0.95 }) + q(50, 20, 1.1),
  "báwo": person({ x: 24, shirt: SKY, arms: [[-7, -11, -10, 2], [7, -11, 13, -12]] }) + q(48, 36, 1.5),
  "mélòó": dots(6, 26, 36, 4.5, SKY) + q(52, 30, 1.4),
  "èló": coin(22, 34, 10) + q(48, 40, 1.5),
  "èwo": C(18, 36, 9, ORANGE) + C(34, 36, 9, GREEN) + q(52, 38, 1.4),
  "nígbà wo": clock(26, 34, 17, 0.5, 2.6) + q(54, 32, 1.4),
  "ṣé": speech(32, 28, 40, 28, "#eae4f5") + q(32, 38, 1.5),
  "èyí": R(10, 30, 22, 22, ORANGE, 4) + arrow(21, 14, 21, 26, INK, 3),
  "ìyẹn": R(36, 30, 20, 20, ORANGE, 4) + person({ x: 14, k: 0.7, y: 44, shirt: SKY, arms: [[-7, -11, -10, 2], [7, -11, 20, -14]] }) + arrow(30, 22, 44, 26, INK, 2.5),

  // sentences (a few scenes)
  "Ẹ káàárọ̀.": sun(46, 18, 9) + person({ x: 22, k: 0.95, shirt: SKY, arms: [[-7, -11, -10, 2], [7, -11, 15, -18]] }) + P("M4 58 h56", "none", { stroke: SAGE, "stroke-width": 4 }),
  "Ẹ káàsán.": sun(32, 14, 8) + person2({ arms: [[-7, -11, -10, 2], [7, -11, 14, -16]] }, {}),
  "Ẹ kúùrọ̀lẹ́.": P("M4 34 a28 28 0 0 1 56 0z", "#f6b26b") + person2({}, {}),
  "Ó dàárọ̀.": R(0, 0, 64, 64, "#2b2f5b", 12) + C(46, 16, 7, YELLOW) + person({ x: 24, y: 44, k: 0.8, shirt: PURPLE, arms: [[-7, -11, -10, 2], [7, -11, 12, -14]] }) + T(44, 38, "Z", 12, WHITE),
  "Ó dàbọ̀.": person({ x: 22, shirt: SKY, arms: [[-7, -11, -10, 2], [7, -11, 15, -20]] }) + arrow(36, 30, 58, 30, INK, 3),
  "Báwo ni?": person2({}, {}) + q(32, 16, 1.2),
  "Ṣé àlàáfíà ni?": person({ x: 22, shirt: SKY }) + speech(46, 18, 24, 16) + T(46, 23, "?", 14, PURPLE) + C(46, 44, 9, YELLOW) + S("M42 44 q4 4 8 0", INK, 1.8),
  "Mo wà dáadáa, ẹ ṣé.": person({ shirt: SAGE, arms: [[-7, -11, -10, 2], [7, -11, 15, -17]] }) + heart(50, 18, 1.1),
  "Kí ni orúkọ rẹ?": person({ x: 22, shirt: SKY }) + R(36, 18, 22, 16, WHITE, 3, { stroke: LGREY, "stroke-width": 1.5 }) + q(47, 31, 0.9),
  "Orúkọ mi ni Adé.": person({ shirt: CORAL, arms: [[-7, -11, -10, 2], [7, -11, 1, -6]] }) + R(36, 18, 24, 14, WHITE, 3, { stroke: LGREY, "stroke-width": 1.5 }) + T(48, 29, "Adé", 9),
  "Inú mi dùn láti pàdé rẹ.": person2({ arms: [[-7, -11, 6, -2], [7, -11, 10, 2]] }, { arms: [[-7, -11, -6, -2], [7, -11, 10, 2]] }) + heart(32, 12, 0.9),
  "Ẹ kú iṣẹ́.": person({ x: 22, shirt: MUSTARD, arms: [[-7, -11, -10, 2], [7, -11, 15, -14]] }) + L(36, 40, 54, 16, BROWN, 3) + R(44, 16, 14, 7, GREY, 2, { transform: "rotate(-30 51 20)" }),
  "Mo jẹ́ akẹ́kọ̀ọ́.": person({ shirt: SKY, arms: [[-7, -11, -4, -4], [7, -11, 4, -4]], held: book(0, -4, 0.7, false) }),
  "Mo wà ní ilé.": house(40, 36, 1.0) + person({ x: 14, k: 0.8, y: 42 }),
  "Ibo ni o wà?": person({ x: 20, shirt: SKY, k: 0.9 }) + q(46, 30, 1.5),
  "Ìdílé wa tóbi.": person({ x: 14, k: 0.6, shirt: SKY, y: 40 }) + person({ x: 28, k: 0.6, kind: "woman", shirt: PURPLE, y: 40, skin: SK[1] }) + person({ x: 40, k: 0.5, kind: "child", shirt: MUSTARD, y: 42 }) + person({ x: 52, k: 0.5, kind: "child", shirt: CORAL, y: 42 }) + heart(32, 10, 0.8),
  "Mo ní ọmọ méjì.": person({ x: 20, shirt: SKY }) + person({ x: 40, kind: "child", y: 42, shirt: MUSTARD, k: 0.8 }) + person({ x: 54, kind: "child", y: 42, shirt: CORAL, k: 0.8 }),
  "Mo ní ọmọ mẹ́ta.": person({ x: 14, shirt: SKY, k: 0.9 }) + person({ x: 32, kind: "child", y: 42, shirt: MUSTARD, k: 0.7 }) + person({ x: 44, kind: "child", y: 42, shirt: CORAL, k: 0.7 }) + person({ x: 56, kind: "child", y: 42, shirt: SAGE, k: 0.7 }),
  "Èló ni èyí?": R(10, 28, 22, 22, ORANGE, 4) + q(46, 34, 1.4) + coin(50, 48, 6),
  "Ó wọ́n jù.": R(14, 24, 24, 24, ORANGE, 4) + coin(48, 22, 7) + coin(48, 36, 7) + coin(48, 50, 7) + S("M8 12 l8 6", RED, 2.5),
  "Mo fẹ́ ra ìrẹsì.": person({ x: 20, shirt: PURPLE, kind: "woman" }) + bowl(48, 40, 0.9, SKY, C(0, -2, 8, WHITE)) + coin(44, 18, 5),
  "Mo fẹ́ jẹun.": person({ shirt: CORAL, arms: [[-7, -11, -10, 2], [7, -11, 3, -17]] }) + bowl(48, 42, 0.8, WHITE, C(0, -2, 8, "#f4e6c8")),
  "Ṣé o fẹ́ mu omi?": person({ x: 22, shirt: SKY, arms: [[-7, -11, -10, 2], [7, -11, 14, -8]] }) + P("M44 14 h12 l-2 22 q0 3 -3 3 h-2 q-3 0 -3 -3z", WATER) + q(36, 16, 0.9),
  "Mo ń lọ sí ọjà.": person({ x: 20, shirt: SKY, arms: [[-7, -11, -12, -4], [7, -11, 12, 0]] }) + arrow(34, 36, 40, 36, INK, 2) + at(50, 36, 0.55, R(-18, -2, 36, 22, PAPER), P("M-20 -2 L-16 -16 H16 L20 -2z", CORAL)),
  "Ibo ni ọjà wà?": at(44, 40, 0.7, R(-18, -2, 36, 22, PAPER), P("M-20 -2 L-16 -16 H16 L20 -2z", CORAL)) + person({ x: 16, k: 0.8, y: 42, shirt: SKY }) + q(30, 20, 1.3),
  "Ibo ni ilé-ìwòsàn wà?": at(46, 40, 0.7, R(-18, -8, 36, 26, WHITE, 3), cross(0, 4, 1)) + person({ x: 16, k: 0.8, y: 42, shirt: SKY }) + q(30, 20, 1.3),
  "Yà sí òsì.": R(6, 6, 52, 52, "#eae4f5", 10) + S("M32 54 V32 H14", PURPLE, 6) + P("M8 32 l10 -8 v16z", PURPLE),
  "Dúró níbí.": person({ x: 22, shirt: SKY, arms: [[-7, -11, -10, 2], [7, -11, 14, -22]] }) + C(48, 24, 11, RED) + R(41, 22, 14, 4, WHITE, 1),
  "Mo wá láti Èkó.": person({ x: 18, shirt: SAGE, k: 0.9 }) + arrow(30, 36, 56, 36, INK, 2.5),
  "Ọjọ́ wo ni òní?": R(10, 10, 44, 46, WHITE, 6, { stroke: LGREY, "stroke-width": 1.5 }) + R(10, 10, 44, 12, CORAL, 6) + q(32, 48, 1.6),
  "Mo máa rí ọ ní ọ̀la.": person({ x: 20, shirt: SKY, k: 0.9 }) + arrow(32, 26, 44, 26, INK, 2.5) + sun(52, 20, 6),
  "Nígbà wo?": clock(32, 30, 18, 0.5, 2.6) + q(54, 14, 1),
  "Ó ti pẹ́.": clock(32, 32, 20, 5.8, 0.2) + S("M12 14 l-4 -4 M52 14 l4 -4", RED, 2.5),
  "Inú mi dùn.": C(32, 32, 22, YELLOW) + C(24, 27, 2.4, INK) + C(40, 27, 2.4, INK) + S("M22 37 q10 9 20 0", INK, 3),
  "Inú bí mi.": C(32, 32, 22, CORAL) + S("M20 22 l9 4 M44 22 l-9 4", INK, 3) + C(25, 30, 2.4, INK) + C(39, 30, 2.4, INK) + S("M23 44 q9 -7 18 0", INK, 3),
  "Ó rẹ̀ mí.": person({ shirt: SKY, arms: [[-7, -11, -10, 4], [7, -11, 10, 4]] }) + S("M18 10 q4 -4 8 0", GREY, 2) + T(48, 16, "…", 16, GREY),
  "Ara mi yá.": person({ shirt: SAGE, arms: [[-7, -11, -13, -18], [7, -11, 13, -18]] }) + heart(50, 14, 0.9),
  "Ara mi kò yá.": person({ shirt: GREY, k: 0.95 }) + at(48, 16, 1, P("M-4 -8 h8 v22 a6 6 0 1 1 -8 0z", WHITE, { stroke: LGREY, "stroke-width": 1.6 }), C(0, 14, 4, RED)),
  "Ebi ń pa mí.": bowl(32, 36, 1.3, WHITE, "") + at(32, 14, 1, S("M-8 0 q8 -8 16 0", GREY, 2)),
  "Òùngbẹ ń gbẹ mí.": P("M18 14 h28 l-3 36 q0 4 -4 4 h-14 q-4 0 -4 -4z", "#eaf6fd", { stroke: WATER, "stroke-width": 2 }),
  "Oorun ń run mí.": person({ shirt: SKY, k: 0.8, y: 46 }) + T(46, 22, "Z", 14, PURPLE) + T(54, 13, "z", 11, PURPLE),
  "Orí ń fọ́ mi.": person({ shirt: SKY, k: 1.1, y: 42, arms: [[-7, -11, -5, -22], [7, -11, 5, -22]] }) + S("M14 12 l5 4 l-5 4 M50 12 l-5 4 l5 4", RED, 2.5),
  "Ikùn ń dùn mí.": person({ shirt: SKY, arms: [[-7, -11, -2, -2], [7, -11, 2, -2]] }) + S("M24 26 l4 3 l-4 3 M40 26 l-4 3 l4 3", RED, 2.2),
  "Mo fẹ́ rí dókítà.": person({ x: 18, shirt: SKY }) + person({ x: 46, shirt: WHITE, kind: "woman", skin: SK[1], k: 0.95 }) + cross(46, 10, 0.55),
  "Mo ń jẹun.": person({ shirt: CORAL, arms: [[-7, -11, -10, 2], [7, -11, 3, -17]] }) + bowl(48, 42, 0.8, WHITE, C(0, -2, 8, "#f4e6c8")),
  "Mo ti jẹun.": person({ x: 22, shirt: CORAL, arms: [[-7, -11, -10, 4], [7, -11, 10, 4]] }) + bowl(50, 44, 0.7, WHITE, "") + check(48, 20, GREEN),
  "Mo máa lọ sí ọjà ní ọ̀la.": person({ x: 16, shirt: SKY, k: 0.85 }) + arrow(28, 32, 38, 32, INK, 2) + at(50, 40, 0.5, R(-18, -2, 36, 22, PAPER), P("M-20 -2 L-16 -16 H16 L20 -2z", CORAL)) + sun(48, 12, 5),
  "Mi ò mọ̀.": person({ shirt: GREY, arms: [[-7, -11, -14, -4], [7, -11, 14, -4]] }) + q(50, 16, 1.2),
  "Kò wá.": person({ x: 18, shirt: GREY, k: 0.8, y: 42 }) + cross2(46, 28, RED),
  "Ó ń kàwé.": person({ x: 22, shirt: PURPLE, kind: "woman" }) + book(48, 36, 1.1),
  "Wọ́n ń bọ̀.": person({ x: 44, shirt: SKY, flip: true, k: 0.85 }) + person({ x: 56, shirt: SAGE, flip: true, k: 0.7, y: 40 }) + arrow(32, 30, 12, 30, INK, 2.5),
  "Mo lè sọ Yorùbá díẹ̀.": person({ x: 22, shirt: CORAL, arms: [[-7, -11, -10, 2], [7, -11, 12, -14]] }) + speech(46, 18, 26, 18),
  "Ó yé mi.": person({ shirt: SKY, y: 44, k: 0.95 }) + C(32, 8, 7, YELLOW) + R(29, 14, 6, 4, GREY, 1),
  "Kò yé mi.": person({ shirt: GREY, arms: [[-7, -11, -14, -4], [7, -11, 14, -4]] }) + q(50, 16, 1.2),
  "Kí ni èyí?": R(10, 28, 22, 22, ORANGE, 4) + q(46, 40, 1.6),
  "Ta ni èyí?": person({ shirt: GREY, k: 0.95 }) + q(50, 20, 1.1),
  "Ṣé o mọ̀?": person({ x: 22, shirt: SKY, arms: [[-7, -11, -10, 2], [7, -11, 14, -8]] }) + C(48, 22, 7, YELLOW) + q(48, 29, 0.6),
  "Mo ń kàwé.": person({ x: 22, shirt: SKY }) + book(48, 36, 1.1),
  "Mo ń kọ̀wé.": R(12, 16, 32, 40, WHITE, 3, { stroke: LGREY, "stroke-width": 1.5 }) + S("M18 26 h20 M18 34 h20", LGREY, 2) + P("M40 40 l14 -14 l6 6 l-14 14 l-8 2z", MUSTARD),
  "Mo ń sùn.": R(6, 40, 52, 10, SKY, 3) + C(18, 34, 5, SK[0]) + R(24, 33, 30, 8, PURPLE, 4) + T(46, 22, "Z", 14, PURPLE),
  "Mo ń kọ́ Yorùbá.": person({ x: 20, shirt: SKY }) + book(46, 36, 1.1) + heart(48, 14, 0.8),
  "Ó ń ṣiṣẹ́.": person({ x: 24, shirt: MUSTARD, arms: [[-7, -11, -10, 2], [7, -11, 15, -14]] }) + L(36, 40, 54, 16, BROWN, 3),
  "Wọ́n ń jẹun.": person({ x: 20, shirt: CORAL, k: 0.8 }) + person({ x: 46, kind: "woman", shirt: PURPLE, k: 0.8, skin: SK[1] }) + bowl(33, 50, 0.7, WHITE, C(0, -2, 8, "#f4e6c8")),
  "Mo ti dé.": person({ x: 22, shirt: SKY }) + house(48, 40, 0.8) + check(20, 12, GREEN),
  "Ó ti lọ.": house(18, 40, 0.8) + arrow(30, 32, 58, 32, GREY, 3) + check(44, 14, GREEN),
  "Ẹ wá síbí.": person({ x: 44, shirt: SKY, flip: true, arms: [[-7, -11, -12, -4], [7, -11, 14, -16]] }) + arrow(24, 32, 4, 32, INK, 3),
  "Mo ní ẹyin mẹ́fà.": dots(6, 32, 30, 5, EGG) + person({ x: 52, k: 0.5, y: 52, shirt: SKY }),
  "Mo rà ẹyin mẹ́fà.": E(32, 36, 22, 14, "#c9955d") + [[18, 30], [28, 28], [38, 28], [46, 31], [24, 38], [38, 38]].map(([a, b]) => E(a, b, 4.5, 6, EGG, { stroke: "#cdbf9f", "stroke-width": 1.2 })).join(""),
  "Mo fẹ́ ẹja mẹ́ta.": E(22, 22, 12, 7, SKY) + E(40, 34, 12, 7, SKY) + E(22, 46, 12, 7, SKY),
  "Mo fẹ́ ẹyin méjì.": dots(2, 32, 32, 9, EGG),
  "Èló ni ẹja yìí?": E(26, 36, 17, 10, SKY) + P("M42 36 l10 -8 v16z", SKY) + q(52, 18, 1.2) + coin(52, 50, 5),
  "Ata yìí gbóná.": P("M26 14 q4 -4 8 0 q14 6 8 24 q-4 12 -10 14 q-12 -6 -14 -22 q0 -10 8 -16z", RED) + S("M44 14 q4 -6 0 -10 M50 18 q4 -6 0 -10", ORANGE, 2.5),
  "Ibo ni ilé rẹ wà?": house(44, 40, 0.9) + person({ x: 16, k: 0.8, y: 42, shirt: SKY }) + q(30, 20, 1.3),
  "Ilé wa wà ní Èkó.": house(32, 38, 1.4),
  "Òní ni Ọjọ́ Àbámẹ́ta.": week(5),
  "Mo ń lọ sí ilé-ìwé ní àárọ̀.": P("M8 30 a24 24 0 0 1 48 0z", ORANGE, { opacity: 0.5 }) + person({ x: 18, kind: "child", y: 44, shirt: SKY, k: 0.9 }) + at(46, 38, 0.6, R(-18, -2, 36, 24, "#e9c46a"), P("M-22 -2 L0 -18 L22 -2z", CORAL)),
  "Mo sùn ní òru.": R(0, 0, 64, 64, "#2b2f5b", 12) + C(48, 14, 6, YELLOW) + R(8, 42, 48, 8, SKY, 3) + C(18, 38, 5, SK[0]) + R(24, 37, 28, 7, PURPLE, 4) + T(40, 28, "Z", 12, WHITE),
  "Ọ̀sẹ̀ kan ní ọjọ́ méje.": [0, 1, 2, 3, 4, 5, 6].map((i) => R(4 + i * 8.2, 22, 7, 20, i === 6 ? CORAL : "#eae4f5", 2)).join(""),
  "Mo máa wá ní ọ̀la.": person({ x: 44, shirt: SKY, flip: true, k: 0.9 }) + arrow(26, 32, 8, 32, INK, 2.5) + sun(16, 14, 6),
  "Báwo ni ẹbí?": person({ x: 14, k: 0.6, shirt: SKY, y: 42 }) + person({ x: 28, k: 0.6, kind: "woman", shirt: PURPLE, y: 42, skin: SK[1] }) + person({ x: 40, k: 0.5, kind: "child", shirt: MUSTARD, y: 44 }) + q(54, 30, 1.2),
  "Ẹ ṣé o.": person({ shirt: PURPLE, arms: [[-7, -11, 2, -6], [7, -11, 2, -6]] }) + heart(48, 16, 1.2),
};

/** Draw a week strip with one day highlighted (0 = Monday … 6 = Sunday), used for the day names. */
function week(i) {
  const x = (n) => 4 + n * 8.2;
  return [0, 1, 2, 3, 4, 5, 6].map((n) => R(x(n), 16, 7, 26, n === i ? CORAL : "#cfc6e6", 2) + T(x(n) + 3.5, 54, "MTWTFSS"[n], 7.5, n === i ? CORAL : GREY)).join("");
}
// `week` is a function declaration, so it is available to the table above.

const MAP = new Map(Object.entries(RAW).map(([k, v]) => [lc(k), v]));
const svg = (inner, size) => `<svg class="pic" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

/** The picture for a course word or sentence (NFC, case-insensitive), as an <svg> string, or "" if there is none. */
export function pictureFor(text, size = 64) {
  const inner = MAP.get(lc(text || ""));
  return inner ? svg(inner, size) : "";
}
export const hasPicture = (text) => MAP.has(lc(text || ""));
export const pictureKeys = () => [...MAP.keys()];
