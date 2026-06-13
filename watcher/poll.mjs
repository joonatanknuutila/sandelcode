#!/usr/bin/env node
// Notion -> local Claude session poller.
// Every config.pollSeconds it reads each person's "Prompt inbox" Notion page,
// detects new content, writes it to people/<name>/prompt/<ts>.md, and runs
// `claude -p --continue "<prompt>"` inside that person's git worktree.
//
// Requires: NOTION_TOKEN env var (internal integration token, ntn_...).
// Each Prompt-inbox page must be shared with that integration in Notion.

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

async function notion(path) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Notion-Version": NOTION_VERSION,
    },
  });
  if (!res.ok) throw new Error(`Notion ${res.status} on ${path}: ${await res.text()}`);
  return res.json();
}

// Pull plain text from a page's child blocks, skipping the quote header + dividers.
async function readPromptBody(pageId) {
  const out = [];
  let cursor;
  do {
    const q = cursor ? `?start_cursor=${cursor}&page_size=100` : `?page_size=100`;
    const data = await notion(`/blocks/${pageId}/children${q}`);
    for (const b of data.results) {
      if (b.type === "quote" || b.type === "divider") continue; // header / separators
      const rich = b[b.type]?.rich_text;
      if (Array.isArray(rich) && rich.length) out.push(rich.map((r) => r.plain_text).join(""));
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return out.join("\n").trim();
}

const SESSION = cfg.tmuxSession || "hmd";

function tmux(args) {
  return execFileSync("tmux", args, { encoding: "utf8" });
}

// True if the tmux window <session>:<name> exists (i.e. a visible claude session is running there).
function targetExists(name) {
  try {
    const wins = tmux(["list-windows", "-t", SESSION, "-F", "#{window_name}"]).split("\n");
    return wins.includes(name);
  } catch {
    return false; // session not running
  }
}

// Paste the prompt into that person's visible claude session via bracketed paste, then submit.
function injectToSession(person, prompt) {
  const target = `${SESSION}:${person.name}`;
  if (!targetExists(person.name)) {
    log(`WARN: tmux window ${target} not found — start sessions with ./start-sessions.sh. Prompt saved to file only.`);
    return;
  }
  const buf = `prompt-${person.name}`;
  tmux(["set-buffer", "-b", buf, prompt]);          // load text (literal arg, no shell)
  tmux(["paste-buffer", "-t", target, "-b", buf, "-p", "-d"]); // -p bracketed paste, -d delete buffer
  tmux(["send-keys", "-t", target, "Enter"]);       // submit
  log(`-> injected prompt into ${target} (${prompt.length} chars)`);
}

async function checkPerson(person) {
  const body = await readPromptBody(person.promptPageId);
  if (!body) return;
  const hash = createHash("sha1").update(body).digest("hex");
  const prev = state[person.promptPageId];
  if (prev?.hash === hash) return; // unchanged since last fire

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = resolve(ROOT, person.promptDir);
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `${ts}.md`);
  writeFileSync(file, body + "\n");
  log(`NEW prompt for ${person.name} -> ${person.promptDir}/${ts}.md`);

  state[person.promptPageId] = { hash, at: ts };
  saveState();
  injectToSession(person, body);
}

async function tick() {
  for (const person of cfg.people) {
    try { await checkPerson(person); }
    catch (e) { log(`ERROR ${person.name}: ${e.message}`); }
  }
}

log(`poller up. watching ${cfg.people.length} inboxes every ${cfg.pollSeconds}s.`);
await tick();
setInterval(tick, (cfg.pollSeconds || 30) * 1000);
