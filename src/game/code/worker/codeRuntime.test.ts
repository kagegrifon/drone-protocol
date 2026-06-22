import { describe, it, expect, vi } from "vitest";
import { runCode } from "./codeRuntime.js";
import type { DriverMessage, WorkerMessage, WorldSnapshot } from "../types.js";

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
      position: { x: 3, y: 0 },
      oreRemaining: 5,
      freeSlots: 1,
    },
  ],
  chargers: [
    { id: 3, type: "charger", position: { x: 0, y: 5 }, freeSlots: 1 },
  ],
  bases: [
    {
      id: 4,
      type: "base",
      position: { x: 5, y: 5 },
      freeSlots: 1,
      storedOre: 0,
    },
  ],
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

function start(code: string): Extract<DriverMessage, { type: "start" }> {
  return { type: "start", code, selfId: 1, world: WORLD };
}

describe("runCode", () => {
  it("sends moveTo intent with the mine position, then mine, finishing after resumes", async () => {
    const ch = makeChannel();
    const done = runCode(
      start("await self.moveTo(World.mines[0].position); await self.mine();"),
      ch.post,
      ch.onDriverMessage,
    );

    await vi.waitFor(() => expect(ch.sent.length).toBe(1));
    expect(ch.sent[0]).toEqual({
      type: "intent",
      action: "moveTo",
      point: { x: 3, y: 0 },
      line: 1,
    });

    ch.deliver({ type: "resume", world: WORLD });
    await vi.waitFor(() => expect(ch.sent.length).toBe(2));
    expect(ch.sent[1]).toEqual({ type: "intent", action: "mine", line: 1 });

    ch.deliver({ type: "resume", world: WORLD });
    await done;
    expect(ch.sent[2]).toEqual({ type: "finished" });
  });

  it("exposes self fields synchronously from the snapshot", async () => {
    const ch = makeChannel();
    runCode(
      start(
        "if (self.energy !== 100) throw new Error('bad'); await self.charge();",
      ),
      ch.post,
      ch.onDriverMessage,
    );
    await vi.waitFor(() => expect(ch.sent.length).toBe(1));
    expect(ch.sent[0]).toEqual({ type: "intent", action: "charge", line: 1 });
  });

  it("sends error message on synchronous throw", async () => {
    const ch = makeChannel();
    await runCode(
      start("throw new Error('boom');"),
      ch.post,
      ch.onDriverMessage,
    );
    expect(ch.sent[0]).toEqual({ type: "error", message: "boom" });
  });

  it("sends wait message for self.wait without an intent round-trip", async () => {
    const ch = makeChannel();
    runCode(
      start("await self.wait(2); await self.mine();"),
      ch.post,
      ch.onDriverMessage,
    );
    await vi.waitFor(() => expect(ch.sent.length).toBe(1));
    expect(ch.sent[0]).toEqual({ type: "wait", seconds: 2, line: 1 });
  });

  it("computes distanceTo and reads oreRemaining from the snapshot", async () => {
    const ch = makeChannel();
    runCode(
      start(
        `
        if (self.distanceTo(World.mines[0]) !== 3) throw new Error('dist');
        if (World.mines[0].oreRemaining !== 5) throw new Error('ore');
        await self.mine();
      `,
      ),
      ch.post,
      ch.onDriverMessage,
    );
    await vi.waitFor(() => expect(ch.sent.length).toBe(1));
    expect(ch.sent[0]).toEqual({ type: "intent", action: "mine", line: 4 });
  });

  it("findClosest returns the nearest entity from a list", async () => {
    const ch = makeChannel();
    runCode(
      start(
        `
        const closest = self.findClosest(World.mines);
        if (closest.id !== 2) throw new Error('wrong');
        await self.moveTo(closest.position);
      `,
      ),
      ch.post,
      ch.onDriverMessage,
    );
    await vi.waitFor(() => expect(ch.sent.length).toBe(1));
    expect(ch.sent[0]).toMatchObject({
      action: "moveTo",
      point: { x: 3, y: 0 },
    });
  });

  it("moveTo with null throws a descriptive error", async () => {
    const ch = makeChannel();
    await runCode(start("await self.moveTo(null);"), ch.post, ch.onDriverMessage);
    expect(ch.sent[0].type).toBe("error");
    expect((ch.sent[0] as { message: string }).message).toContain("moveTo");
  });

  it("moveTo accepts a raw {x, y} point", async () => {
    const ch = makeChannel();
    runCode(
      start("await self.moveTo({ x: 7, y: 8 });"),
      ch.post,
      ch.onDriverMessage,
    );
    await vi.waitFor(() => expect(ch.sent.length).toBe(1));
    expect(ch.sent[0]).toMatchObject({
      action: "moveTo",
      point: { x: 7, y: 8 },
    });
  });

  it("keeps entity references stable across resume (mutation in place)", async () => {
    const ch = makeChannel();
    const done = runCode(
      start(
        `
        const m = World.mines[0];
        const before = m.oreRemaining;
        await self.mine();
        // после resume ссылка та же, поле обновилось
        if (World.mines[0] !== m) throw new Error('ref changed');
        if (m.oreRemaining !== before - 1) throw new Error('not updated');
        await self.mine();
      `,
      ),
      ch.post,
      ch.onDriverMessage,
    );
    await vi.waitFor(() => expect(ch.sent.length).toBe(1));

    // resume со сниженным остатком руды
    const updated: WorldSnapshot = {
      ...WORLD,
      mines: [{ ...WORLD.mines[0], oreRemaining: 4 }],
    };
    ch.deliver({ type: "resume", world: updated });
    await vi.waitFor(() => expect(ch.sent.length).toBe(2));
    // если бы ссылка/поле не обновились — код бросил бы error вместо второго intent
    expect(ch.sent[1]).toEqual({ type: "intent", action: "mine", line: 8 });

    ch.deliver({ type: "resume", world: updated });
    await done;
  });
});
