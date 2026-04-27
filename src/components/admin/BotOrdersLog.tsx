import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bot, RefreshCw, Download, ChevronDown, ChevronUp, Save } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { BOT_BASE_LABELS } from "@/lib/botCatalog";

type OrderRow = {
  id: string;
  created_at: string;
  submitted_at: string | null;
  bot_name: string;
  base: string;
  addons: string[];
  total_amount: number;
  currency: string;
  status: string;
  monthly_hosting: boolean;
  user_id: string;
  buyer_email: string | null;
  notes: string | null;
  delivery_url: string | null;
};

const EDITABLE_STATUSES = ["submitted", "paid", "building", "ready", "live", "cancelled"] as const;

type StatusFilter = "all" | "preorder" | "paid" | "building" | "ready" | "live" | "cancelled";

const PAGE_SIZE = 50;

// Map raw DB status → label + style. "submitted" surfaces as "Preorder".
const STATUS_META: Record<string, { label: string; className: string }> = {
  draft:      { label: "Draft",      className: "bg-muted text-muted-foreground border-border" },
  submitted:  { label: "Preorder",   className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  paid:       { label: "Paid",       className: "bg-primary/15 text-primary border-primary/30" },
  building:   { label: "In build",   className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  ready:      { label: "Ready",      className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  live:       { label: "Live",       className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  cancelled:  { label: "Cancelled",  className: "bg-destructive/15 text-destructive border-destructive/30" },
};

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
  }).format(amount || 0);

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

export const BotOrdersLog = () => {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const { data: orders, error } = await supabase
        .from("bot_orders")
        .select(
          "id, created_at, submitted_at, bot_name, base, addons, total_amount, currency, status, monthly_hosting, user_id, notes, delivery_url",
        )
        .order("submitted_at", { ascending: true, nullsFirst: false })
        .limit(500);

      if (error) throw error;

      // Best-effort buyer email lookup via profiles (no auth.users access from client).
      const userIds = Array.from(new Set((orders ?? []).map((o) => o.user_id)));
      const emailByUser = new Map<string, string | null>();
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, discord_username, roblox_username")
          .in("user_id", userIds);
        for (const p of profiles ?? []) {
          emailByUser.set(
            p.user_id,
            p.discord_username || p.roblox_username || null,
          );
        }
      }

      const mapped: OrderRow[] = (orders ?? []).map((o) => ({
        id: o.id,
        created_at: o.created_at,
        submitted_at: o.submitted_at,
        bot_name: o.bot_name,
        base: o.base,
        addons: o.addons ?? [],
        total_amount: Number(o.total_amount ?? 0),
        currency: o.currency ?? "usd",
        status: o.status ?? "submitted",
        monthly_hosting: !!o.monthly_hosting,
        user_id: o.user_id,
        buyer_email: emailByUser.get(o.user_id) ?? null,
        notes: (o as any).notes ?? null,
        delivery_url: (o as any).delivery_url ?? null,
      }));

      setRows(mapped);
    } catch (err: any) {
      toast.error("Couldn't load bot orders", {
        description: err?.message ?? "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter !== "all") {
      const target = statusFilter === "preorder" ? "submitted" : statusFilter;
      list = list.filter((r) => r.status === target);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.bot_name.toLowerCase().includes(q) ||
          (r.buyer_email ?? "").toLowerCase().includes(q) ||
          r.base.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Queue position: only counts preorders + paid (not yet built), ordered by submitted_at.
  const queueOrder = useMemo(() => {
    const queueable = rows
      .filter((r) => r.status === "submitted" || r.status === "paid")
      .sort((a, b) => {
        const ta = a.submitted_at ? new Date(a.submitted_at).getTime() : Number.POSITIVE_INFINITY;
        const tb = b.submitted_at ? new Date(b.submitted_at).getTime() : Number.POSITIVE_INFINITY;
        return ta - tb;
      });
    const map = new Map<string, number>();
    queueable.forEach((r, idx) => map.set(r.id, idx + 1));
    return map;
  }, [rows]);

  const exportCsv = () => {
    const header = [
      "queue_position",
      "id",
      "submitted_at",
      "created_at",
      "status",
      "bot_name",
      "base",
      "addons",
      "monthly_hosting",
      "total_amount",
      "currency",
      "buyer_email",
      "user_id",
    ];
    const lines = filtered.map((r) =>
      [
        queueOrder.get(r.id) ?? "",
        r.id,
        r.submitted_at ?? "",
        r.created_at,
        STATUS_META[r.status]?.label ?? r.status,
        r.bot_name,
        BOT_BASE_LABELS[r.base] ?? r.base,
        (r.addons ?? []).join("|"),
        r.monthly_hosting ? "yes" : "no",
        r.total_amount,
        r.currency,
        r.buyer_email ?? "",
        r.user_id,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bot-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const counts = useMemo(() => {
    const c = { preorder: 0, paid: 0, building: 0, ready: 0, live: 0, cancelled: 0 };
    for (const r of rows) {
      if (r.status === "submitted") c.preorder++;
      else if (r.status === "paid") c.paid++;
      else if (r.status === "building") c.building++;
      else if (r.status === "ready") c.ready++;
      else if (r.status === "live") c.live++;
      else if (r.status === "cancelled") c.cancelled++;
    }
    return c;
  }, [rows]);

  return (
    <Card className="p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center shrink-0">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold tracking-tight">Bot orders & preorders</h3>
          <p className="text-sm text-muted-foreground">
            Build queue, ordered by preorder time. Once payment processing is connected,
            paid orders will be picked up from the top of this list.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-1.5" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
        {(
          [
            ["Preorders", counts.preorder, "submitted"],
            ["Paid", counts.paid, "paid"],
            ["In build", counts.building, "building"],
            ["Ready", counts.ready, "ready"],
            ["Live", counts.live, "live"],
            ["Cancelled", counts.cancelled, "cancelled"],
          ] as const
        ).map(([label, value, key]) => {
          const meta = STATUS_META[key];
          return (
            <div
              key={label}
              className={`rounded-lg border px-3 py-2 ${meta?.className ?? "border-border"}`}
            >
              <div className="text-[10px] uppercase tracking-widest opacity-80">{label}</div>
              <div className="text-xl font-bold tabular-nums">{value}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <Input
          placeholder="Search bot name, buyer, base, ID…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-xs"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v as StatusFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="preorder">Preorders</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="building">In build</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">#</th>
                <th className="text-left font-medium px-3 py-2">Submitted</th>
                <th className="text-left font-medium px-3 py-2">Bot</th>
                <th className="text-left font-medium px-3 py-2">Base</th>
                <th className="text-left font-medium px-3 py-2">Add-ons</th>
                <th className="text-left font-medium px-3 py-2">Buyer</th>
                <th className="text-right font-medium px-3 py-2">Total</th>
                <th className="text-left font-medium px-3 py-2">Hosting</th>
                <th className="text-left font-medium px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                    {loading ? "Loading…" : "No orders match your filters yet."}
                  </td>
                </tr>
              )}
              {pageRows.map((r) => {
                const meta = STATUS_META[r.status] ?? STATUS_META.draft;
                const queuePos = queueOrder.get(r.id);
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {queuePos ? `#${queuePos}` : "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {formatDate(r.submitted_at ?? r.created_at)}
                    </td>
                    <td className="px-3 py-2 font-medium">{r.bot_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {BOT_BASE_LABELS[r.base] ?? r.base}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs">
                        {(r.addons ?? []).length}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[14rem]">
                      {r.buyer_email ?? <span className="opacity-60">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {formatMoney(r.total_amount, r.currency)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.monthly_hosting ? "$20/mo" : "Self-hosted"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={meta.className}>
                        {meta.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages} · {filtered.length} orders
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
