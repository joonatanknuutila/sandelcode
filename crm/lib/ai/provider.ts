// Model provider — the single place that talks to an LLM.
//
// Priority: Azure OpenAI → nothing. When no model is reachable the app still
// works: callers fall back to the deterministic, grounded logic in the rest of
// lib/ (summariseCase, nextBestAction, forecast narrative). So the demo stays
// live without creds and turns "real" the moment creds land — no UI or
// call-site changes.
//
// NOTE: The Google/Gemini transports (Vertex AI + the Gemini AI Studio API key)
// were removed after the hackathon so the project no longer consumes Google
// credits. Azure OpenAI remains as the optional model path; absent its env vars,
// complete() returns null and every caller degrades to the deterministic logic.
//
// --- Azure OpenAI -----------------------------------------------------------
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

function isAzureConfigured(): boolean {
  return Boolean(
    process.env.AZURE_OPENAI_ENDPOINT &&
      process.env.AZURE_OPENAI_API_KEY &&
      process.env.AZURE_OPENAI_DEPLOYMENT,
  );
}

export function isModelConfigured(): boolean {
  return isAzureConfigured();
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
  if (isAzureConfigured()) return completeAzure(messages, opts);
  return null;
}

// --- Azure OpenAI -----------------------------------------------------------

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
