import type { CellType } from '../../../shared/constants/cellTypes.js';

export const GRID_SIZE = 20;

export class Grid {
  private cells: CellType[][];

  constructor() {
    this.cells = Array.from({ length: GRID_SIZE }, () =>
      Array<CellType>(GRID_SIZE).fill('empty')
    );
  }

  getTile(x: number, y: number): CellType {
    if (!this.inBounds(x, y)) return 'wall';
    return this.cells[y][x];
  }

  setTile(x: number, y: number, type: CellType): void {
    if (!this.inBounds(x, y)) return;
    this.cells[y][x] = type;
  }

  isWalkable(x: number, y: number): boolean {
    const cell = this.getTile(x, y);
    return cell !== 'wall';
  }

  neighbours(x: number, y: number): { x: number; y: number }[] {
    const dirs = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ];
    const result: { x: number; y: number }[] = [];
    for (const d of dirs) {
      const nx = x + d.x;
      const ny = y + d.y;
      if (this.inBounds(nx, ny)) result.push({ x: nx, y: ny });
    }
    return result;
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
  }
}
