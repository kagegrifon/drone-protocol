# Drone Loop — Прогресс реализации

## Статус: Фаза 2 завершена, Фаза 3 — следующая

---

## Фазы реализации

| #  | Фаза                                                              | Статус        | Заметки |
|----|-------------------------------------------------------------------|---------------|---------|
| 0  | Инициализация проекта (Vite + TS + React + Phaser 3)              | ✅ Завершена  |         |
| 1  | ECS ядро и shared types (World, компоненты)                       | ✅ Завершена  |         |
| 2  | Сетка 20×20 и фабрики сущностей (Base, Mine, Charger, Drone)      | ✅ Завершена  |         |
| 3  | A* pathfinding и CollisionSystem                                  | ⬜ Не начата  |         |
| 4  | Игровые системы симуляции (Movement, Mining, Energy, Statistics)  | ⬜ Не начата  |         |
| 5  | Система программ (types, interpreter, ProgramExecutionSystem)     | ⬜ Не начата  |         |
| 6  | Phaser 3 рендеринг (карта, дроны, эффекты, камера)               | ⬜ Не начата  |         |
| 7  | React UI (ProgramEditor, DroneInspector, StatsPanel, Zustand)     | ⬜ Не начата  |         |
| 8  | Игровой цикл и интеграция (GameLoop, GameController, win/fail)    | ⬜ Не начата  |         |
| 9  | Миссии (4 обучающих миссии)                                       | ⬜ Не начата  |         |
| 10 | Аудио и полировка (звук, частицы, эффекты, баланс)               | ⬜ Не начата  |         |

**Легенда:** ⬜ Не начата · 🔄 В процессе · ✅ Завершена

---

## Текущая точка входа

**Начинать с:** Фаза 3 — A* pathfinding и CollisionSystem

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
- [ ] `src/game/pathfinding/astar.ts` — A*, Manhattan heuristic, `occupied: Set<string>` для обхода занятых клеток, lazy path-computation
- [ ] `src/game/simulation/systems/CollisionSystem.ts` — snapshot целочисленных позиций дронов (вызывается до ProgramExecutionSystem)
- [ ] TypeScript strict — ошибок нет

### Фаза 4 — Игровые системы симуляции
- [ ] `src/game/simulation/systems/MovementSystem.ts` — движение по A*-пути, дренаж энергии per step (при входе в клетку), resume программы по прибытии
- [ ] `src/game/simulation/systems/MiningSystem.ts` — добыча руды тик-за-тиком + мгновенный DROP через пространственное обнаружение по позиции
- [ ] `src/game/simulation/systems/EnergySystem.ts` — зарядка тик-за-тиком при нахождении на ChargerStation
- [ ] `src/game/simulation/systems/StatisticsSystem.ts` — ore/min (скользящее среднее 60s), idle time, congestion, efficiency
- [ ] Порядок систем задокументирован: `Collision → ProgramExecution → Movement → Mining → Energy → Statistics`
- [ ] TypeScript strict — ошибок нет

### Фаза 5 — Система программ
- [ ] `src/game/programs/types.ts` — `ActionBlock` (MOVE_TO, MINE, PICKUP, DROP, CHARGE, WAIT), `ConditionBlock` (IF + Condition), `FlowBlock` (LOOP, REPEAT, RUN_PROGRAM), `ProgramDef`, `ProgramRegistry`
- [ ] `src/game/programs/interpreter.ts` — `stepProgram(drone, programs, world)`: стековый интерпретатор; REPEAT = перезапуск фрейма; RUN_PROGRAM = push нового фрейма; WAIT = `CallFrame.waitRemaining`
- [ ] `src/game/programs/index.ts` — реэкспорт
- [ ] `src/game/simulation/systems/ProgramExecutionSystem.ts` — вызывает `stepProgram`, транслирует результат в Movement; MINE/DROP/CHARGE → `state: 'waiting'`
- [ ] TypeScript strict — ошибок нет

### Фаза 6 — Phaser 3 рендеринг
- [ ] `src/renderer/scenes/BootScene.ts` — загрузка ассетов (textures, audio)
- [ ] `src/renderer/scenes/GameScene.ts` — основная сцена: рендер карты, дронов, эффектов
- [ ] `src/renderer/GameRenderer.ts` — инициализация `Phaser.Game`, интеграция с симуляцией
- [ ] `src/renderer/sprites/DroneSprite.ts` — спрайт дрона с интерполяцией движения между тиками
- [ ] Рендер тайлов карты (Phaser.GameObjects.Graphics или TileMap)
- [ ] Camera: pan (drag) + zoom (scroll wheel)
- [ ] Базовые эффекты: glow, light trail (Phaser Particles), blinking lights
- [ ] Phaser **только наблюдает** состояние симуляции — не изменяет его
- [ ] Дроны видны на экране и движутся плавно

### Фаза 7 — React UI
- [ ] `src/shared/store/gameStore.ts` — Zustand store: мост симуляция ↔ UI, обновление раз в 100ms
- [ ] `src/ui/editor/ProgramEditor/index.tsx` — список инструкций, add/remove, редактирование условий, назначение программ
- [ ] `src/ui/panels/DroneInspector/index.tsx` — energy, inventory, current task, current program
- [ ] `src/ui/panels/StatsPanel/index.tsx` — throughput, congestion, efficiency
- [ ] `src/ui/App.tsx` — layout: Phaser canvas + панели, sci-fi terminal стиль
- [ ] Можно редактировать программы через UI и назначать дрону

### Фаза 8 — Игровой цикл и интеграция
- [ ] `src/game/GameLoop.ts` — фиксированный timestep 10 ticks/sec, порядок вызова систем
- [ ] `src/game/GameController.ts` — оркестратор: симуляция ↔ Phaser ↔ Zustand
- [ ] Win condition: добыто N ore / достигнута target efficiency
- [ ] Fail condition: время вышло / throughput слишком низкий
- [ ] Полный цикл добычи работает end-to-end

### Фаза 9 — Миссии
- [ ] `src/game/missions/mission1.ts` — 1 дрон, простой цикл добычи
- [ ] `src/game/missions/mission2.ts` — добавляется энергия + зарядка
- [ ] `src/game/missions/mission3.ts` — 2 дрона, пробки
- [ ] `src/game/missions/mission4.ts` — command slots + subprograms
- [ ] Mission UI: загрузка миссии, отображение цели, win/fail экран

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
