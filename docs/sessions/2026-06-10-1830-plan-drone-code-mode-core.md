# Сессия: План реализации Code Mode Phase 1

**Дата:** 2026-06-10 18:30  
**Фаза:** planning  
**Эпик:** Drone Loop — Code Mode (этап 1, ядро без Monaco)

## Цель

Спроектировать и написать детальный implementation plan для этапа 1 фичи Code Mode: ядро исполнения JS/TS-кода дронов через Web Worker (браузер) / worker_threads (Vitest), без Monaco-редактора. План должен быть готов к выполнению субагентом или inline-исполнением с TDD по каждой задаче.

## Контекст

- Спецификация: [2026-06-10-drone-code-mode-design.md](../../superpowers/specs/2026-06-10-drone-code-mode-design.md)
- Фича: [drone-code-mode-core.md](../../features/planned/drone-code-mode-core.md)
- Архитектура: behavior-driver-интерфейс, единая модель намерений (program.state)
- Аудитория: фронтендеры, обучение через async/await-код вместо блоков

## Результаты

### Разработано

1. **Файловая структура** (12 новых файлов + изменения в 4 существующих)
   - `src/game/code/` — новая директория для code-режима
   - worker entry-точки: `nodeWorkerEntry.ts` (worker_threads), `browserWorkerEntry.ts` (Web Worker)
   - runtime & ports: `codeRuntime.ts`, `CodeWorkerPort.ts`, `NodeWorkerPort.ts`, `BrowserWorkerPort.ts`
   - drivers: `BehaviorDriver.ts`, `AstBehaviorDriver.ts`, `CodeBehaviorDriver.ts`
   - helpers: `types.ts`, `sensors.ts`, `drone-api.d.ts`

2. **План на 12 задач, готовый к выполнению**
   - Каждая задача: TDD (падающий тест → реализация → прохождение), явные команды
   - Код полностью показан в каждом шаге (нет "TBD", "add error handling")
   - Проверены все типовые ошибки (placeholders, нечитаемые шаги, пропуски)
   - Архитектурные решения обоснованы в Task 5-9 (Worker-порт, tsx vs --experimental-strip-types, protocol design)

3. **Архитектурные решения**
   - **DroneBehavior тип**: additive в types.ts (Task 1), полная миграция реестра вынесена в будущую задачу
   - **BehaviorDriver интерфейс**: единый контракт для AST & Code веток (Task 2)
   - **CodeWorkerPort**: абстракция над браузерным Worker и node:worker_threads, переиспользуемая в тестах и проде (Tasks 5,7)
   - **codeRuntime**: общая логика исполнения AsyncFunction, работает в любом контексте (Task 4)
   - **Протокол**: intent/wait/finished/error от воркера, start/resume от driver'а; drone.wait() обрабатывается драйвером (не требует воркера каждый тик)
   - **Таймаут**: setTimeout + port.terminate() в driver'е ловит while(true){} без await (Task 8)
   - **Сенсоры**: collectSensors снимает снапшот на начало тика для консистентности (Task 7)

4. **Покрытие критериев готовности**
   - ✅ Тип DroneBehavior (additive, полная миграция отложена)
   - ✅ CodeBehaviorDriver + Web Worker + async-API (Tasks 4,5,8)
   - ✅ ProgramExecutionSystem выбирает driver (Task 9)
   - ✅ Unit-тесты: await drone.moveTo → state=move, промис резолвится, таймаут, детерминизм (Task 8)
   - ✅ Эквивалентность блоки↔код (Task 10)
   - ✅ npm test / npm run type-check (Task 12)
   - ✅ DECISIONS.md обновлён (Task 12)

## Технические решения

### Worker-порт + tsx для Node
Выбран вариант Worker-абстракции + tsx для исполнения `.ts` worker-файлов в node:worker_threads:
- Pro: реальная изоляция в тестах, как в проде; использует валидный ESM/Node API
- Con: зависимость tsx (но small, dev-only)
- Alternative (отвергнута): eval-worker — менее идиоматично

### Временные поля program.codeSource/codeError
- Этап 1 использует additive-поля в ProgramComponent
- Полная интеграция с DroneBehavior.source на уровне реестра (затрагивает 14 файлов) — отдельная будущая задача после Monaco
- Явно зафиксировано в шапке плана и DECISIONS.md

### planAstarMove — минимальный рефакторинг
- Выделена общая функция из MOVE_TO в interpreter.ts
- Переиспользуется CodeBehaviorDriver и AstBehaviorDriver (через stepProgram)
- Существующие тесты interpreter остаются зелёными — поведение не изменилось

## Что дальше

План сохранён в [docs/superpowers/plans/2026-06-10-drone-code-mode-core.md](../../superpowers/plans/2026-06-10-drone-code-mode-core.md).

Два варианта продолжения:
1. **Subagent-Driven** — свежий субагент на каждую задачу (или группу из 2-3), ревью между ними
2. **Inline Execution** — выполнение в одной сессии через executing-plans с чекпоинтами

Рекомендуется subagent-driven для параллелизма и изоляции (независимые git commits, review между задачами).

## Нюансы и потенциальные проблемы

1. **Worker entry-points**: `browserWorkerEntry.ts` не подключается в Vitest (environment: node), тестируется только `NodeWorkerPort`. Это ожидаемо — браузерная версия проверяется E2E в этапе 2 (Monaco).

2. **Таймаут в реальном воркере**: NodeWorkerPort.test.ts ждёт реального таймаута (100-200ms на старт воркера + синхронное выполнение кода). Это интеграционный тест, может быть медленным на медленных машинах — допустимо для unit-suite.

3. **Асинхронность воркера в step()**: ProgramExecutionSystem вызывает step() синхронно каждый тик, а воркер отправляет сообщения асинхронно (event loop). Это решено буфером в session.pending — worker-сообщение может прийти в any тик, driver просто проверяет буфер. Несколько "пустых" тиков ожидания (state='running' без действия) — нормально и быстро (микротаски обычно 0-1 тик).

## Файлы, изменённые в этой сессии

```
docs/superpowers/plans/2026-06-10-drone-code-mode-core.md (новый, план на 12 задач)
docs/sessions/2026-06-10-1830-plan-drone-code-mode-core.md (эта запись)
```

Коммит плана: предстоит (`git add` поставлен, ждёт commit в следующей сессии или вручную).

## Метрики сессии
- Модель: claude-haiku-4-5-20251001
- Input: 153 токенов (кеш: 5,002,133 / запись в кеш: 326,851)
- Output: 106,912 токенов
- Контекст: 99,348 / 200,000 токенов (49.7%)
- Стоимость: $4.330
