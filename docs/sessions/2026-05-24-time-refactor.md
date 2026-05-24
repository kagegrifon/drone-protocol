# Сессия: рефакторинг «время в секундах» + per-drone controls

**Дата:** 2026-05-24
**План:** `valiant-riding-cocke.md`

## Цель

Перевести все длительности симуляции с дискретных тиков на секунды (float), добавить per-drone управление (start/pause/reset).

## Результаты

### Фаза 0 — Константы
Создан `src/game/simulation/constants.ts`: `DT=0.1`, `EPSILON=1e-6`, базовые длительности, функции-хелперы с extension point для будущих модификаторов дронов.

### Фаза 1 — WAIT: ticks → seconds
`WAIT.ticks` → `WAIT.seconds` во всех слоях: типы, интерпретатор (`-= DT`, `> EPSILON`), UI, store. Тесты обновлены с `toBeCloseTo`.

### Фаза 2 — MovementSystem
`progress += DT * speed` (speed = клеток/сек, дефолт 1.0). Добавлен допуск `>= 1 - EPSILON` для float. Тесты переписаны: speed=10 для 1 шага/тик, speed=20 для 2 шагов/тик.

### Фаза 3 — MINE и DROP
Time-based с аккумуляторами `mineElapsed` и `dropElapsed` в ProgramComponent. MINE: 20 тиков/руда. DROP: капельный, 5 тиков/руда. EPSILON-допуск в while-условиях.

### Фаза 4 — CHARGE
Аккумулятор `chargeElapsed`. +1 энергии каждые 5 тиков. Пассивная зарядка сохранена.

### Фаза 5 — Локальная пауза + UI
`localPaused?: boolean` в ProgramComponent. Все 4 системы пропускают дронов с флагом. Store: `startDrone` / `pauseDrone` / `resetDrone`. DroneInspector и DroneList получили кнопки ▶/⏸ и ↺. E2E тест `drone-controls.spec.ts`.

### Фаза 6 — StatisticsSystem
`TICKS_PER_SECOND` удалён, `WINDOW_TICKS = Math.round(60 / DT)`, `elapsedSeconds = length * DT`. SimControls показывает `Tick: N (X.Xs)`.

### Фаза 7 — Документация
Этот файл + `docs/features/done/time-in-seconds-and-per-drone-controls.md`.

## Итог

7 коммитов, 135 юнит-тестов зелёные, TypeScript без ошибок. E2E тест создан (не запускался в рамках сессии).
