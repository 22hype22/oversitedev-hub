import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Braces, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { countVariables, variablesFor, type VariableGroup } from "@/lib/messageVariables";

/**
 * Which block, and which design inside it, the message builders on screen are
 * editing. Set by AddonConfigCard so every builder it renders shows the right
 * variables without each site having to pass them.
 */
type Scope = { addonId: string | null; key: string | null; setKey: (k: string | null) => void };
const ScopeCtx = createContext<Scope>({ addonId: null, key: null, setKey: () => {} });

export function VariablesScopeProvider({ addonId, children }: { addonId: string; children: ReactNode }) {
  const [key, setKey] = useState<string | null>(null);
  const value = useMemo(() => ({ addonId, key, setKey }), [addonId, key]);
  return <ScopeCtx.Provider value={value}>{children}</ScopeCtx.Provider>;
}

export function useVariablesScope() {
  return useContext(ScopeCtx);
}

/**
 * The Variables button and the side panel it opens. Lists every variable for
 * the block (and design) being edited, grouped, with what each one fills in.
 * Tapping one copies it; pass `onInsert` to also drop it into a text field.
 */
export function VariablesPanel({
  groups,
  onInsert,
  size = "sm",
  className,
}: {
  groups: VariableGroup[];
  onInsert?: (token: string) => void;
  size?: "sm" | "xs";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const total = countVariables(groups);
  if (total === 0) return null;

  const pick = (token: string) => {
    try { void navigator.clipboard?.writeText(token); } catch { /* ignore */ }
    if (onInsert) {
      onInsert(token);
      toast.success(`Added ${token}`);
    } else {
      toast.success(`Copied ${token}`);
    }
    setCopied(token);
    window.setTimeout(() => setCopied((c) => (c === token ? null : c)), 1200);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`gap-1.5 shrink-0 ${size === "xs" ? "h-7 px-2 text-[11px]" : ""} ${className ?? ""}`}
        onClick={() => setOpen(true)}
      >
        <Braces className="h-3.5 w-3.5" /> Variables
        <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">{total}</span>
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60 text-left">
            <SheetTitle className="text-base">Variables</SheetTitle>
            <SheetDescription className="text-xs">
              {onInsert ? "Tap one to add it where your cursor is." : "Tap one to copy it, then paste it into your message."}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            {groups.map((g) => (
              <div key={g.title} className="py-2">
                <div className="px-5 pt-2 pb-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{g.title}</p>
                  {g.note && <p className="mt-0.5 text-[11px] text-muted-foreground/80 leading-snug">{g.note}</p>}
                </div>
                {g.vars.map((v) => (
                  <button
                    key={v.token}
                    type="button"
                    onClick={() => pick(v.token)}
                    className="w-full flex items-start gap-3 px-5 py-2 text-left hover:bg-muted/60 transition-colors"
                  >
                    <code className="mt-0.5 text-[11px] font-mono text-os-accent bg-os-accent/10 border border-os-accent/25 rounded px-1.5 py-0.5 shrink-0 whitespace-nowrap">
                      {v.token}
                    </code>
                    <span className="flex-1 text-[12px] text-muted-foreground leading-snug">{v.desc}</span>
                    {copied === v.token
                      ? <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-400" />
                      : <Copy className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/40" />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * The Variables button for the current scope. Message builders render this
 * so every design gets the right list automatically; `keyOverride` narrows
 * to one design when a block holds several side by side.
 */
export function ScopedVariablesPanel({ keyOverride, groups: explicit, onInsert, size, className }: {
  keyOverride?: string | null;
  groups?: VariableGroup[];
  onInsert?: (token: string) => void;
  size?: "sm" | "xs";
  className?: string;
}) {
  const scope = useVariablesScope();
  const groups = explicit ?? (scope.addonId ? variablesFor(scope.addonId, keyOverride ?? scope.key) : []);
  return <VariablesPanel groups={groups} onInsert={onInsert} size={size} className={className} />;
}
