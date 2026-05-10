import type { EntityId } from '../../shared/types/index.js';
import type { World } from '../simulation/world/World.js';
import type { Grid } from '../simulation/world/Grid.js';
import type { ProgramRegistry } from '../programs/types.js';
import type { GameConfig } from '../types.js';

export interface SceneResult {
  world: World;
  grid: Grid;
  registry: ProgramRegistry;
  baseId: EntityId;
  staticEntityIds: EntityId[];
}

export interface MissionDef {
  id: string;
  title: string;
  description: string;
  goalText: string;
  config: GameConfig;
  buildScene(): SceneResult;
}
