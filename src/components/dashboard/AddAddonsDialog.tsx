import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOwnedBots, type OwnedBot } from "@/hooks/useOwnedBots";
import {
  getAddonCategory,
  getAddonIdsForBase,
  getAddonLabel,
  getAddonPrice,
  type AddonCategory,
} from "@/lib/botCatalog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Plus, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

interface AddAddonsDialogProps {
  bot: OwnedBot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CategoryFilter = "all" | AddonCategory;
type SortMode = "default" | "price-asc" | "price-desc" | "name-asc";

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: "All categories",
  protection: "Protection",
  support: "Support",
  utilities: "Utilities",
  shared: "Extras",
};

export function AddAddonsDialog({ bot, open, onOpenChange }: AddAddonsDialogProps) {
  const { hasDashboardAccess, reload } = useOwnedBots();
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("default");

  // Reset selection + filters when the bot changes or dialog reopens
  useEffect(() => {
    if (open) {
      setSelected([]);
      setQuery("");
      setCategory("all");
      setSortMode("default");
    }
  }, [open, bot?.id]);


  const owned = useMemo(() => new Set(bot?.addons ?? []), [bot?.addons.join("|")]);
  const allAvailable = useMemo(
    () => (bot ? getAddonIdsForBase(bot.base).filter((id) => !owned.has(id)) : []),
    [bot?.base, bot?.addons.join("|"), owned],
  );

  // Counts per category — used to disable empty filter chips.
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      all: allAvailable.length,
      protection: 0,
      support: 0,
      utilities: 0,
      shared: 0,
    };
    for (const id of allAvailable) counts[getAddonCategory(id)]++;
    return counts;
  }, [allAvailable]);

  // Apply search + category + sort.
  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = allAvailable.filter((id) => {
      if (category !== "all" && getAddonCategory(id) !== category) return false;
      if (!q) return true;
      return (
        getAddonLabel(id).toLowerCase().includes(q) ||
        id.toLowerCase().includes(q)
      );
    });
    if (sortMode === "price-asc") {
      list = [...list].sort((a, b) => getAddonPrice(a) - getAddonPrice(b));
    } else if (sortMode === "price-desc") {
      list = [...list].sort((a, b) => getAddonPrice(b) - getAddonPrice(a));
    } else if (sortMode === "name-asc") {
      list = [...list].sort((a, b) =>
        getAddonLabel(a).localeCompare(getAddonLabel(b)),
      );
    }
    return list;
  }, [allAvailable, query, category, sortMode]);

  const total = selected.reduce((sum, id) => {
    // Dashboard add-on is a one-time, account-wide unlock — free if owned
    if (id === "dashboard" && hasDashboardAccess) return sum;
    return sum + getAddonPrice(id);
  }, 0);

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );


  const submit = async () => {
    if (selected.length === 0) return;
    setSubmitting(true);
    const newAddons = Array.from(new Set([...bot.addons, ...selected]));
    const { error } = await (supabase as any)
      .from("bot_orders")
      .update({ addons: newAddons, updated_at: new Date().toISOString() })
      .eq("id", bot.id);
    setSubmitting(false);
    if (error) {
      toast.error("Couldn't add add-ons", { description: error.message });
      return;
    }
    toast.success(
      `Added ${selected.length} add-on${selected.length === 1 ? "" : "s"} to "${bot.bot_name}"`,
      { description: "We'll be in touch about billing for the new add-ons." }
    );
    await reload();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Add more add-ons to "{bot.bot_name}"
          </DialogTitle>
          <DialogDescription>
            Pick anything you'd like to add. We'll be in touch with payment
            details after you submit — your bot keeps running in the meantime.
          </DialogDescription>
        </DialogHeader>

        {allAvailable.length > 0 && (
          <div className="space-y-3 border-b border-border pb-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search add-ons…"
                  className="pl-9 pr-9"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-smooth"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                <SelectTrigger className="sm:w-44">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default order</SelectItem>
                  <SelectItem value="name-asc">Name (A→Z)</SelectItem>
                  <SelectItem value="price-asc">Price (low→high)</SelectItem>
                  <SelectItem value="price-desc">Price (high→low)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map((key) => {
                const count = categoryCounts[key];
                const active = category === key;
                const disabled = key !== "all" && count === 0;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={disabled}
                    onClick={() => setCategory(key)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-smooth ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : disabled
                          ? "bg-background/40 border-border/40 text-muted-foreground/50 cursor-not-allowed"
                          : "bg-background/40 border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {CATEGORY_LABELS[key]} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-1 -mr-1">
          {allAvailable.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              You already own every add-on available for this bot. 🎉
            </div>
          ) : available.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No add-ons match your search or filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {available.map((id) => {
                const active = selected.includes(id);
                const isFreeDashboard = id === "dashboard" && hasDashboardAccess;
                const price = getAddonPrice(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle(id)}
                    className={`text-left rounded-lg border p-3 transition-smooth ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border/60 bg-background/40 hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium">{getAddonLabel(id)}</div>
                      <div
                        className={`h-4 w-4 rounded border grid place-items-center shrink-0 mt-0.5 ${
                          active ? "bg-primary border-primary" : "border-border"
                        }`}
                      >
                        {active && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                    </div>
                    <div className="mt-1.5 text-xs text-muted-foreground">
                      {isFreeDashboard ? (
                        <span className="text-primary font-medium">
                          Included — already unlocked
                        </span>
                      ) : (
                        <>+${price.toFixed(2)}</>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border pt-4 flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
          <div className="flex items-center gap-3 text-sm">
            <Badge variant="secondary">
              {selected.length} selected
            </Badge>
            <span className="text-muted-foreground">
              Total: <span className="text-foreground font-semibold">${total.toFixed(2)}</span>
            </span>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={submitting || selected.length === 0}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              {submitting ? "Submitting…" : "Add to bot"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
