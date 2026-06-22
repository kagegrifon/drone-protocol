# Design: Рефакторинг типов WorldObjectType

**Дата:** 2026-06-22  
**Ветка:** `feat/world-api`

---

## Контекст

По кодовой базе разбросаны инлайновые union типы `"mine" | "base" | "charger"` (7 файлов, ~10 мест), а также дублирующие named типы (`EntityType` в `missions/types.ts`, `StaticType` в `worldSnapshot.ts`). Это приводит к ошибкам при добавлении новых типов объектов — нужно обновлять каждое место вручную.

---

## Цель

Ввести единый named тип `WorldObjectType = "mine" | "base" | "charger"` как единственный источник правды для статических объектов мира (всё кроме дрона). Устранить дублирование и инлайновые union'ы.

---

## Архитектура после рефакторинга

### Новые типы в `src/game/code/types.ts`

```ts
export type WorldObjectType = "mine" | "base" | "charger";
export type EntityType = WorldObjectType | "drone";  // производный
```

`EntityType` остаётся для обратной совместимости с `BaseEntitySnap.type` и snap-интерфейсами.

### Место определения `WorldObjectType`

`WorldObjectType` размещается в **`src/shared/types/index.ts`** (а не в `game/code/types.ts`), потому что:
- `shared/constants/cellTypes.ts` должен быть независим от `game/` слоя
- `src/game/code/types.ts` уже импортирует из `shared/types/index.ts` — направление зависимостей сохраняется

```ts
// src/shared/types/index.ts — добавить:
export type WorldObjectType = "mine" | "base" | "charger";
```

```ts
// src/game/code/types.ts — обновить:
import type { WorldObjectType, EntityId, Position } from "../../shared/types/index.js";
export type EntityType = WorldObjectType | "drone";
```

### Обновление `src/shared/constants/cellTypes.ts`

```ts
import type { WorldObjectType } from "../types/index.js";
export type CellType = "empty" | "wall" | WorldObjectType;
```

Семантическая связь: CellType = навигационные типы + типы объектов мира. Зависимость `shared → shared` — чисто.

---

## Файлы для изменения

| Файл | Что меняем |
|------|-----------|
| `src/game/code/types.ts` | Добавить `WorldObjectType`, `EntityType` сделать производным |
| `src/shared/constants/cellTypes.ts` | `CellType` использует `WorldObjectType` |
| `src/game/code/worldSnapshot.ts` | Удалить локальный `StaticType`, импортировать `WorldObjectType` |
| `src/game/code/CodeBehaviorDriver.ts` | Заменить 2 инлайновых union на `WorldObjectType` |
| `src/shared/store/gameStore.ts` | Заменить 2 инлайновых union на `WorldObjectType` |
| `src/game/missions/types.ts` | Удалить дублирующий `EntityType`, импортировать `WorldObjectType` (именно `WorldObjectType`, не `EntityType` — т.к. дроны там не нужны) |
| `src/game/code/CodeBehaviorDriver.test.ts` | Заменить 1 inline в test data |

### Файлы, которые не трогаем

- `src/game/simulation/components/Renderable.ts` (`SpriteType`) — Phaser-слой, своя семантика
- Файлы миссий (`mission1.ts` и т.д.) — там только литеральные значения `"mine"`, `"base"` без union типов, TypeScript выведет тип сам
- Тесты codeRuntime / NodeWorkerPort — аналогично, literal values без аннотаций

---

## Направления зависимостей

После рефакторинга: `shared/types` ← `shared/constants` ← `game/code` ← `shared/store`  
Всё в одном направлении, циклов нет.

---

## Верификация

1. `npm run type-check` — должен пройти без ошибок
2. `npm test` — unit тесты зелёные
3. Grep: `grep -r '"mine" | "base"' src/` — должен вернуть 0 результатов
