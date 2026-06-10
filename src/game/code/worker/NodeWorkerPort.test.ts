import { describe, it, expect, afterEach } from "vitest";
import { NodeWorkerPort } from "./NodeWorkerPort.js";
import type { SensorsSnapshot, WorkerMessage } from "../types.js";

const SENSORS: SensorsSnapshot = {
  energy: 100,
  energyMax: 100,
  inventory: 0,
  inventoryMax: 10,
  freeSlots: 1,
  positions: { 1: { x: 0, y: 0 }, 2: { x: 1, y: 0 } },
  deposits: { 2: 5 },
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
      code: "await drone.moveTo(ore); await drone.mine();",
      selfId: 1,
      entities: { ore: 2 },
      sensors: SENSORS,
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
      targetId: 2,
    });

    port.postMessage({ type: "resume", sensors: SENSORS });

    await new Promise<void>((resolve) => {
      const check = () => {
        if (messages.length >= 2) return resolve();
        setTimeout(check, 10);
      };
      check();
    });

    expect(messages[1]).toEqual({ type: "intent", action: "mine" });
    port.postMessage({ type: "resume", sensors: SENSORS });

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
