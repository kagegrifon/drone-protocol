import type { EntityId } from "../../shared/types/index.js";

/** Снапшот сенсоров дрона на старте тика — синхронный, детерминированный. */
export interface SensorsSnapshot {
  energy: number;
  energyMax: number;
  inventory: number;
  inventoryMax: number;
  freeSlots: number;
  /** distance(a, b) для всех пар { entities + self } через Manhattan-расстояние. */
  positions: Record<EntityId, { x: number; y: number }>;
  /** deposit(target) — остаток руды для сущностей с компонентом Deposit. */
  deposits: Record<EntityId, number>;
}

export type CodeAction = "moveTo" | "mine" | "drop" | "charge";

/** Намерение, которое воркер шлёт driver'у на каждом await drone.<action>(). */
export type WorkerMessage =
  | { type: "intent"; action: CodeAction; targetId?: EntityId }
  | { type: "wait"; seconds: number }
  | { type: "finished" }
  | { type: "error"; message: string };

/** Сообщения от driver'а воркеру. */
export type DriverMessage =
  | {
      type: "start";
      code: string;
      selfId: EntityId;
      entities: Record<string, EntityId>;
      sensors: SensorsSnapshot;
    }
  | { type: "resume"; sensors: SensorsSnapshot };
