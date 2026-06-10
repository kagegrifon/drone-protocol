import type { Grid } from "../simulation/world/Grid.js";

interface Point {
  x: number;
  y: number;
}

interface Node {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
}

function heuristic(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * A* pathfinding on a Grid.
 * Returns the path from start (exclusive) to goal (inclusive), or null if unreachable.
 * occupied: set of "x,y" keys for cells blocked by other drones (start cell is excluded from blocking).
 */
export function astar(
  grid: Grid,
  start: Point,
  goal: Point,
  occupied: Set<string>,
): Point[] | null {
  if (start.x === goal.x && start.y === goal.y) return [];

  const startKey = key(start.x, start.y);

  const open: Node[] = [];
  const closed = new Set<string>();
  const openMap = new Map<string, Node>();

  const startNode: Node = {
    x: start.x,
    y: start.y,
    g: 0,
    h: heuristic(start, goal),
    f: heuristic(start, goal),
    parent: null,
  };
  open.push(startNode);
  openMap.set(startKey, startNode);

  while (open.length > 0) {
    // Pop node with lowest f
    let lowestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[lowestIdx].f) lowestIdx = i;
    }
    const current = open[lowestIdx];
    open.splice(lowestIdx, 1);
    openMap.delete(key(current.x, current.y));

    const currentKey = key(current.x, current.y);
    closed.add(currentKey);

    if (current.x === goal.x && current.y === goal.y) {
      return reconstructPath(current);
    }

    for (const neighbour of grid.neighbours(current.x, current.y)) {
      const nKey = key(neighbour.x, neighbour.y);
      if (closed.has(nKey)) continue;
      if (!grid.isWalkable(neighbour.x, neighbour.y)) continue;
      // Block occupied cells, but never block the start cell
      if (nKey !== startKey && occupied.has(nKey)) continue;

      const g = current.g + 1;
      const existing = openMap.get(nKey);
      if (existing && existing.g <= g) continue;

      const node: Node = {
        x: neighbour.x,
        y: neighbour.y,
        g,
        h: heuristic(neighbour, goal),
        f: g + heuristic(neighbour, goal),
        parent: current,
      };
      if (existing) {
        const idx = open.indexOf(existing);
        if (idx !== -1) open.splice(idx, 1);
      }
      open.push(node);
      openMap.set(nKey, node);
    }
  }

  return null;
}

function reconstructPath(node: Node): Point[] {
  const path: Point[] = [];
  let current: Node | null = node;
  while (current !== null && current.parent !== null) {
    path.unshift({ x: current.x, y: current.y });
    current = current.parent;
  }
  return path;
}
