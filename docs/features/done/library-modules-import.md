# Подключение модулей в программы дронов (library imports)

**Статус:** done

План реализации: [hidden-kindling-gizmo.md](../../../../../.claude/plans/hidden-kindling-gizmo.md) (локальный, вне репозитория)

## Зачем

Сейчас каждая программа дрона — изолированный скрипт: общий код (например, цикл добычи)
нельзя переиспользовать в нескольких программах. Игрок хочет **подключать программы из
библиотеки как модули** — вынести общую логику в отдельную программу и вызывать её из
других через стандартный `import { mineLoop } from "miner"`. Импорт должен типизироваться
в Monaco (автодополнение и проверка типов через границу модуля), модули могут импортировать
другие модули (под-зависимости) с обнаружением циклов.

## Поведение

- Любая программа может объявить **экспорт** функции: `export function f(...)` /
  `export async function f(...)`. Если у программы есть экспорты — её можно импортировать.
- Импорт — именованный, спецификатор = **slug имени программы**
  (`name.trim().toLowerCase().replace(/\s+/g, "-")`):
  `import { mineLoop } from "miner"`.
- Программа без экспортов и без импортов работает как сейчас, без изменений.
- Модуль может импортировать другой модуль (транзитивные зависимости). Циклы — ошибка.
- В Monaco импорт типизируется: автодополнение имён из `"miner"`, типы параметров берутся из
  JSDoc экспортируемой функции (`@param`/`@returns`), иначе `any`.
- Ошибки подключения (неизвестный модуль, отсутствующий экспорт, цикл, неподдерживаемый
  синтаксис) выводятся в редакторе через существующий канал `program.codeError`, дрон не
  стартует.
- При редактировании модуля перезапускаются дроны всех программ, которые транзитивно его
  импортируют (транзитивный дроп воркер-сессий).
- **Подсветка строки (v1):** работает только для строк entry-программы; пока исполнение
  внутри модуля — подсветка гаснет. Полноценный stack-trace-дебаггинг многомодульных
  программ — отдельный этап 2.

**Поддерживаемый синтаксис экспорта (v1):** только `export [async] function`. Отклоняются с
явной ошибкой: `export const`, `export default`, `export { a, b }`, ре-экспорты,
default/namespace-импорты.

## Критерии готовности

- [x] Линкер `src/game/code/linker/` (чистые функции): `parseModule` (acorn,
      `sourceType: "module"`), `linkProgram` (граф зависимостей, обнаружение циклов,
      неймспейсинг top-level-имён `__mod_<slug>__<name>`, эмиссия плоского кода + `lineMap`),
      `slug`, типизированные `LinkError`.
- [x] `CodeBehaviorDriver.step()` линкует программу через `ctx.registry` перед `postMessage`;
      `LinkError` → `program.codeError`, воркер не стартует; строки маппятся через `lineMap`
      (v1: гасить подсветку в модулях).
- [x] Выход линкера парсится под опциями `instrument.ts` и собирается в `new AsyncFunction`
      без ошибок (регрессионный тест `instrumentCompat.test.ts`); `instrument.ts` не изменён.
- [x] `setProgramCodeSource` (gameStore) транзитивно дропает сессии всех зависимых дронов
      (`dependentsOf(programId, registry)` — чистая функция в linker/).
- [x] Типизация Monaco: `genModuleDts(programs)` генерирует `declare module "<slug>" { ... }`,
      `updateModuleLibs` перерегистрирует их как extraLibs при изменении программ; амбиентный
      `drone-api.d.ts` сохраняется; `compilerOptions` не меняются.
- [x] UI: бейдж «exports» на программах с модульным интерфейсом в `ProgramEditor`.
- [x] Unit (Vitest): `parseModule` (обнаружение/отклонение синтаксиса); `linkProgram`
      (инлайн импорта + переписывание ссылок; транзитивный A→B→C в топопорядке; «ромб»
      A→B,C→D — D один раз; цикл A↔B → `CycleError`; unknown specifier; missing export;
      duplicate slug; коллизия приватных имён не возникает); `lineMap`; `dependentsOf`;
      `genModuleDts` (JSDoc → типы, без JSDoc → `any[]`).
- [x] E2E (Playwright): создать модуль с `export`, импортировать в другую программу, назначить
      дрону, проверить выполнение; проверить вывод ошибки при неизвестном импорте
      (`e2e/library-modules.spec.ts`).
- [x] `npm test` (282), `npm run type-check`, `npm run test:e2e` (9) зелёные.

## Технические заметки

**Реальный `import` невозможен в `AsyncFunction`.** Код игрока исполняется как тело
`new AsyncFunction("self", "World", "__line", code)`
([codeRuntime.ts:178](../../../src/game/code/worker/codeRuntime.ts)) — это не ES-модуль. Поэтому
`import`/`export` — **контракт времени линковки**: на главном потоке парсим программы через
acorn (уже зависимость, используется в
[instrument.ts](../../../src/game/code/worker/instrument.ts)), строим граф, топологически
склеиваем тела модулей в одно тело `AsyncFunction` с неймспейсингом имён, вырезая
`import`/`export`. В воркер уходит один плоский `code: string` — протокол `DriverMessage.start`
не меняется. Глобальный `Modules`-объект не вводим.

**Линковка на главном потоке.** `ctx.registry` уже доступен в `CodeBehaviorDriver.step()`
([строка 60](../../../src/game/code/CodeBehaviorDriver.ts)), и `code` собирается там же перед
`postMessage`. Реестр живёт в Zustand на главном потоке — гонять его в каждый per-drone воркер
не нужно. Линкер — чистая функция, тестируется в Vitest.

**Неймспейсинг.** Каждое top-level-имя модуля префиксуется slug-ом
(`mineLoop` → `__mod_miner__mineLoop`), импортированные локали переписываются на префиксованные
имена. Патчи применяются с конца по acorn-offset'ам — **тот же приём, что уже в**
[instrument.ts:60-71](../../../src/game/code/worker/instrument.ts). Переименование scope-aware:
только top-level-биндинги, не параметры/локали/шейдоу — самая тонкая часть, покрыть тестами
плотно. Обход AST — `acorn-walk` (`recursive`): visitor'ы для `Identifier` (переименование),
`Function` (расширение scope) и `ImportDeclaration` (пропуск); `MemberExpression`/`Property`
обходит base-walker (он сам не спускается в не-computed property/ключ объекта).

**Модель данных.** `ProgramDef` остаётся только-код; экспорты/импорты выводятся парсингом
`behavior.code` на лету (не денормализуем). Производный тип `ModuleInterface` —
`src/game/programs/moduleInterface.ts`.

**Ошибки линковки** идут в `program.codeError`
([CodeBehaviorDriver.ts:169](../../../src/game/code/CodeBehaviorDriver.ts)) — ровно как
существующий путь runtime-ошибки, выводится в
[ProgramCodeBlock](../../../src/ui/editor/CodeEditor/ProgramCodeBlock.tsx).

**Новые файлы:** `src/game/code/linker/{linkProgram,parseModule,slug,errors,genModuleDts}.ts`
(+тесты), `src/game/programs/moduleInterface.ts`.
**Изменяемые:** [CodeBehaviorDriver.ts](../../../src/game/code/CodeBehaviorDriver.ts),
[gameStore.ts](../../../src/shared/store/gameStore.ts),
[monacoSetup.ts](../../../src/ui/editor/CodeEditor/monacoSetup.ts),
[ProgramEditor/index.tsx](../../../src/ui/editor/ProgramEditor/index.tsx).
**Не трогаем:** [instrument.ts](../../../src/game/code/worker/instrument.ts) (работает на
склеенном коде), протокол `DriverMessage`/`WorkerMessage`.

## Открытые вопросы / риски

- **Программа с экспортами И top-level-телом:** при импорте top-level-тело НЕ исполняется
  (линкуются только определения функций). Задокументировать; возможно lint-предупреждение.
- **Стабильность slug:** переименование программы меняет спецификатор и ломает импортеров.
  Приемлемо для v1; пометить в UI; в будущем — явное поле `moduleName`.
- **Отладка многомодульных программ** (stack trace, подсветка строки вызова подпрограммы) —
  отдельный **этап 2**. Желаемый UX: стек кадров `[{ programId, line }]` вместо одного
  `currentLine`; в entry-редакторе подсвечивается строка вызова, внизу — stack trace с
  переходом по кадрам.

## НЕ входит в v1

Stack-trace-дебаггинг и подсветка внутри модулей (этап 2); `export const`/`export default`/
ре-экспорты; глобальный `Modules`-объект; явное поле `moduleName`; песочница исполнения.
