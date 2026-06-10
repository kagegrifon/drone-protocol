# 2026-06-10 — Дизайн: Code Mode (программирование дронов на JS/TS)

## Цель

Проработать смену концепции: от визуальных блоков к написанию настоящего JS/TS-кода для
дронов. Решить ключевые развилки (аудитория, где пишется код, стиль API, судьба блоков),
зафиксировать архитектуру и подготовить планы реализации.

## Результаты

Проведён брейншторм, согласованы решения:
- Аудитория — ученики-фронтендеры + автор; код как обучающий инструмент.
- Редактор — встроенный **Monaco** (игра самодостаточна), не внешняя IDE.
- Стиль API — **async/await** (`await drone.moveTo()`), не tick-функция.
- **Блоки остаются** — «рядом позже»; код и блоки сходятся к единой модели намерений
  через абстракцию **behavior driver**.
- Тип поведения — дискриминированное объединение по `source`.
- Переключатель код/блоки — в настройках, только вне миссии.
- Порядок: сначала ядро (детерминизм), потом Monaco.

Ключевое наблюдение: `stepProgram` уже работает как модель намерений (выставляет `state` +
`return`), поэтому JS-режим встаёт рядом без переделки систем Movement/Mining/Energy.

Созданные артефакты:
- Спецификация: `docs/superpowers/specs/2026-06-10-drone-code-mode-design.md`
- План этап 1 (ядро): `docs/features/planned/drone-code-mode-core.md`
- План этап 2 (Monaco): `docs/features/planned/drone-code-mode-monaco.md`
- Обновлены `docs/features/index.md` и `DECISIONS.md` (запись от 10-06-2026).

Кода не писали — это сессия дизайна. Реализация — в следующей сессии (стартовый промт ниже).

## Заметка

В рабочем дереве на момент сессии оставались незакоммиченные правки
`src/ui/editor/ProgramEditor/ConditionEditor.tsx` и `InstructionBlock.tsx` от предыдущей
работы — в этой сессии не трогались.

## Стартовый промт для следующей сессии

> Реализуем **этап 1 фичи Code Mode** (ядро исполнения JS-кода дронов, без Monaco).
> Спецификация: `docs/superpowers/specs/2026-06-10-drone-code-mode-design.md`.
> План: `docs/features/planned/drone-code-mode-core.md`.
>
> Суть: дрон с `behavior.source === 'code'` исполняет async/await-код игрока через Web
> Worker. `stepProgram` (`src/game/programs/interpreter.ts`) уже работает как модель
> намерений (выставляет `program.state` и `return`) — нужно обернуть его как
> `AstBehaviorDriver` и рядом сделать `CodeBehaviorDriver`, который принимает намерения из
> воркера, выставляет тот же `state` и резолвит промисы по завершении действия. Системы
> Movement/Mining/Energy и `state`-механизм НЕ трогаем.
>
> Объём этапа 1 (см. критерии готовности в плане):
> 1. Тип `DroneBehavior` — дискриминированное объединение `{source:'block';instructions}` /
>    `{source:'code';code}`; миграция реестра программ и `src/shared/store/gameStore.ts`.
> 2. `src/game/code/CodeBehaviorDriver.ts`, `src/game/code/worker/*`,
>    `src/game/code/drone-api.d.ts` (действия async + сенсоры sync из
>    `src/game/programs/functions.ts`).
> 3. `ProgramExecutionSystem` выбирает driver по `source`.
> 4. Таймаут/изоляция воркера (глушим Math.random/таймеры/сеть; единственный await — drone.*).
>
> Тесты (Vitest, без Phaser): `await drone.moveTo` → `state='move'` + выход тика; «done»
> резолвит промис; таймаут ловит `while(true){}`; детерминизм (одинаковый код → одинаковая
> трасса `state`); эквивалентность блоки↔код по трассе `state`.
>
> Используй TDD. В конце: `npm test` + `npm run type-check` зелёные, обнови DECISIONS если
> по ходу появятся новые решения, добавь запись в `docs/sessions/`. Коммить по правилам
> CLAUDE.md (отдельный коммит, `feat:`, не `git add -A`). NB: в рабочем дереве есть
> незакоммиченные правки ConditionEditor/InstructionBlock — не включай их в коммит ядра.

## Метрики сессии
- Модель: claude-opus-4-8
- Input: 14,788 токенов (кеш: 3,593,211 / запись в кеш: 161,403)
- Output: 66,931 токенов
- Контекст: 89,449 / 200,000 токенов (44.7%)
- Стоимость: $2.732
