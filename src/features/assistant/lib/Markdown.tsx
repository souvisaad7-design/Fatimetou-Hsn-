import { Fragment, type ReactNode } from "react";

/**
 * عرض تنسيق بسيط داخل ردود المساعد كعناصر React (بدون innerHTML، فلا خطر من حقن HTML).
 * يدعم: **عريض**، _مائل_، `كود`، [رابط](https://...)، قوائم "- " و "1. "، وفقرات.
 */
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|_[^_\n]+_)/g;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith("_") && part.endsWith("_") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link) return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

type Block = { kind: "p"; lines: string[] } | { kind: "ul" | "ol"; items: string[] };

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  const flush = () => { if (current) blocks.push(current); current = null; };

  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const ul = line.match(/^\s*[-•*]\s+(.*)$/);
    const ol = line.match(/^\s*(?:\d+|[٠-٩]+)[.)]\s+(.*)$/);
    if (ul || ol) {
      const kind = ul ? "ul" : "ol";
      if (!current || current.kind !== kind) { flush(); current = { kind, items: [] }; }
      (current as { items: string[] }).items.push((ul ?? ol)![1]);
    } else if (!line.trim()) {
      flush();
    } else {
      if (!current || current.kind !== "p") { flush(); current = { kind: "p", lines: [] }; }
      current.lines.push(line);
    }
  }
  flush();
  return blocks;
}

export function Markdown({ text }: { text: string }) {
  return (
    <>
      {parse(text).map((b, i) => {
        if (b.kind === "p")
          return (
            <p key={i}>
              {b.lines.map((l, j) => (
                <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>
              ))}
            </p>
          );
        const List = b.kind;
        return <List key={i}>{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</List>;
      })}
    </>
  );
}
