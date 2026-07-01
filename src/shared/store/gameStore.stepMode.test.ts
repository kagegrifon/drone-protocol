import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "./gameStore.js";

describe("gameStore — isStepMode", () => {
  beforeEach(() => {
    useGameStore.getState().setStepMode(false);
  });

  it("по умолчанию выключен", () => {
    expect(useGameStore.getState().isStepMode).toBe(false);
  });

  it("setStepMode переключает флаг", () => {
    useGameStore.getState().setStepMode(true);
    expect(useGameStore.getState().isStepMode).toBe(true);
    useGameStore.getState().setStepMode(false);
    expect(useGameStore.getState().isStepMode).toBe(false);
  });
});
