# Camera Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить стартовый фокус камеры на первом дроне миссии и плавный перелёт камеры при выборе дрона.

**Architecture:** `SceneResult.focusPoint` (тайловые координаты) передаётся через `GameRenderer` в Phaser registry, откуда `GameScene.setupCamera` читает его для начального `cam.centerOn`. При смене `selectedDroneId` в store `GameScene.syncSprites` вызывает `cam.pan(sprite.x, sprite.y, 500, "Sine.easeInOut")`.

**Tech Stack:** TypeScript, Phaser 3, Zustand.

## Global Constraints

- Не изменять логику симуляции (`src/game/simulation/`) — только типы миссий и рендерер.
- `focusPoint` — тайловые координаты `{ x: number; y: number }`, конвертация в пиксели: `x * TILE_SIZE + TILE_SIZE / 2`.
- `TILE_SIZE` импортируется из `src/renderer/config.ts` в `GameScene`.
- Все существующие тесты должны проходить после каждого таска.
- Формат коммитов: `<type>: <описание> (Phase N)` + `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.

---

## Files Modified

| Файл | Что меняется |
|------|-------------|
| `src/game/missions/types.ts` | Добавить `focusPoint: { x: number; y: number }` в `SceneResult` |
| `src/game/missions/mission1.ts` | Добавить `focusPoint: { x: 5, y: 5 }` в return |
| `src/game/missions/mission2.ts` | Добавить `focusPoint: { x: 5, y: 5 }` в return |
| `src/game/missions/mission3.ts` | Добавить `focusPoint: { x: 4, y: 4 }` в return |
| `src/game/missions/mission4.ts` | Добавить `focusPoint: { x: 4, y: 4 }` в return |
| `src/renderer/GameRenderer.ts` | Добавить `focusPoint` в `GameRendererOptions`, класть в registry |
| `src/game/GameController.ts` | Передавать `scene.focusPoint` в `GameRenderer` |
| `src/renderer/scenes/GameScene.ts` | Читать `focusPoint` в `setupCamera`, добавить pan в `syncSprites` |

---

## Task 1: Добавить `focusPoint` в типы и миссии

**Files:**
- Modify: `src/game/missions/types.ts`
- Modify: `src/game/missions/mission1.ts`
- Modify: `src/game/missions/mission2.ts`
- Modify: `src/game/missions/mission3.ts`
- Modify: `src/game/missions/mission4.ts`

**Interfaces:**
- Produces: `SceneResult.focusPoint: { x: number; y: number }` — используется в Task 2

- [ ] **Step 1: Добавить поле в `SceneResult`**

В `src/game/missions/types.ts` изменить интерфейс `SceneResult`:

```ts
export interface SceneResult {
  world: World;
  grid: Grid;
  registry: ProgramRegistry;
  baseId: EntityId;
  staticEntities: Array<{ id: EntityId; type: EntityType }>;
  focusPoint: { x: number; y: number };
}
```

- [ ] **Step 2: Убедиться, что TypeScript падает на миссиях без `focusPoint`**

```
npm run type-check
```

Ожидается: ошибки вида `Property 'focusPoint' is missing in type ...` для mission1–4.

- [ ] **Step 3: Добавить `focusPoint` в mission1**

В `src/game/missions/mission1.ts` в конец `return { ... }` добавить поле. Дрон создаётся как `createDrone(world, 5, 5)`:

```ts
return {
  world,
  grid,
  registry,
  baseId,
  staticEntities: [...],
  focusPoint: { x: 5, y: 5 },
};
```

- [ ] **Step 4: Добавить `focusPoint` в mission2**

В `src/game/missions/mission2.ts`. Дрон: `createDrone(world, 5, 5)`:

```ts
return {
  world,
  grid,
  registry,
  baseId,
  staticEntities: [...],
  focusPoint: { x: 5, y: 5 },
};
```

- [ ] **Step 5: Добавить `focusPoint` в mission3**

В `src/game/missions/mission3.ts`. Первый дрон: `createDrone(world, 4, 4)`:

```ts
return {
  world,
  grid,
  registry,
  baseId,
  staticEntities: [...],
  focusPoint: { x: 4, y: 4 },
};
```

- [ ] **Step 6: Добавить `focusPoint` в mission4**

В `src/game/missions/mission4.ts`. Первый дрон: `createDrone(world, 4, 4)`:

```ts
return {
  world,
  grid,
  registry,
  baseId,
  staticEntities: [...],
  focusPoint: { x: 4, y: 4 },
};
```

- [ ] **Step 7: Проверить типы**

```
npm run type-check
```

Ожидается: 0 ошибок.

- [ ] **Step 8: Запустить тесты**

```
npm test
```

Ожидается: все тесты проходят.

- [ ] **Step 9: Коммит**

```bash
git add src/game/missions/types.ts src/game/missions/mission1.ts src/game/missions/mission2.ts src/game/missions/mission3.ts src/game/missions/mission4.ts
git commit -m "feat: добавить focusPoint в SceneResult и все миссии (Phase 1)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Передать `focusPoint` через `GameRenderer` в Phaser registry

**Files:**
- Modify: `src/renderer/GameRenderer.ts`
- Modify: `src/game/GameController.ts`

**Interfaces:**
- Consumes: `SceneResult.focusPoint: { x: number; y: number }` из Task 1
- Produces: `game.registry` содержит ключ `"focusPoint"` со значением `{ x: number; y: number }` — читается в Task 3

- [ ] **Step 1: Добавить `focusPoint` в `GameRendererOptions`**

В `src/renderer/GameRenderer.ts`:

```ts
export interface GameRendererOptions {
  onDroneClick?: (id: EntityId) => void;
  onReady?: () => void;
  onAudioReady?: (am: AudioManager) => void;
  focusPoint: { x: number; y: number };
}
```

- [ ] **Step 2: Класть `focusPoint` в registry в `preBoot`**

В том же файле в `callbacks.preBoot`:

```ts
callbacks: {
  preBoot: (game: Phaser.Game) => {
    game.registry.set("world", world);
    game.registry.set("grid", grid);
    game.registry.set("focusPoint", options.focusPoint);
    if (options.onDroneClick)
      game.registry.set("onDroneClick", options.onDroneClick);
    if (options.onReady) game.registry.set("onReady", options.onReady);
    if (options.onAudioReady)
      game.registry.set("onAudioReady", options.onAudioReady);
  },
},
```

- [ ] **Step 3: Передать `focusPoint` из `GameController.initWorld`**

В `src/game/GameController.ts`, метод `initWorld` (строка ~129):

```ts
this.renderer = new GameRenderer(scene.world, scene.grid, this.container!, {
  onDroneClick: this._setupOptions?.onDroneClick,
  onReady: this._setupOptions?.onReady,
  onAudioReady: this._setupOptions?.onAudioReady,
  focusPoint: scene.focusPoint,
});
```

- [ ] **Step 4: Проверить типы**

```
npm run type-check
```

Ожидается: 0 ошибок.

- [ ] **Step 5: Запустить тесты**

```
npm test
```

Ожидается: все тесты проходят.

- [ ] **Step 6: Коммит**

```bash
git add src/renderer/GameRenderer.ts src/game/GameController.ts
git commit -m "feat: передать focusPoint через GameRenderer в Phaser registry (Phase 2)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Использовать `focusPoint` в камере и добавить pan при выборе дрона

**Files:**
- Modify: `src/renderer/scenes/GameScene.ts`

**Interfaces:**
- Consumes: `game.registry.get("focusPoint")` → `{ x: number; y: number }` из Task 2
- Consumes: `TILE_SIZE` — уже импортирован в `GameScene.ts`
- Consumes: `useGameStore.getState().selectedDroneId` — уже используется в `syncSprites`

- [ ] **Step 1: Читать `focusPoint` в `setupCamera` и центрировать камеру**

В `src/renderer/scenes/GameScene.ts`, метод `setupCamera` (строка ~291). Найти строку:

```ts
cam.setZoom(1.0);
cam.centerOn(worldW / 2, worldH / 2);
```

Заменить на:

```ts
cam.setZoom(1.0);
const fp = this.registry.get("focusPoint") as
  | { x: number; y: number }
  | undefined;
const cx = fp ? fp.x * TILE_SIZE + TILE_SIZE / 2 : worldW / 2;
const cy = fp ? fp.y * TILE_SIZE + TILE_SIZE / 2 : worldH / 2;
cam.centerOn(cx, cy);
```

- [ ] **Step 2: Добавить поле `_lastSelectedId` в класс `GameScene`**

В блоке объявления полей класса (строки 14–22) добавить:

```ts
private _lastSelectedId: EntityId | null = null;
```

- [ ] **Step 3: Добавить pan в `syncSprites`**

В методе `syncSprites` (строка ~199) после строки:

```ts
const selectedId = store.selectedDroneId;
```

Вставить:

```ts
if (selectedId !== null && selectedId !== this._lastSelectedId) {
  const sprite = this._droneSprites.get(selectedId);
  if (sprite) {
    this.cameras.main.pan(sprite.x, sprite.y, 500, "Sine.easeInOut");
  }
}
this._lastSelectedId = selectedId;
```

- [ ] **Step 4: Проверить типы**

```
npm run type-check
```

Ожидается: 0 ошибок.

- [ ] **Step 5: Запустить тесты**

```
npm test
```

Ожидается: все тесты проходят.

- [ ] **Step 6: Ручная проверка в браузере**

```
npm run dev
```

Проверить:
1. Открыть любую миссию — камера стартует на первом дроне, а не в центре карты.
2. Кликнуть на другой дрон (если миссия 3 или 4) — камера плавно летит к нему ~500 мс.
3. Во время или после pan потянуть карту мышью — drag работает без рывков.
4. Выбрать тот же дрон повторно — pan не должен повторяться (условие `selectedId !== this._lastSelectedId`).

- [ ] **Step 7: Коммит**

```bash
git add src/renderer/scenes/GameScene.ts
git commit -m "feat: стартовый фокус камеры на дроне и pan при выборе (Phase 3)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
