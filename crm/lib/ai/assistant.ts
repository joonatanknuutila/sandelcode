// Per-persona assistant — "ask about your accounts/pipeline" (brief §05.03
// conversational query, e.g. "At-risk enterprise deals in DACH").
//
// GROUNDED: we hand the model only the facts for the relevant scope, and for a
// filtered pipeline question we PRE-FILTER the deals so the model physically
// cannot mention a deal that doesn't match the region/industry/risk asked for —
// hallucination minimisation is the #1 AI constraint. READ-ONLY: the assistant
// answers; it never writes. Any CRM change goes through the meeting->CRM
// approval gate (lib/ai/meeting.ts), never here. With no model key it falls back
// to the deterministic filter below, which produces the same grounded facts.

import { ChatMessage, complete } from "./provider";
import {
  getAccount,
  getAccounts,
  getAllCases,
  getContactsForAccount,
  getDealsForAccount,
  getNotesForCase,
  getOpenDeals,
  getServiceHistory,
  getUsers,
  isOverdue,
  isStalled,
  isAtRisk,
  weightedValue,
} from "@/lib/db";
import {
  caseAgeDays,
  requestStatus,
  slaInfo,
  summariseCase,
  triageSort,
} from "@/lib/tam";
import { Account, Deal, Role, STAGE_LABELS, Stage, dealProbability } from "@/lib/types";
import { eur } from "@/lib/format";

const PERSONA: Record<Role, string> = {
  rep: "a brisk, action-oriented sales-rep assistant. Focus on moving deals.",
  tam: "a precise, technical account-manager assistant. Focus on cases, SLAs and service history.",
  sm: "a concise sales-manager assistant. Focus on pipeline and team performance.",
  finance: "a neutral, numeric finance assistant. Be cautious and exact.",
};

// --- region grouping --------------------------------------------------------
// The DB stores a 2-letter country code as the account "region". The brief's
// example query talks about "DACH" (a multi-country region), so we map codes to
// the sales regions a manager actually thinks in.
const REGION_GROUPS: Record<string, string[]> = {
  DACH: ["DE", "AT", "CH"],
  Nordics: ["FI", "SE", "NO", "DK", "IS"],
  Benelux: ["NL", "BE", "LU"],
  France: ["FR"],
  "UK & Ireland": ["GB", "UK", "IE"],
  Iberia: ["ES", "PT"],
  Baltics: ["EE", "LV", "LT"],
};

const COUNTRY_NAMES: Record<string, string> = {
  DE: "germany",
  AT: "austria",
  CH: "switzerland",
  FI: "finland",
  SE: "sweden",
  NO: "norway",
  DK: "denmark",
  FR: "france",
  NL: "netherlands",
  BE: "belgium",
  LU: "luxembourg",
  GB: "united kingdom",
  IE: "ireland",
  ES: "spain",
  PT: "portugal",
};

// Regions HMD Secure does NOT operate in — so "at-risk deals in Latin America"
// honestly returns nothing instead of silently answering for the whole book.
const UNSERVED_REGIONS = [
  "latin america",
  "americas",
  "north america",
  "south america",
  "united states",
  "usa",
  "canada",
  "mexico",
  "brazil",
  "apac",
  "asia pacific",
  "asia",
  "china",
  "japan",
  "india",
  "africa",
  "middle east",
  "australia",
  "new zealand",
  "oceania",
];

/** The sales region a country code belongs to (e.g. DE -> "DACH"). */
function regionGroup(country: string): string {
  const c = country.toUpperCase();
  for (const [group, members] of Object.entries(REGION_GROUPS)) {
    if (members.includes(c)) return group;
  }
  return country;
}

/** Parse a region the question is asking about: a region-group name ("DACH"),
 *  a country name ("Germany") or a 2-letter code ("DE"). Returns a predicate
 *  over country codes + a human label, or null when no region was mentioned. */
function regionFilter(
  raw: string,
): { test: (country: string) => boolean; label: string } | null {
  const q = raw.toLowerCase();
  const group = Object.keys(REGION_GROUPS).find((g) => q.includes(g.toLowerCase()));
  if (group) {
    const members = REGION_GROUPS[group];
    return { test: (c) => members.includes(c.toUpperCase()), label: group };
  }
  for (const [code, name] of Object.entries(COUNTRY_NAMES)) {
    // Country NAME matches case-insensitively; the 2-letter CODE must appear
    // UPPERCASE in the original text — so the word "at" never matches AT
    // (Austria) and "no" never matches NO (Norway).
    if (q.includes(name) || new RegExp(`\\b${code}\\b`).test(raw)) {
      return { test: (c) => c.toUpperCase() === code, label: name.replace(/\b\w/g, (m) => m.toUpperCase()) };
    }
  }
  // A region we don't operate in → match nothing (honest "no deals there").
  const unserved = UNSERVED_REGIONS.find((r) => q.includes(r));
  if (unserved) {
    return { test: () => false, label: unserved.replace(/\b\w/g, (m) => m.toUpperCase()) };
  }
  return null;
}

// --- pipeline filtering -----------------------------------------------------

interface PipelineQuery {
  /** Deals matching every facet detected in the question (TCV-sorted). */
  deals: Deal[];
  /** Human label of the facets applied, e.g. "at-risk · Enterprise · DACH". */
  facetLabel: string;
  /** True when at least one facet (region/industry/risk/stage) was detected. */
  filtered: boolean;
}

/** Filter the open pipeline by any region / industry / risk / stage facet in the
 *  question. Pure given the data, so the model phrasing and the deterministic
 *  fallback share one source of truth. */
function filterPipeline(raw: string, accounts: Account[], open: Deal[]): PipelineQuery {
  const q = raw.toLowerCase();
  const acctById = new Map(accounts.map((a) => [a.id, a]));
  const industries = [...new Set(accounts.map((a) => a.industry))];

  const region = regionFilter(raw);
  const matchedIndustry = industries.find((i) =>
    new RegExp(`\\b${i.toLowerCase()}\\b`).test(q),
  );
  const wantsRisk = /at[\s-]?risk|stalled|overdue|slipp|stuck|past close|not moved|idle/.test(q);
  const stageEntry = (Object.entries(STAGE_LABELS) as [Stage, string][]).find(
    ([key, label]) => q.includes(label.toLowerCase()) || q.includes(key.replace(/_/g, " ")),
  );

  let deals = [...open];
  if (region) deals = deals.filter((d) => region.test(acctById.get(d.accountId)?.region ?? ""));
  if (matchedIndustry)
    deals = deals.filter(
      (d) => acctById.get(d.accountId)?.industry.toLowerCase() === matchedIndustry.toLowerCase(),
    );
  if (wantsRisk) deals = deals.filter(isAtRisk);
  if (stageEntry) deals = deals.filter((d) => d.stage === stageEntry[0]);

  const facetLabel = [
    wantsRisk ? "at-risk" : null,
    matchedIndustry,
    region?.label,
    stageEntry?.[1],
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    deals: deals.sort((a, b) => b.tcv - a.tcv),
    facetLabel,
    filtered: Boolean(region || matchedIndustry || wantsRisk || stageEntry),
  };
}

/** One grounded pipeline line for a deal. */
function dealLine(d: Deal, accounts: Map<string, Account>, owners: Map<string, string>): string {
  const a = accounts.get(d.accountId);
  const risk = isOverdue(d)
    ? "OVERDUE (past expected close)"
    : isStalled(d)
      ? "STALLED (14d+ no update)"
      : "on track";
  const region = a ? `${a.region} (${regionGroup(a.region)})` : "?";
  return `  DEAL "${d.name}" [${a?.name ?? "?"}, ${a?.industry ?? "?"}, ${region}, ${d.channel}]: ${STAGE_LABELS[d.stage]}, TCV ${eur(d.tcv, false)}, weighted ${eur(weightedValue(d), false)} @ ${Math.round(dealProbability(d) * 100)}%, close ${d.expectedCloseDate}, owner ${owners.get(d.ownerId) ?? "?"}, ${risk}.`;
}

/** Build the grounded fact sheet the assistant is allowed to use. For a
 *  pipeline-filter question the pipeline section is narrowed to matching deals so
 *  the model can only talk about those. */
export async function buildContext(
  role: Role,
  accountId?: string,
  question?: string,
): Promise<string> {
  const lines: string[] = [];

  if (accountId) {
    const account = await getAccount(accountId);
    if (account) {
      lines.push(`ACCOUNT: ${account.name} (${account.industry}, ${account.region}, ${account.channel}).`);
      if (account.summary) lines.push(`Summary: ${account.summary}`);
      const contacts = await getContactsForAccount(accountId);
      if (contacts.length) lines.push(`Contacts: ${contacts.map((c) => `${c.name} (${c.title})`).join("; ")}.`);
      for (const d of await getDealsForAccount(accountId)) {
        lines.push(`DEAL ${d.name}: stage ${STAGE_LABELS[d.stage]}, TCV ${eur(d.tcv, false)}, expected close ${d.expectedCloseDate}.`);
      }
    }
  }

  // TAM/case grounding — the cases in scope (account-filtered if given).
  const cases = (await getAllCases()).filter((c) => !accountId || c.accountId === accountId);
  for (const c of triageSort(cases)) {
    const sla = slaInfo(c);
    const notes = await getNotesForCase(c.id);
    const req = requestStatus(c, notes);
    const account = await getAccount(c.accountId);
    lines.push(
      `CASE ${c.id} "${c.title}" [${account?.name}]: ${c.priority} priority, ${c.status}, ${caseAgeDays(c)}d old, ${sla.label}, ${req.label}${c.escalatedToThirdParty ? ", 3rd-party escalated" : ""}.`,
    );
    const internal = notes.find((n) => n.visibility === "internal");
    if (internal) lines.push(`  internal note: ${internal.body}`);
  }

  if (accountId) {
    const hist = (await getServiceHistory(accountId)).slice(0, 6);
    if (hist.length) {
      lines.push("RECENT SERVICE HISTORY:");
      for (const e of hist) lines.push(`  ${e.createdAt.slice(0, 10)} ${e.kind}: ${e.body}`);
    }
  }

  // Cross-account pipeline grounding for the sales/finance personas — so a
  // manager/finance can ask "at-risk enterprise deals in DACH". When the
  // question carries facets we list ONLY the matching deals (pre-filtered), so
  // the model can't drag in a non-matching deal.
  if (!accountId && role !== "tam") {
    const [open, accounts, users] = await Promise.all([
      getOpenDeals(),
      getAccounts(),
      getUsers(),
    ]);
    const acctById = new Map(accounts.map((a) => [a.id, a]));
    const ownerById = new Map(users.map((u) => [u.id, u.name]));

    const pq = question ? filterPipeline(question, accounts, open) : null;
    if (pq && pq.filtered) {
      lines.push(
        `DEALS MATCHING THE QUERY (${pq.facetLabel}) — ${pq.deals.length} of ${open.length} open:`,
      );
      if (!pq.deals.length) {
        lines.push("  (none — no open deal matches all of those filters)");
      }
      for (const d of pq.deals.slice(0, 25)) lines.push(dealLine(d, acctById, ownerById));
    } else {
      const ranked = [...open].sort((a, b) => b.tcv - a.tcv).slice(0, 40);
      if (ranked.length) {
        lines.push(`OPEN PIPELINE (${open.length} deals):`);
        for (const d of ranked) lines.push(dealLine(d, acctById, ownerById));
      }
    }
  }

  return lines.join("\n");
}

export interface AssistantAnswer {
  text: string;
  /** True when a live model produced the answer; false = deterministic fallback. */
  modelUsed: boolean;
}

export async function ask(
  role: Role,
  question: string,
  accountId?: string,
): Promise<AssistantAnswer> {
  const context = await buildContext(role, accountId, question);

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `You are ${PERSONA[role]} You are part of the HMD Secure CRM. Answer ONLY from the FACTS below — mention ONLY deals/cases that literally appear there. The pipeline facts are ALREADY filtered to the region/industry/risk in the question, so never add a deal that isn't listed and never include one whose region or industry doesn't match what was asked. If nothing matches, say so plainly. Never invent names, numbers or dates. Be concise (2-4 sentences, or a short list). You are read-only; if asked to change data, say it must go through the meeting->CRM approval flow.\n\nFACTS:\n${context}`,
    },
    { role: "user", content: question },
  ];

  const out = await complete(messages, { temperature: 0.2, maxTokens: 350 });
  if (out) return { text: out.trim(), modelUsed: true };

  return { text: await deterministicAnswer(role, question, accountId), modelUsed: false };
}

// Deterministic fallback so the assistant is useful with no model key. Handles
// the common intents from the brief; otherwise returns the grounded facts.
async function deterministicAnswer(role: Role, question: string, accountId?: string): Promise<string> {
  const q = question.toLowerCase();

  // Pipeline questions first ("at-risk enterprise deals in DACH", "biggest
  // deals", "stalled deals") — answered cross-account from the open pipeline.
  const pipe = await maybePipelineAnswer(question);
  if (pipe) return pipe;

  const cases = (await getAllCases()).filter((c) => !accountId || c.accountId === accountId);

  if (/breach|sla|overdue|urgent|risk/.test(q)) {
    const pressing = triageSort(cases.filter((c) => c.status !== "resolved")).filter((c) => ["breach", "soon"].includes(slaInfo(c).state));
    if (!pressing.length) return "No cases are past or within 24h of their SLA right now.";
    const named = await Promise.all(
      pressing.map(async (c) => {
        const account = await getAccount(c.accountId);
        return `• ${c.title} (${account?.name}) — ${slaInfo(c).label}${c.escalatedToThirdParty ? ", 3rd-party" : ""}`;
      }),
    );
    return "SLA pressure:\n" + named.join("\n");
  }

  if (/case|ticket|issue/.test(q)) {
    const open = triageSort(cases.filter((c) => c.status !== "resolved"));
    if (!open.length) return "No open cases in scope.";
    const top = open[0];
    const [notes, history] = await Promise.all([
      getNotesForCase(top.id),
      getServiceHistory(top.accountId),
    ]);
    const s = summariseCase(top, notes, history);
    return `${open.length} open case(s). Top priority: ${top.title} — ${s.headline}. ${s.suggestion}`;
  }

  if (/deal|pipeline|status|forecast/.test(q) && accountId) {
    const deals = await getDealsForAccount(accountId);
    if (!deals.length) return "No deals on this account.";
    return deals.map((d) => `${d.name}: ${STAGE_LABELS[d.stage]}, ${eur(d.tcv, false)} TCV, close ${d.expectedCloseDate}.`).join("\n");
  }

  const ctx = await buildContext(role, accountId, question);
  return ctx ? `Model is offline — here are the grounded facts:\n${ctx}` : "I don't have anything on record for that.";
}

/** Deterministic pipeline query — the brief's conversational-query example
 *  ("At-risk enterprise deals in DACH"). Parses region / industry / stage /
 *  risk facets and filters the open pipeline. Returns null when the question
 *  isn't deal-shaped (so case questions fall through). */
async function maybePipelineAnswer(raw: string): Promise<string | null> {
  const q = raw.toLowerCase();
  const accounts = await getAccounts();

  const dealish = /\b(deal|deals|pipeline|forecast|opportunit|revenue|tcv|quarter|won|lost|close)\b/.test(q);
  const caseish = /\b(case|cases|ticket|tickets|sla|breach)\b/.test(q);
  const region = regionFilter(raw);
  const industries = [...new Set(accounts.map((a) => a.industry))];
  const matchedIndustry = industries.find((i) => new RegExp(`\\b${i.toLowerCase()}\\b`).test(q));

  // Only handle clearly deal-shaped questions here; let case questions fall
  // through to the case branches.
  if (!dealish && !region && !matchedIndustry) return null;
  if (caseish && !dealish) return null;

  const open = await getOpenDeals();
  const acctById = new Map(accounts.map((a) => [a.id, a]));
  const pq = filterPipeline(raw, accounts, open);

  if (!pq.deals.length) {
    return `No open deals${pq.facetLabel ? ` matching ${pq.facetLabel}` : ""} right now.`;
  }

  const weighted = pq.deals.reduce((s, d) => s + weightedValue(d), 0);
  const head = `${pq.deals.length} open deal(s)${pq.facetLabel ? ` — ${pq.facetLabel}` : ""} · weighted ${eur(weighted, false)}:`;
  const body = pq.deals.slice(0, 12).map((d) => {
    const a = acctById.get(d.accountId);
    const risk = isOverdue(d) ? " · overdue" : isStalled(d) ? " · stalled" : "";
    return `• ${d.name} (${a?.name}, ${regionGroup(a?.region ?? "")}) — ${STAGE_LABELS[d.stage]}, ${eur(d.tcv, false)}${risk}`;
  });
  return [head, ...body].join("\n");
}
