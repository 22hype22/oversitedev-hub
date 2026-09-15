// Choosing which dispatch desk you are buying.
//
// Oversite Dispatch is one product with three desks behind it: police, fire and
// EMS, and transportation. Picking one is a small decision taken in place, so it
// is four squares on a dimmed page rather than a page of its own.
//
// The fourth square is the package, and the only honest reason to take it is the
// relay: with more than one desk in the server, a unit asking police for an
// ambulance reaches the fire desk. That sentence is on the tile, and no badge
// claims a saving the operator has not set.
import { useEffect, useMemo, useState } from "react";
import { Ambulance, Loader2, Pencil, Shield, TrafficCone } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { setBotPricing, type BotPricing } from "@/hooks/useBotAvailability";

/** The desk ids, which are also the keys their prices are stored under. */
export const DESK_IDS = ["dispatch-pd", "dispatch-fd", "dispatch-dot"] as const;
export type DeskId = (typeof DESK_IDS)[number];

export const DESKS: {
  id: DeskId;
  name: string;
  what: string;
  icon: typeof Shield;
  /** The CSS variable carrying this desk's signal colour. */
  token: string;
}[] = [
  {
    id: "dispatch-pd",
    name: "Police",
    what: "911 calls, plates and warrants, traffic stops, pursuits.",
    icon: Shield,
    token: "--desk-pd",
  },
  {
    id: "dispatch-fd",
    name: "Fire and EMS",
    what: "Fire and medical calls, engines, rescues, ambulances.",
    icon: Ambulance,
    token: "--desk-fd",
  },
  {
    id: "dispatch-dot",
    name: "Transportation",
    what: "Hazards, tows and wreckers, road closures, traffic control.",
    icon: TrafficCone,
    token: "--desk-dot",
  },
];

export const deskName = (id: string) =>
  DESKS.find((d) => d.id === id)?.name ?? id;

/** What a desk costs, falling back to the Dispatch list price until the owner
 *  sets one of its own. */
export const deskPrice = (
  id: DeskId,
  pricing: Record<string, BotPricing>,
  fallback: number,
) => {
  const p = pricing[id];
  const list = Number(p?.price);
  if (!Number.isFinite(list) || list < 0) return fallback;
  const off = Number(p?.discount);
  const discount = Number.isFinite(off) && off > 0 ? Math.min(off, list) : 0;
  return Number((list - discount).toFixed(2));
};

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** The price split so the cents can sit small beside the figure, the way a
 *  console reads a number with its unit. */
function Figure({ value, className = "" }: { value: number; className?: string }) {
  const [whole, cents] = money(value).split(".");
  return (
    <span className={`font-light tabular-nums tracking-tight ${className}`}>
      {whole}
      <span className="text-[0.4em] font-medium text-muted-foreground align-baseline ml-0.5">
        .{cents}
      </span>
    </span>
  );
}

/** Owner-only price field, writing to the same store every other bot price
 *  uses, so desks are set where the rest of the catalogue is set. */
function DeskPriceEditor({ id, current }: { id: DeskId; current: number }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(current));
  const [busy, setBusy] = useState(false);
  useEffect(() => setValue(String(current)), [current, open]);

  const save = async () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Enter a price of 0 or more");
      return;
    }
    setBusy(true);
    const { data, error } = await setBotPricing(id, { price: n, discount: 0, pay: "both" });
    const res = data as { ok?: boolean; error?: string } | null;
    setBusy(false);
    if (error || !res?.ok) {
      toast.error("Could not save that price", {
        description: res?.error ?? error?.message ?? "Try again in a moment.",
      });
      return;
    }
    toast.success(`${deskName(id)} is now ${money(n)}`);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:text-foreground hover:border-muted-foreground"
      >
        <Pencil className="h-3 w-3" aria-hidden="true" />
        Price
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        inputMode="decimal"
        aria-label={`${deskName(id)} price`}
        className="h-7 w-20 text-xs"
      />
      <Button type="button" size="sm" className="h-7 px-2 text-xs" onClick={save} disabled={busy}>
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
      </Button>
      <Button
        type="button" size="sm" variant="ghost"
        className="h-7 px-2 text-xs"
        onClick={() => setOpen(false)}
      >
        Cancel
      </Button>
    </div>
  );
}

export function DispatchDeskPicker({
  open,
  onOpenChange,
  pricing,
  fallbackPrice,
  canManage,
  selected,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pricing: Record<string, BotPricing>;
  /** The Dispatch list price, used until a desk has one of its own. */
  fallbackPrice: number;
  canManage: boolean;
  /** Desks already chosen, so reopening the picker shows the current answer. */
  selected: DeskId[];
  onConfirm: (desks: DeskId[]) => void;
}) {
  // "all" is a choice of its own, not three ticks, because the package is what
  // the customer is buying when they take it.
  const [choice, setChoice] = useState<DeskId | "all" | null>(null);
  useEffect(() => {
    if (!open) return;
    setChoice(selected.length === DESKS.length ? "all" : (selected[0] ?? null));
  }, [open, selected]);

  const prices = useMemo(
    () => Object.fromEntries(DESKS.map((d) => [d.id, deskPrice(d.id, pricing, fallbackPrice)])) as
      Record<DeskId, number>,
    [pricing, fallbackPrice],
  );
  const packPrice = useMemo(
    () => Number(DESKS.reduce((sum, d) => sum + prices[d.id], 0).toFixed(2)),
    [prices],
  );
  const total = choice === "all" ? packPrice : choice ? prices[choice] : 0;

  const confirm = () => {
    if (!choice) return;
    onConfirm(choice === "all" ? DESKS.map((d) => d.id) : [choice]);
    onOpenChange(false);
  };

  const tileClass = (on: boolean) =>
    [
      "group relative flex flex-col overflow-hidden rounded-xl border p-4 text-left transition",
      "sm:aspect-square",
      on ? "border-[hsl(var(--sig))]" : "border-border hover:border-muted-foreground/40",
    ].join(" ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] p-0 gap-0 overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          <h2 className="text-[17px] font-semibold tracking-tight">Oversite Dispatch</h2>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Which desk are you running? Each one is a dispatcher on its own voice channel.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 px-5 sm:grid-cols-2">
          {DESKS.map((d) => {
            const on = choice === d.id;
            const Icon = d.icon;
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={on}
                onClick={() => setChoice(on ? null : d.id)}
                className={tileClass(on)}
                style={{ ["--sig" as string]: `var(${d.token})` }}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-aria-pressed:opacity-100"
                  style={{
                    background:
                      "radial-gradient(130% 95% at 8% 0%, hsl(var(--sig) / 0.18), transparent 64%)",
                  }}
                />
                <span className="relative flex items-center gap-2">
                  <Icon
                    className="h-4 w-4"
                    style={{ color: on ? "hsl(var(--sig))" : "hsl(var(--muted-foreground))" }}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-semibold tracking-tight">{d.name}</span>
                </span>
                <span className="relative mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
                  {d.what}
                </span>
                <span className="relative mt-auto flex items-end justify-between gap-2 pt-3">
                  <Figure value={prices[d.id]} className="text-[25px]" />
                  {canManage && <DeskPriceEditor id={d.id} current={prices[d.id]} />}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            aria-pressed={choice === "all"}
            onClick={() => setChoice(choice === "all" ? null : "all")}
            className={`${tileClass(choice === "all")} bg-muted/40 sm:col-span-2 sm:aspect-auto`}
            style={{ ["--sig" as string]: "var(--desk-pd)" }}
          >
            <span className="relative flex items-center gap-2">
              <span className="flex items-center gap-1" aria-hidden="true">
                {DESKS.map((d) => (
                  <i
                    key={d.id}
                    className="block h-[7px] w-[7px] rounded-full transition-colors"
                    style={{
                      background:
                        choice === "all" ? `hsl(var(${d.token}))` : "hsl(var(--border))",
                    }}
                  />
                ))}
              </span>
              <span className="text-sm font-semibold tracking-tight">All three desks</span>
              <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                3 bots
              </span>
            </span>
            <span className="relative mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
              Every desk, and they hand work to each other. Ask police for an ambulance
              and the fire desk gets it.
            </span>
            <span className="relative mt-3 flex items-end justify-between gap-2">
              <Figure value={packPrice} className="text-[25px]" />
            </span>
          </button>
        </div>

        <p className="mx-5 mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
          Each desk ships as its own bot, because Discord allows one voice connection per
          server per bot. You will create a Discord application for each one, and we walk
          you through it after checkout.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border px-5 py-4">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {choice === "all"
                ? "All three desks"
                : choice
                  ? deskName(choice)
                  : "Nothing picked"}
            </span>
            <div className="mt-1">
              <Figure value={total} className="text-[26px]" />
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={confirm} disabled={!choice}>
              {choice === "all" ? "Continue with all three" : "Continue"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
