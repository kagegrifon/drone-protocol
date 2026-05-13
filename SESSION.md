# Журнал сессий

---

## Сессия 17 — 2026-05-13

**Цель:** Реализовать динамический пикер цели для блока `MOVE_TO` (план `move-to-dynamic-book.md`).

**Результаты:**
- Введены типы `EntityType` и `EntityMeta`; `SceneResult.staticEntityIds` заменён на `staticEntities: Array<{ id, type }>`
- Все четыре миссии обновлены с явными типами сущностей
- `GameController` вычисляет метки один раз через `buildEntityMetas()` — `Mine 1`, `Base`, `Charger 2` и т.д.
- `InstructionBlock`: кнопка-тоггл с текущей меткой и стрелкой `▾/▴`; при клике открывается пикер с именованными объектами сцены; выбор закрывает пикер и обновляет `targetEntityId`
- `gameStore`: добавлен `updateInstruction` для точечной замены инструкции без пересоздания
- `DroneList`: добавлены `data-testid="drone-item-{id}"` на элементы
- Новый e2e тест `e2e/move-to-picker.spec.ts` (миссия 3): открытие пикера, смена цели, повторная смена
- Все 100 unit-тестов прошли; ошибок TypeScript нет

**Следующий шаг:** Протестировать визуально в браузере и при необходимости запустить e2e (`npx playwright test e2e/move-to-picker.spec.ts`).

---

## Сессия 16 — 2026-05-12

**Цель:** Исправить ошибку `Container.setInteractive must specify a Shape or call setSize() first` после загрузки миссии.

**Результаты:**
- Причина: `DroneSprite` наследуется от `Phaser.GameObjects.Container`, у которого нет неявного размера; вызов `sprite.setInteractive()` без указания хит-зоны бросает ошибку
- Исправление: добавлен `sprite.setSize(TILE_SIZE, TILE_SIZE)` перед `sprite.setInteractive()` в `src/renderer/scenes/GameScene.ts:180`

**Следующий шаг:** Продолжить разработку или тестирование в следующей сессии.

---

## Сессия 15 — 2026-05-12

**Цель:** Починить e2e тесты Playwright — страница была пустой, React не запускался.

**Результаты:**
- Диагностика: debug-тест показал `[pageerror] require_react is not a function` — ошибка CJS/ESM interop в режиме dev-сервера
- Причина: `vite@8.0.12` использует Rolldown вместо esbuild; `@vitejs/plugin-react@4.7.0` поддерживает только Vite `^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0` — версия несовместима
- Исправление: откат `vite@8.0.12` → `vite@7.3.3` (`npm install --save-dev "vite@^7.0.0"`)
- `@vitejs/plugin-react-oxc` тоже не подошёл (поддерживает только до Vite 7.x)
- Убит зависший dev-сервер на порту 5173 (ещё работал на старом Vite 8)
- Результат: все 4 e2e теста проходят (debug + 3 regression)

**Следующий шаг:** Зафиксировать исправление коммитом.

---

## Сессия 14 — 2026-05-12

**Цель:** Исправление трёх багов после Фазы 10 + написание регрессионных тестов (e2e + unit).

**Результаты:**

*Баги:*
- **Bug 1** (`src/App.tsx`) — чёрный canvas после загрузки миссии. Причина: `useEffect`-cleanup `return () => ctrl.destroy()` вызывался при переходе `loading→game`, уничтожая Phaser сразу после `onReady`. Исправление: cleanup убран из loading-эффекта, вынесен в отдельный unmount-эффект.
- **Bug 2** (`src/game/GameController.ts`) — `TypeError: Cannot read properties of null (reading 'cache')` при смене миссий. Причина: `GameScene._setupEventListeners()` подписывалась на `gameEvents` инлайн-стрелками и никогда не отписывалась — при уничтожении игры старые слушатели оставались и обращались к уничтоженному `AudioManager`. Исправление: `gameEvents.clearAll()` добавлен в `destroy()` и `initWorld()`.
- **Bug 3** (`src/shared/store/gameStore.ts`) — тики не сбрасывались после «Заново» и смены миссии. Причина: `store.init()` не сбрасывал `_tickCount` и `stats`. Исправление: `init()` теперь явно обнуляет `_tickCount`, `stats`, `isRunning`, `gameStatus`, `statusMessage`.

*Тесты:*
- Установлен Playwright (`@playwright/test`), добавлен скрипт `test:e2e`
- Создан `playwright.config.ts` — Chromium, webServer (vite), screenshot on failure
- Создан `e2e/regression.spec.ts` — 3 e2e теста (по одному на каждый баг): canvas виден после загрузки, нет console-ошибок при смене миссий, тики сбрасываются в 0
- Создан `src/shared/store/gameStore.test.ts` — 4 unit теста для Bug 3: init() сбрасывает tick, stats, gameStatus
- `vite.config.ts` — добавлен `define: { __BUNDLED_DEV__, __SERVER_FORWARD_CONSOLE__ }` (Phaser требует эти глобалы при холодном старте в Playwright), добавлен `exclude: ['e2e/**']` для vitest
- `StartScreen.tsx` — добавлен `data-testid="mission-card-N"` на карточки миссий для надёжных e2e-селекторов
- 100 unit тестов — все проходят

**Следующий шаг:** Запустить `npm run test:e2e` после прогрева dev-сервера и убедиться, что все 3 e2e теста проходят.

---

## Сессия 13 — 2026-05-10

**Цель:** Фаза 10 — Аудио и полировка (звук, частицы, glow, StartScreen, credits).

**Результаты:**
- Создан `src/shared/events/gameEvents.ts` — typed EventEmitter + singleton `gameEvents`, 4 теста
- `vite.config.ts` — добавлен `publicDir: 'assets'` для аудиофайлов
- `MiningSystem` — emit ore:mined / ore:dropped при добыче и сдаче руды
- `EnergySystem` — emit charge:started / charge:completed с transition-логикой
- `GameController` — emit mission:complete, рефакторинг setup → GameControllerSetupOptions (onReady, onAudioReady)
- Создан `src/renderer/audio/AudioManager.ts` — Phaser Sound Manager + Web Audio API синтез + volume control
- `BootScene` — добавлен preload() аудиофайлов + synthesizeAudio() (3 синтезированных буфера через registry)
- `GameRenderer` — принимает GameRendererOptions (onReady, onAudioReady) вместо onDroneClick
- `GameScene` — полная переработка: AudioManager, dust particles, glow sync по событиям, drone hum loop
- `DroneSprite` — idle tween (покачивание) + setGlowMode (normal/mining/charging)
- Создан `src/ui/controls/AudioControls.tsx` — ползунки 🎵 и 🔊
- Создан `src/ui/screens/StartScreen.tsx` — карточки миссий с glow-заголовком DRONE LOOP
- Создан `src/ui/screens/LoadingScreen.tsx` — spinner ИНИЦИАЛИЗАЦИЯ СИСТЕМ
- `SimControls` — добавлена кнопка «← Миссии»
- `App.tsx` — gamePhase flow ('start'|'loading'|'game'), AudioManager ref, credits в сайдбаре
- Удалён `MissionSelectOverlay.tsx` (заменён StartScreen)
- 96 тестов PASS; TypeScript strict — 0 ошибок

**Следующий шаг:** Игра завершена. Можно добавить реальные аудиофайлы в `/assets/music/` и `/assets/sound/`.

---

## Сессия 12 — 2026-05-10

**Цель:** Фаза 9 — Миссии (4 обучающих миссии, Mission UI).

**Результаты:**
- Добавлен win condition `ore_per_min` в `src/game/types.ts` и `checkWin`
- Создан модуль `src/game/missions/` с `MissionDef`, `SceneResult`, `mission1`–`mission4`
- Mission 1–2: дроны без программ (игрок пишет сам); Mission 3: неэффективные программы (одна шахта); Mission 4: программы без зарядки (ore/min падает)
- `GameController` рефакторен: принимает `MissionDef` вместо `GameConfig`
- Создан `MissionSelectOverlay`, `MissionGoalPanel`, обновлён `GameStatusOverlay` («Следующая миссия»)
- `App.tsx` управляет `selectedMissionIndex`, переключение между миссиями
- Все тесты проходят (92); TypeScript strict — 0 ошибок

**Следующий шаг:** Фаза 10 — Аудио и полировка

---

## Сессия 11 — 2026-05-09

**Цель:** Фаза 8 — Игровой цикл и интеграция (GameLoop, GameController, win/fail).

**Результаты:**
- Созданы типы `GameStatus`, `WinCondition`, `FailCondition`, `GameConfig` в `src/game/types.ts`
- Создан `src/game/GameLoop.ts` — обёртка над `setInterval` (100ms = 10 ticks/sec), 5 тестов
- Созданы `checkWin` / `checkFail` — чистые экспортируемые функции с 10 тестами (TDD)
- Создан `src/game/GameController.ts` — класс-оркестратор: `setup()`, `start()`, `pause()`, `step()`, `reset()`, `destroy()`; перенесена `buildScene()` из App.tsx
- `src/shared/store/gameStore.ts` — добавлены `gameStatus`, `statusMessage`, `oreMined`, `setGameStatus()`
- `src/ui/controls/SimControls.tsx` — принимает `onPlay`/`onPause`/`onStep` пропсы
- Создан `src/ui/overlays/GameStatusOverlay.tsx` — оверлей победы/поражения с кнопкой «Заново»
- `src/App.tsx` — убраны `buildScene()` и `setInterval`, подключён `GameController`
- Полный цикл добычи работает end-to-end; win/fail условия через `GameConfig`
- Итого 92 теста — все проходят; 0 ошибок type-check

**Следующий шаг:** Фаза 9 — Миссии (mission1–mission4, Mission UI)

---

## Сессия 10 — 2026-05-08

**Цель:** Фаза 7 — React UI (Zustand store, SimControls, DroneList, DroneInspector, ProgramEditor, StatsPanel, App.tsx).

**Результаты:**
- Создан `src/shared/store/gameStore.ts` — Zustand store: `init()`, `tick()`, `selectDrone()`, `setRunning()`, `stepOnce()`, `addInstruction()`, `removeInstruction()`, `createProgram()`, `assignProgram()`; snapshot дронов и статистики обновляется каждый тик
- Обновлён `src/renderer/GameRenderer.ts` — добавлен опциональный параметр `onDroneClick?: (id: EntityId) => void`, передаётся через Phaser registry
- Обновлён `src/renderer/scenes/GameScene.ts` — спрайты дронов становятся интерактивными и вызывают `onDroneClick` по клику
- Создан `src/ui/controls/SimControls.tsx` — кнопки Play/Pause/Step + счётчик тиков
- Создан `src/ui/panels/DroneList.tsx` — список дронов с цветовыми индикаторами статуса (cyan=running, gold=waiting, grey=idle)
- Создан `src/ui/panels/DroneInspector/index.tsx` — energy bar, inventory bar, current task, program, position
- Создан `src/ui/editor/ProgramEditor/InstructionBlock.tsx` — рекурсивный компонент с иконками, поддержка вложенных блоков (LOOP/REPEAT/IF)
- Создан `src/ui/editor/ProgramEditor/index.tsx` — вкладки Drone/Library; добавление/удаление инструкций, создание и назначение программ
- Создан `src/ui/panels/StatsPanel/index.tsx` — ore/min, congestion, efficiency
- Переписан `src/App.tsx` — flex-row layout (canvas слева, sidebar 340px справа); buildScene() создаёт мир с mine-loop программой и двумя дронами; setInterval на 100ms когда isRunning
- `npm run type-check` — ошибок нет

**Следующий шаг:** Фаза 8 — Игровой цикл и интеграция (GameLoop, GameController, win/fail)

---

## Сессия 9 — 2026-05-08

**Цель:** Планирование Фазы 7 — React UI (brainstorming + design).

**Результаты:**
- Проведён brainstorming с визуальными мокапами (visual companion)
- Приняты решения по дизайну UI: layout A (canvas слева, sidebar справа), блочный редактор программ (карточки), выбор дрона двумя способами (canvas + список), ProgramEditor с двумя вкладками (Drone + Library), Play/Pause/Step контролы
- Выбрана архитектура bridge: Zustand snapshot-store, `tick()` каждые 100ms
- Написан детальный план реализации: `C:\Users\Master\.claude\plans\progress-md-session-md-stateful-abelson.md`
- Реализация не начата — отложена на следующую сессию

**Следующий шаг:** Фаза 7 — реализация (gameStore.ts → компоненты → App.tsx)

---

## Сессия 8 — 2026-05-08

**Цель:** Фаза 6 — Phaser 3 рендеринг (BootScene, GameScene, DroneSprite, GameRenderer, App.tsx).

**Результаты:**
- Создан `src/renderer/config.ts` — TILE_SIZE=40, GRID_SIZE=20, цветовая палитра COLORS, TILE_COLORS
- Создан `src/renderer/scenes/BootScene.ts` — программная генерация текстур 48×48 для всех сущностей (drone, base, mine, charger) без внешних ассетов; исправлена совместимость с Phaser 3.90 (убрана устаревшая опция `{ add: false }` в `make.graphics()`)
- Создан `src/renderer/sprites/DroneSprite.ts` — Container с телом дрона, мигающим Arc (Tween, 700ms yoyo), историей следа (8 точек)
- Создан `src/renderer/scenes/GameScene.ts` — отрисовка карты (Graphics), управление спрайтами (создание/удаление), интерполяция позиций дронов по `movement.progress`, рендер следов, pan+zoom камера
- Создан `src/renderer/GameRenderer.ts` — инициализация `Phaser.Game`, передача World+Grid через registry; не владеет тик-циклом (это задача Фазы 8)
- Обновлён `src/App.tsx` — тестовый сценарий: 2 базы/шахты/зарядника/дрона, статическая сцена для визуальной проверки рендерера
- `npm run type-check` — ошибок нет на всех этапах

**Следующий шаг:** Фаза 7 — React UI (Zustand store, ProgramEditor, DroneInspector, StatsPanel)

---

## Сессия 7 — 2026-05-08

**Цель:** Фаза 5 — Система программ (types, interpreter, ProgramExecutionSystem).

**Результаты:**
- Создан `src/game/programs/types.ts` — `Condition` (5 вариантов), `ActionBlock` (MOVE_TO, MINE, DROP, CHARGE, WAIT), `FlowBlock` (LOOP, REPEAT, RUN_PROGRAM), `ConditionBlock` (IF + then/else), `Instruction`, `ProgramDef`, `ProgramRegistry`
- Обновлён `CallFrame` в `Program.ts` — добавлены `isLoop?: boolean` и `inlineInstructions?: readonly unknown[]` для хранения тел LOOP/REPEAT как inline-фреймов
- Создан `src/game/programs/interpreter.ts` — `stepProgram(droneId, world, registry, grid, occupied)`: стековый интерпретатор; фреймы всегда продвигают родителя через механизм pop (не двойное продвижение); LOOP = перезапуск бесконечно; REPEAT = перезапуск N раз затем pop; IF = push then/else inline-фрейма при наличии тела; WAIT = `waitRemaining` счётчик в фрейме
- Создан `src/game/simulation/systems/ProgramExecutionSystem.ts` — query дронов с Position+Movement+Program, вызывает `stepProgram` для каждого running-дрона, передаёт `CollisionSystem.occupied`
- Создан `src/game/programs/index.ts` — реэкспорт всех типов и `stepProgram`
- Написаны 30 тестов по TDD (RED→GREEN): 24 для interpreter, 6 для ProgramExecutionSystem; итого 77 тестов — все проходят
- `npm run type-check` — ошибок нет

**Следующий шаг:** Фаза 6 — Phaser 3 рендеринг (BootScene, GameScene, DroneSprite, камера)

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
