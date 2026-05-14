import * as React from "react";

/**
 * Lightweight Discord-flavored markdown renderer.
 *
 * Supports the subset users actually use in our message builders:
 *   **bold**, __underline__, *italic* / _italic_, ~~strike~~,
 *   `inline code`, ||spoiler||, > blockquote (line-prefix),
 *   [label](https://url), bare https://urls, and \n line breaks.
 *
 * Triple-backtick code blocks render as a single block with monospace
 * styling. Discord-specific mentions (<@id>, <#id>) render as styled chips.
 *
 * Returns React nodes you can drop straight into a `<p>` / `<div>`.
 */

type Node = string | React.ReactElement;

const KEY = (() => {
  let n = 0;
  return () => `m${n++}`;
})();

/** Inline parser — runs on a single line of text, no blockquotes. */
function parseInline(text: string): Node[] {
  const out: Node[] = [];
  let i = 0;
  const len = text.length;

  const pushText = (s: string) => {
    if (s.length === 0) return;
    if (out.length > 0 && typeof out[out.length - 1] === "string") {
      out[out.length - 1] = (out[out.length - 1] as string) + s;
    } else {
      out.push(s);
    }
  };

  // Try to consume a paired wrapper like **...** or __...__ etc.
  const tryWrap = (
    marker: string,
    render: (inner: Node[]) => React.ReactElement,
  ): boolean => {
    if (!text.startsWith(marker, i)) return false;
    const close = text.indexOf(marker, i + marker.length);
    if (close === -1) return false;
    const inner = text.slice(i + marker.length, close);
    if (inner.length === 0) return false;
    out.push(React.cloneElement(render(parseInline(inner)), { key: KEY() }));
    i = close + marker.length;
    return true;
  };

  while (i < len) {
    const ch = text[i];

    // Escape: \X passes X through verbatim.
    if (ch === "\\" && i + 1 < len) {
      pushText(text[i + 1]);
      i += 2;
      continue;
    }

    // Discord mention chips: <@123>, <@!123>, <@&123>, <#123>.
    if (ch === "<") {
      const m = text.slice(i).match(/^<(@[!&]?|#)(\d{5,25})>/);
      if (m) {
        const kind = m[1];
        const isChannel = kind === "#";
        out.push(
          <span
            key={KEY()}
            className="rounded bg-[#5865F2]/30 px-1 text-[#c9cdfb] font-medium"
          >
            {isChannel ? "#" : "@"}
            {isChannel ? "channel" : "user"}
          </span>,
        );
        i += m[0].length;
        continue;
      }
    }

    // Markdown links: [label](url)
    if (ch === "[") {
      const m = text.slice(i).match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
      if (m) {
        out.push(
          <a
            key={KEY()}
            href={m[2]}
            target="_blank"
            rel="noreferrer"
            className="text-[#00a8fc] hover:underline"
          >
            {parseInline(m[1])}
          </a>,
        );
        i += m[0].length;
        continue;
      }
    }

    // Bare URL.
    if (ch === "h") {
      const m = text.slice(i).match(/^(https?:\/\/[^\s<>]+[^\s<>.,;:!?)\]])/);
      if (m) {
        out.push(
          <a
            key={KEY()}
            href={m[1]}
            target="_blank"
            rel="noreferrer"
            className="text-[#00a8fc] hover:underline"
          >
            {m[1]}
          </a>,
        );
        i += m[1].length;
        continue;
      }
    }

    // Order matters: try the longest markers first.
    if (tryWrap("***", (inner) => (
      <strong key={KEY()}>
        <em>{inner}</em>
      </strong>
    ))) continue;
    if (tryWrap("**", (inner) => <strong key={KEY()}>{inner}</strong>)) continue;
    if (tryWrap("__", (inner) => <u key={KEY()}>{inner}</u>)) continue;
    if (tryWrap("~~", (inner) => <s key={KEY()}>{inner}</s>)) continue;
    if (tryWrap("||", (inner) => (
      <span
        key={KEY()}
        className="rounded bg-[#202225] px-1 text-[#202225] hover:text-[#dbdee1] transition-colors cursor-pointer"
      >
        {inner}
      </span>
    ))) continue;
    if (ch === "`") {
      // Inline code — single backtick pair, no nested formatting.
      const close = text.indexOf("`", i + 1);
      if (close !== -1) {
        out.push(
          <code
            key={KEY()}
            className="rounded bg-[#2b2d31] px-1 py-0.5 font-mono text-[0.85em] text-[#dbdee1]"
          >
            {text.slice(i + 1, close)}
          </code>,
        );
        i = close + 1;
        continue;
      }
    }
    if (tryWrap("*", (inner) => <em key={KEY()}>{inner}</em>)) continue;
    if (ch === "_" && (i === 0 || /\s/.test(text[i - 1] ?? " "))) {
      // Word-internal underscores stay literal (snake_case).
      if (tryWrap("_", (inner) => <em key={KEY()}>{inner}</em>)) continue;
    }

    pushText(ch);
    i += 1;
  }

  return out;
}

/**
 * Renders Discord-flavored markdown into JSX. Handles blockquotes (lines
 * starting with `> `), triple-backtick code blocks, and inline formatting.
 */
export function renderDiscordMarkdown(input: string | null | undefined): React.ReactNode {
  if (!input) return null;

  const blocks: React.ReactNode[] = [];
  const lines = String(input).split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // ``` code block
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing fence
      blocks.push(
        <pre
          key={KEY()}
          className="my-1 rounded bg-[#2b2d31] p-2 font-mono text-[0.85em] text-[#dbdee1] overflow-x-auto"
        >
          {lang ? <span className="text-[#949ba4] text-xs block mb-1">{lang}</span> : null}
          {buf.join("\n")}
        </pre>,
      );
      continue;
    }

    // > blockquote — collapse consecutive quoted lines.
    if (/^>\s/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote
          key={KEY()}
          className="border-l-4 border-[#4e5058] pl-2 my-0.5 text-[#dbdee1]"
        >
          {buf.map((b, idx) => (
            <div key={idx} className="whitespace-pre-wrap break-words">
              {parseInline(b)}
            </div>
          ))}
        </blockquote>,
      );
      continue;
    }

    // Regular line.
    blocks.push(
      <div key={KEY()} className="whitespace-pre-wrap break-words">
        {parseInline(line).length > 0 ? parseInline(line) : "\u00A0"}
      </div>,
    );
    i++;
  }

  return blocks;
}
