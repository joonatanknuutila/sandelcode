// Model provider — the single place that talks to an LLM.
//
// Priority: Google Vertex AI (Gemini) when configured, else Azure OpenAI, else
// nothing. When no model is reachable the app still works: callers fall back to
// the deterministic, grounded logic in the rest of lib/ (summariseCase,
// nextBestAction, forecast narrative). So the demo stays live without creds and
// turns "real" the moment creds land — no UI or call-site changes.
//
// --- Vertex AI (Gemini) — preferred -----------------------------------------
// Vertex uses IAM, NOT an API key. Auth is Application Default Credentials:
//   LOCAL:  `gcloud auth application-default login` (one-time), then set
//           GOOGLE_VERTEX_PROJECT in .env.local. The Google SDK finds the creds.
//   VERCEL: ADC isn't available on serverless, so leave GOOGLE_VERTEX_PROJECT
//           unset there — complete() returns null and the deterministic
//           fallback renders. (To enable later: a service-account key or
//           Workload Identity Federation, no code change here.)
// Env (.env.local, never hardcoded):
//   GOOGLE_VERTEX_PROJECT     e.g. ferrous-wonder-491213-e7  (or GOOGLE_CLOUD_PROJECT)
//   GOOGLE_VERTEX_LOCATION    default us-central1 (e.g. europe-west1 for EU)
//   GOOGLE_VERTEX_MODEL       default gemini-2.5-flash
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

function isAzureConfigured(): boolean {
  return Boolean(
    process.env.AZURE_OPENAI_ENDPOINT &&
      process.env.AZURE_OPENAI_API_KEY &&
      process.env.AZURE_OPENAI_DEPLOYMENT,
  );
}

export function isModelConfigured(): boolean {
  return isVertexConfigured() || isAzureConfigured();
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
  if (isVertexConfigured()) return completeVertex(messages, opts);
  if (isAzureConfigured()) return completeAzure(messages, opts);
  return null;
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
): Promise<string | null> {
  const project =
    process.env.GOOGLE_VERTEX_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT!;
  const location = process.env.GOOGLE_VERTEX_LOCATION ?? "us-central1";
  const model = process.env.GOOGLE_VERTEX_MODEL ?? "gemini-2.5-flash";

  const token = await vertexAccessToken();
  if (!token) return null;

  const host =
    location === "global"
      ? "aiplatform.googleapis.com"
      : `${location}-aiplatform.googleapis.com`;
  const url = `https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;

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

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...(systemText
          ? { systemInstruction: { parts: [{ text: systemText }] } }
          : {}),
        contents,
        generationConfig: {
          temperature: opts.temperature ?? 0.2,
          maxOutputTokens: opts.maxTokens ?? 700,
          ...(opts.json ? { responseMimeType: "application/json" } : {}),
          // Gemini 2.5+ "thinks" by default, which eats the output budget (so a
          // small maxOutputTokens can return NO text) and adds latency. These
          // grounded CRM tasks don't need it — disable it (override with
          // GOOGLE_VERTEX_THINKING_BUDGET). Omitted for non-thinking models.
          ...(/gemini-(2\.5|3)/.test(model)
            ? {
                thinkingConfig: {
                  thinkingBudget: Number(
                    process.env.GOOGLE_VERTEX_THINKING_BUDGET ?? 0,
                  ),
                },
              }
            : {}),
        },
      }),
      // Don't let a slow model wedge a request.
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.error("Vertex AI error", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const text: string | undefined = data.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("");
    return text && text.length > 0 ? text : null;
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
