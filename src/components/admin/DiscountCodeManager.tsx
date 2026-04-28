import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Tag, Sparkles, Trash2, Copy, Power } from "lucide-react";

interface DiscountCode {
  id: string;
  code: string;
  kind: "percent" | "amount";
  value: number;
  max_uses: number | null;
  times_used: number;
  expires_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

function randomCode(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function DiscountCodeManager() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("10");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchCodes = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("discount_codes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Couldn't load codes", { description: error.message });
    else setCodes((data || []) as DiscountCode[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  const handleGenerate = () => setCode(randomCode());

  const handleCreate = async () => {
    const trimmed = code.trim().toUpperCase();
    const num = parseFloat(value);
    if (!trimmed) return toast.error("Code is required");
    if (!Number.isFinite(num) || num <= 0) return toast.error("Value must be greater than 0");
    if (kind === "percent" && num > 100) return toast.error("Percent can't exceed 100");

    setCreating(true);
    const { error } = await (supabase as any).from("discount_codes").insert({
      code: trimmed,
      kind,
      value: num,
      max_uses: maxUses ? parseInt(maxUses, 10) : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      notes: notes.trim() || null,
    });
    setCreating(false);
    if (error) {
      toast.error("Couldn't create code", { description: error.message });
      return;
    }
    toast.success(`Code ${trimmed} created`);
    setCode("");
    setNotes("");
    setMaxUses("");
    setExpiresAt("");
    fetchCodes();
  };

  const toggleActive = async (c: DiscountCode) => {
    const { error } = await (supabase as any)
      .from("discount_codes")
      .update({ is_active: !c.is_active })
      .eq("id", c.id);
    if (error) toast.error(error.message);
    else fetchCodes();
  };

  const deleteCode = async (c: DiscountCode) => {
    if (!confirm(`Delete code ${c.code}?`)) return;
    const { error } = await (supabase as any)
      .from("discount_codes")
      .delete()
      .eq("id", c.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      fetchCodes();
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center">
          <Tag className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Discount codes</h3>
          <p className="text-sm text-muted-foreground">
            Generate promo codes redeemable in the bot builder checkout.
          </p>
        </div>
      </div>

      {/* Create form */}
      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs">Code</Label>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="WELCOME10"
                maxLength={32}
              />
              <Button type="button" variant="outline" size="icon" onClick={handleGenerate} title="Generate random">
                <Sparkles className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as "percent" | "amount")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="percent">% off</option>
              <option value="amount">$ off</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Value</Label>
            <Input
              type="number"
              min="0"
              step={kind === "percent" ? "1" : "0.01"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={kind === "percent" ? "10" : "25"}
            />
          </div>
          <div>
            <Label className="text-xs">Max uses</Label>
            <Input
              type="number"
              min="1"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="∞"
            />
          </div>
          <div>
            <Label className="text-xs">Expires</Label>
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Notes (internal)</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Twitter giveaway"
            maxLength={200}
          />
        </div>
        <Button onClick={handleCreate} disabled={creating} className="w-full md:w-auto">
          {creating ? "Creating…" : "Create code"}
        </Button>
      </div>

      {/* List */}
      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No codes yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2 px-2">Code</th>
                  <th className="text-left py-2 px-2">Discount</th>
                  <th className="text-left py-2 px-2">Used</th>
                  <th className="text-left py-2 px-2">Expires</th>
                  <th className="text-center py-2 px-2">Status</th>
                  <th className="text-right py-2 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id} className="border-b border-border/50">
                    <td className="py-2 px-2 font-mono font-semibold">{c.code}</td>
                    <td className="py-2 px-2">
                      {c.kind === "percent" ? `${c.value}%` : `$${Number(c.value).toFixed(2)}`} off
                    </td>
                    <td className="py-2 px-2">
                      {c.times_used}{c.max_uses ? ` / ${c.max_uses}` : ""}
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">
                      {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {c.is_active ? (
                        <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/20">
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/15 text-red-500 border border-red-500/30 hover:bg-red-500/20">
                          Disabled
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <div className="inline-flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => copy(c.code)} title="Copy">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => toggleActive(c)} title="Toggle">
                          <Power className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteCode(c)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
