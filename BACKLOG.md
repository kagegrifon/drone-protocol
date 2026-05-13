# Drone Loop — Бэклог

## Незавершённые фичи

### Метрика Congestion (затор дронов)

**Что должно делать:** Отображать процент тиков, в которые хотя бы один дрон не смог найти путь из-за блокировки другими дронами.

**Как рассчитывается в store (gameStore.ts):**
```typescript
congestion: s.totalDrones > 0
  ? Math.round((s.congestionEvents / Math.max(tickCount, 1)) * 100)
  : 0
```

**Где происходит затор:** В `src/game/programs/interpreter.ts`, строка ~58 — когда A* возвращает `null`:
```typescript
const path = astar(grid, dronePos, targetPos, occupied);
if (movement && path !== null) { ... }
// Если path === null — дрон заблокирован, это congestion event
```

**Варианты реализации:**

1. **Событийный подход (рекомендуется, соответствует архитектуре):**
   - Добавить событие `'drone:blocked': { droneId: EntityId }` в `gameEvents.ts`
   - В interpreter.ts при `path === null` — `gameEvents.emit('drone:blocked', { droneId })`
   - В `StatisticsSystem` подписаться на `'drone:blocked'` → `recordCongestion()`

2. **Прямой вызов:**
   - Передать `statistics` в `ProgramExecutionSystem` → в `stepProgram()` → вызвать `statistics.recordCongestion()` при `path === null`

**Текущее состояние:** `recordCongestion()` существует в `StatisticsSystem`, но нигде не вызывается. Метрика всегда 0.

**Файлы для изменения:**
- `src/shared/events/gameEvents.ts` — добавить тип события
- `src/game/programs/interpreter.ts` — emit при path === null
- `src/game/simulation/systems/StatisticsSystem.ts` — подписка
