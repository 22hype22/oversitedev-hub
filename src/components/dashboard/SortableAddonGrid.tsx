import { useEffect, useMemo, useState } from "react";
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
import { AddonConfigCard } from "./AddonConfigCard";

/**
 * Per-user reorderable grid of addon config cards.
 *
 * Order is persisted in localStorage scoped by user id + bot id + group key,
 * so each viewer rearranges their own dashboard without affecting anyone else.
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
  botName,
  botAvatarUrl,
}: {
  id: string;
  botName: string;
  botAvatarUrl?: string | null;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? "grabbing" : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <AddonConfigCard
        addonId={id}
        botName={botName}
        botAvatarUrl={botAvatarUrl}
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
}: Props) {
  const key = useMemo(
    () => storageKey(userId, botId, groupKey),
    [userId, botId, groupKey],
  );

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

  // Re-reconcile when the upstream ids list changes (e.g. user adds an addon).
  useEffect(() => {
    setOrder((prev) => reconcile(prev, ids));
  }, [ids]);

  // Persist on change.
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(order));
    } catch {
      /* ignore quota errors */
    }
  }, [key, order]);

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
              botName={botName}
              botAvatarUrl={botAvatarUrl}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
