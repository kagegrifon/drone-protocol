# Сессия: work-slots-and-collisions

**Дата:** 2026-05-28
**Цель:** Реализовать компонент WorkSlots, lifecycle занятости через события, фикс гонки MovementSystem, функцию FreeSlots, валидацию спавна.

## Результат

- Добавлены события `drone:moved`, `entity:removed`, `drone:blocked` в GameEventMap
- Добавлен компонент `WorkSlots` на Deposit/ChargerStation/Base
- `workSlotsIndex` обновляет `occupiedBy` через подписки на `drone:moved` / `entity:removed`
- `MovementSystem` использует `stepped`-set: два дрона не могут оказаться в одной клетке за тик
- `drone:moved` и `drone:blocked` эмитятся корректно
- `FreeSlots(target)` доступна в IF-условиях
- `validateNoDroneOnSlot` вызывается при старте каждой миссии
- Все миссии 1–4 проходят без регрессий
- Добавлена защита от двойной подписки в `workSlotsIndex` (guard `if (worldIndex.has(world)) return`)
- `isEntityType` в `functions.ts` типизирована через `ComponentName[]`
