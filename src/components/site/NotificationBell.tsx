import { Link } from "react-router-dom";
import { Bell, CheckCheck, AlertTriangle, Power, Terminal, Clock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBotNotifications, type BotNotification } from "@/hooks/useBotNotifications";

function iconFor(type: string) {
  switch (type) {
    case "bot_offline":
      return Power;
    case "error_spike":
      return AlertTriangle;
    case "command_finished":
      return Terminal;
    case "free_period_expiring":
      return Clock;
    default:
      return Bell;
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function NotifRow({ n, onClick }: { n: BotNotification; onClick: () => void }) {
  const Icon = iconFor(n.event_type);
  const unread = !n.read_at;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 flex gap-3 items-start hover:bg-muted/40 transition-colors border-b border-border/40 last:border-0 ${
        unread ? "bg-primary/[0.04]" : ""
      }`}
    >
      <span
        className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-md flex-shrink-0 ${
          n.event_type === "error_spike" || n.event_type === "bot_offline"
            ? "bg-destructive/10 text-destructive"
            : "bg-primary/10 text-primary"
        }`}
      >
        <Icon size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`text-sm break-words ${unread ? "font-semibold" : "font-medium text-muted-foreground"}`}>
            {n.title}
          </p>
          {unread && <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">{timeAgo(n.created_at)}</p>
      </div>
    </button>
  );
}

export function NotificationBell() {
  const { items, unread, markAllRead, markRead } = useBotNotifications();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative inline-flex items-center justify-center h-9 w-9 rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-smooth"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell size={15} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
          <div className="text-sm font-medium">Notifications</div>
          {unread > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
              onClick={(e) => {
                e.preventDefault();
                markAllRead();
              }}
            >
              <CheckCheck size={12} />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[420px]">
          {items.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Bell size={20} className="mx-auto mb-2 opacity-50" />
              You're all caught up.
            </div>
          ) : (
            <div className="flex flex-col">
              {items.map((n) => (
                <NotifRow key={n.id} n={n} onClick={() => markRead(n.id)} />
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="border-t border-border/60 px-3 py-2 text-center">
          <Link
            to="/dashboard"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Manage notification settings →
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
