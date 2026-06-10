import type { EntityId } from "../../shared/types/index.js";
import type { World } from "../simulation/world/World.js";
import type { Grid } from "../simulation/world/Grid.js";
import type { ProgramRegistry } from "../programs/types.js";
import type { GameConfig } from "../types.js";

export type EntityType = "mine" | "base" | "charger";

export interface EntityMeta {
  id: EntityId;
  type: EntityType;
  label: string;
}

export interface SceneResult {
  world: World;
  grid: Grid;
  registry: ProgramRegistry;
  baseId: EntityId;
  staticEntities: Array<{ id: EntityId; type: EntityType }>;
}

export interface MissionDef {
  id: string;
  title: string;
  description: string;
  goalText: string;
  config: GameConfig;
  buildScene(): SceneResult;
}
