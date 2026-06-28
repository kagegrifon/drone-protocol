# 2026-06-28 — feat: Подключение модулей в программы дронов (library-modules-import)

## Цель

Завершить фичу «подключение программ из библиотеки как ES-модулей»
(`import { f } from "miner"`): закрыть оставшиеся задачи плана —
рефакторинг обхода AST, E2E-тесты, финальная верификация и документация.
Ядро линкера, интеграция в `CodeBehaviorDriver`, транзитивный дроп сессий и
типизация Monaco были сделаны в предыдущих коммитах ветки
`feat/library-modules-import`.

## Результаты

### Рефакторинг обхода AST на `acorn-walk`

`collectRenamePatches` в [linkProgram.ts](../../src/game/code/linker/linkProgram.ts)
переписан с самопального reflection-обхода на `acorn-walk` (`recursive`):

- Visitor'ы остались ручными только там, где есть логика: `Identifier`
  (scope-aware переименование), `Function` (расширение области видимости),
  `ImportDeclaration` (пропуск — декларация вырезается отдельно).
- `MemberExpression`/`Property` удалены — base-walker `acorn-walk` уже не
  спускается в не-computed property/ключ объекта (проверено по его исходнику,
  поведение байт-в-байт совпадает с прежним ручным кодом).
- Удалены динамические хелперы `asNode/child/children/str/addParamNames` и
  локальный нетипизированный `AnyNode`; `collectPatternNames`/`addLocalBindings`
  переведены на типы acorn (`Pattern`/`Identifier`) без `as`-кастов.

Чистый рефакторинг без изменения поведения — все 282 unit-теста линкера и
остального кода остались зелёными.

**Почему acorn-walk, а не свой обход:** scope-aware shadowing всё равно
пишется вручную (его `recursive` не несёт scope-состояния автоматически), но
base-walker снимает весь generic-обход и обработку member/property — это и дало
выигрыш в читаемости. Пакет уже был в зависимостях.

### E2E (Playwright)

Добавлен [e2e/library-modules.spec.ts](../../e2e/library-modules.spec.ts) — 2 теста:

1. **Happy path:** создать программу-модуль `miner` с `export async function
   harvest()`, убедиться в бейдже «exports» в LIBRARY, создать программу-потребитель
   `main` с `import { harvest } from "miner"`, назначить дрону, запустить —
   дрон добывает руду (ORE > 0).
2. **Ошибка линковки:** программа с `import { nope } from "ghost-module"` →
   после запуска на вкладке DRONE появляется бейдж «⚠» с текстом
   `Unknown module "ghost-module"`.

Код в Monaco вводится через буфер обмена (как в `code-mode.spec.ts` — `type()`
ломается об автозакрытие скобок). Тесты самодостаточны: чистят `localStorage`.

### Верификация

- `npm run type-check` — чисто.
- `npm test` — 282 unit-теста зелёные (33 файла).
- `npm run test:e2e` — 9 E2E зелёные (включая 2 новых).
- Ручная проверка автодополнения `import` в Monaco через `npm run dev` —
  оставлена пользователю (инструкция выдана).

### Документация

- Фича перемещена `planned/` → `done/`, все критерии готовности отмечены,
  добавлена заметка про обход на `acorn-walk`.
- Обновлён `docs/features/index.md`.

## Заметки на будущее

- Подсветка строки внутри модулей (stack-trace-дебаггинг многомодульных
  программ) — отдельный **этап 2**, описан в feature-файле.
- Стабильность slug: переименование программы ломает импортеров — приемлемо для
  v1, в будущем явное поле `moduleName`.
