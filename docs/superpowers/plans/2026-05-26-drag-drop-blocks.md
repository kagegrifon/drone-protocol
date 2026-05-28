# Drag & Drop блоков + визуальный рефактор редактора

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить drag & drop для блоков редактора программ с кросс-контейнерным перемещением и убрать визуальную перегруженность рамками.

**Architecture:** Каждый `InstructionBlock` получает `useSortable` из `@dnd-kit/sortable`; каждый уровень списка инструкций оборачивается в `SortableContext`; `DndContext` с `onDragEnd` живёт в `ProgramEditor/index.tsx`. Новое действие `moveInstruction` в store мутирует инструкции по пути и обновляет state.

**Tech Stack:** `@dnd-kit/core`, `@dnd-kit/sortable`, React useState, Zustand, Vitest

---

## Файловая карта

| Файл | Изменение |
|------|-----------|
| `src/ui/editor/ProgramEditor/InstructionBlock.tsx` | Визуальный рефактор + useSortable + drag handle + SortableContext для children |
| `src/ui/editor/ProgramEditor/index.tsx` | DndContext, onDragStart/End, DragOverlay, moveInstruction |
| `src/ui/editor/ProgramEditor/ConditionEditor.tsx` | Убрать горизонтальные разделители вокруг AND/OR кнопки |
| `src/shared/store/gameStore.ts` | Добавить moveInstruction в интерфейс и реализацию |
| `src/shared/store/gameStore.test.ts` | Тесты moveInstruction |
| `package.json` | Добавить @dnd-kit/core, @dnd-kit/sortable |

---

## Task 1: Документация и установка зависимостей

**Files:**
- Modify: `package.json`
- Already created: `docs/features/planned/drag-drop-blocks.md`, `docs/features/index.md`, `docs/sessions/2026-05-26-design-drag-drop-blocks.md`

- [ ] **Step 1: Установить пакеты**

```bash
npm install @dnd-kit/core @dnd-kit/sortable
```

Ожидаемый вывод: `added 2 packages` (или аналог). Проверить что `package.json` теперь содержит оба пакета в `dependencies`.

- [ ] **Step 2: Убедиться что сборка не сломалась**

```bash
npm run type-check
```

Ожидаемый вывод: без ошибок (пакеты добавлены, код ещё не менялся).

- [ ] **Step 3: Закоммитить документацию и deps**

```bash
git add docs/features/planned/drag-drop-blocks.md docs/features/index.md docs/sessions/2026-05-26-design-drag-drop-blocks.md package.json package-lock.json
git commit -m "$(cat <<'EOF'
docs: спланировать фичу drag-drop-blocks, установить @dnd-kit

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: moveInstruction в gameStore (TDD)

**Files:**
- Modify: `src/shared/store/gameStore.ts`
- Modify: `src/shared/store/gameStore.test.ts`

### Шаг 2.1 — написать провальные тесты

- [ ] **Step 1: Добавить тесты в конец `gameStore.test.ts`**

Добавить после строки `});` последнего describe-блока:

```typescript
// ─── moveInstruction ─────────────────────────────────────────────────────────

import type { Instruction } from '../../game/programs/types.js';

describe('store.moveInstruction()', () => {
  function setup(instructions: Instruction[]) {
    const prog: ProgramDef = { id: 'p1', name: 'Test', instructions };
    const registry: ProgramRegistry = new Map([['p1', prog]]);
    useGameStore.getState().init(makeWorld(), makeGrid(), registry);
    return 'p1';
  }

  it('перемещает блок в том же списке: root[2] → позиция 0', () => {
    const id = setup([{ type: 'MINE' }, { type: 'DROP' }, { type: 'CHARGE' }]);
    useGameStore.getState().moveInstruction(id, [2], [], 0);
    const prog = useGameStore.getState().programs.find(p => p.id === id)!;
    expect(prog.instructions.map(i => i.type)).toEqual(['CHARGE', 'MINE', 'DROP']);
  });

  it('перемещает блок в том же списке: root[0] → позиция 2', () => {
    const id = setup([{ type: 'MINE' }, { type: 'DROP' }, { type: 'CHARGE' }]);
    useGameStore.getState().moveInstruction(id, [0], [], 2);
    const prog = useGameStore.getState().programs.find(p => p.id === id)!;
    expect(prog.instructions.map(i => i.type)).toEqual(['DROP', 'CHARGE', 'MINE']);
  });

  it('перемещает блок из корня внутрь LOOP', () => {
    const id = setup([
      { type: 'LOOP', body: [{ type: 'DROP' }] },
      { type: 'MINE' },
    ]);
    useGameStore.getState().moveInstruction(id, [1], [0], 0);
    const prog = useGameStore.getState().programs.find(p => p.id === id)!;
    expect(prog.instructions).toHaveLength(1);
    const loop = prog.instructions[0] as Extract<Instruction, { type: 'LOOP' }>;
    expect(loop.body.map(i => i.type)).toEqual(['MINE', 'DROP']);
  });

  it('перемещает блок из LOOP в корень', () => {
    const id = setup([
      { type: 'LOOP', body: [{ type: 'DROP' }, { type: 'MINE' }] },
      { type: 'CHARGE' },
    ]);
    useGameStore.getState().moveInstruction(id, [0, 0], [], 1);
    const prog = useGameStore.getState().programs.find(p => p.id === id)!;
    expect(prog.instructions.map(i => i.type)).toEqual(['LOOP', 'DROP', 'CHARGE']);
    const loop = prog.instructions[0] as Extract<Instruction, { type: 'LOOP' }>;
    expect(loop.body.map(i => i.type)).toEqual(['MINE']);
  });

  it('перемещение между двумя разными контейнерами', () => {
    const id = setup([
      { type: 'LOOP', body: [{ type: 'CHARGE' }] },
      { type: 'REPEAT', count: 2, body: [{ type: 'DROP' }] },
    ]);
    useGameStore.getState().moveInstruction(id, [1, 0], [0], 0);
    const prog = useGameStore.getState().programs.find(p => p.id === id)!;
    const loop = prog.instructions[0] as Extract<Instruction, { type: 'LOOP' }>;
    const repeat = prog.instructions[1] as Extract<Instruction, { type: 'REPEAT' }>;
    expect(loop.body.map(i => i.type)).toEqual(['DROP', 'CHARGE']);
    expect(repeat.body).toHaveLength(0);
  });

  it('перемещение из корня внутрь контейнера с корректировкой пути', () => {
    const id = setup([
      { type: 'MINE' },
      { type: 'LOOP', body: [{ type: 'CHARGE' }] },
    ]);
    // Move root[0] (MINE) inside root[1].body (LOOP) — after removal root[1] becomes root[0]
    useGameStore.getState().moveInstruction(id, [0], [1], 0);
    const prog = useGameStore.getState().programs.find(p => p.id === id)!;
    expect(prog.instructions).toHaveLength(1);
    const loop = prog.instructions[0] as Extract<Instruction, { type: 'LOOP' }>;
    expect(loop.body.map(i => i.type)).toEqual(['MINE', 'CHARGE']);
  });
});
```

**Важно:** `import type { Instruction }` добавить в начало файла (рядом с уже существующими импортами).

- [ ] **Step 2: Запустить тесты — убедиться что они падают**

```bash
npm test -- --reporter=verbose src/shared/store/gameStore.test.ts
```

Ожидаемый результат: `FAIL` с сообщением `store.moveInstruction is not a function` (или `TypeError`).

### Шаг 2.2 — реализовать moveInstruction

- [ ] **Step 3: Добавить moveInstruction в интерфейс GameStore**

В `src/shared/store/gameStore.ts`, в блоке `interface GameStore` (около строки 96), после строки `updateInstruction(...): void;` добавить:

```typescript
moveInstruction(programId: string, fromPath: number[], toContainerPath: number[], toIndex: number): void;
```

- [ ] **Step 4: Реализовать moveInstruction в create()**

В `src/shared/store/gameStore.ts`, после реализации `updateInstruction` (около строки 310), добавить новый метод:

```typescript
moveInstruction(programId, fromPath, toContainerPath, toIndex) {
  const { registry } = get();
  const prog = registry.get(programId);
  if (!prog || fromPath.length === 0) return;

  const fromContainerPath = fromPath.slice(0, -1);
  const fromIndex = fromPath[fromPath.length - 1];

  // Если удаление fromPath сдвигает сегмент в toContainerPath — скорректировать
  const adjustedToContainerPath = toContainerPath.slice();
  if (
    adjustedToContainerPath.length > fromContainerPath.length &&
    fromContainerPath.every((v, i) => v === adjustedToContainerPath[i]) &&
    adjustedToContainerPath[fromContainerPath.length] > fromIndex
  ) {
    adjustedToContainerPath[fromContainerPath.length]--;
  }

  const fromList = getInstructionList(prog.instructions, fromContainerPath);
  const instr = fromList[fromIndex];
  if (!instr) return;

  fromList.splice(fromIndex, 1);
  const toList = getInstructionList(prog.instructions, adjustedToContainerPath);
  toList.splice(toIndex, 0, instr);

  set({ programs: Array.from(registry.values()).filter(p => !p.personal) });
},
```

- [ ] **Step 5: Запустить тесты — убедиться что они проходят**

```bash
npm test -- --reporter=verbose src/shared/store/gameStore.test.ts
```

Ожидаемый результат: все тесты `PASS`, в том числе 6 новых `store.moveInstruction()`.

- [ ] **Step 6: Закоммитить**

```bash
git add src/shared/store/gameStore.ts src/shared/store/gameStore.test.ts
git commit -m "$(cat <<'EOF'
feat: добавить moveInstruction в gameStore (TDD)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Визуальный рефактор стилей

**Files:**
- Modify: `src/ui/editor/ProgramEditor/InstructionBlock.tsx`
- Modify: `src/ui/editor/ProgramEditor/ConditionEditor.tsx`

### InstructionBlock.tsx

- [ ] **Step 1: Убрать border из cardStyle и isAncestor**

Найти в `InstructionBlock.tsx` функцию `cardStyle` (около строки 30). Заменить весь блок `useMemo`:

```typescript
const cardStyle = useMemo<React.CSSProperties>(() => {
  const isActive =
    activeInstructionPath !== null &&
    path.length === activeInstructionPath.length &&
    path.every((v, i) => v === activeInstructionPath[i]);

  return {
    background: isActive ? '#00ff8812' : '#060f1e',
    borderRadius: '4px',
    padding: '6px 8px',
    marginBottom: '4px',
    fontFamily: 'monospace',
    fontSize: '12px',
  };
}, [activeInstructionPath, path]);
```

- [ ] **Step 2: Изменить borderLeft с 1px на 2px в области вложенности**

Найти строку (около строки 194):
```tsx
<div style={{ marginTop: '6px', paddingLeft: '12px', borderLeft: '1px solid #1e3a5f' }}>
```

Заменить на:
```tsx
<div style={{ marginTop: '6px', paddingLeft: '12px', borderLeft: '2px solid #1e3a5f' }}>
```

### ConditionEditor.tsx

- [ ] **Step 3: Убрать горизонтальные разделители вокруг AND/OR**

Найти в `ConditionEditor.tsx` фрагмент (около строки 81):

```tsx
{index < operators.length && (
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0' }}>
    <div style={{ flex: 1, height: '1px', background: '#1e3a5f' }} />
    <button
      onClick={() => toggleOperator(index)}
      style={{ background: '#0a1628', border: '1px solid #1e3a5f', color: '#00d4ff', fontFamily: 'monospace', fontSize: '10px', padding: '1px 8px', borderRadius: '2px', cursor: 'pointer' }}
    >
      {operators[index]}
    </button>
    <div style={{ flex: 1, height: '1px', background: '#1e3a5f' }} />
  </div>
)}
```

Заменить на (убрать оба `<div>` с `height: '1px'`):

```tsx
{index < operators.length && (
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0' }}>
    <button
      onClick={() => toggleOperator(index)}
      style={{ background: '#0a1628', border: '1px solid #1e3a5f', color: '#00d4ff', fontFamily: 'monospace', fontSize: '10px', padding: '1px 8px', borderRadius: '2px', cursor: 'pointer' }}
    >
      {operators[index]}
    </button>
  </div>
)}
```

- [ ] **Step 4: Проверить типы**

```bash
npm run type-check
```

Ожидаемый результат: без ошибок.

- [ ] **Step 5: Закоммитить**

```bash
git add src/ui/editor/ProgramEditor/InstructionBlock.tsx src/ui/editor/ProgramEditor/ConditionEditor.tsx
git commit -m "$(cat <<'EOF'
feat: визуальный рефактор редактора — убрать рамки и разделители

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: DnD в InstructionBlock (useSortable + handle)

**Files:**
- Modify: `src/ui/editor/ProgramEditor/InstructionBlock.tsx`

- [ ] **Step 1: Добавить импорты**

В начало файла `InstructionBlock.tsx`, заменить первую строку с импортом React:

```typescript
import { useMemo, useState } from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
```

(остальные импорты не трогать)

- [ ] **Step 2: Экспортировать DragItemData и ICONS**

Заменить объявление `ICONS` (первые строки после импортов):

```typescript
export type DragItemData = {
  programId: string;
  path: number[];
};

export const ICONS: Record<string, string> = {
  MOVE_TO: '→', MINE: '⛏', DROP: '↓', CHARGE: '⚡', WAIT: '⏱',
  LOOP: '🔄', REPEAT: '↩', IF: '?', RUN_PROGRAM: '▶',
};
```

- [ ] **Step 3: Добавить хук и hover-стейт в InstructionBlock**

В теле функции `InstructionBlock`, сразу после объявления `const [pickerOpen, ...]` и `const [editorOpen, ...]` добавить:

```typescript
const [hovered, setHovered] = useState(false);

const {
  attributes,
  listeners,
  setNodeRef,
  transform,
  transition,
  isDragging,
  isOver,
} = useSortable({
  id: path.join('-'),
  data: { programId, path } as DragItemData,
});
```

- [ ] **Step 4: Применить трансформ и ref к корневому div**

Найти строку рендера корневого div (около строки 61):
```tsx
return (
  <div style={cardStyle}>
```

Заменить на:
```tsx
return (
  <div
    ref={setNodeRef}
    {...attributes}
    style={{
      ...cardStyle,
      transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      transition,
      opacity: isDragging ? 0.3 : 1,
    }}
  >
    {isOver && (
      <div style={{
        height: '2px',
        background: '#00d4ff',
        boxShadow: '0 0 6px #00d4ff',
        marginBottom: '4px',
        borderRadius: '1px',
      }} />
    )}
```

- [ ] **Step 5: Добавить handle и hover в header row**

Найти строку header row (около строки 63):
```tsx
{/* Header row */}
<div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
  <span style={{ color: '#4488ff', fontSize: '14px' }}>{ICONS[instruction.type] ?? '•'}</span>
```

Заменить на:
```tsx
{/* Header row */}
<div
  style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}
  onMouseEnter={() => setHovered(true)}
  onMouseLeave={() => setHovered(false)}
>
  <span
    {...listeners}
    style={{
      color: '#4488ff',
      cursor: 'grab',
      fontSize: '14px',
      visibility: hovered ? 'visible' : 'hidden',
      userSelect: 'none',
      flexShrink: 0,
    }}
  >
    ⠿
  </span>
  <span style={{ color: '#4488ff', fontSize: '14px' }}>{ICONS[instruction.type] ?? '•'}</span>
```

- [ ] **Step 6: Добавить SortableContext вокруг children контейнеров**

Найти блок рендера children (в самом конце компонента, около строки 193):
```tsx
{isContainer && (
  <div style={{ marginTop: '6px', paddingLeft: '12px', borderLeft: '2px solid #1e3a5f' }}>
    {children.map((child, i) => (
      <InstructionBlock
        key={i}
        instruction={child}
        programId={programId}
        path={[...path, i]}
        entities={entities}
        programIds={programIds}
        activeInstructionPath={activeInstructionPath}
      />
    ))}
    <AddInstructionMenu
      onAdd={(type) => {
        addInstruction(programId, makeDefaultInstruction(type, entities, programIds), path);
      }}
    />
  </div>
)}
```

Заменить на:
```tsx
{isContainer && (
  <div style={{ marginTop: '6px', paddingLeft: '12px', borderLeft: '2px solid #1e3a5f' }}>
    <SortableContext
      items={children.map((_, i) => [...path, i].join('-'))}
      strategy={verticalListSortingStrategy}
    >
      {children.map((child, i) => (
        <InstructionBlock
          key={[...path, i].join('-')}
          instruction={child}
          programId={programId}
          path={[...path, i]}
          entities={entities}
          programIds={programIds}
          activeInstructionPath={activeInstructionPath}
        />
      ))}
    </SortableContext>
    <AddInstructionMenu
      onAdd={(type) => {
        addInstruction(programId, makeDefaultInstruction(type, entities, programIds), path);
      }}
    />
  </div>
)}
```

- [ ] **Step 7: Проверить типы**

```bash
npm run type-check
```

Ожидаемый результат: без ошибок TypeScript.

- [ ] **Step 8: Закоммитить**

```bash
git add src/ui/editor/ProgramEditor/InstructionBlock.tsx
git commit -m "$(cat <<'EOF'
feat: добавить useSortable и drag handle в InstructionBlock

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: DndContext + DragOverlay в ProgramEditor

**Files:**
- Modify: `src/ui/editor/ProgramEditor/index.tsx`

- [ ] **Step 1: Добавить импорты**

В начало файла `src/ui/editor/ProgramEditor/index.tsx` добавить после существующих импортов:

```typescript
import { DndContext, DragOverlay, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { type DragItemData, ICONS } from './InstructionBlock.js';
import type { ProgramDef } from '../../../game/programs/types.js';
```

- [ ] **Step 2: Добавить moveInstruction и activeDragData в ProgramEditor**

В функцию `ProgramEditor`, после строки `const selectDrone = useGameStore(...)`, добавить:

```typescript
const moveInstruction = useGameStore((s) => s.moveInstruction);
const [activeDragData, setActiveDragData] = useState<DragItemData | null>(null);
```

- [ ] **Step 3: Добавить вспомогательную функцию getInstructionByPath**

Добавить перед функцией `ProgramEditor` (или после импортов, перед стилевыми константами):

```typescript
function getInstructionByPath(prog: ProgramDef, path: number[]) {
  let list = prog.instructions;
  for (let i = 0; i < path.length - 1; i++) {
    const node = list[path[i]];
    if (!node) return null;
    if (node.type === 'LOOP' || node.type === 'REPEAT') list = node.body;
    else if (node.type === 'IF') list = node.then;
    else return null;
  }
  return list[path[path.length - 1]] ?? null;
}
```

- [ ] **Step 4: Добавить обработчики DnD**

В теле `ProgramEditor`, после объявления `activeDragData`, добавить:

```typescript
function handleDragStart({ active }: DragStartEvent) {
  setActiveDragData(active.data.current as DragItemData);
}

function handleDragEnd({ active, over }: DragEndEvent) {
  setActiveDragData(null);
  if (!over || active.id === over.id) return;

  const { programId, path: fromPath } = active.data.current as DragItemData;
  const { path: overPath } = over.data.current as DragItemData;
  const toContainerPath = overPath.slice(0, -1);
  const toIndex = overPath[overPath.length - 1];
  const fromContainerPath = fromPath.slice(0, -1);
  const fromIndex = fromPath[fromPath.length - 1];

  if (toContainerPath.join() !== fromContainerPath.join() || toIndex !== fromIndex) {
    moveInstruction(programId, fromPath, toContainerPath, toIndex);
  }
}
```

- [ ] **Step 5: Добавить вспомогательную функцию renderDragOverlay**

После `handleDragEnd` добавить:

```typescript
function renderDragOverlay() {
  if (!activeDragData) return null;
  const prog = registry.get(activeDragData.programId);
  if (!prog) return null;
  const instr = getInstructionByPath(prog, activeDragData.path);
  if (!instr) return null;
  return (
    <div style={{
      background: '#060f1e',
      border: '1px solid #00d4ff',
      borderRadius: '4px',
      padding: '6px 8px',
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#00d4ff',
      opacity: 0.85,
      boxShadow: '0 0 8px #00d4ff44',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    }}>
      <span style={{ color: '#4488ff' }}>{ICONS[instr.type] ?? '•'}</span>
      <span>{instr.type}</span>
    </div>
  );
}
```

- [ ] **Step 6: Обернуть список инструкций личной программы (DRONE tab)**

Найти в DRONE tab блок:
```tsx
{personalExpanded && (
  <>
    {personalProgram.instructions.map((instr, i) => (
      <InstructionBlock
        key={i}
        instruction={instr}
        programId={personalProgram.id}
        path={[i]}
        entities={entities}
        programIds={programIds}
        activeInstructionPath={!assignedProgram ? (drone.currentInstructionPath ?? null) : null}
      />
    ))}
    <AddInstructionMenu onAdd={handleAddPersonal} />
  </>
)}
```

Заменить на:
```tsx
{personalExpanded && (
  <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <SortableContext
      items={personalProgram.instructions.map((_, i) => String(i))}
      strategy={verticalListSortingStrategy}
    >
      {personalProgram.instructions.map((instr, i) => (
        <InstructionBlock
          key={String(i)}
          instruction={instr}
          programId={personalProgram.id}
          path={[i]}
          entities={entities}
          programIds={programIds}
          activeInstructionPath={!assignedProgram ? (drone.currentInstructionPath ?? null) : null}
        />
      ))}
    </SortableContext>
    <AddInstructionMenu onAdd={handleAddPersonal} />
    <DragOverlay dropAnimation={null}>{renderDragOverlay()}</DragOverlay>
  </DndContext>
)}
```

- [ ] **Step 7: Обернуть список инструкций в PROGRAM tab**

Найти в PROGRAM tab блок:
```tsx
<div style={{ borderTop: '1px solid #1e3a5f', paddingTop: '8px' }}>
  {editingProgram.instructions.map((instr, i) => (
    <InstructionBlock
      key={i}
      instruction={instr}
      programId={editingProgramId!}
      path={[i]}
      entities={entities}
      programIds={programIds}
      activeInstructionPath={null}
    />
  ))}
  <AddInstructionMenu onAdd={handleAddToEditing} />
</div>
```

Заменить на:
```tsx
<div style={{ borderTop: '1px solid #1e3a5f', paddingTop: '8px' }}>
  <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <SortableContext
      items={editingProgram.instructions.map((_, i) => String(i))}
      strategy={verticalListSortingStrategy}
    >
      {editingProgram.instructions.map((instr, i) => (
        <InstructionBlock
          key={String(i)}
          instruction={instr}
          programId={editingProgramId!}
          path={[i]}
          entities={entities}
          programIds={programIds}
          activeInstructionPath={null}
        />
      ))}
    </SortableContext>
    <AddInstructionMenu onAdd={handleAddToEditing} />
    <DragOverlay dropAnimation={null}>{renderDragOverlay()}</DragOverlay>
  </DndContext>
</div>
```

- [ ] **Step 8: Проверить типы**

```bash
npm run type-check
```

Ожидаемый результат: без ошибок TypeScript.

- [ ] **Step 9: Закоммитить**

```bash
git add src/ui/editor/ProgramEditor/index.tsx
git commit -m "$(cat <<'EOF'
feat: добавить DndContext и DragOverlay в ProgramEditor

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Финальная проверка

- [ ] **Step 1: Запустить все тесты**

```bash
npm test
```

Ожидаемый результат: все тесты `PASS`, ни один не сломался.

- [ ] **Step 2: Проверить типы**

```bash
npm run type-check
```

Ожидаемый результат: без ошибок.

- [ ] **Step 3: Запустить игру и проверить вручную**

```bash
npm run dev
```

Открыть браузер, зайти в миссию, открыть редактор программ. Проверить чеклист:

- [ ] Блоки отображаются без рамок, вертикальная линия `borderLeft 2px` показывает вложенность
- [ ] Горизонтальных разделителей в ConditionEditor нет (кнопка AND/OR стоит одна)
- [ ] При наведении на СТРОКУ блока появляется `⠿`, при уходе — скрывается
- [ ] `⠿` НЕ появляется при hover на дочерние блоки (только на собственную строку)
- [ ] Перетаскивание блока в том же списке — порядок меняется
- [ ] Перетаскивание из тела LOOP на верхний уровень — работает
- [ ] Перетаскивание блока внутрь IF then — работает
- [ ] Перетаскивание LOOP целиком — дочерние блоки переезжают вместе
- [ ] Drop-индикатор (синяя линия) появляется над блоком при drag-over
- [ ] Drag overlay (полупрозрачная копия с синей рамкой) следует за курсором

- [ ] **Step 4: Обновить фичу в done и добавить в index**

Переместить файл:
```bash
mv docs/features/planned/drag-drop-blocks.md docs/features/done/drag-drop-blocks.md
```

В `docs/features/done/drag-drop-blocks.md` изменить `**Статус:** planned` → `**Статус:** done`.

В `docs/features/index.md`:
- Убрать строку из таблицы `### planned`
- Добавить в таблицу `### done`: `| [drag-drop-blocks.md](done/drag-drop-blocks.md) | Drag & Drop блоков + визуальный рефактор редактора |`

- [ ] **Step 5: Написать сессионный лог текущей сессии**

Создать файл `docs/sessions/2026-05-26-feat-drag-drop-blocks.md`:

```markdown
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
- npm test: все тесты проходят
```

- [ ] **Step 6: Финальный коммит**

```bash
git add docs/features/done/drag-drop-blocks.md docs/features/index.md docs/sessions/2026-05-26-feat-drag-drop-blocks.md
git commit -m "$(cat <<'EOF'
docs: закрыть фичу drag-drop-blocks, добавить сессию

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

### Покрытие спека

| Требование спека | Задача |
|---|---|
| Убрать border из cardStyle | Task 3, Step 1 |
| Убрать горизонтальные разделители InstructionBlock | Их нет в коде — не нужно |
| borderLeft 2px для вложенности | Task 3, Step 2 |
| Handle ⠿ при hover | Task 4, Steps 3-5 |
| Убрать разделители в ConditionEditor | Task 3, Step 3 |
| @dnd-kit/core + @dnd-kit/sortable | Task 1, Step 1 |
| DragItemData тип | Task 4, Step 2 |
| useSortable в InstructionBlock | Task 4, Steps 3-6 |
| SortableContext для каждого уровня | Task 4, Step 6 |
| DndContext в ProgramEditor | Task 5, Steps 1-7 |
| DragOverlay | Task 5, Steps 5-7 |
| Drop-индикатор синяя линия | Task 4, Step 4 (isOver) |
| moveInstruction в store | Task 2 |
| Корректировка пути при cross-container | Task 2, Step 4 |
| onDragEnd логика | Task 5, Step 4 |
| DRONE и PROGRAM вкладки | Task 5, Steps 6-7 |
| npm test без ошибок | Task 6, Step 1 |
| type-check без ошибок | Task 6, Step 2 |
| Ручная QA | Task 6, Step 3 |

### Плейсхолдеры

Проверено — плейсхолдеров нет. Весь код предоставлен полностью.

### Консистентность типов

- `DragItemData` экспортируется из `InstructionBlock.tsx`, импортируется в `index.tsx` ✓
- `ICONS` экспортируется из `InstructionBlock.tsx`, используется в `renderDragOverlay` ✓
- `moveInstruction(programId: string, fromPath: number[], toContainerPath: number[], toIndex: number)` одинаково в интерфейсе, реализации и вызове ✓
- `path.join('-')` как id в `useSortable` и `SortableContext items` одинаковый формат ✓
