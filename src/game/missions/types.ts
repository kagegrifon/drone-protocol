import type { EntityId, WorldObjectType } from "../../shared/types/index.js";
import type { World } from "../simulation/world/World.js";
import type { Grid } from "../simulation/world/Grid.js";
import type { ProgramRegistry } from "../programs/types.js";
import type { GameConfig } from "../types.js";

export interface EntityMeta {
  id: EntityId;
  type: WorldObjectType;
  label: string;
}

export interface SceneResult {
  world: World;
  grid: Grid;
  registry: ProgramRegistry;
  baseId: EntityId;
  staticEntities: Array<{ id: EntityId; type: WorldObjectType }>;
  focusPoint: { x: number; y: number };
}

export interface MissionDef {
  id: string;
  title: string;
  description: string;
  goalText: string;
  config: GameConfig;
  buildScene(): SceneResult;
}
