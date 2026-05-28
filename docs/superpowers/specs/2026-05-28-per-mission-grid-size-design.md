# Spec: Per-Mission Grid Size

**Date:** 2026-05-28  
**Status:** approved

## Problem

`Grid` размер жёстко зашит константой `GRID_SIZE = 20` в двух местах (`Grid.ts` и `renderer/config.ts`). Все миссии используют одинаковое поле 20×20, которое слишком мало — начальный зум слишком крупный.

## Goal

- Размер поля задаётся для каждой миссии произвольно через конструктор `Grid`
- Минимальный размер — 30×30, проверяется в конструкторе
- Рендерер читает размеры из экземпляра `Grid` в рантайме
- Камера стартует с `zoom = 1.0`, минимальный зум — contain (всё поле видно)

---

## Design

### 1. Grid (simulation layer)

**Файл:** `src/game/simulation/world/Grid.ts`

- Константа `GRID_SIZE = 20` удаляется
- Добавляется `const GRID_MIN = 30`
- Конструктор принимает `width` и `height` (оба по умолчанию `GRID_MIN`)
- Если `width < GRID_MIN` или `height < GRID_MIN` — выбрасывается `Error`
- Добавляются геттеры `get width()` и `get height()`
- Все внутренние методы (`inBounds`, `neighbours`, конструктор массива) заменяют `GRID_SIZE` на `this._width` / `this._height`

```ts
const GRID_MIN = 30;

export class Grid {
  private readonly _width: number;
  private readonly _height: number;
  private cells: CellType[][];

  constructor(width = GRID_MIN, height = GRID_MIN) {
    if (width < GRID_MIN || height < GRID_MIN)
      throw new Error(`Grid size must be at least ${GRID_MIN}×${GRID_MIN}, got ${width}×${height}`);
    this._width = width;
    this._height = height;
    this.cells = Array.from({ length: height }, () =>
      Array<CellType>(width).fill('empty')
    );
  }

  get width(): number { return this._width; }
  get height(): number { return this._height; }

  // inBounds использует this._width / this._height
}
```

### 2. Миссии

**Файлы:** `src/game/missions/mission1.ts` — `mission4.ts`

Все миссии переходят на `new Grid(30, 30)`. Размер задаётся явно, без аргументов-по-умолчанию — чтобы размер был виден в коде миссии.

### 3. Renderer config

**Файл:** `src/renderer/config.ts`

Удаляются константы:
- `GRID_SIZE`
- `CANVAS_W`
- `CANVAS_H`

`TILE_SIZE = 40` остаётся.

### 4. GameScene

**Файл:** `src/renderer/scenes/GameScene.ts`

- `GRID_SIZE`, `CANVAS_W`, `CANVAS_H` убираются из импорта `config.ts`
- В `create()` после получения `this._grid` вычисляются локальные переменные:

```ts
const worldW = this._grid.width * TILE_SIZE;
const worldH = this._grid.height * TILE_SIZE;
```

- `worldW` и `worldH` передаются в `drawTileMap(worldW, worldH)` и `setupCamera(worldW, worldH)`

**drawTileMap:** цикл по `this._grid.width` / `this._grid.height` вместо `GRID_SIZE`

**setupCamera:** 

```ts
private setupCamera(worldW: number, worldH: number): void {
  const cam = this.cameras.main;
  const maxZoom = 2.0;

  cam.setBounds(0, 0, worldW, worldH);
  cam.setBackgroundColor(COLORS.BG);

  const computeMinZoom = (): number => {
    const vw = this.scale.gameSize.width;
    const vh = this.scale.gameSize.height;
    if (vw === 0 || vh === 0) return 0.1;
    // contain: весь мир виден, пользователь может зумироваться назад чтобы увидеть всё поле
    return Math.min(vw / worldW, vh / worldH);
  };

  // Начальный зум — всегда 1.0, камера центрируется на центре мира
  cam.setZoom(1.0);
  cam.centerOn(worldW / 2, worldH / 2);

  // После первого resize Phaser пересчитывает размеры — клипируем зум
  this.time.delayedCall(0, () => {
    const minZoom = computeMinZoom();
    if (cam.zoom < minZoom) cam.setZoom(minZoom);
  });

  this.scale.on('resize', () => {
    const minZoom = computeMinZoom();
    if (cam.zoom < minZoom) cam.setZoom(minZoom);
  });

  // drag и wheel zoom остаются без изменений
}
```

`userZoomed` флаг удаляется — он больше не нужен (resize больше не сбрасывает зум к fit).

---

## Files changed

| Файл | Тип изменения |
|---|---|
| `src/game/simulation/world/Grid.ts` | modify |
| `src/renderer/config.ts` | modify (удалить 3 константы) |
| `src/renderer/scenes/GameScene.ts` | modify |
| `src/game/missions/mission1.ts` | modify |
| `src/game/missions/mission2.ts` | modify |
| `src/game/missions/mission3.ts` | modify |
| `src/game/missions/mission4.ts` | modify |

## Out of scope

- Изменение `TILE_SIZE` — остаётся 40
- Прямоугольные (не квадратные) поля — поддерживаются архитектурой, но все текущие миссии используют квадрат
- UI-отображение размера поля
