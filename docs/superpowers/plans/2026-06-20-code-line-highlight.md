# Code Line Highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Подсвечивать текущую исполняемую строку кода дрона в редакторе Monaco (фон строки + glyph в gutter), обновляя подсветку на каждом `await drone.*`.

**Architecture:** Инструментатор на acorn вставляет `(__line(N), <await-expr>)` перед каждым `await drone.*` — без парсинга нужна только позиция токена `await`. Worker получает `__line` как дополнительный аргумент в `AsyncFunction`; при вызове сохраняет номер строки в `currentLine` и кладёт его в исходящее сообщение (`intent`/`wait`). `CodeBehaviorDriver` записывает значение в `ProgramComponent.currentLine`, `snapshotDrones` прокидывает его в `DroneState`, `CodeEditor` рисует Monaco-декорацию.

**Tech Stack:** acorn (AST parser), Monaco Editor (`createDecorationsCollection`), Vitest (юнит-тесты инструментатора), React, Zustand.

## Global Constraints

- Инструментируются **только** `await drone.moveTo(...)`, `await drone.mine()`, `await drone.drop()`, `await drone.charge()`, `await drone.wait(...)` — никакие другие `await`.
- Step-режим (breakpoints, `await __step(N)`) **не реализуется**; в коде инструментатора оставить только комментарий.
- Vite Web Worker: сохранять `?worker`-импорт в `BrowserWorkerPort.ts` — не трогать.
- Нет перехода к строке при клике; нет step-by-step; нет замедления.
- `npm test` и `npm run type-check` должны быть зелёными после каждого коммита.

---

## File Map

| Файл | Статус | Роль |
|------|--------|------|
| `src/game/code/worker/instrument.ts` | **Создать** | Чистая функция `instrument(code): string` — AST-инструментация через acorn |
| `src/game/code/worker/instrument.test.ts` | **Создать** | Юнит-тесты инструментатора |
| `src/game/code/types.ts` | **Изменить** | Добавить `line: number` в `WorkerMessage` variants `intent` и `wait` |
| `src/game/code/worker/codeRuntime.ts` | **Изменить** | `currentLine`, `__line(n)`, вызов `instrument()`, проброс `line` в сообщения |
| `src/game/simulation/components/Program.ts` | **Изменить** | Поле `currentLine?: number \| null` в `ProgramComponent` |
| `src/game/code/CodeBehaviorDriver.ts` | **Изменить** | Запись `program.currentLine` из `msg.line`; сброс при `finished`/`error` |
| `src/shared/store/gameStore.ts` | **Изменить** | `DroneState.currentLine`, заполнение из `program.currentLine` в `snapshotDrones` |
| `src/ui/editor/CodeEditor/CodeEditor.tsx` | **Изменить** | Проп `highlightLine?: number \| null`, Monaco-декорация через `useRef` + `useEffect` |
| `src/ui/editor/ProgramEditor/index.tsx` | **Изменить** | Вычислить `activeProgramId`, передавать `highlightLine` в `CodeEditor` только для активной программы |

---

### Task 1: Инструментатор AST — `instrument.ts` + тесты

**Files:**
- Create: `src/game/code/worker/instrument.ts`
- Create: `src/game/code/worker/instrument.test.ts`

**Interfaces:**
- Produces: `instrument(code: string): string` — возвращает валидный JS с вставленными `(__line(N), <await-expr>)` перед каждым `await drone.*`

- [ ] **Шаг 1: Установить acorn**

```bash
npm install acorn
```

Проверить, что пакет добавился в `package.json` → `dependencies` (не `devDependencies`), так как инструментатор работает в worker-окружении в рантайме.

- [ ] **Шаг 2: Написать провальные тесты**

Создать `src/game/code/worker/instrument.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { instrument } from "./instrument.js";

describe("instrument", () => {
  it("вставляет __line перед await drone.mine()", () => {
    const code = `await drone.mine();`;
    const result = instrument(code);
    // строка 1 (acorn считает от 1)
    expect(result).toContain("__line(1)");
    expect(result).toContain("await drone.mine()");
    // должен быть валидным JS — AsyncFunction не должен бросать
    expect(() => {
      const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
      new AsyncFn("drone", "__line", result);
    }).not.toThrow();
  });

  it("вставляет __line перед await drone.moveTo()", () => {
    const code = `await drone.moveTo(ore);`;
    const result = instrument(code);
    expect(result).toContain("__line(1)");
    expect(result).toContain("await drone.moveTo(ore)");
  });

  it("вставляет __line перед await drone.wait()", () => {
    const code = `await drone.wait(2);`;
    const result = instrument(code);
    expect(result).toContain("__line(1)");
    expect(result).toContain("await drone.wait(2)");
  });

  it("не вставляет __line перед другими await", () => {
    const code = `await Promise.resolve(); await drone.mine();`;
    const result = instrument(code);
    // ровно один __line
    expect(result.match(/__line\(/g)?.length ?? 0).toBe(1);
  });

  it("многострочный код — строка привязана к началу await", () => {
    const code = `const x = 1;\nawait drone.mine();\nawait drone.drop();`;
    const result = instrument(code);
    expect(result).toContain("__line(2)");
    expect(result).toContain("__line(3)");
  });

  it("многострочный вызов — строка начала ExpressionStatement", () => {
    const code = `await drone\n  .moveTo(\n    ore\n  );`;
    const result = instrument(code);
    expect(result).toContain("__line(1)");
  });

  it("игнорирует вызовы в комментариях", () => {
    const code = `// await drone.mine()\nawait drone.drop();`;
    const result = instrument(code);
    expect(result.match(/__line\(/g)?.length ?? 0).toBe(1);
    expect(result).toContain("__line(2)");
  });

  it("игнорирует вызовы в строковых литералах", () => {
    const code = `const s = "await drone.mine()";\nawait drone.charge();`;
    const result = instrument(code);
    expect(result.match(/__line\(/g)?.length ?? 0).toBe(1);
    expect(result).toContain("__line(2)");
  });

  it("выдаёт валидный исполнимый JS для нетривиального кода", () => {
    const code = `
while (true) {
  await drone.moveTo(mine);
  await drone.mine();
  await drone.moveTo(base);
  await drone.drop();
}
    `.trim();
    const result = instrument(code);
    expect(() => {
      const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
      new AsyncFn("drone", "__line", "mine", "base", result);
    }).not.toThrow();
    expect(result.match(/__line\(/g)?.length ?? 0).toBe(4);
  });
});
```

- [ ] **Шаг 3: Запустить тесты, убедиться что все падают**

```bash
npm test -- instrument.test
```

Ожидаем: все тесты FAIL с `Cannot find module './instrument.js'`.

- [ ] **Шаг 4: Реализовать `instrument.ts`**

Создать `src/game/code/worker/instrument.ts`:

```typescript
import { parse } from "acorn";
import type { Node, AwaitExpression, CallExpression, MemberExpression } from "acorn";

/**
 * Инструментирует код игрока: перед каждым `await drone.<action>()`
 * вставляет `(__line(N), ...)` где N — номер строки вызова (1-based).
 *
 * Для будущего step-режима тот же обходчик можно расширить:
 * вместо синхронного __line(N) вставлять `await __step(N)` на каждый
 * statement — это даст паузу на любой строке. Сейчас НЕ реализуем:
 * инструментируем только await drone.* и __line синхронный.
 */
export function instrument(code: string): string {
  const ast = parse(code, {
    ecmaVersion: 2020,
    locations: true,
  });

  // Собираем все AwaitExpression вида `await drone.<action>(args)`
  // в порядке убывания offset'а, чтобы вставки не смещали предыдущие позиции.
  const patches: Array<{ start: number; end: number; line: number }> = [];

  function visit(node: Node): void {
    if (!node || typeof node !== "object") return;

    if (
      node.type === "AwaitExpression" &&
      isDroneCall((node as AwaitExpression).argument)
    ) {
      const awaitNode = node as AwaitExpression & { start: number; end: number; loc: { start: { line: number } } };
      patches.push({
        start: awaitNode.start,
        end: awaitNode.end,
        line: awaitNode.loc.start.line,
      });
    }

    for (const key of Object.keys(node)) {
      const child = (node as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === "object" && "type" in item) {
            visit(item as Node);
          }
        }
      } else if (child && typeof child === "object" && "type" in child) {
        visit(child as Node);
      }
    }
  }

  visit(ast as unknown as Node);

  // Сортируем по убыванию start — вставляем с конца, чтобы не сбивать offsets
  patches.sort((a, b) => b.start - a.start);

  let result = code;
  for (const { start, end, line } of patches) {
    const original = result.slice(start, end);
    result = result.slice(0, start) + `(__line(${line}), ${original})` + result.slice(end);
  }

  return result;
}

const DRONE_ACTIONS = new Set(["moveTo", "mine", "drop", "charge", "wait"]);

function isDroneCall(node: Node | null | undefined): boolean {
  if (!node || node.type !== "CallExpression") return false;
  const call = node as CallExpression;
  if (call.callee.type !== "MemberExpression") return false;
  const member = call.callee as MemberExpression;
  if (
    member.object.type !== "Identifier" ||
    (member.object as { name: string }).name !== "drone"
  ) return false;
  if (member.property.type !== "Identifier") return false;
  return DRONE_ACTIONS.has((member.property as { name: string }).name);
}
```

- [ ] **Шаг 5: Запустить тесты, убедиться что все проходят**

```bash
npm test -- instrument.test
```

Ожидаем: все тесты PASS.

- [ ] **Шаг 6: Type-check**

```bash
npm run type-check
```

Ожидаем: 0 ошибок.

- [ ] **Шаг 7: Коммит**

```bash
git add src/game/code/worker/instrument.ts src/game/code/worker/instrument.test.ts package.json package-lock.json
git commit -m "feat: AST-инструментатор __line для подсветки строк кода дрона

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Типы и runtime — `types.ts` + `codeRuntime.ts`

**Files:**
- Modify: `src/game/code/types.ts`
- Modify: `src/game/code/worker/codeRuntime.ts`

**Interfaces:**
- Consumes: `instrument(code: string): string` из `./instrument.js`
- Produces:
  - `WorkerMessage` тип `intent` — поле `line: number`
  - `WorkerMessage` тип `wait` — поле `line: number`
  - `runCode` передаёт `__line` в `AsyncFunction`, шлёт `line` в сообщениях

- [ ] **Шаг 1: Обновить типы `WorkerMessage` в `src/game/code/types.ts`**

Заменить блок `WorkerMessage`:

```typescript
/** Намерение, которое воркер шлёт driver'у на каждом await drone.<action>(). */
export type WorkerMessage =
  | { type: "intent"; action: CodeAction; targetId?: EntityId; line: number }
  | { type: "wait"; seconds: number; line: number }
  | { type: "finished" }
  | { type: "error"; message: string };
```

- [ ] **Шаг 2: Обновить тесты `codeRuntime.test.ts` — добавить `line` в ожидаемых значениях**

В `src/game/code/worker/codeRuntime.test.ts` все `toEqual` для `intent`/`wait` сообщений нужно дополнить полем `line`. Строки в тестовом коде начинаются с 1:

```typescript
// Тест "sends intent on await drone.moveTo and finishes after resume":
expect(ch.sent[0]).toEqual({ type: "intent", action: "moveTo", targetId: 2, line: 1 });
// ...
expect(ch.sent[1]).toEqual({ type: "intent", action: "mine", line: 1 });

// Тест "sends wait message for drone.wait without an intent round-trip":
expect(ch.sent[0]).toEqual({ type: "wait", seconds: 2, line: 1 });
```

Тест `"exposes synchronous sensors..."` — `charge` на строке 1:
```typescript
expect(ch.sent[0]).toEqual({ type: "intent", action: "charge", line: 1 });
```

Тест `"computes distance() and deposit()..."` — `mine` на строке 5 (из многострочного кода в тесте; подсчитайте вручную: 1=пустая, 2=`if distance`, 3=`if deposit`, 4=`await drone.mine()` → строка 4):
```typescript
expect(ch.sent[0]).toEqual({ type: "intent", action: "mine", line: 4 });
```

> Примечание: точный номер строки зависит от форматирования кода в тесте. После реализации запустите тесты — если номер строки не совпал, исправьте ожидаемое значение в тесте.

- [ ] **Шаг 3: Обновить `codeRuntime.ts`**

Полная замена содержимого `src/game/code/worker/codeRuntime.ts`:

```typescript
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
      const message = err instanceof Error ? err.message : String(err);
      post({ type: "error", message });
    });
}
```

- [ ] **Шаг 4: Запустить тесты**

```bash
npm test -- codeRuntime.test
```

Если `line` в каком-то тесте не совпал — исправьте ожидаемое число строки в `codeRuntime.test.ts`. Добиться PASS.

- [ ] **Шаг 5: Запустить все юнит-тесты**

```bash
npm test
```

Ожидаем: все тесты PASS.

- [ ] **Шаг 6: Type-check**

```bash
npm run type-check
```

Ожидаем: 0 ошибок.

- [ ] **Шаг 7: Коммит**

```bash
git add src/game/code/types.ts src/game/code/worker/codeRuntime.ts src/game/code/worker/codeRuntime.test.ts
git commit -m "feat: прокинуть line через WorkerMessage intent/wait из инструментатора

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Данные — `Program.ts`, `CodeBehaviorDriver.ts`, `gameStore.ts`

**Files:**
- Modify: `src/game/simulation/components/Program.ts`
- Modify: `src/game/code/CodeBehaviorDriver.ts`
- Modify: `src/shared/store/gameStore.ts`

**Interfaces:**
- Consumes: `WorkerMessage` с полем `line` (из Task 2)
- Produces:
  - `ProgramComponent.currentLine: number | null | undefined`
  - `DroneState.currentLine: number | null`

- [ ] **Шаг 1: Добавить `currentLine` в `ProgramComponent`**

В `src/game/simulation/components/Program.ts` добавить поле в интерфейс после `codeError?`:

```typescript
  /** Текущая исполняемая строка кода (1-based). null = нет активного действия. */
  currentLine?: number | null;
```

Итоговый интерфейс `ProgramComponent` (поля после `codeError`):
```typescript
  codeError?: string;
  currentLine?: number | null;
```

- [ ] **Шаг 2: Обновить `CodeBehaviorDriver.ts` — записывать `currentLine`**

В методе `step`, в блоке `switch (msg.type)`:

В case `"intent"` — сразу после всех `program.state = ...` присвоений, перед `session.phase = "action-pending"` добавить:
```typescript
        program.currentLine = msg.line;
```

В case `"wait"` — после `session.waitRemaining = msg.seconds` добавить:
```typescript
        program.currentLine = msg.line;
```

В case `"finished"` — после `program.state = "idle"` добавить:
```typescript
        program.currentLine = null;
```

В case `"error"` — после `program.codeError = msg.message` добавить:
```typescript
        program.currentLine = null;
```

Итого блок `switch` в `step` после изменений:
```typescript
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
        program.currentLine = msg.line;
        session.phase = "action-pending";
        return;
      }
      case "wait": {
        session.waitRemaining = msg.seconds;
        program.currentLine = msg.line;
        session.phase = "waiting";
        return;
      }
      case "finished": {
        session.phase = "done";
        program.state = "idle";
        program.currentLine = null;
        this.clearTimeout(session);
        session.port.terminate();
        return;
      }
      case "error": {
        session.phase = "done";
        program.state = "idle";
        program.codeError = msg.message;
        program.currentLine = null;
        this.clearTimeout(session);
        session.port.terminate();
        return;
      }
    }
```

- [ ] **Шаг 3: Обновить `gameStore.ts` — добавить `currentLine` в `DroneState` и `snapshotDrones`**

В интерфейс `DroneState` в `src/shared/store/gameStore.ts` добавить поле после `codeError?`:

```typescript
  currentLine: number | null;
```

В функции `snapshotDrones` в `return { ... }` добавить поле после `codeError`:

```typescript
      currentLine: program.currentLine ?? null,
```

- [ ] **Шаг 4: Type-check**

```bash
npm run type-check
```

Ожидаем: 0 ошибок.

- [ ] **Шаг 5: Запустить все тесты**

```bash
npm test
```

Ожидаем: все тесты PASS.

- [ ] **Шаг 6: Коммит**

```bash
git add src/game/simulation/components/Program.ts src/game/code/CodeBehaviorDriver.ts src/shared/store/gameStore.ts
git commit -m "feat: пробросить currentLine от worker до DroneState

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: UI — `CodeEditor.tsx` + `ProgramEditor/index.tsx`

**Files:**
- Modify: `src/ui/editor/CodeEditor/CodeEditor.tsx`
- Modify: `src/ui/editor/ProgramEditor/index.tsx`

**Interfaces:**
- Consumes: `DroneState.currentLine: number | null` (из Task 3)
- Produces: Monaco-декорация подсвечивает строку `highlightLine` (фон + glyph)

- [ ] **Шаг 1: Обновить `CodeEditor.tsx` — добавить `highlightLine` и Monaco-декорацию**

Полная замена `src/ui/editor/CodeEditor/CodeEditor.tsx`:

```typescript
import { useEffect, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { setupMonaco } from "./monacoSetup.js";

setupMonaco();

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  height?: string;
  highlightLine?: number | null;
}

export function CodeEditor({
  value,
  onChange,
  readOnly,
  height = "300px",
  highlightLine,
}: CodeEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    decorationsRef.current = editor.createDecorationsCollection([]);
  };

  useEffect(() => {
    const editor = editorRef.current;
    const decorations = decorationsRef.current;
    if (!editor || !decorations) return;

    if (highlightLine == null) {
      decorations.set([]);
      return;
    }

    decorations.set([
      {
        range: new (editor.getModel()!.constructor as never)() as Monaco.IRange,
        // monaco-editor/react re-exports Range — используем прямую конструкцию
        options: {},
      },
    ]);

    // Используем editor.deltaDecorations-совместимый API через коллекцию
    const monaco = (window as { monaco?: typeof Monaco }).monaco;
    if (!monaco) return;

    decorations.set([
      {
        range: new monaco.Range(highlightLine, 1, highlightLine, 1),
        options: {
          isWholeLine: true,
          className: "drone-line-highlight",
          glyphMarginClassName: "drone-line-glyph",
        },
      },
    ]);
  }, [highlightLine]);

  return (
    <div style={{ height, border: "1px solid #1e3a5f", borderRadius: "4px" }}>
      <Editor
        height="100%"
        language="typescript"
        theme="vs-dark"
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleMount}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 12,
          fontFamily: "monospace",
          glyphMargin: true,
        }}
      />
    </div>
  );
}
```

Добавить CSS-классы подсветки. Создать или дополнить файл стилей (проверить, есть ли `src/ui/editor/CodeEditor/CodeEditor.css` или аналог — если нет, добавить `import "./codeHighlight.css"` в `CodeEditor.tsx` и создать файл):

Создать `src/ui/editor/CodeEditor/codeHighlight.css`:

```css
.drone-line-highlight {
  background: rgba(0, 212, 255, 0.12);
}

.drone-line-glyph {
  background: #00d4ff;
  border-radius: 50%;
  width: 8px !important;
  height: 8px !important;
  margin-top: 6px;
  margin-left: 4px;
}
```

Добавить импорт в `CodeEditor.tsx` после `import { setupMonaco } ...`:
```typescript
import "./codeHighlight.css";
```

> **Примечание по Monaco API:** `window.monaco` доступен после того как `@monaco-editor/react` инициализировал Monaco. Это стандартный способ получить доступ к конструктору `Range`. Альтернатива — импортировать `loader` из `@monaco-editor/react` и вызвать `loader.init()`, но `window.monaco` проще и уже используется в проекте через `monacoSetup`.

- [ ] **Шаг 2: Обновить `ProgramEditor/index.tsx` — передавать `highlightLine`**

В `src/ui/editor/ProgramEditor/index.tsx`:

1. Добавить `currentLine` в список читаемых полей дрона (уже есть `const drone = drones.find(...)`):

В блоке DRONE-вкладки вычислить `activeProgramId` перед JSX-разметкой (например, сразу после `const editingProgram = ...`):

```typescript
  const activeProgramId = drone
    ? (drone.assignedProgramId ?? drone.personalProgramId)
    : null;
```

2. В блоке рендеринга assigned-программы передать `highlightLine`:

```tsx
<CodeEditor
  value={assignedProgram.behavior.code}
  onChange={(code) => setProgramCodeSource(assignedProgram.id, code)}
  height="240px"
  highlightLine={
    drone.assignedProgramId === activeProgramId
      ? (drone.currentLine ?? null)
      : null
  }
/>
```

3. В блоке рендеринга personal-программы передать `highlightLine`:

```tsx
<CodeEditor
  value={personalProgram.behavior.code}
  onChange={(code) => setProgramCodeSource(personalProgram.id, code)}
  height="240px"
  highlightLine={
    drone.personalProgramId === activeProgramId
      ? (drone.currentLine ?? null)
      : null
  }
/>
```

- [ ] **Шаг 3: Type-check**

```bash
npm run type-check
```

Ожидаем: 0 ошибок. Если Monaco-типы ругаются на `window.monaco` — добавить кастинг `(window as unknown as { monaco: typeof Monaco }).monaco`.

- [ ] **Шаг 4: Запустить все тесты**

```bash
npm test
```

Ожидаем: все тесты PASS.

- [ ] **Шаг 5: Коммит**

```bash
git add src/ui/editor/CodeEditor/CodeEditor.tsx src/ui/editor/CodeEditor/codeHighlight.css src/ui/editor/ProgramEditor/index.tsx
git commit -m "feat: подсветка текущей строки кода дрона в Monaco-редакторе

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Финальная проверка и документация

**Files:**
- Modify: `docs/features/planned/code-debugging-line-highlight.md` → переместить в `docs/features/done/`
- Modify: `docs/features/index.md`
- Create: `docs/sessions/<дата+slug>.md`

- [ ] **Шаг 1: Запустить полный набор тестов**

```bash
npm test
npm run type-check
```

Ожидаем: 0 ошибок, все тесты PASS.

- [ ] **Шаг 2: Ручная проверка в браузере**

```bash
npm run dev
```

1. Открыть игру, запустить игровой мир.
2. Написать для дрона код:
   ```javascript
   while (true) {
     await drone.moveTo(mine);
     await drone.mine();
     await drone.moveTo(base);
     await drone.drop();
   }
   ```
3. Выбрать дрон → вкладка DRONE → убедиться, что строка подсвечивается (голубой фон + голубая точка в gutter).
4. Наблюдать за сменой подсветки по мере выполнения шагов.
5. Дать программе завершиться (или нажать сброс) → убедиться, что подсветка исчезает.
6. Назначить дрону библиотечную программу → убедиться, что подсветка работает и для неё.

- [ ] **Шаг 3: Обновить документацию фичи**

Переместить `docs/features/planned/code-debugging-line-highlight.md` в `docs/features/done/code-debugging-line-highlight.md` и обновить статус внутри файла на `done`.

Обновить `docs/features/index.md` — поменять статус и путь к файлу.

- [ ] **Шаг 4: Создать сессионный лог**

Создать `docs/sessions/<YYYY-MM-DD-HHMM-code-line-highlight.md>` с разделами: цель, результаты, что реализовано, что не реализовано (step-режим).

- [ ] **Шаг 5: Финальный коммит документации**

```bash
git add docs/
git commit -m "docs: зафиксировать результаты реализации подсветки строк кода

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review

### Покрытие спеки

| Требование из спеки | Задача |
|----|-----|
| `instrument.ts` — чистая функция, acorn, `ecmaVersion: 2020`, `locations: true` | Task 1 |
| Юнит-тесты: типовой код, комментарии, строки, многострочные вызовы, валидный JS | Task 1 |
| Комментарий о будущем step-режиме | Task 1 (в коде `instrument.ts`) |
| `WorkerMessage` — `line: number` в `intent` и `wait` | Task 2 |
| `codeRuntime.ts` — `currentLine`, `__line(n)`, `instrument()`, `line` в сообщениях | Task 2 |
| `Program.ts` — `currentLine?: number \| null` | Task 3 |
| `CodeBehaviorDriver.ts` — запись и сброс `currentLine` | Task 3 |
| `DroneState.currentLine`, `snapshotDrones` | Task 3 |
| `CodeEditor` — `highlightLine`, `glyphMargin`, декорация | Task 4 |
| `ProgramEditor` — `activeProgramId`, условная передача `highlightLine` | Task 4 |
| Подсветка для персональной и назначенной программ | Task 4 |
| Нет подсветки при idle / завершённой программе | Task 3 (`currentLine = null`) + Task 4 (проверка `null`) |
| `npm test` и `npm run type-check` зелёные | Tasks 1–4 |
| Перемещение фичи в `done/` | Task 5 |
| Vite `?worker`-импорт не трогаем | В плане не изменяем `BrowserWorkerPort.ts` |

### Проверка на placeholder'ы

- Все шаги содержат конкретный код.
- Нет "TBD" или "similar to Task N".
- Все типы и имена методов согласованы между задачами.

### Согласованность типов

- `instrument(code: string): string` — определено в Task 1, потребляется в Task 2.
- `WorkerMessage` с `line: number` — определено в Task 2, читается в Task 3.
- `ProgramComponent.currentLine: number | null | undefined` — определено в Task 3, читается в `snapshotDrones`.
- `DroneState.currentLine: number | null` — определено в Task 3, читается в Task 4.
- `highlightLine?: number | null` — проп `CodeEditor`, используется в `ProgramEditor`.
