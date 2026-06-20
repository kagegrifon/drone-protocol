# Дебаггинг кода: подсветка текущей исполняемой строки

**Статус:** done

> Этап 2 из 2. Строится поверх этапа 1 —
> [drone-tab-assigned-program-editor.md](drone-tab-assigned-program-editor.md)
> (редактор кода назначенной программы на вкладке DRONE).

## Зачем

Когда пользователь пишет код для дрона, непонятно, где находится исполнение:
какую команду дрон выполняет прямо сейчас. Движок исполняет код игрока как
`AsyncFunction` из строки и **не знает номер исполняемой строки** —
в `DroneState` поле `currentInstruction` равно `"-TODO-"`, а `CallFrame.instructionIndex`
всегда `0`.

Цель: при выборе дрона в редакторе Monaco подсвечивается строка кода, на которой
дрон сейчас «завис» (`await drone.mine()`, `await drone.moveTo(x)` и т.п.). Это
даёт пользователю понимание того, как работает его код — первый шаг к дебаггингу.

Scope этого этапа — **только подсветка текущей строки**. Без step-by-step,
breakpoints, замедления и панели сенсоров (возможные следующие этапы).

## Поведение

- Когда выбран дрон и в редакторе на вкладке **DRONE** открыта его **активная**
  программа (персональная либо прикреплённая из library — обе теперь видны как
  редактор благодаря этапу 1), строка текущего действия подсвечивается:
  фон строки + glyph-маркер в gutter.
- Подсветка обновляется на каждом действии дрона по мере исполнения кода.
- Когда дрон не исполняет действие (`idle`/программа завершилась) — подсветки нет.
- Подсветка показывается **только** для программы, которую исполняет выбранный дрон.
  Если в редакторе открыта другая программа (другой id) — подсветки нет.

## Критерии готовности

- Юнит-тесты инструментатора: для типового кода каждый `await drone.<action>()`
  и `await drone.wait()` получает корректный номер строки; вызовы внутри
  комментариев и строковых литералов игнорируются; многострочные вызовы
  привязаны к строке начала вызова; на выходе валидный исполнимый JS.
- В работающей игре: выбор дрона с запущенной программой подсвечивает строку,
  которая меняется по мере исполнения; завершение программы убирает подсветку.
- Подсветка корректна и для персональной, и для назначенной программы.
- `npm test`, `npm run type-check` зелёные.

## Технические заметки

### Поток данных

```
worker: acorn инструментирует код → __line(N) перед каждым await drone.*
worker → intent { ..., line } → CodeBehaviorDriver → program.currentLine
program.currentLine → snapshotDrones → DroneState.currentLine
DroneState.currentLine → ProgramEditor (если открыта активная программа)
                       → CodeEditor highlightLine → Monaco decoration
```

### Изменения по файлам

1. **`src/game/code/worker/instrument.ts`** (новый) — чистая функция
   `instrument(code): string`. Парсит код через `acorn` (`ecmaVersion: 2020`,
   `locations: true`), обходит AST, для каждого `AwaitExpression`, чей аргумент —
   `CallExpression` вида `drone.<moveTo|mine|drop|charge|wait>(...)`, вставляет
   маркер строки `N = node.loc.start.line` (например, оборачиванием в
   `(__line(N), <await-expr>)` через текстовую вставку по offset'ам). Юнит-тесты
   рядом: `instrument.test.ts`.
   - Оставить в коде комментарий о возможном будущем расширении: для step-режима
     тот же обходчик можно инструментировать на каждый statement и вставлять
     `await __step(N)` (пауза на любой строке) вместо синхронного `__line(N)`.
     Сейчас НЕ закладывать параметризацию — реализация минимальна (только
     `await drone.*`).

2. **`src/game/code/worker/codeRuntime.ts`** — переменная `currentLine` и функция
   `__line(n)`, прокинутая дополнительным аргументом в `AsyncFunction` (рядом с
   `drone`, `distance`, `deposit`). `runCode` сначала прогоняет `code` через
   `instrument()`. `sendAction`/`wait` шлют `line: currentLine` в сообщение.

3. **`src/game/code/types.ts`** — `WorkerMessage` варианты `intent` и `wait`
   получают поле `line: number`.

4. **`src/game/code/CodeBehaviorDriver.ts`** — при обработке `intent`/`wait`
   записывает `program.currentLine = msg.line`. При `finished`/`error` —
   `program.currentLine = null`.

5. **`src/game/simulation/components/Program.ts`** — поле
   `currentLine?: number | null` в `ProgramComponent`.

6. **`src/shared/store/gameStore.ts`** — `DroneState` получает
   `currentLine: number | null`; `snapshotDrones` заполняет его из
   `program.currentLine`.

7. **`src/ui/editor/CodeEditor/CodeEditor.tsx`** — новый проп
   `highlightLine?: number | null`. Через `onMount` сохранить `editor` в ref;
   на изменение `highlightLine` рисовать декорацию `isWholeLine` +
   `glyphMarginClassName` через `editor.createDecorationsCollection()` (или
   `deltaDecorations`). Включить `glyphMargin: true` в options. CSS-классы
   подсветки — в тёмной теме проекта.

8. **`src/ui/editor/ProgramEditor/index.tsx`**:
   - Вычислить `activeProgramId = drone.assignedProgramId ?? drone.personalProgramId`.
   - Передавать `highlightLine = drone.currentLine` в `CodeEditor` **только** когда
     редактируемая в этом инстансе программа совпадает с `activeProgramId`
     (и для персональной, и для назначенной — у обеих теперь есть редактор).

### Зависимости

- Добавить `acorn` в `dependencies` (де-факто стандарт; транзитивно уже присутствует
  через Vite/Rollup). Инструментатор работает в worker-окружении — не тянуть туда
  Phaser/React.

### Риски

- Monaco-декорации требуют доступа к инстансу редактора — использовать `onMount`,
  не дёргать API до монтирования.
- Vite Web Worker под HMR ломается с `new Worker(new URL(...))` — изменения
  в worker-коде должны сохранять `?worker`-импорт (см. память `fix_vite_worker_hmr`).
- Инструментация должна давать валидный JS на выходе, иначе компиляция
  `AsyncFunction` упадёт — покрыть тестами на разном синтаксисе.

### Зависит от этапа 1

Подсветка назначенной программы возможна только когда её код виден в редакторе на
вкладке DRONE — это делает этап 1. Без него подсветка работала бы лишь для
персональной программы.
