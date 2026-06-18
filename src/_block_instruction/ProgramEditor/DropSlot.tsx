import { useDroppable } from "@dnd-kit/core";

export type SlotData = {
  type: "slot";
  programId: string;
  containerPath: number[];
  insertIndex: number;
};

interface DropSlotProps {
  programId: string;
  containerPath: number[];
  insertIndex: number;
  isDragging: boolean;
  variant?: "normal" | "empty";
}

export function DropSlot({
  programId,
  containerPath,
  insertIndex,
  isDragging,
  variant = "normal",
}: DropSlotProps) {
  const id = `slot:${programId}:${containerPath.join(",")}:${insertIndex}`;
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: "slot",
      programId,
      containerPath,
      insertIndex,
    } satisfies SlotData,
  });

  const isEmpty = variant === "empty";

  return (
    <div
      ref={setNodeRef}
      style={{
        height: isEmpty ? (isOver ? "20px" : "16px") : isOver ? "3px" : "4px",
        marginBlock: isDragging ? "1px" : "0",
        borderRadius: "2px",
        background: isOver
          ? "#00d4ff"
          : isEmpty && isDragging
            ? "rgba(0,212,255,0.08)"
            : "transparent",
        boxShadow: isOver ? "0 0 8px #00d4ff99" : "none",
        transition: "background 0.1s, box-shadow 0.1s",
      }}
    />
  );
}
