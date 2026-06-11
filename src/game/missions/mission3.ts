import { World } from "../simulation/world/World.js";
import { Grid } from "../simulation/world/Grid.js";
import { createBase } from "../simulation/entities/createBase.js";
import { createMine } from "../simulation/entities/createMine.js";
import { createCharger } from "../simulation/entities/createCharger.js";
import { createDrone } from "../simulation/entities/createDrone.js";
import { initWorkSlotsIndex } from "../simulation/world/workSlotsIndex.js";
import { validateNoDroneOnSlot } from "../simulation/world/workSlots.js";
import type { MissionDef } from "./types.js";
import type { ProgramDef, ProgramRegistry } from "../programs/types.js";

export const mission3: MissionDef = {
  id: "mission3",
  title: "Миссия 3: Два дрона",
  description:
    "Два дрона едут к одной шахте — пробки и простой. Перенаправь второй дрон на mine2.",
  goalText: "Добыть 200 руды",
  config: {
    win: { type: "ore_mined", target: 200 },
    // fail: { type: 'time_limit', maxTicks: 1200 },
  },
  buildScene() {
    const world = new World();
    const grid = new Grid(30, 30);
    const registry: ProgramRegistry = new Map();

    grid.setTile(1, 1, "base");
    grid.setTile(15, 3, "mine");
    grid.setTile(3, 15, "mine");
    grid.setTile(1, 10, "charger");
    grid.setTile(10, 1, "charger");

    const baseId = createBase(world, 1, 1);
    const mine1Id = createMine(world, 15, 3);
    const mine2Id = createMine(world, 3, 15);
    const charger1Id = createCharger(world, 1, 10);
    const charger2Id = createCharger(world, 10, 1);
    const drone1Id = createDrone(world, 4, 4);
    const drone2Id = createDrone(world, 12, 12);

    const sharedLoop: ProgramDef = {
      id: "shared-loop-m3",
      name: "mine-loop",
      behaviorMode: "block",
      instructions: [
        {
          type: "LOOP",
          body: [
            // Priority 1: у зарядки И энергия не полная → CHARGE
            {
              type: "IF",
              conditions: [
                {
                  left: {
                    fn: "Distance",
                    args: [
                      { kind: "self" },
                      { kind: "entity", id: charger1Id },
                    ],
                  },
                  operator: "<=",
                  right: { kind: "number", value: 0 },
                },
                {
                  left: { fn: "Energy", args: [{ kind: "self" }] },
                  operator: "<",
                  right: {
                    kind: "function",
                    call: { fn: "EnergyMax", args: [{ kind: "self" }] },
                  },
                },
              ],
              operators: ["AND"],
              then: [{ type: "CHARGE" }],
            },
            // Priority 2: энергия < 30 И не у зарядки И трюм пуст → MOVE_TO(charger1)
            {
              type: "IF",
              conditions: [
                {
                  left: { fn: "Energy", args: [{ kind: "self" }] },
                  operator: "<",
                  right: { kind: "number", value: 30 },
                },
                {
                  left: {
                    fn: "Distance",
                    args: [
                      { kind: "self" },
                      { kind: "entity", id: charger1Id },
                    ],
                  },
                  operator: ">",
                  right: { kind: "number", value: 0 },
                },
                {
                  left: { fn: "Inventory", args: [{ kind: "self" }] },
                  operator: "=",
                  right: { kind: "number", value: 0 },
                },
              ],
              operators: ["AND", "AND"],
              then: [{ type: "MOVE_TO", targetEntityId: charger1Id }],
            },
            // Priority 3: у базы И есть руда → DROP
            {
              type: "IF",
              conditions: [
                {
                  left: {
                    fn: "Distance",
                    args: [{ kind: "self" }, { kind: "entity", id: baseId }],
                  },
                  operator: "<=",
                  right: { kind: "number", value: 0 },
                },
                {
                  left: { fn: "Inventory", args: [{ kind: "self" }] },
                  operator: ">",
                  right: { kind: "number", value: 0 },
                },
              ],
              operators: ["AND"],
              then: [
                {
                  type: "WHILE",
                  conditions: [
                    {
                      left: { fn: "Inventory", args: [{ kind: "self" }] },
                      operator: ">",
                      right: {
                        kind: "number",
                        value: 0,
                      },
                    },
                  ],
                  operators: [],
                  body: [{ type: "DROP" }],
                },
              ],
            },
            // Priority 4: есть руда И не у базы → MOVE_TO(base)
            {
              type: "IF",
              conditions: [
                {
                  left: { fn: "Inventory", args: [{ kind: "self" }] },
                  operator: ">",
                  right: { kind: "number", value: 0 },
                },
                {
                  left: {
                    fn: "Distance",
                    args: [{ kind: "self" }, { kind: "entity", id: baseId }],
                  },
                  operator: ">",
                  right: { kind: "number", value: 0 },
                },
              ],
              operators: ["AND"],
              then: [{ type: "MOVE_TO", targetEntityId: baseId }],
            },
            // Priority 5: трюм пуст И энергия ≥ 30 И у шахты → MINE
            {
              type: "IF",
              conditions: [
                {
                  left: { fn: "Inventory", args: [{ kind: "self" }] },
                  operator: "=",
                  right: { kind: "number", value: 0 },
                },
                {
                  left: { fn: "Energy", args: [{ kind: "self" }] },
                  operator: ">=",
                  right: { kind: "number", value: 30 },
                },
                {
                  left: {
                    fn: "Distance",
                    args: [{ kind: "self" }, { kind: "entity", id: mine1Id }],
                  },
                  operator: "<=",
                  right: { kind: "number", value: 0 },
                },
              ],
              operators: ["AND", "AND"],
              then: [
                {
                  type: "WHILE",
                  conditions: [
                    {
                      left: { fn: "Inventory", args: [{ kind: "self" }] },
                      operator: "<",
                      right: {
                        kind: "function",
                        call: { fn: "InventoryMax", args: [{ kind: "self" }] },
                      },
                    },
                  ],
                  operators: [],
                  body: [{ type: "MINE" }],
                },
              ],
            },
            // Priority 6: трюм пуст И энергия ≥ 30 И не у шахты → MOVE_TO(mine1)
            {
              type: "IF",
              conditions: [
                {
                  left: { fn: "Inventory", args: [{ kind: "self" }] },
                  operator: "=",
                  right: { kind: "number", value: 0 },
                },
                {
                  left: { fn: "Energy", args: [{ kind: "self" }] },
                  operator: ">=",
                  right: { kind: "number", value: 30 },
                },
                {
                  left: {
                    fn: "Distance",
                    args: [{ kind: "self" }, { kind: "entity", id: mine1Id }],
                  },
                  operator: ">",
                  right: { kind: "number", value: 0 },
                },
              ],
              operators: ["AND", "AND"],
              then: [{ type: "MOVE_TO", targetEntityId: mine1Id }],
            },
          ],
        },
        // {
        //   type: "LOOP",
        //   body: [
        //     // Priority 1: у зарядки И энергия не полная → CHARGE
        //     {
        //       type: "IF",
        //       conditions: [
        //         {
        //           left: { fn: "Distance", args: [{ kind: "self" }, { kind: "entity", id: charger1Id }] },
        //           operator: "<=",
        //           right: { kind: "number", value: 0 },
        //         },
        //         {
        //           left: { fn: "Energy", args: [{ kind: "self" }] },
        //           operator: "<",
        //           right: { kind: "function", call: { fn: "EnergyMax", args: [{ kind: "self" }] } },
        //         },
        //       ],
        //       operators: ["AND"],
        //       then: [{ type: "CHARGE" }],
        //     },
        //     // Priority 2: энергия < 30 И не у зарядки И трюм пуст → MOVE_TO(charger1)
        //     {
        //       type: "IF",
        //       conditions: [
        //         {
        //           left: { fn: "Energy", args: [{ kind: "self" }] },
        //           operator: "<",
        //           right: { kind: "number", value: 30 },
        //         },
        //         {
        //           left: { fn: "Distance", args: [{ kind: "self" }, { kind: "entity", id: charger1Id }] },
        //           operator: ">",
        //           right: { kind: "number", value: 0 },
        //         },
        //         {
        //           left: { fn: "Inventory", args: [{ kind: "self" }] },
        //           operator: "=",
        //           right: { kind: "number", value: 0 },
        //         },
        //       ],
        //       operators: ["AND", "AND"],
        //       then: [{ type: "MOVE_TO", targetEntityId: charger1Id }],
        //     },
        //     // Priority 3: у базы И есть руда → DROP
        //     {
        //       type: "IF",
        //       conditions: [
        //         {
        //           left: { fn: "Distance", args: [{ kind: "self" }, { kind: "entity", id: baseId }] },
        //           operator: "<=",
        //           right: { kind: "number", value: 0 },
        //         },
        //         {
        //           left: { fn: "Inventory", args: [{ kind: "self" }] },
        //           operator: ">",
        //           right: { kind: "number", value: 0 },
        //         },
        //       ],
        //       operators: ["AND"],
        //       then: [{ type: "DROP" }],
        //     },
        //     // Priority 4: есть руда И не у базы → MOVE_TO(base)
        //     {
        //       type: "IF",
        //       conditions: [
        //         {
        //           left: { fn: "Inventory", args: [{ kind: "self" }] },
        //           operator: ">",
        //           right: { kind: "number", value: 0 },
        //         },
        //         {
        //           left: { fn: "Distance", args: [{ kind: "self" }, { kind: "entity", id: baseId }] },
        //           operator: ">",
        //           right: { kind: "number", value: 0 },
        //         },
        //       ],
        //       operators: ["AND"],
        //       then: [{ type: "MOVE_TO", targetEntityId: baseId }],
        //     },
        //     // Priority 5: трюм пуст И энергия ≥ 30 И у шахты → MINE
        //     {
        //       type: "IF",
        //       conditions: [
        //         {
        //           left: { fn: "Inventory", args: [{ kind: "self" }] },
        //           operator: "=",
        //           right: { kind: "number", value: 0 },
        //         },
        //         {
        //           left: { fn: "Energy", args: [{ kind: "self" }] },
        //           operator: ">=",
        //           right: { kind: "number", value: 30 },
        //         },
        //         {
        //           left: { fn: "Distance", args: [{ kind: "self" }, { kind: "entity", id: mine1Id }] },
        //           operator: "<=",
        //           right: { kind: "number", value: 0 },
        //         },
        //       ],
        //       operators: ["AND", "AND"],
        //       then: [{ type: "MINE" }],
        //     },
        //     // Priority 6: трюм пуст И энергия ≥ 30 И не у шахты → MOVE_TO(mine1)
        //     {
        //       type: "IF",
        //       conditions: [
        //         {
        //           left: { fn: "Inventory", args: [{ kind: "self" }] },
        //           operator: "=",
        //           right: { kind: "number", value: 0 },
        //         },
        //         {
        //           left: { fn: "Energy", args: [{ kind: "self" }] },
        //           operator: ">=",
        //           right: { kind: "number", value: 30 },
        //         },
        //         {
        //           left: { fn: "Distance", args: [{ kind: "self" }, { kind: "entity", id: mine1Id }] },
        //           operator: ">",
        //           right: { kind: "number", value: 0 },
        //         },
        //       ],
        //       operators: ["AND", "AND"],
        //       then: [{ type: "MOVE_TO", targetEntityId: mine1Id }],
        //     },
        //   ],
        // },
      ],
    };
    registry.set(sharedLoop.id, sharedLoop);

    for (const droneId of [drone1Id, drone2Id]) {
      const prog = world.getComponent(droneId, "Program")!;
      prog.currentProgramId = sharedLoop.id;
      prog.callStack = [{ programId: sharedLoop.id, instructionIndex: 0 }];
      prog.state = "running";
    }

    for (const droneId of [drone1Id, drone2Id]) {
      const personalProg: ProgramDef = {
        id: String(droneId),
        name: `drone-${droneId}`,
        personal: true,
        instructions: [],
        behaviorMode: "block",
      };
      registry.set(personalProg.id, personalProg);
      const prog = world.getComponent(droneId, "Program")!;
      prog.personalProgramId = String(droneId);
      prog.assignedProgramId = sharedLoop.id;
    }

    initWorkSlotsIndex(world);
    validateNoDroneOnSlot(world);

    return {
      world,
      grid,
      registry,
      baseId,
      staticEntities: [
        { id: baseId, type: "base" },
        { id: mine1Id, type: "mine" },
        { id: mine2Id, type: "mine" },
        { id: charger1Id, type: "charger" },
        { id: charger2Id, type: "charger" },
      ],
    };
  },
};
