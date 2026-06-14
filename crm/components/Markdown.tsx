// Minimal, dependency-free markdown renderer for AI replies.
//
// The model emits markdown (**bold**, *italic*, `code`, "- " bullets); rendering
// it as plain text shows literal asterisks. This covers the subset the assistant
// actually produces and builds React nodes (no dangerouslySetInnerHTML, so it's
// XSS-safe). Used by the Agent Dock and the per-page Assistant.

import type { ReactNode } from "react";

function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`"))
      out.push(
        <code key={key} className="rounded bg-background px-1 py-0.5 text-[0.85em]">
          {tok.slice(1, -1)}
        </code>,
      );
    else out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ content, className }: { content: string; className?: string }) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (!bullets.length) return;
    const items = bullets;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-1 ml-4 list-disc space-y-0.5">
        {items.map((b, j) => (
          <li key={j}>{renderInline(b, `b-${blocks.length}-${j}`)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  lines.forEach((line, idx) => {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
      return;
    }
    flush();
    if (line.trim() === "") return;
    blocks.push(
      <p key={`p-${idx}`} className="my-0.5">
        {renderInline(line, `p-${idx}`)}
      </p>,
    );
  });
  flush();

  return <div className={className}>{blocks}</div>;
}
