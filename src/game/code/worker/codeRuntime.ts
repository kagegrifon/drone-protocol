import type {
  BaseEntitySnap,
  CodeAction,
  DriverMessage,
  WorkerMessage,
  WorldSnapshot,
} from "../types.js";
import type { Position } from "../../../shared/types/index.js";
import { instrument } from "./instrument.js";

type Post = (msg: WorkerMessage) => void;
type OnDriverMessage = (cb: (msg: DriverMessage) => void) => void;

/**
 * Исполняет код игрока как async-функцию. В код прокидываются глобальные `self`
 * (управляемый дрон) и `World` (мир по типам). Каждый await self.<action>() шлёт
 * intent через `post` и зависает на промисе, который резолвится при получении
 * следующего DriverMessage. Объекты API создаются один раз и мутируются по месту
 * на каждом resume — ссылки стабильны, чтение полей дёшево, детерминизм сохранён.
 */
export function runCode(
  start: Extract<DriverMessage, { type: "start" }>,
  post: Post,
  onDriverMessage: OnDriverMessage,
): Promise<void> {
  let resolveResume: (() => void) | null = null;
  let currentLine = 0;

  function awaitResume(): Promise<void> {
    return new Promise((resolve) => {
      resolveResume = resolve;
    });
  }

  function __line(n: number): void {
    currentLine = n;
  }

  function requirePoint(point: unknown): Position {
    if (point == null)
      throw new Error(
        "moveTo(point): point null/undefined — передай {x,y}, например World.mines[0].position",
      );
    const p = point as { x?: unknown; y?: unknown };
    if (typeof p.x !== "number" || typeof p.y !== "number")
      throw new Error(
        "moveTo(point): ожидается {x, y} (например World.mines[0].position)",
      );
    return { x: p.x, y: p.y };
  }

  function sendMove(point: Position): Promise<void> {
    post({ type: "intent", action: "moveTo", point, line: currentLine });
    return awaitResume();
  }

  function sendAction(action: CodeAction): Promise<void> {
    post({ type: "intent", action, line: currentLine });
    return awaitResume();
  }

  // --- Прототипы сущностей (методы общие, не пересоздаются) ---

  class Entity {
    id!: number;
    type!: string;
    position!: Position;
    distanceTo(other: { position: Position } | Position): number {
      const p =
        other && "position" in other
          ? (other as { position: Position }).position
          : (other as Position);
      if (!p || typeof p.x !== "number" || typeof p.y !== "number")
        throw new Error("distanceTo(target): нужна сущность или точка {x,y}");
      return Math.abs(this.position.x - p.x) + Math.abs(this.position.y - p.y);
    }
  }

  class MineEntity extends Entity {
    oreRemaining!: number;
    freeSlots!: number;
  }
  class ChargerEntity extends Entity {
    freeSlots!: number;
  }
  class BaseEntity extends Entity {
    freeSlots!: number;
    storedOre!: number;
  }
  class DroneEntity extends Entity {
    energy!: number;
    energyMax!: number;
    inventory!: number;
    inventoryMax!: number;
  }

  class SelfEntity extends DroneEntity {
    moveTo(point: unknown): Promise<void> {
      return sendMove(requirePoint(point));
    }
    mine(): Promise<void> {
      return sendAction("mine");
    }
    drop(): Promise<void> {
      return sendAction("drop");
    }
    charge(): Promise<void> {
      return sendAction("charge");
    }
    wait(seconds: number): Promise<void> {
      post({ type: "wait", seconds, line: currentLine });
      return awaitResume();
    }
    findClosest<T extends Entity>(list: readonly T[]): T | null {
      if (!Array.isArray(list))
        throw new Error("findClosest(list): ожидается массив сущностей");
      let best: T | null = null;
      let bestD = Infinity;
      for (const e of list) {
        const d = this.distanceTo(e);
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      return best;
    }
  }

  // --- Объекты API: создаются один раз, мутируются по месту ---

  const self = new SelfEntity();
  const World = {
    mines: [] as MineEntity[],
    chargers: [] as ChargerEntity[],
    bases: [] as BaseEntity[],
    drones: [] as DroneEntity[],
  };

  function syncList<T extends Entity>(
    list: T[],
    snaps: BaseEntitySnap[],
    factory: () => T,
  ): void {
    list.length = snaps.length;
    for (let i = 0; i < snaps.length; i++) {
      list[i] ??= factory();
      Object.assign(list[i], snaps[i]);
    }
  }

  function syncWorld(snap: WorldSnapshot): void {
    Object.assign(self, snap.self);
    syncList(World.mines, snap.mines, () => new MineEntity());
    syncList(World.chargers, snap.chargers, () => new ChargerEntity());
    syncList(World.bases, snap.bases, () => new BaseEntity());
    syncList(World.drones, snap.drones, () => new DroneEntity());
  }

  onDriverMessage((msg) => {
    if (msg.type === "resume") {
      syncWorld(msg.world);
      const resolve = resolveResume;
      resolveResume = null;
      resolve?.();
    }
  });

  syncWorld(start.world);

  const instrumentedCode = instrument(start.code);

  const AsyncFunction = Object.getPrototypeOf(async function () {})
    .constructor as new (
    ...args: string[]
  ) => (...args: unknown[]) => Promise<void>;

  const fn = new AsyncFunction("self", "World", "__line", instrumentedCode);

  return fn(self, World, __line)
    .then(() => {
      post({ type: "finished" });
    })
    .catch((err: unknown) => {
      console.error("[codeRuntime] drone code error:", err);
      const message = err instanceof Error ? err.message : String(err);
      post({ type: "error", message });
    });
}
