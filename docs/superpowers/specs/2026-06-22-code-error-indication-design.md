# Спека: индикация ошибки в коде дрона

Дата: 2026-06-22
Статус: согласовано, готово к написанию плана реализации

## Контекст

Когда в коде дрона (Code Mode) происходит ошибка выполнения — runtime-исключение или
таймаут синхронного участка — пользователь должен это явно видеть. Сейчас бэкенд
ошибок **уже полностью работает**: `program.codeError` ловится воркером
([codeRuntime.ts](../../../src/game/code/worker/codeRuntime.ts) — `.catch` шлёт
`{ type: "error", message }`), сохраняется в `ProgramComponent`
([Program.ts](../../../src/game/simulation/components/Program.ts)) в обработчике
`error`/timeout ([CodeBehaviorDriver.ts](../../../src/game/code/CodeBehaviorDriver.ts)),
течёт через `snapshotDrones()`
([gameStore.ts](../../../src/shared/store/gameStore.ts)) в Zustand как
`drone.codeError`.

Единственная индикация сейчас — красный текст под редактором кода в
[ProgramCodeBlock.tsx](../../../src/ui/editor/CodeEditor/ProgramCodeBlock.tsx).
Нужно сделать ошибку заметной ещё в трёх местах и исправить логический баг со
сбросом.

## Принятые решения

- Индикация в `DroneList` (это и есть «левая панель» в терминологии пользователя)
  плюс бейдж у активной программы в `ProgramEditor`.
- Маркер строки в Monaco **не делаем**: точной строки ошибки нет, рунтайм знает
  лишь «последний пройденный await» (`currentLine`) — это приближение, ложный
  маркер хуже его отсутствия.
- На игровом поле — **пульсирующий красный tint** тела дрона.
- Сброс индикации — **при новом запуске кода** (момент, когда драйвер заново
  создаёт worker-сессию для дрона).

## Изменения

### 1. Сброс `codeError` при новом запуске (фикс) — `src/game/code/CodeBehaviorDriver.ts`

В `step()`, в ветке создания новой сессии (`if (!session)`), очистить ошибку перед
стартом воркера: `program.codeError = undefined;`. Сейчас при перезапуске старая
ошибка висит до следующего `error`/`finished`.

### 2. `DroneList` — статус ERROR — `src/ui/panels/DroneList.tsx`

- `hasError = !!d.codeError`.
- Точка-индикатор и лейбл статуса: при `hasError` цвет `#ff4444`, приоритетнее
  `programState` и `localPaused`.
- Лейбл статуса при ошибке = `ERR`.
- Значок `⚠` рядом с именем `Drone #{d.id}` при `hasError`.
- `statusColor`/`statusLabel` — выбрать минимально инвазивный способ учесть
  `codeError` (ранний возврат или параметр).

### 3. `ProgramEditor` — бейдж у активной программы — `src/ui/editor/ProgramEditor/index.tsx`

Активная программа = `assignedProgram` если есть, иначе `personalProgram`
(см. `activeProgramId`). Ошибку показываем только у активной.

- Значок `⚠` (`#ff4444`) рядом с именем активной программы — виден даже когда блок
  свёрнут.
- Красная рамка блока (`BLOCK_STYLE`) при наличии ошибки у активного блока.
- Текст ошибки под редактором (`ProgramCodeBlock`, prop `codeError`) — оставить
  как есть.

### 4. `DroneSprite` — пульсирующий красный tint — `src/renderer/sprites/DroneSprite.ts`

- Поле `_errorTween: Phaser.Tweens.Tween | null = null` и метод
  `setErrorState(hasError: boolean)`, идемпотентный (как `setIdleAnimation`):
  - `true`: `this._body.setTint(0xff4444)` + пульсация tween по `alpha` тела
    (например `{ from: 1, to: 0.4 }`, `yoyo`, `repeat: -1`, `duration ~500`).
  - `false`: остановить tween, `clearTint()`, `alpha = 1`.
- В `destroy()` снять `_errorTween`.
- Цвет в `COLORS.DRONE_ERROR = 0xff4444` ([config.ts](../../../src/renderer/config.ts)).

### 5. `GameScene` — применение визуала — `src/renderer/scenes/GameScene.ts`

В блоке обновления спрайта дрона (где читается `program` и вызываются
`setGlowMode`/`setSelected`/`updateStats`) добавить
`sprite.setErrorState(!!program?.codeError);`.

## Критические файлы

- `src/game/code/CodeBehaviorDriver.ts` — сброс ошибки при старте сессии
- `src/ui/panels/DroneList.tsx` — статус ERROR + значок
- `src/ui/editor/ProgramEditor/index.tsx` — бейдж + рамка у активной программы
- `src/renderer/sprites/DroneSprite.ts` — `setErrorState` (пульсирующий tint)
- `src/renderer/scenes/GameScene.ts` — вызов `setErrorState`
- `src/renderer/config.ts` — `DRONE_ERROR`

Существующие поля переиспользуются как есть: `drone.codeError` (store),
`program.codeError` (`ProgramComponent`), снапшот в `gameStore.snapshotDrones()`.

## Verification

1. `npm run type-check`.
2. `npm test` — unit в `CodeBehaviorDriver.test.ts`: после ошибки
   `program.codeError` задан; при следующем `step()` (новая сессия) — сброшен.
3. `npm run dev` — вручную: заведомо падающая программа (`await self.moveTo(null)`),
   проверить: `ERR` + `⚠` в `DroneList`; `⚠` и красная рамка в `ProgramEditor` плюс
   текст ошибки; пульсирующий красный дрон на поле; гашение всех индикаторов после
   правки и перезапуска.
4. Запись сессии в `docs/sessions/` по правилам CLAUDE.md.
