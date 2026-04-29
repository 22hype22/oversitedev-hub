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


  if (!bot) return null;

  const owned = new Set(bot.addons);
  const available = getAddonIdsForBase(bot.base).filter((id) => !owned.has(id));

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

        <div className="flex-1 overflow-y-auto pr-1 -mr-1">
          {available.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              You already own every add-on available for this bot. 🎉
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
