"use client";

import { ReactNode, useState } from "react";
import { CardId, useDashboardVisibility } from "@/components/dashboard-visibility-provider";

/** A single dashboard card slotted into the reorderable grid. */
export type DashboardCard = {
  id: CardId;
  node: ReactNode;
  /** Optional DOM id kept on this card's wrapper so onboarding deep-links can scroll to it. */
  anchorId?: string;
};

/** Six-dot grip icon signalling that a card can be dragged. */
function DragGrip() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
      <circle cx="2.5" cy="2.5" r="1.5" />
      <circle cx="7.5" cy="2.5" r="1.5" />
      <circle cx="2.5" cy="7.5" r="1.5" />
      <circle cx="7.5" cy="7.5" r="1.5" />
      <circle cx="2.5" cy="12.5" r="1.5" />
      <circle cx="7.5" cy="12.5" r="1.5" />
    </svg>
  );
}

interface DraggableCardGridProps {
  cards: DashboardCard[];
  columns: string;
}

/**
 * Renders the dashboard's cards in one responsive grid where any card can be dragged to any slot.
 * Order is read from and persisted through the dashboard visibility provider. Only the grip handle
 * arms the drag, so the cards themselves stay fully clickable and their content stays selectable.
 */
export function DraggableCardGrid({ cards, columns }: DraggableCardGridProps) {
  const { cardOrder, reorderCard } = useDashboardVisibility();
  const [grabbedId, setGrabbedId] = useState<CardId | null>(null);
  const [draggingId, setDraggingId] = useState<CardId | null>(null);
  const [dragOverId, setDragOverId] = useState<CardId | null>(null);

  const cardById = new Map(cards.map((card) => [card.id, card]));
  const orderedCards = cardOrder
    .map((id) => cardById.get(id))
    .filter((card): card is DashboardCard => Boolean(card));

  if (orderedCards.length === 0) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: columns,
        gap: "20px",
        alignItems: "start",
        marginBottom: "32px",
      }}
    >
      {orderedCards.map((card) => {
        const isDragging = draggingId === card.id;
        const isDragOver = dragOverId === card.id && draggingId !== null && draggingId !== card.id;

        return (
          <div
            key={card.id}
            id={card.anchorId}
            className="card-drag-slot"
            draggable={grabbedId === card.id}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              setDraggingId(card.id);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setDragOverId(null);
              setGrabbedId(null);
            }}
            onDragOver={(event) => {
              if (draggingId === null) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              if (card.id !== draggingId) setDragOverId(card.id);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setDragOverId(null);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (draggingId && draggingId !== card.id) reorderCard(draggingId, card.id);
              setDragOverId(null);
            }}
            style={{
              position: "relative",
              borderRadius: "16px",
              opacity: isDragging ? 0.4 : 1,
              outline: isDragOver ? "2px dashed #f59e0b99" : "2px dashed transparent",
              outlineOffset: "5px",
              transition: "opacity 0.15s ease, outline-color 0.15s ease",
            }}
          >
            {/* Grip handle — floats above the card's top edge and is the only drag initiator. */}
            <div
              className="card-drag-handle"
              role="button"
              aria-label="Drag to reorder card"
              title="Drag to reorder"
              onMouseDown={() => setGrabbedId(card.id)}
              onMouseUp={() => setGrabbedId(null)}
              style={{
                position: "absolute",
                top: "-11px",
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "34px",
                height: "20px",
                borderRadius: "999px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
                cursor: grabbedId === card.id ? "grabbing" : "grab",
                zIndex: 2,
              }}
            >
              <DragGrip />
            </div>
            {card.node}
          </div>
        );
      })}
    </div>
  );
}
