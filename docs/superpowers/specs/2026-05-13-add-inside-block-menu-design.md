# Дизайн: меню добавления инструкций внутри блоков loop/if

**Дата:** 2026-05-13  
**Статус:** Одобрен

## Контекст

В ProgramEditor кнопка `+ add inside` уже существует внутри блоков LOOP/REPEAT/IF, но при клике она жёстко добавляет инструкцию типа WAIT без выбора типа. Меню выбора типа (`AddInstructionMenu`) и вспомогательная функция (`makeDefaultInstruction`) определены только в `index.tsx` — на верхнем уровне редактора. Нужно сделать так, чтобы `+ add inside` открывало то же меню выбора, что и кнопка верхнего уровня.

## Решение

Вынести `makeDefaultInstruction` и `AddInstructionMenu` в общий файл `instructionUtils.tsx`, чтобы их мог использовать как `index.tsx` (верхний уровень), так и `InstructionBlock.tsx` (вложенный уровень).

## Архитектура

### Новый файл: `instructionUtils.tsx`

Экспортирует:

```typescript
export function makeDefaultInstruction(
  type: Instruction['type'],
  entities: EntityMeta[],
  programIds: string[]
): Instruction

export function AddInstructionMenu({
  onAdd,
}: {
  onAdd: (type: Instruction['type']) => void;
}): JSX.Element
```

`makeDefaultInstruction` и `AddInstructionMenu` — перенос из `index.tsx` без изменений.

### `index.tsx`

- Убрать локальные определения `makeDefaultInstruction` и `AddInstructionMenu`.
- Добавить импорт из `./instructionUtils.js`.
- Логика `handleAddTopLevel` остаётся без изменений.

### `InstructionBlock.tsx`

- Убрать `handleAddChild`.
- Добавить импорт `AddInstructionMenu` и `makeDefaultInstruction` из `./instructionUtils.js`.
- Заменить кнопку `+ add inside` на:

```tsx
<AddInstructionMenu
  onAdd={(type) => {
    addInstruction(programId, makeDefaultInstruction(type, entities, programIds), path);
  }}
/>
```

## Поток взаимодействия

```
Пользователь кликает "+ add instruction" внутри LOOP/REPEAT/IF
  → AddInstructionMenu показывает 9 кнопок типов
  → пользователь выбирает тип
  → makeDefaultInstruction создаёт инструкцию с дефолтными параметрами
  → addInstruction(programId, instr, path) добавляет в body/then блока
  → меню закрывается
```

## Затронутые файлы

| Файл | Изменение |
|------|-----------|
| `src/ui/editor/ProgramEditor/instructionUtils.tsx` | Создать |
| `src/ui/editor/ProgramEditor/index.tsx` | Убрать локальные определения, добавить импорт |
| `src/ui/editor/ProgramEditor/InstructionBlock.tsx` | Заменить кнопку/логику, добавить импорт |

## Верификация

1. Запустить dev-сервер (`npm run dev`).
2. Создать программу с блоком LOOP/REPEAT/IF.
3. Кликнуть `+ add inside` — должно открыться меню из 9 типов.
4. Выбрать LOOP внутри LOOP — убедиться, что вложенность работает рекурсивно.
5. Выбрать MOVE_TO — убедиться, что появляется пикер entity.
6. Убедиться, что `+ add instruction` на верхнем уровне работает как прежде.
