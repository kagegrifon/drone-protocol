# Система модификаторов дрона

**Статус:** planned

## Зачем

Сейчас скорость движения и доступность действий дрона определяются жёстко: `Movement.speed = 1.0` всегда, MINE/DROP/CHARGE работают если выполнены позиционные условия. Игрок не имеет обратной связи о том, что состояние дрона (нулевая энергия, забитый инвентарь) должно влиять на эффективность.

Вводим **систему модификаторов** — расширяемый механизм для управления параметрами дрона в зависимости от его состояния и (в будущем) внешних эффектов. MVP включает два модификатора: `drained` (обесточен — нулевая энергия) и `overloaded` (загрузка инвентаря >30%). Архитектура заранее рассчитана на расширение: апгрейды, бафы, временные эффекты.

## Поведение

### Модификатор `drained` (обесточен)

**Активация (с гистерезисом):**
- Активируется, когда `energy.current === 0`.
- Снимается, когда `energy.current ≥ DRAINED_EXIT_THRESHOLD` (5% от `energy.max`, т.е. 5 при `max=100`).
- Пока `0 < energy.current < 5` — модификатор остаётся активным (предотвращает «мигание» при пассивной зарядке).

**Эффекты:**
- `moveSpeedMul = 0.5` — MOVE_TO идёт на 50% скорости.
- `canMine = false` — команда MINE завершается сразу без эффекта (как при пустом депозите).
- `canDrop = false` — команда DROP завершается сразу без эффекта (как при пустом инвентаре).
- CHARGE — без изменений: и активная команда, и пассивная подзарядка работают нормально.

### Модификатор `overloaded` (загрузка инвентаря)

**Активация (мгновенная, без гистерезиса):**
- `load = inventory.ore / inventory.capacity`
- `load ≤ 0.30` — не активен.
- `0.30 < load ≤ 0.50` → уровень `light`.
- `0.50 < load ≤ 0.70` → уровень `medium`.
- `load > 0.70` → уровень `heavy` (включая 100%).

**Эффекты по уровням:**
- `light`: `moveSpeedMul = 0.9`
- `medium`: `moveSpeedMul = 0.8`
- `heavy`: `moveSpeedMul = 0.7`

На MINE/DROP/CHARGE влияния нет.

### Стакание

Множители скорости перемножаются: `effectiveMul = ∏ mod.moveSpeedMul`.

Пример: дрон полностью загружен (>70%) и обесточен → `0.7 × 0.5 = 0.35` от базовой скорости.

Логические флаги (`canMine`, `canDrop`) комбинируются по И: действие разрешено, только если ни один активный модификатор его не запрещает.

## Критерии готовности

**Юнит-тесты `ModifiersSystem.test.ts`:**
- Загрузка инвентаря: проверка всех порогов (0, 30%, 30.01%, 50%, 50.01%, 70%, 70.01%, 100%) → ожидаемый список модификаторов.
- `drained` активируется при `energy.current === 0`.
- Гистерезис `drained`: при `energy.current` от 1 до 4 модификатор сохраняется, при 5 — снимается.
- Несколько модификаторов одновременно (drained + overloaded:heavy) — оба в списке.

**Юнит-тесты `effects.test.ts`:**
- `getMoveSpeedMul([])` === 1.
- `getMoveSpeedMul(['drained'])` === 0.5.
- `getMoveSpeedMul(['overloaded:heavy'])` === 0.7.
- `getMoveSpeedMul(['drained', 'overloaded:heavy'])` === 0.35 (с EPSILON).
- `canMine`/`canDrop` ложны при `drained`, истинны иначе.

**Юнит-тесты `MovementSystem.test.ts` (обновить):**
- Дрон с пустым инвентарём и полной энергией движется на базовой скорости.
- Дрон с `inventory.ore = 8, capacity = 10` (80%) тратит на шаг в 1/0.7 ≈ 1.43× больше времени.
- Дрон с нулевой энергией и пустым инвентарём движется в 2× медленнее (mul = 0.5).

**Юнит-тесты `MiningSystem.test.ts` (обновить):**
- MINE при `energy.current === 0` завершается сразу, депозит и инвентарь не меняются, время не идёт.
- DROP при `energy.current === 0` завершается сразу, инвентарь дрона и склад базы не меняются.

**E2E (Playwright):** сценарий — дрон с программой `LOOP { MOVE_TO(mine) → MINE → MOVE_TO(base) → DROP }` при достижении 80% загрузки видимо замедляется (тайминг хода между клетками увеличивается). Собрать через telemetry или статистику симуляции, не через визуал.

**Запись в `DECISIONS.md`:** «Скорость дрона и доступность действий считаются через систему модификаторов. Список активных модификаторов хранится в компоненте `Modifiers`, пересчитывается `ModifiersSystem` каждый тик. Эффекты применяются мультипликативно для числовых параметров и через И для логических флагов.»

**Type-check и линт проходят** (`npm run type-check`, `npm test`, `npm run test:e2e`).

## Технические заметки

### Новый компонент `Modifiers`

[src/game/simulation/components/Modifiers.ts](src/game/simulation/components/Modifiers.ts):

```typescript
export type ModifierId = 'drained' | 'overloaded:light' | 'overloaded:medium' | 'overloaded:heavy';

export interface ModifiersComponent {
  active: ModifierId[]; // канонический отсортированный порядок, без дубликатов
}
```

Регистрируется в `World` рядом с остальными компонентами. Добавляется в [createDrone.ts](src/game/simulation/entities/createDrone.ts) с `active: []`.

### Новый `ModifiersSystem`

[src/game/simulation/systems/ModifiersSystem.ts](src/game/simulation/systems/ModifiersSystem.ts) — пересчитывает список активных модификаторов каждый тик. Не эмитит событий в MVP — события (`modifier:applied`, `modifier:removed`) добавятся вместе с UI-фичей.

### Чистая функция расчёта эффектов

[src/game/simulation/modifiers/effects.ts](src/game/simulation/modifiers/effects.ts) — единственный источник правды о влиянии модификаторов на параметры. Использует константы из [constants.ts](src/game/simulation/constants.ts).

### Tick order

```
CollisionSystem → ModifiersSystem → ProgramExecutionSystem → MovementSystem → MiningSystem → EnergySystem → StatisticsSystem
```

`ModifiersSystem` идёт до систем, которые читают модификаторы, и после `CollisionSystem`.

### Новые константы

```typescript
export const DRAINED_SPEED_MUL = 0.5;
export const DRAINED_EXIT_RATIO = 0.05; // 5% от max
export const OVERLOAD_THRESHOLDS = [
  { minRatio: 0.30, mul: 0.9, id: 'overloaded:light' as const },
  { minRatio: 0.50, mul: 0.8, id: 'overloaded:medium' as const },
  { minRatio: 0.70, mul: 0.7, id: 'overloaded:heavy' as const },
];
```

### Файлы для изменения

**Создать:**
- `src/game/simulation/components/Modifiers.ts`
- `src/game/simulation/systems/ModifiersSystem.ts`
- `src/game/simulation/systems/ModifiersSystem.test.ts`
- `src/game/simulation/modifiers/effects.ts`
- `src/game/simulation/modifiers/effects.test.ts`

**Изменить:**
- `src/game/simulation/world/World.ts` — регистрация нового компонента.
- `src/game/simulation/entities/createDrone.ts` — добавить компонент с пустым списком.
- `src/game/simulation/constants.ts` — новые константы, удалить неиспользуемую `getMoveSpeed`.
- `src/game/simulation/systems/MovementSystem.ts` — умножить на `getMoveSpeedMul`.
- `src/game/simulation/systems/MiningSystem.ts` — early-return при `!canMine` / `!canDrop`.
- `src/game/simulation/index.ts` — добавить `ModifiersSystem` в tick order.
- `src/game/simulation/systems/MovementSystem.test.ts`, `MiningSystem.test.ts` — обновить.
- `DECISIONS.md` — запись о системе модификаторов.

### Что НЕ входит в скоуп

- UI/визуальная индикация модификаторов — отдельная фича `drone-modifiers-ui`.
- События `modifier:applied` / `modifier:removed`.
- Модификаторы помимо `drained` и `overloaded:*` (апгрейды, временные эффекты, баффы программ).
