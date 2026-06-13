#!/usr/bin/env node
// Notion -> local Claude session poller.
// Every config.pollSeconds it reads each person's "Prompt inbox" Notion page,
// detects new content, writes it to people/<name>/prompt/<ts>.md, and runs
// `claude -p --continue "<prompt>"` inside that person's git worktree.
//
// Requires: NOTION_TOKEN env var (internal integration token, ntn_...).
// Each Prompt-inbox page must be shared with that integration in Notion.

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(resolve(ROOT, "watcher/config.json"), "utf8"));
const STATE_PATH = resolve(ROOT, "watcher/.state.json");
const LOG_PATH = resolve(ROOT, "watcher/poll.log");

const TOKEN = process.env.NOTION_TOKEN;
if (!TOKEN) {
  console.error("FATAL: NOTION_TOKEN not set. Copy .env.example -> .env and fill it, then run with `node --env-file=.env watcher/poll.mjs`.");
  process.exit(1);
}

const NOTION_VERSION = cfg.notionVersion || "2022-06-28";
const state = existsSync(STATE_PATH) ? JSON.parse(readFileSync(STATE_PATH, "utf8")) : {};

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  appendFileSync(LOG_PATH, line + "\n");
}
function saveState() { writeFileSync(STATE_PATH, JSON.stringify(state, null, 2)); }

async function notion(path, opts = {}) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method: opts.method || "GET",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
  if (!res.ok) throw new Error(`Notion ${res.status} on ${path}: ${await res.text()}`);
  return res.json();
}

// Read a page's prompt content: plain text + the block ids that hold it,
// skipping the quote header + dividers (those stay on the page).
async function readPrompt(pageId) {
  const texts = [], ids = [];
  let cursor;
  do {
    const q = cursor ? `?start_cursor=${cursor}&page_size=100` : `?page_size=100`;
    const data = await notion(`/blocks/${pageId}/children${q}`);
    for (const b of data.results) {
      if (b.type === "quote" || b.type === "divider") continue; // header / separators stay
      const rich = b[b.type]?.rich_text;
      if (Array.isArray(rich) && rich.length) {
        texts.push(rich.map((r) => r.plain_text).join(""));
        ids.push(b.id);
      }
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return { text: texts.join("\n").trim(), ids };
}

// Delete (archive) the given blocks so the same prompt can't be re-ingested.
// Returns true only if every block was removed.
async function archiveBlocks(ids) {
  let ok = true;
  for (const id of ids) {
    try { await notion(`/blocks/${id}`, { method: "DELETE" }); }
    catch (e) { ok = false; log(`WARN: could not delete block ${id}: ${e.message}`); }
  }
  return ok;
}

// Append blocks to the bottom of a Notion page.
async function appendBlocks(pageId, blocks) {
  await notion(`/blocks/${pageId}/children`, { method: "PATCH", body: { children: blocks } });
}

// --- session output -> Notion -------------------------------------------------
// The durable output of each session is the commits it makes in its worktree.
// We post every new commit on that person's branch to their Notion Planning page
// as a readable activity feed. First time we see a worktree we baseline silently
// (record HEAD, post nothing) so we don't dump the whole backlog.

function git(person, args) {
  return execFileSync("git", ["-C", resolve(ROOT, person.worktree), ...args], { encoding: "utf8" }).trim();
}

// New commits on this worktree's HEAD since `sinceSha`, oldest-first.
function newCommits(person, sinceSha) {
  const range = sinceSha ? `${sinceSha}..HEAD` : "-1";
  let out;
  try { out = git(person, ["log", "--reverse", "--pretty=format:%H\x1f%h\x1f%s\x1f%cI", range]); }
  catch { return []; }
  if (!out) return [];
  return out.split("\n").map((l) => {
    const [hash, short, subject, date] = l.split("\x1f");
    let files = 0;
    try { files = git(person, ["diff-tree", "--no-commit-id", "--name-only", "-r", hash]).split("\n").filter(Boolean).length; } catch {}
    return { hash, short, subject, date, files };
  });
}

async function reportCommits(person) {
  let head;
  try { head = git(person, ["rev-parse", "HEAD"]); } catch { return; } // worktree not ready
  state.commits ||= {};
  const since = state.commits[person.branch];
  if (!since) { state.commits[person.branch] = head; saveState(); return; } // baseline silently
  if (since === head) return;

  const commits = newCommits(person, since);
  if (!commits.length) { state.commits[person.branch] = head; saveState(); return; }

  const blocks = commits.map((c) => {
    const t = new Date(c.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const txt = `🔧 ${c.short} · ${c.subject} · ${c.files} file${c.files === 1 ? "" : "s"} · ${t}`;
    return { object: "block", type: "bulleted_list_item",
      bulleted_list_item: { rich_text: [{ type: "text", text: { content: txt.slice(0, 1900) } }] } };
  });
  try {
    // Notion caps 100 children per call; commit batches are tiny but be safe.
    for (let i = 0; i < blocks.length; i += 100) await appendBlocks(person.planningPageId, blocks.slice(i, i + 100));
    state.commits[person.branch] = head;
    saveState();
    log(`reported ${commits.length} commit(s) for ${person.name} -> Notion planning`);
  } catch (e) {
    log(`WARN: could not post commits for ${person.name}: ${e.message}`); // retry next tick
  }
}

// --- session NARRATION -> Notion ---------------------------------------------
// Beyond commits, post each Claude session's running narration (its assistant
// text turns — "what I'm doing / what I found / next step") to that person's
// Planning page, so they can follow their agent without watching the tmux pane.
// Source: Claude Code's own session transcript (~/.claude/projects/<escaped-cwd>/<id>.jsonl).
// Baselines on first sight (records line count, posts nothing) so no backlog dump.

const PROJECTS = resolve(homedir(), ".claude", "projects");

function transcriptDir(person) {
  const abs = resolve(ROOT, person.worktree);
  return resolve(PROJECTS, abs.replace(/[^a-zA-Z0-9]/g, "-"));
}

// Newest .jsonl in this worktree's transcript dir = the currently active session.
function activeTranscript(person) {
  const dir = transcriptDir(person);
  let files;
  try { files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")); } catch { return null; }
  let best = null, bestM = 0;
  for (const f of files) {
    const m = statSync(resolve(dir, f)).mtimeMs;
    if (m > bestM) { bestM = m; best = resolve(dir, f); }
  }
  return best;
}

// Assistant text turns from line `fromLine` onward. Returns {turns, total}.
function assistantTurns(file, fromLine) {
  const lines = readFileSync(file, "utf8").split("\n");
  const turns = [];
  for (let i = fromLine; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    let o; try { o = JSON.parse(lines[i]); } catch { continue; }
    if (o.type !== "assistant") continue;
    const text = (o.message?.content || [])
      .filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    if (text) turns.push({ text, ts: o.timestamp });
  }
  return { turns, total: lines.length };
}

// Notion: a paragraph block carrying one assistant turn (chunked to the 2000-char limit).
function narrationBlock(text, ts) {
  const t = ts ? new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
  let s = text.replace(/\r/g, "");
  const chunks = [];
  while (s.length && chunks.length < 4) { chunks.push(s.slice(0, 1900)); s = s.slice(1900); }
  if (s.length) chunks[chunks.length - 1] += " …[truncated]";
  const rich = chunks.map((c, i) => ({ type: "text", text: { content: (i === 0 ? `💬 ${t}  ` : "") + c } }));
  return { object: "block", type: "paragraph", paragraph: { rich_text: rich } };
}

async function reportClaudeOutput(person) {
  const file = activeTranscript(person);
  if (!file) return;
  state.transcripts ||= {};
  const st = state.transcripts[person.name];
  if (!st || st.file !== file) { // first sight / new session file → baseline, post nothing
    let total = 0; try { total = readFileSync(file, "utf8").split("\n").length; } catch {}
    state.transcripts[person.name] = { file, lines: total };
    saveState();
    return;
  }
  const { turns, total } = assistantTurns(file, st.lines);
  if (total === st.lines) return;
  if (!turns.length) { state.transcripts[person.name].lines = total; saveState(); return; }

  const blocks = turns.map((tn) => narrationBlock(tn.text, tn.ts));
  try {
    for (let i = 0; i < blocks.length; i += 100) await appendBlocks(person.planningPageId, blocks.slice(i, i + 100));
    state.transcripts[person.name].lines = total;
    saveState();
    log(`posted ${turns.length} Claude message(s) for ${person.name} -> Notion planning`);
  } catch (e) {
    log(`WARN: could not post Claude output for ${person.name}: ${e.message}`); // retry next tick
  }
}

function tmux(args) {
  return execFileSync("tmux", args, { encoding: "utf8" });
}

// Find the tmux pane id whose working directory is this person's worktree.
// Robust to any layout (separate windows OR a 2x2 grid of panes in one window).
function findPaneId(person) {
  const want = resolve(ROOT, person.worktree);
  try {
    const lines = tmux(["list-panes", "-a", "-F", "#{pane_id}|#{pane_current_path}"]).trim().split("\n");
    for (const line of lines) {
      const [id, path] = line.split("|");
      if (path === want || path?.endsWith(`/worktrees/${person.name}`)) return id;
    }
  } catch {
    /* tmux server not running */
  }
  return null;
}

// Paste the prompt into that person's visible claude pane via bracketed paste, then submit.
function injectToSession(person, prompt) {
  const pane = findPaneId(person);
  if (!pane) {
    log(`WARN: no tmux pane for ${person.name} (worktree ${person.worktree}) — start sessions with ./start-sessions.sh. Prompt saved to file only.`);
    return;
  }
  const buf = `prompt-${person.name}`;
  tmux(["set-buffer", "-b", buf, prompt]);             // load text (literal arg, no shell)
  tmux(["paste-buffer", "-t", pane, "-b", buf, "-p", "-d"]); // -p bracketed paste, -d delete buffer
  tmux(["send-keys", "-t", pane, "Enter"]);            // submit
  log(`-> injected prompt into ${person.name} pane ${pane} (${prompt.length} chars)`);
}

async function checkPerson(person) {
  const { text: body, ids } = await readPrompt(person.promptPageId);
  if (!body) return;
  const hash = createHash("sha1").update(body).digest("hex");
  const prev = state[person.promptPageId];
  if (prev?.hash === hash) return; // guard against re-firing the same content before deletion lands

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = resolve(ROOT, person.promptDir);
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `${ts}.md`);
  writeFileSync(file, body + "\n");
  log(`NEW prompt for ${person.name} -> ${person.promptDir}/${ts}.md`);

  // mark seen (dedup guard) BEFORE injecting, then inject + clear the inbox.
  state[person.promptPageId] = { hash, at: ts };
  saveState();
  injectToSession(person, body);

  // Delete the ingested blocks so the same message isn't sent again. If the page
  // is now empty, drop the dedup hash so an identical future prompt still fires.
  const cleared = await archiveBlocks(ids);
  if (cleared) {
    delete state[person.promptPageId];
    saveState();
    log(`cleared ${ids.length} block(s) from ${person.name} inbox`);
  }
}

async function tick() {
  for (const person of cfg.people) {
    try { await checkPerson(person); }          // Notion prompt -> session (in)
    catch (e) { log(`ERROR ${person.name}: ${e.message}`); }
    try { await reportClaudeOutput(person); }    // session narration -> Notion (out)
    catch (e) { log(`ERROR narrate ${person.name}: ${e.message}`); }
    try { await reportCommits(person); }         // session commits -> Notion (out)
    catch (e) { log(`ERROR report ${person.name}: ${e.message}`); }
  }
}

log(`poller up. watching ${cfg.people.length} inboxes every ${cfg.pollSeconds}s.`);
await tick();
setInterval(tick, (cfg.pollSeconds || 30) * 1000);
