import { describe, it, expect } from "vitest";
import { interpolateVisualPos, type Cell } from "./interpolatePosition.js";

const TILE = 32;
const HALF = TILE / 2;
// центр клетки в пикселях
const cx = (c: number) => c * TILE + HALF;

describe("interpolateVisualPos", () => {
  const from: Cell = { x: 2, y: 3 };

  it("стоит в центре клетки, когда пути нет (to=null)", () => {
    const p = interpolateVisualPos(from, null, 0, 1, 0.5, TILE);
    expect(p.x).toBeCloseTo(cx(2));
    expect(p.y).toBeCloseTo(cx(3));
  });

  it("в начале шага (progress=0, t=0) находится в исходной клетке", () => {
    const to: Cell = { x: 3, y: 3 };
    const p = interpolateVisualPos(from, to, 0, 1, 0, TILE);
    expect(p.x).toBeCloseTo(cx(2));
    expect(p.y).toBeCloseTo(cx(3));
  });

  it("на середине шага находится между клетками", () => {
    const to: Cell = { x: 3, y: 3 };
    // progress=0.5, t=0 → ровно середина
    const p = interpolateVisualPos(from, to, 0.5, 1, 0, TILE);
    expect(p.x).toBeCloseTo((cx(2) + cx(3)) / 2);
    expect(p.y).toBeCloseTo(cx(3));
  });

  it("доинтерполирует внутри тика по доле кадра t", () => {
    const to: Cell = { x: 3, y: 3 };
    // progress=0.3, speed=1, DT=0.1 → за полный тик добавится 0.1.
    // t=0.5 (половина тика) → эффективный прогресс 0.3 + 0.5*0.1 = 0.35
    const p = interpolateVisualPos(from, to, 0.3, 1, 0.5, TILE);
    const expectedProgress = 0.35;
    expect(p.x).toBeCloseTo(cx(2) + (cx(3) - cx(2)) * expectedProgress);
  });

  it("эффективный прогресс не превышает 1 (не перескакивает цель)", () => {
    const to: Cell = { x: 3, y: 3 };
    // progress=0.95, t=1, speed=1 → 0.95 + 0.1 = 1.05, должно ограничиться 1
    const p = interpolateVisualPos(from, to, 0.95, 1, 1, TILE);
    expect(p.x).toBeCloseTo(cx(3));
  });

  it("учитывает скорость при доинтерполяции", () => {
    const to: Cell = { x: 3, y: 3 };
    // speed=10, DT=0.1 → за тик 1.0. t=0.5 → +0.5. progress=0 → 0.5
    const p = interpolateVisualPos(from, to, 0, 10, 0.5, TILE);
    expect(p.x).toBeCloseTo((cx(2) + cx(3)) / 2);
  });

  it("интерполирует по обеим осям", () => {
    const to: Cell = { x: 2, y: 4 };
    const p = interpolateVisualPos(from, to, 0.5, 1, 0, TILE);
    expect(p.x).toBeCloseTo(cx(2));
    expect(p.y).toBeCloseTo((cx(3) + cx(4)) / 2);
  });
});
