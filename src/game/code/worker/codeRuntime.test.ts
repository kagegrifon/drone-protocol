import { describe, it, expect, vi } from "vitest";
import { runCode } from "./codeRuntime.js";
import type { DriverMessage, WorkerMessage, SensorsSnapshot } from "../types.js";

const SENSORS: SensorsSnapshot = {
  energy: 100,
  energyMax: 100,
  inventory: 0,
  inventoryMax: 10,
  freeSlots: 1,
  positions: { 1: { x: 0, y: 0 }, 2: { x: 3, y: 0 } },
  deposits: { 2: 5 },
};

function makeChannel() {
  const sent: WorkerMessage[] = [];
  let deliver: ((msg: DriverMessage) => void) | null = null;
  return {
    sent,
    post: (msg: WorkerMessage) => sent.push(msg),
    onDriverMessage: (cb: (msg: DriverMessage) => void) => {
      deliver = cb;
    },
    deliver: (msg: DriverMessage) => deliver?.(msg),
  };
}

describe("runCode", () => {
  it("sends intent on await drone.moveTo and finishes after resume", async () => {
    const ch = makeChannel();
    const start: DriverMessage = {
      type: "start",
      code: "await drone.moveTo(ore); await drone.mine();",
      selfId: 1,
      entities: { ore: 2 },
      sensors: SENSORS,
    };

    const done = runCode(start, ch.post, ch.onDriverMessage);

    // даём микротаскам прокрутиться до первого intent
    await vi.waitFor(() => expect(ch.sent.length).toBe(1));
    expect(ch.sent[0]).toEqual({ type: "intent", action: "moveTo", targetId: 2 });

    ch.deliver({ type: "resume", sensors: SENSORS });
    await vi.waitFor(() => expect(ch.sent.length).toBe(2));
    expect(ch.sent[1]).toEqual({ type: "intent", action: "mine" });

    ch.deliver({ type: "resume", sensors: SENSORS });
    await done;
    expect(ch.sent[2]).toEqual({ type: "finished" });
  });

  it("exposes synchronous sensors from the snapshot", async () => {
    const ch = makeChannel();
    const start: DriverMessage = {
      type: "start",
      code: "if (drone.energy !== 100) throw new Error('bad'); await drone.charge();",
      selfId: 1,
      entities: {},
      sensors: SENSORS,
    };
    runCode(start, ch.post, ch.onDriverMessage);
    await vi.waitFor(() => expect(ch.sent.length).toBe(1));
    expect(ch.sent[0]).toEqual({ type: "intent", action: "charge" });
  });

  it("sends error message on synchronous throw", async () => {
    const ch = makeChannel();
    const start: DriverMessage = {
      type: "start",
      code: "throw new Error('boom');",
      selfId: 1,
      entities: {},
      sensors: SENSORS,
    };
    await runCode(start, ch.post, ch.onDriverMessage);
    expect(ch.sent[0]).toEqual({ type: "error", message: "boom" });
  });

  it("sends wait message for drone.wait without an intent round-trip", async () => {
    const ch = makeChannel();
    const start: DriverMessage = {
      type: "start",
      code: "await drone.wait(2); await drone.mine();",
      selfId: 1,
      entities: {},
      sensors: SENSORS,
    };
    runCode(start, ch.post, ch.onDriverMessage);
    await vi.waitFor(() => expect(ch.sent.length).toBe(1));
    expect(ch.sent[0]).toEqual({ type: "wait", seconds: 2 });
  });

  it("computes distance() and deposit() from the snapshot", async () => {
    const ch = makeChannel();
    const start: DriverMessage = {
      type: "start",
      code: `
        if (distance(drone.self, ore) !== 3) throw new Error('dist');
        if (deposit(ore) !== 5) throw new Error('deposit');
        await drone.mine();
      `,
      selfId: 1,
      entities: { ore: 2 },
      sensors: SENSORS,
    };
    runCode(start, ch.post, ch.onDriverMessage);
    await vi.waitFor(() => expect(ch.sent.length).toBe(1));
    expect(ch.sent[0]).toEqual({ type: "intent", action: "mine" });
  });
});
