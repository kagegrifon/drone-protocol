import { describe, it, expect } from "vitest";
import { getMoveSpeedMul, canMine, canDrop } from "./effects.js";

describe("getMoveSpeedMul", () => {
  it("returns 1 for empty active list", () => {
    expect(getMoveSpeedMul([])).toBe(1);
  });
  it("returns 0.5 for drained", () => {
    expect(getMoveSpeedMul(["drained"])).toBeCloseTo(0.5);
  });
  it("returns 0.9 for overloaded:light", () => {
    expect(getMoveSpeedMul(["overloaded:light"])).toBeCloseTo(0.9);
  });
  it("returns 0.8 for overloaded:medium", () => {
    expect(getMoveSpeedMul(["overloaded:medium"])).toBeCloseTo(0.8);
  });
  it("returns 0.7 for overloaded:heavy", () => {
    expect(getMoveSpeedMul(["overloaded:heavy"])).toBeCloseTo(0.7);
  });
  it("multiplies drained + overloaded:heavy to 0.35", () => {
    expect(getMoveSpeedMul(["drained", "overloaded:heavy"])).toBeCloseTo(
      0.35,
      10,
    );
  });
  it("multiplies drained + overloaded:light to 0.45", () => {
    expect(getMoveSpeedMul(["drained", "overloaded:light"])).toBeCloseTo(
      0.45,
      10,
    );
  });
});

describe("canMine", () => {
  it("returns true when no modifiers", () => {
    expect(canMine([])).toBe(true);
  });
  it("returns false when drained", () => {
    expect(canMine(["drained"])).toBe(false);
  });
  it("returns true when only overloaded", () => {
    expect(canMine(["overloaded:heavy"])).toBe(true);
  });
  it("returns false when drained + overloaded", () => {
    expect(canMine(["drained", "overloaded:heavy"])).toBe(false);
  });
});

describe("canDrop", () => {
  it("returns true when no modifiers", () => {
    expect(canDrop([])).toBe(true);
  });
  it("returns false when drained", () => {
    expect(canDrop(["drained"])).toBe(false);
  });
  it("returns true when only overloaded", () => {
    expect(canDrop(["overloaded:light"])).toBe(true);
  });
});
