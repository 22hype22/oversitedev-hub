import { useEffect, useMemo, useRef, useState } from "react";
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
import { AddonConfigCard } from "./AddonConfigCard";
import { useBotAddonStates } from "@/hooks/useBotAddonStates";

/**
 * Per-user reorderable grid of addon config cards.
 *
 * Order is persisted in the `dashboard_addon_order` table scoped by user id +
 * bot id + group key, so each viewer rearranges their own dashboard and the
 * order follows them across devices. localStorage is also written as a
 * fast-paint cache so reorders feel instant before/while the DB round-trip
 * resolves.
 *
 * Cards can only be reordered within their own group (Protection / Support /
 * Utilities / Extras) — there's a separate <SortableAddonGrid> per group, so
 * cross-group dragging is impossible by construction.
 */

type Props = {
  userId: string;
  botId: string;
  botName: string;
  botAvatarUrl?: string | null;
  groupKey: string;
  /** Default order coming from the catalog. */
  ids: string[];
  /** Optional addon id to highlight (search match). */
  highlightedAddonId?: string | null;
};

const storageKey = (userId: string, botId: string, groupKey: string) =>
  `addon-order:${userId}:${botId}:${groupKey}`;

/** Reconcile a saved order against the current id list:
 *  - keep saved ids that still exist (in saved order)
 *  - append any new ids that weren't in the saved order yet */
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
  highlighted,
}: {
  id: string;
  botId: string;
  botName: string;
  botAvatarUrl?: string | null;
  highlighted?: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: dialogOpen,
    transition: {
      duration: 180,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
    cursor: isDragging ? "grabbing" : undefined,
    willChange: isDragging ? "transform" : undefined,
    touchAction: "none",
  };

  // While a dialog is open, strip drag listeners entirely so nothing in the
  // grid can be reordered by accident.
  const dragProps = dialogOpen ? {} : { ...attributes, ...listeners };

  return (
    <div
      ref={setNodeRef}
      id={`addon-card-${botId}-${id}`}
      data-addon-id={id}
      className={`scroll-mt-28 rounded-xl transition-shadow ${
        highlighted
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg shadow-primary/20"
          : ""
      }`}
      style={style}
      {...dragProps}
    >
      <AddonConfigCard
        addonId={id}
        botId={botId}
        botName={botName}
        botAvatarUrl={botAvatarUrl}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
export function SortableAddonGrid({
  userId,
  botId,
  botName,
  botAvatarUrl,
  groupKey,
  ids,
  highlightedAddonId,
}: Props) {
  const key = useMemo(
    () => storageKey(userId, botId, groupKey),
    [userId, botId, groupKey],
  );

  // Initial value: hit localStorage cache for instant paint, reconcile against
  // current ids. The DB-loaded order overrides this once it arrives.
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

  // Skip persisting on the very first render (which just reflects the cached
  // value, not a user action).
  const skipSaveRef = useRef(true);
  // Used to suppress the persistence effect when we apply a server-loaded order.
  const justLoadedRef = useRef(false);

  // Load order from the DB on mount / when scope changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("dashboard_addon_order")
        .select("ordered_ids")
        .eq("user_id", userId)
        .eq("bot_id", botId)
        .eq("group_key", groupKey)
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
  }, [userId, botId, groupKey]);

  // Re-reconcile when the upstream ids list changes (e.g. user adds an addon).
  useEffect(() => {
    setOrder((prev) => reconcile(prev, ids));
  }, [ids]);

  // Persist on change — to localStorage immediately, and upsert to DB.
  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    if (justLoadedRef.current) {
      justLoadedRef.current = false;
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(order));
    } catch {
      /* ignore quota errors */
    }
    // Fire-and-forget upsert. Failures are non-critical (cache still has it).
    void (supabase as any)
      .from("dashboard_addon_order")
      .upsert(
        {
          user_id: userId,
          bot_id: botId,
          group_key: groupKey,
          ordered_ids: order,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,bot_id,group_key" },
      );
  }, [key, order, userId, botId, groupKey]);

  // PointerSensor with a small distance so click-to-open the dialog still works.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const from = prev.indexOf(String(active.id));
      const to = prev.indexOf(String(over.id));
      if (from < 0 || to < 0) return prev;
      return arrayMove(prev, from, to);
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {order.map((id) => (
            <SortableCard
              key={`${botId}-${id}`}
              id={id}
              botId={botId}
              botName={botName}
              botAvatarUrl={botAvatarUrl}
              highlighted={highlightedAddonId === id}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
