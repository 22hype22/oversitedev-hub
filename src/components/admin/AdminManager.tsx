import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crown, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

type AllowlistRow = {
  id: string;
  email: string;
  created_at: string;
};

export const AdminManager = () => {
  const [rows, setRows] = useState<AllowlistRow[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_allowlist")
      .select("id, email, created_at")
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Failed to load admins");
    } else {
      setRows(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const addAdmin = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^\S+@\S+\.\S+$/.test(trimmed)) {
      toast.error("Enter a valid email");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("admin_allowlist")
      .insert({ email: trimmed });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Already on allowlist" : "Failed to add admin");
    } else {
      toast.success(`${trimmed} added. They'll get admin access on next sign-in.`);
      setEmail("");
      load();
    }
    setBusy(false);
  };

  const removeAdmin = async (row: AllowlistRow) => {
    if (row.email.toLowerCase() === "everant00@gmail.com") {
      toast.error("Cannot remove the super admin");
      return;
    }
    if (!confirm(`Remove ${row.email} from admins?`)) return;
    setBusy(true);
    const { error } = await supabase
      .from("admin_allowlist")
      .delete()
      .eq("id", row.id);
    if (error) {
      toast.error("Failed to remove");
    } else {
      toast.success("Removed from allowlist");
      load();
    }
    setBusy(false);
  };

  return (
    <Card className="p-6 border-primary/30 bg-primary/5">
      <div className="flex items-start gap-3 mb-5">
        <div className="h-10 w-10 rounded-lg bg-primary/15 border border-primary/30 grid place-items-center shrink-0">
          <Crown className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg leading-tight">Admin Management</h3>
          <p className="text-sm text-muted-foreground">
            Super-admin only. Add emails to grant admin access on their next sign-in.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        <Input
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addAdmin()}
          disabled={busy}
        />
        <Button onClick={addAdmin} disabled={busy} variant="hero">
          <UserPlus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No admins on the allowlist.</p>
        ) : (
          rows.map((row) => {
            const isSuper = row.email.toLowerCase() === "everant00@gmail.com";
            return (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isSuper && <Crown className="h-4 w-4 text-primary shrink-0" />}
                  <span className="text-sm truncate">{row.email}</span>
                  {isSuper && (
                    <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                      Super
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeAdmin(row)}
                  disabled={busy || isSuper}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};
