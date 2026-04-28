import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowRight, Save, Settings2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { getAddonConfig, type AddonField } from "@/lib/addonConfigs";
import { getAddonLabel } from "@/lib/botCatalog";
import { SayCommandBuilder } from "./SayCommandBuilder";
import { TicketPanelBuilder } from "./TicketPanelBuilder";

type Props = {
  addonId: string;
  botName: string;
  botAvatarUrl?: string | null;
};

/**
 * One configuration "box" per add-on. Click → opens a dialog whose form
 * is built from the add-on's field schema in addonConfigs.ts.
 *
 * Mock UI only — values live in local state and "save" shows a toast.
 */
export function AddonConfigCard({ addonId, botName, botAvatarUrl }: Props) {
  const isSayCommand = addonId === "messages";
  const isTicketPanel = addonId === "ticket-message-customization";
  const isAnonReport = addonId === "anonymous-reporting";
  const config = getAddonConfig(addonId);
  const [open, setOpen] = useState(false);

  // Generic, untyped form state — schema-driven.
  const [values, setValues] = useState<Record<string, string | number | boolean | string[]>>({});

  useEffect(() => {
    if (!config) return;
    const initial: Record<string, string | number | boolean | string[]> = {};
    for (const f of config.fields) {
      initial[f.key] =
        f.defaultValue ??
        (f.type === "toggle"
          ? false
          : f.type === "number"
            ? 0
            : f.type === "multiselect"
              ? []
              : "");
    }
    setValues(initial);
  }, [config, addonId]);

  // Add-ons we don't have a schema for yet — show a stub box so we know
  // it's owned but configuration is still wired up.
  if (!config) {
    return (
      <Card className="bg-card/40 border-dashed border-border p-6 flex flex-col min-h-[170px]">
        <div className="flex items-start gap-3 mb-3">
          <div className="h-10 w-10 rounded-lg bg-muted/40 border border-border grid place-items-center shrink-0">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-base leading-tight pt-1.5">
            {getAddonLabel(addonId)}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground flex-1">
          Configuration coming soon for this add-on.
        </p>
      </Card>
    );
  }

  const Icon = config.icon;

  const setValue = (k: string, v: string | number | boolean | string[]) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const toggleMulti = (k: string, optionValue: string) =>
    setValues((prev) => {
      const current = Array.isArray(prev[k]) ? (prev[k] as string[]) : [];
      const next = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue];
      return { ...prev, [k]: next };
    });

  const renderField = (f: AddonField) => {
    const value = values[f.key];

    if (f.type === "toggle") {
      return (
        <div className="flex items-start justify-between gap-4 py-1">
          <div className="space-y-1">
            <Label htmlFor={f.key} className="cursor-pointer">{f.label}</Label>
            {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
          </div>
          <Switch
            id={f.key}
            checked={!!value}
            onCheckedChange={(v) => setValue(f.key, v)}
          />
        </div>
      );
    }

    if (f.type === "select") {
      return (
        <div className="space-y-2">
          <Label htmlFor={f.key}>{f.label}</Label>
          <Select
            value={String(value ?? "")}
            onValueChange={(v) => setValue(f.key, v)}
          >
            <SelectTrigger id={f.key}>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {f.options?.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
        </div>
      );
    }

    if (f.type === "multiselect") {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-2">
          <Label>{f.label}</Label>
          <div className="grid gap-2 rounded-md border border-border p-3">
            {f.options?.map((o) => {
              const checked = selected.includes(o.value);
              return (
                <label
                  key={o.value}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={checked}
                    onChange={() => toggleMulti(f.key, o.value)}
                  />
                  <span>{o.label}</span>
                </label>
              );
            })}
          </div>
          {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
        </div>
      );
    }

    if (f.type === "textarea") {
      return (
        <div className="space-y-2">
          <Label htmlFor={f.key}>{f.label}</Label>
          <Textarea
            id={f.key}
            value={String(value ?? "")}
            placeholder={f.placeholder}
            onChange={(e) => setValue(f.key, e.target.value)}
            rows={4}
          />
          {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
        </div>
      );
    }

    // text / channel / role / number
    return (
      <div className="space-y-2">
        <Label htmlFor={f.key}>{f.label}</Label>
        <Input
          id={f.key}
          type={f.type === "number" ? "number" : "text"}
          value={String(value ?? "")}
          placeholder={f.placeholder}
          onChange={(e) =>
            setValue(
              f.key,
              f.type === "number" ? Number(e.target.value) : e.target.value,
            )
          }
        />
        {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
      </div>
    );
  };

  return (
    <>
      <Card
        onClick={() => setOpen(true)}
        className="group cursor-pointer bg-card hover:bg-card/80 border-border hover:border-primary/50 hover:shadow-elegant transition-smooth p-6 flex flex-col min-h-[170px]"
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center shrink-0 group-hover:bg-primary/15 transition-smooth">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-semibold text-base leading-tight pt-1.5">
            {config.title}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground flex-1">{config.summary}</p>
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted-foreground">
            {config.fields.length} setting{config.fields.length === 1 ? "" : "s"}
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-smooth" />
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={
            isSayCommand
              ? "max-w-5xl max-h-[90vh] overflow-y-auto"
              : "max-w-lg max-h-[85vh] overflow-y-auto"
          }
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-primary" />
              {config.title}
            </DialogTitle>
            <DialogDescription>
              Configure <span className="text-foreground font-medium">{config.title}</span> for{" "}
              <span className="text-foreground font-medium">{botName}</span>.
            </DialogDescription>
          </DialogHeader>

          {isSayCommand ? (
            <div className="py-2">
              <SayCommandBuilder botName={botName} botAvatarUrl={botAvatarUrl} />
            </div>
          ) : isTicketPanel ? (
            <TicketPanelBuilder botName={botName} variant="ticket" />
          ) : isAnonReport ? (
            <TicketPanelBuilder botName={botName} variant="report" />
          ) : (
            <div className="space-y-5 py-2">
              {config.fields.map((f) => (
                <div key={f.key}>{renderField(f)}</div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.success(`${config.title} settings saved`);
                setOpen(false);
              }}
            >
              <Save className="h-4 w-4 mr-1.5" />
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
