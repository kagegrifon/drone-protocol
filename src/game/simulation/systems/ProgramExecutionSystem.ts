import type { World } from "../world/World.js";
import type { Grid } from "../world/Grid.js";
import type { CollisionSystem } from "./CollisionSystem.js";
import type { ProgramRegistry } from "../../programs/types.js";
import { stepProgram } from "../../programs/interpreter.js";

export class ProgramExecutionSystem {
  constructor(
    private readonly world: World,
    private readonly grid: Grid,
    private readonly collision: CollisionSystem,
    private readonly registry: ProgramRegistry,
  ) {}

  update(): void {
    const drones = this.world.query("Position", "Movement", "Program");
    for (const id of drones) {
      const program = this.world.getComponent(id, "Program")!;
      if (program.localPaused) continue;
      if (program.state !== "running") continue;
      stepProgram(
        id,
        this.world,
        this.registry,
        this.grid,
        this.collision.occupied,
      );
    }
  }
}
