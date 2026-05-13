import { World } from '../simulation/world/World.js';
import { Grid } from '../simulation/world/Grid.js';
import { createBase } from '../simulation/entities/createBase.js';
import { createMine } from '../simulation/entities/createMine.js';
import { createCharger } from '../simulation/entities/createCharger.js';
import { createDrone } from '../simulation/entities/createDrone.js';
import type { MissionDef } from './types.js';
import type { ProgramRegistry } from '../programs/types.js';

export const mission2: MissionDef = {
  id: 'mission2',
  title: 'Миссия 2: Управление энергией',
  description: 'Дрон тратит энергию. Добавь в программу: IF ENERGY_LOW → CHARGE. Иначе дрон остановится.',
  goalText: 'Добыть 80 руды',
  config: {
    win: { type: 'ore_mined', target: 80 },
    fail: { type: 'time_limit', maxTicks: 900 },
  },
  buildScene() {
    const world = new World();
    const grid = new Grid();
    const registry: ProgramRegistry = new Map();

    grid.setTile(1, 1, 'base');
    grid.setTile(15, 3, 'mine');
    grid.setTile(1, 10, 'charger');

    const baseId = createBase(world, 1, 1);
    const mineId = createMine(world, 15, 3);
    const chargerId = createCharger(world, 1, 10);
    createDrone(world, 5, 5);

    return {
      world, grid, registry, baseId,
      staticEntities: [
        { id: baseId, type: 'base' },
        { id: mineId, type: 'mine' },
        { id: chargerId, type: 'charger' },
      ],
    };
  },
};
