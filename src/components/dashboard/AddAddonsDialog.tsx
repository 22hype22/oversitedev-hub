import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOwnedBots, type OwnedBot } from "@/hooks/useOwnedBots";
import { useAddonOverrides } from "@/hooks/useAddonOverrides";
import {
  getAddonCategory,
  getAddonIdsForBase,
  getAddonLabel,
  getIncludedAddonsForBase,
  type AddonCategory,
} from "@/lib/botCatalog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Plus, Puzzle, Search, X } from "lucide-react";
import { toast } from "sonner";

interface AddAddonsDialogProps {
  bot: OwnedBot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CategoryFilter = "all" | AddonCategory;
type SortMode = "default" | "name-asc";

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: "All categories",
  protection: "Protection",
  support: "Support",
  utilities: "Utilities",
  shared: "Extras",
};

export function AddAddonsDialog({ bot, open, onOpenChange }: AddAddonsDialogProps) {
  const { reload } = useOwnedBots();
  const { isIncluded } = useAddonOverrides();
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("default");

  // An addon is considered "already provisioned" if any of:
  //   - it's on the bot order (purchased)
  //   - it's part of the bot's base (free, always-on)
  //   - admin has flipped it to INCLUDED globally (free for everyone)
  const owned = useMemo(() => {
    if (!bot) return new Set<string>();
    const set = new Set<string>(bot.addons ?? []);
    for (const id of getIncludedAddonsForBase(bot.base)) set.add(id);
    return set;
  }, [bot?.id, bot?.base, bot?.addons.join("|")]);

  const allAvailable = useMemo(
    () =>
      bot
        ? getAddonIdsForBase(bot.base).filter(
            (id) => !owned.has(id),
          )
        : [],
    [bot?.base, owned],
  );

  // Reset selection + filters when the bot changes or dialog reopens
  // Auto-select any add-ons that are marked as included (free).
  useEffect(() => {
    if (open) {
      const preselected = allAvailable.filter((id) => isIncluded(id));
      setSelected(preselected);
      setQuery("");
      setCategory("all");
      setSortMode("default");
    }
  }, [open, bot?.id, allAvailable, isIncluded]);


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
    if (sortMode === "name-asc") {
      list = [...list].sort((a, b) =>
        getAddonLabel(a).localeCompare(getAddonLabel(b)),
      );
    }
    return list;
  }, [allAvailable, query, category, sortMode]);

  if (!bot) return null;

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
      { description: "They're included free — your bot will pick them up shortly." }
    );
    await reload();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="osad-dialog p-0 gap-0 border-0 bg-transparent shadow-none max-w-none w-auto sm:rounded-none">
        <style>{ADDON_CSS}</style>
        <DialogTitle className="sr-only">Add more add-ons to {bot.bot_name}</DialogTitle>
        <DialogDescription className="sr-only">
          Every add-on is included free. Pick which ones to add to this bot.
        </DialogDescription>

        <div className="osad">
          <div className="modal">
            <div className="mhead">
              <div className="mtitle">
                <span className="spark"><Puzzle /></span>
                Add more add-ons to “{bot.bot_name}”
              </div>
              <button
                type="button"
                className="mclose"
                aria-label="Close"
                onClick={() => !submitting && onOpenChange(false)}
              >
                <X />
              </button>
              <div className="msub">
                Pick anything you’d like to add — every add-on is included free.
                Choose only what your team should have access to; your bot keeps
                running in the meantime.
              </div>
            </div>

            {allAvailable.length > 0 && (
              <>
                <div className="mctl">
                  <div className="search">
                    <Search />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search add-ons…"
                    />
                    {query && (
                      <button
                        type="button"
                        className="sclear"
                        onClick={() => setQuery("")}
                        aria-label="Clear search"
                      >
                        <X />
                      </button>
                    )}
                  </div>
                  <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                    <SelectTrigger className="osadsort">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default order</SelectItem>
                      <SelectItem value="name-asc">Name (A→Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="chips">
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
                        className={`chip${active ? " on" : ""}${disabled ? " off" : ""}`}
                      >
                        {CATEGORY_LABELS[key]} ({count})
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="mlist">
              {allAvailable.length === 0 ? (
                <div className="mempty">You already have all available add-ons.</div>
              ) : available.length === 0 ? (
                <div className="mempty">No add-ons match your search or filter.</div>
              ) : (
                available.map((id) => {
                  const active = selected.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggle(id)}
                      className={`aitem${active ? " sel" : ""}`}
                    >
                      <div className="an">{getAddonLabel(id)}</div>
                      <div className="af">Included — free to add</div>
                      <span className="box"><Check /></span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="mfoot">
              <span className="selcount">{selected.length} selected</span>
              <span className="freelbl">All included — free</span>
              <span className="spacer" />
              <button
                type="button"
                className="btn"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn pri"
                onClick={submit}
                disabled={submitting || selected.length === 0}
              >
                <Plus />
                {submitting ? "Adding…" : "Add to bot"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const ADDON_CSS = `
/* Hide the shadcn default close button — we render our own styled one. */
.osad-dialog > button{display:none !important}

.osad{
  --panel:#1c2127;--panel2:#20262d;--surface:#232a31;--surface2:#2a323b;--hair:#333c46;
  --heading:#E8EEF3;--body:#A8B4BF;--faint:#79858f;--accent:#C9DBE6;--accentink:#1b2127;
  --accdim:rgba(201,219,230,.10);--accbord:rgba(201,219,230,.45);
  font-family:"Space Grotesk",system-ui,-apple-system,"Segoe UI",sans-serif;
}
.osad *{box-sizing:border-box}
.osad svg{display:block}
.osad .modal{width:min(92vw,640px);background:linear-gradient(180deg,var(--panel),var(--panel2));
  border:1px solid var(--hair);border-radius:18px;box-shadow:0 40px 90px -30px rgba(0,0,0,.8);
  display:flex;flex-direction:column;max-height:86vh;overflow:hidden}

.osad .mhead{padding:22px 24px 0;position:relative}
.osad .mtitle{display:flex;align-items:center;gap:11px;font-family:"Bricolage Grotesque","Space Grotesk",sans-serif;
  font-weight:800;font-size:18.5px;letter-spacing:-.01em;color:var(--heading);padding-right:34px}
.osad .mtitle .spark{height:30px;width:30px;border-radius:9px;flex:none;display:grid;place-items:center;
  background:var(--accdim);border:1px solid var(--accbord);color:var(--accent)}
.osad .mtitle .spark svg{width:16px;height:16px;stroke:currentColor;stroke-width:1.8;fill:none}
.osad .mclose{position:absolute;top:20px;right:20px;height:30px;width:30px;border-radius:8px;border:1px solid transparent;
  background:transparent;color:var(--faint);display:grid;place-items:center;cursor:pointer;transition:.15s}
.osad .mclose:hover{background:var(--surface2);color:var(--heading)}
.osad .mclose svg{width:16px;height:16px;stroke:currentColor;stroke-width:2;fill:none}
.osad .msub{margin-top:10px;font-size:13px;color:var(--faint);line-height:1.5;max-width:540px}

.osad .mctl{padding:16px 24px;display:flex;gap:10px;border-bottom:1px solid var(--hair)}
.osad .search{flex:1;position:relative;min-width:0}
.osad .search>svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:15px;height:15px;stroke:var(--faint);stroke-width:1.9;fill:none;pointer-events:none}
.osad .search input{width:100%;height:40px;border-radius:11px;border:1px solid var(--hair);background:var(--panel2);
  color:var(--heading);font-family:inherit;font-size:13.5px;padding:0 34px 0 36px}
.osad .search input::placeholder{color:var(--faint)}
.osad .search input:focus{outline:none;border-color:var(--accbord)}
.osad .sclear{position:absolute;right:8px;top:50%;transform:translateY(-50%);height:24px;width:24px;border-radius:7px;
  border:0;background:transparent;color:var(--faint);display:grid;place-items:center;cursor:pointer}
.osad .sclear:hover{background:var(--surface2);color:var(--heading)}
.osad .sclear svg{width:14px;height:14px;stroke:currentColor;stroke-width:2;fill:none}
.osad .osadsort{height:40px;min-width:152px;border-radius:11px;border:1px solid var(--hair);background:var(--panel2);
  color:var(--heading);font-family:inherit;font-size:13.5px;padding:0 12px}

.osad .chips{padding:14px 24px;display:flex;flex-wrap:wrap;gap:8px;border-bottom:1px solid var(--hair)}
.osad .chip{border:1px solid var(--hair);background:var(--panel2);color:var(--body);border-radius:20px;
  padding:5px 13px;font-family:inherit;font-size:12.5px;font-weight:500;cursor:pointer;transition:.14s}
.osad .chip:hover{border-color:var(--accbord);color:var(--heading)}
.osad .chip.on{background:var(--accent);border-color:var(--accent);color:var(--accentink);font-weight:700}
.osad .chip.off{opacity:.4;cursor:not-allowed}
.osad .chip.off:hover{border-color:var(--hair);color:var(--body)}

.osad .mlist{padding:16px 24px;overflow-y:auto;display:grid;grid-template-columns:1fr 1fr;gap:11px;align-content:start}
@media(max-width:560px){.osad .mlist{grid-template-columns:1fr}}
.osad .mempty{grid-column:1/-1;text-align:center;padding:38px 0;font-size:13px;color:var(--faint)}
.osad .aitem{position:relative;text-align:left;border:1px solid var(--hair);background:var(--surface);border-radius:13px;
  padding:14px 15px;cursor:pointer;transition:.14s;font-family:inherit}
.osad .aitem:hover{border-color:var(--accbord)}
.osad .aitem.sel{border-color:var(--accbord);background:var(--accdim)}
.osad .aitem .an{font-size:13.5px;font-weight:600;color:var(--heading);padding-right:26px;line-height:1.3}
.osad .aitem .af{margin-top:5px;font-size:11.5px;font-weight:500;color:var(--accent)}
.osad .aitem .box{position:absolute;top:13px;right:13px;height:19px;width:19px;border-radius:6px;border:1.5px solid var(--hair);
  display:grid;place-items:center;transition:.14s}
.osad .aitem.sel .box{background:var(--accent);border-color:var(--accent)}
.osad .aitem .box svg{width:12px;height:12px;stroke:var(--accentink);stroke-width:3;fill:none;opacity:0}
.osad .aitem.sel .box svg{opacity:1}

.osad .mfoot{padding:16px 24px;border-top:1px solid var(--hair);display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.osad .selcount{font-size:12px;font-weight:600;color:var(--body);background:var(--surface2);border:1px solid var(--hair);
  border-radius:8px;padding:4px 10px}
.osad .freelbl{font-size:13px;font-weight:600;color:var(--accent)}
.osad .spacer{flex:1}
.osad .btn{height:40px;border-radius:11px;font-family:inherit;font-size:13.5px;font-weight:600;cursor:pointer;padding:0 16px;
  border:1px solid var(--hair);background:transparent;color:var(--body);transition:.15s}
.osad .btn:hover{background:var(--surface2);color:var(--heading)}
.osad .btn:disabled{opacity:.5;cursor:default}
.osad .btn.pri{background:var(--accent);border-color:var(--accent);color:var(--accentink);font-weight:700;
  display:inline-flex;align-items:center;gap:7px}
.osad .btn.pri:hover:not(:disabled){filter:brightness(1.05)}
.osad .btn.pri:disabled{background:var(--accent);opacity:.45}
.osad .btn.pri svg{width:15px;height:15px;stroke:currentColor;stroke-width:2.4;fill:none}
`;
