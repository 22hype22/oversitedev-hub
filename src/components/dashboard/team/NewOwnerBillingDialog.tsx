import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CreditCard } from "lucide-react";

type Billing = {
  billing_name: string;
  company: string;
  billing_email: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

const EMPTY: Billing = {
  billing_name: "", company: "", billing_email: "",
  address_line1: "", address_line2: "", city: "", state: "",
  postal_code: "", country: "",
};

/**
 * Shown automatically after an ownership transfer completes (or whenever the
 * current owner's billing row is flagged `needs_update = true`).
 */
export function NewOwnerBillingDialog({ forceOpen = false }: { forceOpen?: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Billing>(EMPTY);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("dashboard_billing_info")
        .select("*")
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (data) {
        setForm({
          billing_name: data.billing_name ?? "",
          company: data.company ?? "",
          billing_email: data.billing_email ?? user.email ?? "",
          address_line1: data.address_line1 ?? "",
          address_line2: data.address_line2 ?? "",
          city: data.city ?? "",
          state: data.state ?? "",
          postal_code: data.postal_code ?? "",
          country: data.country ?? "",
        });
        if (data.needs_update || forceOpen) setOpen(true);
      } else if (forceOpen) {
        setForm({ ...EMPTY, billing_email: user.email ?? "" });
        setOpen(true);
      }
      setLoading(false);
    })();
  }, [user, forceOpen]);

  const [overrideCode, setOverrideCode] = useState("");

  const save = async () => {
    if (!user) return;

    // Override code path — bypass normal validation entirely
    if (overrideCode.trim()) {
      setSaving(true);
      const { data, error } = await (supabase as any).rpc(
        "redeem_billing_override_code",
        { _code: overrideCode.trim() },
      );
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data) {
        toast.error("Invalid or expired override code");
        return;
      }
      toast.success("Override accepted — account marked as paid");
      setOpen(false);
      return;
    }

    if (!form.billing_name.trim() || !form.billing_email.trim() || !form.address_line1.trim() || !form.country.trim()) {
      toast.error("Please fill in name, email, address, and country");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any)
      .from("dashboard_billing_info")
      .upsert({
        owner_user_id: user.id,
        ...form,
        needs_update: false,
        updated_at: new Date().toISOString(),
      });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Billing info saved");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* must complete billing or enter override code */ }}>
      <DialogContent
        className="max-w-lg [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Confirm your billing details
          </DialogTitle>
          <DialogDescription>
            You're now the owner of this account. Please confirm the billing
            information we should use going forward — this replaces the previous
            owner's details on file.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full name *" value={form.billing_name} onChange={(v) => setForm({ ...form, billing_name: v })} />
              <Field label="Company" value={form.company} onChange={(v) => setForm({ ...form, company: v })} />
            </div>
            <Field label="Billing email *" type="email" value={form.billing_email} onChange={(v) => setForm({ ...form, billing_email: v })} />
            <Field label="Address line 1 *" value={form.address_line1} onChange={(v) => setForm({ ...form, address_line1: v })} />
            <Field label="Address line 2" value={form.address_line2} onChange={(v) => setForm({ ...form, address_line2: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
              <Field label="State / region" value={form.state} onChange={(v) => setForm({ ...form, state: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Postal code" value={form.postal_code} onChange={(v) => setForm({ ...form, postal_code: v })} />
              <Field label="Country *" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
            </div>

            <div className="grid gap-1 pt-3 mt-2 border-t border-border">
              <Label className="text-xs">Override code (optional)</Label>
              <Input
                value={overrideCode}
                onChange={(e) => setOverrideCode(e.target.value.toUpperCase())}
                placeholder="ABCD1234"
                maxLength={16}
                className="font-mono tracking-widest"
              />
              <p className="text-xs text-muted-foreground">
                Enter this if your payment was processed outside of the platform (e.g. PayPal).
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save billing details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
