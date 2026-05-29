# 2026-05-29 — Рефакторинг скоростей и snapshot-интерполяция движения

## Цель

- Унифицировать семантику констант скорости действий дрона: перейти от «длительность в секундах» к «скорость в единицах/сек»
- Устранить дёрганность движения дрона (визуальные прыжки с клетки на клетку)

## Результат

### Унификация скоростей (`src/game/simulation/constants.ts`)

Переименованы константы с инверсией значений:
- `BASE_MINE_DURATION_PER_ORE = 0.5` → `BASE_MINE_SPEED = 2` (ore/sec)
- `BASE_CHARGE_DURATION_PER_UNIT = 0.1` → `BASE_CHARGE_SPEED = 10` (unit/sec)
- `BASE_DROP_DURATION_PER_ORE = 0.1` → `BASE_DROP_SPEED = 10` (ore/sec)

Новая формула прогресса (единая для всех действий):
`progress += SPEED * DT` (было: `elapsed += DT`, сравнение с `DURATION`)

Поля в `Program.ts`: `mineElapsed/chargeElapsed/dropElapsed` → `mineProgress/chargeProgress/dropProgress`.

### Snapshot-интерполяция движения (`src/renderer/scenes/GameScene.ts`)

Заменена старая `getInterpolatedPos(pos, movement)` (ломалась при speed=10, когда шаг укладывался в 1 тик).

Новая схема: рендер хранит `_snapPrev` и `_snapCurrent` (grid-позиции дронов из двух последних симуляционных тиков). Каждый кадр:
```
t = clamp01((performance.now() - tickStartMs) / (DT * 1000))
pos = lerp(snapPrev, snapCurrent, t)
```
Обнаружение нового тика — по `store.stats.tick`.

### Тесты

Обновлены: `MiningSystem.test.ts`, `EnergySystem.test.ts`, `atomic-actions.integration.test.ts`, `gameStore.test.ts`.
Итог: 218/218 зелёных, type-check чистый.

## Нерешённая проблема

Пауза «шаг–100 мс–шаг» при `LOOP { MOVE_TO target }` осталась.

**Причина**: `stepProgram` в `interpreter.ts` выполняет ровно одну инструкцию за тик. При сбросе LOOP (`frame.instructionIndex = 0; return`) движение пропускает тик. Схема:
- Тик 1: LOOP-узел → пуш фрейма, return, движения нет
- Тик 2: MOVE_TO → шаг
- Тик 3: конец тела → reset, return, движения нет
- Тик 4: MOVE_TO → шаг ...

**Ожидаемый фикс** (следующая сессия): разрешить `stepProgram` выполнять несколько «не-waiting» инструкций за один тик (до первого `state = 'waiting'`). Затрагивает `interpreter.ts` и `ProgramExecutionSystem.ts`.

## Следующая сессия — стартовый промпт

```
Задача: устранить 1-тиковые паузы между шагами дрона в LOOP-программах.

Корень: `stepProgram` в `src/game/programs/interpreter.ts` выполняет одну инструкцию 
за тик. При сбросе LOOP/конце фрейма делается `return` — следующий MOVE_TO 
откладывается на следующий тик, создавая паузу.

Фикс: разрешить `stepProgram` (или его вызывающий `ProgramExecutionSystem`) 
обрабатывать несколько инструкций за тик пока не встретится `state = 'waiting'` 
или конец программы. Loop-guard чтобы не зависнуть в вечном цикле.

Важные контексты:
- `src/game/programs/interpreter.ts` — функция `stepProgram`
- `src/game/simulation/systems/ProgramExecutionSystem.ts` — вызов `stepProgram`
- `src/game/simulation/constants.ts` — DT=0.1, DEFAULT_DRONE_SPEED=10
- `src/game/simulation/systems/MovementSystem.ts` — после шага: `path=[]`
- Архитектура MOVE_TO = «шаг на 1 клетку» (намеренно, не менять)
- 218 тестов должны оставаться зелёными, type-check чистым
```

## Метрики сессии
- Модель: claude-sonnet-4-6
- Input: 31,821 токенов (кеш: 6,949,019 / запись в кеш: 617,104)
- Output: 206,472 токенов
- Контекст: 112,126 / 200,000 токенов (56.1%)
- Стоимость: $7.591
