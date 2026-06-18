# План: убрать блочную логику, оставить только code-форму

## Context

Программа дрона исторически имела две формы: визуальные блоки
(`{ sourceForm: "block"; instructions: Instruction[] }`) и текстовый код
(`{ sourceForm: "code"; code: string }`). Сейчас обе живут параллельно и
переключаются флагом `codeModeEnabled`. Блочная логика рассеяна по всем слоям
(типы, store, исполнение, редактор, миссии, тесты), при этом тип
`DroneBehavior` в [types.ts](src/game/programs/types.ts) **уже** сведён к
code-форме (block-вариант закомментирован, строки 64–67). Из-за этого активный
код в store и редакторе ссылается на `sourceForm === "block"` и `.instructions`,
которых в типе больше нет, — типы и логика рассогласованы.

Цель: убрать блочный код из активных путей, чтобы остался только
`{ sourceForm: "code"; code: string }`. Блоки **не** копируются в отдельную
папку — их сохраняет git: возврат делается из коммита, где блочная логика ещё
цела. Перенос пользователь выполняет сам — этот документ описывает, что удалить,
что упростить и как вернуть блоки.

## Точка возврата (git)

Блочная логика в полном виде сохранена в коммите — завершающем по добавлению
CodeEditor:

```
9ccfd190e401853a445e9010fe9f85c70a3fb55b
docs: отчёт Phase G — исправление e2e Code Mode
```

Любой блочный файл восстанавливается оттуда:

```bash
git checkout 9ccfd190 -- src/game/programs/interpreter.ts
# или просмотреть, не трогая дерево:
git show 9ccfd190:src/game/code/AstBehaviorDriver.ts
```

Рекомендация: перед удалением поставить аннотированный тег, чтобы ссылка была
читаемой и не зависела от истории:

```bash
git tag -a block-logic-archive 9ccfd190 -m "Полная блочная логика дрона (до удаления)"
# тогда возврат: git checkout block-logic-archive -- <пути>
```

## Решения (согласованы)

- **Стратегия:** удалить блочные файлы из рабочего дерева, не дублировать в
  отдельную папку. Источник возврата — коммит `9ccfd190` (тег
  `block-logic-archive`).
- **Тип `DroneBehavior`:** плоский — `{ sourceForm: "code"; code: string }`.
  Поле `sourceForm` сохраняется (на случай будущего union), но варианта block нет.
- **Переключатель `codeModeEnabled`:** UI остаётся, block-опция дизейблится.
  Редактор **всегда** показывает CodeEditor, игнорируя значение флага.
- **Missions и тесты:** пользователь чинит сам по ходу. Ниже — перечень
  затронутых файлов.

---

## Что удаляем

### 1. Блочные типы — [src/game/programs/types.ts](src/game/programs/types.ts)

Удалить все блочные типы: `ConditionOperator`, `ConditionLogic`, `ObjectRef`,
`FunctionName`, `FunctionCall`, `Operand`, `ConditionLeaf`, `ActionBlock`,
`FlowBlock`, `ConditionBlock`, `Instruction` (строки 3–62) и закомментированный
block-вариант (64–67).

Файл целиком сводится к:

```ts
export type DroneBehavior = { sourceForm: "code"; code: string };

export interface ProgramDef {
  id: string;
  name: string;
  personal?: boolean;
  behavior: DroneBehavior;
}

export type ProgramRegistry = Map<string, ProgramDef>;
```

> Импорт `EntityId` нужен только блочным типам — удаляется вместе с ними.

Обновить ре-экспорт в [src/game/programs/index.ts](src/game/programs/index.ts):
убрать `ConditionLeaf, ConditionLogic, ConditionOperator, ActionBlock, FlowBlock,
ConditionBlock, Instruction` и `export { stepProgram }` (interpreter удаляется).
Оставить `ProgramDef`, `ProgramRegistry` (и `DroneBehavior`, если используется).

### 2. Исполнение блоков — удалить файлы

- [src/game/programs/interpreter.ts](src/game/programs/interpreter.ts) +
  `interpreter.test.ts`
- [src/game/code/AstBehaviorDriver.ts](src/game/code/AstBehaviorDriver.ts) +
  `AstBehaviorDriver.test.ts`
- [src/game/code/equivalence.test.ts](src/game/code/equivalence.test.ts) —
  сравнивает AST- и code-драйверы; уходит с блоками.

### 3. Block-компоненты редактора — удалить файлы

Из [src/ui/editor/ProgramEditor/](src/ui/editor/ProgramEditor/):
`InstructionBlock.tsx`, `DropSlot.tsx`, `ConditionEditor.tsx`,
`conditionFormat.ts`, `FunctionCallEditor.tsx`, `ObjectSelect.tsx`,
`instructionUtils.tsx`.

Остаётся: `index.tsx` (упрощённый, см. ниже) и `CodeEditor/` (он не блочный).

---

## Что упрощаем в активных файлах (правки на месте)

### 4. Редактор — [src/ui/editor/ProgramEditor/index.tsx](src/ui/editor/ProgramEditor/index.tsx)

Это главный файл с дуализмом. После правки он работает **только** с code:

- Убрать импорты `@dnd-kit/*`, `InstructionBlock`, `instructionUtils`, `DropSlot`,
  `Instruction` (строки 2–25). Оставить `CodeEditor`, `ProgramDef`, `EntityMeta`,
  `useGameStore`.
- Удалить закомментированный `getInstructionByPath` (строки 58–70) — он же
  вызывается живьём на строке 178 в `renderDragOverlay`, что сейчас сломано.
- Удалить из store-подписок: `addInstruction`, `moveInstruction` и (см. п.5)
  `codeModeEnabled`. Оставить `setProgramCodeSource` и прочее.
- Удалить: `personalInstructions` (107–110), `editingInstructions` (131–134),
  `handleDragStart`, `handleDragEnd`, `renderDragOverlay`, `handleAddPersonal`,
  `handleAddToEditing`, `activeDragData`.
- В блоке personal program (356–425): убрать ветку `!codeModeEnabled` (DndContext),
  оставить только CodeEditor. Условие `personalExpanded && codeModeEnabled` →
  `personalExpanded` (всегда code).
- В блоке program (740–793): убрать тернарник `codeModeEnabled ? CodeEditor :
  DndContext`, оставить только `CodeEditor`. Значение `value` упростить до
  `editingProgram.behavior.code` (тип теперь всегда code, проверка `sourceForm`
  не нужна).

### 5. Store — [src/shared/store/gameStore.ts](src/shared/store/gameStore.ts)

Удалить блочные методы и хелперы:

- Методы интерфейса и реализации: `addInstruction`, `removeInstruction`,
  `updateInstruction`, `moveInstruction` (интерфейс 132–148; реализации 442–513).
- Хелперы `describeInstruction` (158–181), `getInstructionList` (183–204).
- Импорт `Instruction` (строка 9).

Упростить оставшееся:

- `filterPrograms` (206–214): убрать фильтр по `sourceForm`/режиму. Раз форма
  всегда code — фильтровать только по `!p.personal`. Параметр `codeModeEnabled`
  убрать, поправить все вызовы (init, setProgramCodeSource, createProgram).
- `init` (324–337): убрать цикл, перезаписывающий `personalDef.behavior` под
  `codeModeEnabled` — теперь behavior всегда code, мутация не нужна.
- `createProgram` (515–527): убрать тернарник, всегда
  `behavior: { sourceForm: "code", code: "" }`. Убрать чтение `codeModeEnabled`.
- `snapshotDrones` (233–277): в блоке 252–255 убрать чтение
  `prog.behavior.instructions` и вызов `describeInstruction`. `currentInstruction`
  для code-формы вычислять иначе или оставить `"—"` (на ваше усмотрение — это
  только подпись в UI).
- `codeModeEnabled` в state/`setCodeModeEnabled`: **оставить** (по решению),
  но он больше не влияет на форму программы. Используется только переключателем
  в модалке (п.6).

### 6. UI-переключатель — [src/ui/modals/AudioSettingsModal.tsx](src/ui/modals/AudioSettingsModal.tsx)

Строки 110–179: оставить переключатель, но **block-опцию задизейблить**
(`disabled` на radio, приглушить стиль, опц. подпись «скоро»). Code-опция —
активна и выбрана. `setCodeModeEnabled(false)` по сути недостижим.

### 7. ProgramExecutionSystem — [src/game/simulation/systems/ProgramExecutionSystem.ts](src/game/simulation/systems/ProgramExecutionSystem.ts)

Сейчас держит `astDriver` (блочный) и выбирает драйвер по `sourceForm` (38–41).
Поскольку block удаляется:

- Убрать импорт и поле `astDriver` (`AstBehaviorDriver`).
- Выбор драйвера упростить: всегда `codeDriver`. Рекомендуется сделать
  `codeDriver` обязательным параметром (убрать `?`). Вызов в `init`
  ([gameStore.ts](src/shared/store/gameStore.ts) 300–309) уже передаёт
  `codeDriver` — совместимо.

### 8. Missions и связанные тесты — чините по ходу (за вами)

Файлы с block-литералами `ProgramDef`, которые перестанут тайпчекаться при
плоском типе. Перевести на `{ sourceForm: "code", code: "..." }` (или удалить
block-специфичные тесты):

- [src/game/missions/mission1.ts](src/game/missions/mission1.ts),
  [mission2.ts](src/game/missions/mission2.ts),
  [mission3.ts](src/game/missions/mission3.ts),
  [mission4.ts](src/game/missions/mission4.ts)
- [src/game/missions/missions.test.ts](src/game/missions/missions.test.ts)
- [src/shared/store/gameStore.test.ts](src/shared/store/gameStore.test.ts) —
  тесты block-методов store (add/move/...) удалить.
- [src/game/simulation/systems/ProgramExecutionSystem.test.ts](src/game/simulation/systems/ProgramExecutionSystem.test.ts),
  [src/game/simulation/atomic-actions.integration.test.ts](src/game/simulation/atomic-actions.integration.test.ts) —
  проверить block-литералы, перевести на code или удалить.
- [src/ui/panels/DroneInspector/index.tsx](src/ui/panels/DroneInspector/index.tsx) —
  проверить ссылки на `instructions`/`sourceForm`.

---

## Как вернуть блоки позже

1. Восстановить файлы из тега/коммита:
   `git checkout block-logic-archive -- src/game/programs/interpreter.ts
   src/game/code/AstBehaviorDriver.ts src/ui/editor/ProgramEditor/InstructionBlock.tsx …`
   (полный список удалённых файлов — в коммите удаления).
2. Вернуть в [types.ts](src/game/programs/types.ts) блочные типы и union-вариант
   `DroneBehavior` (`| { sourceForm: "block"; instructions: Instruction[] }`).
3. Вернуть `astDriver` и выбор драйвера по `sourceForm` в
   [ProgramExecutionSystem.ts](src/game/simulation/systems/ProgramExecutionSystem.ts).
4. Вернуть block-методы и хелперы в [gameStore.ts](src/shared/store/gameStore.ts),
   фильтр по режиму в `filterPrograms`.
5. Вернуть block-ветки и DnD в [ProgramEditor/index.tsx](src/ui/editor/ProgramEditor/index.tsx),
   снять `disabled` с block-опции в модалке.

> Коммит удаления полезно назвать так, чтобы он сам подсказывал точку возврата,
> например: `refactor: убрать блочную логику (восстановление — тег block-logic-archive)`.

---

## Порядок выполнения (рекомендация)

1. Поставить тег `block-logic-archive` на `9ccfd190`.
2. Удалить блочные файлы (п.1–3). Ожидаемо много ошибок компиляции на середине —
   это нормально.
3. Упростить активные файлы: типы (п.1), редактор (п.4), store (п.5),
   ExecutionSystem (п.7), модалку (п.6).
4. Починить missions и тесты (п.8).
5. Прогнать проверки (см. ниже), пока всё зелёное.
6. Один коммит удаления с понятным сообщением (см. выше).

## Verification

```
npm run type-check   # активный код компилируется с плоским DroneBehavior
npm test             # unit-тесты зелёные (block-тесты удалены)
npm run test:e2e     # e2e: редактор показывает CodeEditor, миссии стартуют
npm run dev          # ручная проверка
```

Ручная проверка в `npm run dev`:
- Открыть редактор программ → на вкладках DRONE / PROGRAM показывается
  **CodeEditor** (не блоки) для personal и для редактируемой программы.
- В настройках (AudioSettingsModal) переключатель режима: code активен/выбран,
  block — задизейблен.
- Назначить программу дрону, запустить симуляцию — дрон исполняет code-behavior
  через `CodeBehaviorDriver` без ошибок.
- `grep` по проекту: ни одной ссылки на `Instruction`, `stepProgram`,
  `AstBehaviorDriver`, `sourceForm === "block"` в активном коде.
