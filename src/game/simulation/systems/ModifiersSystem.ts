import type { World } from "../world/World.js";
import { DRAINED_EXIT_RATIO, OVERLOAD_THRESHOLDS } from "../constants.js";

export class ModifiersSystem {
  constructor(private readonly world: World) {}

  update(): void {
    const entities = this.world.query("Energy", "Inventory", "Modifiers");

    for (const id of entities) {
      const energy = this.world.getComponent(id, "Energy")!;
      const inventory = this.world.getComponent(id, "Inventory")!;
      const modifiers = this.world.getComponent(id, "Modifiers")!;

      const newActiveModifiers: typeof modifiers.active = [];

      // drained with hysteresis
      const wasDrained = modifiers.active.includes("drained");
      if (energy.current === 0) {
        newActiveModifiers.push("drained");
      } else if (
        wasDrained &&
        energy.current < energy.max * DRAINED_EXIT_RATIO
      ) {
        newActiveModifiers.push("drained");
      }

      // overloaded by thresholds (highest matching threshold wins)
      const load = inventory.ore / inventory.capacity;
      for (let i = OVERLOAD_THRESHOLDS.length - 1; i >= 0; i--) {
        const threshold = OVERLOAD_THRESHOLDS[i];
        if (load > threshold.minRatio) {
          newActiveModifiers.push(threshold.id);
          break;
        }
      }

      modifiers.active = newActiveModifiers;
    }
  }
}
