# Журнал сессий

---

## Сессия 6 — 2026-05-08

**Цель:** Фаза 4 — Игровые системы симуляции (Movement, Mining, Energy, Statistics).

**Результаты:**
- Добавлен тип `WaitingFor = 'move' | 'mine' | 'drop' | 'charge'` и поле `waitingFor?` в `ProgramComponent`
- Создан `MovementSystem.ts` — движение по A*-пути (speed шагов/тик), дренаж энергии при входе в клетку, resume программы при `waitingFor='move'` по прибытии
- Создан `MiningSystem.ts` — MINE: добыча `mineRate` руды/тик с дренажем энергии, resume когда инвентарь полон или залежь иссякла; DROP: мгновенная передача руды на базу по позиции, resume сразу
- Создан `EnergySystem.ts` — зарядка `chargeRate`/тик при нахождении на станции, resume когда `current >= max` и `waitingFor='charge'`; пассивная зарядка при нахождении на станции без программной команды
- Создан `StatisticsSystem.ts` — `recordOreMined()`, `recordCongestion()`, скользящее среднее ore/min (окно 600 тиков = 60 сек), подсчёт idle дронов и efficiency
- Написаны 35 тестов по TDD (RED→GREEN) для 4 систем; итого 47 тестов — все проходят
- `npm run type-check` — ошибок нет

**Следующий шаг:** Фаза 5 — Система программ (types, interpreter, ProgramExecutionSystem)

---

## Сессия 5 — 2026-05-08

**Цель:** Фаза 3 — A* pathfinding и CollisionSystem.

**Результаты:**
- Установлен Vitest, добавлен скрипт `test` в package.json, настроен `vite.config.ts`
- Создан `src/game/pathfinding/astar.ts` — A* с Manhattan heuristic, поддержкой `occupied: Set<string>`, возвращает путь без стартовой клетки (null если недостижимо)
- Создан `src/game/simulation/systems/CollisionSystem.ts` — снимает snapshot позиций всех дронов (Position + Movement) в `occupied: Set<string>` перед каждым тиком
- Написаны 12 тестов (7 для A*, 5 для CollisionSystem) — все проходят
- `npm run type-check` — ошибок нет

**Следующий шаг:** Фаза 4 — Игровые системы симуляции (Movement, Mining, Energy, Statistics)

---

## Сессия 4 — 2026-05-08

**Цель:** Фаза 2 — Сетка 20×20 и фабрики сущностей.

**Результаты:**
- Создан `src/shared/constants/cellTypes.ts` — тип `CellType`: `'empty' | 'wall' | 'mine' | 'base' | 'charger'`
- Создан `src/game/simulation/world/Grid.ts` — класс `Grid` (20×20): `getTile`, `setTile`, `isWalkable`, `neighbours` (4 направления); out-of-bounds возвращает `'wall'`
- Созданы 4 фабрики сущностей: `createDrone`, `createBase`, `createMine`, `createCharger`
- `npm run type-check` — ошибок нет

**Следующий шаг:** Фаза 3 — A* pathfinding и CollisionSystem

---

## Сессия 3 — 2026-05-08

**Цель:** Фаза 1 — ECS ядро и shared types.

**Результаты:**
- Создан `src/shared/types/index.ts` — `EntityId`, `ComponentName`, `Position`
- Создан `src/game/simulation/world/World.ts` — typed ECS с инвертированным индексом (`ComponentMap`, `query`, `createEntity`, `destroyEntity`, `addComponent`, `removeComponent`, `getComponent`, `hasComponent`)
- Созданы 8 компонентов: `Position`, `Energy`, `Inventory`, `Program` (с `CallFrame`, `ProgramState`), `Movement`, `Renderable` (с `SpriteType`), `Deposit`, `ChargerStation`
- `npm run type-check` — ошибок нет

**Следующий шаг:** Фаза 2 — Сетка 20×20 и фабрики сущностей (Grid, createDrone, createBase, createMine, createCharger)

---

## Сессия 2 — 2026-05-08

**Цель:** Фаза 0 — инициализация проекта.

**Результаты:**
- Настроен Vite 5 + React 18 + TypeScript 5 (`package.json`, `vite.config.ts`, `index.html`)
- Установлены зависимости: `phaser@^3.60`, `zustand@^4.5`, `react`, `react-dom`
- Настроен `tsconfig.json` (strict mode, `moduleResolution: bundler`, `jsx: react-jsx`, `isolatedModules`)
- Создана структура папок: `src/game/simulation/`, `src/game/pathfinding/`, `src/game/programs/`, `src/renderer/`, `src/ui/`, `src/shared/`
- Создан `.gitignore`
- Созданы заглушки `src/main.tsx`, `src/App.tsx`
- `npm run type-check` — ошибок нет

**Следующий шаг:** Фаза 1 — ECS ядро (World, компоненты)

---

## Сессия 1 — 2026-05-08

**Цель:** Планирование разработки: создать план, трекер прогресса, журнал сессий, дополнить CLAUDE.md.

**Результаты:**
- Изучены [Game Design Document (GDD).md](Game Design Document (GDD).md) и [Technical Architecture.md](Technical Architecture.md)
- Утверждён стек: TypeScript + Vite + React + Phaser 3 + Zustand
- Создан план разработки (11 фаз, 0–10) в `.claude/plans/`
- Создан [PROGRESS.md](PROGRESS.md) — трекер прогресса с детальными чеклистами по всем фазам
- Создан [SESSION.md](SESSION.md) — журнал сессий
- Дополнен [CLAUDE.md](CLAUDE.md) — добавлены правила архитектуры, ведения документации, имя игры

**Следующий шаг:** Фаза 0 — инициализация проекта (`npm create vite`, структура папок, зависимости)

---
