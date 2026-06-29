# Subprogram Call Highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Пока выполняется тело импортированной подпрограммы, подсвечивать строку её вызова в entry-программе (а не гасить подсветку).

**Architecture:** Заменяем единственную переменную `currentLine` в воркере на стек кадров `lineStack`. Перед вызовом `__mod_*`-функции — push строки вызова, после выхода — pop. В сообщениях воркера шлём весь стек; driver выбирает самую глубокую строку, принадлежащую entry-сегменту, через новую функцию `mapStackToEntryLine`.

**Tech Stack:** TypeScript, Acorn (AST-парсинг), Vitest (unit-тесты), Playwright (e2e)

## Global Constraints

- Никаких вложенных тернарников, именовать промежуточные значения (CLAUDE.md)
- Simulation layer (`src/game/`) — никогда не импортирует Phaser
- Тесты — Vitest рядом с файлом (`*.test.ts`); e2e — Playwright, `data-testid` только
- Поле `line: number` в WorkerMessage сохраняется (обратная совместимость)
- `__call` определяет thenable в рантайме — безопасно для sync и async функций

---

## Файловая карта изменений

| Файл | Действие |
|---|---|
| `src/game/code/types.ts` | Добавить `lineStack: number[]` в `intent` и `wait` |
| `src/game/code/worker/codeRuntime.ts` | Заменить `currentLine` на `lineStack`, добавить `__line`/`__pushCall`/`__popCall`/`__call`, прокинуть в AsyncFunction |
| `src/game/code/worker/instrument.ts` | Оборачивать `__mod_*`-вызовы в `__call(LINE, () => ...)` |
| `src/game/code/linker/mapLine.ts` | Добавить `mapStackToEntryLine` |
| `src/game/code/CodeBehaviorDriver.ts` | `mapToEntryLine` → `mapStackToEntryLine(msg.lineStack, ...)` |
| `src/game/code/worker/codeRuntime.test.ts` | Обновить ожидания: `line` + `lineStack` в sent-сообщениях |
| `src/game/code/worker/instrument.test.ts` | Новые кейсы: `__mod_*` оборачивается в `__call` |
| `src/game/code/linker/instrumentCompat.test.ts` | Обновить: `buildable` получает `__call` как аргумент |
| `src/game/code/linker/mapLine.test.ts` | Новые кейсы для `mapStackToEntryLine` |
| `tests/` (e2e) | Новый/доп. тест: подсветка строки вызова подпрограммы |

---

## Task 1: Добавить `lineStack` в типы сообщений воркера

**Files:**
- Modify: `src/game/code/types.ts`

**Interfaces:**
- Produces: `WorkerMessage` — поля `intent` и `wait` теперь содержат `lineStack: number[]` (дополнительно к существующему `line: number`)

- [ ] **Step 1: Открыть файл и изучить текущую структуру**

Прочитать `src/game/code/types.ts` (уже прочитан выше — структура известна).

- [ ] **Step 2: Добавить `lineStack` в `intent` и `wait`**

В `src/game/code/types.ts` изменить тип `WorkerMessage`:

```ts
export type WorkerMessage =
  | { type: "intent"; action: CodeAction; point?: Position; line: number; lineStack: number[] }
  | { type: "wait"; seconds: number; line: number; lineStack: number[] }
  | { type: "finished" }
  | { type: "error"; message: string };
```

- [ ] **Step 3: Проверить, что TypeScript видит ошибки в местах отправки (ещё не обновлённых)**

```bash
npm run type-check 2>&1 | head -40
```

Ожидание: ошибки в `codeRuntime.ts` — поля `lineStack` нет в отправляемых объектах. Это хорошо — TypeScript подскажет где нужно обновить.

- [ ] **Step 4: Commit**

```bash
git add src/game/code/types.ts
git commit -m "feat: add lineStack to WorkerMessage intent/wait types"
```

---

## Task 2: Заменить `currentLine` на стек кадров в воркере

**Files:**
- Modify: `src/game/code/worker/codeRuntime.ts`

**Interfaces:**
- Consumes: `WorkerMessage` из Task 1 — теперь требует `lineStack: number[]`
- Produces: `__line(n)`, `__call(line, invoke)` — функции, прокидываемые в AsyncFunction

- [ ] **Step 1: Заменить `currentLine` на `lineStack` и добавить хелперы**

В `src/game/code/worker/codeRuntime.ts` заменить:

```ts
// было:
let currentLine = 0;

function __line(n: number): void {
  currentLine = n;
}
```

на:

```ts
const lineStack: number[] = [0];

function __line(n: number): void {
  lineStack[lineStack.length - 1] = n;
}

function __pushCall(callLine: number): void {
  lineStack[lineStack.length - 1] = callLine;
  lineStack.push(0);
}

function __popCall(): void {
  lineStack.pop();
}

function __call<T>(callLine: number, invoke: () => T): T {
  __pushCall(callLine);
  let result: T;
  try {
    result = invoke();
  } catch (err) {
    __popCall();
    throw err;
  }
  const isThenable =
    result != null && typeof (result as { then?: unknown }).then === "function";
  if (isThenable) {
    return (result as unknown as Promise<unknown>).finally(__popCall) as T;
  }
  __popCall();
  return result;
}
```

- [ ] **Step 2: Обновить `sendMove` и `sendAction` — слать `lineStack`**

```ts
function sendMove(point: Position): Promise<void> {
  post({ type: "intent", action: "moveTo", point, line: lineStack[lineStack.length - 1], lineStack: [...lineStack] });
  return awaitResume();
}

function sendAction(action: CodeAction): Promise<void> {
  post({ type: "intent", action, line: lineStack[lineStack.length - 1], lineStack: [...lineStack] });
  return awaitResume();
}
```

- [ ] **Step 3: Обновить `self.wait` — слать `lineStack`**

В классе `SelfEntity`, метод `wait`:

```ts
wait(seconds: number): Promise<void> {
  post({ type: "wait", seconds, line: lineStack[lineStack.length - 1], lineStack: [...lineStack] });
  return awaitResume();
}
```

- [ ] **Step 4: Прокинуть `__call` в AsyncFunction**

```ts
// было:
const fn = new AsyncFunction("self", "World", "__line", instrumentedCode);
return fn(self, World, __line)

// стало:
const fn = new AsyncFunction("self", "World", "__line", "__call", instrumentedCode);
return fn(self, World, __line, __call)
```

- [ ] **Step 5: Запустить type-check**

```bash
npm run type-check 2>&1 | head -40
```

Ожидание: 0 ошибок.

- [ ] **Step 6: Запустить существующие unit-тесты codeRuntime**

```bash
npx vitest run src/game/code/worker/codeRuntime.test.ts 2>&1
```

Ожидание: тесты **упадут** — они проверяют `{ line: 1 }` без `lineStack`. Это нормально — исправим в Task 4.

- [ ] **Step 7: Commit**

```bash
git add src/game/code/worker/codeRuntime.ts
git commit -m "feat: replace currentLine with lineStack in codeRuntime worker"
```

---

## Task 3: Инструментировать `__mod_*`-вызовы в `instrument.ts`

**Files:**
- Modify: `src/game/code/worker/instrument.ts`

**Interfaces:**
- Consumes: склеенный код от линкера — вызовы модульных функций выглядят как `__mod_<slug>__<name>(args)` или `await __mod_<slug>__<name>(args)`
- Produces: `__call(LINE, () => __mod_<slug>__<name>(args))` вместо голого вызова

**Важно:** `__call` оборачивает всё `CallExpression` целиком (не только `await`). `__line`-патчи на внутренние `await self.*` не затрагиваются — они на другом уровне AST.

- [ ] **Step 1: Написать failing-тесты для `__mod_*`-обёртки**

Добавить в `src/game/code/worker/instrument.test.ts`:

```ts
describe("instrument — __mod_* calls", () => {
  it("оборачивает await __mod_*() вызов в __call", () => {
    // Имитируем склеенный код: модульная функция с await
    const code = `await __mod_my__goToBase();`;
    const result = instrument(code);
    expect(result).toContain("__call(");
    expect(result).toContain("__mod_my__goToBase()");
    // await должен быть снаружи __call, а не внутри
    expect(result).toMatch(/await __call\(\d+,/);
  });

  it("оборачивает синхронный __mod_*() вызов в __call (без await)", () => {
    const code = `__mod_my__helper();`;
    const result = instrument(code);
    expect(result).toContain("__call(");
    expect(result).toContain("__mod_my__helper()");
  });

  it("не трогает обычные вызовы self.* и локальные хелперы", () => {
    const code = `await self.mine();\nhelperFn();`;
    const result = instrument(code);
    expect(result).not.toMatch(/__call\(/);
    expect(result).toContain("__line(");
  });

  it("правильно обрабатывает __mod_* с аргументами", () => {
    const code = `await __mod_utils__moveTo({ x: 1, y: 2 });`;
    const result = instrument(code);
    expect(result).toMatch(/await __call\(\d+, \(\) => __mod_utils__moveTo\(\{ x: 1, y: 2 \}\)\)/);
  });

  it("сохраняет __line для await self.* внутри кода рядом с __mod_* вызовами", () => {
    const code = `await self.mine();\nawait __mod_my__fn();`;
    const result = instrument(code);
    expect(result).toContain("__line(1)");  // для self.mine()
    expect(result).toContain("__call(2,");  // для __mod_my__fn()
  });
});
```

- [ ] **Step 2: Запустить тесты, убедиться, что падают**

```bash
npx vitest run src/game/code/worker/instrument.test.ts 2>&1
```

Ожидание: новые тесты FAIL — `__call` ещё не вставляется.

- [ ] **Step 3: Добавить детекцию `__mod_*`-вызовов и патчинг в `instrument.ts`**

Добавить функцию-детектор и расширить `visit`:

```ts
// После константы DRONE_ACTIONS добавить:
const MODULE_CALL_PREFIX = "__mod_";

function isModuleCall(node: Node): boolean {
  if (node.type !== "CallExpression") return false;
  const call = node as CallExpression;
  if (call.callee.type !== "Identifier") return false;
  return (call.callee as { name: string }).name.startsWith(MODULE_CALL_PREFIX);
}
```

В функции `visit` добавить ветку для `CallExpression` (после существующей ветки `AwaitExpression`):

```ts
// Патчи для __mod_*-вызовов (оборачиваем в __call независимо от наличия await)
interface CallPatch {
  start: number;
  end: number;
  line: number;
}
const callPatches: CallPatch[] = [];
```

В функции `visit` добавить новую ветку перед рекурсией:

```ts
if (node.type === "CallExpression" && isModuleCall(node)) {
  const callNode = node as CallExpression & {
    start: number;
    end: number;
    loc: { start: { line: number } };
  };
  callPatches.push({
    start: callNode.start,
    end: callNode.end,
    line: callNode.loc.start.line,
  });
  // Не спускаемся в children CallExpression — внутренние self.* будут
  // инструментированы отдельно через AwaitExpression на том же уровне.
  return;
}
```

После существующей сортировки и применения `patches` добавить применение `callPatches`:

```ts
// Применяем callPatches (__mod_* оборачиваем в __call)
callPatches.sort((a, b) => b.start - a.start);

for (const { start, end, line } of callPatches) {
  const original = result.slice(start, end);
  result =
    result.slice(0, start) +
    `__call(${line}, () => ${original})` +
    result.slice(end);
}
```

**Примечание о порядке применения патчей:** `patches` (для `await self.*`) применяются первыми; после них `callPatches` (для `__mod_*`). Оба сортированы по убыванию start и применяются с конца. Пересечений нет: `__mod_*` CallExpression и `await self.*` AwaitExpression — разные узлы AST на разных позициях.

- [ ] **Step 4: Запустить тесты — должны позеленеть**

```bash
npx vitest run src/game/code/worker/instrument.test.ts 2>&1
```

Ожидание: все тесты PASS, включая новые.

- [ ] **Step 5: Обновить `instrumentCompat.test.ts` — добавить `__call` в аргументы AsyncFunction**

В `src/game/code/linker/instrumentCompat.test.ts` функция `buildable` сейчас создаёт:

```ts
new AsyncFunction("self", "World", "__line", instrumented);
```

Обновить на:

```ts
new AsyncFunction("self", "World", "__line", "__call", instrumented);
```

- [ ] **Step 6: Запустить `instrumentCompat.test.ts`**

```bash
npx vitest run src/game/code/linker/instrumentCompat.test.ts 2>&1
```

Ожидание: все тесты PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/code/worker/instrument.ts src/game/code/worker/instrument.test.ts src/game/code/linker/instrumentCompat.test.ts
git commit -m "feat: wrap __mod_* calls in __call() in instrument.ts"
```

---

## Task 4: Добавить `mapStackToEntryLine` в `mapLine.ts`

**Files:**
- Modify: `src/game/code/linker/mapLine.ts`
- Test: `src/game/code/linker/mapLine.test.ts`

**Interfaces:**
- Consumes: `lineStack: number[]`, `lineMap: LineMapSegment[]`, `entryId: string`
- Produces: `mapStackToEntryLine({ lineStack, lineMap, entryId }): number | null` — строка entry для подсветки

- [ ] **Step 1: Написать failing-тесты для `mapStackToEntryLine`**

Добавить в `src/game/code/linker/mapLine.test.ts`:

```ts
import { mapLine, mapStackToEntryLine } from "./mapLine.js";

// Склеенный код: строки 1-5 — модуль "mod", строки 6-10 — entry "e"
const lineMapWithMod: LineMapSegment[] = [
  { fromLine: 1, toLine: 5, programId: "mod", origLine: 1 },
  { fromLine: 6, toLine: 10, programId: "e", origLine: 1 },
];

describe("mapStackToEntryLine", () => {
  it("стек только из entry-строк → возвращает строку entry", () => {
    // glued line 7 → entry origLine 1 + (7-6) = 2
    expect(mapStackToEntryLine({ lineStack: [7], lineMap: lineMapWithMod, entryId: "e" })).toBe(2);
  });

  it("стек [entry-строка вызова, mod-строка] → подсвечивается entry-строка вызова", () => {
    // lineStack[0] = 8 (строка вызова goToBase() в entry, origLine 3)
    // lineStack[1] = 3 (строка moveTo() внутри mod — в entry не маппится)
    // Результат: 3 (entry origLine)
    expect(mapStackToEntryLine({ lineStack: [8, 3], lineMap: lineMapWithMod, entryId: "e" })).toBe(3);
  });

  it("тройной стек entry→modA→modB → подсвечивается строка вызова modA из entry", () => {
    // lineStack = [entry-вызов-modA (8), modA-вызов-modB (2), modB-текущее (1)]
    // 8 → entry origLine 3; 2 → mod → null; 1 → mod → null
    // Самая глубокая entry-строка = 3
    expect(mapStackToEntryLine({ lineStack: [8, 2, 1], lineMap: lineMapWithMod, entryId: "e" })).toBe(3);
  });

  it("стек целиком внутри модулей (нет entry-кадра) → null", () => {
    // lineStack[0] = 2, lineStack[1] = 4 — оба в mod
    expect(mapStackToEntryLine({ lineStack: [2, 4], lineMap: lineMapWithMod, entryId: "e" })).toBeNull();
  });

  it("пустой стек → null", () => {
    expect(mapStackToEntryLine({ lineStack: [], lineMap: lineMapWithMod, entryId: "e" })).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить тесты, убедиться что падают**

```bash
npx vitest run src/game/code/linker/mapLine.test.ts 2>&1
```

Ожидание: новые тесты FAIL — `mapStackToEntryLine` не экспортируется.

- [ ] **Step 3: Реализовать `mapStackToEntryLine` в `mapLine.ts`**

```ts
interface MapStackToEntryLineArgs {
  lineStack: number[];
  lineMap: LineMapSegment[];
  entryId: string;
}

/**
 * Из стека склеенных строк выбирает строку для подсветки entry-программы:
 * самую глубокую строку, принадлежащую entry-сегменту.
 *
 * Пока выполняется тело подпрограммы, lineStack содержит строку вызова (entry)
 * и строки внутри модуля. mapLine для модульных строк вернёт null — они
 * пропускаются; entry-строка вызова победит.
 */
export function mapStackToEntryLine({
  lineStack,
  lineMap,
  entryId,
}: MapStackToEntryLineArgs): number | null {
  let result: number | null = null;
  for (const gluedLine of lineStack) {
    const mapped = mapLine(gluedLine, lineMap, entryId);
    if (mapped !== null) {
      result = mapped.origLine;
    }
  }
  return result;
}
```

- [ ] **Step 4: Запустить тесты — должны позеленеть**

```bash
npx vitest run src/game/code/linker/mapLine.test.ts 2>&1
```

Ожидание: все тесты PASS (включая старые кейсы `mapLine`).

- [ ] **Step 5: Commit**

```bash
git add src/game/code/linker/mapLine.ts src/game/code/linker/mapLine.test.ts
git commit -m "feat: add mapStackToEntryLine to mapLine.ts"
```

---

## Task 5: Переключить `CodeBehaviorDriver` на `mapStackToEntryLine`

**Files:**
- Modify: `src/game/code/CodeBehaviorDriver.ts`

**Interfaces:**
- Consumes: `mapStackToEntryLine` из Task 4; `msg.lineStack` из Task 1/2
- Produces: корректная подсветка `program.currentLine` при выполнении подпрограммы

- [ ] **Step 1: Обновить импорт в `CodeBehaviorDriver.ts`**

```ts
// было:
import { mapLine } from "./linker/mapLine.js";

// стало:
import { mapStackToEntryLine } from "./linker/mapLine.js";
```

- [ ] **Step 2: Заменить `mapToEntryLine` на вызов `mapStackToEntryLine`**

Заменить приватный метод:

```ts
// было:
private mapToEntryLine(session: Session, gluedLine: number): number | null {
  const mapped = mapLine(gluedLine, session.lineMap, session.entryId);
  return mapped?.origLine ?? null;
}
```

на:

```ts
private mapToEntryLine(session: Session, lineStack: number[]): number | null {
  return mapStackToEntryLine({
    lineStack,
    lineMap: session.lineMap,
    entryId: session.entryId,
  });
}
```

- [ ] **Step 3: Обновить вызовы `mapToEntryLine` в `step()`**

В switch-кейсе `intent`:

```ts
// было:
program.currentLine = this.mapToEntryLine(session, msg.line);

// стало:
program.currentLine = this.mapToEntryLine(session, msg.lineStack);
```

В switch-кейсе `wait`:

```ts
// было:
program.currentLine = this.mapToEntryLine(session, msg.line);

// стало:
program.currentLine = this.mapToEntryLine(session, msg.lineStack);
```

- [ ] **Step 4: Type-check**

```bash
npm run type-check 2>&1 | head -40
```

Ожидание: 0 ошибок.

- [ ] **Step 5: Commit**

```bash
git add src/game/code/CodeBehaviorDriver.ts
git commit -m "feat: switch CodeBehaviorDriver to mapStackToEntryLine for subprogram call highlight"
```

---

## Task 6: Обновить тесты `codeRuntime.test.ts`

**Files:**
- Modify: `src/game/code/worker/codeRuntime.test.ts`

После Task 2 воркер шлёт `{ ..., lineStack: [...] }` в каждом intent/wait. Существующие тесты используют `toEqual` и упадут без `lineStack`.

- [ ] **Step 1: Запустить тесты, увидеть падения**

```bash
npx vitest run src/game/code/worker/codeRuntime.test.ts 2>&1
```

Ожидание: тесты FAIL — `lineStack` отсутствует в `expected`.

- [ ] **Step 2: Обновить тесты — добавить `lineStack` в ожидания**

Пройти по каждому `toEqual` с `{ type: "intent", ... }` и `{ type: "wait", ... }` и добавить `lineStack`:

```ts
// пример для первого теста:
expect(ch.sent[0]).toEqual({
  type: "intent",
  action: "moveTo",
  point: { x: 3, y: 0 },
  line: 1,
  lineStack: [1],
});

expect(ch.sent[1]).toEqual({ type: "intent", action: "mine", line: 1, lineStack: [1] });
```

```ts
// тест wait:
expect(ch.sent[0]).toEqual({ type: "wait", seconds: 2, line: 1, lineStack: [1] });
```

```ts
// тест с многострочным кодом (строка 4):
expect(ch.sent[0]).toEqual({ type: "intent", action: "mine", line: 4, lineStack: [4] });
```

```ts
// тест keep entity references (строка 8):
expect(ch.sent[1]).toEqual({ type: "intent", action: "mine", line: 8, lineStack: [8] });
```

Для тестов, использующих `toMatchObject`, добавление `lineStack` необязательно (они проверяют подмножество).

- [ ] **Step 3: Добавить новый тест — стек кадров при вызове `__call`**

```ts
it("lineStack содержит строку вызова при использовании __call", async () => {
  const ch = makeChannel();
  // Имитируем склеенный код: __call(2, ...) на строке 2 push-ит кадр,
  // внутри — await self.mine() на строке 3.
  // После __pushCall(2): lineStack = [2, 0]
  // __line(3) внутри: lineStack = [2, 3]
  // sent[0].lineStack = [2, 3]
  const code = `
await self.moveTo({ x: 0, y: 0 });
__call(2, () => { return (async () => { await self.mine(); })(); });
  `.trim();

  runCode(start(code), ch.post, ch.onDriverMessage);
  await vi.waitFor(() => expect(ch.sent.length).toBe(1));
  ch.deliver({ type: "resume", world: WORLD });

  await vi.waitFor(() => expect(ch.sent.length).toBe(2));
  expect(ch.sent[1]).toMatchObject({
    type: "intent",
    action: "mine",
    lineStack: [2, expect.any(Number)],
  });
});
```

- [ ] **Step 4: Запустить тесты — все должны пройти**

```bash
npx vitest run src/game/code/worker/codeRuntime.test.ts 2>&1
```

Ожидание: все тесты PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/code/worker/codeRuntime.test.ts
git commit -m "test: update codeRuntime tests for lineStack in WorkerMessage"
```

---

## Task 7: Прогон всех unit-тестов и финальная проверка

**Files:**
- Read-only: все изменённые файлы

- [ ] **Step 1: Запустить все unit-тесты**

```bash
npx vitest run 2>&1
```

Ожидание: все тесты PASS, 0 failures.

- [ ] **Step 2: Type-check**

```bash
npm run type-check 2>&1
```

Ожидание: 0 ошибок.

- [ ] **Step 3: Запустить игру и вручную проверить поведение**

```bash
npm run dev
```

1. Создать программу с `import { goToBase } from "..."`.
2. Запустить дрон.
3. Пока выполняется `await goToBase()` — строка вызова в editor должна быть подсвечена (не гаснуть).
4. При обычных `await self.mine()` — подсветка работает как раньше.

- [ ] **Step 4: Commit (если нужны правки по итогам ручной проверки)**

```bash
git add <исправленные файлы>
git commit -m "fix: <что исправлено по итогам проверки>"
```

---

## Task 8: E2E-тест подсветки строки вызова подпрограммы

**Files:**
- Create/Modify: `tests/` (e2e Playwright)

Найти существующий e2e-тест подсветки строк и добавить новый сценарий, **или** создать новый файл.

- [ ] **Step 1: Найти существующие e2e-тесты подсветки**

```bash
npx grep -r "currentLine\|highlight\|decoration" tests/ --include="*.ts" -l 2>&1
```

Или через поиск:

```bash
ls tests/
```

- [ ] **Step 2: Написать e2e-тест**

Добавить тест в подходящий файл (или создать `tests/subprogram-highlight.spec.ts`):

```ts
import { test, expect } from "@playwright/test";

test("подсвечивает строку вызова подпрограммы в entry во время исполнения её тела", async ({ page }) => {
  await page.goto("/");

  // Создать или выбрать миссию с поддержкой импортов
  // (конкретные селекторы зависят от реального UI — заменить на data-testid)
  await page.locator('[data-testid="mission-select"]').selectOption({ index: 0 });
  await page.locator('[data-testid="start-button"]').click();

  // Открыть редактор кода для дрона
  await page.locator('[data-testid="drone-editor-open"]').click();

  // Ввести программу с импортом подпрограммы
  const editorCode = `import { goToBase } from "my";\nwhile (true) {\n  await self.moveTo(World.mines[0].position);\n  await goToBase();\n}`;
  await page.locator('[data-testid="code-editor"]').fill(editorCode);

  // Запустить программу
  await page.locator('[data-testid="run-button"]').click();

  // Дождаться момента, когда исполняется тело goToBase()
  // (подсветка должна быть на строке 4 — await goToBase())
  await expect(
    page.locator('[data-testid="editor-current-line"]')
  ).toContainText("goToBase", { timeout: 10000 });
});
```

**Примечание:** конкретные `data-testid` нужно проверить по реальному UI (grep по компонентам редактора).

- [ ] **Step 3: Запустить e2e-тест**

```bash
npx playwright test tests/subprogram-highlight.spec.ts 2>&1
```

Ожидание: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/subprogram-highlight.spec.ts
git commit -m "test: e2e test for subprogram call line highlight"
```

---

## Self-Review против спеки

| Требование спеки | Задача |
|---|---|
| `lineStack` вместо `currentLine` в воркере | Task 2 |
| `__line(n)` обновляет текущий кадр | Task 2 |
| `__pushCall` / `__popCall` / `__call` хелперы | Task 2 |
| `sendMove`/`sendAction`/`wait` шлют `lineStack: [...lineStack]` | Task 2 |
| `__call` прокинут в AsyncFunction | Task 2 |
| `__mod_*`-вызовы оборачиваются в `__call(LINE, () => ...)` | Task 3 |
| `await self.*` по-прежнему `__line` без изменений | Task 3 (не трогаем) |
| `lineStack: number[]` в `intent` и `wait` WorkerMessage | Task 1 |
| `mapStackToEntryLine` в `mapLine.ts` | Task 4 |
| Driver переходит на `mapStackToEntryLine(msg.lineStack, ...)` | Task 5 |
| Unit-тесты `instrument.test.ts` для `__mod_*` | Task 3 |
| Unit-тесты `mapLine.test.ts` для `mapStackToEntryLine` | Task 4 |
| `instrumentCompat.test.ts` передаёт `__call` | Task 3 |
| `codeRuntime.test.ts` обновлён под `lineStack` | Task 6 |
| E2E-тест | Task 8 |
| `line: number` сохранён (обратная совместимость) | Task 1 + 2 |
