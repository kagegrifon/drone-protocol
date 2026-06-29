import type { EntityId, Position, WorldObjectType } from "../../shared/types/index.js";

export type EntityType = WorldObjectType | "drone";

/** Базовые поля любой сущности в снапшоте мира. */
export interface BaseEntitySnap {
  id: EntityId;
  type: EntityType;
  position: Position;
}

export interface MineSnap extends BaseEntitySnap {
  type: "mine";
  oreRemaining: number;
  freeSlots: number;
}

export interface ChargerSnap extends BaseEntitySnap {
  type: "charger";
  freeSlots: number;
}

export interface BaseSnap extends BaseEntitySnap {
  type: "base";
  freeSlots: number;
  storedOre: number;
}

export interface DroneSnap extends BaseEntitySnap {
  type: "drone";
  energy: number;
  energyMax: number;
  inventory: number;
  inventoryMax: number;
}

/**
 * Снапшот всего мира на старте тика — синхронный, детерминированный.
 * Передаётся в воркер; богатые объекты с методами строятся внутри воркера.
 */
export interface WorldSnapshot {
  /** Управляемый дрон, полная детализация. */
  self: DroneSnap;
  mines: MineSnap[];
  chargers: ChargerSnap[];
  bases: BaseSnap[];
  /** ВСЕ дроны, включая self. */
  drones: DroneSnap[];
}

export type CodeAction = "moveTo" | "mine" | "drop" | "charge";

/** Намерение, которое воркер шлёт driver'у на каждом await self.<action>(). */
export type WorkerMessage =
  | { type: "intent"; action: CodeAction; point?: Position; line: number; lineStack: number[] }
  | { type: "wait"; seconds: number; line: number; lineStack: number[] }
  | { type: "finished" }
  | { type: "error"; message: string };

/** Сообщения от driver'а воркеру. */
export type DriverMessage =
  | {
      type: "start";
      code: string;
      selfId: EntityId;
      world: WorldSnapshot;
    }
  | { type: "resume"; world: WorldSnapshot };
