import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Save, X, FileText, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useActiveGuild } from "@/hooks/useActiveGuild";

type PostField = {
  label: string;
  placeholder: string;
  required: boolean;
  style: "short" | "paragraph";
};

type PostType = {
  id: string;
  bot_id: string;
  guild_id: string;
  name: string;
  description: string | null;
  target_channel_id: string | null;
  fields: PostField[];
  created_at: string;
  updated_at: string;
};

type Props = { botId: string };

const MAX_FIELDS = 5;

const emptyField = (): PostField => ({
  label: "",
  placeholder: "",
  required: false,
  style: "short",
});

const emptyDraft = () => ({
  id: null as string | null,
  name: "",
  description: "",
  target_channel_id: "",
  fields: [emptyField()] as PostField[],
});

export function PostTypesManager({ botId }: Props) {
  const { toast } = useToast();
  const { guild } = useActiveGuild();
  const guildId = guild?.guild_id ?? "";

  const [rows, setRows] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ReturnType<typeof emptyDraft> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!botId || !guildId) {
      setRows([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("post_types" as any)
      .select("*")
      .eq("bot_id", botId)
      .eq("guild_id", guildId)
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      toast({ title: "Failed to load post types", description: error.message, variant: "destructive" });
      return;
    }
    setRows((data ?? []) as PostType[]);
  }, [botId, guildId, toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startCreate = () => setEditing(emptyDraft());
  const startEdit = (row: PostType) =>
    setEditing({
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      target_channel_id: row.target_channel_id ?? "",
      fields: row.fields?.length ? row.fields : [emptyField()],
    });

  const updateField = (idx: number, patch: Partial<PostField>) => {
    if (!editing) return;
    setEditing({
      ...editing,
      fields: editing.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    });
  };
  const addField = () => {
    if (!editing || editing.fields.length >= MAX_FIELDS) return;
    setEditing({ ...editing, fields: [...editing.fields, emptyField()] });
  };
  const removeField = (idx: number) => {
    if (!editing) return;
    setEditing({ ...editing, fields: editing.fields.filter((_, i) => i !== idx) });
  };

  const canSave = useMemo(() => {
    if (!editing) return false;
    if (!editing.name.trim()) return false;
    if (!editing.fields.length) return false;
    return editing.fields.every((f) => f.label.trim().length > 0);
  }, [editing]);

  const save = async () => {
    if (!editing || !canSave || !guildId) return;
    const payload = {
      bot_id: botId,
      guild_id: guildId,
      name: editing.name.trim(),
      description: editing.description.trim() || null,
      target_channel_id: editing.target_channel_id.trim() || null,
      fields: editing.fields,
    };
    const res = editing.id
      ? await supabase.from("post_types" as any).update(payload).eq("id", editing.id)
      : await supabase.from("post_types" as any).insert(payload);
    if (res.error) {
      toast({ title: "Save failed", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing.id ? "Post type updated" : "Post type created" });
    setEditing(null);
    refresh();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("post_types" as any).delete().eq("id", deleteId);
    setDeleteId(null);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Post type deleted" });
    refresh();
  };

  if (!guildId) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">
        Select a server to manage post types.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold">Post Types ({rows.length})</h4>
          <p className="text-xs text-muted-foreground">
            Templates that members can fill out with <code>/post</code>.
          </p>
        </div>
        {!editing && (
          <Button size="sm" onClick={startCreate}>
            <Plus className="h-4 w-4 mr-1" /> New type
          </Button>
        )}
      </div>

      {!editing && (
        <div className="space-y-2">
          {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
          {!loading && rows.length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">
              No post types yet. Create one to get started.
            </div>
          )}
          {rows.map((row) => (
            <Card key={row.id} className="p-3 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium truncate">{row.name}</div>
                  {row.description && (
                    <div className="text-xs text-muted-foreground line-clamp-2">{row.description}</div>
                  )}
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {row.fields?.length ?? 0} field{(row.fields?.length ?? 0) === 1 ? "" : "s"}
                    {row.target_channel_id && <> · channel {row.target_channel_id}</>}
                  </div>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => startEdit(row)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleteId(row.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Card className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="Suggestion"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              placeholder="Shown when members pick this post type"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Target channel ID</Label>
            <Input
              value={editing.target_channel_id}
              onChange={(e) => setEditing({ ...editing, target_channel_id: e.target.value })}
              placeholder="Discord channel ID where posts will be sent"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Fields ({editing.fields.length}/{MAX_FIELDS})</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={addField}
                disabled={editing.fields.length >= MAX_FIELDS}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add field
              </Button>
            </div>
            {editing.fields.map((f, idx) => (
              <Card key={idx} className="p-3 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-muted-foreground">Field {idx + 1}</div>
                  {editing.fields.length > 1 && (
                    <Button size="sm" variant="ghost" onClick={() => removeField(idx)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={f.label}
                      onChange={(e) => updateField(idx, { label: e.target.value })}
                      placeholder="Title"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Placeholder</Label>
                    <Input
                      value={f.placeholder}
                      onChange={(e) => updateField(idx, { placeholder: e.target.value })}
                      placeholder="Briefly describe…"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Style</Label>
                    <Select
                      value={f.style}
                      onValueChange={(v) => updateField(idx, { style: v as "short" | "paragraph" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">Short</SelectItem>
                        <SelectItem value="paragraph">Paragraph</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                    <Label className="text-xs">Required</Label>
                    <Switch
                      checked={f.required}
                      onCheckedChange={(v) => updateField(idx, { required: v })}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!canSave}>
              <Save className="h-4 w-4 mr-1" />
              {editing.id ? "Save changes" : "Create"}
            </Button>
          </div>
        </Card>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post type?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing posts that referenced this type will keep their content but lose the type label.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
