# Сессия: реализация Drag & Drop блоков редактора

**Дата:** 2026-05-26  
**Тип:** feat

## Цель

Реализовать drag & drop для блоков редактора программ и провести визуальный рефактор.

## Результаты

- Установлены `@dnd-kit/core`, `@dnd-kit/sortable`
- Добавлено действие `moveInstruction` в gameStore (покрыто 6 unit-тестами)
- Убраны рамки у InstructionBlock, borderLeft стал 2px
- Убраны горизонтальные разделители в ConditionEditor
- InstructionBlock: drag handle ⠿ (hover-only), useSortable, SortableContext для children
- ProgramEditor: DndContext + DragOverlay в DRONE и PROGRAM вкладках
- npm test: 356 тестов прошли
