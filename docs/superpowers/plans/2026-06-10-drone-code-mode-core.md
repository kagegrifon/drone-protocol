# Code Mode (этап 1) — ядро исполнения JS-кода дронов — Implementation Plan

> **Для агентов:** ОБЯЗАТЕЛЬНЫЙ САБ-СКИЛЛ: используйте superpowers:subagent-driven-development
> (рекомендуется) или superpowers:executing-plans для выполнения плана задача-за-задачей.
> Шаги используют чекбоксы (`- [ ]`) для отслеживания.

**Goal:** Дрон с `behavior.source === 'code'` исполняет async/await JS-код игрока через
Web Worker (в браузере) / `worker_threads` (в Vitest), детерминированно вставая на ту же
пошаговую модель намерений (`program.state`), что и AST-интерпретатор.

**Architecture:** `BehaviorDriver` — общий интерфейс. `AstBehaviorDriver` — тонкая обёртка
над существующим `stepProgram` (поведение не меняется). `CodeBehaviorDriver` — держит по
одной worker-сессии на дрона, общается с воркером через `CodeWorkerPort` (абстракция:
`BrowserWorkerPort` поверх `Worker`, `NodeWorkerPort` поверх `node:worker_threads` для
тестов — оба запускают один и тот же `codeRuntime`). Воркер исполняет код игрока как
`AsyncFunction`; на каждом `await drone.action()` шлёт намерение `{type:'intent', ...}` и
зависает на промисе. Driver на каждом тике: если есть необработанное намерение — выставляет
`program.state` и `return` (как `stepProgram`); когда системы вернули `state` обратно в
`'running'` — шлёт воркеру `action-done` со свежим снапшотом сенсоров, промис резолвится,
код едет до следующего `await`. `drone.wait(seconds)` обрабатывается полностью на стороне
driver'а (декремент `waitRemaining` в сессии), не требует похода в воркер каждый тик.
Таймаут синхронного участка между `await` — реальный `setTimeout` в driver'е,
`port.terminate()` при превышении.

**Tech Stack:** TypeScript, Vitest, `node:worker_threads` (тесты) + `tsx` (исполнение `.ts`
в worker_threads), браузерный `Worker` (prod), `AsyncFunction` для исполнения кода игрока.

---

## Файловая структура

**Новые файлы:**
- `src/game/code/types.ts` — протокольные типы (`SensorsSnapshot`, `DriverMessage`, `WorkerMessage`, `CodeIntent`)
- `src/game/code/BehaviorDriver.ts` — общий интерфейс `BehaviorDriver`
- `src/game/code/AstBehaviorDriver.ts` + `.test.ts` — обёртка над `stepProgram`
- `src/game/code/CodeWorkerPort.ts` — интерфейс `CodeWorkerPort`
- `src/game/code/worker/codeRuntime.ts` — общий рантайм воркера (создаёт `drone`/`distance`/`deposit`, гоняет `AsyncFunction`)
- `src/game/code/worker/nodeWorkerEntry.ts` — entry для `node:worker_threads`
- `src/game/code/worker/browserWorkerEntry.ts` — entry для браузерного `Worker`
- `src/game/code/worker/NodeWorkerPort.ts` — `CodeWorkerPort` через `worker_threads` (для тестов)
- `src/game/code/worker/BrowserWorkerPort.ts` — `CodeWorkerPort` через `Worker` (для прод)
- `src/game/code/CodeBehaviorDriver.ts` + `.test.ts` — основной driver
- `src/game/code/drone-api.d.ts` — типовой контракт API дрона (для будущего Monaco)
- `src/game/code/equivalence.test.ts` — тест эквивалентности блоки↔код

**Изменяемые файлы:**
- `src/game/programs/types.ts` — добавить тип `DroneBehavior` (additive)
- `src/game/simulation/systems/ProgramExecutionSystem.ts` — выбор driver по `behavior.source`
- `src/game/programs/interpreter.ts` — экспортировать helper `planAstarMove` (минимальный рефакторинг, поведение не меняется)
- `package.json` — добавить devDependency `tsx`
- `DECISIONS.md` — дополнить запись от 10-06-2026 деталями реализации (driver-интерфейс, протокол сообщений, выбор `tsx`/worker_threads)

**Будущая задача (НЕ в этом плане):** полная миграция `ProgramRegistry`/`ProgramDef` на
дискриминированный `DroneBehavior` во всех 14 файлах, использующих `.instructions`
(миссии, UI редактор, рендерер, store) — отдельная задача после этапа 2 (Monaco).

---

## Task 1: Тип `DroneBehavior` (additive)

**Files:**
- Modify: `src/game/programs/types.ts`

- [ ] **Step 1: Добавить тип `DroneBehavior` в `types.ts`**

В конец файла `src/game/programs/types.ts` добавить:

```ts
export type DroneBehavior =
  | { source: "block"; instructions: Instruction[] }
  | { source: "code"; code: string };
```

- [ ] **Step 2: Прогнать type-check**

Run: `npm run type-check`
Expected: без ошибок (новый тип ещё нигде не используется, но компилируется)

- [ ] **Step 3: Commit**

```bash
git add src/game/programs/types.ts
git commit -m "feat: добавить тип DroneBehavior (Phase 1)"
```

---

## Task 2: Интерфейс `BehaviorDriver` и `AstBehaviorDriver`

**Files:**
- Create: `src/game/code/BehaviorDriver.ts`
- Create: `src/game/code/AstBehaviorDriver.ts`
- Test: `src/game/code/AstBehaviorDriver.test.ts`

- [ ] **Step 1: Создать интерфейс `BehaviorDriver`**

`src/game/code/BehaviorDriver.ts`:

```ts
import type { EntityId } from "../../shared/types/index.js";
import type { World } from "../simulation/world/World.js";
import type { Grid } from "../simulation/world/Grid.js";
import type { ProgramRegistry } from "../programs/types.js";

export interface BehaviorTickContext {
  world: World;
  grid: Grid;
  registry: ProgramRegistry;
  occupied: Set<string>;
}

export interface BehaviorDriver {
  /** Доводит дрона на один тик: читает/выставляет program.state, возвращается на yield-точке. */
  step(droneId: EntityId, ctx: BehaviorTickContext): void;
  /** Освобождает ресурсы драйвера для дрона (воркер и т.п.). Опционально. */
  dispose?(droneId: EntityId): void;
}
```

- [ ] **Step 2: Написать падающий тест для `AstBehaviorDriver`**

`src/game/code/AstBehaviorDriver.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { World } from "../simulation/world/World.js";
import { Grid } from "../simulation/world/Grid.js";
import { AstBehaviorDriver } from "./AstBehaviorDriver.js";
import type { ProgramRegistry, Instruction } from "../programs/types.js";

const EMPTY_GRID = new Grid();
const EMPTY_OCCUPIED = new Set<string>();

function addDrone(world: World, instructions: Instruction[]) {
  const id = world.createEntity();
  world.addComponent(id, "Position", { x: 0, y: 0 });
  world.addComponent(id, "Energy", {
    current: 100,
    max: 100,
    drainPerMove: 5,
    drainPerMine: 2,
  });
  world.addComponent(id, "Inventory", { ore: 0, capacity: 10 });
  world.addComponent(id, "Movement", {
    targetX: 0,
    targetY: 0,
    path: [],
    progress: 0,
    speed: 1,
  });
  const programId = "prog_main";
  const registry: ProgramRegistry = new Map([
    [programId, { id: programId, name: "Main", instructions }],
  ]);
  world.addComponent(id, "Program", {
    currentProgramId: programId,
    callStack: [{ programId, instructionIndex: 0 }],
    state: "running",
    commandSlots: 4,
    personalProgramId: "",
  });
  return { id, registry };
}

describe("AstBehaviorDriver", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("delegates to stepProgram and sets state=mine", () => {
    const { id, registry } = addDrone(world, [{ type: "MINE" }]);
    const driver = new AstBehaviorDriver();
    driver.step(id, {
      world,
      grid: EMPTY_GRID,
      registry,
      occupied: EMPTY_OCCUPIED,
    });
    const prog = world.getComponent(id, "Program")!;
    expect(prog.state).toBe("mine");
  });

  it("empty program becomes idle", () => {
    const { id, registry } = addDrone(world, []);
    const driver = new AstBehaviorDriver();
    driver.step(id, {
      world,
      grid: EMPTY_GRID,
      registry,
      occupied: EMPTY_OCCUPIED,
    });
    const prog = world.getComponent(id, "Program")!;
    expect(prog.state).toBe("idle");
  });
});
```

- [ ] **Step 3: Запустить тест, убедиться что падает**

Run: `npx vitest run src/game/code/AstBehaviorDriver.test.ts`
Expected: FAIL — `Cannot find module './AstBehaviorDriver.js'`

- [ ] **Step 4: Реализовать `AstBehaviorDriver`**

`src/game/code/AstBehaviorDriver.ts`:

```ts
import type { EntityId } from "../../shared/types/index.js";
import { stepProgram } from "../programs/interpreter.js";
import type { BehaviorDriver, BehaviorTickContext } from "./BehaviorDriver.js";

/** Тонкая обёртка над stepProgram — поведение AST-режима не меняется. */
export class AstBehaviorDriver implements BehaviorDriver {
  step(droneId: EntityId, ctx: BehaviorTickContext): void {
    stepProgram(droneId, ctx.world, ctx.registry, ctx.grid, ctx.occupied);
  }
}
```

- [ ] **Step 5: Запустить тест, убедиться что проходит**

Run: `npx vitest run src/game/code/AstBehaviorDriver.test.ts`
Expected: PASS (2 теста)

- [ ] **Step 6: Commit**

```bash
git add src/game/code/BehaviorDriver.ts src/game/code/AstBehaviorDriver.ts src/game/code/AstBehaviorDriver.test.ts
git commit -m "feat: добавить интерфейс BehaviorDriver и AstBehaviorDriver (Phase 1)"
```

---

## Task 3: Протокольные типы и `CodeWorkerPort`

**Files:**
- Create: `src/game/code/types.ts`
- Create: `src/game/code/CodeWorkerPort.ts`

- [ ] **Step 1: Создать протокольные типы**

`src/game/code/types.ts`:

```ts
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
```

- [ ] **Step 2: Создать интерфейс `CodeWorkerPort`**

`src/game/code/CodeWorkerPort.ts`:

```ts
import type { DriverMessage, WorkerMessage } from "./types.js";

/** Абстракция над worker-каналом: Web Worker (прод) / worker_threads (тесты). */
export interface CodeWorkerPort {
  postMessage(msg: DriverMessage): void;
  onMessage(cb: (msg: WorkerMessage) => void): void;
  onError(cb: (err: Error) => void): void;
  terminate(): void;
}
```

- [ ] **Step 3: Прогнать type-check**

Run: `npm run type-check`
Expected: без ошибок

- [ ] **Step 4: Commit**

```bash
git add src/game/code/types.ts src/game/code/CodeWorkerPort.ts
git commit -m "feat: добавить протокольные типы и CodeWorkerPort (Phase 1)"
```

---

## Task 4: `codeRuntime` — рантайм исполнения кода игрока внутри воркера

**Files:**
- Create: `src/game/code/worker/codeRuntime.ts`
- Test: `src/game/code/worker/codeRuntime.test.ts`

Рантайм работает в любом контексте, у которого есть `postMessage`-подобная функция отправки
и async-генератор входящих сообщений. Чтобы не завязываться на конкретный канал,
`codeRuntime` принимает примитивы как аргументы (dependency injection) — это позволяет
тестировать его напрямую в Vitest без реального воркера.

- [ ] **Step 1: Написать падающий тест для `runCode`**

`src/game/code/worker/codeRuntime.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { runCode } from "./codeRuntime.js";
import type { DriverMessage, WorkerMessage, SensorsSnapshot } from "../types.js";

const SENSORS: SensorsSnapshot = {
  energy: 100,
  energyMax: 100,
  inventory: 0,
  inventoryMax: 10,
  freeSlots: 1,
  positions: { 1: { x: 0, y: 0 }, 2: { x: 3, y: 0 } },
  deposits: { 2: 5 },
};

function makeChannel() {
  const sent: WorkerMessage[] = [];
  let deliver: ((msg: DriverMessage) => void) | null = null;
  return {
    sent,
    post: (msg: WorkerMessage) => sent.push(msg),
    onDriverMessage: (cb: (msg: DriverMessage) => void) => {
      deliver = cb;
    },
    deliver: (msg: DriverMessage) => deliver?.(msg),
  };
}

describe("runCode", () => {
  it("sends intent on await drone.moveTo and finishes after resume", async () => {
    const ch = makeChannel();
    const start: DriverMessage = {
      type: "start",
      code: "await drone.moveTo(ore); await drone.mine();",
      selfId: 1,
      entities: { ore: 2 },
      sensors: SENSORS,
    };

    const done = runCode(start, ch.post, ch.onDriverMessage);

    // даём микротаскам прокрутиться до первого intent
    await vi.waitFor(() => expect(ch.sent.length).toBe(1));
    expect(ch.sent[0]).toEqual({ type: "intent", action: "moveTo", targetId: 2 });

    ch.deliver({ type: "resume", sensors: SENSORS });
    await vi.waitFor(() => expect(ch.sent.length).toBe(2));
    expect(ch.sent[1]).toEqual({ type: "intent", action: "mine" });

    ch.deliver({ type: "resume", sensors: SENSORS });
    await done;
    expect(ch.sent[2]).toEqual({ type: "finished" });
  });

  it("exposes synchronous sensors from the snapshot", async () => {
    const ch = makeChannel();
    const start: DriverMessage = {
      type: "start",
      code: "if (drone.energy !== 100) throw new Error('bad'); await drone.charge();",
      selfId: 1,
      entities: {},
      sensors: SENSORS,
    };
    runCode(start, ch.post, ch.onDriverMessage);
    await vi.waitFor(() => expect(ch.sent.length).toBe(1));
    expect(ch.sent[0]).toEqual({ type: "intent", action: "charge" });
  });

  it("sends error message on synchronous throw", async () => {
    const ch = makeChannel();
    const start: DriverMessage = {
      type: "start",
      code: "throw new Error('boom');",
      selfId: 1,
      entities: {},
      sensors: SENSORS,
    };
    await runCode(start, ch.post, ch.onDriverMessage);
    expect(ch.sent[0]).toEqual({ type: "error", message: "boom" });
  });

  it("sends wait message for drone.wait without an intent round-trip", async () => {
    const ch = makeChannel();
    const start: DriverMessage = {
      type: "start",
      code: "await drone.wait(2); await drone.mine();",
      selfId: 1,
      entities: {},
      sensors: SENSORS,
    };
    runCode(start, ch.post, ch.onDriverMessage);
    await vi.waitFor(() => expect(ch.sent.length).toBe(1));
    expect(ch.sent[0]).toEqual({ type: "wait", seconds: 2 });
  });

  it("computes distance() and deposit() from the snapshot", async () => {
    const ch = makeChannel();
    const start: DriverMessage = {
      type: "start",
      code: `
        if (distance(drone.self, ore) !== 3) throw new Error('dist');
        if (deposit(ore) !== 5) throw new Error('deposit');
        await drone.mine();
      `,
      selfId: 1,
      entities: { ore: 2 },
      sensors: SENSORS,
    };
    runCode(start, ch.post, ch.onDriverMessage);
    await vi.waitFor(() => expect(ch.sent.length).toBe(1));
    expect(ch.sent[0]).toEqual({ type: "intent", action: "mine" });
  });
});
```

- [ ] **Step 2: Запустить тест, убедиться что падает**

Run: `npx vitest run src/game/code/worker/codeRuntime.test.ts`
Expected: FAIL — `Cannot find module './codeRuntime.js'`

- [ ] **Step 3: Реализовать `codeRuntime`**

`src/game/code/worker/codeRuntime.ts`:

```ts
import type {
  CodeAction,
  DriverMessage,
  SensorsSnapshot,
  WorkerMessage,
} from "../types.js";
import type { EntityId } from "../../../shared/types/index.js";

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

  async function sendAction(action: CodeAction, targetId?: EntityId): Promise<void> {
    post(
      targetId === undefined
        ? { type: "intent", action }
        : { type: "intent", action, targetId },
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
      post({ type: "wait", seconds });
      await awaitResume();
    },
  };

  const entityNames = Object.keys(start.entities);
  const entityValues = entityNames.map((name) => start.entities[name]);

  const AsyncFunction = Object.getPrototypeOf(
    async function () {},
  ).constructor as new (...args: string[]) => (...args: unknown[]) => Promise<void>;

  const fn = new AsyncFunction(
    "drone",
    "distance",
    "deposit",
    ...entityNames,
    start.code,
  );

  return fn(drone, distance, deposit, ...entityValues)
    .then(() => {
      post({ type: "finished" });
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      post({ type: "error", message });
    });
}
```

- [ ] **Step 4: Запустить тест, убедиться что проходит**

Run: `npx vitest run src/game/code/worker/codeRuntime.test.ts`
Expected: PASS (5 тестов)

- [ ] **Step 5: Commit**

```bash
git add src/game/code/worker/codeRuntime.ts src/game/code/worker/codeRuntime.test.ts
git commit -m "feat: добавить codeRuntime — исполнение кода игрока через AsyncFunction (Phase 1)"
```

---

## Task 5: Worker entry-файлы и порты (`NodeWorkerPort`, `BrowserWorkerPort`)

**Files:**
- Create: `src/game/code/worker/nodeWorkerEntry.ts`
- Create: `src/game/code/worker/browserWorkerEntry.ts`
- Create: `src/game/code/worker/NodeWorkerPort.ts`
- Create: `src/game/code/worker/BrowserWorkerPort.ts`
- Test: `src/game/code/worker/NodeWorkerPort.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Добавить devDependency `tsx`**

```bash
npm install -D tsx
```

Это позволит `node:worker_threads` исполнять `.ts`-файл воркера напрямую (через
`execArgv: ["--import", "tsx"]`), без шага сборки — нужно только в Vitest/Node-окружении.

- [ ] **Step 2: Создать entry для `node:worker_threads`**

`src/game/code/worker/nodeWorkerEntry.ts`:

```ts
import { parentPort } from "node:worker_threads";
import { runCode } from "./codeRuntime.js";
import type { DriverMessage, WorkerMessage } from "../types.js";

if (!parentPort) {
  throw new Error("nodeWorkerEntry must run inside a worker thread");
}

const port = parentPort;
let started = false;

port.on("message", (msg: DriverMessage) => {
  if (msg.type === "start" && !started) {
    started = true;
    runCode(
      msg,
      (out: WorkerMessage) => port.postMessage(out),
      (cb) => port.on("message", cb),
    );
  }
});
```

- [ ] **Step 3: Создать entry для браузерного `Worker`**

`src/game/code/worker/browserWorkerEntry.ts`:

```ts
import { runCode } from "./codeRuntime.js";
import type { DriverMessage, WorkerMessage } from "../types.js";

let started = false;

self.onmessage = (ev: MessageEvent<DriverMessage>) => {
  const msg = ev.data;
  if (msg.type === "start" && !started) {
    started = true;
    runCode(
      msg,
      (out: WorkerMessage) => self.postMessage(out),
      (cb) => {
        self.onmessage = (e: MessageEvent<DriverMessage>) => cb(e.data);
      },
    );
  }
};
```

Примечание: `browserWorkerEntry.ts` подключается реальным `new Worker(new URL(...))` только
в Vite/браузере — Vitest (environment "node") его не импортирует и не type-check'ает через
DOM lib проблем не возникает, т.к. `tsconfig.json` уже включает `"DOM"` в `lib`.

- [ ] **Step 4: Создать `NodeWorkerPort`**

`src/game/code/worker/NodeWorkerPort.ts`:

```ts
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import type { CodeWorkerPort } from "../CodeWorkerPort.js";
import type { DriverMessage, WorkerMessage } from "../types.js";

const ENTRY_PATH = fileURLToPath(new URL("./nodeWorkerEntry.ts", import.meta.url));

/** CodeWorkerPort поверх node:worker_threads — используется в Vitest. */
export class NodeWorkerPort implements CodeWorkerPort {
  private readonly worker: Worker;

  constructor() {
    this.worker = new Worker(ENTRY_PATH, {
      execArgv: ["--import", "tsx"],
    });
  }

  postMessage(msg: DriverMessage): void {
    this.worker.postMessage(msg);
  }

  onMessage(cb: (msg: WorkerMessage) => void): void {
    this.worker.on("message", cb);
  }

  onError(cb: (err: Error) => void): void {
    this.worker.on("error", cb);
  }

  terminate(): void {
    void this.worker.terminate();
  }
}
```

- [ ] **Step 5: Создать `BrowserWorkerPort`**

`src/game/code/worker/BrowserWorkerPort.ts`:

```ts
import type { CodeWorkerPort } from "../CodeWorkerPort.js";
import type { DriverMessage, WorkerMessage } from "../types.js";

/** CodeWorkerPort поверх браузерного Worker — используется в проде (Vite). */
export class BrowserWorkerPort implements CodeWorkerPort {
  private readonly worker: Worker;

  constructor() {
    this.worker = new Worker(new URL("./browserWorkerEntry.ts", import.meta.url), {
      type: "module",
    });
  }

  postMessage(msg: DriverMessage): void {
    this.worker.postMessage(msg);
  }

  onMessage(cb: (msg: WorkerMessage) => void): void {
    this.worker.onmessage = (ev: MessageEvent<WorkerMessage>) => cb(ev.data);
  }

  onError(cb: (err: Error) => void): void {
    this.worker.onerror = (ev: ErrorEvent) => cb(new Error(ev.message));
  }

  terminate(): void {
    this.worker.terminate();
  }
}
```

- [ ] **Step 6: Написать тест для `NodeWorkerPort` (round-trip через реальный воркер)**

`src/game/code/worker/NodeWorkerPort.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { NodeWorkerPort } from "./NodeWorkerPort.js";
import type { SensorsSnapshot, WorkerMessage } from "../types.js";

const SENSORS: SensorsSnapshot = {
  energy: 100,
  energyMax: 100,
  inventory: 0,
  inventoryMax: 10,
  freeSlots: 1,
  positions: { 1: { x: 0, y: 0 }, 2: { x: 1, y: 0 } },
  deposits: { 2: 5 },
};

describe("NodeWorkerPort", () => {
  let port: NodeWorkerPort;

  afterEach(() => {
    port?.terminate();
  });

  it("runs player code and round-trips an intent", async () => {
    port = new NodeWorkerPort();
    const messages: WorkerMessage[] = [];
    port.onMessage((m) => messages.push(m));

    port.postMessage({
      type: "start",
      code: "await drone.moveTo(ore); await drone.mine();",
      selfId: 1,
      entities: { ore: 2 },
      sensors: SENSORS,
    });

    await new Promise<void>((resolve) => {
      const check = () => {
        if (messages.length >= 1) return resolve();
        setTimeout(check, 10);
      };
      check();
    });

    expect(messages[0]).toEqual({ type: "intent", action: "moveTo", targetId: 2 });

    port.postMessage({ type: "resume", sensors: SENSORS });

    await new Promise<void>((resolve) => {
      const check = () => {
        if (messages.length >= 3) return resolve();
        setTimeout(check, 10);
      };
      check();
    });

    expect(messages[1]).toEqual({ type: "intent", action: "mine" });
    port.postMessage({ type: "resume", sensors: SENSORS });

    await new Promise<void>((resolve) => {
      const check = () => {
        if (messages.length >= 3) return resolve();
        setTimeout(check, 10);
      };
      check();
    });
    expect(messages[2]).toEqual({ type: "finished" });
  }, 10000);
});
```

- [ ] **Step 7: Запустить тест**

Run: `npx vitest run src/game/code/worker/NodeWorkerPort.test.ts`
Expected: PASS (1 тест, может занять 1-2 секунды на старт воркера)

Если падает с ошибкой резолва `tsx` — проверить `npm ls tsx` и что `node_modules/.bin/tsx`
существует.

- [ ] **Step 8: Прогнать type-check**

Run: `npm run type-check`
Expected: без ошибок

- [ ] **Step 9: Commit**

```bash
git add src/game/code/worker/nodeWorkerEntry.ts src/game/code/worker/browserWorkerEntry.ts src/game/code/worker/NodeWorkerPort.ts src/game/code/worker/BrowserWorkerPort.ts src/game/code/worker/NodeWorkerPort.test.ts package.json package-lock.json
git commit -m "feat: добавить worker entry-точки и CodeWorkerPort для node/browser (Phase 1)"
```

---

## Task 6: Рефакторинг `interpreter.ts` — выделить `planAstarMove`

Небольшой рефакторинг: `MOVE_TO` в `stepProgram` строит путь через `astar` и записывает его
в `Movement`. `CodeBehaviorDriver` должен делать то же самое для `await drone.moveTo()`.
Выносим эту логику в переиспользуемую функцию, **не меняя поведение `stepProgram`**.

**Files:**
- Modify: `src/game/programs/interpreter.ts`
- Test: `src/game/programs/interpreter.test.ts` (существующие тесты должны остаться зелёными)

- [ ] **Step 1: Убедиться, что текущие тесты `interpreter` зелёные (baseline)**

Run: `npx vitest run src/game/programs/interpreter.test.ts`
Expected: PASS (все существующие тесты)

- [ ] **Step 2: Выделить `planAstarMove` и использовать её в `MOVE_TO`**

В `src/game/programs/interpreter.ts`, добавить экспортируемую функцию (рядом с
`evaluateConditions`, после основного `stepProgram`):

```ts
/**
 * Строит путь до targetEntityId через astar и применяет его к Movement дрона.
 * Используется и AST-веткой MOVE_TO, и CodeBehaviorDriver для drone.moveTo().
 */
export function planAstarMove(
  droneId: EntityId,
  targetEntityId: EntityId,
  world: World,
  grid: Grid,
  occupied: Set<string>,
): void {
  const dronePos = world.getComponent(droneId, "Position");
  const targetPos = world.getComponent(targetEntityId, "Position");
  if (!dronePos || !targetPos) return;
  const path = astar(grid, dronePos, targetPos, occupied);
  const movement = world.getComponent(droneId, "Movement");
  if (movement && path !== null) {
    movement.path = path;
    movement.targetX = targetPos.x;
    movement.targetY = targetPos.y;
    movement.progress = 0;
  }
}
```

Затем заменить тело `case "MOVE_TO"` на:

```ts
      case "MOVE_TO": {
        planAstarMove(
          droneId,
          instruction.targetEntityId,
          world,
          grid,
          occupied,
        );
        program.state = "move";
        frame.instructionIndex++;
        return;
      }
```

- [ ] **Step 3: Прогнать тесты interpreter — убедиться, что поведение не изменилось**

Run: `npx vitest run src/game/programs/interpreter.test.ts`
Expected: PASS (тот же набор тестов, что и в Step 1)

- [ ] **Step 4: Прогнать type-check**

Run: `npm run type-check`
Expected: без ошибок

- [ ] **Step 5: Commit**

```bash
git add src/game/programs/interpreter.ts
git commit -m "refactor: выделить planAstarMove из MOVE_TO для переиспользования в CodeBehaviorDriver (Phase 1)"
```

---

## Task 7: Сбор `SensorsSnapshot` из мира

**Files:**
- Create: `src/game/code/sensors.ts`
- Test: `src/game/code/sensors.test.ts`

- [ ] **Step 1: Написать падающий тест**

`src/game/code/sensors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { World } from "../simulation/world/World.js";
import { collectSensors } from "./sensors.js";

describe("collectSensors", () => {
  it("collects energy/inventory/freeSlots and positions/deposits for entities", () => {
    const world = new World();

    const drone = world.createEntity();
    world.addComponent(drone, "Position", { x: 0, y: 0 });
    world.addComponent(drone, "Energy", {
      current: 80,
      max: 100,
      drainPerMove: 5,
      drainPerMine: 2,
    });
    world.addComponent(drone, "Inventory", { ore: 3, capacity: 10 });
    world.addComponent(drone, "WorkSlots", { capacity: 2, occupied: [] });

    const ore = world.createEntity();
    world.addComponent(ore, "Position", { x: 3, y: 0 });
    world.addComponent(ore, "Deposit", { oreRemaining: 5, oreMax: 5 });

    const snapshot = collectSensors(world, drone, { ore });

    expect(snapshot.energy).toBe(80);
    expect(snapshot.energyMax).toBe(100);
    expect(snapshot.inventory).toBe(3);
    expect(snapshot.inventoryMax).toBe(10);
    expect(snapshot.freeSlots).toBe(2);
    expect(snapshot.positions[drone]).toEqual({ x: 0, y: 0 });
    expect(snapshot.positions[ore]).toEqual({ x: 3, y: 0 });
    expect(snapshot.deposits[ore]).toBe(5);
  });
});
```

- [ ] **Step 2: Проверить поля `WorkSlots`/`Deposit` компонентов**

Перед реализацией свериться с реальными полями:

Run (PowerShell): откройте `src/game/simulation/components/WorkSlots.ts` и
`src/game/simulation/components/Deposit.ts`, чтобы убедиться в именах полей
(`capacity`/`occupied`, `oreRemaining`). Если поля называются иначе — использовать
`freeSlotsCount(world, id)` из `src/game/simulation/world/workSlots.ts` (как делает
`FUNCTIONS.FreeSlots` в `functions.ts`) вместо ручного расчёта, и
`world.getComponent(id, "Deposit")?.oreRemaining` (как `FUNCTIONS.Deposit`).

- [ ] **Step 3: Запустить тест, убедиться что падает**

Run: `npx vitest run src/game/code/sensors.test.ts`
Expected: FAIL — `Cannot find module './sensors.js'`

- [ ] **Step 4: Реализовать `collectSensors`**

`src/game/code/sensors.ts`:

```ts
import type { EntityId } from "../../shared/types/index.js";
import type { World } from "../simulation/world/World.js";
import { freeSlotsCount } from "../simulation/world/workSlots.js";
import type { SensorsSnapshot } from "./types.js";

/**
 * Снимает сенсоры дрона и всех именованных сущностей-целей на старте тика.
 * Снапшот передаётся в воркер, чтобы геттеры drone.* и distance()/deposit()
 * были консистентны в пределах одного тика (детерминизм).
 */
export function collectSensors(
  world: World,
  droneId: EntityId,
  entities: Record<string, EntityId>,
): SensorsSnapshot {
  const energy = world.getComponent(droneId, "Energy");
  const inventory = world.getComponent(droneId, "Inventory");
  const dronePos = world.getComponent(droneId, "Position");

  const positions: Record<EntityId, { x: number; y: number }> = {};
  const deposits: Record<EntityId, number> = {};

  if (dronePos) positions[droneId] = { x: dronePos.x, y: dronePos.y };

  for (const id of Object.values(entities)) {
    const pos = world.getComponent(id, "Position");
    if (pos) positions[id] = { x: pos.x, y: pos.y };
    const deposit = world.getComponent(id, "Deposit");
    if (deposit) deposits[id] = deposit.oreRemaining;
  }

  return {
    energy: energy?.current ?? 0,
    energyMax: energy?.max ?? 0,
    inventory: inventory?.ore ?? 0,
    inventoryMax: inventory?.capacity ?? 0,
    freeSlots: world.getComponent(droneId, "WorkSlots")
      ? freeSlotsCount(world, droneId)
      : 0,
    positions,
    deposits,
  };
}
```

- [ ] **Step 5: Запустить тест, убедиться что проходит**

Run: `npx vitest run src/game/code/sensors.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/game/code/sensors.ts src/game/code/sensors.test.ts
git commit -m "feat: добавить collectSensors — снапшот сенсоров дрона для CodeBehaviorDriver (Phase 1)"
```

---

## Task 8: `CodeBehaviorDriver`

Самая большая задача. Driver хранит per-drone сессию (`port`, фаза, буфер последнего
сообщения от воркера, таймаут, `waitRemaining`).

**Files:**
- Create: `src/game/code/CodeBehaviorDriver.ts`
- Test: `src/game/code/CodeBehaviorDriver.test.ts`

- [ ] **Step 1: Написать падающие тесты**

`src/game/code/CodeBehaviorDriver.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { World } from "../simulation/world/World.js";
import { Grid } from "../simulation/world/Grid.js";
import { CodeBehaviorDriver } from "./CodeBehaviorDriver.js";
import { NodeWorkerPort } from "./worker/NodeWorkerPort.js";
import type { ProgramRegistry } from "../programs/types.js";
import { DT } from "../simulation/constants.js";

const EMPTY_GRID = new Grid();
const EMPTY_OCCUPIED = new Set<string>();
const EMPTY_REGISTRY: ProgramRegistry = new Map();

function addDrone(world: World, x = 0, y = 0) {
  const id = world.createEntity();
  world.addComponent(id, "Position", { x, y });
  world.addComponent(id, "Energy", {
    current: 100,
    max: 100,
    drainPerMove: 5,
    drainPerMine: 2,
  });
  world.addComponent(id, "Inventory", { ore: 0, capacity: 10 });
  world.addComponent(id, "Movement", {
    targetX: 0,
    targetY: 0,
    path: [],
    progress: 0,
    speed: 1,
  });
  world.addComponent(id, "Program", {
    currentProgramId: null,
    callStack: [],
    state: "running",
    commandSlots: 4,
    personalProgramId: "",
  });
  return id;
}

function ctx(world: World) {
  return { world, grid: EMPTY_GRID, registry: EMPTY_REGISTRY, occupied: EMPTY_OCCUPIED };
}

async function tickUntil(
  driver: CodeBehaviorDriver,
  droneId: number,
  world: World,
  predicate: () => boolean,
  maxTicks = 200,
) {
  for (let i = 0; i < maxTicks; i++) {
    driver.step(droneId, ctx(world));
    if (predicate()) return i;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("tickUntil: predicate not satisfied within maxTicks");
}

describe("CodeBehaviorDriver", () => {
  let world: World;
  let driver: CodeBehaviorDriver;

  beforeEach(() => {
    world = new World();
    driver = new CodeBehaviorDriver({
      createPort: () => new NodeWorkerPort(),
      timeoutMs: 1000,
    });
  });

  afterEach(() => {
    driver.disposeAll();
  });

  it("await drone.mine() sets state=mine and returns from the tick", async () => {
    const drone = addDrone(world);
    world.getComponent(drone, "Program")!.codeSource = "await drone.mine();";

    await tickUntil(
      driver,
      drone,
      world,
      () => world.getComponent(drone, "Program")!.state === "mine",
    );

    const program = world.getComponent(drone, "Program")!;
    expect(program.state).toBe("mine");
  });

  it("resolves the awaited action once state returns to running, advancing to the next await", async () => {
    const drone = addDrone(world);
    world.getComponent(drone, "Program")!.codeSource =
      "await drone.mine(); await drone.charge();";

    await tickUntil(
      driver,
      drone,
      world,
      () => world.getComponent(drone, "Program")!.state === "mine",
    );

    // Симулируем, что MiningSystem завершила действие
    world.getComponent(drone, "Program")!.state = "running";

    await tickUntil(
      driver,
      drone,
      world,
      () => world.getComponent(drone, "Program")!.state === "charge",
    );

    expect(world.getComponent(drone, "Program")!.state).toBe("charge");
  });

  it("an infinite loop without await is caught by the timeout", async () => {
    const drone = addDrone(world);
    world.getComponent(drone, "Program")!.codeSource = "while (true) {}";
    driver = new CodeBehaviorDriver({
      createPort: () => new NodeWorkerPort(),
      timeoutMs: 200,
    });

    await tickUntil(
      driver,
      drone,
      world,
      () => world.getComponent(drone, "Program")!.codeError !== undefined,
      400,
    );

    expect(world.getComponent(drone, "Program")!.codeError).toMatch(/timeout/i);
    expect(world.getComponent(drone, "Program")!.state).toBe("idle");
  });

  it("identical code produces an identical state trace (determinism)", async () => {
    async function run(): Promise<string[]> {
      const w = new World();
      const drone = addDrone(w);
      w.getComponent(drone, "Program")!.codeSource =
        "await drone.mine(); await drone.charge();";
      const d = new CodeBehaviorDriver({
        createPort: () => new NodeWorkerPort(),
        timeoutMs: 1000,
      });
      const trace: string[] = [];
      try {
        await tickUntil(
          d,
          drone,
          w,
          () => {
            trace.push(w.getComponent(drone, "Program")!.state);
            if (w.getComponent(drone, "Program")!.state === "mine") {
              w.getComponent(drone, "Program")!.state = "running";
            }
            return w.getComponent(drone, "Program")!.state === "charge";
          },
        );
      } finally {
        d.disposeAll();
      }
      return trace;
    }

    const traceA = await run();
    const traceB = await run();
    expect(traceA).toEqual(traceB);
  });
});
```

- [ ] **Step 2: Добавить временные поля в `ProgramComponent` для кода**

`src/game/code/CodeBehaviorDriver.test.ts` использует `program.codeSource` и
`program.codeError`. Добавить опциональные поля в
`src/game/simulation/components/Program.ts`:

```ts
export interface ProgramComponent {
  currentProgramId: string | null;
  callStack: CallFrame[];
  state: ProgramState;
  commandSlots: number;
  personalProgramId: string;
  assignedProgramId?: string;
  mineProgress?: number;
  chargeProgress?: number;
  dropProgress?: number;
  localPaused?: boolean;
  /** Исходный код игрока для source==='code' (этап 1: временно на компоненте). */
  codeSource?: string;
  /** Сообщение об ошибке исполнения кода (включая таймаут синхронного участка). */
  codeError?: string;
}
```

Это additive-изменение, ничего не ломает у существующих систем (поля опциональны).

- [ ] **Step 3: Запустить тесты, убедиться что падают**

Run: `npx vitest run src/game/code/CodeBehaviorDriver.test.ts`
Expected: FAIL — `Cannot find module './CodeBehaviorDriver.js'`

- [ ] **Step 4: Реализовать `CodeBehaviorDriver`**

`src/game/code/CodeBehaviorDriver.ts`:

```ts
import type { EntityId } from "../../shared/types/index.js";
import { DT } from "../simulation/constants.js";
import { planAstarMove } from "../programs/interpreter.js";
import type { BehaviorDriver, BehaviorTickContext } from "./BehaviorDriver.js";
import type { CodeWorkerPort } from "./CodeWorkerPort.js";
import { collectSensors } from "./sensors.js";
import type { WorkerMessage } from "./types.js";

const DEFAULT_TIMEOUT_MS = 1000;

type Phase = "idle" | "action-pending" | "waiting" | "done";

interface Session {
  port: CodeWorkerPort;
  phase: Phase;
  pending: WorkerMessage | null;
  waitRemaining: number;
  timeoutHandle: ReturnType<typeof setTimeout> | null;
  entities: Record<string, EntityId>;
}

export interface CodeBehaviorDriverOptions {
  createPort: () => CodeWorkerPort;
  timeoutMs?: number;
  /** Именованные сущности, доступные коду игрока как глобальные переменные. */
  entities?: (droneId: EntityId, ctx: BehaviorTickContext) => Record<string, EntityId>;
}

/**
 * Driver для дронов с behavior.source === 'code'. Держит по одной worker-сессии
 * на дрона. Каждый await drone.<action>() в коде игрока становится одним
 * intent → program.state выставляется и step() возвращает управление, как
 * в stepProgram. Когда системы вернули state в 'running', driver шлёт воркеру
 * 'resume' со свежим снапшотом сенсоров — промис в воркере резолвится.
 */
export class CodeBehaviorDriver implements BehaviorDriver {
  private readonly sessions = new Map<EntityId, Session>();

  constructor(private readonly options: CodeBehaviorDriverOptions) {}

  step(droneId: EntityId, ctx: BehaviorTickContext): void {
    const program = ctx.world.getComponent(droneId, "Program");
    if (!program) return;

    let session = this.sessions.get(droneId);

    if (!session) {
      const code = program.codeSource;
      if (!code) return;
      const entities = this.options.entities?.(droneId, ctx) ?? {};
      const port = this.options.createPort();
      session = {
        port,
        phase: "idle",
        pending: null,
        waitRemaining: 0,
        timeoutHandle: null,
        entities,
      };
      this.sessions.set(droneId, session);

      port.onMessage((msg) => {
        session!.pending = msg;
        this.clearTimeout(session!);
      });
      port.onError((err) => {
        session!.pending = { type: "error", message: err.message };
        this.clearTimeout(session!);
      });

      port.postMessage({
        type: "start",
        code,
        selfId: droneId,
        entities,
        sensors: collectSensors(ctx.world, droneId, entities),
      });
      this.armTimeout(session, program);
      return;
    }

    // Driver-side ожидание drone.wait(seconds) — не требует похода в воркер.
    if (session.phase === "waiting") {
      session.waitRemaining -= DT;
      if (session.waitRemaining > 1e-9) return;
      session.phase = "idle";
      session.port.postMessage({
        type: "resume",
        sensors: collectSensors(ctx.world, droneId, session.entities),
      });
      this.armTimeout(session, program);
      return;
    }

    if (session.phase === "action-pending") {
      // Действие применено (program.state !== 'running'); ждём, пока системы
      // вернут state обратно в 'running'.
      if (program.state !== "running") return;
      session.phase = "idle";
      session.port.postMessage({
        type: "resume",
        sensors: collectSensors(ctx.world, droneId, session.entities),
      });
      this.armTimeout(session, program);
      return;
    }

    if (session.phase === "done") return;

    // phase === 'idle': проверяем, прислал ли воркер сообщение.
    const msg = session.pending;
    if (!msg) return;
    session.pending = null;

    switch (msg.type) {
      case "intent": {
        if (msg.action === "moveTo") {
          if (msg.targetId !== undefined) {
            planAstarMove(droneId, msg.targetId, ctx.world, ctx.grid, ctx.occupied);
          }
          program.state = "move";
        } else if (msg.action === "mine") {
          program.state = "mine";
        } else if (msg.action === "drop") {
          program.state = "drop";
        } else if (msg.action === "charge") {
          program.state = "charge";
        }
        session.phase = "action-pending";
        return;
      }
      case "wait": {
        session.waitRemaining = msg.seconds;
        session.phase = "waiting";
        return;
      }
      case "finished": {
        session.phase = "done";
        program.state = "idle";
        this.clearTimeout(session);
        return;
      }
      case "error": {
        session.phase = "done";
        program.state = "idle";
        program.codeError = msg.message;
        this.clearTimeout(session);
        return;
      }
    }
  }

  dispose(droneId: EntityId): void {
    const session = this.sessions.get(droneId);
    if (!session) return;
    this.clearTimeout(session);
    session.port.terminate();
    this.sessions.delete(droneId);
  }

  disposeAll(): void {
    for (const droneId of [...this.sessions.keys()]) this.dispose(droneId);
  }

  private armTimeout(
    session: Session,
    program: { state: string; codeError?: string },
  ): void {
    this.clearTimeout(session);
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    session.timeoutHandle = setTimeout(() => {
      session.port.terminate();
      session.phase = "done";
      program.state = "idle";
      program.codeError = `code execution timeout (${timeoutMs}ms) — likely an infinite loop without await`;
    }, timeoutMs);
  }

  private clearTimeout(session: Session): void {
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
      session.timeoutHandle = null;
    }
  }
}
```

- [ ] **Step 5: Запустить тесты**

Run: `npx vitest run src/game/code/CodeBehaviorDriver.test.ts`
Expected: PASS (4 теста). Тест таймаута займёт ~200-400ms реального времени.

Если тест "an infinite loop without await is caught by the timeout" падает потому что
`program.state` не доступен в замыкании `armTimeout` после того, как `program` объект в
World заменён — проверить, что `world.getComponent` всегда возвращает ту же ссылку на
объект компонента (он должен, `World.addComponent` хранит объект напрямую). Если нет —
передавать `droneId`+`world` в `armTimeout` вместо объекта `program` и делать
`ctx.world.getComponent(droneId, "Program")` внутри callback.

- [ ] **Step 6: Прогнать type-check**

Run: `npm run type-check`
Expected: без ошибок

- [ ] **Step 7: Commit**

```bash
git add src/game/code/CodeBehaviorDriver.ts src/game/code/CodeBehaviorDriver.test.ts src/game/simulation/components/Program.ts
git commit -m "feat: добавить CodeBehaviorDriver — исполнение JS-кода дрона через worker (Phase 1)"
```

---

## Task 9: Выбор driver'а в `ProgramExecutionSystem`

**Files:**
- Modify: `src/game/simulation/systems/ProgramExecutionSystem.ts`
- Test: `src/game/simulation/systems/ProgramExecutionSystem.test.ts`

- [ ] **Step 1: Написать падающий тест на выбор code-driver**

Добавить в конец `src/game/simulation/systems/ProgramExecutionSystem.test.ts` (внутри
существующего `describe("ProgramExecutionSystem", ...)`, после последнего теста):

```ts
  it("uses CodeBehaviorDriver when program.codeSource is set", async () => {
    const { CodeBehaviorDriver } = await import("../../code/CodeBehaviorDriver.js");
    const { NodeWorkerPort } = await import("../../code/worker/NodeWorkerPort.js");

    const registry = makeRegistry([]);
    const codeDriver = new CodeBehaviorDriver({
      createPort: () => new NodeWorkerPort(),
      timeoutMs: 1000,
    });
    system = new ProgramExecutionSystem(world, GRID, collision, registry, codeDriver);

    const id = addDrone(world, "running");
    world.getComponent(id, "Program")!.codeSource = "await drone.mine();";

    collision.update();
    for (let i = 0; i < 50; i++) {
      system.update();
      if (world.getComponent(id, "Program")!.state === "mine") break;
      await new Promise((r) => setTimeout(r, 10));
    }

    expect(world.getComponent(id, "Program")!.state).toBe("mine");
    codeDriver.disposeAll();
  }, 5000);
```

- [ ] **Step 2: Запустить тест, убедиться что падает**

Run: `npx vitest run src/game/simulation/systems/ProgramExecutionSystem.test.ts`
Expected: FAIL — конструктор `ProgramExecutionSystem` не принимает 5-й аргумент /
`codeSource` не подхватывается AST-веткой (state остаётся не "mine")

- [ ] **Step 3: Обновить `ProgramExecutionSystem`**

`src/game/simulation/systems/ProgramExecutionSystem.ts`:

```ts
import type { World } from "../world/World.js";
import type { Grid } from "../world/Grid.js";
import type { CollisionSystem } from "./CollisionSystem.js";
import type { ProgramRegistry } from "../../programs/types.js";
import { AstBehaviorDriver } from "../../code/AstBehaviorDriver.js";
import type { BehaviorDriver } from "../../code/BehaviorDriver.js";
import type { CodeBehaviorDriver } from "../../code/CodeBehaviorDriver.js";

export class ProgramExecutionSystem {
  private readonly astDriver: BehaviorDriver = new AstBehaviorDriver();

  constructor(
    private readonly world: World,
    private readonly grid: Grid,
    private readonly collision: CollisionSystem,
    private readonly registry: ProgramRegistry,
    private readonly codeDriver?: CodeBehaviorDriver,
  ) {}

  update(): void {
    const drones = this.world.query("Position", "Movement", "Program");
    for (const id of drones) {
      const program = this.world.getComponent(id, "Program")!;
      if (program.localPaused) continue;
      if (program.state !== "running") continue;

      const ctx = {
        world: this.world,
        grid: this.grid,
        registry: this.registry,
        occupied: this.collision.occupied,
      };

      const driver: BehaviorDriver =
        program.codeSource && this.codeDriver ? this.codeDriver : this.astDriver;

      driver.step(id, ctx);
    }
  }
}
```

Примечание: выбор по `program.codeSource` — временный признак этапа 1 (см. Task 8,
Step 2). Когда в этапе 2 появится полноценный `DroneBehavior.source` на уровне реестра,
условие `program.codeSource && this.codeDriver` нужно будет заменить на проверку
`source === 'code'` — это часть будущей задачи "полная миграция реестра" (см. шапку
плана).

- [ ] **Step 4: Запустить тесты**

Run: `npx vitest run src/game/simulation/systems/ProgramExecutionSystem.test.ts`
Expected: PASS (все тесты, включая новый)

- [ ] **Step 5: Проверить вызовы `new ProgramExecutionSystem(...)` в проде**

Run: `npx vitest run` (полный прогон) — конструктор остаётся обратно совместимым
(`codeDriver` опционален), 5-й аргумент нигде не передаётся в проде на этом этапе.

Найти прод-вызов через grep, чтобы убедиться, что ничего не сломалось:

Run (PowerShell): `Select-String -Path "src/**/*.ts" -Pattern "new ProgramExecutionSystem" -Recurse`
Expected: единственное прод-использование (вероятно в `gameStore.ts` или `world bootstrap`)
продолжает компилироваться без 5-го аргумента.

- [ ] **Step 6: Прогнать type-check**

Run: `npm run type-check`
Expected: без ошибок

- [ ] **Step 7: Commit**

```bash
git add src/game/simulation/systems/ProgramExecutionSystem.ts src/game/simulation/systems/ProgramExecutionSystem.test.ts
git commit -m "feat: ProgramExecutionSystem выбирает driver по program.codeSource (Phase 1)"
```

---

## Task 10: Тест эквивалентности блоки↔код

**Files:**
- Create: `src/game/code/equivalence.test.ts`

Сценарий: одна и та же задача («доехать до руды и добыть») реализована (а) AST-блоками
через `AstBehaviorDriver`/`stepProgram` и (б) JS-кодом через `CodeBehaviorDriver`. Сравниваем
последовательность значений `program.state` по тикам.

- [ ] **Step 1: Написать тест эквивалентности**

`src/game/code/equivalence.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { World } from "../simulation/world/World.js";
import { Grid } from "../simulation/world/Grid.js";
import { AstBehaviorDriver } from "./AstBehaviorDriver.js";
import { CodeBehaviorDriver } from "./CodeBehaviorDriver.js";
import { NodeWorkerPort } from "./worker/NodeWorkerPort.js";
import type { ProgramRegistry, Instruction } from "../programs/types.js";

const GRID = new Grid();
const OCCUPIED = new Set<string>();

function setupWorld(): { world: World; drone: number; ore: number } {
  const world = new World();

  const ore = world.createEntity();
  world.addComponent(ore, "Position", { x: 2, y: 0 });
  world.addComponent(ore, "Deposit", { oreRemaining: 5, oreMax: 5 });

  const drone = world.createEntity();
  world.addComponent(drone, "Position", { x: 0, y: 0 });
  world.addComponent(drone, "Energy", {
    current: 100,
    max: 100,
    drainPerMove: 5,
    drainPerMine: 2,
  });
  world.addComponent(drone, "Inventory", { ore: 0, capacity: 10 });
  world.addComponent(drone, "Movement", {
    targetX: 0,
    targetY: 0,
    path: [],
    progress: 0,
    speed: 1,
  });

  return { world, drone, ore };
}

function applySystems(world: World, droneId: number): void {
  // Минимальная имитация MovementSystem: один шаг пути за тик переводит
  // state 'move' -> 'running', когда путь пройден.
  const movement = world.getComponent(droneId, "Movement")!;
  const program = world.getComponent(droneId, "Program")!;
  if (program.state === "move") {
    if (movement.path.length > 0) {
      const next = movement.path.shift()!;
      const pos = world.getComponent(droneId, "Position")!;
      pos.x = next.x;
      pos.y = next.y;
    }
    if (movement.path.length === 0) {
      program.state = "running";
    }
  } else if (program.state === "mine" || program.state === "drop" || program.state === "charge") {
    program.state = "running";
  }
}

describe("block vs code equivalence", () => {
  it("produces an identical state trace for moveTo+mine", async () => {
    // --- AST ---
    const { world: w1, drone: d1, ore: o1 } = setupWorld();
    const instructions: Instruction[] = [
      { type: "MOVE_TO", targetEntityId: o1 },
      { type: "MINE" },
    ];
    const registry: ProgramRegistry = new Map([
      ["prog", { id: "prog", name: "Prog", instructions }],
    ]);
    w1.addComponent(d1, "Program", {
      currentProgramId: "prog",
      callStack: [{ programId: "prog", instructionIndex: 0 }],
      state: "running",
      commandSlots: 4,
      personalProgramId: "",
    });
    const astDriver = new AstBehaviorDriver();
    const traceAst: string[] = [];
    for (let i = 0; i < 20; i++) {
      const program = w1.getComponent(d1, "Program")!;
      if (program.state !== "running") {
        traceAst.push(program.state);
        applySystems(w1, d1);
        if (program.state === "idle") break;
        continue;
      }
      astDriver.step(d1, { world: w1, grid: GRID, registry, occupied: OCCUPIED });
      traceAst.push(w1.getComponent(d1, "Program")!.state);
      if (w1.getComponent(d1, "Program")!.state === "idle") break;
    }

    // --- CODE ---
    const { world: w2, drone: d2, ore: o2 } = setupWorld();
    w2.addComponent(d2, "Program", {
      currentProgramId: null,
      callStack: [],
      state: "running",
      commandSlots: 4,
      personalProgramId: "",
      codeSource: "await drone.moveTo(ore); await drone.mine();",
    });
    const codeDriver = new CodeBehaviorDriver({
      createPort: () => new NodeWorkerPort(),
      timeoutMs: 1000,
      entities: () => ({ ore: o2 }),
    });
    const traceCode: string[] = [];
    try {
      for (let i = 0; i < 200; i++) {
        const program = w2.getComponent(d2, "Program")!;
        if (program.state === "idle" && traceCode.length > 0) break;
        if (program.state !== "running") {
          traceCode.push(program.state);
          applySystems(w2, d2);
          codeDriver.step(d2, { world: w2, grid: GRID, registry: new Map(), occupied: OCCUPIED });
          continue;
        }
        codeDriver.step(d2, { world: w2, grid: GRID, registry: new Map(), occupied: OCCUPIED });
        await new Promise((r) => setTimeout(r, 5));
      }
    } finally {
      codeDriver.disposeAll();
    }

    // Сравниваем только action-состояния (move/mine), игнорируя количество
    // промежуточных 'running' (синхронизация воркера может занимать разное
    // число тиков ожидания) — порядок и набор action-состояний должны совпасть.
    const actionStates = (trace: string[]) =>
      trace.filter((s) => s === "move" || s === "mine" || s === "idle");

    expect(actionStates(traceCode)).toEqual(actionStates(traceAst));
  }, 10000);
});
```

- [ ] **Step 2: Запустить тест**

Run: `npx vitest run src/game/code/equivalence.test.ts`
Expected: PASS

Если трассы расходятся — отладить через `console.log(traceAst, traceCode)` временно
(удалить после отладки). Частая причина: `applySystems` в коде-ветке вызывается до
`codeDriver.step`, из-за чего порядок `move`→(сколько тиков пути)→`mine` не совпадает с
AST-веткой, которая использует ту же `applySystems`. Убедиться, что обе ветки используют
один и тот же `applySystems` и одинаковый порядок step/applySystems в цикле.

- [ ] **Step 3: Прогнать полный набор тестов и type-check**

Run: `npm test`
Run: `npm run type-check`
Expected: всё зелёное

- [ ] **Step 4: Commit**

```bash
git add src/game/code/equivalence.test.ts
git commit -m "test: добавить тест эквивалентности трассы state блоки vs код (Phase 1)"
```

---

## Task 11: `drone-api.d.ts` — типовой контракт

**Files:**
- Create: `src/game/code/drone-api.d.ts`

- [ ] **Step 1: Написать декларации**

`src/game/code/drone-api.d.ts`:

```ts
/**
 * Контракт API, доступного коду игрока в Code Mode. Используется как:
 * - документация рантайма (codeRuntime реализует этот контракт);
 * - (этап 2) источник подсказок для Monaco.
 */

/** Идентификатор сущности симуляции (дрон, залежь руды, станция и т.п.). */
type EntityRef = number;

interface DroneApi {
  /** Идентификатор самого дрона. */
  readonly self: EntityRef;

  /** Текущий заряд энергии (снапшот на начало тика). */
  readonly energy: number;
  /** Максимальный заряд энергии. */
  readonly energyMax: number;
  /** Текущее количество руды в трюме (снапшот на начало тика). */
  readonly inventory: number;
  /** Вместимость трюма. */
  readonly inventoryMax: number;
  /** Свободные слоты на целевой станции/залежи (снапшот на начало тика). */
  readonly freeSlots: number;

  /** Доехать до сущности (астар, как в блоке MOVE_TO). Резолвится по прибытии. */
  moveTo(target: EntityRef): Promise<void>;
  /** Добыть руду (один тик добычи, как в блоке MINE). */
  mine(): Promise<void>;
  /** Выгрузить руду (как в блоке DROP). */
  drop(): Promise<void>;
  /** Зарядиться (как в блоке CHARGE). */
  charge(): Promise<void>;
  /** Подождать N секунд игрового времени (как в блоке WAIT). */
  wait(seconds: number): Promise<void>;
}

/** Manhattan-расстояние между двумя сущностями (снапшот на начало тика). */
declare function distance(a: EntityRef, b: EntityRef): number;
/** Остаток руды в залежи (снапшот на начало тика). */
declare function deposit(target: EntityRef): number;

declare const drone: DroneApi;
```

- [ ] **Step 2: Прогнать type-check**

Run: `npm run type-check`
Expected: без ошибок (файл — декларация для рантайма воркера, не импортируется напрямую
в этапе 1; убедиться, что `tsconfig.json` `include: ["src"]` не вызывает конфликтов
глобальных деклараций — если `distance`/`drone`/`EntityRef` конфликтуют с другими
глобалами, обернуть файл в `export {}` и не использовать `declare global` — текущий вид
без `declare global` уже файл-модуль с глобальными `declare` только если нет top-level
import/export. Добавить `export {};` в конец файла, чтобы превратить его в модуль и
избежать утечки глобальных имён в остальной проект.)

Если type-check показывает конфликт имён (`distance`, `drone`, `EntityRef`,
`DroneApi`) — добавить `export {};` последней строкой файла.

- [ ] **Step 3: Commit**

```bash
git add src/game/code/drone-api.d.ts
git commit -m "docs: добавить drone-api.d.ts — типовой контракт Code Mode API (Phase 1)"
```

---

## Task 12: Финальная проверка, документация, DECISIONS.md

**Files:**
- Modify: `DECISIONS.md`
- Create: `docs/sessions/<YYYY-MM-DD-HHmm>-feature-drone-code-mode-core.md`
- Modify: `docs/features/planned/drone-code-mode-core.md` → переместить в `docs/features/done/`
- Modify: `docs/features/index.md`

- [ ] **Step 1: Прогнать полный набор проверок**

Run: `npm test`
Run: `npm run type-check`
Expected: всё зелёное

- [ ] **Step 2: Дополнить DECISIONS.md**

Добавить новый абзац в существующую запись `[10-06-2026]` (или новую запись сразу под ней)
с деталями реализации:

```markdown
**[10-06-2026] Реализация ядра Code Mode: CodeWorkerPort, codeRuntime, CodeBehaviorDriver** —
`BehaviorDriver` — общий интерфейс (`step(droneId, ctx)`); `AstBehaviorDriver` — обёртка над
`stepProgram` без изменения поведения. `CodeBehaviorDriver` держит per-drone worker-сессию за
абстракцией `CodeWorkerPort` (`BrowserWorkerPort` поверх `Worker` в проде, `NodeWorkerPort`
поверх `node:worker_threads` + `tsx` в Vitest — оба запускают общий `codeRuntime`, который
гоняет код игрока как `AsyncFunction`). Протокол: `intent`/`wait`/`finished`/`error` от
воркера, `start`/`resume` от driver'а; `drone.wait(seconds)` обрабатывается полностью на
стороне driver'а (не требует похода в воркер каждый тик). Таймаут синхронного участка между
`await` — `setTimeout` в driver'е + `port.terminate()`. Сенсоры — снапшот `SensorsSnapshot`
(`collectSensors`), формируется на старте каждого resume, обеспечивает консистентность
геттеров `drone.*`/`distance()`/`deposit()` в пределах тика. Этап 1: код передаётся через
временное поле `program.codeSource` (additive в `ProgramComponent`); `ProgramExecutionSystem`
выбирает driver по наличию `codeSource`. Полная миграция `ProgramRegistry`/`ProgramDef` на
дискриминированный `DroneBehavior` (`source: 'block'|'code'`) — отдельная будущая задача
после Monaco (этап 2), т.к. затрагивает 14 файлов (миссии, UI редактор, рендерер, store).
```

- [ ] **Step 3: Обновить статус фичи**

В `docs/features/planned/drone-code-mode-core.md` отметить чекбоксы критериев готовности,
выполненные на этом этапе (тип `DroneBehavior` добавлен как additive — не как полная
миграция реестра; явно отметить это нюансом в файле). Переместить файл в
`docs/features/done/drone-code-mode-core.md` только если **все** критерии в файле
выполнены буквально — иначе оставить в `planned/` с обновлённым статусом и пометкой, какие
пункты перенесены в будущую задачу полной миграции реестра. Обновить таблицу в
`docs/features/index.md` соответственно.

- [ ] **Step 4: Записать сессию**

Создать `docs/sessions/2026-06-10-1500-feature-drone-code-mode-core.md` (использовать
текущее время вместо `1500`) с кратким описанием: цель (ядро Code Mode без Monaco),
результаты (какие файлы добавлены/изменены, какие тесты добавлены, что осталось на
будущее — полная миграция реестра, Monaco/этап 2).

- [ ] **Step 5: Commit документации**

```bash
git add DECISIONS.md docs/features/planned/drone-code-mode-core.md docs/features/done/ docs/features/index.md docs/sessions/
git commit -m "docs: зафиксировать реализацию ядра Code Mode и обновить статус фичи (Phase 1)"
```

---

## Self-review notes

- Все типы (`DroneBehavior`, `SensorsSnapshot`, `WorkerMessage`, `DriverMessage`,
  `CodeWorkerPort`, `BehaviorDriver`) определены в Task 1-3 до использования в Task 4+.
- `program.codeSource`/`program.codeError` — временные additive-поля для этапа 1 (Task 8,
  Step 2), явно помечены как временные в DECISIONS.md (Task 12). Полная интеграция с
  `DroneBehavior.source` — будущая задача.
- `planAstarMove` (Task 6) переиспользуется и в `stepProgram` (без изменения поведения,
  проверено существующими тестами `interpreter.test.ts`), и в `CodeBehaviorDriver` (Task 8).
- Таймаут (Task 8, тест в Task 8 Step 1) и эквивалентность (Task 10) — оба критерия
  готовности из `drone-code-mode-core.md` покрыты.
- `tsx` — единственная новая зависимость, только для Node-исполнения `.ts` воркера в
  тестах; в проде воркер собирается Vite как обычный модуль.
