import { describe, it, expect } from 'vitest';
import { astar } from './astar.js';
import { Grid } from '../simulation/world/Grid.js';

describe('astar', () => {
  it('finds direct path on empty grid', () => {
    const grid = new Grid();
    const path = astar(grid, { x: 0, y: 0 }, { x: 2, y: 0 }, new Set());
    expect(path).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
  });

  it('returns empty array when start equals goal', () => {
    const grid = new Grid();
    const path = astar(grid, { x: 3, y: 3 }, { x: 3, y: 3 }, new Set());
    expect(path).toEqual([]);
  });

  it('navigates around a wall', () => {
    const grid = new Grid();
    // Стена на x=1, y=0 — вынуждает идти через y=1
    grid.setTile(1, 0, 'wall');
    const path = astar(grid, { x: 0, y: 0 }, { x: 2, y: 0 }, new Set());
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(0);
    const last = path![path!.length - 1];
    expect(last).toEqual({ x: 2, y: 0 });
    // Путь не должен проходить через стену
    expect(path!.some((p) => p.x === 1 && p.y === 0)).toBe(false);
  });

  it('returns null when destination is unreachable', () => {
    const grid = new Grid();
    // Окружаем цель стенами
    grid.setTile(1, 0, 'wall');
    grid.setTile(0, 1, 'wall');
    astar(grid, { x: 0, y: 0 }, { x: 1, y: 1 }, new Set());
    // (1,1) достижима через (2,1) или (1,2) — сделаем полную блокировку
    grid.setTile(2, 0, 'wall');
    grid.setTile(2, 1, 'wall');
    grid.setTile(2, 2, 'wall');
    grid.setTile(1, 2, 'wall');
    grid.setTile(0, 2, 'wall');
    const path2 = astar(grid, { x: 0, y: 0 }, { x: 1, y: 1 }, new Set());
    expect(path2).toBeNull();
  });

  it('treats occupied cells as blocked (except start)', () => {
    const grid = new Grid();
    // Клетка (1,0) занята другим дроном
    const occupied = new Set<string>(['1,0']);
    const path = astar(grid, { x: 0, y: 0 }, { x: 2, y: 0 }, occupied);
    expect(path).not.toBeNull();
    // Путь не должен проходить через занятую клетку
    expect(path!.some((p) => p.x === 1 && p.y === 0)).toBe(false);
  });

  it('allows passing through start cell even if in occupied set', () => {
    const grid = new Grid();
    // Стартовая клетка в occupied — не должна блокировать
    const occupied = new Set<string>(['0,0']);
    const path = astar(grid, { x: 0, y: 0 }, { x: 1, y: 0 }, occupied);
    expect(path).toEqual([{ x: 1, y: 0 }]);
  });

  it('returns path excluding start, including goal', () => {
    const grid = new Grid();
    const path = astar(grid, { x: 0, y: 0 }, { x: 0, y: 2 }, new Set());
    expect(path).toEqual([
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ]);
  });
});
