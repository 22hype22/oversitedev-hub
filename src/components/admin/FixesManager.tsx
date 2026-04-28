import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Wrench, Trash2, Plus } from "lucide-react";

type Fix = {
  id: string;
  title: string;
  body: string | null;
  severity: string;
  is_active: boolean;
  created_at: string;
};

const SEVERITY_OPTIONS = [
  { value: "fix", label: "Fix" },
  { value: "info", label: "Info" },
  { value: "warning", label: "Heads up" },
  { value: "resolved", label: "Resolved" },
];

/** Admin tool to post short notes / fixes that show up in a bar at the top
 *  of every user's bot dashboard. */
export function FixesManager() {
  const [fixes, setFixes] = useState<Fix[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState("fix");

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("dashboard_fixes")
      .select("id, title, body, severity, is_active, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast.error("Couldn't load fixes — " + error.message);
      setFixes([]);
    } else {
      setFixes((data ?? []) as Fix[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("dashboard_fixes").insert({
      title: title.trim(),
      body: body.trim() || null,
      severity,
      is_active: true,
      created_by: userData?.user?.id ?? null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Couldn't post — " + error.message);
      return;
    }
    toast.success("Fix posted");
    setTitle("");
    setBody("");
    setSeverity("fix");
    void load();
  };

  const toggleActive = async (f: Fix, active: boolean) => {
    const { error } = await (supabase as any)
      .from("dashboard_fixes")
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .eq("id", f.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setFixes((prev) =>
      prev.map((x) => (x.id === f.id ? { ...x, is_active: active } : x)),
    );
  };

  const remove = async (f: Fix) => {
    if (!confirm(`Delete "${f.title}"?`)) return;
    const { error } = await (supabase as any)
      .from("dashboard_fixes")
      .delete()
      .eq("id", f.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setFixes((prev) => prev.filter((x) => x.id !== f.id));
    toast.success("Deleted");
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center">
          <Wrench className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            Dashboard Fixes & Notes
          </h3>
          <p className="text-sm text-muted-foreground">
            Posts here show up in a bar at the top of every user's bot
            dashboard.
          </p>
        </div>
      </div>

      <Card className="p-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-[1fr_180px]">
          <div className="space-y-2">
            <Label htmlFor="fix-title">Title</Label>
            <Input
              id="fix-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fixed ticket panel buttons not posting"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fix-severity">Type</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger id="fix-severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fix-body">Details (optional)</Label>
          <Textarea
            id="fix-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Anything users should know."
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={submit} disabled={submitting}>
            <Plus className="h-4 w-4 mr-1.5" />
            {submitting ? "Posting…" : "Post fix"}
          </Button>
        </div>
      </Card>

      <div className="mt-6 space-y-3">
        <div className="text-sm font-semibold text-muted-foreground">
          Recent ({fixes.length})
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : fixes.length === 0 ? (
          <Card className="p-6 text-center border-dashed">
            <p className="text-sm text-muted-foreground">No fixes posted yet.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {fixes.map((f) => (
              <Card key={f.id} className="p-3 flex items-start gap-3">
                <Badge variant="outline" className="text-xs shrink-0 mt-0.5">
                  {f.severity}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{f.title}</div>
                  {f.body && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-0.5">
                      {f.body}
                    </p>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(f.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={f.is_active}
                      onCheckedChange={(v) => toggleActive(f, v)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {f.is_active ? "Active" : "Hidden"}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(f)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
