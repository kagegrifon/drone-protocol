# Code Mode (этап 1): Session 3 — Tasks 10-12 завершены, ядро готово

**Date:** 2026-06-11 09:21
**Branch:** main
**Goal:** Завершить план Code Mode (этап 1) — Tasks 10-12 (тест эквивалентности, drone-api.d.ts, финальная документация)

## Результаты

### Completed

**Task 10: Тест эквивалентности блоки↔код** (commit 2a5824a)
- `src/game/code/equivalence.test.ts` — сценарий `moveTo(ore) → mine()` реализован
  параллельно (а) AST-блоками через `AstBehaviorDriver`/`stepProgram` и (б) JS-кодом через
  `CodeBehaviorDriver`/реальный `NodeWorkerPort`.
- Сравнивается **последовательность переходов** action-`state` (`move`→`mine`→`idle`),
  без учёта количества повторов одного и того же состояния подряд (`actionTransitions`,
  dedupe по соседним одинаковым) — синхронизация воркера занимает разное число
  промежуточных тиков `running`, но порядок переходов идентичен.
- Мелкий фикс типов: `DepositComponent` не имеет поля `oreMax` (только `oreRemaining`,
  `mineRate`) — исправлено в тесте.

**Task 11: `drone-api.d.ts`** (commit 8d59115)
- `src/game/code/drone-api.d.ts` — типовой контракт `DroneApi` (`self`, `energy`,
  `energyMax`, `inventory`, `inventoryMax`, `freeSlots`, `moveTo`/`mine`/`drop`/`charge`/`wait`)
  + глобальные `distance()`/`deposit()`. Файл превращён в модуль (`export {}`), чтобы не
  утекать глобальные имена в проект. `type-check` зелёный.

**Task 12: Финальная проверка и документация**
- `npm test` → **241/241 passed** (26 файлов, было 240/25 — добавился equivalence.test.ts)
- `npm run type-check` → чисто
- `DECISIONS.md` — добавлена вторая запись `[10-06-2026]` с деталями реализации
  (`BehaviorDriver`/`AstBehaviorDriver`/`CodeBehaviorDriver`, протокол сообщений,
  `CodeWorkerPort`/`tsx`+`worker_threads`, `SensorsSnapshot`, временное поле
  `program.codeSource`).
- `docs/features/planned/drone-code-mode-core.md` — критерии готовности обновлены
  (5 из 7 отмечены как выполнены; критерий "тип `DroneBehavior` + миграция реестра/gameStore"
  отмечен частично: тип добавлен additive, миграция реестра — отдельная будущая задача).
  Файл **остался в `planned/`**, статус явно описывает текущее состояние ("ядро реализовано;
  миграция реестра — отдельная будущая задача").
- `docs/features/index.md` — статус строки `drone-code-mode-core.md` обновлён.

### Почему фича осталась в `planned/`, а не переехала в `done/`
По плану (Task 12, Step 3): переносить файл в `done/` только если **все** критерии
выполнены буквально. Критерий 1 требует не только тип `DroneBehavior`, но и миграцию
`ProgramRegistry`/`gameStore` на него — это явно вынесено в отдельную будущую задачу
(затрагивает ~14 файлов: миссии, UI редактор, рендерер, store), отдельно от Monaco (этап 2).
Поэтому фича остаётся в `planned/` с уточнённым статусом до этой миграции (или решения
отложить её насовсем).

### Commits сессии
```
2a5824a test: добавить тест эквивалентности трассы state блоки vs код (Phase 1)
8d59115 docs: добавить drone-api.d.ts — типовой контракт Code Mode API (Phase 1)
<этот коммит> docs: зафиксировать реализацию ядра Code Mode и обновить статус фичи (Phase 1)
```

## Что дальше

Ядро Code Mode (этап 1) завершено: `BehaviorDriver`/`AstBehaviorDriver`/`CodeBehaviorDriver`,
worker-протокол, сенсоры, эквивалентность блоки↔код, типовой контракт API — всё на месте и
покрыто тестами.

Возможные следующие шаги (отдельные сессии):
1. **Этап 2 — Monaco**: редактор кода, тумблер код/блоки в настройках (см.
   `docs/features/planned/drone-code-mode-monaco.md`).
2. **Миграция реестра на `DroneBehavior`**: заменить `program.codeSource`/`.instructions`
   на `behavior: DroneBehavior` во всех ~14 местах (миссии, UI редактор, рендерер,
   `gameStore`). Возможно, имеет смысл делать вместе с Monaco, т.к. UI всё равно меняется.

## Метрики сессии
- Контекст: продолжение сессии после компактирования, без отдельных метрик токенов в этой сессии.
