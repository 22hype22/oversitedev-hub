import * as React from "react";
import { renderDiscordMarkdown } from "@/lib/discordMarkdown";

/**
 * Reusable Discord-style live preview. Drop next to any message-shaped form
 * to give users an instant Discord chat preview that updates as they type.
 *
 * Either pass `embed` for an embedded card, or `content` for a plain message
 * (or both — they stack like real Discord messages). When everything is
 * empty we render a placeholder so the preview frame doesn't disappear.
 */

export type DiscordEmbedShape = {
  author?: string;
  title?: string;
  description?: string;
  footer?: string;
  /** Hex like "#5865F2" or "0x5865F2"; falls back to blurple. */
  color?: string;
};

type Props = {
  botName: string;
  botAvatarUrl?: string | null;
  /** Plain message bubble shown above any embed. */
  content?: string;
  embed?: DiscordEmbedShape;
  /** Extra plain-message bubbles rendered after the main message/embed. */
  extras?: { label?: string; content: string }[];
  /** Tag rendered above the preview (e.g. "Live preview"). */
  caption?: string;
  className?: string;
};

const normalizeColor = (c?: string): string => {
  if (!c) return "#5865F2";
  const m = String(c).match(/[0-9a-fA-F]{6}/);
  return m ? `#${m[0]}` : "#5865F2";
};

export function DiscordEmbedPreview({
  botName,
  botAvatarUrl,
  content,
  embed,
  extras,
  caption = "Live preview",
  className,
}: Props) {
  const trimmedContent = (content ?? "").trim();
  const hasEmbed =
    embed &&
    Boolean(
      (embed.author ?? "").trim() ||
        (embed.title ?? "").trim() ||
        (embed.description ?? "").trim() ||
        (embed.footer ?? "").trim(),
    );
  const visibleExtras = (extras ?? []).filter((m) => (m.content ?? "").trim().length > 0);
  const isEmpty = !trimmedContent && !hasEmbed && visibleExtras.length === 0;
  const color = normalizeColor(embed?.color);

  return (
    <div className={className}>
      {caption && (
        <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          {caption}
        </div>
      )}
      <div className="rounded-lg border border-border bg-[#313338] p-4 text-[#dbdee1] font-sans text-sm space-y-4">
        <MessageBlock botName={botName} botAvatarUrl={botAvatarUrl}>
          {isEmpty ? (
            <p className="italic text-[#949ba4]">
              Start typing to see your message here.
            </p>
          ) : (
            <>
              {trimmedContent && (
                <div className="mt-0.5">{renderDiscordMarkdown(content)}</div>
              )}
              {hasEmbed && (
                <div
                  className="mt-1 max-w-md rounded bg-[#2b2d31] border-l-4 p-3 space-y-1"
                  style={{ borderLeftColor: color }}
                >
                  {embed?.author && embed.author.trim() && (
                    <div className="text-xs font-medium text-white">
                      {embed.author}
                    </div>
                  )}
                  {embed?.title && embed.title.trim() && (
                    <div className="text-white font-semibold whitespace-pre-wrap break-words">
                      {renderDiscordMarkdown(embed.title)}
                    </div>
                  )}
                  {embed?.description && embed.description.trim() && (
                    <div className="text-[#dbdee1] text-sm">
                      {renderDiscordMarkdown(embed.description)}
                    </div>
                  )}
                  {embed?.footer && embed.footer.trim() && (
                    <div className="pt-1 text-[11px] text-[#949ba4]">
                      {embed.footer}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </MessageBlock>

        {visibleExtras.map((m, idx) => (
          <MessageBlock key={idx} botName={botName} botAvatarUrl={botAvatarUrl}>
            {m.label && (
              <div className="text-[10px] uppercase tracking-wide text-[#949ba4] mb-0.5">
                {m.label}
              </div>
            )}
            <div>{renderDiscordMarkdown(m.content)}</div>
          </MessageBlock>
        ))}
      </div>
    </div>
  );
}

function MessageBlock({
  botName,
  botAvatarUrl,
  children,
}: {
  botName: string;
  botAvatarUrl?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="h-10 w-10 rounded-full bg-[#5865F2] grid place-items-center shrink-0 overflow-hidden">
        {botAvatarUrl ? (
          <img src={botAvatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-white text-sm font-bold">
            {botName.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-white font-medium">{botName}</span>
          <span className="bg-[#5865F2] text-white text-[10px] px-1 py-px rounded font-semibold">
            APP
          </span>
          <span className="text-[11px] text-[#949ba4]">Today at 12:00 PM</span>
        </div>
        {children}
      </div>
    </div>
  );
}
