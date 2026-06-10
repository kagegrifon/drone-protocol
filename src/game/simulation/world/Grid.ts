import type { CellType } from "../../../shared/constants/cellTypes.js";

const GRID_MIN = 30;

export class Grid {
  private readonly _width: number;
  private readonly _height: number;
  private cells: CellType[][];

  constructor(width = GRID_MIN, height = GRID_MIN) {
    if (width < GRID_MIN || height < GRID_MIN)
      throw new Error(
        `Grid size must be at least ${GRID_MIN}×${GRID_MIN}, got ${width}×${height}`,
      );
    this._width = width;
    this._height = height;
    this.cells = Array.from({ length: height }, () =>
      Array<CellType>(width).fill("empty"),
    );
  }

  get width(): number {
    return this._width;
  }
  get height(): number {
    return this._height;
  }

  getTile(x: number, y: number): CellType {
    if (!this.inBounds(x, y)) return "wall";
    return this.cells[y][x];
  }

  setTile(x: number, y: number, type: CellType): void {
    if (!this.inBounds(x, y)) return;
    this.cells[y][x] = type;
  }

  isWalkable(x: number, y: number): boolean {
    const cell = this.getTile(x, y);
    return cell !== "wall";
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
    return x >= 0 && x < this._width && y >= 0 && y < this._height;
  }
}
