# WorldObjectType Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ввести единый тип `WorldObjectType = "mine" | "base" | "charger"` в `src/shared/types/index.ts` и устранить все инлайновые union'ы и дублирующие локальные типы по кодовой базе.

**Architecture:** `WorldObjectType` определяется в `src/shared/types/index.ts` — минимальном shared слое без зависимостей. `src/game/code/types.ts` делает `EntityType = WorldObjectType | "drone"` производным. `src/shared/constants/cellTypes.ts` использует `WorldObjectType` как основу для `CellType`. Все инлайновые `"mine" | "base" | "charger"` заменяются на импорт `WorldObjectType`.

**Tech Stack:** TypeScript, Vitest (unit tests).

## Global Constraints

- Не трогать `SpriteType` в `src/game/simulation/components/Renderable.ts` — Phaser-слой, своя семантика
- Не добавлять аннотации типов там, где TypeScript выводит их из литеральных значений (миссии, тесты без явных type annotations)
- Ветка: `feat/world-api`
- После каждого таска: `npm run type-check` должен проходить без ошибок

---

## Файлы, затронутые рефакторингом

| Файл | Действие |
|------|----------|
| `src/shared/types/index.ts` | Добавить `WorldObjectType` |
| `src/game/code/types.ts` | `EntityType` → производный от `WorldObjectType` |
| `src/shared/constants/cellTypes.ts` | `CellType` использует `WorldObjectType` |
| `src/game/code/worldSnapshot.ts` | Удалить локальный `StaticType`, импортировать `WorldObjectType` |
| `src/game/code/CodeBehaviorDriver.ts` | Заменить 2 инлайновых union |
| `src/shared/store/gameStore.ts` | Заменить 2 инлайновых union |
| `src/game/missions/types.ts` | Удалить дублирующий `EntityType`, ввести `WorldObjectType` |
| `src/game/code/CodeBehaviorDriver.test.ts` | Заменить 1 инлайновый union |

---

### Task 1: Добавить `WorldObjectType` в shared типы и обновить зависимые типы

**Files:**
- Modify: `src/shared/types/index.ts`
- Modify: `src/game/code/types.ts`
- Modify: `src/shared/constants/cellTypes.ts`

**Interfaces:**
- Produces: `WorldObjectType` — экспортируется из `src/shared/types/index.ts`, используется в Tasks 2–4

- [ ] **Step 1: Добавить `WorldObjectType` в `src/shared/types/index.ts`**

Открой файл. Сейчас он содержит `EntityId`, `ComponentName`, `Position`. Добавь в конец:

```ts
export type WorldObjectType = "mine" | "base" | "charger";
```

- [ ] **Step 2: Обновить `EntityType` в `src/game/code/types.ts`**

Текущая строка (line 3):
```ts
export type EntityType = "mine" | "base" | "charger" | "drone";
```

Заменить на:
```ts
import type { EntityId, Position, WorldObjectType } from "../../shared/types/index.js";

export type { WorldObjectType };
export type EntityType = WorldObjectType | "drone";
```

Важно: `import type { EntityId, Position }` уже есть в строке 1 файла — нужно добавить `WorldObjectType` к существующему импорту, а не дублировать строку импорта. Итоговый импорт:
```ts
import type { EntityId, Position, WorldObjectType } from "../../shared/types/index.js";
```

И добавить re-export сразу после импорта (перед `EntityType`):
```ts
export type { WorldObjectType };
```

- [ ] **Step 3: Обновить `CellType` в `src/shared/constants/cellTypes.ts`**

Текущее содержимое файла:
```ts
export type CellType = "empty" | "wall" | "mine" | "base" | "charger";
```

Заменить на:
```ts
import type { WorldObjectType } from "../types/index.js";

export type CellType = "empty" | "wall" | WorldObjectType;
```

- [ ] **Step 4: Проверить type-check**

```
npm run type-check
```

Ожидаем: 0 ошибок. Если есть ошибки — исправить до перехода к следующему шагу.

- [ ] **Step 5: Commit**

```bash
git add src/shared/types/index.ts src/game/code/types.ts src/shared/constants/cellTypes.ts
git commit -m "refactor: ввести WorldObjectType как базовый тип объектов мира"
```

---

### Task 2: Устранить локальный `StaticType` в `worldSnapshot.ts`

**Files:**
- Modify: `src/game/code/worldSnapshot.ts`

**Interfaces:**
- Consumes: `WorldObjectType` из `src/game/code/types.ts` (re-export из `shared/types/index.ts`)

- [ ] **Step 1: Обновить импорты в `worldSnapshot.ts`**

Текущий импорт (line 1–10):
```ts
import type { EntityId } from "../../shared/types/index.js";
import type { World } from "../simulation/world/World.js";
import { freeSlotsCount } from "../simulation/world/workSlots.js";
import type {
  BaseSnap,
  ChargerSnap,
  DroneSnap,
  MineSnap,
  WorldSnapshot,
} from "./types.js";
```

Заменить на:
```ts
import type { EntityId, WorldObjectType } from "../../shared/types/index.js";
import type { World } from "../simulation/world/World.js";
import { freeSlotsCount } from "../simulation/world/workSlots.js";
import type {
  BaseSnap,
  ChargerSnap,
  DroneSnap,
  MineSnap,
  WorldSnapshot,
} from "./types.js";
```

- [ ] **Step 2: Удалить локальный `StaticType`, обновить сигнатуру `collectWorld`**

Удалить строку 13:
```ts
type StaticType = "mine" | "base" | "charger";
```

В сигнатуре функции `collectWorld` (line 37–41) заменить `StaticType` на `WorldObjectType`:
```ts
export function collectWorld(
  world: World,
  droneId: EntityId,
  typeMap: ReadonlyMap<EntityId, WorldObjectType>,
): WorldSnapshot {
```

- [ ] **Step 3: Проверить type-check**

```
npm run type-check
```

Ожидаем: 0 ошибок.

- [ ] **Step 4: Commit**

```bash
git add src/game/code/worldSnapshot.ts
git commit -m "refactor: заменить локальный StaticType на WorldObjectType"
```

---

### Task 3: Обновить `CodeBehaviorDriver.ts` и его тест

**Files:**
- Modify: `src/game/code/CodeBehaviorDriver.ts`
- Modify: `src/game/code/CodeBehaviorDriver.test.ts`

**Interfaces:**
- Consumes: `WorldObjectType` из `src/shared/types/index.ts`

- [ ] **Step 1: Добавить импорт `WorldObjectType` в `CodeBehaviorDriver.ts`**

Текущий импорт (line 1):
```ts
import type { EntityId } from "../../shared/types/index.js";
```

Заменить на:
```ts
import type { EntityId, WorldObjectType } from "../../shared/types/index.js";
```

- [ ] **Step 2: Заменить 2 инлайновых union в `CodeBehaviorDriver.ts`**

Line 33 в `CodeBehaviorDriverOptions`:
```ts
  typeMap?: ReadonlyMap<EntityId, "mine" | "base" | "charger">;
```
→
```ts
  typeMap?: ReadonlyMap<EntityId, WorldObjectType>;
```

Line 45 в классе `CodeBehaviorDriver`:
```ts
  private readonly typeMap: ReadonlyMap<EntityId, "mine" | "base" | "charger">;
```
→
```ts
  private readonly typeMap: ReadonlyMap<EntityId, WorldObjectType>;
```

- [ ] **Step 3: Обновить тест `CodeBehaviorDriver.test.ts`**

Line 109:
```ts
    const typeMap = new Map<number, "mine" | "base" | "charger">([
```
→
```ts
    const typeMap = new Map<number, WorldObjectType>([
```

Добавить импорт в начало файла (после существующих импортов):
```ts
import type { WorldObjectType } from "../../../shared/types/index.js";
```

- [ ] **Step 4: Проверить type-check и тесты**

```
npm run type-check
npm test -- CodeBehaviorDriver
```

Ожидаем: type-check без ошибок, тесты зелёные.

- [ ] **Step 5: Commit**

```bash
git add src/game/code/CodeBehaviorDriver.ts src/game/code/CodeBehaviorDriver.test.ts
git commit -m "refactor: заменить инлайновые union на WorldObjectType в CodeBehaviorDriver"
```

---

### Task 4: Обновить `gameStore.ts` и `missions/types.ts`

**Files:**
- Modify: `src/shared/store/gameStore.ts`
- Modify: `src/game/missions/types.ts`

**Interfaces:**
- Consumes: `WorldObjectType` из `src/shared/types/index.ts`

- [ ] **Step 1: Обновить импорт в `gameStore.ts`**

Текущий импорт (line 2):
```ts
import type { EntityId } from "../types/index.js";
```

Заменить на:
```ts
import type { EntityId, WorldObjectType } from "../types/index.js";
```

- [ ] **Step 2: Заменить 2 инлайновых union в `gameStore.ts`**

Line 103–106 (параметр `staticEntities` в `init`):
```ts
      staticEntities?: ReadonlyArray<{
        id: EntityId;
        type: "mine" | "base" | "charger";
      }>;
```
→
```ts
      staticEntities?: ReadonlyArray<{
        id: EntityId;
        type: WorldObjectType;
      }>;
```

Line 208 (в теле `init`):
```ts
    const typeMap = new Map<EntityId, "mine" | "base" | "charger">(
```
→
```ts
    const typeMap = new Map<EntityId, WorldObjectType>(
```

- [ ] **Step 3: Обновить `missions/types.ts`**

Текущее содержимое (lines 1–7 с локальным `EntityType`):
```ts
import type { EntityId } from "../../shared/types/index.js";
import type { World } from "../simulation/world/World.js";
import type { Grid } from "../simulation/world/Grid.js";
import type { ProgramRegistry } from "../programs/types.js";
import type { GameConfig } from "../types.js";

export type EntityType = "mine" | "base" | "charger";
```

Заменить на:
```ts
import type { EntityId, WorldObjectType } from "../../shared/types/index.js";
import type { World } from "../simulation/world/World.js";
import type { Grid } from "../simulation/world/Grid.js";
import type { ProgramRegistry } from "../programs/types.js";
import type { GameConfig } from "../types.js";
```

В `EntityMeta` (line 9–13) заменить `EntityType` на `WorldObjectType`:
```ts
export interface EntityMeta {
  id: EntityId;
  type: WorldObjectType;
  label: string;
}
```

В `SceneResult` (line 20) заменить `EntityType` на `WorldObjectType`:
```ts
  staticEntities: Array<{ id: EntityId; type: WorldObjectType }>;
```

- [ ] **Step 4: Проверить type-check и все тесты**

```
npm run type-check
npm test
```

Ожидаем: type-check без ошибок, все тесты зелёные.

- [ ] **Step 5: Проверить что инлайновых union не осталось**

```bash
grep -r '"mine" | "base"' src/
```

Ожидаем: нет вывода (0 совпадений).

- [ ] **Step 6: Commit**

```bash
git add src/shared/store/gameStore.ts src/game/missions/types.ts
git commit -m "refactor: устранить дублирующий EntityType в missions, заменить inline union в gameStore"
```
