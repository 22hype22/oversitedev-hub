import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpCircle, Search, UserSearch } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type PurchaseRow = {
  id: string;
  product_id: string | null;
  product_name: string;
  version: string | null;
  email: string | null;
  user_id: string | null;
  created_at: string;
  source_label: string;
};

type VersionOption = { version: string; file_url: string | null; file_name: string | null };

export const UserVersionUpgrader = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [versionsByProduct, setVersionsByProduct] = useState<Record<string, VersionOption[]>>({});
  const [selectedVersion, setSelectedVersion] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleSearch = async () => {
    const term = searchTerm.trim();
    if (!term) {
      toast.error("Enter an email or Roblox username");
      return;
    }
    setSearching(true);
    setPurchases([]);
    setVersionsByProduct({});
    try {
      // Find matching user_ids via profiles (roblox or discord username)
      const { data: profileMatches } = await supabase
        .from("profiles")
        .select("user_id, roblox_username, discord_username")
        .or(`roblox_username.ilike.%${term}%,discord_username.ilike.%${term}%`);

      const userIds = (profileMatches ?? []).map((p) => p.user_id);

      // Stripe purchases by email OR user_id
      let stripeQuery = supabase
        .from("purchases")
        .select("id, product_id, product_name, version, email, user_id, created_at")
        .order("created_at", { ascending: false });
      const filters = [`email.ilike.%${term}%`];
      if (userIds.length) filters.push(`user_id.in.(${userIds.join(",")})`);
      stripeQuery = stripeQuery.or(filters.join(","));
      const { data: stripeData, error: stripeErr } = await stripeQuery;
      if (stripeErr) throw stripeErr;

      // Pending (Robux) purchases by roblox_username
      const { data: pendingData, error: pendErr } = await supabase
        .from("pending_purchases")
        .select("id, product_id, roblox_username, version, created_at, status")
        .ilike("roblox_username", `%${term}%`)
        .order("created_at", { ascending: false });
      if (pendErr) throw pendErr;

      // Look up product names for pending rows
      const pendingProductIds = Array.from(
        new Set((pendingData ?? []).map((r) => r.product_id).filter(Boolean)),
      );
      let productNameMap = new Map<string, string>();
      if (pendingProductIds.length) {
        const { data: prods } = await supabase
          .from("products")
          .select("id, name")
          .in("id", pendingProductIds);
        productNameMap = new Map((prods ?? []).map((p) => [p.id, p.name]));
      }

      const combined: PurchaseRow[] = [
        ...((stripeData ?? []).map((r) => ({
          id: r.id,
          product_id: r.product_id,
          product_name: r.product_name,
          version: r.version,
          email: r.email,
          user_id: r.user_id,
          created_at: r.created_at,
          source_label: "Card",
        }))),
        ...((pendingData ?? []).map((r) => ({
          id: r.id,
          product_id: r.product_id,
          product_name: productNameMap.get(r.product_id) ?? "Unknown product",
          version: r.version,
          email: null,
          user_id: null,
          created_at: r.created_at,
          source_label: `Robux · ${r.roblox_username}`,
        }))),
      ];

      if (!combined.length) {
        toast.info("No purchases found for that user");
      }

      // Load all versions for the unique product_ids
      const productIds = Array.from(
        new Set(combined.map((r) => r.product_id).filter(Boolean) as string[]),
      );
      if (productIds.length) {
        const { data: vers } = await supabase
          .from("product_versions")
          .select("product_id, version, file_url, file_name")
          .in("product_id", productIds)
          .order("created_at", { ascending: false });
        const grouped: Record<string, VersionOption[]> = {};
        for (const v of vers ?? []) {
          if (!grouped[v.product_id]) grouped[v.product_id] = [];
          grouped[v.product_id].push({
            version: v.version,
            file_url: v.file_url,
            file_name: v.file_name,
          });
        }
        setVersionsByProduct(grouped);
      }

      setPurchases(combined);
    } catch (err: any) {
      toast.error(err.message ?? "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const applyVersion = async (row: PurchaseRow) => {
    const newVersion = selectedVersion[row.id];
    if (!newVersion) {
      toast.error("Pick a version first");
      return;
    }
    setBusyId(row.id);
    try {
      const versionMeta = (row.product_id && versionsByProduct[row.product_id]) || [];
      const match = versionMeta.find((v) => v.version === newVersion);

      // Stripe purchase rows live in `purchases`; Robux rows live in `pending_purchases`.
      const isPending = row.source_label.startsWith("Robux");
      if (isPending) {
        const { error } = await supabase
          .from("pending_purchases")
          .update({ version: newVersion })
          .eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("purchases")
          .update({
            version: newVersion,
            file_url: match?.file_url ?? null,
            file_name: match?.file_name ?? null,
          })
          .eq("id", row.id);
        if (error) throw error;
      }
      toast.success(`Set ${row.product_name} to v${newVersion}`);
      setPurchases((prev) =>
        prev.map((p) => (p.id === row.id ? { ...p, version: newVersion } : p)),
      );
    } catch (err: any) {
      toast.error(err.message ?? "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center shrink-0">
          <ArrowUpCircle className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-base">Force Version Upgrade</h3>
          <p className="text-sm text-muted-foreground">
            Find a customer by email or Roblox/Discord username and set the version
            on any of their purchases.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="user-search" className="text-xs">
            Email or username
          </Label>
          <Input
            id="user-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="user@email.com or RobloxName"
          />
        </div>
        <Button onClick={handleSearch} disabled={searching} className="self-end">
          {searching ? (
            <>
              <Search className="h-4 w-4 mr-2 animate-pulse" />
              Searching…
            </>
          ) : (
            <>
              <UserSearch className="h-4 w-4 mr-2" />
              Search
            </>
          )}
        </Button>
      </div>

      {purchases.length > 0 && (
        <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
          {purchases.map((row) => {
            const versions = (row.product_id && versionsByProduct[row.product_id]) || [];
            return (
              <li key={row.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{row.product_name}</p>
                      {row.version && (
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          {row.version}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {row.source_label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {row.email ?? "—"} · {new Date(row.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedVersion[row.id] ?? ""}
                      onValueChange={(v) =>
                        setSelectedVersion((prev) => ({ ...prev, [row.id]: v }))
                      }
                      disabled={!versions.length}
                    >
                      <SelectTrigger className="h-9 w-[140px]">
                        <SelectValue
                          placeholder={versions.length ? "Pick version" : "No versions"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {versions.map((v) => (
                          <SelectItem key={v.version} value={v.version}>
                            v{v.version}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="hero"
                      disabled={busyId === row.id || !selectedVersion[row.id]}
                      onClick={() => applyVersion(row)}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};
