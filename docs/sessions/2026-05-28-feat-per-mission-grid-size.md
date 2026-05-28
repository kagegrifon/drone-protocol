# Сессия: Per-Mission Grid Size

**Дата:** 2026-05-28  
**Тип:** feat

## Цель

Убрать жёстко зашитый `GRID_SIZE = 20`, сделать `Grid` параметрическим (минимум 30×30), перевести все миссии на поле 30×30, рендерер читает размеры из экземпляра в рантайме, камера стартует на zoom 1.0.

## Результат

Фича реализована полностью по спеку `docs/superpowers/specs/2026-05-28-per-mission-grid-size-design.md`.

### Коммиты

| Хэш | Описание |
|---|---|
| `3b8baad` | feat: сделать Grid параметрическим с минимальным размером 30×30 |
| `a19c68b` | test: улучшить покрытие Grid (isWalkable, setTile out-of-bounds, naming) |
| `fd3ee82` | feat: все миссии переходят на Grid(30, 30) |
| `547bf7d` | feat: рендерер читает размеры поля из grid в рантайме, zoom 1.0 |

### Изменения

- **`Grid.ts`** — конструктор `Grid(width = 30, height = 30)`, `GRID_MIN = 30`, выброс `Error` при размере < 30, геттеры `width`/`height`, `inBounds` использует `this._width`/`this._height`
- **`Grid.test.ts`** (новый) — 13 unit-тестов: конструктор, геттеры, валидация, `getTile`/`setTile`/`isWalkable`, соседи
- **`mission1–4.ts`** — `new Grid(30, 30)` вместо `new Grid()`
- **`renderer/config.ts`** — удалены `GRID_SIZE`, `CANVAS_W`, `CANVAS_H`; остался только `TILE_SIZE = 40`
- **`GameScene.ts`** — `worldW/H` вычисляются из `grid.width/height * TILE_SIZE`; `drawTileMap(worldW, worldH)` и `setupCamera(worldW, worldH)` получают размеры параметром; удалён `userZoomed` флаг; начальный zoom = 1.0; minZoom = contain (`Math.min`)

### Состояние тестов

394 unit-тестов PASS. 4 Playwright e2e файла падают из-за pre-existing проблемы с путями worktree — не связано с фичей.

## Процесс

Использован Subagent-Driven Development (4 задачи, по 2 review на задачу: spec compliance + code quality). В ходе выполнения Task 2 subagent неавторизованно изменил `src/game/simulation/constants.ts` — откат через `git checkout` до продолжения.

## Метрики сессии
- Модель: claude-sonnet-4-6
- Input: 132 токенов (кеш: 5,982,428 / запись в кеш: 171,507)
- Output: 61,059 токенов
- Контекст: 87,544 / 200,000 токенов (43.8%)
- Стоимость: $3.354
