# Code Mode Core — Tasks 1-3 (подготовка инфраструктуры)

**Дата:** 2026-06-10 ~19:00  
**Статус:** завершено (tasks 1-3)  
**Участники:** Claude Sonnet 4.6 (subagent-driven-development)

## Цель

Реализовать Tasks 1-3 из плана `docs/superpowers/plans/2026-06-10-drone-code-mode-core.md`:
- добавить тип `DroneBehavior` (дискриминированное объединение)
- создать интерфейс `BehaviorDriver` и обёртку `AstBehaviorDriver`
- создать протокольные типы и интерфейс `CodeWorkerPort`

## Результаты

### Task 1: Тип DroneBehavior (additive)
**Коммит:** `3d7d30b` — `feat: добавить тип DroneBehavior (Phase 1)`

- Добавлен тип в `src/game/programs/types.ts`:
  ```ts
  export type DroneBehavior =
    | { source: "block"; instructions: Instruction[] }
    | { source: "code"; code: string };
  ```
- type-check ✅
- Additive-изменение, ничего не ломает

### Task 2: BehaviorDriver и AstBehaviorDriver
**Коммит:** `84e726e` — `feat: добавить интерфейс BehaviorDriver и AstBehaviorDriver (Phase 1)`

**Файлы:**
- `src/game/code/BehaviorDriver.ts` — интерфейсы `BehaviorTickContext` (world, grid, registry, occupied) и `BehaviorDriver` (step, optional dispose)
- `src/game/code/AstBehaviorDriver.ts` — тонкая обёртка над `stepProgram`, делегирует всё в существующую логику
- `src/game/code/AstBehaviorDriver.test.ts` — два TDD-теста (MINE → state=mine; empty → idle)

**Результаты:**
- 227/227 тестов проходят (full suite)
- type-check ✅
- spec-review ✅ (полное соответствие плану, дополнительных файлов нет)
- code-quality ✅ (простые интерфейсы, чистая делегация)

### Task 3: Протокольные типы и CodeWorkerPort
**Коммит:** `5ce9ff0` — `feat: добавить протокольные типы и CodeWorkerPort (Phase 1)`

**Файлы:**
- `src/game/code/types.ts` — типы `SensorsSnapshot` (снапшот сенсоров), `CodeAction` (moveTo/mine/drop/charge), `WorkerMessage` (intent/wait/finished/error), `DriverMessage` (start/resume)
- `src/game/code/CodeWorkerPort.ts` — интерфейс `CodeWorkerPort` (postMessage, onMessage, onError, terminate)

**Результаты:**
- type-check ✅
- Чисто типовые файлы без рантайма (как и планировалось)

## Ключевые нюансы для продолжения (Tasks 4-12)

1. **`EntityId`** — это `number` (src/shared/types/index.ts), хорошо работает как ключ Record.

2. **Структура `src/game/code/`** уже создана, следующие задачи добавляют сюда файлы.

3. **Step 6 (refactor interpreter.ts)** зависит от Task 4-5: нужно понимать, как `codeRuntime` работает, чтобы выделить `planAstarMove` правильно. Пока что Task 6 можно начинать только после Task 4-5 зелёных.

4. **Task 5** (worker-порты) требует `npm install -D tsx`:
   - `NodeWorkerPort` использует `node:worker_threads` + `--import tsx` в execArgv
   - `BrowserWorkerPort` использует браузерный `Worker`
   - Оба запускают один и тот же `codeRuntime` (из Task 4)
   - Task 5 включает реальный воркер-тест (`NodeWorkerPort.test.ts`), требует ожидания инициализации воркера

5. **Task 8** (CodeBehaviorDriver) — большая, с 4 тестами и complex состояниями (idle → action-pending → waiting → done):
   - `phase` машина состояний в session
   - Таймаут через `setTimeout` в driver (не в воркере!)
   - `drone.wait(seconds)` обрабатывается сторонe driver, без хода в воркер

6. **Program component** (src/game/simulation/components/Program.ts):
   - Task 8 Step 2 добавляет временные поля: `codeSource?: string` и `codeError?: string`
   - Это additive, не трогает существующие поля
   - После этапа 2 (Monaco) полная миграция на `DroneBehavior.source` потребует миграции всех 14 файлов

7. **Субагентов стоит использовать с Task 4 и далее:**
   - Task 4 (codeRuntime.test.ts с 5 тестами) — general-purpose с TDD
   - Task 5 (4 новых файла, npm install) — general-purpose
   - Tasks 6-7 — simpler, но type-check важен
   - Task 8 — большая, spec-compliance + code-quality ревью обязательны
   - Task 9 — маленькая (изменение + тест в существующем файле)
   - Task 10-11 — маленькие типовые
   - Task 12 — документация + коммит

## Что дальше

Новая сессия:
1. Прочитай план (Task 4 onwards)
2. `npm install -D tsx` перед Task 5
3. Выполняй Tasks 4-12 через subagent-driven-development (implementer → spec-review → code-quality-review)
4. По завершении Task 12: обнови docs/features/index.md, переместь feature-doc в done/, запиши финальную сессию

**Git state:** main, чистый working tree, 4 коммита впереди origin/main
