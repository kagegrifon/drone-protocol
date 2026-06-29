# Этап A — Stack-trace + подсветка строк внутри модулей (Drone Loop)

> План реализации этапа A фичи step-режима отладки.
> Спека: [docs/superpowers/specs/2026-06-29-step-debug-stack-trace-design.md](../specs/2026-06-29-step-debug-stack-trace-design.md).
> Ветка: `feat/step-debug-stack-trace`.

## Context

В Code Mode код дронов исполняется в Web Worker; инфраструктура подсветки строки и
**`lineStack`** (стек склеенных строк вызова) уже готова в
[codeRuntime.ts](../../../src/game/code/worker/codeRuntime.ts) (`__line/__pushCall/__popCall/__call`,
`lineStack` уже шлётся в каждом `WorkerMessage`). Но подсветка работает **только для
entry-программы**: пока исполнение внутри импортированного модуля, `mapStackToEntryLine`
отбрасывает модульные строки (политика «v1: гасить в модулях» в
[mapLine.ts](../../../src/game/code/linker/mapLine.ts)). Стек вызовов не виден, отладка многомодульных
программ «слепая».

**Цель этапа A:** заменить политику «гасить в модулях» на «показывать полный стек кадров и
подсвечивать активную строку в правильном файле». Движок исполнения НЕ трогаем — меняем только
политику маппинга и проводим `StackFrame[]` от драйвера до UI.

Решения, согласованные с пользователем:
- **Call Stack UI** — горизонтальные хлебные крошки над редактором вкладки DRONE (не боковая панель).
- **Код модуля при step-into** — read-only превью с подсветкой (редактирование остаётся на вкладке PROGRAM).
- **Объём** — только этап A. Этапы B (Pause/Step/Continue) и C (statement-level + breakpoints) — позже.

**Forward-compat с будущим debug-режимом (этап B).** Пользователь описал будущий UX: debug-режим как
отдельный режим наравне с play/pause; внутри него «провалиться в подпрограмму» (step-into) или «подождать
её выполнения не проваливаясь» (step-over); контролы перемещения по коду. Этап A это **не реализует**, но
не закрывает путь: вся эта семантика опирается на тот же `codeStack: StackFrame[]`, что строится здесь.
step-into = follow самого глубокого кадра (дефолт A), step-over = показ кадра вызывающей программы (= выбор
кадра кликом, уже в A). Остановки сейчас возможны только на `await self.*` (см. instrument.ts) — это база и
для будущих шагов B. Никаких изменений модели данных под B не требуется; единственная UI-заметка — резерв
места под будущие debug-контролы рядом с крошками (см. Шаг 5).

Методология — **TDD** (правило проекта): сначала падающий тест, затем реализация.

### ⚠ Конфликт имён (обязательно учесть)
В [Program.ts](../../../src/game/simulation/components/Program.ts) поле `callStack: CallFrame[]` **уже
занято** block-based исполнением (с `instructionIndex`). Новое поле для code-кадров спеки нельзя
называть `callStack`. **Используем `codeStack`** (тип `StackFrame[] | null`) во всех слоях
(Program, DroneState). Имена функций/типов — `StackFrame`, `mapStackToFrames`.

---

## Шаг 1 — `mapStackToFrames` + тип `StackFrame` (TDD)

Файл: `src/game/code/linker/mapLine.ts`, тест рядом в `src/game/code/linker/mapLine.test.ts`.

- Добавить тип:
  ```ts
  export interface StackFrame {
    programId: string;
    line: number; // строка в ИСХОДНОМ коде программы (1-based)
  }
  ```
- Добавить `mapStackToFrames({ lineStack, lineMap }): StackFrame[]` — маппит **весь** `lineStack`
  через существующую логику `mapLine`, **без** отбрасывания модульных кадров. Базируется на `mapLine`,
  но возвращает кадр для любого сегмента (убираем проверку `seg.programId !== entryId`).
  - Чтобы не дублировать и не ломать текущую сигнатуру `mapLine` (она нужна `mapStackToEntryLine`),
    выделить внутренний хелпер маппинга строки без entry-фильтра (напр. `resolveSegment(line, lineMap)`),
    через который выразить и `mapLine` (добавляет entry-фильтр поверх), и `mapStackToFrames`.
  - Порядок: внешний кадр (entry) первым, самый глубокий (текущая активная строка) — последним.
  - Строки, не попавшие ни в один сегмент, пропускаются (не ломают массив).
- `mapStackToEntryLine` оставить (fallback/совместимость) — допустимо переразить через `mapStackToFrames`
  (последний кадр с `programId === entryId`), не плодя дублирование. Существующие тесты должны пройти.

**Тесты (новый `describe("mapStackToFrames")`):**
- стек `[entryLine, moduleLine]` → 2 кадра с верными `programId`/`line`;
- чисто-entry стек → 1 кадр;
- тройной `entry→modA→modB` → 3 кадра в правильном порядке;
- пустой/нулевой стек → `[]`.

## Шаг 2 — поле `codeStack` в Program + заполнение в драйвере (TDD)

Файлы: `src/game/simulation/components/Program.ts`, `src/game/code/CodeBehaviorDriver.ts`,
тест `src/game/code/CodeBehaviorDriver.test.ts`.

- В `ProgramComponent` добавить `codeStack?: StackFrame[] | null` (импорт `StackFrame` из `mapLine`).
  `currentLine` **оставляем** как derived (последний кадр) — чтобы не трогать прочий UI; источник
  правды — `codeStack`.
- В `CodeBehaviorDriver`:
  - заменить `private mapToEntryLine(...)` логику: при `intent` (строка ~189) и `wait` (~195)
    заполнять `program.codeStack = mapStackToFrames({ lineStack: msg.lineStack, lineMap: session.lineMap })`
    **и** `program.currentLine` = последний кадр (или его строка) для обратной совместимости.
  - сбрасывать `program.codeStack = null` (и `currentLine = null`) в `finished` (~202), `error` (~211),
    `timeout` (~251), и в LinkError-ветке (~82).
- Тесты в `CodeBehaviorDriver.test.ts`: при первом `intent` у программы с импортом модуля
  `program.codeStack` содержит ≥2 кадров; при `finished` — `null`. (Образец многомодульного прогона —
  `subprogram-highlight.spec.ts`; в unit можно собрать registry с двумя программами как в существующих хелперах.)

## Шаг 3 — проброс `codeStack` в стор

Файл: `src/shared/store/gameStore.ts`.

- В `DroneState` добавить `codeStack: StackFrame[] | null` (импорт типа из `mapLine`).
- В `snapshotDrones` копировать `codeStack: program.codeStack ?? null` (рядом с `currentLine`, ~строка 186).
- `currentLine` в `DroneState` оставить без изменений (продолжает работать).

## Шаг 4 — браузерная дизайн-сессия (companion) ПЕРЕД версткой UI

Перед написанием UI-кода провести визуальную проверку выбранного макета (горизонтальные крошки)
в реальном редакторе — спека этого требует. Запустить `npm run dev`, открыть DRONE-вкладку с
многомодульной программой, на месте оценить: высоту полосы крошек, разделитель `▸`, поведение при
2–3 кадрах, контраст с темой. При необходимости — скорректировать визуал перед фиксацией. Финальное
решение зафиксировать (кратко) в session-doc.

## Шаг 5 — `CallStackBreadcrumbs` (новый компонент)

Файл: `src/ui/editor/CallStackBreadcrumbs/index.tsx`.

- Принимает: `frames: StackFrame[]`, `selectedIndex: number | null` (выбранный кадр или null = follow),
  `onSelectFrame: (index: number) => void`, и доступ к `registry` (для имени программы кадра через
  `registry.get(frame.programId)?.name`). Внешний кадр (индекс 0) — entry-программа дрона (personal/assigned).
- Рендерит крошки слева→направо: внешний → текущий, разделитель `▸`. Клик по крошке = `onSelectFrame(i)`.
  Активный/самый глубокий кадр визуально выделен; выбранный вручную — другим акцентом.
- Селекторы — `data-testid="callstack-crumb-{i}"`, контейнер `data-testid="callstack-breadcrumbs"`.
- Стиль — в духе существующих monospace-панелей (см. `TAB_BTN`/`BLOCK_STYLE` в ProgramEditor).
- **Forward-compat с этапом B (debug-режим):** полоса крошек НЕ должна занимать всю ширину — оставить
  место справа под будущие debug-контролы (Step into / Step over / Continue этапа B рисуются рядом).
  Структура `StackFrame[]` уже forward-compatible: step-into = follow самого глубокого кадра (дефолт A),
  step-over = показ кадра вызывающей программы (= выбор кадра кликом, уже в A). Менять модель данных под B не нужно.
- **Читаемость:** имя программы кадра вычислять именованной переменной, без вложенных тернарников;
  если логика «активный/выбранный/обычный» стиль ветвится — вынести в хелпер/lookup, не инлайнить тернары.

## Шаг 6 — DRONE-вкладка следует за активным кадром

Файл: `src/ui/editor/ProgramEditor/index.tsx`.

Сейчас в DRONE рендерятся два `ProgramCodeBlock` (assigned + personal) с `highlightLine`, берущимся
только для активной программы дрона. Меняем логику на «follow execution»:

- Локальное состояние вкладки: `const [selectedFrameIndex, setSelectedFrameIndex] = useState<number | null>(null)`
  (null = follow самый глубокий кадр).
- Вычислить **отображаемый кадр**: `displayedFrame = frames[selectedFrameIndex ?? frames.length - 1]`
  (с защитой на пустой стек). Когда выбранный индекс выходит за пределы текущего стека — сбросить в follow
  (через `useEffect` по длине `codeStack`).
- Над блоками кода рендерить `<CallStackBreadcrumbs>` (только когда `drone.codeStack?.length`), прокинуть
  `selectedFrameIndex` / `setSelectedFrameIndex` / `registry`.
- **Какой код показывает редактор:**
  - кадр принадлежит активной программе дрона (assigned/personal) → существующий редактируемый
    `ProgramCodeBlock` этой программы с `highlightLine = displayedFrame.line`.
  - кадр принадлежит **импортированному модулю** → показать **read-only** код этого модуля
    (`registry.get(displayedFrame.programId).behavior.code`) с подсветкой `displayedFrame.line`.
    Read-only режим уже поддержан: `CodeEditor` принимает `readOnly` (`src/ui/editor/CodeEditor/CodeEditor.tsx`).
    Использовать `CodeEditor` напрямую (или вариант `ProgramCodeBlock` без apply) с `readOnly` — НЕ давать
    кнопок apply/revert для модуля.
- **Читаемость (приоритет №1):** вынести выбор «редактируемый блок vs read-only превью модуля» в
  именованные переменные / небольшой под-компонент (напр. `DroneFrameView`), не городить вложенные
  тернарники в JSX. Заменить текущие inline-условия `highlightLine={... ? ... : null}` на предвычисленные
  именованные значения над `return`.

## Шаг 7 — E2E (расширить существующий паттерн)

Файл: новый `e2e/callstack.spec.ts` (или дополнить `subprogram-highlight.spec.ts`).

Образец готов — `subprogram-highlight.spec.ts` уже создаёт программу с импортом модуля, назначает дрону,
запускает и ждёт подсветку. Расширить:
- во время исполнения **внутри модуля** видны крошки с ≥2 кадрами (`callstack-crumb-0`, `callstack-crumb-1`);
- редактор DRONE автоматически показывает код подпрограммы и подсвечивает её строку (`.drone-line-highlight`
  внутри read-only превью модуля);
- клик по внешней крошке (`callstack-crumb-0`) возвращает редактор к коду вызывающей программы.
- Все селекторы — `data-testid` (правило проекта).

---

## Критические файлы

| Файл | Изменение |
|------|-----------|
| `src/game/code/linker/mapLine.ts` | `StackFrame`, `mapStackToFrames`, внутр. `resolveSegment` |
| `src/game/code/linker/mapLine.test.ts` | тесты `mapStackToFrames` |
| `src/game/simulation/components/Program.ts` | поле `codeStack?: StackFrame[] \| null` |
| `src/game/code/CodeBehaviorDriver.ts` | заполнять/сбрасывать `codeStack` |
| `src/game/code/CodeBehaviorDriver.test.ts` | тест `codeStack` |
| `src/shared/store/gameStore.ts` | `DroneState.codeStack` + копирование в `snapshotDrones` |
| `src/ui/editor/CallStackBreadcrumbs/index.tsx` (новый) | хлебные крошки |
| `src/ui/editor/ProgramEditor/index.tsx` | follow execution + выбор кадра + read-only превью модуля |
| `e2e/callstack.spec.ts` (новый) | E2E на стек/подсветку модуля |

**Переиспользуем без изменений логики:** `lineStack`/`__call/__line/__pushCall/__popCall`
(`src/game/code/worker/codeRuntime.ts`), `WorkerMessage.lineStack` (`src/game/code/types.ts`),
`LineMapSegment`/`linkProgram` (`src/game/code/linker/linkProgram.ts`), `CodeEditor`
(`highlightLine`, `readOnly`).

## Readability pass (правило CLAUDE.md — обязательный финальный проход)
Перед сдачей пересканировать собственный diff: нет вложенных тернарников (особенно в JSX
ProgramEditor), именованные промежуточные значения, object-параметры при 3+ аргументах
(`mapStackToFrames`, props компонентов), ветвление стилей крошек — через хелпер/lookup, описательные
имена (никаких `s`, `f`, `idx` как самостоятельных идентификаторов вне тривиальных коллбэков).

## Верификация (end-to-end)
1. `npm run type-check` — зелёный.
2. `npm test` — зелёный (новые unit `mapStackToFrames`, `codeStack` в драйвере; старые `mapLine`/`mapStackToEntryLine` проходят).
3. `npm run test:e2e` — новый `callstack.spec.ts` зелёный.
4. Ручная (`npm run dev`): миссия с импортом модуля → выбрать дрона → Play → во время исполнения
   внутри модуля видны крошки с ≥2 кадрами; редактор DRONE показывает код подпрограммы (read-only) с
   подсветкой строки; клик по внешней крошке возвращает к коду вызывающей программы.

## Документация
- По завершении — session-doc `docs/sessions/2026-06-29-<time>-feat-step-debug-stack-trace.md`:
  цель, результаты, итог дизайн-сессии (Шаг 4).
- Проверить, нужно ли обновить README/доки по итогам (фича вводит debugger-UX) — спека упоминает
  отдельную сессию унификации документации; здесь — только пометить, если что-то очевидно устарело.
- Коммиты по шагам, тип `feat:`, ветка `feat/step-debug-stack-trace` (уже активна).
