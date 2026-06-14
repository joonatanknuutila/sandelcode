// Model provider — the single place that talks to an LLM.
//
// Priority: Vertex AI (Gemini, IAM) → Gemini API key (AI Studio) → Azure OpenAI
// → nothing. When no model is reachable the app still works: callers fall back
// to the deterministic, grounded logic in the rest of lib/ (summariseCase,
// nextBestAction, forecast narrative). So the demo stays live without creds and
// turns "real" the moment creds land — no UI or call-site changes.
//
// --- Vertex AI (Gemini) — preferred -----------------------------------------
// Vertex uses IAM, NOT an API key. Auth is Application Default Credentials:
//   LOCAL:  `gcloud auth application-default login` (one-time), then set
//           GOOGLE_VERTEX_PROJECT in .env.local. The Google SDK finds the creds.
//   VERCEL: ADC isn't available on serverless, so leave GOOGLE_VERTEX_PROJECT
//           unset there — Vertex is skipped and the next provider (Gemini API
//           key) handles prod. (To use Vertex on Vercel instead: a service-
//           account key or Workload Identity Federation, no code change here.)
// Env (.env.local, never hardcoded):
//   GOOGLE_VERTEX_PROJECT     e.g. ferrous-wonder-491213-e7  (or GOOGLE_CLOUD_PROJECT)
//   GOOGLE_VERTEX_LOCATION    default us-central1 (e.g. europe-west1 for EU)
//   GOOGLE_VERTEX_MODEL       default gemini-2.5-flash
//
// --- Gemini API key (AI Studio) — works on Vercel serverless ----------------
// A plain Gemini Developer API key needs no IAM, so unlike Vertex it runs on
// serverless. Same generateContent wire format as Vertex, different host/auth.
// This is the same endpoint + key enrich.ts uses for web-grounded calls.
//   GEMINI_API_KEY   server-only key (NEVER NEXT_PUBLIC_*). Absent => skipped.
//   GEMINI_MODEL     optional, default gemini-2.5-flash.
//
// --- Azure OpenAI — fallback ------------------------------------------------
//   AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY / AZURE_OPENAI_DEPLOYMENT
//   AZURE_OPENAI_API_VERSION  default 2024-08-01-preview
import "server-only";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompleteOptions {
  /** Lower = more deterministic. Defaults to 0.2 for grounded CRM answers. */
  temperature?: number;
  maxTokens?: number;
  /** Ask the model to return strict JSON. */
  json?: boolean;
}

function isVertexConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_VERTEX_PROJECT || process.env.GOOGLE_CLOUD_PROJECT,
  );
}

function isGeminiApiKeyConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function isAzureConfigured(): boolean {
  return Boolean(
    process.env.AZURE_OPENAI_ENDPOINT &&
      process.env.AZURE_OPENAI_API_KEY &&
      process.env.AZURE_OPENAI_DEPLOYMENT,
  );
}

export function isModelConfigured(): boolean {
  return (
    isVertexConfigured() || isGeminiApiKeyConfigured() || isAzureConfigured()
  );
}

/**
 * Run a chat completion. Returns the assistant text, or null when no model is
 * configured or the call fails — callers MUST handle null with a deterministic
 * fallback so the product never hard-depends on the model being up.
 */
export async function complete(
  messages: ChatMessage[],
  opts: CompleteOptions = {},
): Promise<string | null> {
  if (isVertexConfigured()) {
    return firstNonNull(modelCandidates(process.env.GOOGLE_VERTEX_MODEL), (m) =>
      completeVertex(messages, opts, m),
    );
  }
  if (isGeminiApiKeyConfigured()) {
    return firstNonNull(modelCandidates(process.env.GEMINI_MODEL), (m) =>
      completeGeminiApiKey(messages, opts, m),
    );
  }
  if (isAzureConfigured()) return completeAzure(messages, opts);
  return null;
}

const SAFETY_MODEL = "gemini-2.5-flash";
// Best model AVAILABLE on the prod Gemini Developer API key. gemini-2.5-pro 404s
// on this (free-tier) key and its quota is far tighter — defaulting to it took
// prod AI offline (404 → 429 RESOURCE_EXHAUSTED). Flash is the best served model
// here. To run pro, set GEMINI_MODEL=gemini-2.5-pro on a paid/Vertex key — the
// flash fallback below then covers any pro hiccup.
const DEFAULT_MODEL = "gemini-2.5-flash";

/** Quality-first with a safety net: try the configured model (default the more
 *  capable gemini-2.5-pro), then fall back to flash. So a pro hiccup — quota, or
 *  an empty thinking-only response — degrades to the proven flash rather than to
 *  the non-AI deterministic path. */
function modelCandidates(configured: string | undefined): string[] {
  const primary = configured ?? DEFAULT_MODEL;
  return primary === SAFETY_MODEL ? [primary] : [primary, SAFETY_MODEL];
}

async function firstNonNull(
  models: string[],
  run: (model: string) => Promise<string | null>,
): Promise<string | null> {
  for (const m of models) {
    const out = await run(m);
    if (out != null) return out;
  }
  return null;
}

// --- Gemini wire format (shared by Vertex + Gemini API key) ------------------

/** Build the generateContent request body. Both Gemini transports speak the
 *  same wire format; only the host + auth differ. */
function geminiBody(
  messages: ChatMessage[],
  opts: CompleteOptions,
  model: string,
) {
  // Gemini wants system text in `systemInstruction`, and roles "user"/"model".
  const systemText = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  // Thinking control differs by model family:
  //  • Gemini 3.x uses `thinkingLevel` (minimal|low|medium|high). The legacy
  //    `thinkingBudget` is NOT valid for 3.x and mixing the two is a hard 400.
  //    "low" keeps these grounded CRM answers fast/cheap (override:
  //    GEMINI_THINKING_LEVEL). Thinking tokens are billed against
  //    maxOutputTokens, so give the visible reply headroom.
  //  • Gemini 2.5 FLASH can disable thinking entirely (thinkingBudget 0).
  //  • Gemini 2.5 PRO requires thinking (budget 0 → 400); bound it + headroom.
  const isGemini3 = /gemini-3/.test(model);
  const supportsZeroThinking = !isGemini3 && /flash/.test(model);
  const isThinking25Pro =
    !isGemini3 && /gemini-2\.5/.test(model) && !supportsZeroThinking;
  const envBudget =
    process.env.GOOGLE_VERTEX_THINKING_BUDGET != null
      ? Number(process.env.GOOGLE_VERTEX_THINKING_BUDGET)
      : null;
  const baseMax = opts.maxTokens ?? 700;

  let thinkingConfig = {};
  let maxOutputTokens = baseMax;
  if (isGemini3) {
    // Gemini 3.x: thinkingLevel (not thinkingBudget). "low" is plenty for these
    // grounded tasks; give the visible reply headroom since thinking eats tokens.
    const level = process.env.GEMINI_THINKING_LEVEL ?? "low";
    thinkingConfig = { thinkingConfig: { thinkingLevel: level } };
    maxOutputTokens = Math.max(baseMax + 4096, 8192);
  } else if (supportsZeroThinking) {
    // Gemini 2.5 Flash: thinking off by default (fast/cheap). Overridable via
    // GOOGLE_VERTEX_THINKING_BUDGET.
    thinkingConfig = { thinkingConfig: { thinkingBudget: envBudget ?? 0 } };
  } else if (isThinking25Pro) {
    // Gemini 2.5 Pro: thinking is MANDATORY (budget 0 → 400). Bound it and give
    // the visible reply generous headroom on top.
    const budget = envBudget != null && envBudget > 0 ? envBudget : 2048;
    thinkingConfig = { thinkingConfig: { thinkingBudget: budget } };
    maxOutputTokens = Math.max(baseMax + budget + 1024, 8192);
  }

  return {
    ...(systemText
      ? { systemInstruction: { parts: [{ text: systemText }] } }
      : {}),
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      maxOutputTokens,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
      ...thinkingConfig,
    },
  };
}

/** Pull the text out of a generateContent response, or null when empty. */
function geminiText(data: {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}): string | null {
  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("");
  return text && text.length > 0 ? text : null;
}

// --- Gemini API key (AI Studio) ---------------------------------------------

/** Plain Gemini Developer API key — no IAM, so it runs on Vercel serverless.
 *  Same endpoint enrich.ts uses. Returns null (→ deterministic fallback) on any
 *  error so the product never hard-depends on the model. */
async function completeGeminiApiKey(
  messages: ChatMessage[],
  opts: CompleteOptions,
  model: string = process.env.GEMINI_MODEL ?? DEFAULT_MODEL,
): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify(geminiBody(messages, opts, model)),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.error("Gemini API error", res.status, await res.text());
      return null;
    }
    return geminiText(await res.json());
  } catch (err) {
    console.error("Gemini API call failed", err);
    return null;
  }
}

// --- Vertex AI (Gemini) -----------------------------------------------------

/** Mint a short-lived OAuth token from Application Default Credentials. Returns
 *  null (→ deterministic fallback) if ADC isn't available, e.g. the user hasn't
 *  run `gcloud auth application-default login`, or on Vercel. */
async function vertexAccessToken(): Promise<string | null> {
  try {
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({
      scopes: "https://www.googleapis.com/auth/cloud-platform",
    });
    const token = await auth.getAccessToken();
    return token ?? null;
  } catch (err) {
    console.error(
      "Vertex ADC unavailable — run `gcloud auth application-default login`",
      err,
    );
    return null;
  }
}

async function completeVertex(
  messages: ChatMessage[],
  opts: CompleteOptions,
  model: string = process.env.GOOGLE_VERTEX_MODEL ?? DEFAULT_MODEL,
): Promise<string | null> {
  const project =
    process.env.GOOGLE_VERTEX_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT!;
  const location = process.env.GOOGLE_VERTEX_LOCATION ?? "us-central1";

  const token = await vertexAccessToken();
  if (!token) return null;

  const host =
    location === "global"
      ? "aiplatform.googleapis.com"
      : `${location}-aiplatform.googleapis.com`;
  const url = `https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(geminiBody(messages, opts, model)),
      // Don't let a slow model wedge a request.
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.error("Vertex AI error", res.status, await res.text());
      return null;
    }
    return geminiText(await res.json());
  } catch (err) {
    console.error("Vertex AI call failed", err);
    return null;
  }
}

// --- Azure OpenAI (fallback) ------------------------------------------------

async function completeAzure(
  messages: ChatMessage[],
  opts: CompleteOptions,
): Promise<string | null> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT!.replace(/\/$/, "");
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT!;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-08-01-preview";
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.AZURE_OPENAI_API_KEY!,
      },
      body: JSON.stringify({
        messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 700,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.error("Azure OpenAI error", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.error("Azure OpenAI call failed", err);
    return null;
  }
}
