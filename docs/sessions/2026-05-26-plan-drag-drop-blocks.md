# Сессия: планирование реализации Drag & Drop блоков

**Дата:** 2026-05-26  
**Тип:** docs/plan

## Цель

Создать документацию фичи и детальный план реализации drag & drop + визуального рефактора редактора блоков.

## Результаты

- Прочитан спек: `docs/superpowers/specs/2026-05-26-drag-drop-blocks-design.md`
- Создан файл фичи: `docs/features/planned/drag-drop-blocks.md`
- Обновлён индекс фич: `docs/features/index.md`
- Написан лог предыдущей (дизайн) сессии: `docs/sessions/2026-05-26-design-drag-drop-blocks.md`
- Написан детальный план: `docs/superpowers/plans/2026-05-26-drag-drop-blocks.md`

## Что в плане

6 задач:
1. Документация + npm install @dnd-kit/core @dnd-kit/sortable
2. moveInstruction в gameStore (TDD: 6 тестов)
3. Визуальный рефактор (убрать border, 2px borderLeft, убрать разделители ConditionEditor)
4. DnD в InstructionBlock (useSortable, handle ⠿, SortableContext для children)
5. DndContext + DragOverlay в ProgramEditor/index.tsx
6. Финальная QA + коммит документации

## Следующие шаги

Реализация по плану: `docs/superpowers/plans/2026-05-26-drag-drop-blocks.md`
