# Метрика Congestion (затор дронов)

**Статус:** planned

## Зачем

Показывать игроку, насколько часто дроны блокируют друг друга при поиске пути. Это ключевая метрика качества программы — чем меньше процент, тем эффективнее логика движения.

## Поведение

Метрика отображает процент тиков, в которые хотя бы один дрон не смог найти путь из-за блокировки другими дронами.

Формула расчёта (уже есть в `gameStore.ts`):
```typescript
congestion: s.totalDrones > 0
  ? Math.round((s.congestionEvents / Math.max(tickCount, 1)) * 100)
  : 0
```

## Критерии готовности

- При `path === null` в interpreter.ts фиксируется congestion event
- `StatisticsSystem.recordCongestion()` вызывается на каждое такое событие
- Метрика отображается в UI (не всегда 0)

## Технические заметки

**Место затора:** `src/game/programs/interpreter.ts` ~строка 58 — когда A* возвращает `null`.

**Рекомендуемый подход (событийный):**
1. Добавить событие `'drone:blocked': { droneId: EntityId }` в `src/shared/events/gameEvents.ts`
2. В `interpreter.ts` при `path === null` — `gameEvents.emit('drone:blocked', { droneId })`
3. В `StatisticsSystem` подписаться на `'drone:blocked'` → `recordCongestion()`

**Альтернатива (прямой вызов):** передать `statistics` в `ProgramExecutionSystem` → `stepProgram()` → вызвать `statistics.recordCongestion()` при `path === null`.

**Текущее состояние:** `recordCongestion()` существует в `StatisticsSystem`, но нигде не вызывается.

**Файлы для изменения:**
- `src/shared/events/gameEvents.ts`
- `src/game/programs/interpreter.ts`
- `src/game/simulation/systems/StatisticsSystem.ts`
