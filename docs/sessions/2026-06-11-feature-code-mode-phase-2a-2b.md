# Сессия 2026-06-11 — Code Mode, Этап 2, Phase A + B

## Цель

Реализовать первые две фазы плана `1-code-squishy-eagle.md` (этап 2 Code Mode):
- Phase A — глобальный флаг `codeModeEnabled` + модель данных (`ProgramDef.behaviorMode`).
- Phase B — переключение `BehaviorDriver` по `behaviorMode` активной программы.

## Результаты

### Phase A (commit `2d23ac7`)

- `src/game/programs/types.ts` — `ProgramDef.behaviorMode: "block" | "code"` (обязательное),
  `codeSource?: string`.
- `src/shared/store/gameStore.ts`:
  - `codeModeEnabled: boolean`, `setCodeModeEnabled(v)` — no-op вне `idle`/`won`/`failed`,
    persist в `localStorage` (`droneloop.codeModeEnabled`) через `loadCodeModeEnabled`/`saveCodeModeEnabled`.
  - `DroneState.codeError?: string`, прокинут в `snapshotDrones()`.
  - Новый хелпер `filterPrograms(registry, codeModeEnabled)` — заменил все 5 мест с
    `filter(p => !p.personal)`.
  - `createProgram()` ставит `behaviorMode` по текущему `codeModeEnabled` (+ `codeSource: ""`
    для режима кода).
  - `init()` — post-process personal-программ: при `codeModeEnabled=true` личная программа
    каждого дрона получает `behaviorMode: "code"`, `instructions: []`, `codeSource: ""`.
- Все 4 миссии и существующие тесты (`AstBehaviorDriver.test.ts`, `equivalence.test.ts`,
  `interpreter.test.ts`, `atomic-actions.integration.test.ts`, `ProgramExecutionSystem.test.ts`,
  `gameStore.test.ts`) обновлены под обязательное поле `behaviorMode: "block"`.
- 11 новых тестов в `gameStore.test.ts` (TDD: RED → GREEN).

### Phase B (commit `40f7955`)

- `ProgramExecutionSystem.update()` — вместо проверки `program.codeSource` теперь читает
  `activeProgramId = program.currentProgramId ?? program.personalProgramId`, смотрит
  `registry.get(activeProgramId)?.behaviorMode` и выбирает `codeDriver`/`astDriver`.
- `CodeBehaviorDriver.step()` — код для новой сессии воркера читается из
  `ctx.registry.get(activeProgramId)?.codeSource`, а не из `program.codeSource`.
- Обновлены фикстуры `CodeBehaviorDriver.test.ts` и `equivalence.test.ts`: теперь дрон
  ссылается на personal `ProgramDef` в registry с `behaviorMode: "code"` + `codeSource`.

## Проверка

- `npm run type-check` — чисто.
- `npx vitest run` — **253/253 тестов проходят** (26 файлов).

## Открытые моменты

- `ProgramComponent.codeSource` (на компоненте, не на `ProgramDef`) сейчас не используется
  нигде в коде — оставлен как задел под Phase F (`setProgramCodeSource` синхронизирует кэш
  на компоненте для немедленного эффекта). Если Phase F не будет реализовываться в
  ближайшее время — рассмотреть удаление поля.

## Следующий шаг — Phase C

**Стартовый промпт для следующей сессии:**

> Проект Drone Loop (robot-protocol), этап 2 Code Mode.
> Phase A и B реализованы и закоммичены (`2d23ac7`, `40f7955`).
> План: `C:\Users\Master\.claude\plans\1-code-squishy-eagle.md`, секция Phase C.
>
> Задача: подключить `CodeBehaviorDriver` в `gameStore.init()` —
> - создать `codeDriver = new CodeBehaviorDriver({ createPort: () => new BrowserWorkerPort() })`
>   и передать в `ProgramExecutionSystem`.
> - при повторном `init()` освобождать worker-сессии предыдущего `codeDriver`
>   (добавить `dispose()` в `ProgramExecutionSystem`, вызывающий `codeDriver?.disposeAll()`).
> - минимальный Vitest-тест через `useGameStore.getState().init(...)` с миссией, где
>   личная программа дрона `behaviorMode: "code"`.
>
> После Phase C — Phase D (Monaco + Vite) и далее по плану.
