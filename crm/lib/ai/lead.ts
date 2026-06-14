import "server-only";
import { complete, isModelConfigured, type ChatMessage } from "@/lib/ai/provider";

export interface ParsedLeadContact {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
}

export interface ParsedLead {
  company: string;
  industry?: string;
  region?: string;
  website?: string;
  summary?: string;
  primaryContact?: ParsedLeadContact;
  modelUsed: boolean;
}

const SYSTEM_PROMPT =
  `You extract CRM account fields from pasted inbound B2B prospect email threads ` +
  `for HMD Secure. The text may include replies, forwards, signatures, quoted ` +
  `history, and HMD employees. Return strict JSON only. Do not invent missing ` +
  `facts. Prefer concise values.\n\n` +
  `Shape: {"company": string, "industry": string, "region": string, "website": string, ` +
  `"summary": string, "primaryContact": {"name": string, "title": string, "email": string, "phone": string}}\n\n` +
  `Rules:\n` +
  `- company is the customer/prospect organization, never HMD Secure and never a reseller unless the reseller is the actual account.\n` +
  `- When there are multiple messages, prioritize the newest external sender and the organization asking about HMD Secure.\n` +
  `- Ignore HMD employee signatures, disclaimers, quoted legal footers, and routing noise.\n` +
  `- industry should be one of Government, Defense, Healthcare, Finance, Energy, Enterprise when possible.\n` +
  `- region is country, market, or regional label mentioned by the sender.\n` +
  `- website must be a domain/URL found in the text.\n` +
  `- primaryContact is the external sender or named customer decision-maker in a professional capacity.\n` +
  `- summary is one sentence describing why they contacted HMD Secure.`;

/** Strip a ```json fence / surrounding prose and parse the first JSON object. */
function parseModelJson(text: string): unknown {
  const fenced = text.replace(/```(?:json)?/gi, "").trim();
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("no json object");
  return JSON.parse(fenced.slice(start, end + 1));
}

function clean(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}

function asContact(value: unknown): ParsedLeadContact | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const name = clean(raw.name);
  const email = clean(raw.email);
  if (!name && !email) return undefined;
  return {
    name: name ?? email ?? "",
    title: clean(raw.title),
    email,
    phone: clean(raw.phone),
  };
}

function normalize(parsed: unknown, modelUsed: boolean): ParsedLead {
  const raw = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  return {
    company: clean(raw.company) ?? "",
    industry: clean(raw.industry),
    region: clean(raw.region),
    website: clean(raw.website),
    summary: clean(raw.summary),
    primaryContact: asContact(raw.primaryContact),
    modelUsed,
  };
}

function deterministicFallback(text: string): ParsedLead {
  const emails = Array.from(
    text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi),
    (m) => m[0],
  );
  const email =
    emails.find((e) => !/@(?:hmd|hmdglobal|hmdsecure)\./i.test(e)) ?? emails[0];
  const domain = email?.split("@")[1];
  const website =
    text.match(/https?:\/\/[^\s)>,]+/i)?.[0] ??
    text.match(/\b(?:www\.)[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] ??
    (domain && !/(gmail|outlook|hotmail|icloud|yahoo)\./i.test(domain)
      ? `https://${domain}`
      : undefined);

  const company =
    text.match(/\b(?:company|organisation|organization|customer|from)\s*[:\-]\s*([^\n,]+)/i)?.[1]?.trim() ??
    text.match(/\bat\s+([A-Z][A-Za-z0-9&.' -]{2,80})(?:[\n,.]|$)/)?.[1]?.trim() ??
    domain
      ?.split(".")
      .slice(0, -1)
      .join(".")
      .replace(/[-_.]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) ??
    "";

  const name =
    text.match(/\b(?:regards|best|thanks|thank you),?\s*\n\s*([A-Z][A-Za-z.' -]{2,60})/i)?.[1]?.trim() ??
    text.match(/\b(?:name)\s*[:\-]\s*([^\n,]+)/i)?.[1]?.trim();

  const title = text.match(/\b(?:title|role)\s*[:\-]\s*([^\n,]+)/i)?.[1]?.trim();
  const phone = text.match(/(?:\+|00)[0-9][0-9 ()-]{6,}/)?.[0]?.trim();
  const region = text.match(/\b(?:country|region|market)\s*[:\-]\s*([^\n,]+)/i)?.[1]?.trim();
  const industry = /(defen[cs]e|military|armed forces)/i.test(text)
    ? "Defense"
    : /(government|ministry|police|public sector)/i.test(text)
      ? "Government"
      : /(hospital|healthcare|medical)/i.test(text)
        ? "Healthcare"
        : /(bank|finance|insurance)/i.test(text)
          ? "Finance"
          : /(energy|utility|grid)/i.test(text)
            ? "Energy"
            : undefined;

  return {
    company,
    industry,
    region,
    website,
    summary: text.trim().slice(0, 240),
    primaryContact:
      name || email
        ? {
            name: name ?? email ?? "",
            title,
            email,
            phone,
          }
        : undefined,
    modelUsed: false,
  };
}

export async function parseLead(text: string): Promise<ParsedLead> {
  const trimmed = text.trim();
  if (!trimmed) return { company: "", modelUsed: false };
  const fallback = deterministicFallback(trimmed);
  if (!isModelConfigured()) return fallback;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: trimmed },
  ];
  const response = await complete(messages, {
    temperature: 0.1,
    maxTokens: 700,
    json: true,
  });
  if (!response) return fallback;

  try {
    const parsed = normalize(parseModelJson(response), true);
    return {
      ...fallback,
      ...parsed,
      company: parsed.company || fallback.company,
      primaryContact: parsed.primaryContact ?? fallback.primaryContact,
      modelUsed: true,
    };
  } catch {
    return fallback;
  }
}
