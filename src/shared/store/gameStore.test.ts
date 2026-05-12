import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore.js';
import { World } from '../../game/simulation/world/World.js';
import { Grid } from '../../game/simulation/world/Grid.js';
import type { ProgramRegistry } from '../../game/programs/types.js';

function makeWorld(): World {
  return new World();
}

function makeGrid(): Grid {
  return new Grid();
}

function makeRegistry(): ProgramRegistry {
  return new Map();
}

// Сбрасываем store перед каждым тестом через повторный init
beforeEach(() => {
  useGameStore.getState().init(makeWorld(), makeGrid(), makeRegistry());
});

// ─── БАГ 3: store.init() не сбрасывал _tickCount ─────────────────────────────
//
// До фикса: повторный вызов init() (при reset/смене миссии) оставлял
// _tickCount и stats.tick на прежнем значении.

describe('store.init() — сброс счётчика тиков', () => {
  it('tick равен 0 сразу после init()', () => {
    const { stats } = useGameStore.getState();
    expect(stats.tick).toBe(0);
  });

  it('после нескольких tick() и повторного init() счётчик сбрасывается в 0', () => {
    const store = useGameStore.getState();

    // Накапливаем тики (имитируем игровую сессию)
    store.tick();
    store.tick();
    store.tick();
    expect(useGameStore.getState().stats.tick).toBe(3);

    // Повторный init() — как при "Заново" или смене миссии
    useGameStore.getState().init(makeWorld(), makeGrid(), makeRegistry());

    expect(useGameStore.getState().stats.tick).toBe(0);
  });

  it('после повторного init() все поля stats обнуляются', () => {
    useGameStore.getState().tick();
    useGameStore.getState().tick();

    useGameStore.getState().init(makeWorld(), makeGrid(), makeRegistry());

    const { stats } = useGameStore.getState();
    expect(stats.tick).toBe(0);
    expect(stats.oreMined).toBe(0);
    expect(stats.orePerMin).toBe(0);
    expect(stats.efficiency).toBe(0);
    expect(stats.congestion).toBe(0);
  });

  it('после повторного init() gameStatus сбрасывается в idle', () => {
    useGameStore.getState().setGameStatus('failed', 'время вышло');
    expect(useGameStore.getState().gameStatus).toBe('failed');

    useGameStore.getState().init(makeWorld(), makeGrid(), makeRegistry());

    expect(useGameStore.getState().gameStatus).toBe('idle');
    expect(useGameStore.getState().statusMessage).toBeNull();
  });
});
