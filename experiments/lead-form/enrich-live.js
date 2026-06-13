// Live enrichment pipeline using Google Gemini 2.5 with Google Search grounding.
// Streams events back to the client via the emit() callback.

const GEMINI_MODEL = "gemini-2.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callGemini(prompt, apiKey, { withSearch = true } = {}) {
  const url = `${API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3 },
  };
  if (withSearch) {
    body.tools = [{ google_search: {} }];
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts || []).map((p) => p.text || "").join("");
  const md = cand?.groundingMetadata || {};
  return {
    text,
    queries: md.webSearchQueries || [],
    chunks: (md.groundingChunks || []).map((c) => ({
      uri: c.web?.uri || "",
      title: c.web?.title || "",
    })),
  };
}

function extractJson(text) {
  const fence = text.match(/```json\s*([\s\S]*?)```/) || text.match(/```\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  try {
    return JSON.parse(candidate);
  } catch {
    // try to find first { ... }
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error("Could not parse JSON from Gemini response");
  }
}

function shortenUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}

async function emitResults(emit, queries, chunks, extras = []) {
  for (const q of queries.slice(0, 4)) {
    emit({ type: "search", query: q });
    await sleep(120);
  }
  for (const x of extras) {
    emit({ type: "found", source: x.source, finding: x.finding });
    await sleep(160);
  }
  for (const c of chunks.slice(0, 5)) {
    emit({ type: "found", source: shortenUrl(c.uri), finding: c.title || "(no title)" });
    await sleep(140);
  }
}

// ---- Step 1: domain extract (offline) ----
async function step1Domain(lead, emit) {
  emit({ type: "step_start", step: 1, total: 5, label: "Email domain extract" });
  const domain = (lead.email.split("@")[1] || "").toLowerCase();
  await sleep(150);
  emit({ type: "found", source: "offline (regex)", finding: `Domain: ${domain || "unknown"}` });
  await sleep(100);
  emit({ type: "step_done", step: 1, summary: `Normalized → ${domain}` });
  return { domain };
}

// ---- Step 2: verify employment ----
async function step2Verify(lead, domain, apiKey, emit) {
  emit({ type: "step_start", step: 2, total: 5, label: "Verify employment" });
  const prompt = `Verify whether ${lead.first_name} ${lead.last_name} currently works at ${lead.company} (domain: ${domain}). Search the web — LinkedIn, official "About" pages, press releases, conference speaker lists.

Return ONLY JSON inside a \`\`\`json fence with this exact shape:
\`\`\`json
{
  "verified": true,
  "title": "current title or null",
  "in_role_since": "YYYY-MM or null",
  "linkedin_url": "url or null",
  "previous_roles": ["short bullets"],
  "confidence": 0.0,
  "summary": "1-line summary"
}
\`\`\``;
  const { text, queries, chunks } = await callGemini(prompt, apiKey);
  let result;
  try {
    result = extractJson(text);
  } catch (e) {
    result = { verified: false, summary: "Parsing failed", confidence: 0 };
  }
  const extras = [];
  if (result.title) extras.push({ source: "Gemini synth", finding: `Title: ${result.title}` });
  if (result.in_role_since)
    extras.push({ source: "Gemini synth", finding: `In role since: ${result.in_role_since}` });
  if (result.linkedin_url)
    extras.push({ source: shortenUrl(result.linkedin_url), finding: "LinkedIn profile found" });
  await emitResults(emit, queries, chunks, extras);
  emit({
    type: "step_done",
    step: 2,
    summary: result.summary || `Verified: ${result.verified}`,
  });
  return result;
}

// ---- Step 3: company website news ----
async function step3CompanyNews(lead, domain, apiKey, emit) {
  emit({ type: "step_start", step: 3, total: 5, label: "Company website news" });
  const prompt = `Find the 3-5 most relevant recent news items from ${lead.company} (search site:${domain} and general web). Focus on press releases, strategy updates, financials, cybersecurity, restructuring, leadership changes — anything a B2B sales rep selling secure mobile devices to this company should know.

Return JSON in a \`\`\`json fence:
\`\`\`json
{
  "items": [
    { "title": "...", "date": "YYYY-MM-DD or approx", "url": "...", "summary": "1 sentence" }
  ]
}
\`\`\``;
  const { text, queries, chunks } = await callGemini(prompt, apiKey);
  let result = { items: [] };
  try {
    result = extractJson(text);
  } catch {}
  const extras = (result.items || []).slice(0, 4).map((i) => ({
    source: shortenUrl(i.url || ""),
    finding: i.title || i.summary || "(article)",
  }));
  await emitResults(emit, queries, chunks, extras);
  emit({
    type: "step_done",
    step: 3,
    summary: `${(result.items || []).length} articles found`,
  });
  return result;
}

// ---- Step 4: company intel ----
async function step4CompanyIntel(lead, domain, apiKey, emit) {
  emit({ type: "step_start", step: 4, total: 5, label: "Company intel (Google)" });
  const prompt = `You are researching ${lead.company} for an HMD Secure sales rep. HMD Secure sells secure Android devices and managed services to enterprise + public-sector customers.

Search Google for: compliance pressure (DORA, NIS2, ISO27001, KATAKRI), current EMM/MDM vendor (Intune, Samsung Knox, BlackBerry, Bittium, etc.), recent strategic decisions affecting IT, mobile workforce size estimate, government/defence ties.

Return JSON in a \`\`\`json fence:
\`\`\`json
{
  "findings": [
    {
      "topic": "short title",
      "summary": "1-2 sentences",
      "implication_for_sale": "1 sentence — what this means for HMD Secure",
      "sources": ["url"]
    }
  ]
}
\`\`\``;
  const { text, queries, chunks } = await callGemini(prompt, apiKey);
  let result = { findings: [] };
  try {
    result = extractJson(text);
  } catch {}
  const extras = (result.findings || []).slice(0, 4).map((f) => ({
    source: shortenUrl(f.sources?.[0] || "Gemini synth"),
    finding: f.topic,
  }));
  await emitResults(emit, queries, chunks, extras);
  emit({
    type: "step_done",
    step: 4,
    summary: `${(result.findings || []).length} strategic insights`,
  });
  return result;
}

// ---- Step 5: person intel ----
async function step5PersonIntel(lead, apiKey, emit) {
  emit({ type: "step_start", step: 5, total: 5, label: "Person intel (Google)" });
  const prompt = `Search Google for public information about ${lead.first_name} ${lead.last_name} at ${lead.company} relevant to a B2B sales meeting about secure mobile devices.

Look for: speaking engagements, interviews, public talks, areas of focus, career background, education, language preferences. NOT private contact info — just public-facing professional context.

Return JSON in a \`\`\`json fence:
\`\`\`json
{
  "findings": [
    {
      "topic": "short title",
      "summary": "1-2 sentences",
      "implication_for_sale": "1 sentence — how the rep should adjust the pitch",
      "sources": ["url"]
    }
  ]
}
\`\`\``;
  const { text, queries, chunks } = await callGemini(prompt, apiKey);
  let result = { findings: [] };
  try {
    result = extractJson(text);
  } catch {}
  const extras = (result.findings || []).slice(0, 4).map((f) => ({
    source: shortenUrl(f.sources?.[0] || "Gemini synth"),
    finding: f.topic,
  }));
  await emitResults(emit, queries, chunks, extras);
  emit({
    type: "step_done",
    step: 5,
    summary: `${(result.findings || []).length} personal insights`,
  });
  return result;
}

// ---- AI brief synthesis ----
async function synthBrief(lead, gathered, apiKey, emit) {
  emit({ type: "ai_brief", label: "Generating pre-meeting brief..." });
  const prompt = `You are writing a 30-second pre-meeting brief for an HMD Secure sales rep meeting ${lead.first_name} ${lead.last_name} from ${lead.company}.

The lead's stated product interest is: ${lead.product_interest}.
Their message: "${lead.message || "(none)"}"

HMD Secure products:
- HMD Fota = firmware-over-the-air managed update service
- HMD Terra M = rugged enterprise smartphone for field workers
- HMD Ivalo XE = highest-security phone (with Bittium dual-boot) for government/defence
- HMD Enable Pro = enterprise mobility management (MDM/EMM, includes Fota capability)

Gathered intelligence:
EMPLOYMENT: ${JSON.stringify(gathered.verify)}
COMPANY NEWS: ${JSON.stringify(gathered.news)}
COMPANY INTEL: ${JSON.stringify(gathered.companyIntel)}
PERSON INTEL: ${JSON.stringify(gathered.personIntel)}

Return ONLY JSON in a \`\`\`json fence, exactly this shape:
\`\`\`json
{
  "headline": "30-second who/what/why-now",
  "rapport_opener": "one short opening line the rep can say",
  "three_discovery_questions": ["q1", "q2", "q3"],
  "recommended_product": "HMD Fota | HMD Terra M | HMD Ivalo XE | HMD Enable Pro",
  "product_interest_flag": "empty string if the lead's choice matches your recommendation, otherwise 1-sentence explanation of mismatch",
  "competitor_intel": ["1-line bullet", "..."],
  "things_not_to_mention": ["1-line bullet", "..."],
  "decision_chain": "who decides → who signs → who pays",
  "deal_sizing": "rough device count and 3-year TCV estimate",
  "confidence": 0.7
}
\`\`\`
Be specific. Cite numbers and names from the intelligence. Never fabricate.`;
  const { text } = await callGemini(prompt, apiKey, { withSearch: false });
  let brief;
  try {
    brief = extractJson(text);
  } catch (e) {
    brief = {
      headline: `Brief generation failed: ${e.message}`,
      rapport_opener: "",
      three_discovery_questions: [],
      recommended_product: lead.product_interest,
      product_interest_flag: "",
      competitor_intel: [],
      things_not_to_mention: [],
      decision_chain: "",
      deal_sizing: "",
      confidence: 0,
    };
  }
  // Backfill missing fields defensively
  brief.three_discovery_questions = brief.three_discovery_questions || [];
  brief.competitor_intel = brief.competitor_intel || [];
  brief.things_not_to_mention = brief.things_not_to_mention || [];
  brief.product_interest_flag = brief.product_interest_flag || "";
  brief.confidence = typeof brief.confidence === "number" ? brief.confidence : 0.5;
  return brief;
}

// ---- Orchestrator ----
export async function runLiveEnrichment(lead, apiKey, emit) {
  const t0 = Date.now();
  const step1 = await step1Domain(lead, emit);
  const verify = await safeStep(() => step2Verify(lead, step1.domain, apiKey, emit), 2, emit);
  const news = await safeStep(
    () => step3CompanyNews(lead, step1.domain, apiKey, emit),
    3,
    emit
  );
  const companyIntel = await safeStep(
    () => step4CompanyIntel(lead, step1.domain, apiKey, emit),
    4,
    emit
  );
  const personIntel = await safeStep(() => step5PersonIntel(lead, apiKey, emit), 5, emit);

  const brief = await synthBrief(
    lead,
    { verify, news, companyIntel, personIntel },
    apiKey,
    emit
  );

  return {
    lead_id: lead.id,
    enriched_at: new Date().toISOString(),
    source_lead: lead,
    step_1_normalized: { email_domain: step1.domain },
    step_2_employment_verified: verify,
    step_3_company_news: news,
    step_4_company_intel: companyIntel,
    step_5_person_intel: personIntel,
    pre_meeting_brief: brief,
    duration_ms: Date.now() - t0,
  };
}

async function safeStep(fn, step, emit) {
  try {
    return await fn();
  } catch (err) {
    emit({
      type: "step_done",
      step,
      summary: `Error: ${err.message.slice(0, 100)}`,
    });
    return { error: err.message };
  }
}
