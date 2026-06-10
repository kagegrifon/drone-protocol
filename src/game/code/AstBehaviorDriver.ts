import type { EntityId } from "../../shared/types/index.js";
import { stepProgram } from "../programs/interpreter.js";
import type { BehaviorDriver, BehaviorTickContext } from "./BehaviorDriver.js";

/** Тонкая обёртка над stepProgram — поведение AST-режима не меняется. */
export class AstBehaviorDriver implements BehaviorDriver {
  step(droneId: EntityId, ctx: BehaviorTickContext): void {
    stepProgram(droneId, ctx.world, ctx.registry, ctx.grid, ctx.occupied);
  }
}
