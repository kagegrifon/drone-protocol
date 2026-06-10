# Code Mode (этап 1) — ядро исполнения JS-кода дронов

**Статус:** planned

Спецификация: [2026-06-10-drone-code-mode-design.md](../../superpowers/specs/2026-06-10-drone-code-mode-design.md)
Этап 2 (Monaco): [drone-code-mode-monaco.md](drone-code-mode-monaco.md)

## Зачем

Дать игроку (в первую очередь ученикам-фронтендерам) программировать дронов настоящим JS/TS
вместо визуальных блоков. Этот этап — **ядро без UI-редактора**: доказать, что чужой
async/await-код детерминированно встаёт на пошаговую модель намерений симуляции. Monaco и
тумблер код/блоки — отдельный этап 2.

## Поведение

- Дрон с `behavior.source === 'code'` исполняет JS-код игрока через Web Worker.
- Код пишется в async/await-стиле: `await drone.moveTo(ore); await drone.mine(); ...`.
- Одно действие (`await drone.moveTo`) = одно атомарное намерение: driver выставляет
  `program.state` и выходит из тика; существующие системы доводят действие; по завершении
  (`state → idle`) промис в воркере резолвится и код едет дальше.
- Сенсоры (`drone.energy`, `drone.freeSlots`, `distance(a,b)` и т.д.) — синхронны, снапшот тика.
- `while(true){}` без `await` ловится таймаутом воркера, не вешает игру.
- AST-режим (`source === 'block'`) продолжает работать без изменений поведения.
- На этом этапе код задаётся временно (textarea/фикстура в dev), полноценного редактора нет.

## Критерии готовности

- [ ] Тип `DroneBehavior` — дискриминированное объединение `{source:'block'; instructions}` /
      `{source:'code'; code}`; реестр и `gameStore` мигрированы, `type-check` зелёный.
- [ ] `CodeBehaviorDriver` + Web Worker + async-API (действия + сенсоры) работают.
- [ ] `ProgramExecutionSystem` выбирает driver по `source`; AST-ветка не изменилась.
- [ ] Unit: `await drone.moveTo` → `state='move'` + выход тика; «done» резолвит промис;
      таймаут ловит вечный цикл; одинаковый код → одинаковая трасса `state`.
- [ ] Эквивалентность: одна задача блоками и кодом → идентичная трасса `state` по тикам.
- [ ] `npm test` и `npm run type-check` зелёные.
- [ ] DECISIONS.md обновлён (behavior driver + единая модель намерений).

## Технические заметки

**Единая модель намерений.** `stepProgram` (`src/game/programs/interpreter.ts`) уже устроен
как driver: действие выставляет `program.state` и `return`, control-flow — `continue`.
Оборачиваем его как `AstBehaviorDriver`, рядом ставим `CodeBehaviorDriver`. Системы
Movement/Mining/Energy и `state`-механизм (`src/game/simulation/components/Program.ts`) **не
трогаем**.

**Мост воркер↔тик.** Воркер исполняет код игрока; на каждом `await drone.action()` шлёт
намерение в основной поток и зависает на промисе. `CodeBehaviorDriver` в `ProgramExecutionSystem`
в свой тик читает «есть ли намерение» → выставляет `state` → `return`. Когда системы вернули
`state` в `idle`, driver шлёт воркеру «done», промис резолвится. Сообщения должны быть
сопоставимы (id намерения), чтобы не рассинхронизироваться.

**Детерминизм.** Единственный способ «подождать» — `await drone.*`. В воркере глушим
`Math.random`, таймеры, сеть. Снапшот сенсоров формируется на старте тика и передаётся в
воркер, чтобы геттеры были консистентны в пределах тика.

**Новые файлы:** `src/game/code/CodeBehaviorDriver.ts`, `src/game/code/worker/*`,
`src/game/code/drone-api.d.ts`.
**Изменяемые:** `src/game/programs/types.ts`, реестр программ,
`src/shared/store/gameStore.ts`, `src/game/simulation/systems/ProgramExecutionSystem.ts`.

**НЕ входит:** Monaco, `.d.ts`-подсказки, тумблер настроек, E2E, новые игровые действия,
модули/импорты, шаринг кода между дронами, tick-стиль API.
