# Camera Focus Design

## Context

Камера в `GameScene` всегда стартует в центре карты и при выборе дрона никак не реагирует. Нужно:
1. Дать каждой миссии возможность задать стартовую точку фокуса (например, на первом дроне).
2. При клике/выборе дрона — плавно переместить камеру к нему.

## Scope

- `focusPoint` — **обязательное** поле в `SceneResult`, каждая миссия обязана его задать.
- При выборе дрона — однократный `cam.pan()` с анимацией ~500 мс, после чего пользователь свободно панорамирует/зумирует.
- Follow-режим (постоянное слежение) — **не входит** в эту итерацию.

---

## Part 1: Mission Focus Point

### Types (`src/game/missions/types.ts`)

Добавить поле в `SceneResult`:

```ts
export interface SceneResult {
  world: World;
  grid: Grid;
  registry: ProgramRegistry;
  baseId: EntityId;
  staticEntities: Array<{ id: EntityId; type: EntityType }>;
  focusPoint: { x: number; y: number };  // тайловые координаты
}
```

`MissionDef` не меняется — `focusPoint` живёт в `SceneResult`, который возвращает `buildScene()`.

### Data flow

```
buildScene() → SceneResult.focusPoint
  → GameController.initWorld() → new GameRenderer(…, { focusPoint })
    → game.registry.set("focusPoint", focusPoint)    // в preBoot
      → GameScene.setupCamera() → cam.centerOn(fx, fy)
```

### `GameRenderer` (`src/renderer/GameRenderer.ts`)

- Добавить `focusPoint: { x: number; y: number }` в `GameRendererOptions`.
- В `preBoot`: `game.registry.set("focusPoint", options.focusPoint)`.

### `GameController.initWorld` (`src/game/GameController.ts:121`)

Передать `scene.focusPoint` в `GameRenderer`:

```ts
this.renderer = new GameRenderer(scene.world, scene.grid, this.container!, {
  …,
  focusPoint: scene.focusPoint,
});
```

### `GameScene.setupCamera` (`src/renderer/scenes/GameScene.ts:291`)

Заменить хардкод `worldW/2, worldH/2`:

```ts
const fp = this.registry.get("focusPoint") as { x: number; y: number } | undefined;
const cx = fp ? fp.x * TILE_SIZE + TILE_SIZE / 2 : worldW / 2;
const cy = fp ? fp.y * TILE_SIZE + TILE_SIZE / 2 : worldH / 2;
cam.centerOn(cx, cy);
```

### Missions (`src/game/missions/mission1.ts`, `mission2.ts`, `mission3.ts`)

Каждая миссия добавляет `focusPoint` в возвращаемый объект — обычно позиция первого дрона:

```ts
return {
  …,
  focusPoint: { x: drone1X, y: drone1Y },
};
```

---

## Part 2: Pan Camera on Drone Selection

### `GameScene` (`src/renderer/scenes/GameScene.ts`)

Добавить поле класса:

```ts
private _lastSelectedId: EntityId | null = null;
```

В `syncSprites()`, после чтения `selectedId` из store и перед основным циклом:

```ts
if (selectedId !== null && selectedId !== this._lastSelectedId) {
  const sprite = this._droneSprites.get(selectedId);
  if (sprite) {
    this.cameras.main.pan(sprite.x, sprite.y, 500, "Sine.easeInOut");
  }
}
this._lastSelectedId = selectedId;
```

`cam.pan()` — встроенный Phaser-метод с easing. Drag-панорамирование корректно прерывает текущий pan (пользователь захватывает `scrollX`/`scrollY` вручную через `pointermove`), конфликтов нет.

---

## Verification

1. Запустить `npm run dev`.
2. Открыть любую миссию — камера должна стартовать на первом дроне, а не в центре карты.
3. Кликнуть на другой дрон — камера плавно летит к нему (~500 мс).
4. После pan потянуть карту мышью — должно работать без рывков.
5. `npm run type-check` — без ошибок (все `buildScene()` возвращают `focusPoint`).
