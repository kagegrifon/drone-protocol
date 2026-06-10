import type { EntityId } from "../../shared/types/index.js";
import type { World } from "../simulation/world/World.js";
import type { Grid } from "../simulation/world/Grid.js";
import type { ProgramRegistry } from "../programs/types.js";

export interface BehaviorTickContext {
  world: World;
  grid: Grid;
  registry: ProgramRegistry;
  occupied: Set<string>;
}

export interface BehaviorDriver {
  /** Доводит дрона на один тик: читает/выставляет program.state, возвращается на yield-точке. */
  step(droneId: EntityId, ctx: BehaviorTickContext): void;
  /** Освобождает ресурсы драйвера для дрона (воркер и т.п.). Опционально. */
  dispose?(droneId: EntityId): void;
}
