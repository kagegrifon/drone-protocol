import type { World } from "../world/World.js";
import type { Grid } from "../world/Grid.js";
import type { CollisionSystem } from "./CollisionSystem.js";
import type { ProgramRegistry } from "../../programs/types.js";
import { AstBehaviorDriver } from "../../code/AstBehaviorDriver.js";
import type { BehaviorDriver } from "../../code/BehaviorDriver.js";
import type { CodeBehaviorDriver } from "../../code/CodeBehaviorDriver.js";

export class ProgramExecutionSystem {
  private readonly astDriver: BehaviorDriver = new AstBehaviorDriver();

  constructor(
    private readonly world: World,
    private readonly grid: Grid,
    private readonly collision: CollisionSystem,
    private readonly registry: ProgramRegistry,
    private readonly codeDriver?: CodeBehaviorDriver,
  ) {}

  update(): void {
    const drones = this.world.query("Position", "Movement", "Program");
    for (const id of drones) {
      const program = this.world.getComponent(id, "Program")!;
      if (program.localPaused) continue;
      if (program.state !== "running") continue;

      const ctx = {
        world: this.world,
        grid: this.grid,
        registry: this.registry,
        occupied: this.collision.occupied,
      };

      const driver: BehaviorDriver =
        program.codeSource && this.codeDriver ? this.codeDriver : this.astDriver;

      driver.step(id, ctx);
    }
  }
}
