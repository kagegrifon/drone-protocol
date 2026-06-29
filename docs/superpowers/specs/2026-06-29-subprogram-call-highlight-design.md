# Подсветка строки вызова подпрограммы — дизайн

**Дата:** 2026-06-29
**Ветка:** fix/import-lib

## Проблема

При выполнении тела импортированной подпрограммы подсветка текущей строки в
редакторе entry-программы гаснет. Пример:

```js
import { goToBase } from "my";

while (true) {
  const mine = World.mines[0];
  while (self.position.x !== mine.position.x || self.position.y !== mine.position.y) {
    await self.moveTo(mine.position); // ← подсвечивается
  }
  while (self.inventory < self.inventoryMax) {
    await self.mine();                // ← подсвечивается
  }
  await goToBase();                   // ← НЕ подсвечивается, а нужно
}
```

Пока выполняется тело `goToBase()`, в редакторе entry ничего не подсвечено.

### Причина

1. `instrument()` вставляет `__line(N)` только перед `await self.<action>()`
   (`moveTo/mine/drop/charge/wait`). Вызов `await goToBase()` под это не подпадает.
2. `currentLine` в воркере — одна переменная; внутренние `await self.moveTo()`
   подпрограммы перетирают её строкой **внутри модуля**.
3. `mapLine()` для строки не-entry-сегмента возвращает `null` (v1-политика
   «гасить в модулях») → подсветка гаснет.

## Цель

Пока выполняется тело подпрограммы, подсвечивать **строку её вызова в entry**
(`await goToBase()`). Корректно на любой глубине вложенности (entry → modA → modB:
подсвечивается строка вызова modA в entry).

## Решение: call stack строк в воркере

Заменяем единственную переменную `currentLine` на **стек кадров строк**. Перед
входом в подпрограмму — push строки вызова; после выхода — pop. При отправке
intent наружу шлём весь стек; driver выбирает самую глубокую строку,
принадлежащую entry-сегменту.

### 1. Воркер — `codeRuntime.ts`

Вместо `let currentLine = 0` — стек кадров и хелпер-обёртка вызова `__call`:

```ts
// Стек кадров вызова. Каждый кадр — текущая строка склеенного кода на своём
// уровне. lineStack[0] — top-level entry, далее — вложенные вызовы подпрограмм.
const lineStack: number[] = [0];

function __line(n: number): void {
  lineStack[lineStack.length - 1] = n; // обновляем текущий кадр
}
function __pushCall(n: number): void {
  lineStack[lineStack.length - 1] = n; // строка вызова на уровне вызывающего
  lineStack.push(0);                   // новый кадр для тела подпрограммы
}
function __popCall(): void {
  lineStack.pop();
}

/**
 * Оборачивает вызов подпрограммы: push кадра перед, pop после — при ЛЮБОМ
 * исходе. Корректно для всех 4 комбинаций sync/async × await/no-await, т.к.
 * сам определяет thenable результат. invoke вызывается синхронно (push виден
 * сразу), pop для промиса — в .finally, для sync — немедленно (в т.ч. при throw).
 */
function __call<T>(line: number, invoke: () => T): T {
  __pushCall(line);
  let result: T;
  try {
    result = invoke();
  } catch (err) {
    __popCall();
    throw err;
  }
  const isThenable =
    result != null && typeof (result as { then?: unknown }).then === "function";
  if (isThenable) {
    return (result as unknown as Promise<unknown>).finally(__popCall) as T;
  }
  __popCall();
  return result;
}
```

`sendMove`/`sendAction`/`wait` шлют копию стека: `lineStack: [...lineStack]`.
В `AsyncFunction` прокидываются `__line`, `__pushCall`/`__popCall` (через `__call`),
`__call`.

### 2. Инструментация — `instrument.ts`

Обходчик AST дополняется: **любой** вызов экспортированной функции модуля
оборачивается в `__call`. Детекция — `CallExpression` с callee-`Identifier`,
имя которого начинается на `__mod_` (внутреннее соглашение линкера; instrument
уже работает на склеенном коде, поэтому завязка локальна).

Трансформация:

```js
// было:  __mod_my__goToBase(arg)
// стало: __call(13, () => __mod_my__goToBase(arg))
```

> **Почему `__call`, а не инлайн `.finally`:** линкер принимает любую
> `export function` — sync ИЛИ async (`parseNamedExport` проверяет только
> `FunctionDeclaration`, `isAsync` не требуется). Вызвать подпрограмму можно и
> без `await`. Инлайн `result.finally(__popCall)` упал бы на синхронном экспорте
> (у не-Promise нет `.finally`). `__call` определяет thenable в рантайме и
> ветвится — безопасно для всех случаев. Поэтому оборачиваем ВСЕ `__mod_*`
> вызовы, а не только `await __mod_*`.

`await self.<action>()` по-прежнему получают `;(__line(N), ...)` — без изменений.

> **Вложенность патчей:** `__call(...)`-обёртка и `__line`-обёртка могут
> вкладываться (`await self.moveTo()` внутри тела модуля уже обёрнуто `__line`,
> а сам вызов модуля — `__call`). Патчи по-прежнему собираются и применяются с
> конца по убыванию `start`; обёртка вызова — это замена диапазона всего
> `CallExpression`, не пересекающаяся с внутренними `await self.*` (они глубже и
> патчатся независимо). Реализация — деталь плана.

### 3. Сообщения — `types.ts`

В `intent` и `wait` WorkerMessage добавляется `lineStack: number[]` (строки
склеенного кода, от внешнего кадра к внутреннему). Поле `line: number`
сохраняется для обратной совместимости/диагностики, но driver переходит на стек.

### 4. Маппинг стека → entry-строка — `mapLine.ts` + `CodeBehaviorDriver.ts`

Новая функция `mapStackToEntryLine`:

```ts
/**
 * Из стека склеенных строк выбирает строку для подсветки entry-программы:
 * самую глубокую строку, принадлежащую entry-сегменту. Если исполнение целиком
 * внутри модулей и в entry нет соответствующего кадра — null (подсветка гаснет).
 */
export function mapStackToEntryLine(
  lineStack: number[],
  lineMap: LineMapSegment[],
  entryId: string,
): number | null {
  let result: number | null = null;
  for (const gluedLine of lineStack) {
    const mapped = mapLine(gluedLine, lineMap, entryId);
    if (mapped) result = mapped.origLine; // глубже — побеждает
  }
  return result;
}
```

В примере стек `[стр. goToBase() в entry, стр. moveTo() в модуле]`: первая мапится
в entry → result, вторая в модуль → mapLine вернёт null → result не перетрётся.
Подсвечивается `await goToBase()`. ✅

`CodeBehaviorDriver.mapToEntryLine` переключается на `mapStackToEntryLine(msg.lineStack, ...)`.

## Forward-compatibility со step-debug (ответ на риск двойной работы)

Будущий пошаговый дебагер (`await __step(N)` на каждый statement, см. комментарий
в `instrument.ts`) **переиспользует** этот фундамент:

| Компонент | В step-debug |
|---|---|
| Call stack кадров (`__pushCall`/`__popCall`/`lineStack`) | ✅ переиспользуется целиком — дебагер обязан вести стек кадров для step-over/into/out и панели Call Stack |
| `lineStack` в WorkerMessage | ✅ переиспользуется — это и есть стек кадров наружу |
| Маппинг склеенная строка → (programId, origLine) | ✅ переиспользуется |
| Политика «бери только entry-строку» в `mapStackToEntryLine` | ⚠️ ~20-30 строк, заменится на «показывай весь стек кадров с их файлами» |
| Инструментация `__mod_*`-вызовов / `await self.*` | ⚠️ заменится на `__step` перед каждым statement; машинерия обхода AST та же |
| Хелпер `__call` (push/pop вокруг вызова) | ✅ переиспользуется — это и есть механизм построения кадров стека при заходе в функцию |

Узкая v1-политика подсветки осознанно держится тонким сменным слоем поверх
переиспользуемого стека. Спекулятивный полный API дебагера сейчас НЕ строим (YAGNI).

## Тестирование

- `instrument.test.ts` / `instrumentCompat.test.ts`:
  - `__mod_*(...)` (с `await` и без) оборачивается в `__call(LINE, () => ...)`;
  - `await self.<action>()` по-прежнему получают `;(__line(N), ...)`;
  - обычные синхронные вызовы и не-модульные функции (`self.*`, локальные хелперы) не трогаются.
- `codeRuntime` / `__call` (юнит на сам хелпер, без воркера):
  - async-результат → pop после оседания промиса (в т.ч. при reject);
  - sync-результат → pop немедленно; sync throw → pop + проброс ошибки;
  - стек кадров не растёт после серии вызовов (push/pop сбалансированы).
- `mapLine.test.ts` (новые кейсы для `mapStackToEntryLine`):
  - entry-only стек → entry-строка;
  - entry → mod → подсвечивается entry-строка вызова;
  - entry → modA → modB → подсвечивается строка вызова modA в entry;
  - стек целиком внутри модулей (нет entry-кадра) → null.
- E2E: миссия с импортом подпрограммы; проверить, что строка вызова
  (`data-testid` на редакторе/декорации) подсвечена во время выполнения тела.

## Затрагиваемые файлы

- `src/game/code/worker/codeRuntime.ts` — стек вместо `currentLine`, push/pop хелперы, проброс в AsyncFunction.
- `src/game/code/worker/instrument.ts` — обёртка `await __mod_*` вызовов.
- `src/game/code/types.ts` — `lineStack` в `intent`/`wait`.
- `src/game/code/linker/mapLine.ts` — `mapStackToEntryLine`.
- `src/game/code/CodeBehaviorDriver.ts` — переход на `mapStackToEntryLine`.
- Тесты: `instrument.test.ts`, `instrumentCompat.test.ts`, `mapLine.test.ts`, e2e.
