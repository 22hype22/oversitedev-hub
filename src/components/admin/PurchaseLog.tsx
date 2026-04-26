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
import { Receipt, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type LogRow = {
  id: string;
  created_at: string;
  product_name: string;
  version: string | null;
  source: "card" | "robux";
  amount_label: string;
  buyer: string;
  status: string;
  environment?: string | null;
};

type SourceFilter = "all" | "card" | "robux";
type StatusFilter = "fulfilled" | "all" | "pending";

const PAGE_SIZE = 50;

const isFulfilledStatus = (s: string) => {
  const v = (s ?? "").toLowerCase();
  return v === "paid" || v === "fulfilled" || v === "completed" || v === "complete" || v === "succeeded";
};

export const PurchaseLog = () => {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<SourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("fulfilled");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [stripeRes, pendingRes] = await Promise.all([
        supabase
          .from("purchases")
          .select(
            "id, created_at, product_name, version, amount_cents, currency, email, status, environment",
          )
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("pending_purchases")
          .select(
            "id, created_at, roblox_username, version, status, product_id",
          )
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      if (stripeRes.error) throw stripeRes.error;
      if (pendingRes.error) throw pendingRes.error;

      // Resolve product names for pending rows
      const pendingIds = Array.from(
        new Set((pendingRes.data ?? []).map((r) => r.product_id).filter(Boolean)),
      );
      let productNameMap = new Map<string, string>();
      if (pendingIds.length) {
        const { data: prods } = await supabase
          .from("products")
          .select("id, name")
          .in("id", pendingIds);
        productNameMap = new Map((prods ?? []).map((p) => [p.id, p.name]));
      }

      const stripeRows: LogRow[] = (stripeRes.data ?? []).map((r) => ({
        id: `s_${r.id}`,
        created_at: r.created_at,
        product_name: r.product_name,
        version: r.version,
        source: "card",
        amount_label: `${(r.amount_cents / 100).toLocaleString(undefined, {
          style: "currency",
          currency: (r.currency || "usd").toUpperCase(),
        })}`,
        buyer: r.email ?? "—",
        status: r.status,
        environment: r.environment,
      }));

      const robuxRows: LogRow[] = (pendingRes.data ?? []).map((r) => ({
        id: `r_${r.id}`,
        created_at: r.created_at,
        product_name: productNameMap.get(r.product_id) ?? "Unknown product",
        version: r.version,
        source: "robux",
        amount_label: "Robux",
        buyer: r.roblox_username,
        status: r.status,
      }));

      const combined = [...stripeRows, ...robuxRows].sort((a, b) =>
        a.created_at < b.created_at ? 1 : -1,
      );
      setRows(combined);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to load purchase log");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.source !== filter) return false;
      if (statusFilter === "fulfilled" && !isFulfilledStatus(r.status)) return false;
      if (statusFilter === "pending" && isFulfilledStatus(r.status)) return false;
      if (!term) return true;
      return (
        r.product_name.toLowerCase().includes(term) ||
        r.buyer.toLowerCase().includes(term) ||
        (r.version ?? "").toLowerCase().includes(term)
      );
    });
  }, [rows, filter, statusFilter, search]);

  const visible = filtered.slice(0, PAGE_SIZE);

  const exportCsv = () => {
    const header = ["Date", "Source", "Product", "Version", "Amount", "Buyer", "Status"];
    const lines = filtered.map((r) =>
      [
        new Date(r.created_at).toISOString(),
        r.source,
        r.product_name,
        r.version ?? "",
        r.amount_label,
        r.buyer,
        r.status,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `purchase-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center shrink-0">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-base">Purchase Log</h3>
            <p className="text-sm text-muted-foreground">
              All card and Robux purchases across the storefront.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Filter by product, buyer, version…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[220px]"
        />
        <Select value={filter} onValueChange={(v) => setFilter(v as SourceFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="card">Card only</SelectItem>
            <SelectItem value="robux">Robux only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[110px_70px_1fr_70px_100px_1fr_90px] gap-2 px-3 py-2 bg-muted/40 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <div>Date</div>
          <div>Source</div>
          <div>Product</div>
          <div>Ver</div>
          <div>Amount</div>
          <div>Buyer</div>
          <div>Status</div>
        </div>
        <ul className="divide-y divide-border max-h-[480px] overflow-auto">
          {visible.length === 0 ? (
            <li className="px-3 py-6 text-sm text-muted-foreground text-center">
              {loading ? "Loading…" : "No purchases found."}
            </li>
          ) : (
            visible.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-[110px_70px_1fr_70px_100px_1fr_90px] gap-2 px-3 py-2 text-xs items-center"
              >
                <div className="text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}{" "}
                  <span className="opacity-60">
                    {new Date(r.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div>
                  <Badge
                    variant={r.source === "card" ? "secondary" : "outline"}
                    className="text-[10px]"
                  >
                    {r.source}
                  </Badge>
                </div>
                <div className="truncate" title={r.product_name}>
                  {r.product_name}
                </div>
                <div className="font-mono text-[10px]">{r.version ?? "—"}</div>
                <div className="font-medium">{r.amount_label}</div>
                <div className="truncate" title={r.buyer}>
                  {r.buyer}
                </div>
                <div>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {r.status}
                  </Badge>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
      {filtered.length > visible.length && (
        <p className="text-xs text-muted-foreground text-center">
          Showing first {visible.length} of {filtered.length} matches. Refine filters to narrow.
        </p>
      )}
    </Card>
  );
};
