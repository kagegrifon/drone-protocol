# Сессия: дизайн объектного World API для скриптов дронов

**Дата:** 2026-06-20
**Тип:** feature (дизайн/планирование, без реализации)
**Ветка:** feat/camera-focus (реализация пойдёт в отдельной ветке `feat/world-api`)

## Цель

Заменить непрозрачные числовые id в командах дронов (`moveTo(2)`) на удобный
объектный API доступа к миру в духе Screeps/Roblox: `self.moveTo(World.mines[0].position)`.
Спроектировать структуру объекта `World`, чтобы скриптами было удобно пользоваться.

## Результаты

Проведён brainstorming, изучена вся архитектура исполнения кода (worker + driver + ECS-снапшот).
Спроектирован полный план реализации на 8 фаз.

### Ключевая находка

В реальной игре доступа к миру **сейчас нет вообще**: `CodeBehaviorDriver` создаётся в
`gameStore.ts:200` **без** колбэка `entities`, поэтому именованные сущности = `{}`.
Колбэк используется только в тестах. То есть фича не просто меняет синтаксис, а **впервые**
открывает игроку рабочий доступ к объектам мира.

Вторая находка: `MiningSystem.findEntityAt` требует, чтобы дрон стоял **точно на клетке**
шахты/базы (`pos.x===x && pos.y===y`). `moveTo(mine.position)` ведёт ровно туда — поведение
совместимо с симуляцией.

### Решения (утверждены с пользователем)

- **Текущий дрон = `self`** (не `drone`): `self.energy`, `self.moveTo(...)`.
- **`World.*` по типам**, всё множества: `mines[]`, `chargers[]`, `bases[]`, `drones[]`
  (`drones` включает self — буквальный снапшот).
- **Богатая сущность:** `{ id, type, position }` + метод-прототип `distanceTo(other)`.
  У шахты `oreRemaining`/`freeSlots`, базы `storedOre`/`freeSlots`, зарядки `freeSlots`,
  дрона `energy`/`inventory`/… (у дрона `freeSlots` НЕТ — оно про рабочие слоты объектов).
- **`entity.position`** — свойство, тип `Position { x, y }` (вынести отдельно).
- **`moveTo(point)`** принимает строго `{x,y}`; только перемещает (не майнит/разгружает).
  Для сущности: `moveTo(mine.position)`. Протокол worker↔driver несёт `{x,y}`, а не id
  (новая `planMoveToPoint`, старую `planAstarMove` удалить).
- **`self.findClosest(list)`** — хелпер «ближайший».
- **Чистый новый API**, без обратной совместимости: убрать `distance()`, `deposit()`, числовые id.
- **Модель данных (вопрос про производительность):** НЕ геттеры-с-поиском-по-id, а **мутация
  объектов по месту** — объекты создаются один раз, на каждом `resume` поля переписываются
  (`Object.assign`/`syncList`). Быстро, ссылки стабильны (`const m = World.mines[0]` переживает
  `await`), детерминизм сохранён. `distanceTo`/`findClosest` — методы на прототипе.
- Тип сущности — из `scene.staticEntities`; дроны — через `world.query("Position","Movement")`.

### Артефакты

- **План реализации:** `C:\Users\Master\.claude\plans\wondrous-swimming-popcorn.md` (8 фаз)
- Feature-doc (`docs/features/planned/object-world-api.md`) и обновление index — **в Фазе 8 реализации**

### Фазы плана (кратко)

1. `WorldSnapshot` вместо `SensorsSnapshot` (types.ts)
2. `collectWorld()` — сборщик снапшота по типам (sensors.ts → worldSnapshot.ts)
3. Проброс typeMap из сцены → driver (gameStore.init, GameController, CodeBehaviorDriver)
4. `planMoveToPoint(droneId, point, …)` — pathfinding к точке
5. Объектный World/self в codeRuntime (мутация по месту, прототип Entity)
6. Переписать `drone-api.d.ts` (+ примеры)
7. Миграция тестов + e2e
8. Документация

### Дальше

Реализация — в новой сессии, в отдельной ветке `feat/world-api` (не на `feat/camera-focus`).
Стартовый промпт передан пользователю.

## Метрики сессии

(заполняются хуком метрик при завершении)
