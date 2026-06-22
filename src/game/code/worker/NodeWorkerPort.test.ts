import { describe, it, expect, afterEach } from "vitest";
import { NodeWorkerPort } from "./NodeWorkerPort.js";
import type { WorldSnapshot, WorkerMessage } from "../types.js";

const WORLD: WorldSnapshot = {
  self: {
    id: 1,
    type: "drone",
    position: { x: 0, y: 0 },
    energy: 100,
    energyMax: 100,
    inventory: 0,
    inventoryMax: 10,
  },
  mines: [
    {
      id: 2,
      type: "mine",
      position: { x: 1, y: 0 },
      oreRemaining: 5,
      freeSlots: 1,
    },
  ],
  chargers: [],
  bases: [],
  drones: [
    {
      id: 1,
      type: "drone",
      position: { x: 0, y: 0 },
      energy: 100,
      energyMax: 100,
      inventory: 0,
      inventoryMax: 10,
    },
  ],
};

describe("NodeWorkerPort", () => {
  let port: NodeWorkerPort;

  afterEach(() => {
    port?.terminate();
  });

  it("runs player code and round-trips an intent", async () => {
    port = new NodeWorkerPort();
    const messages: WorkerMessage[] = [];
    port.onMessage((m) => messages.push(m));

    port.postMessage({
      type: "start",
      code: "await self.moveTo(World.mines[0].position); await self.mine();",
      selfId: 1,
      world: WORLD,
    });

    await new Promise<void>((resolve) => {
      const check = () => {
        if (messages.length >= 1) return resolve();
        setTimeout(check, 10);
      };
      check();
    });

    expect(messages[0]).toEqual({
      type: "intent",
      action: "moveTo",
      point: { x: 1, y: 0 },
      line: 1,
    });

    port.postMessage({ type: "resume", world: WORLD });

    await new Promise<void>((resolve) => {
      const check = () => {
        if (messages.length >= 2) return resolve();
        setTimeout(check, 10);
      };
      check();
    });

    expect(messages[1]).toEqual({ type: "intent", action: "mine", line: 1 });
    port.postMessage({ type: "resume", world: WORLD });

    await new Promise<void>((resolve) => {
      const check = () => {
        if (messages.length >= 3) return resolve();
        setTimeout(check, 10);
      };
      check();
    });
    expect(messages[2]).toEqual({ type: "finished" });
  }, 10000);
});
