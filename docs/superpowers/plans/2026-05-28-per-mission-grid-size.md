# Per-Mission Grid Size — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Убрать жёстко зашитый `GRID_SIZE = 20`, сделать `Grid` параметрическим (минимум 30×30), рендерер читает размеры из экземпляра в рантайме, камера стартует на zoom 1.0.

**Architecture:** Simulation-layer `Grid` получает `width`/`height` через конструктор и предоставляет геттеры. Renderer-layer читает `grid.width`/`grid.height` вместо констант из `config.ts`. Константы `GRID_SIZE`, `CANVAS_W`, `CANVAS_H` удаляются полностью.

**Tech Stack:** TypeScript, Phaser 3, Vitest (unit tests).

---

## File Map

| Файл | Действие |
|---|---|
| `src/game/simulation/world/Grid.ts` | modify — добавить `GRID_MIN`, конструктор с параметрами, геттеры, `_width`/`_height` в `inBounds` |
| `src/game/simulation/world/Grid.test.ts` | create — unit тесты для нового API Grid |
| `src/renderer/config.ts` | modify — удалить `GRID_SIZE`, `CANVAS_W`, `CANVAS_H` |
| `src/renderer/scenes/GameScene.ts` | modify — убрать импорт удалённых констант, вычислять `worldW/H` из `grid.width/height`, обновить `drawTileMap` и `setupCamera` |
| `src/game/missions/mission1.ts` | modify — `new Grid(30, 30)` |
| `src/game/missions/mission2.ts` | modify — `new Grid(30, 30)` |
| `src/game/missions/mission3.ts` | modify — `new Grid(30, 30)` |
| `src/game/missions/mission4.ts` | modify — `new Grid(30, 30)` |

---

### Task 1: Grid — тесты и реализация

**Files:**
- Create: `src/game/simulation/world/Grid.test.ts`
- Modify: `src/game/simulation/world/Grid.ts`

- [ ] **Step 1: Написать падающие тесты для Grid**

Создать файл `src/game/simulation/world/Grid.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Grid } from './Grid.js';

describe('Grid constructor', () => {
  it('создаёт поле 30×30 при вызове без аргументов', () => {
    const g = new Grid();
    expect(g.width).toBe(30);
    expect(g.height).toBe(30);
  });

  it('создаёт поле с явными размерами 40×50', () => {
    const g = new Grid(40, 50);
    expect(g.width).toBe(40);
    expect(g.height).toBe(50);
  });

  it('выбрасывает Error при width < 30', () => {
    expect(() => new Grid(20, 30)).toThrow('Grid size must be at least 30×30');
  });

  it('выбрасывает Error при height < 30', () => {
    expect(() => new Grid(30, 20)).toThrow('Grid size must be at least 30×30');
  });

  it('выбрасывает Error при обоих размерах < 30', () => {
    expect(() => new Grid(10, 10)).toThrow('Grid size must be at least 30×30');
  });
});

describe('Grid.getTile / inBounds', () => {
  it('возвращает wall за пределами поля', () => {
    const g = new Grid(30, 30);
    expect(g.getTile(-1, 0)).toBe('wall');
    expect(g.getTile(0, -1)).toBe('wall');
    expect(g.getTile(30, 0)).toBe('wall');
    expect(g.getTile(0, 30)).toBe('wall');
  });

  it('getTile работает в крайних валидных координатах', () => {
    const g = new Grid(30, 30);
    g.setTile(29, 29, 'mine');
    expect(g.getTile(29, 29)).toBe('mine');
  });

  it('инициализирует все клетки как empty', () => {
    const g = new Grid(30, 30);
    expect(g.getTile(0, 0)).toBe('empty');
    expect(g.getTile(15, 15)).toBe('empty');
  });
});

describe('Grid.neighbours', () => {
  it('угловая клетка 0,0 имеет 2 соседа', () => {
    const g = new Grid(30, 30);
    expect(g.neighbours(0, 0)).toHaveLength(2);
  });

  it('центральная клетка имеет 4 соседа', () => {
    const g = new Grid(30, 30);
    expect(g.neighbours(15, 15)).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Запустить тесты — убедиться, что падают**

```
npm test -- Grid.test
```

Ожидаем ошибки: `g.width is not a function` / конструктор без аргументов создаёт 20×20 клеток.

- [ ] **Step 3: Реализовать новый Grid.ts**

Полностью заменить содержимое `src/game/simulation/world/Grid.ts`:

```ts
import type { CellType } from '../../../shared/constants/cellTypes.js';

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

  getTile(x: number, y: number): CellType {
    if (!this.inBounds(x, y)) return 'wall';
    return this.cells[y][x];
  }

  setTile(x: number, y: number, type: CellType): void {
    if (!this.inBounds(x, y)) return;
    this.cells[y][x] = type;
  }

  isWalkable(x: number, y: number): boolean {
    const cell = this.getTile(x, y);
    return cell !== 'wall';
  }

  neighbours(x: number, y: number): { x: number; y: number }[] {
    const dirs = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ];
    const result: { x: number; y: number }[] = [];
    for (const d of dirs) {
      const nx = x + d.x;
      const ny = y + d.y;
      if (this.inBounds(nx, ny)) result.push({ x: nx, y: ny });
    }
    return result;
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this._width && y >= 0 && y < this._height;
  }
}
```

- [ ] **Step 4: Запустить тесты — убедиться, что проходят**

```
npm test -- Grid.test
```

Ожидаем: все тесты PASS.

- [ ] **Step 5: Коммит**

```
git add src/game/simulation/world/Grid.ts src/game/simulation/world/Grid.test.ts
git commit -m "feat: сделать Grid параметрическим с минимальным размером 30×30"
```

---

### Task 2: Миссии — перейти на Grid(30, 30)

**Files:**
- Modify: `src/game/missions/mission1.ts`
- Modify: `src/game/missions/mission2.ts`
- Modify: `src/game/missions/mission3.ts`
- Modify: `src/game/missions/mission4.ts`

- [ ] **Step 1: Заменить `new Grid()` на `new Grid(30, 30)` во всех четырёх миссиях**

В каждом из файлов `mission1.ts`, `mission2.ts`, `mission3.ts`, `mission4.ts` найти строку:

```ts
const grid = new Grid();
```

и заменить на:

```ts
const grid = new Grid(30, 30);
```

- [ ] **Step 2: Запустить все тесты**

```
npm test
```

Ожидаем: все тесты PASS (включая `missions.test.ts`).

- [ ] **Step 3: Коммит**

```
git add src/game/missions/mission1.ts src/game/missions/mission2.ts src/game/missions/mission3.ts src/game/missions/mission4.ts
git commit -m "feat: все миссии переходят на Grid(30, 30)"
```

---

### Task 3: renderer/config.ts — удалить мёртвые константы

**Files:**
- Modify: `src/renderer/config.ts`

- [ ] **Step 1: Удалить константы `GRID_SIZE`, `CANVAS_W`, `CANVAS_H`**

Текущее содержимое начала файла:

```ts
import type { CellType } from '../shared/constants/cellTypes.js';

export const TILE_SIZE = 40;
export const GRID_SIZE = 20;
export const CANVAS_W = TILE_SIZE * GRID_SIZE; // 800
export const CANVAS_H = TILE_SIZE * GRID_SIZE; // 800
```

Заменить на:

```ts
import type { CellType } from '../shared/constants/cellTypes.js';

export const TILE_SIZE = 40;
```

(Остаток файла — `COLORS`, `TILE_COLORS` — не трогать.)

- [ ] **Step 2: Проверить type-check**

```
npm run type-check
```

Ожидаем ошибки в `GameScene.ts` — это нормально, они будут исправлены в следующей задаче. Важно убедиться, что ошибки только там.

- [ ] **Step 3: Коммит пока не делать** — дождаться Task 4.

---

### Task 4: GameScene.ts — читать размеры из grid, обновить камеру

**Files:**
- Modify: `src/renderer/scenes/GameScene.ts`

- [ ] **Step 1: Обновить импорт из config.ts**

Найти строку:

```ts
import { TILE_SIZE, GRID_SIZE, CANVAS_W, CANVAS_H, COLORS, TILE_COLORS } from '../config.js';
```

Заменить на:

```ts
import { TILE_SIZE, COLORS, TILE_COLORS } from '../config.js';
```

- [ ] **Step 2: Обновить метод `create()` — вычислить `worldW`/`worldH` и передать их**

Найти в `create()`:

```ts
this.drawTileMap();
this._trailGraphics = this.add.graphics().setDepth(8);
this.setupEntitySprites();
this.setupCamera();
```

Заменить на:

```ts
const worldW = this._grid.width * TILE_SIZE;
const worldH = this._grid.height * TILE_SIZE;
this.drawTileMap(worldW, worldH);
this._trailGraphics = this.add.graphics().setDepth(8);
this.setupEntitySprites();
this.setupCamera(worldW, worldH);
```

- [ ] **Step 3: Обновить метод `drawTileMap`**

Найти сигнатуру:

```ts
private drawTileMap(): void {
  const g = this.add.graphics().setDepth(0);
  for (let ty = 0; ty < GRID_SIZE; ty++) {
    for (let tx = 0; tx < GRID_SIZE; tx++) {
```

и строки с сеткой:

```ts
  g.lineStyle(1, COLORS.GRID_LINE, 0.25);
  for (let i = 0; i <= GRID_SIZE; i++) {
    g.beginPath(); g.moveTo(i * TILE_SIZE, 0); g.lineTo(i * TILE_SIZE, CANVAS_H); g.strokePath();
    g.beginPath(); g.moveTo(0, i * TILE_SIZE); g.lineTo(CANVAS_W, i * TILE_SIZE); g.strokePath();
  }
```

Заменить весь метод на:

```ts
private drawTileMap(worldW: number, worldH: number): void {
  const g = this.add.graphics().setDepth(0);
  for (let ty = 0; ty < this._grid.height; ty++) {
    for (let tx = 0; tx < this._grid.width; tx++) {
      const cellType = this._grid.getTile(tx, ty);
      g.fillStyle(TILE_COLORS[cellType], 1);
      g.fillRect(tx * TILE_SIZE + 1, ty * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    }
  }
  g.lineStyle(1, COLORS.GRID_LINE, 0.25);
  for (let i = 0; i <= this._grid.width; i++) {
    g.beginPath(); g.moveTo(i * TILE_SIZE, 0); g.lineTo(i * TILE_SIZE, worldH); g.strokePath();
  }
  for (let i = 0; i <= this._grid.height; i++) {
    g.beginPath(); g.moveTo(0, i * TILE_SIZE); g.lineTo(worldW, i * TILE_SIZE); g.strokePath();
  }
}
```

- [ ] **Step 4: Заменить метод `setupCamera`**

Найти весь метод `setupCamera()` (от `private setupCamera(): void {` до закрывающей `}`).

Заменить на:

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
    return Math.min(vw / worldW, vh / worldH);
  };

  cam.setZoom(1.0);
  cam.centerOn(worldW / 2, worldH / 2);

  this.time.delayedCall(0, () => {
    const minZoom = computeMinZoom();
    if (cam.zoom < minZoom) cam.setZoom(minZoom);
  });

  this.scale.on('resize', () => {
    const minZoom = computeMinZoom();
    if (cam.zoom < minZoom) cam.setZoom(minZoom);
  });

  this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
    if (pointer.isDown) {
      cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
      cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
    }
  });

  this.sys.game.canvas.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault();
    if (!e.ctrlKey) return;
    const minZoom = computeMinZoom();
    cam.setZoom(Phaser.Math.Clamp(cam.zoom - e.deltaY * 0.001, minZoom, maxZoom));
  }, { passive: false });
}
```

- [ ] **Step 5: Запустить type-check**

```
npm run type-check
```

Ожидаем: 0 ошибок.

- [ ] **Step 6: Запустить все тесты**

```
npm test
```

Ожидаем: все тесты PASS.

- [ ] **Step 7: Коммит Tasks 3+4**

```
git add src/renderer/config.ts src/renderer/scenes/GameScene.ts
git commit -m "feat: рендерер читает размеры поля из grid в рантайме, zoom 1.0"
```

---

### Task 5: Итоговая проверка

- [ ] **Step 1: Запустить полный набор тестов**

```
npm test
```

Ожидаем: все тесты PASS.

- [ ] **Step 2: Запустить type-check**

```
npm run type-check
```

Ожидаем: 0 ошибок.

- [ ] **Step 3: Запустить build**

```
npm run build
```

Ожидаем: успешная сборка без ошибок.
