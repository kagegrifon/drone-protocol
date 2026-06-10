# Code Mode Core Phase 1: Tasks 4–7 — Рантайм и инфраструктура портов

**Дата:** 2026-06-10, ~14:30–19:30 UTC  
**Метод:** superpowers:subagent-driven-development (implementer → spec-review → code-quality-review за каждую задачу)  
**Результат:** ✅ Tasks 4–7 завершены и закоммичены

---

## Результаты

### Task 4: codeRuntime — исполнение кода игрока через AsyncFunction
**Коммит:** `ee7193b`

- ✅ `src/game/code/worker/codeRuntime.ts` — `runCode(start, post, onDriverMessage): Promise<void>`
- ✅ `src/game/code/worker/codeRuntime.test.ts` — 5 тестов (intent/resume round-trip, синхронные сенсоры, error на throw, wait-сообщение, distance/deposit)
- ✅ Все тесты pass, type-check clean, полный набор pass (233 тесты)

**Замечания:**
- Code-quality reviewer отметил потенциальную race на `resume` до регистрации `awaitResume()`, но протокол гарантирует, что это невозможно (request-response упорядоченность в `CodeBehaviorDriver`)
- Minor issues (comment на AsyncFunction конструктор, edge cases, no-double-start guard) залогированы как tech debt, не блокирующие

---

### Task 5: Worker entry-точки и CodeWorkerPort (Node + Browser)
**Коммит:** `2c57c1e` (изначально `3ccac10`, затем amended после fix terminate race)

**Новые файлы:**
- ✅ `src/game/code/worker/nodeWorkerEntry.ts` — entry для `node:worker_threads`
- ✅ `src/game/code/worker/browserWorkerEntry.ts` — entry для браузерного `Worker`
- ✅ `src/game/code/worker/NodeWorkerPort.ts` — `CodeWorkerPort` поверх `node:worker_threads`
- ✅ `src/game/code/worker/BrowserWorkerPort.ts` — `CodeWorkerPort` поверх `Worker`
- ✅ `src/game/code/worker/nodeWorkerBootstrap.mjs` — **НЕ в плане** (workaround для `--import tsx` limitation)
- ✅ `src/game/code/worker/NodeWorkerPort.test.ts` — round-trip тест через реальный воркер
- ✅ devDependency `tsx@^4.22.4` добавлен

**Деталь реализации (отклонение от плана):**
- **План предполагал:** `new Worker(ENTRY_PATH, {execArgv: ["--import", "tsx"]})` запустит `.ts` воркер
- **Реальность:** `--import` register hooks не пропагируются в worker threads (Node.js limitation)
- **Решение:** `nodeWorkerBootstrap.mjs` (plain JS) вызывает `register()` из `tsx/esm/api` _внутри_ worker thread, затем динамически импортирует `nodeWorkerEntry.ts`
- `NodeWorkerPort` буферизует `postMessage` до события `"online"`, с защитой от `terminate()`-до-online race (code-quality fix)

**Ревью обнаружило:**
- Spec compliant (деviations документированы как necessary workarounds, не overengineering)
- Approved (с one Important issue про terminate race, который был fixed)

---

### Task 6: Рефакторинг interpreter.ts — выделить planAstarMove
**Коммит:** `8f06289`

- ✅ Экспортирована `planAstarMove(droneId, targetEntityId, world, grid, occupied): void`
- ✅ `MOVE_TO` case теперь использует эту функцию (поведение идентично, 1:1 extraction)
- ✅ Все 36 тестов `interpreter.test.ts` остались зелёными (no test changes required)
- ✅ type-check clean, полный suite pass

**Качество:** Textbook pure extraction, одобрено на spec + code-quality review

---

### Task 7: collectSensors — снапшот сенсоров дрона
**Коммит:** `3139bc4`

- ✅ `src/game/code/sensors.ts` — `collectSensors(world, droneId, entities): SensorsSnapshot`
- ✅ `src/game/code/sensors.test.ts` — 2 теста (full snapshot, freeSlots=0 fallback)
- ✅ Все тесты pass, type-check clean, полный suite pass

**Деталь (план содержал неточности в формах компонентов):**
- **План test указывал:** `WorkSlots: { capacity, occupied }` и `Deposit: { oreRemaining, oreMax }`
- **Реальность:** `WorkSlots: { slots: WorkSlot[] }` (где `WorkSlot = { x, y, occupiedBy }`), `Deposit: { oreRemaining, mineRate }`
- **Решение:** Implementer проверил реальные component shapes, адаптировал test + implementation
- `freeSlots` = `freeSlotsCount(world, droneId)` если drone имеет WorkSlots компонент, иначе 0

---

## Ключевые находки и tech debt

### 1. **Реальные shapes компонентов отличаются от черновика плана**
Все найденные divergences:
- `DepositComponent` — нет поля `oreMax` (только `oreRemaining`)
- `WorkSlotsComponent` — структура полностью другая (`slots[]` vs `capacity/occupied`)

**Action для следующей сессии (Task 8–12):** При конструировании тестовых компонентов использовать **реальные** shapes из `src/game/simulation/components/`, не шаблоны из плана.

### 2. **Node.js + tsx + worker_threads limitation**
`--import` register hooks не работают с `worker_threads` — требуется programmatic `register()` внутри worker thread.

**Action:** Если будущие задачи трогают worker-инфраструктуру, помнить про `nodeWorkerBootstrap.mjs` и этот workaround.

### 3. **Terminate-before-online race in NodeWorkerPort**
Было: `terminate()` не очищал pending queue и не гардил `once("online", ...)` callback.  
Фиксировано: гард на `terminated` flag, очистка queue.

**Action:** Хотя исправлено, помнить про это при любых изменениях lifecycle-логики портов.

---

## Статус Phase 1

| Task | Статус | Коммит |
|------|--------|--------|
| 1–3 | ✅ Done | 5ce9ff0, 84e726e |
| 4 | ✅ Done | ee7193b |
| 5 | ✅ Done | 2c57c1e |
| 6 | ✅ Done | 8f06289 |
| 7 | ✅ Done | 3139bc4 |
| 8 | 🔲 TODO | — |
| 9 | 🔲 TODO | — |
| 10 | 🔲 TODO | — |
| 11 | 🔲 TODO | — |
| 12 | 🔲 TODO | — |

**Осталось:** Tasks 8–12 (CodeBehaviorDriver — самая большая, затем driver-выбор, equivalence-тест, drone-api.d.ts, финальная документация и DECISIONS.md).

---

## Стартовый промпт для следующей сессии

```
Продолжаем реализацию **Code Mode (этап 1)** — ядра исполнения JS-кода дронов через Web Worker.

**Прогресс:** Tasks 1-7 выполнены и закоммичены (последний — `3139bc4`, "feat: добавить collectSensors").

**Осталось:** Tasks 8-12 (CodeBehaviorDriver, выбор driver в ProgramExecutionSystem, тест эквивалентности, drone-api.d.ts, документация).

## Ссылки на материалы

- **План:** `docs/superpowers/plans/2026-06-10-drone-code-mode-core.md`
- **Спецификация:** `docs/superpowers/specs/2026-06-10-drone-code-mode-design.md`
- **Feature doc:** `docs/features/planned/drone-code-mode-core.md`

## Процесс

Используй **superpowers:subagent-driven-development**: fresh-субагент на каждую задачу (implementer → spec-review → code-quality-review).

## ВАЖНО: План содержит неточности в формах компонентов!

При конструировании тестовых компонентов (особенно в Task 8) используй РЕАЛЬНЫЕ shapes:

- `EnergyComponent`: `{ current, max, drainPerMove, drainPerMine }`
- `InventoryComponent`: `{ ore, capacity }`
- `DepositComponent`: `{ oreRemaining, mineRate }` — **БЕЗ `oreMax`**
- `WorkSlotsComponent`: `{ slots: WorkSlot[] }` где `WorkSlot = { x, y, occupiedBy: EntityId | null }`
- Helper: `freeSlotsCount(world, entityId)` в `src/game/simulation/world/workSlots.ts`

`collectSensors` (Task 7, готов в `src/game/code/sensors.ts`) использует эти реальные shapes.

## Task 8 (CodeBehaviorDriver) — следующая задача, самая большая

Самая сложная задача плана. Driver держит per-drone worker-сессию, управляет фазами (idle → action-pending → waiting → done), обрабатывает таймауты синхронного участка, добавляет временные поля `codeSource`/`codeError` в `Program` компонент. 4 теста (mine→state, resume→next await, timeout на `while(true){}`, детерминизм).

После Task 8: продолжай с Tasks 9–12 последовательно без пауз для пользователя.
```

---

Спасибо за внимание и поддержку! Четыре задачи инфраструктуры готовы, основной driver (Task 8) ждёт в следующей сессии. 🚀

## Метрики сессии
- Модель: claude-haiku-4-5-20251001
- Input: 138 токенов (кеш: 6,659,401 / запись в кеш: 489,056)
- Output: 73,578 токенов
- Контекст: 114,575 / 200,000 токенов (57.3%)
- Стоимость: $4.936
