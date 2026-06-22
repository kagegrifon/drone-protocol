# Фикс дёрганого движения дрона

**Дата:** 2026-06-22  
**Ветка:** `fix/jerky-drone-movement`

## Цель

Устранить паузу в ~1 тик между шагами движения дрона: дрон двигался рывками (едет ~10 тиков, стоит ~1 тик, едет снова). `Program.state` мигал `move → running → move`.

## Root cause

`CodeBehaviorDriver` отправлял воркеру `resume` только на следующем тике после того, как видел `program.state === "running"`. Ответ воркера (~15ms) приходил уже после завершения тика, в котором `path` был пуст — `MovementSystem` ничего не делала → дрон стоял 1 тик.

Порядок систем: `ProgramExecution → Movement`. `MovementSystem` эмитит `drone:moved` **после** обновления `position` — состояние мира в этот момент корректно для снапшота.

## Решение (Вариант A)

Изменения локализованы в [CodeBehaviorDriver.ts](../../src/game/code/CodeBehaviorDriver.ts):

1. **`lastAction`** — сессия запоминает тип последнего действия (`moveTo | mine | drop | charge | wait | null`).
2. **`world` на сессии** — при каждом `step()` обновляется ссылка на актуальный `World`; нужна обработчику `drone:moved` для `collectWorld`.
3. **`blocked` флаг** — установливается при `drone:blocked`; запрещает ранний resume, если дрон заблокирован.
4. **Подписка на `gameEvents.on("drone:moved", ...)`** — если `phase === "action-pending"` и `lastAction === "moveTo"` и `!blocked`, отправляет `resume` немедленно, переводит `phase = "idle"`. 15ms < 100ms тика — воркер успевает ответить до начала следующего тика.
5. **Подписка на `gameEvents.on("drone:blocked", ...)`** — устанавливает `session.blocked = true`.
6. **Отписка в `disposeAll()`** — `gameEvents.off(...)` для обоих обработчиков.

`mine / drop / charge / wait` остаются на консервативном пути (ждут `state === "running"`) — их нельзя пайплайнить, воркер должен видеть мир уже после того, как системы досчитали результат.

## Тесты

Добавлены 3 новых unit-теста в [CodeBehaviorDriver.test.ts](../../src/game/code/CodeBehaviorDriver.test.ts):

- **`early resume on drone:moved`** — один `step()` после события достаточен для старта следующего `moveTo`.
- **`mine action does NOT get early resume`** — для `mine` ранний resume не отправляется.
- **`drone:blocked suppresses early resume`** — один `step()` после `blocked` оставляет `state=running`.

Итого: 210/210 тестов зелёных, `type-check` чист.

## Вне scope

Холодный старт воркера при первом запуске (до нескольких секунд в dev) — это разовая пауза, не межшаговая. Фикс её не затрагивает.
