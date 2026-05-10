# Drone Loop — Прогресс реализации

## Статус: Фаза 9 завершена, Фаза 10 — следующая

---

## Фазы реализации

| #  | Фаза                                                              | Статус        | Заметки |
|----|-------------------------------------------------------------------|---------------|---------|
| 0  | Инициализация проекта (Vite + TS + React + Phaser 3)              | ✅ Завершена  |         |
| 1  | ECS ядро и shared types (World, компоненты)                       | ✅ Завершена  |         |
| 2  | Сетка 20×20 и фабрики сущностей (Base, Mine, Charger, Drone)      | ✅ Завершена  |         |
| 3  | A* pathfinding и CollisionSystem                                  | ✅ Завершена  |         |
| 4  | Игровые системы симуляции (Movement, Mining, Energy, Statistics)  | ✅ Завершена  |         |
| 5  | Система программ (types, interpreter, ProgramExecutionSystem)     | ✅ Завершена  |         |
| 6  | Phaser 3 рендеринг (карта, дроны, эффекты, камера)               | ✅ Завершена  |         |
| 7  | React UI (ProgramEditor, DroneInspector, StatsPanel, Zustand)     | ✅ Завершена  |         |
| 8  | Игровой цикл и интеграция (GameLoop, GameController, win/fail)    | ✅ Завершена  |         |
| 9  | Миссии (4 обучающих миссии)                                       | ✅ Завершена  |         |
| 10 | Аудио и полировка (звук, частицы, эффекты, баланс)               | ⬜ Не начата  |         |

**Легенда:** ⬜ Не начата · 🔄 В процессе · ✅ Завершена

---

## Текущая точка входа

**Начинать с:** Фаза 10 — Аудио и полировка

---

## Детали по фазам

### Фаза 0 — Инициализация проекта
- [x] `npm create vite` с шаблоном `react-ts`
- [x] Установить зависимости: `phaser`, `zustand`
- [x] Настроить `tsconfig.json` (strict mode)
- [x] Создать структуру папок: `src/game/simulation/`, `src/game/pathfinding/`, `src/game/programs/`, `src/renderer/`, `src/ui/`, `src/shared/`
- [x] Создать `.gitignore` (node_modules, dist, .env)
- [x] Заглушки `src/main.tsx`, `src/App.tsx`

### Фаза 1 — ECS ядро и shared types
- [x] `src/shared/types/index.ts` — `EntityId`, базовые типы
- [x] `src/game/simulation/world/World.ts` — класс `World`: `createEntity`, `destroyEntity`, `addComponent`, `removeComponent`, `getComponent`, `hasComponent`, `query`; инвертированный индекс по имени компонента
- [x] `src/game/simulation/components/Position.ts` — `{ x: number; y: number }`
- [x] `src/game/simulation/components/Energy.ts` — `{ current, max, drainPerMove, drainPerMine }`
- [x] `src/game/simulation/components/Inventory.ts` — `{ ore, capacity }`
- [x] `src/game/simulation/components/Program.ts` — `{ currentProgramId, callStack: CallFrame[], state, commandSlots }`
- [x] `src/game/simulation/components/Movement.ts` — `{ targetX, targetY, path, progress, speed }`
- [x] `src/game/simulation/components/Renderable.ts` — `{ spriteType, visible, tint }`
- [x] `src/game/simulation/components/Deposit.ts` — `{ oreRemaining, mineRate }`
- [x] `src/game/simulation/components/ChargerStation.ts` — `{ chargeRate }`
- [x] TypeScript strict — ошибок нет

### Фаза 2 — Сетка и фабрики сущностей
- [x] `src/game/simulation/world/Grid.ts` — `Grid` 20×20: `getTile`, `setTile`, `isWalkable`, `neighbours` (4 направления)
- [x] `src/shared/constants/cellTypes.ts` — `empty | wall | mine | base | charger`
- [x] `src/game/simulation/entities/createDrone.ts` — Position + Energy(100/100, drain 1/move, 2/mine) + Inventory(cap 10) + Program(4 slots) + Movement + Renderable
- [x] `src/game/simulation/entities/createBase.ts` — Position + Inventory(cap 99999) + Renderable
- [x] `src/game/simulation/entities/createMine.ts` — Position + Deposit(200 ore, rate 1) + Renderable
- [x] `src/game/simulation/entities/createCharger.ts` — Position + ChargerStation(rate 10) + Renderable
- [x] TypeScript strict — ошибок нет

### Фаза 3 — A* и система столкновений
- [x] `src/game/pathfinding/astar.ts` — A*, Manhattan heuristic, `occupied: Set<string>` для обхода занятых клеток, lazy path-computation
- [x] `src/game/simulation/systems/CollisionSystem.ts` — snapshot целочисленных позиций дронов (вызывается до ProgramExecutionSystem)
- [x] TypeScript strict — ошибок нет

### Фаза 4 — Игровые системы симуляции
- [x] `src/game/simulation/systems/MovementSystem.ts` — движение по A*-пути, дренаж энергии per step (при входе в клетку), resume программы по прибытии
- [x] `src/game/simulation/systems/MiningSystem.ts` — добыча руды тик-за-тиком + мгновенный DROP через пространственное обнаружение по позиции
- [x] `src/game/simulation/systems/EnergySystem.ts` — зарядка тик-за-тиком при нахождении на ChargerStation
- [x] `src/game/simulation/systems/StatisticsSystem.ts` — ore/min (скользящее среднее 60s), idle time, congestion, efficiency
- [x] Порядок систем задокументирован: `Collision → ProgramExecution → Movement → Mining → Energy → Statistics`
- [x] TypeScript strict — ошибок нет

### Фаза 5 — Система программ
- [x] `src/game/programs/types.ts` — `ActionBlock` (MOVE_TO, MINE, DROP, CHARGE, WAIT), `ConditionBlock` (IF + Condition), `FlowBlock` (LOOP, REPEAT, RUN_PROGRAM), `ProgramDef`, `ProgramRegistry`
- [x] `src/game/programs/interpreter.ts` — `stepProgram(droneId, world, registry, grid, occupied)`: стековый интерпретатор; REPEAT = перезапуск фрейма; RUN_PROGRAM = push нового фрейма; WAIT = `CallFrame.waitRemaining`; IF = push then/else inline-фрейма
- [x] `src/game/programs/index.ts` — реэкспорт
- [x] `src/game/simulation/systems/ProgramExecutionSystem.ts` — вызывает `stepProgram` для всех running-дронов; получает `occupied` из `CollisionSystem`
- [x] CallFrame дополнен `isLoop?: boolean` и `inlineInstructions?: readonly unknown[]` для LOOP/REPEAT тел
- [x] 30 новых тестов по TDD (RED→GREEN); итого 77 тестов — все проходят
- [x] TypeScript strict — ошибок нет

### Фаза 6 — Phaser 3 рендеринг
- [x] `src/renderer/config.ts` — TILE_SIZE, GRID_SIZE, цветовая палитра
- [x] `src/renderer/scenes/BootScene.ts` — программные текстуры сущностей (drone, base, mine, charger)
- [x] `src/renderer/scenes/GameScene.ts` — основная сцена: рендер карты, дронов, следов, управление спрайтами
- [x] `src/renderer/GameRenderer.ts` — инициализация `Phaser.Game`, передача World+Grid через registry
- [x] `src/renderer/sprites/DroneSprite.ts` — Container: тело дрона + мигающий Arc + история следа
- [x] Рендер тайлов карты (Phaser.GameObjects.Graphics, программная отрисовка)
- [x] Camera: pan (drag) + zoom (scroll wheel, 0.4×–2.5×)
- [x] Базовые эффекты: glow-кольца, мигающие огни (Tween), следы дронов
- [x] Phaser **только наблюдает** состояние симуляции — не изменяет его
- [x] Интерполяция позиций дронов между тиками (movement.progress 0–1)
- [x] TypeScript strict — ошибок нет

### Фаза 7 — React UI
- [x] `src/shared/store/gameStore.ts` — Zustand store: мост симуляция ↔ UI, обновление раз в 100ms
- [x] `src/ui/editor/ProgramEditor/index.tsx` — список инструкций, add/remove, редактирование условий, назначение программ
- [x] `src/ui/editor/ProgramEditor/InstructionBlock.tsx` — рекурсивный компонент с иконками
- [x] `src/ui/panels/DroneInspector/index.tsx` — energy, inventory, current task, current program
- [x] `src/ui/panels/StatsPanel/index.tsx` — throughput, congestion, efficiency
- [x] `src/ui/panels/DroneList.tsx` — список дронов с цветовым статусом
- [x] `src/ui/controls/SimControls.tsx` — Play/Pause/Step + счётчик тиков
- [x] `src/App.tsx` — layout: Phaser canvas слева + sidebar справа, sci-fi terminal стиль
- [x] Можно редактировать программы через UI и назначать дрону

### Фаза 8 — Игровой цикл и интеграция
- [x] `src/game/GameLoop.ts` — фиксированный timestep 10 ticks/sec, порядок вызова систем
- [x] `src/game/GameController.ts` — оркестратор: симуляция ↔ Phaser ↔ Zustand
- [x] Win condition: добыто N ore / достигнута target efficiency
- [x] Fail condition: время вышло / throughput слишком низкий
- [x] Полный цикл добычи работает end-to-end

**Refinement points — проверить после интеграции с Фазой 8:**
- [x] Проверить интерполяцию
- [x] Проверить синхронизацию
- [x] Проверить производительность
- [x] Доработать следы и glow

### Фаза 9 — Миссии
- [x] `src/game/missions/types.ts` — `MissionDef`, `SceneResult`
- [x] `src/game/missions/mission1.ts` — 1 дрон без программы, win: 50 ore, без зарядника
- [x] `src/game/missions/mission2.ts` — 1 дрон без программы, win: 80 ore, зарядник есть
- [x] `src/game/missions/mission3.ts` — 2 дрона с неэффективными программами (одна шахта), win: 200 ore
- [x] `src/game/missions/mission4.ts` — 2 дрона без зарядки в программах, win: ore_per_min >= 8
- [x] `src/game/missions/index.ts` — `ALL_MISSIONS: MissionDef[]`
- [x] Win condition `ore_per_min` добавлен в `types.ts` и `checkWin`
- [x] `GameController` рефакторен: принимает `MissionDef`
- [x] `src/ui/overlays/MissionSelectOverlay.tsx` — выбор миссии
- [x] `src/ui/panels/MissionGoalPanel.tsx` — прогресс к цели
- [x] `src/ui/overlays/GameStatusOverlay.tsx` — кнопка «Следующая миссия»
- [x] `src/App.tsx` — управляет `selectedMissionIndex`, переключение миссий

### Фаза 10 — Аудио и полировка
- [ ] Phaser Sound Manager: ambient музыка (loop), mining clicks, servo sounds, drone hum, electric buzz
- [ ] Phaser Particles: dust, fog, ambient particles
- [ ] Полировка эффектов: glow, light trails, idle animation дронов
- [ ] Финальный баланс: энергия (drain, max), скорость дронов, запасы шахт, rate зарядки
- [ ] Игра атмосферна и приятна для наблюдения
- [ ] Звуки не раздражают (нет агрессивных алертов, хаотичного микса)

---

## Ключевые архитектурные решения

- **Simulation Layer** (`src/game/simulation/`) — чистая логика, **никогда не импортирует Phaser**
- **ECS**: самописный, без библиотеки — компоненты в `Map<EntityId, Map<ComponentName, Component>>`
- **Программы**: стек вызовов `callStack` для `RUN_PROGRAM`; `REPEAT` = перезапуск текущего фрейма
- **Тик**: фиксированный 10 ticks/sec; рендеринг Phaser независим (60fps), интерполирует между тиками
- **Pathfinding**: A* с `occupied: Set<string>` занятых дронами клеток
- **WAIT**: счётчик `waitRemaining` хранится в `CallFrame`
- **MOVE_TO**: принимает `entityId` конкретного объекта; "ближайший" — будущий разблокируемый апгрейд
- **Коллизии**: CollisionSystem снимает snapshot до ProgramExecutionSystem; A* получает `occupied` без стартовой клетки
- **MINE/DROP**: пространственное обнаружение (по позиции), не маркер-компонент
- **Дренаж энергии**: per step при входе в клетку, не per tick
- **UI bridge**: Zustand store, обновление раз в 100ms
- **Порядок систем**: `Collision → ProgramExecution → Movement → Mining → Energy → Statistics`

---

*Обновляй этот файл при завершении каждой задачи или фазы.*
