import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { toast } from "sonner";

type Category = {
  id: string;
  name: string;
  sort_order: number;
};

export const CategoryManager = () => {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("product_categories")
      .select("id, name, sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) {
      toast.error(error.message);
    } else {
      setCats(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const addCategory = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setBusy(true);
    const nextOrder = (cats[cats.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await (supabase as any)
      .from("product_categories")
      .insert({ name: trimmed, sort_order: nextOrder });
    setBusy(false);
    if (error) {
      toast.error(
        error.code === "23505" ? "That category already exists." : error.message,
      );
      return;
    }
    setNewName("");
    toast.success(`Added "${trimmed}".`);
    load();
  };

  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setEditingName(c.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveEdit = async (c: Category) => {
    const trimmed = editingName.trim();
    if (!trimmed || trimmed === c.name) {
      cancelEdit();
      return;
    }
    setBusy(true);
    // Rename category in product_categories AND propagate to products
    const { error } = await (supabase as any)
      .from("product_categories")
      .update({ name: trimmed })
      .eq("id", c.id);
    if (error) {
      setBusy(false);
      toast.error(
        error.code === "23505" ? "A category with that name already exists." : error.message,
      );
      return;
    }
    // Update existing products to keep them grouped under the renamed tab
    await (supabase as any)
      .from("products")
      .update({ category: trimmed })
      .eq("category", c.name);
    setBusy(false);
    cancelEdit();
    toast.success("Category renamed.");
    load();
  };

  const remove = async (c: Category) => {
    if (!confirm(`Delete category "${c.name}"? Products in it will need a new category.`)) return;
    setBusy(true);
    const { error } = await (supabase as any)
      .from("product_categories")
      .delete()
      .eq("id", c.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Deleted "${c.name}".`);
    load();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= cats.length) return;
    const a = cats[index];
    const b = cats[target];
    const reordered = [...cats];
    reordered[index] = b;
    reordered[target] = a;
    setCats(reordered);
    setBusy(true);
    // Reassign sort_order for ALL rows so values stay clean
    const updates = reordered.map((c, i) =>
      (supabase as any)
        .from("product_categories")
        .update({ sort_order: i + 1 })
        .eq("id", c.id),
    );
    const results = await Promise.all(updates);
    setBusy(false);
    const failed = results.find((r: any) => r.error);
    if (failed?.error) {
      toast.error(failed.error.message);
      load();
    }
  };

  return (
    <Card className="p-6 bg-card border-border">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center">
          <Tags className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold tracking-tight">Product Categories</h3>
          <p className="text-sm text-muted-foreground">
            Add, rename, reorder, or remove the tabs shown on the storefront.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        <Input
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addCategory();
          }}
          disabled={busy}
        />
        <Button onClick={addCategory} disabled={busy || !newName.trim()} variant="hero">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : cats.length === 0 ? (
        <p className="text-sm text-muted-foreground">No categories yet. Add one above.</p>
      ) : (
        <ul className="space-y-2">
          {cats.map((c, i) => (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded-md border border-border bg-background/50 p-2"
            >
              <Badge variant="secondary" className="font-mono text-[10px]">
                {i + 1}
              </Badge>
              {editingId === c.id ? (
                <>
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(c);
                      if (e.key === "Escape") cancelEdit();
                    }}
                    autoFocus
                    className="h-8"
                  />
                  <Button size="sm" variant="hero" onClick={() => saveEdit(c)} disabled={busy}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelEdit} disabled={busy}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium">{c.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => move(i, -1)}
                    disabled={busy || i === 0}
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => move(i, 1)}
                    disabled={busy || i === cats.length - 1}
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startEdit(c)}
                    disabled={busy}
                    aria-label="Rename"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(c)}
                    disabled={busy}
                    aria-label="Delete"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
