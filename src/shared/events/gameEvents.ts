import type { EntityId } from "../types/index.js";

export type GameEventMap = {
  "ore:mined": { droneId: EntityId; x: number; y: number };
  "ore:dropped": { droneId: EntityId; amount: number };
  "charge:started": { droneId: EntityId };
  "charge:completed": { droneId: EntityId };
  "mission:complete": undefined;
  "drone:moved": {
    droneId: EntityId;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  };
  "entity:removed": { entityId: EntityId; lastX?: number; lastY?: number };
  "drone:blocked": { droneId: EntityId };
  /** CodeBehaviorDriver отправил воркеру 'resume' — await self.* в коде дрона резолвится. */
  "drone:actionResumed": { droneId: EntityId };
};

type Listener<T> = (data: T) => void;

class TypedEventEmitter<M extends Record<string, unknown>> {
  private readonly _map = new Map<string, Set<Listener<unknown>>>();

  on<K extends string & keyof M>(event: K, listener: Listener<M[K]>): void {
    if (!this._map.has(event)) this._map.set(event, new Set());
    this._map.get(event)!.add(listener as Listener<unknown>);
  }

  off<K extends string & keyof M>(event: K, listener: Listener<M[K]>): void {
    this._map.get(event)?.delete(listener as Listener<unknown>);
  }

  emit<K extends string & keyof M>(event: K, data: M[K]): void {
    this._map.get(event)?.forEach((fn) => fn(data));
  }

  clearAll(): void {
    this._map.clear();
  }
}

export const gameEvents = new TypedEventEmitter<GameEventMap>();
