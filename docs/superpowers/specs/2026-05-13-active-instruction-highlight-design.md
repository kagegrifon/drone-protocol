# Дизайн: подсветка активной команды дрона

**Дата:** 2026-05-13  
**Статус:** одобрен  

---

## Цель

Показывать пользователю, какую инструкцию программы дрон выполняет прямо сейчас:
1. Подсвечивать соответствующий блок в `ProgramEditor` зелёной рамкой.
2. Показывать статус-строку под списком инструкций с текстом текущей команды.

---

## Контекст

- `DroneState` уже содержит `currentInstruction: string` (текстовое описание) и `currentProgramId`.
- `ProgramComponent.callStack` хранит полный стек выполнения: фреймы с `programId`, `instructionIndex`, `waitRemaining`, `isLoop`, `inlineInstructions`.
- `InstructionBlock` принимает `path: number[]` — путь к инструкции в дереве программы.
- Симуляция не знает о UI; все вычисления остаются в `gameStore` и React-компонентах.

---

## Архитектура

### Поток данных

```
tick() → snapshotDrones()
  → computeActivePath(callStack, state)
    → DroneState.currentInstructionPath: number[] | null
    → DroneState.waitingFor: string | null
      → ProgramEditor читает из store
        → InstructionBlock.activeInstructionPath prop
          → стили по совпадению пути
```

Никаких изменений в симуляционном слое.

---

## Изменения

### 1. `src/shared/store/gameStore.ts`

**Расширить `DroneState`:**

```typescript
export interface DroneState {
  // ... существующие поля
  currentInstructionPath: number[] | null;
  waitingFor: string | null;
}
```

**Добавить функцию `computeActivePath`:**

```typescript
function computeActivePath(
  callStack: CallFrame[],
  state: ProgramState
): number[] | null {
  if (callStack.length === 0) return null;

  const path: number[] = [];

  for (let i = 0; i < callStack.length; i++) {
    const frame = callStack[i];
    const isTop = i === callStack.length - 1;

    if (isTop) {
      const isWaiting =
        state === 'waiting' ||
        (frame.waitRemaining !== undefined && frame.waitRemaining > 0);
      const idx = isWaiting ? frame.instructionIndex - 1 : frame.instructionIndex;
      if (idx < 0) return null;
      path.push(idx);
    } else {
      // Контейнерный фрейм: instructionIndex указывает на контейнер, не сдвигается
      path.push(frame.instructionIndex);
    }
  }

  return path;
}
```

**Обновить `snapshotDrones`** — добавить вычисление `currentInstructionPath` и `waitingFor` из `ProgramComponent`.

### 2. `src/ui/editor/ProgramEditor/InstructionBlock.tsx`

**Добавить prop:**

```typescript
interface Props {
  // ... существующие
  activeInstructionPath: number[] | null;
}
```

**Логика стилей:**

| Условие | Стиль рамки | Фон |
|---------|-------------|-----|
| `path` точно совпадает с `activeInstructionPath` | `#00ff88` (зелёный) | `#00ff8812` |
| `activeInstructionPath` начинается с `path` (контейнер содержит активную) | `#00ff8840` (dim) | без изменений |
| Иначе | `#1e3a5f` (стандарт) | без изменений |

Для вложенных `InstructionBlock` (внутри LOOP/REPEAT/IF) проп `activeInstructionPath` передаётся без изменений — каждый блок сравнивает свой `path` самостоятельно.

### 3. `src/ui/editor/ProgramEditor/index.tsx`

**Статус-строка** — добавить фиксированный блок между списком инструкций и кнопкой `+ add instruction`:

```
⚡ MOVE → Mine A     (state=waiting, текст из drone.currentInstruction)
◌ —                  (state=idle или нет программы)
```

Данные: `drone.waitingFor` для иконки (`⚡` / `◌`), `drone.currentInstruction` для текста.

**Обновить передачу пропов** в цикле `droneProgram.instructions.map(...)` — добавить `activeInstructionPath={drone.currentInstructionPath}`.

---

## Крайние случаи

- **Программа idle / нет программы**: `currentInstructionPath = null`, статус-строка показывает `◌ —`.
- **Вложенная инструкция** (внутри LOOP): контейнер получает dim-подсветку, вложенная инструкция — полную.
- **Inline-фреймы** (`programId === '__inline__'`): `computeActivePath` обрабатывает их корректно через `inlineInstructions`, не обращаясь к registry.
- **`instructionIndex - 1 < 0`**: функция возвращает `null` (защита от underflow).
- **Дрон не выбран**: `ProgramEditor` уже не рендерит инструкции в этом случае.

---

## Что не меняется

- Симуляционный слой (`src/game/simulation/`) — без изменений.
- Интерпретатор (`interpreter.ts`) — без изменений.
- `ProgramDef`, `Instruction`, типы программ — без изменений.
