# Step-режим отладки (этап B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Карточка фичи:** [step-mode-debugging](../../features/planned/step-mode-debugging.md) (источник правды описания).
**Спека:** [step-debug stack trace](../specs/2026-06-29-step-debug-stack-trace-design.md) (этап B + решения дизайн-сессии).

**Goal:** Дать игроку Step-режим — пауза симуляции с пошаговым прогоном кода выбранного дрона
(Step action = до следующего действия дрона, Step tick = один игровой тик) и UI-управлением.

**Architecture:** Семантика паузы уже есть (`GameController.pause/step`, `gameStatus === "paused"`).
Этап B добавляет: (1) метод `GameController.stepDroneAction(droneId)` — крутит тики до смены действия
дрона с лимитом; (2) флаг `isStepMode` в `gameStore` + React-контекст с `GameController` для доступа
из `ProgramEditor`; (3) UI — кнопка `⏯ Step Mode` в `SimControls`, точка-индикатор на табе DRONE,
полоса step-кнопок над хлебными крошками в DRONE-табе.

**Tech Stack:** TypeScript, React, Zustand, Vitest (unit), Playwright (e2e). Без Phaser в Simulation Layer.

## Global Constraints

- **Читаемость — приоритет №1** (CLAUDE.md): без вложенных тернарников; именованные промежуточные
  значения; object-параметры при 3+ аргументах / 2 одного типа / boolean-параметре; lookup-map вместо
  длинных if/switch-цепочек; descriptive-имена без аббревиатур.
- **Нейминг — «Step Mode», не «Debug».** В UI никакой debug/breakpoint-лексики. Кнопка `⏯ Step Mode`.
- **Селекторы тестов — только `data-testid`.** Никогда не по тексту/тегу/классу.
- **Simulation Layer (`src/game/simulation/`, `GameController`) не импортирует Phaser/React.**
- **Коммиты:** `<type>: <описание> (этап B)`, императив. Не `git add -A` — только файлы задачи.
- Ветка: `feat/step-debug-stage-b` (создать перед началом, не работать в `main`).

---

### Task 1: `GameController.stepDroneAction` — прогон до следующего действия дрона

**Files:**
- Modify: `src/game/GameController.ts` (добавить метод + приватный хелпер; рядом со `step()` ~стр. 103)
- Test: `src/game/GameController.stepDroneAction.test.ts` (новый — изолирует тяжёлый сетап мира с кодом)

**Контекст для реализатора:**
- `gameStatus` — `"idle" | "running" | "paused" | "won" | "failed"` (`src/game/types.ts`).
- Шаг тика — `useGameStore.getState().tick()`. Существующий `step()` (стр. 103) делает один `tick()` +
  `checkConditions()` и **no-op при `won`/`failed`** — повторяем эту защиту.
- Жизненный цикл действия дрона (code mode): воркер шлёт intent → `program.state` становится
  `move`/`mine`/`drop`/`charge` (≠ `running`) и `program.currentLine` указывает на строку действия →
  системы исполняют действие N тиков → по завершении `state` возвращается в `running` → driver шлёт
  resume → следующий intent. Значит **«следующее действие началось»** = у дрона появился новый intent:
  `state` снова не-`running` ПОСЛЕ того как был `running`, ИЛИ сменилась `currentLine`.
- Компонент: `world.getComponent(droneId, "Program")` → `ProgramComponent` с полями
  `state: ProgramState`, `currentLine?: number | null` (`src/game/simulation/components/Program.ts`).
- Дрон может завершиться (`state === "idle"` + код закончился) — это тоже стоп-условие, иначе зациклимся.

**Interfaces:**
- Produces: `GameController.stepDroneAction(droneId: EntityId): void` — публичный метод. Крутит тики до
  смены действия выбранного дрона либо до лимита `MAX_STEP_TICKS`; затем `checkConditions()`.
  Приватный хелпер `private actionMarker(droneId): { state: ProgramState; line: number | null }`.

- [ ] **Step 1: Написать падающий тест**

В новом файле `src/game/GameController.stepDroneAction.test.ts`. Тест строит мир с одним дроном,
у которого code-программа делает два действия подряд, и проверяет, что `stepDroneAction` продвигает
позицию ровно до следующего действия и уважает лимит. Используем реальный путь через store
(как `init`/`tick`), мокая GameRenderer.

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../renderer/GameRenderer.js", () => ({ GameRenderer: class {} }));

import { useGameStore } from "../shared/store/gameStore.js";
import type { EntityId } from "../shared/types/index.js";
import { World } from "./simulation/world/World.js";
import type { ProgramComponent } from "./simulation/components/Program.js";

// Хелпер: ставит дрону Program с заданными state/currentLine, имитируя позицию.
function setAction(
  world: World,
  droneId: EntityId,
  state: ProgramComponent["state"],
  line: number | null,
) {
  const program = world.getComponent(droneId, "Program")!;
  program.state = state;
  program.currentLine = line;
}

describe("GameController.stepDroneAction", () => {
  // Чистый стор перед каждым тестом — изоляция.
  beforeEach(() => {
    useGameStore.setState({ gameStatus: "paused", isRunning: false } as never);
  });

  it("no-op при won/failed", () => {
    // Сетап мира + контроллера через test-фабрику (см. Step 3 — makeStepController).
    const { controller, world, droneId } = makeStepController();
    useGameStore.getState().setGameStatus("won");
    setAction(world, droneId, "move", 3);
    controller.stepDroneAction(droneId);
    // currentLine не двигался — тиков не было
    expect(world.getComponent(droneId, "Program")!.currentLine).toBe(3);
  });

  it("крутит тики, пока действие (state/line) не сменится", () => {
    const { controller, world, droneId, advanceToNextAction } =
      makeStepController();
    setAction(world, droneId, "move", 3);
    // Тестовый tick: после 2 тиков «действие сменилось» (см. фабрику).
    advanceToNextAction({ afterTicks: 2, toState: "running", toLine: 4 });
    controller.stepDroneAction(droneId);
    const program = world.getComponent(droneId, "Program")!;
    expect(program.currentLine).toBe(4);
  });

  it("останавливается на MAX_STEP_TICKS, если действие не меняется", () => {
    const { controller, world, droneId, tickSpy } = makeStepController();
    setAction(world, droneId, "move", 3);
    // действие никогда не меняется → должны упереться в лимит
    controller.stepDroneAction(droneId);
    expect(tickSpy.mock.calls.length).toBeLessThanOrEqual(600);
    expect(tickSpy.mock.calls.length).toBeGreaterThan(0);
  });
});
```

> Реализатору: если построить реальный code-мир в тесте окажется слишком тяжело, замените стор-`tick`
> на инъектируемую тестовую функцию через `makeStepController` (Step 3). Главное — проверить три
> поведения: no-op на финале, стоп при смене действия, стоп по лимиту.

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npm test -- GameController.stepDroneAction`
Expected: FAIL — `stepDroneAction is not a function` / `makeStepController is not defined`.

- [ ] **Step 3: Реализовать `stepDroneAction` + тестовую фабрику**

В `src/game/GameController.ts`, рядом со `step()`:

```ts
/** Защитный лимит: сколько тиков максимум проматывает один Step action. */
const MAX_STEP_TICKS = 600;
```

```ts
/**
 * Прогоняет тики до тех пор, пока выбранный дрон не начнёт следующее действие
 * (сменится program.state/currentLine), либо до MAX_STEP_TICKS. No-op на won/failed.
 */
stepDroneAction(droneId: EntityId): void {
  const { gameStatus } = useGameStore.getState();
  if (gameStatus === "won" || gameStatus === "failed") return;

  const startMarker = this.actionMarker(droneId);
  for (let ticks = 0; ticks < MAX_STEP_TICKS; ticks++) {
    useGameStore.getState().tick();
    if (this.markerChanged(startMarker, this.actionMarker(droneId))) break;
  }
  this.checkConditions();
}

/** Снимок «текущего действия» дрона: его state и подсвеченная строка. */
private actionMarker(droneId: EntityId): {
  state: ProgramState | null;
  line: number | null;
} {
  const program = this.world?.getComponent(droneId, "Program");
  if (!program) return { state: null, line: null };
  return { state: program.state, line: program.currentLine ?? null };
}

private markerChanged(
  before: { state: ProgramState | null; line: number | null },
  after: { state: ProgramState | null; line: number | null },
): boolean {
  return before.state !== after.state || before.line !== after.line;
}
```

Добавить импорт типа в шапку `GameController.ts`:
```ts
import type { ProgramState } from "./simulation/components/Program.js";
```

Тестовая фабрика — внизу тест-файла. Инъектируем `tick` через override стора, чтобы не поднимать
полный code-воркер в unit-тесте:

```ts
import { GameController } from "./GameController.js";

function makeStepController() {
  const world = new World();
  const droneId = world.createEntity();
  world.addComponent(droneId, "Program", {
    currentProgramId: null,
    callStack: [],
    state: "running",
    commandSlots: 1,
    personalProgramId: String(droneId),
  });

  const tickSpy = vi.fn();
  // Подменяем стор-tick тестовой реализацией; stepDroneAction зовёт getState().tick().
  useGameStore.setState({ tick: tickSpy } as never);

  // Контроллер с доступом к world (минуем тяжёлый setup — присваиваем приватное поле
  // через as-cast, допустимо в unit-тесте инфраструктуры).
  const controller = new GameController({
    config: { win: { type: "ore_mined", target: 1 } },
    buildScene: () => {
      throw new Error("not used in unit test");
    },
  } as never);
  (controller as unknown as { world: World }).world = world;

  function advanceToNextAction(opts: {
    afterTicks: number;
    toState: ProgramComponent["state"];
    toLine: number;
  }) {
    let count = 0;
    tickSpy.mockImplementation(() => {
      count++;
      if (count >= opts.afterTicks) {
        setAction(world, droneId, opts.toState, opts.toLine);
      }
    });
  }

  return { controller, world, droneId, tickSpy, advanceToNextAction };
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npm test -- GameController.stepDroneAction`
Expected: PASS (3 теста).

Затем `npm run type-check` — без ошибок.

- [ ] **Step 5: Коммит**

```bash
git add src/game/GameController.ts src/game/GameController.stepDroneAction.test.ts
git commit -m "feat: GameController.stepDroneAction — прогон до следующего действия дрона (этап B)"
```

---

### Task 2: Флаг `isStepMode` в gameStore + React-контекст контроллера

**Files:**
- Modify: `src/shared/store/gameStore.ts` (поле `isStepMode` + action `setStepMode`)
- Create: `src/ui/controls/GameControllerContext.ts` (React-контекст для доступа к `GameController`)
- Modify: `src/App.tsx` (провайдер контекста + обёртка toggle Step Mode)
- Test: `src/shared/store/gameStore.stepMode.test.ts` (новый)

**Контекст для реализатора:**
- `gameStore` — Zustand (`create<GameStore>((set, get) => ({...}))`). Поля-флаги: `isRunning`,
  `gameStatus`, и т.п.; actions — методы вроде `setRunning(v)`. Интерфейс `GameStore` (~стр. 88).
- `App.tsx` держит `controllerRef = useRef<GameController | null>(null)`; рендерит `<SimControls>` и
  (через `<BottomPanel>`) `<ProgramEditor>`. Контекст оборачиваем вокруг обоих в game-фазе.
- Контекст нужен, чтобы `ProgramEditor` (глубоко в дереве) вызывал `controller.step()` /
  `controller.stepDroneAction()` без проброса пропсов через всю иерархию.

**Interfaces:**
- Produces в `GameStore`: `isStepMode: boolean`; `setStepMode(v: boolean): void`.
- Produces: `GameControllerContext` (React.Context<GameController | null>) + хук
  `useGameController(): GameController | null` в `src/ui/controls/GameControllerContext.ts`.

- [ ] **Step 1: Написать падающий тест на store-флаг**

`src/shared/store/gameStore.stepMode.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "./gameStore.js";

describe("gameStore — isStepMode", () => {
  beforeEach(() => {
    useGameStore.getState().setStepMode(false);
  });

  it("по умолчанию выключен", () => {
    expect(useGameStore.getState().isStepMode).toBe(false);
  });

  it("setStepMode переключает флаг", () => {
    useGameStore.getState().setStepMode(true);
    expect(useGameStore.getState().isStepMode).toBe(true);
    useGameStore.getState().setStepMode(false);
    expect(useGameStore.getState().isStepMode).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npm test -- gameStore.stepMode`
Expected: FAIL — `setStepMode is not a function` / `isStepMode` undefined.

- [ ] **Step 3: Реализовать флаг в store**

В интерфейсе `GameStore` (рядом с `isRunning: boolean;`):
```ts
  isStepMode: boolean;
```
И в списке методов (рядом с `setRunning`):
```ts
  setStepMode(v: boolean): void;
```
В реализации стора — начальное значение рядом с `isRunning: false,`:
```ts
  isStepMode: false,
```
И action рядом с `setRunning`:
```ts
  setStepMode(v) {
    set({ isStepMode: v });
  },
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npm test -- gameStore.stepMode`
Expected: PASS.

- [ ] **Step 5: Создать React-контекст контроллера**

`src/ui/controls/GameControllerContext.ts`:
```ts
import { createContext, useContext } from "react";
import type { GameController } from "../../game/GameController.js";

/** Доступ к активному GameController из любой UI-точки игровой фазы. */
export const GameControllerContext = createContext<GameController | null>(null);

export function useGameController(): GameController | null {
  return useContext(GameControllerContext);
}
```

- [ ] **Step 6: Подключить провайдер в App.tsx + toggle Step Mode**

В `App.tsx` импортировать контекст:
```tsx
import { GameControllerContext } from "./ui/controls/GameControllerContext.js";
```

Добавить обработчик toggle (рядом с `openSettings`). Step Mode включается → пауза;
выключается → возобновление:
```tsx
const setStepMode = useGameStore((s) => s.setStepMode);
const isStepMode = useGameStore((s) => s.isStepMode);

const toggleStepMode = () => {
  const next = !isStepMode;
  setStepMode(next);
  if (next) {
    controllerRef.current?.pause();
  } else {
    controllerRef.current?.start();
  }
};
```

Обернуть game-фазовое поддерево провайдером. Самый простой способ — обернуть весь корневой `<div>`
возвращаемого JSX в `<GameControllerContext.Provider value={controllerRef.current}>`. Значение —
`controllerRef.current` (стабильно в пределах фазы; контекст-консьюмеры читают его при рендере, а
рендер game-фазы происходит после установки ref).

Передать в `SimControls` новый проп (см. Task 3): `onToggleStepMode={toggleStepMode}`.

- [ ] **Step 7: type-check + коммит**

Run: `npm run type-check` → без ошибок. `npm test -- gameStore.stepMode` → PASS.

```bash
git add src/shared/store/gameStore.ts src/ui/controls/GameControllerContext.ts src/App.tsx src/shared/store/gameStore.stepMode.test.ts
git commit -m "feat: флаг isStepMode + контекст GameController (этап B)"
```

---

### Task 3: Кнопка `⏯ Step Mode` в SimControls

**Files:**
- Modify: `src/ui/controls/SimControls.tsx`
- Modify: `src/App.tsx` (передать `onToggleStepMode` — выполнено в Task 2 Step 6; здесь только проверка)
- Test: `e2e/step-mode.spec.ts` (новый — создаётся в Task 5; здесь UI без unit-теста, верстка)

**Контекст для реализатора:**
- `SimControls` сейчас принимает `{ onPlay, onPause, onOpenSettings }`, читает `isRunning`,
  `gameStatus` из стора. Есть стили `BTN`, `BTN_ACTIVE`, `BTN_DISABLED`.
- **Существующий вложенный тернарник** в `style` Play-кнопки (стр. 56:
  `isFinished ? BTN_DISABLED : isRunning ? BTN_ACTIVE : BTN`) — **исправить на именованную переменную**
  (Global Constraint: без вложенных тернарников).
- Цвет step-режима (оранжевый) — согласован дизайн-сессией.

**Interfaces:**
- Consumes: `useGameStore().isStepMode`, `setStepMode` (Task 2); проп `onToggleStepMode: () => void`.
- Produces: кнопка `data-testid="step-mode-toggle"`.

- [ ] **Step 1: Расширить пропсы и стили**

В `SimControls.tsx` добавить проп:
```tsx
interface SimControlsProps {
  onPlay: () => void;
  onPause: () => void;
  onToggleStepMode: () => void;
  onOpenSettings: () => void;
}
```

Добавить стиль активной step-кнопки (оранжевый), рядом с `BTN_ACTIVE`:
```tsx
const BTN_STEP: React.CSSProperties = {
  ...BTN,
  color: "#ff7a1a",
  border: "1px solid #5a3a1f",
};

const BTN_STEP_ACTIVE: React.CSSProperties = {
  ...BTN,
  background: "#ff7a1a",
  color: "#1a0d00",
  border: "1px solid #ff7a1a",
  fontWeight: "bold",
};
```

- [ ] **Step 2: Убрать вложенный тернарник у Play + добавить кнопку Step Mode**

В теле компонента, до `return`, вычислить стиль Play именованной переменной (lookup вместо вложенного
тернарника):
```tsx
const isStepMode = useGameStore((s) => s.isStepMode);

function playButtonStyle(): React.CSSProperties {
  if (isFinished) return BTN_DISABLED;
  if (isRunning) return BTN_ACTIVE;
  return BTN;
}
const stepButtonStyle = isStepMode ? BTN_STEP_ACTIVE : BTN_STEP;
```

Заменить инлайновый `style={isFinished ? BTN_DISABLED : isRunning ? BTN_ACTIVE : BTN}` на
`style={playButtonStyle()}`.

В левую группу кнопок (обернуть Play и Step Mode в `<div style={{ display: "flex", gap: "8px" }}>`)
добавить рядом с Play:
```tsx
<button
  style={stepButtonStyle}
  onClick={onToggleStepMode}
  data-testid="step-mode-toggle"
  title="Пошаговый просмотр работы дрона"
>
  ⏯ Step Mode
</button>
```

Структура: левый `<div>` с Play + Step Mode, правый — gear-кнопка (сохранить `justify-content:
space-between` контейнера).

- [ ] **Step 3: Проверить сборку и ручной прогон**

Run: `npm run type-check` → без ошибок.
Run: `npm run dev` → запустить миссию → видны Play и `⏯ Step Mode`; клик по Step Mode → кнопка
оранжевая, игра встаёт на паузу (Play-кнопка показывает «▶ Play»); повторный клик → возобновление.

- [ ] **Step 4: Коммит**

```bash
git add src/ui/controls/SimControls.tsx
git commit -m "feat: кнопка Step Mode в SimControls + чистка тернарника Play (этап B)"
```

---

### Task 4: Step-панель и точка-индикатор в DRONE-табе

**Files:**
- Create: `src/ui/editor/StepControls/index.tsx` (полоса Step action / Step tick / Continue)
- Modify: `src/ui/editor/ProgramEditor/index.tsx` (точка-индикатор на табе DRONE + рендер StepControls)
- Test: покрывается e2e (Task 5)

**Контекст для реализатора:**
- `ProgramEditor` — таб-бар (`TAB_BTN(active)` стиль) с табами DRONE/LIBRARY/PROGRAM, `tab` в локальном
  `useState`. Выбранный дрон — `selectedId = useGameStore(s => s.selectedDroneId)`, объект
  `drone = drones.find(d => d.id === selectedId)`.
- Хлебные крошки рендерятся в `tab === "drone"` блоке: `<CallStackBreadcrumbs ... />` (~стр. 332).
  Step-панель ставим **над** крошками (вариант 1 дизайн-сессии).
- Контроллер — через `useGameController()` (Task 2). Step action: `controller.stepDroneAction(drone.id)`;
  Step tick: `controller.step()`; Continue: выключить step-режим = `setStepMode(false)` + `controller.start()`.
- Точка-индикатор на табе DRONE видна, когда `isStepMode === true`.

**Interfaces:**
- Consumes: `useGameStore().isStepMode`, `setStepMode`; `useGameController()`; `selectedDroneId`.
- Produces: компонент `<StepControls droneId={EntityId} />`. testid'ы: `step-controls`,
  `step-action-btn`, `step-tick-btn`, `step-continue-btn`, и на табе — `drone-tab-step-indicator`.

- [ ] **Step 1: Создать компонент StepControls**

`src/ui/editor/StepControls/index.tsx`:
```tsx
import React from "react";
import { useGameStore } from "../../../shared/store/gameStore.js";
import { useGameController } from "../../controls/GameControllerContext.js";
import type { EntityId } from "../../../shared/types/index.js";

const PANEL: React.CSSProperties = {
  display: "flex",
  gap: "6px",
  alignItems: "center",
  background: "#1a0d05",
  border: "1px solid #5a3a1f",
  borderRadius: "4px",
  padding: "6px 8px",
  marginBottom: "8px",
};

const LABEL: React.CSSProperties = {
  color: "#ff7a1a",
  fontFamily: "monospace",
  fontSize: "10px",
  letterSpacing: "1px",
  marginRight: "4px",
};

const STEP_BTN: React.CSSProperties = {
  background: "#0a1628",
  border: "1px solid #5a3a1f",
  color: "#ff7a1a",
  fontFamily: "monospace",
  fontSize: "11px",
  padding: "4px 10px",
  cursor: "pointer",
  borderRadius: "3px",
};

const STEP_BTN_PRIMARY: React.CSSProperties = {
  ...STEP_BTN,
  background: "#ff7a1a",
  color: "#1a0d00",
  border: "1px solid #ff7a1a",
  fontWeight: "bold",
};

interface StepControlsProps {
  droneId: EntityId;
}

/** Полоса управления Step-режимом над хлебными крошками DRONE-таба. */
export function StepControls({ droneId }: StepControlsProps) {
  const controller = useGameController();
  const setStepMode = useGameStore((s) => s.setStepMode);

  const stepAction = () => controller?.stepDroneAction(droneId);
  const stepTick = () => controller?.step();
  const continueRun = () => {
    setStepMode(false);
    controller?.start();
  };

  return (
    <div style={PANEL} data-testid="step-controls">
      <span style={LABEL}>STEP</span>
      <button style={STEP_BTN_PRIMARY} onClick={stepAction} data-testid="step-action-btn">
        ⤵ Step action
      </button>
      <button style={STEP_BTN} onClick={stepTick} data-testid="step-tick-btn">
        → Step tick
      </button>
      <button style={STEP_BTN} onClick={continueRun} data-testid="step-continue-btn">
        ▶ Continue
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Точка-индикатор на табе DRONE**

В `ProgramEditor/index.tsx` импортировать компонент и прочитать флаг:
```tsx
import { StepControls } from "../StepControls/index.js";
```
В теле компонента (рядом с другими `useGameStore`):
```tsx
const isStepMode = useGameStore((s) => s.isStepMode);
```

DRONE-таб-кнопка сейчас:
```tsx
<button style={TAB_BTN(tab === "drone")} onClick={() => setTab("drone")}>
  DRONE
</button>
```
Заменить на версию с точкой-индикатором (без вложенных тернарников — точка через флаг):
```tsx
<button
  style={{ ...TAB_BTN(tab === "drone"), position: "relative" }}
  onClick={() => setTab("drone")}
>
  DRONE
  {isStepMode && (
    <span
      data-testid="drone-tab-step-indicator"
      style={{
        position: "absolute",
        top: "3px",
        right: "4px",
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        background: "#ff4d2e",
      }}
    />
  )}
</button>
```

- [ ] **Step 3: Рендер StepControls над крошками**

В блоке `tab === "drone"` && `drone`, перед блоком хлебных крошек (`{codeStack.length > 0 && ...}`),
добавить полосу Step — только в step-режиме:
```tsx
{isStepMode && <StepControls droneId={drone.id} />}
```

- [ ] **Step 4: type-check + ручной прогон**

Run: `npm run type-check` → без ошибок.
Run: `npm run dev` → миссия → выбрать дрона → Play → Step Mode (верхняя панель) →
на табе DRONE появилась оранжевая точка, над крошками — полоса STEP с тремя кнопками.
Step action двигает позицию до следующего действия; Step tick — на один тик; Continue выключает режим
(точка и полоса исчезают, игра идёт).

- [ ] **Step 5: Коммит**

```bash
git add src/ui/editor/StepControls/index.tsx src/ui/editor/ProgramEditor/index.tsx
git commit -m "feat: Step-панель и индикатор step-режима в DRONE-табе (этап B)"
```

---

### Task 5: E2E — Step-режим

**Files:**
- Create: `e2e/step-mode.spec.ts`

**Контекст для реализатора:**
- Хелперы `skipIntro`, `startMission`, `waitForCanvas` — см. `e2e/regression.spec.ts` (копировать
  локально или вынести; для самодостаточности теста допустимо локально продублировать).
- Тесты параллельны и изолированы — свой контекст у каждого, без общего состояния.
- Селекторы — только `data-testid`: `step-mode-toggle`, `step-controls`, `step-action-btn`,
  `step-tick-btn`, `step-continue-btn`, `drone-tab-step-indicator`.
- Выбор дрона — клик по дрону на canvas невозможен стабильно; используем существующий способ выбора
  дрона из UI. Проверить в `e2e/regression.spec.ts` / `DroneList.tsx`, есть ли `data-testid` у элемента
  списка дронов; если нет — **добавить `data-testid={\`drone-list-item-${id}\`}`** в `DroneList.tsx`
  (мелкая правка, заодно покрывает выбор дрона тестом). Этот шаг включён ниже.

- [ ] **Step 1: Убедиться, что у элемента списка дронов есть data-testid**

Прочитать `src/ui/panels/DroneList.tsx`. Если у кликабельного элемента дрона нет `data-testid` —
добавить `data-testid={\`drone-list-item-${drone.id}\`}` на кликабельный элемент. Если уже есть —
использовать существующий и пропустить правку.

- [ ] **Step 2: Написать e2e Step-режима**

`e2e/step-mode.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

async function skipIntro(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Press Start" }).click();
}
async function startMission(page: import("@playwright/test").Page, index: number) {
  await page.locator(`[data-testid="mission-card-${index}"]`).click();
  await page.getByRole("button", { name: "ЗАПУСТИТЬ" }).click();
}
async function waitForCanvas(page: import("@playwright/test").Page) {
  await page.locator("canvas").waitFor({ state: "visible", timeout: 30_000 });
}

test("Step Mode: включение ставит паузу и показывает step-панель в DRONE-табе", async ({ page }) => {
  await page.goto("");
  await skipIntro(page);
  await startMission(page, 0);
  await waitForCanvas(page);

  // Запустить симуляцию
  await page.getByRole("button", { name: /Play/i }).click();

  // Выбрать первого дрона из списка (testid из Step 1)
  await page.locator('[data-testid^="drone-list-item-"]').first().click();

  // Включить Step Mode
  await page.locator('[data-testid="step-mode-toggle"]').click();

  // Игра на паузе → кнопка снова «Play»
  await expect(page.getByRole("button", { name: /Play/i })).toBeVisible();

  // На табе DRONE — индикатор step-режима, и видна step-панель
  await expect(page.locator('[data-testid="drone-tab-step-indicator"]')).toBeVisible();
  await expect(page.locator('[data-testid="step-controls"]')).toBeVisible();
  await expect(page.locator('[data-testid="step-action-btn"]')).toBeVisible();
  await expect(page.locator('[data-testid="step-tick-btn"]')).toBeVisible();
});

test("Step Mode: Continue выключает режим и убирает step-панель", async ({ page }) => {
  await page.goto("");
  await skipIntro(page);
  await startMission(page, 0);
  await waitForCanvas(page);

  await page.getByRole("button", { name: /Play/i }).click();
  await page.locator('[data-testid^="drone-list-item-"]').first().click();
  await page.locator('[data-testid="step-mode-toggle"]').click();
  await expect(page.locator('[data-testid="step-controls"]')).toBeVisible();

  // Continue → step-режим выключен
  await page.locator('[data-testid="step-continue-btn"]').click();
  await expect(page.locator('[data-testid="step-controls"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="drone-tab-step-indicator"]')).toHaveCount(0);
});

test("Step Mode: Step tick продвигает симуляцию на один тик", async ({ page }) => {
  await page.goto("");
  await skipIntro(page);
  await startMission(page, 0);
  await waitForCanvas(page);

  await page.getByRole("button", { name: /Play/i }).click();
  await page.locator('[data-testid^="drone-list-item-"]').first().click();
  await page.locator('[data-testid="step-mode-toggle"]').click();

  // Step tick кликается без ошибок; симуляция остаётся на паузе (Play видна)
  await page.locator('[data-testid="step-tick-btn"]').click();
  await expect(page.getByRole("button", { name: /Play/i })).toBeVisible();
});
```

- [ ] **Step 3: Запустить e2e**

Run: `npm run test:e2e -- step-mode`
Expected: PASS (3 теста). Если выбор дрона нестабилен — проверить testid из Step 1.

- [ ] **Step 4: Коммит**

```bash
git add e2e/step-mode.spec.ts src/ui/panels/DroneList.tsx
git commit -m "test: e2e Step-режима (этап B)"
```

---

### Task 6: Документация — карточка фичи и сессия

**Files:**
- Move + Modify: `docs/features/planned/step-mode-debugging.md` → `docs/features/done/step-mode-debugging.md`
  (статус `planned` → `done`)
- Modify: `docs/features/index.md` (перенести строку из таблицы planned в done)
- Create: `docs/sessions/2026-06-29-<time>-step-debug-stage-b.md` (только если есть нетривиальный
  нарратив — см. CLAUDE.md: сессия «реализовал по плану, всё зелёное» не пишется)

**Контекст для реализатора:**
- Карточка фичи **уже создана** в `docs/features/planned/step-mode-debugging.md` (источник правды
  описания, ссылается на спеку+план). Этап A — отдельная карточка `done/multimodule-debugging.md`.
- Спека уже обновлена решениями дизайн-сессии (источник правды по UI-решениям).

- [ ] **Step 1: Перевести карточку фичи в done**

Переместить `docs/features/planned/step-mode-debugging.md` → `docs/features/done/step-mode-debugging.md`,
поменять `**Статус:** planned` → `**Статус:** done` внутри файла, перенести строку из таблицы `planned`
в `done` в `docs/features/index.md`. Сверить, что описание в карточке соответствует реализованному
поведению (актуализировать при расхождениях). Не дублировать содержание спеки/плана.

- [ ] **Step 2: Решить про сессию**

Если в ходе реализации возникли отброшенные подходы / неочевидный root-cause (напр. тонкости семантики
«действие сменилось», лимит тиков) — написать короткую сессию в `docs/sessions/`. Иначе — не писать.

- [ ] **Step 3: Финальная верификация (end-to-end из спеки)**

Run: `npm run type-check` → зелёный.
Run: `npm test` → зелёный (новые unit: stepDroneAction, gameStore.stepMode).
Run: `npm run test:e2e` → зелёный (новый step-mode + регрессия).
Ручная проверка `npm run dev`: миссия с импортом модуля → выбрать дрона → Step Mode → пауза, точка на
табе DRONE, полоса STEP → Step action двигает позицию на следующее действие, крошки/подсветка
обновляются → Continue возобновляет.

- [ ] **Step 4: Коммит документации**

```bash
git add docs/features/ docs/sessions/
git commit -m "docs: Step-режим (этап B) — карточка фичи в done (этап B)"
```

> Спека (`docs/superpowers/specs/...-step-debug-stack-trace-design.md`), карточка
> `planned/step-mode-debugging.md`, строка в `index.md` и план уже закоммичены в подготовительной
> сессии (2026-06-29) — здесь коммитим только перевод карточки в `done` и опциональную сессию.

---

## Self-Review (выполнено автором плана)

**Spec coverage:**
- Семантика шага (Step action + Step tick) → Task 1 (`stepDroneAction`) + Task 4 (кнопки).
- UI debug-controls (решения дизайн-сессии: Step Mode кнопка, точка на табе, полоса STEP) →
  Task 3 + Task 4.
- Видимость только в step-режиме → Task 4 Step 3 (`{isStepMode && ...}`).
- `GameController.stepDroneAction` с `MAX_STEP_TICKS`, no-op на won/failed → Task 1.
- Переиспользование `pause()`/`step()`/`start()` → Task 2 (toggle) + Task 4 (Continue/tick).
- Тесты этапа B (unit GameController, e2e Step action/Continue) → Task 1, Task 5.

**Placeholder scan:** код приведён во всех code-шагах; тест-фабрика расписана; нет «add error handling».

**Type consistency:** `stepDroneAction(droneId)`, `step()`, `start()`, `pause()`, `setStepMode(v)`,
`isStepMode`, `useGameController()`, testid'ы — имена согласованы между задачами.

**Открытый момент для реализатора:** провайдер контекста в App.tsx передаёт `controllerRef.current`;
убедиться, что game-фазовый рендер происходит после установки ref (он устанавливается в loading-эффекте
до перехода в фазу game через onReady — порядок корректен).
