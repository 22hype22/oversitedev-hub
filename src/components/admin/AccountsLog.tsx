import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Download, Users } from "lucide-react";

type AccountRow = {
  id: string;
  user_id: string;
  roblox_username: string;
  discord_username: string;
  created_at: string;
};

const PAGE_SIZE = 50;

export const AccountsLog = () => {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, roblox_username, discord_username, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (!error && data) setRows(data as AccountRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.roblox_username.toLowerCase().includes(q) ||
        r.discord_username.toLowerCase().includes(q) ||
        r.user_id.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const visible = filtered.slice(0, PAGE_SIZE);

  const exportCsv = () => {
    const header = ["created_at", "roblox_username", "discord_username", "user_id"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      lines.push(
        [r.created_at, r.roblox_username, r.discord_username, r.user_id]
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Account Signups</h3>
            <p className="text-sm text-muted-foreground">
              Newly created user profiles, most recent first.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search Roblox / Discord username or user ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No accounts found.</p>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border max-h-[420px] overflow-auto">
          {visible.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{r.roblox_username}</span>
                  <Badge variant="secondary" className="font-normal">
                    Discord: {r.discord_username}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {r.user_id}
                </div>
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(r.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered.length > PAGE_SIZE && (
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Showing {PAGE_SIZE} of {filtered.length} matching accounts. Refine search to narrow.
        </p>
      )}
    </Card>
  );
};
