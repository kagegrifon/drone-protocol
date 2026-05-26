# Эксклюзивные слоты работы и физическая непроходимость дронов

**Статус:** planned

## Зачем

Сейчас в игре два связанных пробела:

1. **Логика «по одному»** — нет явной модели «слота» у депозита/зарядки/базы. Сегодня правило «один дрон работает с депозитом за раз» соблюдается случайно, потому что слот совпадает с клеткой сущности и на клетке физически помещается один дрон. Как только в будущем появятся многоклеточные шахты или подходы сбоку — правило перестанет соблюдаться без отдельной модели слотов.

2. **Физическая непроходимость** — `CollisionSystem` снимает snapshot занятых клеток в начале тика и передаёт его в A* (планирование пути обходит дронов корректно). Но `MovementSystem` исполняет шаги дронов подряд и **не сверяется** с тем, кто уже шагнул в этом тике. Два дрона могут запланировать пути в одну клетку на одном тике и оба туда шагнуть — нарушая инвариант «один дрон = одна клетка». Это блокер для будущих задач на маршрут.

Фича закрывает оба пробела одной согласованной моделью.

## Поведение

**Слоты:**
- На сущностях `Deposit`, `ChargerStation` и базе (сущность с `Inventory`, на которую делается `DROP`) есть компонент `WorkSlots`. По умолчанию — один слот в клетке самой сущности.
- Слот «занят», пока на его клетке физически стоит дрон. Освобождается, как только дрон шагнул прочь.
- Геометрия не меняется: дрон по-прежнему встаёт на клетку депозита/зарядки/базы для работы. Депозит/зарядка/база не становятся непроходимыми. (Многоклеточные шахты и подходы сбоку — отдельная будущая фича.)
- В IF-условиях программ появляется функция `FreeSlots(target)` — число свободных слотов у конкретной сущности. Сейчас 0 или 1, в будущем 0..N.

**Физическая непроходимость:**
- В одном тике в одну клетку может попасть только один дрон. Если дрон пытается шагнуть в клетку, которую в этом же тике уже занял другой дрон — шаг отменяется, дрон остаётся на месте, эмитится событие `drone:blocked` (та же семантика, что в planned-фиче congestion-metric).
- A* при планировании по-прежнему обходит занятые клетки на момент старта тика (`CollisionSystem` остаётся).

**Спавн:**
- Дрон не может быть создан в клетке любого `WorkSlot`. Нарушение → ошибка инициализации мира, громкое падение. Без авто-сдвига.

## Критерии готовности

- Добавлен компонент `WorkSlots` и навешивается на `Deposit`/`ChargerStation`/`Base` со слотом в собственной позиции.
- `MovementSystem` корректно эмитит `drone:moved` после успешного шага.
- Подписчик в модуле `workSlotsIndex` обновляет `occupiedBy` слотов по событиям `drone:moved` и `entity:removed`, без сканирования дронов.
- `FreeSlots(target)` доступна в редакторе IF-условий, принимает только сущности с `WorkSlots`, возвращает корректное число.
- Два дрона с путями в одну клетку на одном тике никогда не оказываются в одной клетке. Один шагает, второй получает `drone:blocked` и `waitingFor=move` снимается так же, как при пустом пути.
- Спавн дрона на клетке слота вызывает ошибку инициализации с понятным сообщением.
- Существующие миссии 1–4 проходят без регрессий программ. Если какая-то миссия спавнит дрона на слоте и падает — это **не** чинится в рамках этой фичи, исправление выносится в отдельную сессию.
- Unit-тесты покрывают: lifecycle слотов (claim при шаге, release при уходе, release при удалении дрона), фикс гонки `MovementSystem`, функцию `FreeSlots`, валидацию спавна.

## Технические заметки

### Модель данных

```ts
// src/game/simulation/components/WorkSlots.ts
import type { EntityId } from '../../../shared/types/index.js';

export interface WorkSlot {
  x: number;
  y: number;
  occupiedBy: EntityId | null;
}

export interface WorkSlotsComponent {
  slots: WorkSlot[];
}
```

Регистрируется в `World.ts` как ключ `WorkSlots`.

Фабрики `Deposit`/`ChargerStation`/`Base` при создании сущности добавляют рядом `WorkSlots` с одним слотом в собственной позиции и `occupiedBy: null`.

### Публичный API

```ts
// src/game/simulation/world/workSlots.ts
function slotsOf(world: World, entityId: EntityId): readonly WorkSlot[];
function freeSlotsCount(world: World, entityId: EntityId): number;
```

Никакого `getSlotAt(x, y)` и никакого `releaseSlotByDrone(droneId)` наружу. Освобождение всегда привязано к конкретному событию движения/удаления, наружные системы про это не знают.

### Внутренний индекс и подписчик

```ts
// src/game/simulation/world/workSlotsIndex.ts
// Внутренние структуры:
//   Map<"x,y", { entityId: EntityId; slotIndex: number }>
//
// Регистрация:
//   - на entity:added (если такого события нет — заводим): если у сущности есть WorkSlots,
//     все её слоты добавляются в индекс
//   - на entity:removed: все слоты удаляются из индекса
//
// Обновление occupancy:
//   - на drone:moved { fromX, fromY, toX, toY, droneId }:
//       fromSlot = index.get("fromX,fromY")
//       if fromSlot && slot.occupiedBy === droneId: slot.occupiedBy = null
//       toSlot = index.get("toX,toY")
//       if toSlot && slot.occupiedBy === null:    slot.occupiedBy = droneId
//   - на entity:removed { entityId, lastX, lastY } (для дронов):
//       slot = index.get("lastX,lastY")
//       if slot && slot.occupiedBy === entityId: slot.occupiedBy = null
```

Подписки инициализируются при создании `World` (или лениво при первом добавлении сущности с `WorkSlots`).

### События

В `src/shared/events/gameEvents.ts` добавляются:

```ts
'drone:moved':    { droneId: EntityId; fromX: number; fromY: number; toX: number; toY: number };
'entity:removed': { entityId: EntityId; lastX?: number; lastY?: number };
'drone:blocked':  { droneId: EntityId }; // см. также planned/congestion-metric.md
```

`drone:blocked` пересекается с фичей [congestion-metric.md](congestion-metric.md): фикс гонки в `MovementSystem` добавит **вторую** точку эмиссии, в дополнение к точке `path === null` в `interpreter.ts`. Обе ситуации — «дрон не смог двигаться из-за заторов».

### MovementSystem: фикс гонки

Локальный `Set<string>` инициализируется в начале каждого тика текущими позициями всех дронов:

```ts
const stepped = new Set<string>();
for (const id of drones) {
  const pos = this.world.getComponent(id, 'Position')!;
  stepped.add(`${pos.x},${pos.y}`);
}
```

При успешном шаге дрона:
- если целевая клетка ≠ исходной и `stepped.has(targetKey)` → шаг отменяется, эмитится `drone:blocked`, `path` очищается, `waiting=move` снимается так же, как при пустом пути;
- иначе: `stepped.delete(fromKey); stepped.add(toKey)`, шаг исполняется, эмитится `drone:moved`.

`CollisionSystem` остаётся как есть — он нужен для A*. Фикс гонки решает другую задачу: исполнение, а не планирование.

### Функция FreeSlots

В `src/game/programs/types.ts` добавляется значение `'FreeSlots'` в `FunctionName`.

В `src/game/programs/functions.ts`:

```ts
FreeSlots: {
  name: 'FreeSlots',
  label: 'FreeSlots',
  icon: '🅿️',
  arity: 1,
  argLabels: [''],
  argFilter: isEntityType(['WorkSlots']),
  evaluate: ([id], _droneId, world) => {
    const ws = world.getComponent(id, 'WorkSlots');
    if (!ws) return null;
    let free = 0;
    for (const s of ws.slots) if (s.occupiedBy === null) free++;
    return free;
  },
},
```

`isEntityType` расширяется, чтобы `'WorkSlots'` был допустимой строкой в TS-сигнатуре. По `argFilter` UI редактора условий будет предлагать только сущности с `WorkSlots` — null-возврат на деле недостижим со стороны игрока.

### Валидация спавна

В фабрике мира/миссии после всех `addEntity()`:

```ts
function validateNoDroneOnSlot(world: World): void {
  const drones = world.query('Position', 'Movement');
  for (const droneId of drones) {
    const pos = world.getComponent(droneId, 'Position')!;
    const slotRef = workSlotsIndex.get(`${pos.x},${pos.y}`);
    if (slotRef) {
      throw new Error(
        `Mission setup error: drone ${droneId} spawned on a work slot of entity ${slotRef.entityId} at (${pos.x}, ${pos.y}).`
      );
    }
  }
}
```

Падаем громко. Никаких авто-сдвигов и `console.error`.

### Файлы

**Новые:**
- `src/game/simulation/components/WorkSlots.ts`
- `src/game/simulation/world/workSlots.ts` — публичный API (`slotsOf`, `freeSlotsCount`)
- `src/game/simulation/world/workSlotsIndex.ts` — внутренний индекс + подписчики
- Тесты: `workSlotsIndex.test.ts`, расширение `MovementSystem.test.ts`, расширение `functions.test.ts`, тест валидации спавна

**Меняются:**
- `src/shared/events/gameEvents.ts` — события `drone:moved`, `entity:removed`, `drone:blocked`
- `src/game/simulation/world/World.ts` — регистрация компонента `WorkSlots`, эмиссия `entity:removed` в `removeEntity`
- `src/game/simulation/systems/MovementSystem.ts` — `stepped`-set, фикс гонки, эмиссия `drone:moved`
- `src/game/programs/types.ts` — `FunctionName += 'FreeSlots'`
- `src/game/programs/functions.ts` — спецификация `FreeSlots`, расширение `isEntityType`
- Фабрики `Deposit`/`ChargerStation`/`Base` — навешивают `WorkSlots` со слотом в собственной позиции
- Фабрики миссий — вызов `validateNoDroneOnSlot` после загрузки
- `docs/features/index.md` — запись фичи

### Что НЕ делаем (out of scope)

- Депозит/зарядка/база остаются проходимыми (геометрия не меняется).
- Слоты сбоку, 4/8-связность подходов — будущая фича.
- Резервирование пути «дрон занял слот, ещё не доехав» — будущая фича.
- Dev-asserts на рассинхрон состояния слотов и `waitingFor` — отдельная фича.
- Починка миссий, которые могут начать падать из-за валидации спавна — отдельная сессия.
