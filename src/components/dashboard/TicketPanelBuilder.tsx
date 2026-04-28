import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, AlertTriangle } from "lucide-react";

type Category = {
  id: string;
  name: string;
  roles: string; // comma separated role names
};

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function TicketPanelBuilder({ botName }: { botName: string }) {
  const [panelTitle, setPanelTitle] = useState("");
  const [panelDescription, setPanelDescription] = useState("");
  const [categories, setCategories] = useState<Category[]>([
    { id: uid(), name: "", roles: "" },
  ]);

  const updateCategory = (id: string, patch: Partial<Category>) =>
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const addCategory = () =>
    setCategories((prev) => [...prev, { id: uid(), name: "", roles: "" }]);

  const removeCategory = (id: string) =>
    setCategories((prev) => (prev.length === 1 ? prev : prev.filter((c) => c.id !== id)));

  return (
    <div className="space-y-5 py-2">
      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-sm text-foreground/90">
          This form will be submitted to{" "}
          <span className="font-semibold">{botName}</span>. Do not share passwords or
          other sensitive information.
        </p>
      </div>

      {/* Panel title */}
      <div className="space-y-2">
        <Label htmlFor="panel-title">
          Panel Title <span className="text-destructive">*</span>
        </Label>
        <Input
          id="panel-title"
          placeholder="e.g. Open a Ticket"
          value={panelTitle}
          onChange={(e) => setPanelTitle(e.target.value)}
        />
      </div>

      {/* Panel description */}
      <div className="space-y-2">
        <Label htmlFor="panel-description">
          Panel Description <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="panel-description"
          placeholder="e.g. Select a category below to open a ticket."
          value={panelDescription}
          onChange={(e) => setPanelDescription(e.target.value)}
          rows={3}
        />
      </div>

      {/* Categories — each with a paired roles area */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>
            Categories <span className="text-destructive">*</span>
          </Label>
          <Button type="button" size="sm" variant="outline" onClick={addCategory}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add category
          </Button>
        </div>

        <div className="space-y-3">
          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              className="rounded-md border border-border bg-card/40 p-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Category {idx + 1}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-muted-foreground hover:text-destructive"
                  onClick={() => removeCategory(cat.id)}
                  disabled={categories.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`cat-name-${cat.id}`} className="text-sm">
                  Category name
                </Label>
                <Input
                  id={`cat-name-${cat.id}`}
                  placeholder="e.g. Development"
                  value={cat.name}
                  onChange={(e) => updateCategory(cat.id, { name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`cat-roles-${cat.id}`} className="text-sm">
                  Roles for this category
                </Label>
                <Textarea
                  id={`cat-roles-${cat.id}`}
                  placeholder="e.g. Board of Directors, Development Team"
                  value={cat.roles}
                  onChange={(e) => updateCategory(cat.id, { roles: e.target.value })}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separate multiple roles. One line per group if needed.
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
