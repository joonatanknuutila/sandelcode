"use client";

// The always-on AI agent. A high-z floating button (bottom-right of every page)
// opens a slide-over conversational panel that:
//   • briefs the user on what's going on + what to do (role-aware), with one-tap
//     agentic suggestions;
//   • takes actions in the CRM (auto-apply) and shows each with an Undo;
//   • asks for missing detail (clarify) instead of guessing;
//   • supports new chats + persisted history.
// Mounted once from AppShell so it rides every route. It reads the current path
// to pass page context (account/deal/case) so "log a note here" targets the
// right entity.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";
import { Markdown } from "./Markdown";
import { VoiceInput } from "./VoiceInput";

interface UIAction {
  label: string;
  undone?: boolean;
}

interface UIMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  actions?: UIAction[];
  clarify?: string[];
  /** Adaptive one-tap follow-ups for this turn (only the latest turn shows them). */
  suggestions?: string[];
  pending?: boolean;
}

interface Brief {
  headline: string;
  items: string[];
  suggestions: { label: string; prompt: string }[];
}

interface ChatSummary {
  id: string;
  title: string;
  updatedAt: string;
}

/** Parse account/deal/case id from the current path for "act here" targeting. */
function pageContextFromPath(pathname: string): { accountId?: string; dealId?: string; caseId?: string } {
  const m = pathname.match(/^\/(?:rep|sm|tam|finance)\/(accounts|deals|cases)\/([^/]+)/);
  if (!m) return {};
  const [, kind, id] = m;
  if (kind === "deals") return { dealId: id };
  if (kind === "cases") return { caseId: id };
  return { accountId: id };
}

export function AgentDock({ role }: { role: Role }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatId, setChatId] = useState<string | undefined>();
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshChats = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent/chats?role=${role}`);
      const data = await res.json();
      setChats(data.chats ?? []);
    } catch {
      /* ignore */
    }
  }, [role]);

  // Switching persona resets the conversation: a rep's chat must NOT continue as
  // the TAM. History is reloaded per-persona by the effect below. A fresh persona
  // also re-arms the nudge so it can surface that persona's brief.
  useEffect(() => {
    queueMicrotask(() => {
      setChatId(undefined);
      setMessages([]);
      setShowHistory(false);
      setNudgeDismissed(false);
    });
  }, [role]);

  // The brief drives both the panel's opening view AND the closed-state nudge
  // bubble, so fetch it whenever the persona changes (not only when open). On a
  // case page we pass the caseId so the TAM gets the case's ready-made questions.
  const briefCaseId = pageContextFromPath(pathname).caseId;
  useEffect(() => {
    const qs = new URLSearchParams({ role });
    if (briefCaseId) qs.set("caseId", briefCaseId);
    fetch(`/api/agent/brief?${qs.toString()}`)
      .then((r) => r.json())
      .then((b) => setBrief(b))
      .catch(() => setBrief(null));
  }, [role, briefCaseId]);

  // History is only needed once the panel is open.
  useEffect(() => {
    if (open) queueMicrotask(refreshChats);
  }, [open, refreshChats]);

  // The closed-state "needs your attention" nudge appears AT MOST ONCE per
  // session and ONLY on a role dashboard (§0.3) — it never follows the user from
  // page to page, and never auto-reopens. Once shown we mark the session so the
  // only way back to the assistant is clicking the button.
  useEffect(() => {
    const onDashboard = /^\/(rep|sm|tam|finance)$/.test(pathname);
    if (open || nudgeDismissed || !brief?.headline || !onDashboard) {
      queueMicrotask(() => setShowNudge(false));
      return;
    }
    try {
      if (sessionStorage.getItem("hmd_attention_nudge_shown")) return;
    } catch {
      /* sessionStorage unavailable — fall through and show once */
    }
    const t = setTimeout(() => {
      setShowNudge(true);
      try {
        sessionStorage.setItem("hmd_attention_nudge_shown", "1");
      } catch {
        /* ignore */
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [open, nudgeDismissed, brief, pathname]);

  // Keep the thread pinned to the newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    setShowHistory(false);
    setMessages((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "", pending: true }]);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          role,
          message,
          pageContext: pageContextFromPath(pathname),
        }),
      });
      const data = await res.json();
      if (data.chatId) setChatId(data.chatId);
      setMessages((m) =>
        m.map((turn, i) =>
          i === m.length - 1
            ? {
                id: data.messageId,
                role: "assistant",
                content: data.reply ?? data.error ?? "No answer.",
                actions: data.executed,
                clarify: data.clarify,
                suggestions: data.suggestions,
              }
            : turn,
        ),
      );
      refreshChats();
    } catch {
      setMessages((m) =>
        m.map((turn, i) => (i === m.length - 1 ? { role: "assistant", content: "Request failed." } : turn)),
      );
    } finally {
      setBusy(false);
    }
  }

  async function undo(messageId: string | undefined, actionIndex: number) {
    if (!messageId) return;
    try {
      const res = await fetch("/api/agent/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, actionIndex }),
      });
      if (!res.ok) return;
      setMessages((m) =>
        m.map((turn) =>
          turn.id === messageId && turn.actions
            ? { ...turn, actions: turn.actions.map((a, i) => (i === actionIndex ? { ...a, undone: true } : a)) }
            : turn,
        ),
      );
    } catch {
      /* ignore */
    }
  }

  function newChat() {
    setChatId(undefined);
    setMessages([]);
    setShowHistory(false);
  }

  async function openChat(id: string) {
    setShowHistory(false);
    try {
      const res = await fetch(`/api/agent/chats/${id}`);
      const data = await res.json();
      setChatId(data.id);
      setMessages(
        (data.messages ?? []).map((m: { id: string; role: string; content: string; actions?: UIAction[] }) => ({
          id: m.id,
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
          actions: m.actions ?? undefined,
        })),
      );
    } catch {
      /* ignore */
    }
  }

  async function removeChat(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/agent/chats/${id}`, { method: "DELETE" });
    if (id === chatId) newChat();
    refreshChats();
  }

  return (
    <>
      {/* Floating action button + attention nudge — above the nav drawer (z-50). */}
      {!open && (
        <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3">
          {/* Speech bubble: contextual nudge drawn from the persona's brief. */}
          {showNudge && brief?.headline && (
            <div className="relative max-w-[16rem]">
              <button
                onClick={() => {
                  setShowNudge(false);
                  setOpen(true);
                }}
                className="block rounded-2xl rounded-br-sm border border-border bg-surface px-3.5 py-2.5 text-left shadow-xl transition-transform hover:-translate-y-0.5"
              >
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-hmd-teal-700">
                  <SparkIcon small /> Assistant
                </span>
                <span className="mt-0.5 block text-sm font-medium text-foreground">{brief.headline}</span>
                <span className="mt-0.5 block text-xs text-muted">Tap to see what to do →</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setNudgeDismissed(true);
                }}
                aria-label="Dismiss"
                className="absolute -left-2 -top-2 grid h-6 w-6 place-items-center rounded-full border border-border bg-background text-muted shadow hover:text-foreground"
              >
                <CloseIcon small />
              </button>
            </div>
          )}

          <button
            onClick={() => {
              setShowNudge(false);
              setOpen(true);
            }}
            aria-label="Open AI assistant"
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-hmd-teal text-hmd-charcoal shadow-lg shadow-black/20 transition-transform hover:scale-105 active:scale-95"
          >
            <SparkIcon />
          </button>
        </div>
      )}

      {open && (
        <>
          {/* Backdrop on mobile only; desktop keeps the page visible beside the panel. */}
          <div
            className="fixed inset-0 z-[55] bg-black/40 sm:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 right-0 z-[60] flex w-full flex-col bg-surface shadow-2xl sm:w-[420px] sm:border-l sm:border-border">
            {/* Header */}
            <header className="flex items-center justify-between gap-2 border-b border-border bg-hmd-charcoal px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-hmd-teal text-hmd-charcoal">
                  <SparkIcon small />
                </span>
                <p className="text-sm font-semibold">Assistant</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowHistory((s) => !s)}
                  className="rounded-md px-2 py-1 text-xs text-white/80 hover:bg-white/10"
                >
                  History
                </button>
                <button
                  onClick={newChat}
                  className="rounded-md px-2 py-1 text-xs font-medium text-white/90 hover:bg-white/10"
                >
                  + New
                </button>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close assistant"
                  className="grid h-8 w-8 place-items-center rounded-md text-white/80 hover:bg-white/10"
                >
                  <CloseIcon />
                </button>
              </div>
            </header>

            {/* History drawer */}
            {showHistory && (
              <div className="max-h-64 overflow-auto border-b border-border bg-background">
                {chats.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-muted">No previous chats.</p>
                ) : (
                  chats.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => openChat(c.id)}
                      className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-surface ${
                        c.id === chatId ? "bg-surface font-medium" : ""
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{c.title}</span>
                      <span
                        onClick={(e) => removeChat(c.id, e)}
                        className="shrink-0 rounded p-1 text-muted hover:bg-border hover:text-foreground"
                        role="button"
                        aria-label="Delete chat"
                      >
                        <CloseIcon small />
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Thread */}
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-auto px-4 py-4">
              {messages.length === 0 && (
                <BriefView brief={brief} onPick={(p) => send(p)} />
              )}

              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                  {m.role === "user" ? (
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-hmd-teal px-3.5 py-2 text-sm text-hmd-charcoal">
                      {m.content}
                    </div>
                  ) : (
                    <div className="max-w-[92%]">
                      {m.pending ? (
                        <p className="text-sm text-muted">Thinking…</p>
                      ) : (
                        <Markdown content={m.content} className="text-sm leading-relaxed text-foreground" />
                      )}

                      {/* Executed actions with Undo */}
                      {m.actions && m.actions.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {m.actions.map((a, ai) => (
                            <div
                              key={ai}
                              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs"
                            >
                              <span className={a.undone ? "text-muted line-through" : "text-foreground"}>
                                <span className="mr-1 font-bold text-hmd-teal">✓</span>
                                {a.label}
                              </span>
                              {a.undone ? (
                                <span className="shrink-0 text-muted">Undone</span>
                              ) : (
                                <button
                                  onClick={() => undo(m.id, ai)}
                                  className="shrink-0 rounded border border-border px-2 py-0.5 font-medium text-muted hover:border-hmd-teal-600 hover:text-foreground"
                                >
                                  Undo
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Clarifying questions */}
                      {m.clarify && m.clarify.length > 0 && (
                        <div className="mt-2 rounded-lg border border-hmd-teal-600/40 bg-hmd-teal/10 px-3 py-2 text-xs text-foreground">
                          <p className="font-medium">I need a bit more to do that:</p>
                          <ul className="mt-1 ml-4 list-disc space-y-0.5">
                            {m.clarify.map((q, qi) => (
                              <li key={qi}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Adaptive conversational buttons — only on the latest turn,
                          so they change with the conversation. */}
                      {!m.pending &&
                        m.suggestions &&
                        m.suggestions.length > 0 &&
                        i === messages.length - 1 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {m.suggestions.map((s, si) => (
                              <button
                                key={si}
                                onClick={() => send(s)}
                                disabled={busy}
                                className="rounded-full border border-hmd-teal/60 bg-hmd-teal/20 px-3 py-1.5 text-xs font-semibold text-hmd-teal hover:bg-hmd-teal/30 hover:border-hmd-teal disabled:opacity-40"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-end gap-2 border-t border-border bg-surface px-3 py-3"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder="Ask, or tell me what to do…"
                className="max-h-32 min-h-[44px] min-w-0 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-hmd-teal-600"
              />
              <VoiceInput
                onTranscript={(t) => setInput((v) => (v ? `${v} ${t}` : t))}
                className="shrink-0 self-end"
                title="Dictate"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-hmd-teal text-hmd-charcoal disabled:opacity-40"
                aria-label="Send"
              >
                <SendIcon />
              </button>
            </form>
          </aside>
        </>
      )}
    </>
  );
}

function BriefView({ brief, onPick }: { brief: Brief | null; onPick: (prompt: string) => void }) {
  if (!brief) return <p className="text-sm text-muted">Getting your brief…</p>;
  return (
    <div>
      <p className="text-base font-semibold text-foreground">{brief.headline}</p>
      <ul className="mt-2 space-y-1.5 text-sm text-muted">
        {brief.items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-hmd-teal" />
            <span className="text-foreground">{it}</span>
          </li>
        ))}
      </ul>
      {brief.suggestions.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Try</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {brief.suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => onPick(s.prompt)}
                className="rounded-lg border border-hmd-teal/40 bg-hmd-teal/10 px-3 py-2 text-left text-sm font-medium text-foreground hover:border-hmd-teal hover:bg-hmd-teal/20"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SparkIcon({ small }: { small?: boolean }) {
  const s = small ? 16 : 24;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2zM19 14l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6L15.5 18l2.6-.9L19 14z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

function CloseIcon({ small }: { small?: boolean }) {
  const s = small ? 12 : 18;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
