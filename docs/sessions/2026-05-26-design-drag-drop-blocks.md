# Сессия: проектирование Drag & Drop блоков редактора

**Дата:** 2026-05-26  
**Тип:** design

## Цель

Спроектировать фичу drag & drop для блоков редактора программ и одновременно провести визуальный рефактор — убрать перегруженность рамками.

## Результаты

- Написан спек: `docs/superpowers/specs/2026-05-26-drag-drop-blocks-design.md`
- Выбрана библиотека: `@dnd-kit/core` + `@dnd-kit/sortable` (кросс-контейнерный DnD)
- Спроектировано новое действие store: `moveInstruction(programId, fromPath, toContainerPath, toIndex)`
- Описана архитектура компонентов: вложенные `SortableContext` для каждого уровня списка

## Ключевые решения

**Визуальный стиль:**
- Убрать `border: 1px solid` у `InstructionBlock` — только цвет фона для активного блока
- Вложенность показывает только `borderLeft: 2px solid #1e3a5f`
- Горизонтальные разделители вокруг AND/OR в `ConditionEditor` удалить

**DnD архитектура:**
- `DragItemData = { programId: string; path: number[] }` — данные перетаскиваемого элемента
- `DndContext` в `ProgramEditor/index.tsx`, `SortableContext` рекурсивно внутри `InstructionBlock`
- Handle `⠿` (braille U+28BF): `color: #4488ff`, только при hover на строку блока
- Drop-индикатор: синяя линия 2px `#00d4ff` над hover-элементом (`isOver` из `useSortable`)
- Drag overlay: полупрозрачная копия с рамкой `#00d4ff`

**moveInstruction логика:**
- Извлечь инструкцию по `fromPath`, удалить из исходного списка
- Скорректировать `toContainerPath`, если удаление сдвинуло индекс в пути
- Вставить в `toContainerPath` на позицию `toIndex` (стандартный splice без дополнительной коррекции индекса)

## Следующие шаги

Реализация по плану: `docs/superpowers/plans/2026-05-26-drag-drop-blocks.md`
