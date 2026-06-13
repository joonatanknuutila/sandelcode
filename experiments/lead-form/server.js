import { createServer } from "node:http";
import { readFile, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getStream } from "./enrichment-streams.js";
import { runLiveEnrichment } from "./enrich-live.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SUBMISSIONS = join(__dirname, "submissions.json");
const ENRICHED_DIR = join(__dirname, "enriched");
const PORT = 3000;

async function readSubmissions() {
  try {
    await access(SUBMISSIONS);
  } catch {
    return [];
  }
  const raw = await readFile(SUBMISSIONS, "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function appendSubmission(lead) {
  const all = await readSubmissions();
  const enriched = {
    id: "lead-" + Date.now(),
    created_at: new Date().toISOString(),
    ...lead,
  };
  all.push(enriched);
  await writeFile(SUBMISSIONS, JSON.stringify(all, null, 2));
  return enriched;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      const html = await readFile(join(__dirname, "index.html"), "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "GET" && req.url === "/api/leads") {
      const all = await readSubmissions();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(all));
      return;
    }

    const enrichedMatch = req.url.match(/^\/api\/enriched\/([\w-]+)$/);
    if (req.method === "GET" && enrichedMatch) {
      const id = enrichedMatch[1];
      try {
        const data = await readFile(join(ENRICHED_DIR, `${id}.json`), "utf8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(data);
      } catch {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not enriched yet" }));
      }
      return;
    }

    const streamMatch = req.url.match(/^\/api\/enrich-stream\/([\w-]+)$/);
    if (req.method === "GET" && streamMatch) {
      const id = streamMatch[1];
      const all = await readSubmissions();
      const lead = all.find((l) => l.id === id);
      if (!lead) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Lead not found" }));
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const send = (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      const apiKey = process.env.GEMINI_API_KEY;
      const liveMode = !!apiKey;
      send({ type: "init", lead_id: id, total_steps: 5, mode: liveMode ? "live" : "cached" });

      let aborted = false;
      req.on("close", () => (aborted = true));

      if (liveMode) {
        // LIVE: run Gemini-backed pipeline, save brief, then signal done.
        try {
          const enriched = await runLiveEnrichment(lead, apiKey, (ev) => {
            if (!aborted) send(ev);
          });
          await writeFile(
            join(ENRICHED_DIR, `${id}.json`),
            JSON.stringify(enriched, null, 2)
          );
          if (!aborted) send({ type: "done", brief_ready: true });
        } catch (err) {
          console.error("Live enrichment failed:", err);
          if (!aborted)
            send({
              type: "step_done",
              step: 0,
              summary: `Live mode error: ${err.message.slice(0, 120)}`,
            });
          if (!aborted) send({ type: "done", brief_ready: false });
        }
      } else {
        // CACHED replay
        const script = getStream(id, lead);
        for (const event of script) {
          if (aborted) break;
          if (event.delay) {
            await new Promise((r) => setTimeout(r, event.delay));
            continue;
          }
          send(event);
        }
      }
      res.end();
      return;
    }

    if (req.method === "POST" && req.url === "/api/leads") {
      const body = await parseBody(req);
      const required = ["first_name", "last_name", "email", "company", "product_interest"];
      for (const key of required) {
        if (!body[key] || String(body[key]).trim() === "") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: `Missing field: ${key}` }));
          return;
        }
      }
      const saved = await appendSubmission(body);
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify(saved));
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  } catch (err) {
    console.error(err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(err.message || err) }));
  }
});

server.listen(PORT, () => {
  const mode = process.env.GEMINI_API_KEY ? "LIVE (Gemini)" : "CACHED (no API key)";
  console.log(`\n  HMD Secure lead intake → http://localhost:${PORT}`);
  console.log(`  Enrichment mode: ${mode}\n`);
});
