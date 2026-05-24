# Время в секундах и per-drone управление

**Статус:** done

## Зачем

Длительности команд были измерены в дискретных тиках, что делало их непрозрачными для игрока. Нет способа сказать «шаг занимает 1 секунду» — нужно знать что тик = 100 мс. Per-drone пауза позволяет отлаживать одного дрона не останавливая остальных.

## Поведение

- `WAIT N` — дрон ждёт **N секунд** (float).
- `MOVE_TO` — шаг на 1 клетку занимает **1 секунду** (speed=1.0 клеток/сек).
- `MINE` — **2 секунды** на 1 единицу руды.
- `DROP` — **0.5 секунды** на 1 единицу при разгрузке (капельно).
- `CHARGE` — **0.5 секунды** на 1 единицу энергии.
- В SimControls рядом с номером тика отображается время в секундах.
- В DroneInspector и DroneList — кнопки ▶/⏸ и ↺ для каждого дрона.
- Badge `[LOCAL PAUSED]` в заголовке инспектора.

## Критерии готовности

- [x] Все длительности хранятся в секундах (float), DT = 0.1
- [x] `WAIT.seconds` вместо `WAIT.ticks`
- [x] MovementSystem: `progress += DT * speed`
- [x] MiningSystem: time-based MINE и DROP с аккумуляторами
- [x] EnergySystem: time-based CHARGE с аккумулятором
- [x] StatisticsSystem использует DT вместо TICKS_PER_SECOND
- [x] Per-drone `localPaused` флаг, проверяется во всех системах
- [x] `startDrone` / `pauseDrone` / `resetDrone` в store
- [x] UI: DroneInspector + DroneList с кнопками управления
- [x] Все юнит-тесты зелёные (135/135)

## Технические заметки

- Fixed-step loop 100 мс сохранён; все системы используют константу `DT = 0.1` из `src/game/simulation/constants.ts`.
- Сравнения float через `>= threshold - EPSILON` чтобы избежать ошибок накопления 0.1+0.1+...
- `localPaused` — независим от глобальной паузы (GlobalLoop останавливает все системы; localPaused пропускает конкретного дрона внутри системы).
- `resetDroneProgram` очищает `mineElapsed / chargeElapsed / dropElapsed`; `localPaused` сбрасывает только `resetDrone` в store.
