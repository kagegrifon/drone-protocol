# Сессия 2026-06-11 — Code Mode, Этап 2, Phase F

## Цель

Реализовать Phase F плана `1-code-squishy-eagle.md` (этап 2 Code Mode):
интеграция `<CodeEditor>` в `ProgramEditor` + глобальный тумблер
«БЛОКИ / КОД» в настройках.

## Результаты

- `src/ui/modals/AudioSettingsModal.tsx` — новая секция «РЕЖИМ
  ПРОГРАММИРОВАНИЯ»: радио-переключатель БЛОКИ/КОД, читает/пишет
  `useGameStore.codeModeEnabled` через `setCodeModeEnabled`.
  `data-testid="code-mode-toggle"` на радио БЛОКИ. Disabled +
  пояснение «режим фиксируется на время миссии», когда
  `gameStatus === "running" | "paused"`.
- `src/shared/store/gameStore.ts` — новый action `setProgramCodeSource(programId, code)`:
  обновляет `ProgramDef.codeSource` в `registry` и сбрасывает воркер-сессию
  через `_systems.programExecution.disposeDrone(droneId)` для всех дронов,
  у которых это личная или назначенная программа — код применяется на
  следующем тике.
- `src/game/simulation/systems/ProgramExecutionSystem.ts` — новый метод
  `disposeDrone(droneId)`, проксирует в `CodeBehaviorDriver.dispose(droneId)`.
- `src/ui/editor/ProgramEditor/index.tsx` — вкладки DRONE и PROGRAM: при
  `codeModeEnabled === true` рендерят `<CodeEditor>` вместо
  блочного DnD-редактора (`onChange` → `setProgramCodeSource`); на DRONE
  дополнительно показывается баннер `drone.codeError` (`color: #ff4444`)
  под редактором. LIBRARY без изменений (фильтрация программ по режиму уже
  была сделана в Phase A).

## Проверка

- `npm run type-check` — чисто.
- `npx vitest run` — 254/254 зелёные (включая `gameStore.test.ts`).
- Вручную через Playwright (временный скрипт, не сохранён в репозитории):
  intro → старт → настройки → переключение БЛОКИ/КОД → запуск миссии →
  выбор дрона → вкладка DRONE показывает Monaco, ввод кода
  (`await drone.mine();`) сохраняется; вкладка LIBRARY → создание
  программы → вкладка PROGRAM показывает Monaco для библиотечной
  программы, ввод кода работает. Ошибок в консоли браузера нет.

## Следующий шаг — Phase G

E2E-тест (Playwright): ввести код → запустить миссию → дрон выполняет
цикл добычи. См. план, секция Phase G.

## Метрики сессии
- Модель: claude-sonnet-4-6
