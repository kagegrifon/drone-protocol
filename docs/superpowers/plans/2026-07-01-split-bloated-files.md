# Разбиение раздутых файлов — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Разбить три раздутых файла (`gameStore.ts`, `DroneInspector/index.tsx`, `GameScene.ts`) на файлы/классы с одной ответственностью, не меняя поведение и внешние API.

**Architecture:** Чисто механический вынос кода. Store → чистые хелперы + типы в отдельные файлы, сам store реэкспортирует типы для сохранения публичного API. INSPECTOR → примитивы/хук/стили/крупные компоненты по файлам, `index.tsx` только собирает. GameScene → класс-контроллер `PointerInteractionController` (композиция) забирает hover/cell-select логику.

**Tech Stack:** TypeScript, React, Zustand, Phaser 3, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-01-split-bloated-files-design.md`

## Global Constraints

- **Поведение, рендер и внешние API байт-в-байт неизменны.** Это refactor без изменения логики.
- **Все `data-testid` сохраняются без изменений** — e2e зависит от них.
- **Публичный API стора неизменен:** внешние импортёры типов (`DroneState`, `BuildingState`, `SelectedCell`, `StatsState`) из `gameStore.js` не трогаем — store реэкспортирует эти типы.
- Читаемость — приоритет №1 (CLAUDE.md): без вложенных тернарников, именованные промежуточные значения, options-объект при 3+ параметрах, lookup-map вместо if/switch-цепочек. В этом рефакторе **новую** логику не пишем — просто не ломаем существующую при переносе.
- Проверка после каждой задачи: `npm run type-check` + `npm test`. Финальная регрессия: `npm run test:e2e`.
- Коммиты: тип `refactor:`, описание в императиве (рус. или англ.). Каждая задача — свой коммит.
- Никогда не `git add -A` — добавлять только файлы задачи.

---

## Порядок задач

1. **Task 1** — gameStore.ts (изолирован, чистый TS).
2. **Task 2** — DroneInspector (зависит от типов store, поэтому после Task 1).
3. **Task 3** — GameScene / PointerInteractionController (изолирован от 1–2).
4. **Task 4** — финальная e2e-регрессия + обновление карточки фичи.

---

### Task 1: Вынести хелперы и типы из gameStore.ts

**Files:**
- Create: `src/shared/store/types.ts`
- Create: `src/shared/store/computeActivePath.ts`
- Create: `src/shared/store/snapshots.ts`
- Modify: `src/shared/store/gameStore.ts`
- Modify: `src/shared/store/computeActivePath.test.ts:2` (обновить путь импорта)

**Interfaces:**
- Produces (из `types.ts`): `DroneState`, `StatsState`, `HoveredCell`, `SelectedCell`, `BuildingState`, `Systems`, `GameStore` — интерфейсы/типы без изменений сигнатур.
- Produces (из `computeActivePath.ts`): `export function computeActivePath(callStack: CallFrame[], state: ProgramState): number[] | null`.
- Produces (из `snapshots.ts`): `snapshotDrones(world: World): DroneState[]`, `snapshotBuildings(world: World, typeMap: ReadonlyMap<EntityId, WorldObjectType>): BuildingState[]`, `resetDroneProgram(world: World, droneId: EntityId): void`, `filterPrograms(registry: ProgramRegistry): ProgramDef[]`, `REF_ARRAY_BY_TYPE: Record<WorldObjectType, string>`.
- Consumes: `gameStore.ts` импортирует всё вышеперечисленное; реэкспортирует типы, которые нужны внешним импортёрам (`DroneState`, `StatsState`, `HoveredCell`, `SelectedCell`, `BuildingState`).

- [ ] **Step 1: Создать `src/shared/store/types.ts`**

Перенести из `gameStore.ts` (строки 24–39, 70–95, 97–152) типы, добавив нужные импорты. Полное содержимое файла:

```ts
import type { EntityId, WorldObjectType } from "../types/index.js";
import type { GameStatus } from "@/game/types.js";
import type { World } from "@/game/simulation/world/World.js";
import type { Grid } from "@/game/simulation/world/Grid.js";
import type { ProgramRegistry, ProgramDef } from "@/game/programs/types.js";
import type { ProgramState } from "../../game/simulation/components/Program.js";
import type { StackFrame } from "../../game/code/linker/mapLine.js";
import type { CollisionSystem } from "../../game/simulation/systems/CollisionSystem.js";
import type { ModifiersSystem } from "../../game/simulation/systems/ModifiersSystem.js";
import type { ProgramExecutionSystem } from "../../game/simulation/systems/ProgramExecutionSystem.js";
import type { MovementSystem } from "../../game/simulation/systems/MovementSystem.js";
import type { MiningSystem } from "../../game/simulation/systems/MiningSystem.js";
import type { EnergySystem } from "../../game/simulation/systems/EnergySystem.js";
import type { StatisticsSystem } from "../../game/simulation/systems/StatisticsSystem.js";
import type { CodeWorkerPort } from "../../game/code/CodeWorkerPort.js";

export interface DroneState {
  id: EntityId;
  position: { x: number; y: number };
  energy: { current: number; max: number };
  inventory: { ore: number; capacity: number };
  programState: ProgramState;
  currentInstruction: string;
  currentProgramId: string | null;
  currentInstructionPath: number[] | null;
  personalProgramId: string;
  assignedProgramId?: string;
  localPaused: boolean;
  codeError?: string;
  currentLine: number | null;
  codeStack: StackFrame[] | null;
}

export interface StatsState {
  orePerMin: number;
  congestion: number;
  efficiency: number;
  tick: number;
  oreMined: number;
}

export type HoveredCell = { x: number; y: number } | null;

export type SelectedCell = { x: number; y: number } | null;

/**
 * Здание (шахта/база/зарядка) для INSPECTOR. `ref` — строка вида `World.mines[0]`,
 * которую игрок может вставить в код дрона. Индекс совпадает с индексом в World API,
 * т.к. порядок берётся из того же `typeMap`, что видит код дрона (см. collectWorld).
 */
export interface BuildingState {
  entityId: EntityId;
  type: WorldObjectType;
  x: number;
  y: number;
  ref: string;
  /** Остаток руды — только для шахты. */
  oreRemaining?: number;
}

export interface Systems {
  collision: CollisionSystem;
  modifiers: ModifiersSystem;
  programExecution: ProgramExecutionSystem;
  movement: MovementSystem;
  mining: MiningSystem;
  energy: EnergySystem;
  statistics: StatisticsSystem;
}

export interface GameStore {
  world: World | null;
  grid: Grid | null;
  registry: ProgramRegistry;
  drones: DroneState[];
  buildings: BuildingState[];
  selectedDroneId: EntityId | null;
  selectedCell: SelectedCell;
  hoveredCell: HoveredCell;
  programs: ProgramDef[];
  stats: StatsState;
  isRunning: boolean;
  gameStatus: GameStatus;
  statusMessage: string | null;
  _systems: Systems | null;
  _staticTypeMap: ReadonlyMap<EntityId, WorldObjectType>;
  _tickCount: number;

  init(
    world: World,
    grid: Grid,
    registry: ProgramRegistry,
    options?: {
      createPort?: () => CodeWorkerPort;
      staticEntities?: ReadonlyArray<{
        id: EntityId;
        type: WorldObjectType;
      }>;
    },
  ): void;
  setProgramCodeSource(programId: string, code: string): void;
  tick(): void;
  selectDrone(id: EntityId | null): void;
  selectCell(cell: SelectedCell): void;
  setHoveredCell(cell: HoveredCell): void;
  setRunning(v: boolean): void;
  stepOnce(): void;
  setGameStatus(status: GameStatus, message?: string): void;
  createProgram(name: string): string;
  assignProgram(droneId: EntityId, programId: string): void;
  unassignProgram(droneId: EntityId): void;
  restartProgram(droneId: EntityId): void;
  startDrone(droneId: EntityId): void;
  pauseDrone(droneId: EntityId): void;
  resetDrone(droneId: EntityId): void;
}
```

- [ ] **Step 2: Создать `src/shared/store/computeActivePath.ts`**

Перенести функцию из `gameStore.ts` (строки 41–68) с импортом типов:

```ts
import type {
  ProgramState,
  CallFrame,
} from "../../game/simulation/components/Program.js";

export function computeActivePath(
  callStack: CallFrame[],
  state: ProgramState,
): number[] | null {
  if (callStack.length === 0) return null;

  const path: number[] = [];

  for (let i = 0; i < callStack.length; i++) {
    const frame = callStack[i];
    const isTop = i === callStack.length - 1;

    if (isTop) {
      const isWaiting =
        (state !== "idle" && state !== "running") ||
        (frame.waitRemaining !== undefined && frame.waitRemaining > 0);
      const idx = isWaiting
        ? frame.instructionIndex - 1
        : frame.instructionIndex;
      if (idx < 0) return null;
      path.push(idx);
    } else {
      path.push(frame.instructionIndex);
    }
  }

  return path;
}
```

- [ ] **Step 3: Создать `src/shared/store/snapshots.ts`**

Перенести из `gameStore.ts` `filterPrograms` (154–156), `resetDroneProgram` (158–173), `snapshotDrones` (175–217), `REF_ARRAY_BY_TYPE` (219–224), `snapshotBuildings` (226–258). Файл целиком:

```ts
import type { EntityId, WorldObjectType } from "../types/index.js";
import type { World } from "@/game/simulation/world/World.js";
import type { ProgramRegistry, ProgramDef } from "@/game/programs/types.js";
import { computeActivePath } from "./computeActivePath.js";
import type { DroneState, BuildingState } from "./types.js";

export function filterPrograms(registry: ProgramRegistry): ProgramDef[] {
  return Array.from(registry.values()).filter((p) => !p.personal);
}

export function resetDroneProgram(world: World, droneId: EntityId): void {
  const program = world.getComponent(droneId, "Program");
  if (!program || !program.currentProgramId) return;
  program.callStack = [
    { programId: program.currentProgramId, instructionIndex: 0 },
  ];
  program.state = "running";
  program.mineProgress = undefined;
  program.chargeProgress = undefined;
  program.dropProgress = undefined;
  const movement = world.getComponent(droneId, "Movement");
  if (movement) {
    movement.path = [];
    movement.progress = 0;
  }
}

export function snapshotDrones(world: World): DroneState[] {
  const ids = world.query("Position", "Energy", "Inventory", "Program");
  return ids.map((id) => {
    const pos = world.getComponent(id, "Position")!;
    const energy = world.getComponent(id, "Energy")!;
    const inventory = world.getComponent(id, "Inventory")!;
    const program = world.getComponent(id, "Program")!;

    let currentInstruction = "—";
    const frame = program.callStack[program.callStack.length - 1];
    if (frame) {
      const isWaiting =
        (program.state !== "idle" && program.state !== "running") ||
        (frame.waitRemaining !== undefined && frame.waitRemaining > 0);
      const idx = isWaiting
        ? frame.instructionIndex - 1
        : frame.instructionIndex;
      if (idx >= 0) {
        currentInstruction = "-TODO-"; // понять что тут выводить
      }
    }

    return {
      id,
      position: { x: pos.x, y: pos.y },
      energy: { current: energy.current, max: energy.max },
      inventory: { ore: inventory.ore, capacity: inventory.capacity },
      programState: program.state,
      currentInstruction,
      currentProgramId: program.currentProgramId,
      currentInstructionPath: computeActivePath(
        program.callStack,
        program.state,
      ),
      personalProgramId: program.personalProgramId,
      assignedProgramId: program.assignedProgramId,
      localPaused: program.localPaused ?? false,
      codeError: program.codeError,
      currentLine: program.currentLine ?? null,
      codeStack: program.codeStack ?? null,
    };
  });
}

/** Множественное число типа здания для рефа: mine → mines и т.д. */
export const REF_ARRAY_BY_TYPE: Record<WorldObjectType, string> = {
  mine: "mines",
  base: "bases",
  charger: "chargers",
};

/**
 * Срез зданий для React. Порядок и классификация — как в collectWorld:
 * итерация по typeMap, поэтому индекс внутри массива своего типа совпадает
 * с индексом в World API (`World.mines[0]`).
 */
export function snapshotBuildings(
  world: World,
  typeMap: ReadonlyMap<EntityId, WorldObjectType>,
): BuildingState[] {
  const indexByType: Record<WorldObjectType, number> = {
    mine: 0,
    base: 0,
    charger: 0,
  };
  const buildings: BuildingState[] = [];

  for (const [entityId, type] of typeMap) {
    const pos = world.getComponent(entityId, "Position");
    if (!pos) continue; // уничтоженные сущности — пропускаем

    const index = indexByType[type]++;
    const ref = `World.${REF_ARRAY_BY_TYPE[type]}[${index}]`;

    const building: BuildingState = { entityId, type, x: pos.x, y: pos.y, ref };
    if (type === "mine") {
      const deposit = world.getComponent(entityId, "Deposit");
      building.oreRemaining = deposit?.oreRemaining ?? 0;
    }
    buildings.push(building);
  }

  return buildings;
}
```

- [ ] **Step 4: Переписать `src/shared/store/gameStore.ts`**

Убрать перенесённые определения, добавить импорты из новых файлов, реэкспортировать типы для внешних импортёров. Верхняя часть файла (до `let _programIdCounter`) заменяется на:

```ts
import { create } from "zustand";
import type { EntityId, WorldObjectType } from "../types/index.js";
import type { ProgramDef } from "@/game/programs/types.js";
import { CollisionSystem } from "../../game/simulation/systems/CollisionSystem.js";
import { ModifiersSystem } from "../../game/simulation/systems/ModifiersSystem.js";
import { ProgramExecutionSystem } from "../../game/simulation/systems/ProgramExecutionSystem.js";
import { MovementSystem } from "../../game/simulation/systems/MovementSystem.js";
import { MiningSystem } from "../../game/simulation/systems/MiningSystem.js";
import { EnergySystem } from "../../game/simulation/systems/EnergySystem.js";
import { StatisticsSystem } from "../../game/simulation/systems/StatisticsSystem.js";
import { CodeBehaviorDriver } from "../../game/code/CodeBehaviorDriver.js";
import { dependentsOf } from "../../game/code/linker/dependentsOf.js";
import { BrowserWorkerPort } from "../../game/code/worker/BrowserWorkerPort.js";
import type { GameStatus } from "@/game/types.js";
import type { Systems, GameStore } from "./types.js";
import {
  filterPrograms,
  resetDroneProgram,
  snapshotDrones,
  snapshotBuildings,
} from "./snapshots.js";

// Реэкспорт типов для внешних импортёров (публичный API стора неизменен).
export type {
  DroneState,
  StatsState,
  HoveredCell,
  SelectedCell,
  BuildingState,
} from "./types.js";
export { computeActivePath } from "./computeActivePath.js";

let _programIdCounter = 1;
```

Тело `create<GameStore>((set, get) => ({ ... }))` (строки 262–516 оригинала) остаётся без изменений — оно уже использует `filterPrograms`, `resetDroneProgram`, `snapshotDrones`, `snapshotBuildings`, теперь импортированные. `WorldObjectType` и `EntityId` всё ещё используются в теле (`Map<EntityId, WorldObjectType>` в `init`), поэтому импорты сохранены.

Примечание: `computeActivePath` реэкспортируется, потому что `computeActivePath.test.ts` исторически импортировал его из `gameStore.js` — но Step 5 переведёт тест на прямой путь, а реэкспорт оставляем на случай других потребителей (безвредно, публичный API шире не становится).

- [ ] **Step 5: Обновить импорт в `src/shared/store/computeActivePath.test.ts`**

Строка 2 — заменить путь:

```ts
import { computeActivePath } from "./computeActivePath.js";
```

- [ ] **Step 6: Проверить типы и тесты**

Run: `npm run type-check`
Expected: без ошибок.

Run: `npm test`
Expected: все зелёные (включая `computeActivePath.test.ts` и `gameStore.test.ts`).

- [ ] **Step 7: Commit**

```bash
git add src/shared/store/types.ts src/shared/store/computeActivePath.ts src/shared/store/snapshots.ts src/shared/store/gameStore.ts src/shared/store/computeActivePath.test.ts
git commit -m "refactor: вынести типы и snapshot-хелперы из gameStore"
```

---

### Task 2: Разбить DroneInspector/index.tsx по компонентам

**Files:**
- Create: `src/ui/panels/DroneInspector/styles.ts`
- Create: `src/ui/panels/DroneInspector/useCopyFeedback.ts`
- Create: `src/ui/panels/DroneInspector/Bar.tsx`
- Create: `src/ui/panels/DroneInspector/Row.tsx`
- Create: `src/ui/panels/DroneInspector/CopyableValue.tsx`
- Create: `src/ui/panels/DroneInspector/DroneControls.tsx`
- Create: `src/ui/panels/DroneInspector/CellInspector.tsx`
- Create: `src/ui/panels/DroneInspector/InspectorEmpty.tsx`
- Modify: `src/ui/panels/DroneInspector/index.tsx`

**Interfaces:**
- Consumes (из Task 1): `BuildingState`, `SelectedCell` из `../../../shared/store/gameStore.js` (реэкспорт сохранён — путь импорта не меняется).
- Produces: компоненты `Bar`, `Row`, `CopyableValue`, `DroneControls`, `CellInspector`, `InspectorEmpty`, хук `useCopyFeedback`, объекты стилей `BTN`, `COPY_BTN`, `MONO`, `COPIED_FEEDBACK_MS`.

- [ ] **Step 1: Создать `src/ui/panels/DroneInspector/styles.ts`**

Разделяемые стили и константа. Перенести `COPIED_FEEDBACK_MS` (стр. 8), `BTN` (76–86), `COPY_BTN` (123–133), `MONO` (135–138):

```ts
export const COPIED_FEEDBACK_MS = 1200;

export const BTN: React.CSSProperties = {
  background: "#0a1628",
  border: "1px solid #1e3a5f",
  color: "#aabbcc",
  fontFamily: "monospace",
  fontSize: "13px",
  padding: "4px 10px",
  borderRadius: "3px",
  cursor: "pointer",
  lineHeight: 1,
};

export const COPY_BTN: React.CSSProperties = {
  background: "#0d2040",
  border: "1px solid #1a3a5a",
  color: "#4a8aaa",
  borderRadius: "3px",
  padding: "2px 8px",
  cursor: "pointer",
  fontFamily: "monospace",
  fontSize: "12px",
  lineHeight: 1,
};

export const MONO: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: "12px",
};
```

- [ ] **Step 2: Создать `src/ui/panels/DroneInspector/useCopyFeedback.ts`**

Перенести хук (стр. 140–162):

```ts
import { useEffect, useRef, useState } from "react";
import { COPIED_FEEDBACK_MS } from "./styles.js";

/** Копирование значения в буфер с временным фидбэком ⧉ → ✓. */
export function useCopyFeedback() {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(
      () => setCopied(false),
      COPIED_FEEDBACK_MS,
    );
  };

  return { copied, copy };
}
```

- [ ] **Step 3: Создать `src/ui/panels/DroneInspector/Bar.tsx`**

Перенести компонент (стр. 10–41):

```tsx
export function Bar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      style={{
        height: "6px",
        background: "#0a1a2a",
        borderRadius: "3px",
        overflow: "hidden",
        flex: 1,
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: "3px",
          transition: "width 0.1s",
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Создать `src/ui/panels/DroneInspector/Row.tsx`**

Перенести компонент (стр. 43–74):

```tsx
export function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "8px",
      }}
    >
      <span
        style={{
          color: "#445566",
          fontFamily: "monospace",
          fontSize: "11px",
          width: "72px",
          flexShrink: 0,
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Создать `src/ui/panels/DroneInspector/CopyableValue.tsx`**

Перенести компонент (стр. 164–196), импортируя стили и хук:

```tsx
import { useCopyFeedback } from "./useCopyFeedback.js";
import { COPY_BTN, MONO } from "./styles.js";

export function CopyableValue({
  testId,
  copyTestId,
  color,
  text,
  copyText,
  title,
}: {
  testId: string;
  copyTestId: string;
  color: string;
  text: string;
  copyText: string;
  title: string;
}) {
  const { copied, copy } = useCopyFeedback();

  return (
    <>
      <span data-testid={testId} style={{ ...MONO, color }}>
        {text}
      </span>
      <button
        data-testid={copyTestId}
        style={COPY_BTN}
        onClick={() => copy(copyText)}
        title={title}
      >
        {copied ? "✓" : "⧉"}
      </button>
    </>
  );
}
```

- [ ] **Step 6: Создать `src/ui/panels/DroneInspector/DroneControls.tsx`**

Перенести компонент (стр. 88–121):

```tsx
import { memo } from "react";
import { useGameStore } from "../../../shared/store/gameStore.js";
import { BTN } from "./styles.js";

export const DroneControls = memo(function DroneControls({
  droneId,
  localPaused,
}: {
  droneId: number;
  localPaused: boolean;
}) {
  const startDrone = useGameStore((s) => s.startDrone);
  const pauseDrone = useGameStore((s) => s.pauseDrone);
  const resetDrone = useGameStore((s) => s.resetDrone);

  return (
    <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
      <button
        data-testid="drone-play-pause"
        style={BTN}
        onClick={() =>
          localPaused ? startDrone(droneId) : pauseDrone(droneId)
        }
        title={localPaused ? "Resume drone" : "Pause drone"}
      >
        {localPaused ? "▶" : "⏸"}
      </button>
      <button
        data-testid="drone-reset"
        style={BTN}
        onClick={() => resetDrone(droneId)}
        title="Reset drone program"
      >
        ↺
      </button>
    </div>
  );
});
```

- [ ] **Step 7: Создать `src/ui/panels/DroneInspector/CellInspector.tsx`**

Перенести `CellInspector` (стр. 198–231) и `BuildingRows` (233–258):

```tsx
import { useGameStore } from "../../../shared/store/gameStore.js";
import type { BuildingState } from "../../../shared/store/gameStore.js";
import { Row } from "./Row.js";
import { CopyableValue } from "./CopyableValue.js";
import { MONO } from "./styles.js";

function BuildingRows({ building }: { building: BuildingState }) {
  return (
    <>
      <Row label="REF">
        <CopyableValue
          testId="cell-inspector-ref"
          copyTestId="cell-inspector-ref-copy"
          color="#4488ff"
          text={building.ref}
          copyText={building.ref}
          title="Скопировать ссылку"
        />
      </Row>
      {building.type === "mine" && (
        <Row label="ORE">
          <span
            data-testid="cell-inspector-ore"
            style={{ ...MONO, color: "#00ff88" }}
          >
            {building.oreRemaining}
          </span>
        </Row>
      )}
    </>
  );
}

export function CellInspector({ cell }: { cell: { x: number; y: number } }) {
  const buildings = useGameStore((s) => s.buildings);
  const building = buildings.find((b) => b.x === cell.x && b.y === cell.y);

  return (
    <div data-testid="cell-inspector" style={{ padding: "12px" }}>
      <div
        style={{
          color: "#c0cfe0",
          fontFamily: "monospace",
          fontSize: "13px",
          marginBottom: "12px",
          borderBottom: "1px solid #1e3a5f",
          paddingBottom: "8px",
        }}
      >
        Cell
      </div>

      <Row label="POS">
        <CopyableValue
          testId="cell-inspector-pos"
          copyTestId="cell-inspector-copy"
          color="#00d4ff"
          text={`x: ${cell.x} y: ${cell.y}`}
          copyText={`{ x: ${cell.x}, y: ${cell.y} }`}
          title="Скопировать координаты"
        />
      </Row>

      {building && <BuildingRows building={building} />}
    </div>
  );
}
```

- [ ] **Step 8: Создать `src/ui/panels/DroneInspector/InspectorEmpty.tsx`**

Перенести компонент (стр. 260–275):

```tsx
export function InspectorEmpty() {
  return (
    <div
      data-testid="drone-inspector-empty"
      style={{
        padding: "16px 12px",
        color: "#445566",
        fontFamily: "monospace",
        fontSize: "12px",
        textAlign: "center",
      }}
    >
      Select a drone
    </div>
  );
}
```

- [ ] **Step 9: Переписать `src/ui/panels/DroneInspector/index.tsx`**

Оставить только главный компонент + `renderNonDrone`, всё импортировать. Файл целиком:

```tsx
import { useGameStore } from "../../../shared/store/gameStore.js";
import type { SelectedCell } from "../../../shared/store/gameStore.js";
import { Bar } from "./Bar.js";
import { Row } from "./Row.js";
import { DroneControls } from "./DroneControls.js";
import { CellInspector } from "./CellInspector.js";
import { InspectorEmpty } from "./InspectorEmpty.js";

function renderNonDrone(selectedCell: SelectedCell) {
  if (selectedCell === null) return <InspectorEmpty />;
  return <CellInspector cell={selectedCell} />;
}

export function DroneInspector() {
  const selectedId = useGameStore((s) => s.selectedDroneId);
  const selectedCell = useGameStore((s) => s.selectedCell);
  const drones = useGameStore((s) => s.drones);
  const drone = drones.find((d) => d.id === selectedId);

  // Выбор дрона и клетки взаимоисключающи (гарантируется store). Приоритет:
  // дрон → клетка → пусто.
  if (!drone) {
    return renderNonDrone(selectedCell);
  }

  const stateColor =
    drone.programState === "running"
      ? "#00d4ff"
      : drone.programState !== "idle"
        ? "#ffd700"
        : "#445566";

  return (
    <div style={{ padding: "12px" }}>
      <div
        style={{
          color: "#c0cfe0",
          fontFamily: "monospace",
          fontSize: "13px",
          marginBottom: "12px",
          borderBottom: "1px solid #1e3a5f",
          paddingBottom: "8px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <span>Drone #{drone.id}</span>
        <span
          style={{ color: stateColor, fontSize: "11px", letterSpacing: "1px" }}
        >
          {drone.programState.toUpperCase()}
        </span>
        {drone.localPaused && (
          <span
            data-testid="local-paused-badge"
            style={{ color: "#ff8844", fontSize: "11px", letterSpacing: "1px" }}
          >
            [LOCAL PAUSED]
          </span>
        )}
      </div>

      <DroneControls droneId={drone.id} localPaused={drone.localPaused} />

      <Row label="ENERGY">
        <Bar
          value={drone.energy.current}
          max={drone.energy.max}
          color="#00d4ff"
        />
        <span
          style={{
            color: "#aabbcc",
            fontFamily: "monospace",
            fontSize: "11px",
            whiteSpace: "nowrap",
          }}
        >
          {Math.round(drone.energy.current)}/{drone.energy.max}
        </span>
      </Row>

      <Row label="ORE">
        <Bar
          value={drone.inventory.ore}
          max={drone.inventory.capacity}
          color="#00ff88"
        />
        <span
          style={{
            color: "#aabbcc",
            fontFamily: "monospace",
            fontSize: "11px",
            whiteSpace: "nowrap",
          }}
        >
          {drone.inventory.ore}/{drone.inventory.capacity}
        </span>
      </Row>

      <Row label="TASK">
        <span
          style={{
            color: "#ffd700",
            fontFamily: "monospace",
            fontSize: "12px",
          }}
        >
          {drone.currentInstruction}
        </span>
      </Row>

      <Row label="PROGRAM">
        <span
          style={{
            color: "#4488ff",
            fontFamily: "monospace",
            fontSize: "12px",
          }}
        >
          {drone.currentProgramId ?? "—"}
        </span>
      </Row>

      <Row label="POS">
        <span
          style={{
            color: "#778899",
            fontFamily: "monospace",
            fontSize: "11px",
          }}
        >
          {drone.position.x}, {drone.position.y}
        </span>
      </Row>
    </div>
  );
}
```

Примечание: `stateColor` — вложенный тернарник. По правилам CLAUDE.md его стоит распутать, но это относится к фазе «чистки» (после разбиения), а не к механическому выносу. Оставляем как есть в этой задаче.

- [ ] **Step 10: Проверить типы и тесты**

Run: `npm run type-check`
Expected: без ошибок.

Run: `npm test`
Expected: зелёные.

- [ ] **Step 11: Commit**

```bash
git add src/ui/panels/DroneInspector/
git commit -m "refactor: разбить DroneInspector на компоненты, хук и стили"
```

---

### Task 3: Выделить PointerInteractionController из GameScene

**Files:**
- Create: `src/renderer/scenes/PointerInteractionController.ts`
- Modify: `src/renderer/scenes/GameScene.ts`

**Interfaces:**
- Produces: `class PointerInteractionController` с конструктором `constructor(options: { scene: Phaser.Scene; grid: Grid })` и публичным методом `markDroneSelectedThisGesture(): void`.
- Consumes: `Grid`, `TILE_SIZE`, `COLORS`, `useGameStore`, `CellType`. Registry-колбэк `onCellClick` читается из `scene.registry`.

- [ ] **Step 1: Создать `src/renderer/scenes/PointerInteractionController.ts`**

Класс владеет hover/cell-select логикой. Полное содержимое:

```ts
import Phaser from "phaser";
import type { Grid } from "../../game/simulation/world/Grid.js";
import type { CellType } from "../../shared/constants/cellTypes.js";
import { TILE_SIZE, COLORS } from "../config.js";
import { useGameStore } from "../../shared/store/gameStore.js";

const BUILDING_TILES = new Set<CellType>(["mine", "base", "charger"]);

// Смещение указателя (в пикселях) больше этого порога считаем панорамированием, а не кликом.
const CLICK_DRAG_THRESHOLD_PX = 4;

/**
 * Ховер клетки и выбор клетки кликом — вынесено из GameScene (фича cell-coordinates-hud).
 * Владеет собственной hover-графикой; вешает свои обработчики pointermove/down/up/gameout.
 * Выбор дрона имеет приоритет над клеткой под ним: спрайт дрона взводит флаг жеста через
 * markDroneSelectedThisGesture().
 */
export class PointerInteractionController {
  private readonly _scene: Phaser.Scene;
  private readonly _grid: Grid;
  private readonly _hoverHighlight: Phaser.GameObjects.Graphics;
  private _hoverPrevCell: { x: number; y: number } | null = null;
  // Различаем клик по клетке от драг-панорамирования: запоминаем старт жеста,
  // а флаг взводится, если на этом жесте уже выбран дрон (у дрона приоритет).
  private _pointerDownAt: { x: number; y: number } | null = null;
  private _droneSelectedThisGesture = false;

  constructor(options: { scene: Phaser.Scene; grid: Grid }) {
    this._scene = options.scene;
    this._grid = options.grid;

    this._hoverHighlight = this._scene.add.graphics().setDepth(6);
    this._hoverHighlight.setVisible(false);

    // "gameout" fires when the pointer leaves the canvas element (not a game object).
    // "pointerout" fires when the pointer leaves an interactive game object — wrong for this use.
    this._scene.input.on("gameout", () => this.clearHover());

    this._scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      // При драге (панорамирование камеры) ховер скрыт; сам скролл камеры
      // делает GameScene своим отдельным pointermove-слушателем.
      if (pointer.isDown) {
        this.clearHover();
        return;
      }
      this.updateHoveredCell(pointer);
    });

    // Клик по клетке (не по дрону, не панорама) → выбрать клетку в INSPECTOR.
    // Флаг _droneSelectedThisGesture НЕ сбрасываем здесь: Phaser эмитит
    // object-level "pointerdown" спрайта дрона раньше сценевого "pointerdown"
    // (см. InputPlugin.processDownEvents), так что сброс тут перезаписал бы
    // флаг, который спрайт уже взвёл в рамках того же жеста. Сбрасываем его
    // в pointerup — к следующему жесту он снова false.
    this._scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this._pointerDownAt = { x: pointer.x, y: pointer.y };
    });

    this._scene.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      const downAt = this._pointerDownAt;
      this._pointerDownAt = null;
      const droneSelected = this._droneSelectedThisGesture;
      this._droneSelectedThisGesture = false;
      if (droneSelected) return; // дрон уже выбран этим жестом
      if (!downAt) return;

      const moved = Math.hypot(pointer.x - downAt.x, pointer.y - downAt.y);
      if (moved > CLICK_DRAG_THRESHOLD_PX) return; // это было панорамирование

      const cell = this.pointerToCell(pointer);
      if (!cell) return;

      const onCellClick = this._scene.registry.get("onCellClick") as
        | ((cell: { x: number; y: number }) => void)
        | undefined;
      onCellClick?.(cell);
    });
  }

  /**
   * Спрайт дрона вызывает это в своём pointerdown: дрон имеет приоритет над выбором
   * клетки, помечаем жест, чтобы pointerup не перезаписал выбор клеткой под дроном.
   */
  markDroneSelectedThisGesture(): void {
    this._droneSelectedThisGesture = true;
  }

  private isBuildingTile(tile: CellType): boolean {
    return BUILDING_TILES.has(tile);
  }

  /**
   * Курсор действительно над спрайтом дрона (hit-test по реальной, интерполированной
   * позиции на экране) — дрон плавно едет между клетками, поэтому логическая Position
   * не годится: во время движения она отстаёт от того, что видит игрок.
   */
  private isPointerOverDrone(pointer: Phaser.Input.Pointer): boolean {
    const objectsUnderPointer = this._scene.input.hitTestPointer(pointer);
    return objectsUnderPointer.some(
      (obj) => obj.getData?.("isDrone") === true,
    );
  }

  private clearHover(): void {
    this._scene.sys.game.canvas.style.cursor = "default";
    this.clearHoverHighlightOnly();
  }

  /** Убрать подсветку клетки и сброс store, не трогая курсор мыши. */
  private clearHoverHighlightOnly(): void {
    if (this._hoverPrevCell === null) return;
    this._hoverPrevCell = null;
    this._hoverHighlight.setVisible(false);
    useGameStore.getState().setHoveredCell(null);
  }

  private updateHoveredCell(pointer: Phaser.Input.Pointer): void {
    // Над дроном не работает механизм ховера клетки вообще (как будто вне поля):
    // дрон плавно едет между клетками, у него своё кольцо выделения, а заливка
    // клетки под ним визуально путается с выбором дрона.
    if (this.isPointerOverDrone(pointer)) {
      this._scene.sys.game.canvas.style.cursor = "pointer";
      this.clearHoverHighlightOnly();
      return;
    }

    const world = this._scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cellX = Math.floor(world.x / TILE_SIZE);
    const cellY = Math.floor(world.y / TILE_SIZE);

    const tile = this._grid.getTile(cellX, cellY);
    const onField = tile !== "wall";
    if (!onField) {
      this.clearHover();
      return;
    }

    const isBuilding = this.isBuildingTile(tile);
    this._scene.sys.game.canvas.style.cursor = isBuilding
      ? "pointer"
      : "default";

    const prev = this._hoverPrevCell;
    if (prev !== null && prev.x === cellX && prev.y === cellY) return;

    this._hoverPrevCell = { x: cellX, y: cellY };
    this.drawHoverHighlight({ x: cellX, y: cellY, isBuilding });
    useGameStore.getState().setHoveredCell({ x: cellX, y: cellY });
  }

  private drawHoverHighlight(cell: {
    x: number;
    y: number;
    isBuilding: boolean;
  }): void {
    const px = cell.x * TILE_SIZE;
    const py = cell.y * TILE_SIZE;

    this._hoverHighlight.clear();
    if (!cell.isBuilding) {
      this._hoverHighlight.fillStyle(COLORS.DRONE_GLOW, 0.12);
      this._hoverHighlight.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    }
    this._hoverHighlight.lineStyle(2, COLORS.DRONE_GLOW, 0.9);
    // Обводку вжимаем на 1px со всех сторон, чтобы 2px-линия осталась внутри клетки.
    this._hoverHighlight.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    this._hoverHighlight.setVisible(true);
  }

  /** Клетка сетки под указателем, либо null если указатель вне сетки. */
  private pointerToCell(
    pointer: Phaser.Input.Pointer,
  ): { x: number; y: number } | null {
    const world = this._scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cellX = Math.floor(world.x / TILE_SIZE);
    const cellY = Math.floor(world.y / TILE_SIZE);
    if (this._grid.getTile(cellX, cellY) === "wall") return null;
    return { x: cellX, y: cellY };
  }
}
```

⚠️ **Важно про `isPointerOverDrone`:** оригинал сравнивал результат `hitTestPointer` со списком `this._droneSprites` из GameScene. Контроллер не владеет спрайтами дронов, поэтому используем метку данных: в Step 3 при создании спрайта дрона добавляем `sprite.setData("isDrone", true)`, а здесь проверяем `obj.getData?.("isDrone") === true`. Поведенчески эквивалентно (тот же набор объектов — спрайты дронов).

- [ ] **Step 2: Удалить вынесенный код из `src/renderer/scenes/GameScene.ts`**

Удалить:
- Константы `BUILDING_TILES` (стр. 14) и `CLICK_DRAG_THRESHOLD_PX` (стр. 17).
- Импорт `CellType` (стр. 4) — больше не нужен в GameScene.
- Поля `_hoverHighlight`, `_hoverPrevCell`, `_pointerDownAt`, `_droneSelectedThisGesture` (стр. 29–34).
- Методы `drawHoverHighlight`, `isBuildingTile`, `isPointerOverDrone`, `clearHover`, `clearHoverHighlightOnly`, `updateHoveredCell`, `pointerToCell` (стр. 181–280).
- В `create()`: строку `this.input.on("gameout", () => this.clearHover());` (стр. 83) и создание `_hoverHighlight` (стр. 89–90).
- В `setupCamera`: обработчики `pointerdown` (487–489) и `pointerup` (491–509) целиком; в обработчике `pointermove` (471–479) убрать ветку `updateHoveredCell` — оставить только скролл камеры при `pointer.isDown` (см. Step 4).

- [ ] **Step 3: Добавить поле контроллера и метку спрайта в GameScene**

Добавить импорт вверху:

```ts
import { PointerInteractionController } from "./PointerInteractionController.js";
```

Добавить приватное поле рядом с другими (после `_lastSelectedId`):

```ts
private _pointerInteraction!: PointerInteractionController;
```

В `create()`, после `this.setupCamera(worldW, worldH);` и до `onReady?.()`, создать контроллер:

```ts
this._pointerInteraction = new PointerInteractionController({
  scene: this,
  grid: this._grid,
});
```

В `ensureSprite`, в ветке создания спрайта дрона, где сейчас `sprite.on("pointerdown", () => { this._droneSelectedThisGesture = true; onDroneClick(entityId); });` — заменить на метку данных + вызов контроллера. Блок становится:

```ts
if (renderable.spriteType === "drone") {
  if (!this._droneSprites.has(entityId)) {
    const sprite = new DroneSprite(this, cx, cy);
    sprite.setData("isDrone", true);
    const onDroneClick = this.registry.get("onDroneClick") as
      | ((id: EntityId) => void)
      | undefined;
    if (onDroneClick) {
      sprite.setSize(TILE_SIZE, TILE_SIZE);
      sprite.setInteractive();
      sprite.on("pointerdown", () => {
        // Дрон имеет приоритет над выбором клетки: помечаем жест, чтобы
        // pointerup контроллера не перезаписал выбор клеткой под дроном.
        this._pointerInteraction.markDroneSelectedThisGesture();
        onDroneClick(entityId);
      });
    }
    this._droneSprites.set(entityId, sprite);
  }
}
```

⚠️ Порядок создания: `setupCamera` вешает `pointermove`-слушатель камеры; контроллер создаётся после и вешает свои. `ensureSprite` вызывается из `setupEntitySprites` (внутри `create`, до создания контроллера) и из `syncSprites` (каждый кадр). На первом проходе `setupEntitySprites` контроллер ещё не создан, но `markDroneSelectedThisGesture` вызывается только внутри callback `pointerdown` (в рантайме, после инициализации) — на момент навешивания обработчика поле уже будет проинициализировано. Тем не менее для надёжности **создать контроллер до `setupEntitySprites`**: перенести строку `this._pointerInteraction = new PointerInteractionController(...)` так, чтобы она шла **до** `this.setupEntitySprites();` в `create()`.

- [ ] **Step 4: Упростить pointermove в setupCamera**

Обработчик `pointermove` в `setupCamera` теперь отвечает только за скролл камеры при драге. Заменить его на:

```ts
this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
  if (pointer.isDown) {
    cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
    cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
  }
});
```

Ховер при драге скрывает контроллер своим `pointermove` (ветка `pointer.isDown → clearHover`). Оба слушателя `pointermove` вызываются при каждом событии — камера скроллится И ховер скрывается, как в оригинале.

- [ ] **Step 5: Проверить типы**

Run: `npm run type-check`
Expected: без ошибок. Убедиться, что в GameScene не осталось неиспользуемых импортов (`CellType`) и ссылок на удалённые методы/поля.

- [ ] **Step 6: Запустить unit-тесты**

Run: `npm test`
Expected: зелёные (симуляционные тесты не затронуты; рендер Phaser юнит-тестами не покрыт).

- [ ] **Step 7: Commit**

```bash
git add src/renderer/scenes/PointerInteractionController.ts src/renderer/scenes/GameScene.ts
git commit -m "refactor: выделить PointerInteractionController из GameScene"
```

---

### Task 4: Финальная регрессия и обновление документации

**Files:**
- Modify: `docs/features/done/cell-coordinates-hud.md` (обновить ссылки на структуру кода)

**Interfaces:** нет.

- [ ] **Step 1: Запустить e2e-регрессию**

Run: `npm run test:e2e`
Expected: все зелёные. Ключевые сценарии — клик по клетке → INSPECTOR + копирование, дрон↔клетка переключение, hover, drone-controls (`e2e/drone-controls.spec.ts`, `e2e/regression.spec.ts`).

Если тест падает — это регрессия, вносить фикс в соответствующей задаче, не ослаблять ассерты.

- [ ] **Step 2: Обновить технические заметки в карточке фичи**

В `docs/features/done/cell-coordinates-hud.md` секция «Технические заметки» ссылается на `GameScene.updateHoveredCell / clearHover / drawHoverHighlight` и на `src/renderer/scenes/GameScene.ts`. Обновить упоминания: hover/cell-select логика теперь в `src/renderer/scenes/PointerInteractionController.ts` (методы `updateHoveredCell`, `clearHover`, `drawHoverHighlight`, `pointerToCell`, `isPointerOverDrone`). Флаг жеста дрона взводится через `PointerInteractionController.markDroneSelectedThisGesture()`, вызываемый из `GameScene.ensureSprite`. Store-заметки (`snapshotBuildings`) — уточнить, что хелпер теперь в `src/shared/store/snapshots.ts`. INSPECTOR-заметки — уточнить, что компоненты разбиты по файлам в `src/ui/panels/DroneInspector/`.

- [ ] **Step 3: Commit**

```bash
git add "docs/features/done/cell-coordinates-hud.md"
git commit -m "docs: обновить ссылки на структуру кода после рефактора"
```

---

## Self-Review

**Spec coverage:**
- GameScene → PointerInteractionController: Task 3. ✓
- gameStore → types/computeActivePath/snapshots: Task 1. ✓
- DroneInspector → компоненты/хук/стили: Task 2. ✓
- Порядок store → inspector → GameScene: Task 1→2→3. ✓
- e2e-регрессия в конце: Task 4. ✓
- Публичный API стора неизменен: реэкспорт типов в Task 1 Step 4 (уточнение к спеке — вместо правки 4 импортёров). ✓
- Все data-testid сохранены: перенесены дословно в Task 2. ✓

**Placeholder scan:** код приведён полностью в каждом шаге; `-TODO-` в `snapshotDrones` и вложенный тернарник `stateColor` — это существующий код, перенесённый дословно, с явной пометкой «фаза чистки отдельно» (не плейсхолдеры плана). ✓

**Type consistency:**
- `snapshotDrones`/`snapshotBuildings`/`resetDroneProgram`/`filterPrograms`/`REF_ARRAY_BY_TYPE` — сигнатуры совпадают в Task 1 (определение) и потреблении в `gameStore.ts`. ✓
- `computeActivePath(callStack, state)` — совпадает с вызовом в `snapshots.ts`. ✓
- `PointerInteractionController({ scene, grid })` + `markDroneSelectedThisGesture()` — совпадают между Task 3 Step 1 (определение) и Step 3 (вызов). ✓
- `useCopyFeedback`, `CopyableValue`, `Row`, `Bar` — имена и пропсы совпадают между файлами Task 2. ✓

**Отклонение от спеки (зафиксировано):** спека предполагала «реэкспортов не делать, править импортёров». В плане выбран реэкспорт типов из `gameStore.ts` — это лучше соответствует Global Constraint «публичный API стора неизменен» и уменьшает диффы во внешних файлах. `computeActivePath.test.ts` всё равно переводится на прямой путь (он тестирует внутренний хелпер).
