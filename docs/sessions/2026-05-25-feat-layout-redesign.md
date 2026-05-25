# Сессия: редизайн layout игровой сцены (Screeps-style)

**Дата:** 2026-05-25
**План:** `peppy-greeting-cocoa.md`

## Цель

Устранить UX-проблемы текущего layout:
- глобальный скролл браузера (канвас 800×800 + padding не помещался по высоте);
- скролл внутри sidebar 340px, переполненного панелями;
- редактор программ ютится в узкой колонке, хотя это ключевая механика игры.

Перейти к Screeps-style layout: канвас занимает основное полотно, редактор программ — ресайзаблочная нижняя панель с возможностью fullscreen.

## Результаты

### Layout shell (`App.tsx`, `global.css`)

- Root: `height:100vh; overflow:hidden` — нет глобальных скроллов.
- Sidebar слева 280px (фикс): `SimControls → DRONES → INSPECTOR → STATS`.
- MainArea справа: канвас (flex:1) сверху + `<BottomPanel>` снизу.
- `min-width: 1024px` для root (десктопная игра).

### Новые компоненты

- `src/ui/layout/BottomPanel.tsx` — обёртка нижней панели. Resize handle сверху (drag меняет высоту), кнопки `▽` collapse / `⛶` fullscreen / `▲` restore в правом верхнем углу. Высота normal-режима сохраняется в `localStorage` (`droneloop.bottomPanelHeight`).
- `src/ui/overlays/OreHud.tsx` — HUD-плашка `⛏ N` в левом верхнем углу канваса (всегда видна).
- `src/ui/overlays/MissionGoalButton.tsx` — иконка `🎯` в правом верхнем углу канваса. По клику — popover с описанием цели и прогрессом. Закрывается кликом вне и `Esc`.

### Удалено

- `src/ui/panels/MissionGoalPanel.tsx` — заменён на `MissionGoalButton`.

### Phaser auto-resize (`GameRenderer.ts`, `GameScene.ts`)

- `Phaser.Scale.RESIZE` + `width/height: '100%'` — канвас подстраивается под parent.
- `computeMinZoom = Math.max(vw/worldW, vh/worldH)` — **cover** zoom: мир покрывает весь канвас без чёрных полос по краям.
- Подписка на `scale.on('resize')` — при изменении размера канвас перефитится (если игрок не зумил вручную).
- Существующие pan ЛКМ + zoom Ctrl+wheel сохранены без изменений.

### Минорные правки

- `SimControls.tsx`: удалены неиспользуемые `DT`/`tick`/`onStep` (чистка TS-ошибок, отображение тика убрано в этой и предыдущей итерации).
- `e2e/regression.spec.ts` (Bug 3): переписан под актуальный UI — отображение `Tick: N` убрано из SimControls пользователем намеренно, тест теперь проверяет видимость STATS-панели после смены миссии.

## Verification

- `npm run type-check` — без ошибок.
- `npm test` — 135/135 unit-тестов зелёные.
- `npx playwright test` — 8/8 e2e зелёные.
- Скриншоты: нет скроллов, канвас покрывает всю ширину/высоту main area, goal popover работает, collapse/fullscreen нижней панели работают.

## Итог

Не закоммичено — пользователь делает коммиты сам. Затронутые файлы:

- M `src/App.tsx`
- M `src/global.css`
- M `src/renderer/GameRenderer.ts`
- M `src/renderer/scenes/GameScene.ts`
- M `src/ui/controls/SimControls.tsx`
- M `e2e/regression.spec.ts`
- A `src/ui/layout/BottomPanel.tsx`
- A `src/ui/overlays/OreHud.tsx`
- A `src/ui/overlays/MissionGoalButton.tsx`
- D `src/ui/panels/MissionGoalPanel.tsx`
