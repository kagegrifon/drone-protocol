import { World } from '../simulation/world/World.js';
import { Grid } from '../simulation/world/Grid.js';
import { createBase } from '../simulation/entities/createBase.js';
import { createMine } from '../simulation/entities/createMine.js';
import { createCharger } from '../simulation/entities/createCharger.js';
import { createDrone } from '../simulation/entities/createDrone.js';
import type { MissionDef } from './types.js';
import type { ProgramDef, ProgramRegistry } from '../programs/types.js';

export const mission3: MissionDef = {
  id: 'mission3',
  title: 'Миссия 3: Два дрона',
  description: 'Два дрона едут к одной шахте — пробки и простой. Перенаправь второй дрон на mine2.',
  goalText: 'Добыть 200 руды',
  config: {
    win: { type: 'ore_mined', target: 200 },
    fail: { type: 'time_limit', maxTicks: 1200 },
  },
  buildScene() {
    const world = new World();
    const grid = new Grid();
    const registry: ProgramRegistry = new Map();

    grid.setTile(1, 1, 'base');
    grid.setTile(15, 3, 'mine');
    grid.setTile(3, 15, 'mine');
    grid.setTile(1, 10, 'charger');
    grid.setTile(10, 1, 'charger');

    const baseId = createBase(world, 1, 1);
    const mine1Id = createMine(world, 15, 3);
    const mine2Id = createMine(world, 3, 15);
    const charger1Id = createCharger(world, 1, 10);
    const charger2Id = createCharger(world, 10, 1);
    const drone1Id = createDrone(world, 4, 4);
    const drone2Id = createDrone(world, 12, 12);

    const sharedLoop: ProgramDef = {
      id: 'shared-loop-m3',
      name: 'mine-loop',
      instructions: [
        {
          type: 'LOOP',
          body: [
            { type: 'MOVE_TO', targetEntityId: mine1Id },
            { type: 'MINE' },
            { type: 'MOVE_TO', targetEntityId: baseId },
            { type: 'DROP' },
            {
              type: 'IF',
              conditions: [{ property: { kind: 'ENERGY', unit: '%' }, operator: '<=', value: 30 }],
              operators: [],
              then: [
                { type: 'MOVE_TO', targetEntityId: charger1Id },
                { type: 'CHARGE' },
              ],
            },
          ],
        },
      ],
    };
    registry.set(sharedLoop.id, sharedLoop);

    for (const droneId of [drone1Id, drone2Id]) {
      const prog = world.getComponent(droneId, 'Program')!;
      prog.currentProgramId = sharedLoop.id;
      prog.callStack = [{ programId: sharedLoop.id, instructionIndex: 0 }];
      prog.state = 'running';
    }

    for (const droneId of [drone1Id, drone2Id]) {
      const personalProg: ProgramDef = {
        id: String(droneId),
        name: `drone-${droneId}`,
        personal: true,
        instructions: [],
      };
      registry.set(personalProg.id, personalProg);
      const prog = world.getComponent(droneId, 'Program')!;
      prog.personalProgramId = String(droneId);
      prog.assignedProgramId = sharedLoop.id;
    }

    return {
      world, grid, registry, baseId,
      staticEntities: [
        { id: baseId, type: 'base' },
        { id: mine1Id, type: 'mine' },
        { id: mine2Id, type: 'mine' },
        { id: charger1Id, type: 'charger' },
        { id: charger2Id, type: 'charger' },
      ],
    };
  },
};
