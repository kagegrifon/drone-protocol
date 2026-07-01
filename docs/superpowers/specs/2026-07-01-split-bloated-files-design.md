# Рефактор: разбиение раздутых файлов (GameScene, gameStore, DroneInspector)

**Дата:** 2026-07-01
**Тип:** refactor (без изменения поведения)

## Зачем

Три файла разрослись и смешивают несколько ответственностей — тяжело читать и
поддерживать. Фича `cell-coordinates-hud` (см.
`docs/features/done/cell-coordinates-hud.md`) добавила в `GameScene` крупный блок
input/hover-логики. Store и INSPECTOR раздулись органически.

Цель — **чисто механическое разбиение по ответственностям**. Публичное поведение,
рендер и внешние API байт-в-байт неизменны. Дополнительные улучшения (мелкие
огрехи вроде `-TODO-` в `currentInstruction`, вложенный тернарник `stateColor`)
рассматриваются **отдельно, после разбиения** — не входят в этот spec.

## Границы (scope)

- **Входит:** перемещение кода в новые файлы/классы, обновление импортов, эквивалентная
  перекомпоновка. Тесты продолжают проходить без изменения ассертов (кроме путей импорта).
- **Не входит:** изменение логики, исправление багов, переименование публичных полей,
  новые фичи, изменение стилей рендера.

## Проверка после каждого файла

```
npm run type-check
npm test
```

E2E (`npm run test:e2e`) — один раз в конце как регрессионная страховка (input/hover
и INSPECTOR покрыты e2e).

---

## 1. GameScene.ts → выделить PointerInteractionController

**Новый файл:** `src/renderer/scenes/PointerInteractionController.ts`

Класс-контроллер (композиция, не наследование) владеет всей логикой ховера клетки и
выбора клетки кликом:

- **Поля:** `_hoverHighlight` (Graphics), `_hoverPrevCell`, `_pointerDownAt`,
  `_droneSelectedThisGesture`.
- **Методы:** `drawHoverHighlight`, `isBuildingTile`, `isPointerOverDrone`, `clearHover`,
  `clearHoverHighlightOnly`, `updateHoveredCell`, `pointerToCell`.
- **Обработчики:** вешает собственные `pointermove`, `pointerdown`, `pointerup`, `gameout`
  (только та часть, что относится к ховеру и клику по клетке).
- **Константы:** `BUILDING_TILES`, `CLICK_DRAG_THRESHOLD_PX` переезжают сюда.

**Конструктор:** принимает options-объект `{ scene, grid }`.

**Владение hover-графикой:** контроллер сам делает `scene.add.graphics().setDepth(6)` в
конструкторе и владеет ею целиком (решение пользователя — максимальная инкапсуляция).

**Registry-колбэки:** `onCellClick` контроллер читает из `scene.registry` так же, как
сейчас. `onDroneClick` остаётся в `GameScene.ensureSprite` (относится к спрайтам), но
спрайт взводит флаг жеста через контроллер — см. ниже.

**Флаг жеста дрона (`_droneSelectedThisGesture`):** сейчас его взводит обработчик
`pointerdown` спрайта дрона в `GameScene.ensureSprite`. После выноса флаг живёт в
контроллере. `ensureSprite` вызывает публичный метод контроллера, например
`markDroneSelectedThisGesture()`, чтобы взвести флаг. Порядок эмита событий Phaser
(object-level `pointerdown` раньше scene-level) сохраняется — логика не меняется.

**pointermove — граница с камерой:** сейчас единственный `pointermove`-хендлер в
`setupCamera` совмещает drag-scroll камеры и `updateHoveredCell`. После рефактора:
- Контроллер вешает свой `pointermove`: если `pointer.isDown` (драг) → `clearHover()` и
  выход; иначе `updateHoveredCell(pointer)`.
- GameScene.setupCamera оставляет свой `pointermove` только для scroll камеры при
  `pointer.isDown`.
- Два слушателя `pointermove` сосуществуют (Phaser это допускает). Поведение идентично:
  при драге камера скроллится И ховер скрывается, как сейчас.

**GameScene после выноса** (~370 строк) отвечает за: каркас сцены (`create`), аудио и
игровые события, спрайты/интерполяцию (`syncSprites`, `ensureSprite`), тайлмап, камеру.
В `create()` создаёт `this._pointerInteraction = new PointerInteractionController({ scene: this, grid: this._grid })`.

**Внешний API GameScene / GameRenderer не меняется** — `GameRenderer` создаёт сцену так же.

---

## 2. gameStore.ts → вынести чистые хелперы и типы

Store смешивает объявления типов, чистые snapshot-хелперы и определение самого стора.
Выносим по файлам в `src/shared/store/`:

- **`types.ts`** — интерфейсы/типы: `DroneState`, `StatsState`, `HoveredCell`,
  `SelectedCell`, `BuildingState`, `Systems`, `GameStore`.
- **`computeActivePath.ts`** — функция `computeActivePath`.
  ⚠️ Рядом уже есть `computeActivePath.test.ts`, который импортирует её из `./gameStore.js`.
  Обновить импорт в тесте на `./computeActivePath.js`.
- **`snapshots.ts`** — `snapshotDrones`, `snapshotBuildings`, `REF_ARRAY_BY_TYPE`,
  `resetDroneProgram`, `filterPrograms`.

`gameStore.ts` оставляет: импорты + `create<GameStore>(...)` с actions (~250 строк).

**Импортёры:** обновить всех, кто импортирует вынесенные типы/функции из `gameStore.js`.
Проверить Grep'ом (`DroneState`, `BuildingState`, `SelectedCell`, `computeActivePath` и
т.д.) перед началом. Реэкспорт ради совместимости **не делаем** — правим импортёров явно.
`gameStore.test.ts` тестирует `snapshotBuildings` через поведение стора (не прямой
импорт) — его трогать не нужно.

---

## 3. DroneInspector/index.tsx → разбить по компонентам

Сейчас всё в одном `index.tsx` (408 строк): примитивы, хук, стили, крупные компоненты.
Каталог `src/ui/panels/DroneInspector/` наполняем файлами:

- **`styles.ts`** — разделяемые `CSSProperties`: `BTN`, `COPY_BTN`, `MONO`.
- **`useCopyFeedback.ts`** — хук копирования с фидбэком ⧉→✓.
- **`Bar.tsx`** — компонент полосы.
- **`Row.tsx`** — компонент строки label + children.
- **`CopyableValue.tsx`** — значение с кнопкой копирования (использует `useCopyFeedback`).
- **`DroneControls.tsx`** — play/pause/reset.
- **`CellInspector.tsx`** — `CellInspector` + вложенный `BuildingRows`.
- **`InspectorEmpty.tsx`** — заглушка «Select a drone».
- **`index.tsx`** — только `DroneInspector` (главный компонент) + `renderNonDrone`,
  собирает из импортированных частей (~130 строк).

Все `data-testid` сохраняются без изменений (e2e зависит от них). Inline-стили,
которые дублируются, при разбиении можно поднять в `styles.ts`, но **без изменения
итогового рендера** — это часть механического выноса, не «чистки».

---

## Порядок реализации

Три независимых блока, каждый — отдельный коммит `refactor: ... `:
1. gameStore.ts (нет зависимостей от других двух, чисто TS — быстрая проверка тестами).
2. DroneInspector (зависит от типов store — делаем после store).
3. GameScene / PointerInteractionController (изолирован от первых двух).

После всех трёх — `npm run test:e2e` как регрессия.

## Критерии готовности

- [ ] `PointerInteractionController` выделен; `GameScene` не содержит hover/cell-select логики.
- [ ] Хелперы и типы вынесены из `gameStore.ts`; импортёры обновлены; `computeActivePath.test.ts` импортирует из нового пути.
- [ ] `DroneInspector` разбит на компоненты/хук/стили; `index.tsx` только собирает.
- [ ] `npm run type-check` зелёный.
- [ ] `npm test` зелёный (ассерты не менялись, кроме путей импорта).
- [ ] `npm run test:e2e` зелёный.
- [ ] Все `data-testid` и внешние API (GameRenderer, store actions) неизменны.
