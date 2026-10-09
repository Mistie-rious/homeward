// Direct browser calls to the Claude API with structured JSON output.
// The API key lives only in this device's localStorage — never in the code or the backup file.
import { all, run } from "./db.js";
import { LS_PREFIX } from "./util.js";

const KEY = `${LS_PREFIX}api_key`;
const MODEL_KEY = `${LS_PREFIX}model`;

/** Models the learner can pick in Settings. Prices are USD per million tokens (Anthropic's published API prices). */
export const MODELS = {
  "claude-haiku-4-5": { label: "Haiku 4.5", input: 1, output: 5, blurb: "Cheapest and fastest; the default." },
  "claude-sonnet-5-5": { label: "Sonnet 5.5", input: 2, output: 10, blurb: "Better at less common Yoruba words and tones." },
  "claude-opus-5-5": { label: "Opus 5.5", input: 4, output: 20, blurb: "Most careful; best for corrections and doubts." },
};
export const DEFAULT_MODEL = "claude-haiku-4-5";

export const getModel = () => {
  try {
    const m = localStorage.getItem(MODEL_KEY);
    return MODELS[m] ? m : DEFAULT_MODEL;
  } catch { return DEFAULT_MODEL; }
};
export const setModel = (m) => {
  try { MODELS[m] ? localStorage.setItem(MODEL_KEY, m) : localStorage.removeItem(MODEL_KEY); } catch {}
};
/** USD for a call on `model` (unknown models are billed like the default so the meter never under-reports to zero). */
export const costOf = (model, inputTokens, outputTokens) => {
  const p = MODELS[model] || MODELS[DEFAULT_MODEL];
  return (inputTokens * p.input + outputTokens * p.output) / 1e6;
};

/** NFC-normalise every string in a parsed JSON value, so tone marks and underdots always compare equal. */
export function deepNfc(v) {
  if (typeof v === "string") return v.normalize("NFC");
  if (Array.isArray(v)) return v.map(deepNfc);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepNfc(x)]));
  return v;
}

/** Model-specific request fields. Haiku 4.5 reasons with budget_tokens; the 5.5 models only accept adaptive thinking (budget_tokens is a 400). */
function tune(body, { think = 0 } = {}) {
  const model = getModel();
  body.model = model;
  if (model === DEFAULT_MODEL) {
    if (think) {
      body.thinking = { type: "enabled", budget_tokens: think };
      body.max_tokens += think;
    }
  } else {
    body.thinking = { type: "adaptive" }; // thinking tokens count toward max_tokens, so leave room
    body.max_tokens += 3000;
    body.output_config = { ...body.output_config, effort: "medium" };
  }
  return body;
}

export const getKey = () => {
  try { return localStorage.getItem(KEY) || ""; } catch { return ""; }
};
export const setKey = (k) => {
  try { k ? localStorage.setItem(KEY, k.trim()) : localStorage.removeItem(KEY); } catch {}
};
export const hasKey = () => !!getKey();

export class ClaudeError extends Error {}

/** Structured outputs need additionalProperties:false and every property required, on every object. */
export function strict(schema) {
  if (schema.type === "object") {
    const props = Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, strict(v)]));
    return { ...schema, properties: props, required: Object.keys(props), additionalProperties: false };
  }
  if (schema.type === "array") return { ...schema, items: strict(schema.items) };
  return schema;
}

/**
 * One request; returns the parsed JSON object matching `schema`. `purpose` labels it in the usage meter.
 * `think` > 0 gives Claude that many tokens to reason before answering (billed as output).
 */
export async function structured({ system, user, schema, purpose = "other", maxTokens = 4000, think = 0 }) {
  const key = getKey();
  if (!key) throw new ClaudeError("No Claude API key (add one in Settings)");
  const body = tune({
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { format: { type: "json_schema", schema: strict(schema) } },
  }, { think });
  let { resp, data } = await send(key, body);
  if (think && body.thinking && resp.status === 400) {
    // Safety net: if thinking is ever rejected for this request, answer without it rather than fail.
    console.warn("Request with thinking rejected, retrying without", data?.error?.message);
    delete body.thinking;
    body.max_tokens = maxTokens;
    ({ resp, data } = await send(key, body));
  }
  if (!resp.ok) throw new ClaudeError(`Claude API ${resp.status}: ${data?.error?.message || resp.statusText}`);
  if (data.usage) logUsage(purpose, data.usage, body.model);
  if (data.stop_reason === "refusal") throw new ClaudeError("Claude declined this request");
  if (data.stop_reason === "max_tokens") throw new ClaudeError("Claude's answer was cut off");
  const text = data.content?.find((b) => b.type === "text")?.text;
  try {
    return deepNfc(JSON.parse(text));
  } catch {
    throw new ClaudeError("Claude returned something unreadable");
  }
}

/**
 * One turn of a free-text chat. `messages` are raw API messages; `tools` (optional) lets Claude ask us to do things.
 * Returns {text, content, toolUses}: `content` is the assistant message to append to the history as-is,
 * `toolUses` is [{id, name, input}] to run and answer with tool_result blocks.
 */
export async function converse({ system, messages, tools, purpose = "ask", maxTokens = 900 }) {
  const key = getKey();
  if (!key) throw new ClaudeError("No Claude API key (add one in Settings)");
  const body = tune({ max_tokens: maxTokens, system, messages });
  if (tools) body.tools = tools;
  const { resp, data } = await send(key, body);
  if (!resp.ok) throw new ClaudeError(`Claude API ${resp.status}: ${data?.error?.message || resp.statusText}`);
  if (data.usage) logUsage(purpose, data.usage, body.model);
  if (data.stop_reason === "refusal") throw new ClaudeError("Claude declined this request");
  const content = data.content || [];
  const text = content.filter((b) => b.type === "text").map((b) => b.text).join("").trim().normalize("NFC");
  const toolUses = content.filter((b) => b.type === "tool_use").map(({ id, name, input }) => ({ id, name, input }));
  if (!text && !toolUses.length) throw new ClaudeError("Claude returned an empty answer");
  return { text, content, toolUses };
}

async function send(key, body) {
  let resp;
  try {
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ClaudeError("Can't reach Claude (offline?)");
  }
  return { resp, data: await resp.json().catch(() => ({})) };
}

// ---------- usage meter ----------

function logUsage(purpose, u, model) {
  try {
    run("INSERT INTO llm_usage(purpose, model, input_tokens, output_tokens, created_at) VALUES (?,?,?,?,?)", [
      purpose, model, (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0), u.output_tokens || 0, Date.now(),
    ]);
  } catch (e) {
    console.warn("usage log failed", e);
  }
}

/** Spend since `since` (ms) grouped by purpose: [{purpose, calls, cost}] plus total. Each call is priced at the model it used. */
export function usageSince(since) {
  const rows = all(
    `SELECT purpose, model, COUNT(*) AS calls, SUM(input_tokens) AS inp, SUM(output_tokens) AS outp
     FROM llm_usage WHERE created_at >= ? GROUP BY purpose, model`,
    [since],
  );
  const byPurpose = new Map();
  for (const r of rows) {
    const cur = byPurpose.get(r.purpose) || { purpose: r.purpose, calls: 0, cost: 0 };
    cur.calls += r.calls;
    cur.cost += costOf(r.model, r.inp, r.outp);
    byPurpose.set(r.purpose, cur);
  }
  const out = [...byPurpose.values()].sort((a, b) => b.cost - a.cost);
  return { rows: out, total: out.reduce((s, r) => s + r.cost, 0) };
}
