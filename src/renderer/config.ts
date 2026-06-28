import type { CellType } from "../shared/constants/cellTypes.js";

export const TILE_SIZE = 40;

export const COLORS = {
  BG: 0x0a0e1a,
  TILE_EMPTY: 0x0d1117,
  TILE_WALL: 0x1c2128,
  TILE_MINE: 0x0d1f12,
  TILE_BASE: 0x0a1020,
  TILE_CHARGER: 0x1a1500,
  GRID_LINE: 0x1e2a3a,
  DRONE_BODY: 0x00d4ff,
  DRONE_GLOW: 0x00d4ff,
  DRONE_LIGHT: 0xff8800,
  DRONE_ERROR: 0xff4444,
  BASE_ACCENT: 0x4488ff,
  MINE_ACCENT: 0x00ff88,
  CHARGER_ACCENT: 0xffd700,
} as const;

export const TILE_COLORS: Record<CellType, number> = {
  empty: COLORS.TILE_EMPTY,
  wall: COLORS.TILE_WALL,
  mine: COLORS.TILE_MINE,
  base: COLORS.TILE_BASE,
  charger: COLORS.TILE_CHARGER,
};
