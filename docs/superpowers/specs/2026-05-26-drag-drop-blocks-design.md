# Drag & Drop блоков + визуальный рефактор редактора

**Дата:** 2026-05-26  
**Статус:** approved

---

## Контекст

Редактор программ (`ProgramEditor`) использует рекурсивные `InstructionBlock` для отображения инструкций. Сейчас блоки можно только добавлять/удалять — перемещать нельзя. Также визуально редактор перегружен: у каждого блока своя рамка и горизонтальные линии-разделители между дочерними блоками, что создаёт «мельтешение». Фича решает обе проблемы одновременно.

---

## Визуальный рефактор

**Принцип:** вложенность показывается только вертикальной линией слева, блоки без рамок.

### InstructionBlock

- Убрать `border: '1px solid ...'` из `cardStyle` — блоки без рамок
- Убрать горизонтальные `<div>` разделители между дочерними блоками
- Сохранить `borderLeft: '2px solid #1e3a5f'` для области вложенности контейнеров (LOOP, IF, REPEAT)
- Добавить `⠿` drag-handle: появляется только при hover на строку конкретного блока (CSS hover / `onMouseEnter`+`onMouseLeave` на уровне строки)
- Handle-иконка: `color: #4488ff`, `cursor: grab`, `font-size: 14px`

### ConditionEditor

- Убрать горизонтальные `<div style={{ height: '1px', background: '#1e3a5f' }} />` вокруг AND/OR кнопок

---

## Drag & Drop

### Поведение

- **Scope:** кросс-контейнерный — блок можно перетащить между разными уровнями вложенности (из тела LOOP на верхний уровень, внутрь IF и т.д.)
- **Единица перемещения:** при drag контейнерного блока (LOOP, IF, REPEAT) всё его тело перемещается вместе с ним
- **Handle:** иконка `⠿` появляется при hover только на строку текущего блока, не на дочерние
- **Drop-индикатор:** синяя горизонтальная линия (2px, `color: #00d4ff`, лёгкое свечение) между блоками, показывает куда приземлится блок
- **Drag overlay:** блок-призрак (полупрозрачная копия) следует за курсором во время drag

### Библиотека

`@dnd-kit/core` + `@dnd-kit/sortable`

### Архитектура

**Тип данных draggable-элемента:**
```typescript
type DragItemData = {
  programId: string;
  path: number[];  // путь к инструкции, например [0, 1]
};
```

**Структура компонентов:**

```
DndContext (onDragEnd)              ← в ProgramEditor/index.tsx
└── SortableContext (корень)
    ├── InstructionBlock [useSortable]
    │   └── SortableContext (LOOP body)
    │       ├── InstructionBlock [useSortable]
    │       └── ...
    └── InstructionBlock [useSortable]
        └── SortableContext (IF then)
            └── ...
```

- `DndContext` оборачивает список инструкций редактируемой программы в `ProgramEditor/index.tsx`
- Каждый список инструкций (корень, `body` у LOOP/REPEAT, `then`/`else` у IF) получает свой `SortableContext`
- Каждый `InstructionBlock` использует `useSortable` — даёт ref для handle и CSS-трансформ во время drag
- `DragOverlay` рендерит копию блока, следующую за курсором

### Новое действие в store

```typescript
// gameStore.ts
moveInstruction(
  programId: string,
  fromPath: number[],        // путь к перемещаемому блоку
  toContainerPath: number[], // путь к целевому контейнеру ([] = корень)
  toIndex: number            // позиция внутри контейнера
): void
```

Логика:
1. Извлечь инструкцию по `fromPath`
2. Удалить из исходной позиции
3. Учесть сдвиг индекса если `fromPath` и `toContainerPath` — один и тот же список (стандартный `arrayMove`)
4. Вставить в `toContainerPath` на позицию `toIndex`

### onDragEnd

В `@dnd-kit/sortable` `over` указывает на ближайший sortable-элемент (не gap). Целевую позицию вычисляем так:

```typescript
onDragEnd({ active, over }) {
  if (!over || active.id === over.id) return;

  const { programId, path: fromPath } = active.data.current as DragItemData;
  const { path: overPath } = over.data.current as DragItemData;

  // Родительский контейнер over-элемента = toContainerPath
  const toContainerPath = overPath.slice(0, -1);
  const toIndex = overPath[overPath.length - 1];

  // Убедиться что drag не в себя
  const fromContainerPath = fromPath.slice(0, -1);
  const fromIndex = fromPath[fromPath.length - 1];
  if (
    toContainerPath.join() !== fromContainerPath.join() ||
    toIndex !== fromIndex
  ) {
    moveInstruction(programId, fromPath, toContainerPath, toIndex);
  }
}
```

---

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/ui/editor/ProgramEditor/InstructionBlock.tsx` | Новые стили + drag handle + `useSortable` |
| `src/ui/editor/ProgramEditor/index.tsx` | `DndContext`, `onDragEnd`, `DragOverlay` |
| `src/ui/editor/ProgramEditor/ConditionEditor.tsx` | Убрать горизонтальные разделители |
| `src/shared/store/gameStore.ts` | Добавить `moveInstruction` |
| `package.json` | `@dnd-kit/core`, `@dnd-kit/sortable` |

---

## Проверка

1. `npm install` — без ошибок
2. `npm run type-check` — без ошибок
3. Запустить игру, открыть редактор программ:
   - Блоки отображаются без рамок, вертикальная линия показывает вложенность
   - Горизонтальных разделителей нет
   - При наведении на блок появляется `⠿`, при уходе — скрывается
   - Перетаскивание блока в том же списке — меняет порядок
   - Перетаскивание блока из LOOP на верхний уровень — работает
   - Перетаскивание блока внутрь IF then — работает
   - Перетаскивание LOOP целиком — все дочерние блоки перемещаются вместе
   - Drop-индикатор (синяя линия) появляется между блоками во время drag
4. `npm test` — существующие тесты не сломаны
