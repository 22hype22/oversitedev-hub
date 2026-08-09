import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
// Lazy — the addon editor bundle is large; defer it like SortableAddonGrid does.
const AddonConfigCard = lazy(() =>
  import("./AddonConfigCard").then((m) => ({ default: m.AddonConfigCard })),
);
import { TicketEditorCard } from "./TicketEditorCard";
import { useBotAddonStates } from "@/hooks/useBotAddonStates";

/**
 * Customs "Extras" grid — a SHARED, owner-controlled reorderable grid.
 *
 * Unlike <SortableAddonGrid> (which stores a *per-viewer* order), the order
 * here is stored ONCE under the bot OWNER's user id:
 *   - Only the owner can drag to reorder (`canReorder`).
 *   - The order they set is read by every team member — the existing
 *     dashboard_addon_order RLS already allows any team member to SELECT and
 *     only `edit_bot_config` (the owner) to write, so reading the owner's row
 *     gives the whole team the same, owner-defined layout.
 *
 * Columns use an inline `grid-template-columns` (not the Tailwind `grid`
 * class) so the scoped `.osd .grid{grid-template-columns:2fr 1fr}` rule in
 * BotDashboard's CSS can't hijack the layout.
 */

const GROUP_KEY = "shared";

const storageKey = (ownerUserId: string, botId: string) =>
  `addon-order:${ownerUserId}:${botId}:${GROUP_KEY}`;

/** Keep saved ids that still exist (in saved order); append any new ones. */
function reconcile(saved: string[] | null, current: string[]): string[] {
  if (!saved || saved.length === 0) return current;
  const currentSet = new Set(current);
  const kept = saved.filter((id) => currentSet.has(id));
  const keptSet = new Set(kept);
  const appended = current.filter((id) => !keptSet.has(id));
  return [...kept, ...appended];
}

function SortableCard({
  id,
  botId,
  botName,
  botAvatarUrl,
  engineVersion,
  canReorder,
  enabled,
  onToggleEnabled,
}: {
  id: string;
  botId: string;
  botName: string;
  botAvatarUrl?: string | null;
  engineVersion?: "v1" | "v2";
  canReorder: boolean;
  enabled: boolean;
  onToggleEnabled: (next: boolean) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const dragDisabled = dialogOpen || !canReorder;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: dragDisabled,
    transition: { duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
    cursor: isDragging ? "grabbing" : canReorder ? "grab" : undefined,
    willChange: isDragging ? "transform" : undefined,
    touchAction: canReorder ? "none" : undefined,
  };

  const dragProps = dragDisabled ? {} : { ...attributes, ...listeners };

  return (
    <div
      ref={setNodeRef}
      id={`addon-card-${botId}-${id}`}
      data-addon-id={id}
      className="scroll-mt-28 rounded-xl"
      style={style}
      {...dragProps}
    >
      <Suspense fallback={<div className="h-24 rounded-xl border border-border/40 bg-card/40 animate-pulse" />}>
        {id === "ticket-editor" ? (
          <TicketEditorCard
            botId={botId}
            botName={botName}
            botAvatarUrl={botAvatarUrl}
            engineVersion={engineVersion}
          />
        ) : (
          <AddonConfigCard
            addonId={id}
            botId={botId}
            botName={botName}
            botAvatarUrl={botAvatarUrl}
            engineVersion={engineVersion}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            enabled={enabled}
            onToggleEnabled={onToggleEnabled}
          />
        )}
      </Suspense>
    </div>
  );
}

export function CustomsAddonGrid({
  botId,
  ownerUserId,
  botName,
  botAvatarUrl,
  engineVersion,
  ids,
  canReorder,
}: {
  botId: string;
  /** The bot OWNER's user id — the shared order is stored/read under this id. */
  ownerUserId: string;
  botName: string;
  botAvatarUrl?: string | null;
  engineVersion?: "v1" | "v2";
  ids: string[];
  /** Only the owner may drag to reorder; team members get a read-only layout. */
  canReorder: boolean;
}) {
  const key = useMemo(() => storageKey(ownerUserId, botId), [ownerUserId, botId]);

  const [order, setOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return ids;
    try {
      const raw = window.localStorage.getItem(key);
      const saved = raw ? (JSON.parse(raw) as string[]) : null;
      return reconcile(saved, ids);
    } catch {
      return ids;
    }
  });

  const skipSaveRef = useRef(true);
  const justLoadedRef = useRef(false);

  // Load the shared order (owner's row) from the DB on mount / scope change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("dashboard_addon_order")
        .select("ordered_ids")
        .eq("user_id", ownerUserId)
        .eq("bot_id", botId)
        .eq("group_key", GROUP_KEY)
        .maybeSingle();
      if (cancelled || error) return;
      const saved = (data?.ordered_ids ?? null) as string[] | null;
      if (!saved) return;
      const next = reconcile(saved, ids);
      justLoadedRef.current = true;
      setOrder(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerUserId, botId]);

  // Re-reconcile when the upstream ids list changes (e.g. a card is added).
  useEffect(() => {
    setOrder((prev) => reconcile(prev, ids));
  }, [ids]);

  // Persist ONLY when the owner reorders. Team members never write (and RLS
  // would reject them anyway — write requires edit_bot_config).
  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    if (justLoadedRef.current) {
      justLoadedRef.current = false;
      return;
    }
    if (!canReorder) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(order));
    } catch {
      /* ignore quota errors */
    }
    void (supabase as any)
      .from("dashboard_addon_order")
      .upsert(
        {
          user_id: ownerUserId,
          bot_id: botId,
          group_key: GROUP_KEY,
          ordered_ids: order,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,bot_id,group_key" },
      );
  }, [key, order, ownerUserId, botId, canReorder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    if (!canReorder) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const from = prev.indexOf(String(active.id));
      const to = prev.indexOf(String(over.id));
      if (from < 0 || to < 0) return prev;
      return arrayMove(prev, from, to);
    });
  };

  const { isEnabled, setEnabled } = useBotAddonStates(botId);

  // Disabled cards sink to the back; enabled cards keep their (owner) order —
  // so toggling a card back on returns it to its spot. Stable sort via filter.
  const displayOrder = useMemo(() => {
    const enabled = order.filter((id) => isEnabled(id));
    const disabled = order.filter((id) => !isEnabled(id));
    return [...enabled, ...disabled];
  }, [order, isEnabled]);

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "20px",
    alignItems: "stretch",
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={displayOrder} strategy={rectSortingStrategy}>
        <div style={gridStyle}>
          {displayOrder.map((id) => (
            <SortableCard
              key={`${botId}-${id}`}
              id={id}
              botId={botId}
              botName={botName}
              botAvatarUrl={botAvatarUrl}
              engineVersion={engineVersion}
              canReorder={canReorder}
              enabled={isEnabled(id)}
              onToggleEnabled={(next) => void setEnabled(id, next)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
