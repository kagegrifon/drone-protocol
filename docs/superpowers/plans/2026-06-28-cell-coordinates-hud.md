# Координаты клетки под курсором — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Спека:** [../../features/planned/cell-coordinates-hud.md](../../features/planned/cell-coordinates-hud.md)

**Context (зачем):** Игрок программирует дронов и постоянно оперирует координатами клеток (`move({ x: 3, y: 10 })`), но узнать координату клетки можно только на глаз. Фича даёт навести курсор на клетку, увидеть её координаты в блоке (правый нижний угол), а при задержке ≥ 1 сек — скопировать координаты как готовый JS-объект `{ x: 3, y: 10 }` для вставки в код.

**Goal:** Показать координаты клетки под курсором (рамка в Phaser + HUD в React + попап с копированием) при наведении на поле.

**Architecture:** Phaser-сцена в обработчике `pointermove` вычисляет клетку под курсором (`camera.getWorldPoint` → `floor / TILE_SIZE`) и пишет её в Zustand store **только при смене клетки** (дедупликация по значению — не throttle). Phaser рисует подсветку клетки одним переиспользуемым `Graphics`. React-оверлей подписан на `hoveredCell`, показывает HUD и через таймер 1 сек — попап с копированием. Hover-логика и подсветка работают только при ненажатой кнопке мыши и только внутри сетки.

**Tech Stack:** Phaser 3, React, Zustand, TypeScript, Vitest (unit), Playwright (e2e).

## Global Constraints

- Читаемость — приоритет №1 (CLAUDE.md): без вложенных тернарников, именовать промежуточные значения, JSX плоский.
- Симуляционный слой не трогаем — фича чисто презентационная (Phaser + React + store).
- Стиль импортов с расширением `.js` (ESM), как в существующих файлах.
- Стили — inline `React.CSSProperties`, палитра проекта (`#0a0e1a`, `#1e3a5f`, `#00d4ff`, monospace).
- Копируемая строка — ровно `{ x: N, y: M }` (валидный JS-объект, пробелы как в примере).
- Коммиты: `feat: <описание>`, русский императив. Ветка `feat/cell-coordinates-hud` (создать перед началом — сейчас на `main`).

---

## Структура файлов

- **Modify** `src/shared/store/gameStore.ts` — добавить поле `hoveredCell` и action `setHoveredCell` (с дедупликацией).
- **Modify** `src/shared/store/gameStore.test.ts` — unit-тесты на `setHoveredCell`.
- **Modify** `src/renderer/scenes/GameScene.ts` — `Graphics` подсветки + вычисление клетки в `pointermove` + сброс при `pointerout`.
- **Modify** `src/renderer/config.ts` — цвет подсветки `HOVER` (опционально, переиспользуем существующий `DRONE_GLOW`).
- **Create** `src/ui/overlays/CellCoordinatesHud.tsx` — HUD + попап + копирование.
- **Modify** `src/App.tsx` — подключить `<CellCoordinatesHud />`.
- **Create** `e2e/cell-coordinates.spec.ts` — e2e на HUD и копирование.
- **Modify** `docs/features/index.md` — переместить фичу в `done` по завершении.

---

### Task 1: Store — поле `hoveredCell` и action с дедупликацией

**Files:**
- Modify: `src/shared/store/gameStore.ts`
- Test: `src/shared/store/gameStore.test.ts`

**Interfaces:**
- Produces:
  - тип `HoveredCell = { x: number; y: number } | null`
  - поле стора `hoveredCell: HoveredCell` (default `null`)
  - метод `setHoveredCell(cell: HoveredCell): void` — пишет в стор только если значение реально изменилось (сравнение x/y), иначе no-op.

- [ ] **Step 1: Написать падающие тесты**

В конец `src/shared/store/gameStore.test.ts` добавить:

```ts
describe("setHoveredCell — координата клетки под курсором", () => {
  it("по умолчанию hoveredCell === null", () => {
    expect(useGameStore.getState().hoveredCell).toBeNull();
  });

  it("устанавливает координату клетки", () => {
    useGameStore.getState().setHoveredCell({ x: 3, y: 10 });
    expect(useGameStore.getState().hoveredCell).toEqual({ x: 3, y: 10 });
  });

  it("сбрасывает в null", () => {
    useGameStore.getState().setHoveredCell({ x: 3, y: 10 });
    useGameStore.getState().setHoveredCell(null);
    expect(useGameStore.getState().hoveredCell).toBeNull();
  });

  it("не создаёт новую ссылку при той же координате (дедупликация)", () => {
    useGameStore.getState().setHoveredCell({ x: 5, y: 5 });
    const first = useGameStore.getState().hoveredCell;
    useGameStore.getState().setHoveredCell({ x: 5, y: 5 });
    const second = useGameStore.getState().hoveredCell;
    expect(second).toBe(first); // та же ссылка — set не вызывался
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npm test -- gameStore`
Expected: FAIL — `setHoveredCell is not a function` / `hoveredCell` undefined.

- [ ] **Step 3: Добавить тип, поле и action в store**

В `src/shared/store/gameStore.ts`:

1. После блока `export interface StatsState { ... }` (около строки 73) добавить тип:

```ts
export type HoveredCell = { x: number; y: number } | null;
```

2. В `interface GameStore` (около строки 85) добавить в список полей:

```ts
  hoveredCell: HoveredCell;
```

и в список методов (рядом с `selectDrone`):

```ts
  setHoveredCell(cell: HoveredCell): void;
```

3. В объекте `create<GameStore>(...)` рядом с `selectedDroneId: null,` (около строки 197) добавить начальное значение:

```ts
  hoveredCell: null,
```

4. Рядом с реализацией `selectDrone` (около строки 295) добавить реализацию с дедупликацией:

```ts
  setHoveredCell(cell) {
    const prev = get().hoveredCell;
    const same =
      prev === cell ||
      (prev !== null &&
        cell !== null &&
        prev.x === cell.x &&
        prev.y === cell.y);
    if (same) return;
    set({ hoveredCell: cell });
  },
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npm test -- gameStore`
Expected: PASS (все 4 новых теста зелёные).

- [ ] **Step 5: Type-check**

Run: `npm run type-check`
Expected: без ошибок.

- [ ] **Step 6: Commit**

```bash
git add src/shared/store/gameStore.ts src/shared/store/gameStore.test.ts
git commit -m "feat: hoveredCell в store с дедупликацией по значению"
```

---

### Task 2: Phaser — подсветка клетки и вычисление координаты в pointermove

**Files:**
- Modify: `src/renderer/scenes/GameScene.ts`

**Interfaces:**
- Consumes: `setHoveredCell` из store (Task 1), `TILE_SIZE` и `COLORS` из `src/renderer/config.ts`, `this._grid.getTile(x, y)` (возвращает `"wall"` вне границ).
- Produces: визуальная подсветка + запись клетки в store. Внутренний инвариант: `setHoveredCell(null)` при уходе курсора с поля и при зажатой кнопке (панорама).

**Замечания по логике:**
- `this._grid.getTile(x, y)` возвращает `"wall"` для координат вне сетки — это и есть проверка границ: клетки `"wall"`/вне поля считаем «не на поле» → `null`.
- Подсветка: для пустой клетки — заливка `#00d4ff` с alpha ~0.12 + обводка; для клетки со зданием (`"mine" | "base" | "charger"`) — только обводка (заливка перекрыла бы спрайт).
- `pointermove` обработчик уже существует в `setupCamera` (строки 348–353) и делает панораму при `isDown`. Hover-ветку добавляем в тот же обработчик: при `isDown` — прячем подсветку и пишем `null`.

- [ ] **Step 1: Завести Graphics подсветки и поле prevCell**

В `GameScene` добавить приватные поля (рядом со строкой 21, после `_chargingCount`):

```ts
  private _hoverHighlight!: Phaser.GameObjects.Graphics;
  private _hoverPrevCell: { x: number; y: number } | null = null;
```

В `create()` после `this._trailGraphics = this.add.graphics().setDepth(8);` (строка 73) добавить создание подсветки (depth 6 — над тайлмапом и статикой, под дронами/частицами):

```ts
    this._hoverHighlight = this.add.graphics().setDepth(6);
    this._hoverHighlight.setVisible(false);
```

- [ ] **Step 2: Добавить метод отрисовки/скрытия подсветки**

В класс `GameScene` добавить приватные методы (например, после `drawTileMap`):

```ts
  private drawHoverHighlight(cell: { x: number; y: number }): void {
    const isBuilding = this.isBuildingCell(cell.x, cell.y);
    const px = cell.x * TILE_SIZE;
    const py = cell.y * TILE_SIZE;

    this._hoverHighlight.clear();
    if (!isBuilding) {
      this._hoverHighlight.fillStyle(COLORS.DRONE_GLOW, 0.12);
      this._hoverHighlight.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    }
    this._hoverHighlight.lineStyle(2, COLORS.DRONE_GLOW, 0.9);
    this._hoverHighlight.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    this._hoverHighlight.setVisible(true);
  }

  private isBuildingCell(x: number, y: number): boolean {
    const cell = this._grid.getTile(x, y);
    return cell === "mine" || cell === "base" || cell === "charger";
  }

  private clearHover(): void {
    if (this._hoverPrevCell === null) return;
    this._hoverPrevCell = null;
    this._hoverHighlight.setVisible(false);
    useGameStore.getState().setHoveredCell(null);
  }
```

- [ ] **Step 3: Добавить вычисление клетки в обработчик pointermove**

Заменить существующий обработчик в `setupCamera` (строки 348–353):

```ts
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
        cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
      }
    });
```

на:

```ts
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
        cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
        this.clearHover();
        return;
      }
      this.updateHoveredCell(pointer);
    });
```

- [ ] **Step 4: Добавить метод updateHoveredCell**

В класс `GameScene` добавить:

```ts
  private updateHoveredCell(pointer: Phaser.Input.Pointer): void {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cellX = Math.floor(world.x / TILE_SIZE);
    const cellY = Math.floor(world.y / TILE_SIZE);

    const onField = this._grid.getTile(cellX, cellY) !== "wall";
    if (!onField) {
      this.clearHover();
      return;
    }

    const prev = this._hoverPrevCell;
    if (prev !== null && prev.x === cellX && prev.y === cellY) return;

    this._hoverPrevCell = { x: cellX, y: cellY };
    this.drawHoverHighlight({ x: cellX, y: cellY });
    useGameStore.getState().setHoveredCell({ x: cellX, y: cellY });
  }
```

- [ ] **Step 5: Сбрасывать hover при уходе курсора с канваса**

В `create()` после подписки на события (после `this._setupEventListeners();`, строка 68) добавить:

```ts
    this.input.on("pointerout", () => this.clearHover());
```

- [ ] **Step 6: Type-check и сборка**

Run: `npm run type-check`
Expected: без ошибок.
Run: `npm run build`
Expected: успешная сборка.

- [ ] **Step 7: Ручная проверка (dev)**

Run: `npm run dev`, открыть игру, начать миссию.
Ожидается: при наведении на пустую клетку — заливка + обводка; на шахту/базу/зарядку — только обводка; за пределами сетки подсветка пропадает; при перетаскивании (зажатая ЛКМ) подсветки нет.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/scenes/GameScene.ts
git commit -m "feat: подсветка клетки под курсором в Phaser"
```

---

### Task 3: React-оверлей — HUD координат + попап с копированием

**Files:**
- Create: `src/ui/overlays/CellCoordinatesHud.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useGameStore((s) => s.hoveredCell)` (Task 1).
- Produces: компонент `CellCoordinatesHud` (default-less named export `export function CellCoordinatesHud()`), подключённый в `App.tsx`.

**Поведение:**
- Если `hoveredCell === null` → `return null` (HUD виден только при ховере).
- HUD в правом нижнем углу: `x: N  y: M`, стиль как `OreHud` но `bottom: 12; right: 12`.
- Таймер: при каждой смене `hoveredCell` сбрасываем `setTimeout`; через 1000 мс выставляем `showPopup = true`. Смена клетки / уход (null) → таймер очищаем, попап скрываем.
- Попап над HUD: координаты + кнопка-иконка копирования. По клику — `navigator.clipboard.writeText(\`{ x: ${x}, y: ${y} }\`)`, на 1.2 сек показываем «Скопировано».
- `pointerEvents`: у HUD-контейнера должно быть `pointerEvents: "auto"` (по умолчанию у оверлеев `none`), иначе по иконке нельзя кликнуть. Но контейнер маленький и в углу — канвас под ним не перекрывается существенно.

- [ ] **Step 1: Создать компонент CellCoordinatesHud**

Create `src/ui/overlays/CellCoordinatesHud.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../../shared/store/gameStore.js";

const HOVER_DELAY_MS = 1000;
const COPIED_FEEDBACK_MS = 1200;

const CONTAINER: React.CSSProperties = {
  position: "absolute",
  bottom: 12,
  right: 12,
  zIndex: 10,
  fontFamily: "monospace",
  fontSize: 13,
  userSelect: "none",
};

const HUD_BOX: React.CSSProperties = {
  background: "rgba(10, 14, 26, 0.78)",
  border: "1px solid #1e3a5f",
  borderRadius: 4,
  padding: "6px 10px",
  color: "#00d4ff",
  letterSpacing: "0.5px",
};

const POPUP: React.CSSProperties = {
  position: "absolute",
  bottom: "calc(100% + 6px)",
  right: 0,
  minWidth: 140,
  background: "#0a0e1a",
  border: "1px solid #1e3a5f",
  borderRadius: 4,
  padding: "8px 10px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#c0cfe0",
};

const COPY_BTN: React.CSSProperties = {
  background: "#0d2040",
  border: "1px solid #1a3a5a",
  color: "#4a8aaa",
  borderRadius: 3,
  padding: "2px 6px",
  cursor: "pointer",
  fontFamily: "monospace",
  fontSize: 13,
};

export function CellCoordinatesHud() {
  const hoveredCell = useGameStore((s) => s.hoveredCell);
  const [showPopup, setShowPopup] = useState(false);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // На каждую смену клетки перезапускаем таймер задержки и прячем попап.
  useEffect(() => {
    setShowPopup(false);
    setCopied(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (hoveredCell === null) return;
    timerRef.current = setTimeout(() => setShowPopup(true), HOVER_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [hoveredCell]);

  if (hoveredCell === null) return null;

  const { x, y } = hoveredCell;
  const copyText = `{ x: ${x}, y: ${y} }`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };

  return (
    <div style={CONTAINER} data-testid="cell-coords-hud">
      {showPopup && (
        <div style={POPUP} data-testid="cell-coords-popup">
          <span>{copyText}</span>
          <button
            style={COPY_BTN}
            onClick={handleCopy}
            data-testid="cell-coords-copy"
            title="Скопировать координаты"
          >
            {copied ? "✓" : "⧉"}
          </button>
        </div>
      )}
      <div style={HUD_BOX}>
        <span style={{ color: "#88aacc", marginRight: 6 }}>⌖</span>
        <span>
          x: {x}  y: {y}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Подключить в App.tsx**

В `src/App.tsx`:

1. Рядом с другими импортами оверлеев (после строки 13) добавить:

```ts
import { CellCoordinatesHud } from "./ui/overlays/CellCoordinatesHud.js";
```

2. Внутри `gamePhase === "game"` фрагмента (после `<OreHud />`, строка 192) добавить:

```tsx
            <CellCoordinatesHud />
```

- [ ] **Step 3: Type-check и сборка**

Run: `npm run type-check`
Expected: без ошибок.
Run: `npm run build`
Expected: успешная сборка.

- [ ] **Step 4: Ручная проверка (dev)**

Run: `npm run dev`. Навести на клетку — внизу справа появляется `x: N  y: M`. Задержать ≥ 1 сек — появляется попап. Клик по иконке — координаты `{ x: N, y: M }` в буфере (вставить в редактор и проверить), иконка меняется на «✓».

- [ ] **Step 5: Commit**

```bash
git add src/ui/overlays/CellCoordinatesHud.tsx src/App.tsx
git commit -m "feat: HUD координат клетки и попап копирования"
```

---

### Task 4: E2E-тест

**Files:**
- Create: `e2e/cell-coordinates.spec.ts`

**Interfaces:**
- Consumes: `data-testid` из Task 3 (`cell-coords-hud`, `cell-coords-popup`, `cell-coords-copy`), вспомогательные шаги входа в игру по образцу `e2e/drone-controls.spec.ts`.

**Замечание:** точные координаты клетки под курсором зависят от зума/центрирования камеры и ненадёжны в e2e. Поэтому тест проверяет **наличие и поведение** HUD/попапа/копирования при наведении в центр канваса, не привязываясь к конкретным числам. Чтение буфера обмена — через `navigator.clipboard.readText()` в браузерном контексте (Playwright по умолчанию даёт доступ к буферу для Chromium в headed; при необходимости выдать разрешение через контекст). Формат проверяем регуляркой `^\{ x: \d+, y: \d+ \}$`.

- [ ] **Step 1: Написать тест**

Create `e2e/cell-coordinates.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

async function enterGame(page: import("@playwright/test").Page) {
  await page.goto("");
  await page.getByRole("button", { name: "Press Start" }).click();
  await page.locator('[data-testid="mission-card-0"]').click();
  await page.getByRole("button", { name: "ЗАПУСТИТЬ" }).click();
  await expect(page.getByRole("button", { name: /Play/i })).toBeVisible({
    timeout: 30_000,
  });
}

test("HUD координат появляется при наведении и исчезает при уходе", async ({
  page,
}) => {
  await enterGame(page);

  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas not found");

  // Навести в центр поля
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  const hud = page.locator('[data-testid="cell-coords-hud"]');
  await expect(hud).toBeVisible({ timeout: 5_000 });
  await expect(hud).toContainText(/x:\s*\d+\s+y:\s*\d+/);

  // Увести курсор за пределы канваса (в сайдбар) — HUD исчезает
  await page.mouse.move(box.x - 50, box.y + box.height / 2);
  await expect(hud).toBeHidden({ timeout: 5_000 });
});

test("задержка ≥1с показывает попап, копирование кладёт {x,y} в буфер", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await enterGame(page);

  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas not found");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('[data-testid="cell-coords-hud"]')).toBeVisible();

  // Ждём появления попапа (таймер 1с)
  const popup = page.locator('[data-testid="cell-coords-popup"]');
  await expect(popup).toBeVisible({ timeout: 5_000 });

  await page.locator('[data-testid="cell-coords-copy"]').click();

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toMatch(/^\{ x: \d+, y: \d+ \}$/);
});
```

- [ ] **Step 2: Запустить e2e**

Run: `npm run test:e2e -- cell-coordinates`
Expected: оба теста PASS.

Если второй тест флакает на буфере обмена — проверить, что `context.grantPermissions` срабатывает; как запасной вариант оставить проверку появления попапа и факт клика без чтения буфера.

- [ ] **Step 3: Commit**

```bash
git add e2e/cell-coordinates.spec.ts
git commit -m "feat: e2e на HUD координат и копирование"
```

---

### Task 5: Завершение — индекс фич и статус

**Files:**
- Modify: `docs/features/planned/cell-coordinates-hud.md` → переместить в `docs/features/done/`
- Modify: `docs/features/index.md`

- [ ] **Step 1: Прогнать всю верификацию**

Run: `npm test` — все unit зелёные.
Run: `npm run type-check` — без ошибок.
Run: `npm run test:e2e` — все e2e зелёные.

- [ ] **Step 2: Обновить статус фичи**

- В `docs/features/planned/cell-coordinates-hud.md` сменить `**Статус:** planned` → `done`, отметить чек-боксы критериев. Переместить файл `git mv docs/features/planned/cell-coordinates-hud.md docs/features/done/cell-coordinates-hud.md`.
- В `docs/features/index.md`: убрать строку из таблицы `planned`, добавить в таблицу `done`:

```
| [cell-coordinates-hud.md](done/cell-coordinates-hud.md) | Координаты клетки под курсором |
```

- [ ] **Step 3: Записать session-док**

Создать `docs/sessions/<дата-время>-feature-cell-coordinates-hud.md` с целью и результатами (по правилам CLAUDE.md).

- [ ] **Step 4: Commit**

```bash
git add docs/features/ docs/sessions/
git commit -m "docs: фича координат клетки — статус done"
```

---

## Верификация (end-to-end)

1. `npm test` — unit-тесты `setHoveredCell` (дедупликация, null) проходят.
2. `npm run type-check` и `npm run build` — без ошибок.
3. `npm run dev` — ручная проверка:
   - наведение на пустую клетку → заливка + обводка + HUD `x:N y:M`;
   - наведение на шахту/базу/зарядку → только обводка;
   - за пределами сетки и при панораме (зажатая ЛКМ) → ни подсветки, ни HUD;
   - задержка ≥ 1 сек → попап; клик по иконке → в буфере `{ x: N, y: M }`, иконка «✓»;
   - координаты корректны при зуме (Ctrl+колесо) и после панорамирования.
4. `npm run test:e2e -- cell-coordinates` — e2e зелёные.

## Self-review (выполнено при написании плана)

- **Покрытие спеки:** рамка/заливка (Task 2) ✓; здания только обводка (Task 2, `isBuildingCell`) ✓; HUD правый нижний угол только при ховере (Task 3) ✓; попап через 1с + копирование `{x,y}` (Task 3) ✓; только внутри сетки (Task 2, `getTile !== "wall"`) ✓; скрытие при панораме (Task 2, ветка `isDown`) ✓; учёт зума/скролла (`getWorldPoint`) ✓; Zustand+дедуп (Task 1) ✓; unit + e2e (Task 1, 4) ✓.
- **Плейсхолдеры:** нет — весь код приведён.
- **Согласованность типов:** `HoveredCell`, `setHoveredCell`, `hoveredCell` едины во всех задачах; `data-testid` совпадают между Task 3 и Task 4.
