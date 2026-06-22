# Объектный World API для скриптов дронов (Screeps-style)

**Статус:** planned

## Зачем

В Code Mode дроны программируются JS-кодом, исполняемым в Web Worker. До этой
фичи команды принимали **числовые EntityId** (`moveTo(2)`), а в скрипт
прокидывались объект `drone`, глобальные функции `distance(a, b)` / `deposit(t)`
и именованные переменные-id (`mine1`, `base`).

Две проблемы:

1. **Числа непрозрачны.** Игрок не понимает, что такое `moveTo(2)`, нет
   автодополнения, нет навигации по миру.
2. **Доступа к миру фактически нет.** В реальной игре `CodeBehaviorDriver`
   создавался без колбэка `entities`, поэтому именованные сущности были `{}`.
   Колбэк использовался только в тестах — игрок не мог обратиться к шахтам/базам.

Фича заменяет всё это на **Screeps-подобный объектный API**. Игрок обращается к
миру через глобальный `World` (`World.mines[0]`, `World.bases[0]`,
`World.chargers`, `World.drones`), где каждый элемент — богатый объект-сущность с
полями и методами. Текущий дрон доступен как `self`. Команды передвижения
привязаны к **позиции** (`{x, y}`), а не к id. Это даёт читаемость,
автодополнение в Monaco и впервые открывает игроку реальный доступ к объектам
мира.

## Поведение

### Глобальные `self` и `World`

- **`self`** — текущий управляемый дрон: `self.energy`, `self.energyMax`,
  `self.inventory`, `self.inventoryMax`, `self.position`, плюс действия и хелперы
  (см. ниже). У дрона **нет** `freeSlots` (поле осмысленно только у объектов с
  рабочими слотами).
- **`World`** — множества сущностей по типам: `mines[]`, `chargers[]`, `bases[]`,
  `drones[]`. Все — массивы. `World.drones` включает **всех** дронов, в т.ч. сам
  `self` (буквальный снапшот мира).

### Сущность

Каждый элемент — богатый объект `{ id, type, position, ... }`:

| Тип | Поля сверх базовых |
|---|---|
| `mine` | `oreRemaining`, `freeSlots` |
| `charger` | `freeSlots` |
| `base` | `freeSlots`, `storedOre` |
| `drone` | `energy`, `energyMax`, `inventory`, `inventoryMax` |

- `entity.position` — свойство, возвращает `Position { x, y }`.
- `entity.distanceTo(other)` — Manhattan-расстояние до другой сущности или точки.

### Действия и хелперы `self`

- `self.moveTo(point)` — доехать до точки (A*). Принимает **строго `{x, y}`**
  (`Position`). Для сущности игрок пишет `self.moveTo(mine.position)`. **Только
  перемещает** — не майнит и не разгружает.
- `self.mine()` / `self.drop()` / `self.charge()` — добыча/разгрузка/зарядка,
  по 1 единице за вызов. Срабатывают, только когда дрон стоит **точно на клетке**
  объекта (шахты/базы/зарядки); «не на месте» — молча `state=running`
  (ответственность игрока).
- `self.wait(seconds)` — подождать N секунд игрового времени.
- `self.findClosest(list)` — ближайшая (по Manhattan) сущность из списка или
  `null`, если список пуст.

`moveTo` ведёт ровно на клетку цели, поэтому
`await self.moveTo(mine.position); await self.mine();` эквивалентно прежнему
`moveTo(mineId)` с автодобычей, но шаги разделены и читаемы.

### Чистый новый API

Без обратной совместимости: убраны `distance()`, `deposit()`, числовые id и
объект `drone`. Сигнатура исполняемой функции — `(self, World)`.

### Примеры

```js
// 1. Базовый цикл: добыть полный трюм и отвезти на базу
while (true) {
  const mine = World.mines[0];
  await self.moveTo(mine.position);              // встаём на клетку шахты
  while (self.inventory < self.inventoryMax && mine.oreRemaining > 0) {
    await self.mine();                           // по 1 руде за вызов
  }
  const base = World.bases[0];
  await self.moveTo(base.position);
  while (self.inventory > 0) {
    await self.drop();                           // пока трюм не пуст
  }
}

// 2. Ближайшая непустая шахта + зарядка по необходимости
while (true) {
  if (self.energy < 30) {
    const charger = self.findClosest(World.chargers);
    await self.moveTo(charger.position);
    while (self.energy < self.energyMax) {
      await self.charge();
    }
    continue;
  }
  const mine = self.findClosest(World.mines.filter((m) => m.oreRemaining > 0));
  if (!mine) break;                              // шахты кончились
  await self.moveTo(mine.position);
  await self.mine();
}

// 3. Расстояния и координаты
const mine = World.mines[0];
const d = self.distanceTo(mine);                 // Manhattan
const p = self.position;                         // { x, y }
await self.moveTo({ x: p.x + 1, y: p.y });       // движение в произвольную точку
```

## Критерии готовности

- [x] `SensorsSnapshot` заменён на типизированный `WorldSnapshot` (`self`,
  `mines`, `chargers`, `bases`, `drones`); сообщения протокола несут `point` и
  `world` вместо `targetId`/`sensors`/`entities`.
- [x] `collectWorld(world, droneId, typeMap)` собирает полный снапшот по типам
  сущностей (`worldSnapshot.ts` вместо `sensors.ts`).
- [x] Карта типов сущностей прокинута из `scene.staticEntities` через `store.init`
  в `CodeBehaviorDriver` (`typeMap`).
- [x] `planMoveToPoint(droneId, point, ...)` прокладывает путь к точке `{x,y}`;
  старая `planAstarMove(..., targetId, ...)` удалена.
- [x] Объектный `self`/`World` API построен в `codeRuntime` (прототипы `Entity`,
  мутация полей по месту на каждом `resume`, стабильные ссылки на объекты).
- [x] `drone-api.d.ts` переписан под объектный API (Monaco-контракт игрока).
- [x] Monaco настроен так, что `self`/`World` резолвятся без конфликта с
  `lib.dom` (`self: Window`) и допускают top-level `await`; автодополнение
  `self.`/`World.` работает.
- [x] Все unit-тесты переведены на объектный API (worldSnapshot, codeRuntime,
  NodeWorkerPort, CodeBehaviorDriver, planMove, gameStore); type-check чистый.
- [x] E2E `code-mode.spec.ts` добывает руду через `World.mines[0].position` /
  `World.bases[0].position` — доказательство реального доступа к миру.

## Технические заметки

### Слоистость и граница воркера

Код игрока исполняется в отдельном Web Worker (нет прямого доступа к ECS). Через
границу (structured clone) идёт только plain-object `WorldSnapshot` — чистые
данные. Богатые объекты с методами (`Entity`, `MineEntity`, …) строятся **внутри
воркера** в `codeRuntime`. Сборщик снапшота (`worldSnapshot.ts`) живёт в
`src/game/code` (не в simulation) и возвращает чистые данные.

### Тип сущности

Определяется по `scene.staticEntities` (авторитетный источник), а не по
компонентам. `typeMap: Map<EntityId, "mine"|"base"|"charger">` строится в
`gameStore.init` и передаётся в `CodeBehaviorDriver`. Дроны собираются через ECS
`world.query("Position","Movement")` — у дронов есть `Movement`, у статических
объектов нет.

### Модель обновления данных (детерминизм + производительность)

Объекты API (`self`, `World.mines[i]`, …) создаются **один раз** при старте
сессии. На каждом `resume` приходит свежий снапшот, и поля существующих объектов
**переписываются по месту** (`Object.assign` + синхронизация длины массивов).
Преимущества:

1. **Быстро** — простые поля, без геттеров и линейного поиска по id на чтение.
2. **Стабильные ссылки** — `const mine = World.mines[0]` остаётся валидной после
   `await`; обновляются только поля.
3. **Детерминизм** — поля меняются только на `resume` (между двумя `await`
   значения стабильны).
4. **Безопасность** — код игрока физически не может испортить состояние
   симуляции.

`distanceTo` / `findClosest` — методы на прототипе (общие, не пересоздаются).

### moveTo привязан к позиции

Протокол worker↔driver несёт `{x, y}`, а не `targetId`. `moveTo` только
перемещает; `mine()`/`drop()`/`charge()` — отдельные команды, требующие точного
совпадения позиции дрона с клеткой объекта (`MiningSystem`).

### Monaco

`monacoSetup.ts` задаёт `lib: ["es2022"]` (без `dom` — иначе глобальный
`self: Window` перебивает `declare const self: DroneApi`), `module: ESNext` +
`target: ES2022` + `moduleDetection: Force` (код игрока без import/export иначе
считался бы скриптом и запрещал top-level `await`). Значения enum заданы
числами: реэкспорт enum из monaco-editor берёт их из внешней версии typescript,
не совпадающей с ts.worker; строковые формы убирают ошибки диагностики, но ломают
автодополнение. `drone-api.d.ts` подключается как амбиентный `extraLib` (без
`export {}`), поэтому `self`/`World` глобальны и видны в модели-модуле.

### Подсветка строк

Сообщения протокола несут `line` (для подсветки текущей исполняемой строки);
`instrument.ts` перевязан с `drone` → `self`, иначе подсветка не работала бы для
нового API.
