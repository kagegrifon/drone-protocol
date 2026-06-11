# Code Mode (этап 1) — ядро исполнения JS-кода дронов

**Статус:** ядро реализовано; миграция реестра/gameStore на `DroneBehavior` — отдельная будущая задача (см. примечание в конце критериев)

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

- [x] Тип `DroneBehavior` — дискриминированное объединение `{source:'block'; instructions}` /
      `{source:'code'; code}` добавлен (additive, `src/game/programs/types.ts`), `type-check`
      зелёный. **Не входит в этот этап:** миграция `ProgramRegistry`/`ProgramDef`/`gameStore` на
      этот тип во всех ~14 использующих `.instructions` файлах (миссии, UI редактор, рендерер,
      store) — отдельная будущая задача после Monaco (этап 2). На этом этапе код передаётся
      через временное additive-поле `program.codeSource`/`program.codeError`.
- [x] `CodeBehaviorDriver` + Web Worker (`BrowserWorkerPort`/`NodeWorkerPort`) + async-API
      (действия `moveTo`/`mine`/`drop`/`charge`/`wait` + сенсоры `energy`/`inventory`/
      `freeSlots`/`distance`/`deposit`) работают.
- [x] `ProgramExecutionSystem` выбирает driver по `program.codeSource`; AST-ветка
      (`AstBehaviorDriver`) не изменилась — обёртка над существующим `stepProgram`.
- [x] Unit: `await drone.moveTo` → `state='move'` + выход тика; «done»/`finished` резолвит
      промис и переводит к следующему `await`; таймаут (`setTimeout` + `port.terminate()`)
      ловит вечный цикл (`while(true){}`); одинаковый код → одинаковая трасса distinct `state`
      (детерминизм, dedupe-сравнение).
- [x] Эквивалентность: задача `moveTo`+`mine` блоками (`AstBehaviorDriver`/`stepProgram`) и
      кодом (`CodeBehaviorDriver`) → идентичная последовательность переходов action-`state`
      (`move`→`mine`→`idle`) — `src/game/code/equivalence.test.ts`.
- [x] `npm test` и `npm run type-check` зелёные (241/241 тестов, 26 файлов).
- [x] DECISIONS.md обновлён (behavior driver + единая модель намерений + детали реализации
      этапа 1).

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
