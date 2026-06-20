import type {
  CodeAction,
  DriverMessage,
  SensorsSnapshot,
  WorkerMessage,
} from "../types.js";
import type { EntityId } from "../../../shared/types/index.js";
import { instrument } from "./instrument.js";

type Post = (msg: WorkerMessage) => void;
type OnDriverMessage = (cb: (msg: DriverMessage) => void) => void;

/**
 * Исполняет код игрока как async-функцию. Каждый await drone.<action>() шлёт
 * intent через `post` и зависает на промисе, который резолвится при получении
 * следующего DriverMessage через `onDriverMessage`. Возвращает промис,
 * завершающийся после finished/error.
 */
export function runCode(
  start: Extract<DriverMessage, { type: "start" }>,
  post: Post,
  onDriverMessage: OnDriverMessage,
): Promise<void> {
  let sensors: SensorsSnapshot = start.sensors;
  let resolveResume: (() => void) | null = null;
  let currentLine = 0;

  onDriverMessage((msg) => {
    if (msg.type === "resume") {
      sensors = msg.sensors;
      const resolve = resolveResume;
      resolveResume = null;
      resolve?.();
    }
  });

  function awaitResume(): Promise<void> {
    return new Promise((resolve) => {
      resolveResume = resolve;
    });
  }

  function __line(n: number): void {
    currentLine = n;
  }

  async function sendAction(action: CodeAction, targetId?: EntityId): Promise<void> {
    post(
      targetId === undefined
        ? { type: "intent", action, line: currentLine }
        : { type: "intent", action, targetId, line: currentLine },
    );
    await awaitResume();
  }

  function distance(a: EntityId, b: EntityId): number {
    const pa = sensors.positions[a];
    const pb = sensors.positions[b];
    if (!pa || !pb) return 0;
    return Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y);
  }

  function deposit(target: EntityId): number {
    return sensors.deposits[target] ?? 0;
  }

  const drone = {
    get self(): EntityId {
      return start.selfId;
    },
    get energy(): number {
      return sensors.energy;
    },
    get energyMax(): number {
      return sensors.energyMax;
    },
    get inventory(): number {
      return sensors.inventory;
    },
    get inventoryMax(): number {
      return sensors.inventoryMax;
    },
    get freeSlots(): number {
      return sensors.freeSlots;
    },
    moveTo: (target: EntityId) => sendAction("moveTo", target),
    mine: () => sendAction("mine"),
    drop: () => sendAction("drop"),
    charge: () => sendAction("charge"),
    async wait(seconds: number): Promise<void> {
      post({ type: "wait", seconds, line: currentLine });
      await awaitResume();
    },
  };

  const instrumentedCode = instrument(start.code);

  const entityNames = Object.keys(start.entities);
  const entityValues = entityNames.map((name) => start.entities[name]);

  const AsyncFunction = Object.getPrototypeOf(
    async function () {},
  ).constructor as new (...args: string[]) => (...args: unknown[]) => Promise<void>;

  const fn = new AsyncFunction(
    "drone",
    "__line",
    "distance",
    "deposit",
    ...entityNames,
    instrumentedCode,
  );

  return fn(drone, __line, distance, deposit, ...entityValues)
    .then(() => {
      post({ type: "finished" });
    })
    .catch((err: unknown) => {
      console.error("[codeRuntime] drone code error:", err);
      const message = err instanceof Error ? err.message : String(err);
      post({ type: "error", message });
    });
}
