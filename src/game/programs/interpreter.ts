import type { EntityId } from "../../shared/types/index.js";
import type { World } from "../simulation/world/World.js";
import { DT, EPSILON } from "../simulation/constants.js";
import type { Grid } from "../simulation/world/Grid.js";
import type {
  Instruction,
  ProgramRegistry,
  ConditionLeaf,
  ConditionLogic,
} from "./types.js";
import { astar } from "../pathfinding/astar.js";
import { evaluateFunctionCall } from "./functions.js";

// Защита от бесконечных циклов из чистого control-flow (например, LOOP {}).
// Любая программа с реальными yield-инструкциями (MOVE_TO/MINE/DROP/CHARGE/WAIT)
// выйдет из stepProgram задолго до этого предела.
const MAX_STEPS_PER_TICK = 1000;

export function stepProgram(
  droneId: EntityId,
  world: World,
  registry: ProgramRegistry,
  grid: Grid,
  occupied: Set<string>,
): void {
  const program = world.getComponent(droneId, "Program");
  if (!program || program.state !== "running") return;

  // Pre-tick: если на вершине стоит активный WAIT — декрементируем и выходим.
  // Поведение совпадает с прежней семантикой WAIT (N секунд = N/DT тиков задержки).
  if (program.callStack.length > 0) {
    const top = program.callStack[program.callStack.length - 1];
    if (top.waitRemaining !== undefined && top.waitRemaining > EPSILON) {
      top.waitRemaining -= DT;
      return;
    }
  }

  for (let step = 0; step < MAX_STEPS_PER_TICK; step++) {
    if (program.callStack.length === 0) {
      program.state = "idle";
      return;
    }

    const frame = program.callStack[program.callStack.length - 1];
    const instructions =
      (frame.inlineInstructions as Instruction[] | undefined) ??
      registry.get(frame.programId)?.instructions ??
      [];

    if (frame.instructionIndex >= instructions.length) {
      if (frame.whileConditions) {
        const again = evaluateConditions(
          frame.whileConditions,
          frame.whileOperators ?? [],
          droneId,
          world,
        );
        if (again) {
          frame.instructionIndex = 0;
          continue;
        }
      }
      if (frame.isLoop) {
        frame.instructionIndex = 0;
        continue;
      }
      if (frame.repeatRemaining !== undefined && frame.repeatRemaining > 0) {
        frame.repeatRemaining--;
        frame.instructionIndex = 0;
        continue;
      }
      program.callStack.pop();
      if (program.callStack.length > 0) {
        program.callStack[program.callStack.length - 1].instructionIndex++;
        continue;
      }
      program.state = "idle";
      return;
    }

    const instruction = instructions[frame.instructionIndex];

    switch (instruction.type) {
      case "MOVE_TO": {
        planAstarMove(
          droneId,
          instruction.targetEntityId,
          world,
          grid,
          occupied,
        );
        program.state = "move";
        frame.instructionIndex++;
        return;
      }

      case "MINE":
        program.state = "mine";
        frame.instructionIndex++;
        return;

      case "DROP":
        program.state = "drop";
        frame.instructionIndex++;
        return;

      case "CHARGE":
        program.state = "charge";
        frame.instructionIndex++;
        return;

      case "WAIT":
        // Yield: ставим waitRemaining и выходим, чтобы не «съесть» первый тик ожидания
        // в том же тике (сохраняем прежнее поведение тестов на WAIT).
        frame.waitRemaining = instruction.seconds;
        frame.instructionIndex++;
        return;

      case "LOOP":
        program.callStack.push({
          programId: "__inline__",
          instructionIndex: 0,
          isLoop: true,
          inlineInstructions: instruction.body,
        });
        continue;

      case "REPEAT":
        program.callStack.push({
          programId: "__inline__",
          instructionIndex: 0,
          repeatRemaining: instruction.count - 1,
          inlineInstructions: instruction.body,
        });
        continue;

      case "WHILE": {
        const met = evaluateConditions(
          instruction.conditions,
          instruction.operators,
          droneId,
          world,
        );
        if (met) {
          program.callStack.push({
            programId: "__inline__",
            instructionIndex: 0,
            whileConditions: instruction.conditions,
            whileOperators: instruction.operators,
            inlineInstructions: instruction.body,
          });
        } else {
          frame.instructionIndex++;
        }
        continue;
      }

      case "RUN_PROGRAM":
        program.callStack.push({
          programId: instruction.programId,
          instructionIndex: 0,
        });
        continue;

      case "IF": {
        const met = evaluateConditions(
          instruction.conditions,
          instruction.operators,
          droneId,
          world,
        );
        if (met && instruction.then.length > 0) {
          program.callStack.push({
            programId: "__inline__",
            instructionIndex: 0,
            inlineInstructions: instruction.then,
          });
        } else if (!met && instruction.else && instruction.else.length > 0) {
          program.callStack.push({
            programId: "__inline__",
            instructionIndex: 0,
            inlineInstructions: instruction.else,
          });
        } else {
          frame.instructionIndex++;
        }
        continue;
      }
    }
  }

  console.warn(
    `stepProgram: drone ${droneId} hit MAX_STEPS_PER_TICK (${MAX_STEPS_PER_TICK}) — likely empty-body LOOP/WHILE/REPEAT`,
  );
}

/**
 * Строит путь до targetEntityId через astar и применяет его к Movement дрона.
 * Используется и AST-веткой MOVE_TO, и CodeBehaviorDriver для drone.moveTo().
 */
export function planAstarMove(
  droneId: EntityId,
  targetEntityId: EntityId,
  world: World,
  grid: Grid,
  occupied: Set<string>,
): void {
  const dronePos = world.getComponent(droneId, "Position");
  const targetPos = world.getComponent(targetEntityId, "Position");
  if (!dronePos || !targetPos) return;
  const path = astar(grid, dronePos, targetPos, occupied);
  const movement = world.getComponent(droneId, "Movement");
  if (movement && path !== null) {
    movement.path = path;
    movement.targetX = targetPos.x;
    movement.targetY = targetPos.y;
    movement.progress = 0;
  }
}

function evaluateLeaf(
  leaf: ConditionLeaf,
  droneId: EntityId,
  world: World,
): boolean {
  const left = evaluateFunctionCall(leaf.left, droneId, world);
  const right =
    leaf.right.kind === "number"
      ? leaf.right.value
      : evaluateFunctionCall(leaf.right.call, droneId, world);
  if (left === null || right === null) return false;
  switch (leaf.operator) {
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case "=":
      return left === right;
    case ">=":
      return left >= right;
    case ">":
      return left > right;
  }
}

function evaluateConditions(
  conditions: ConditionLeaf[],
  operators: ConditionLogic[],
  droneId: EntityId,
  world: World,
): boolean {
  if (conditions.length === 0) return false;
  let result = evaluateLeaf(conditions[0], droneId, world);
  for (let i = 0; i < operators.length; i++) {
    const next = evaluateLeaf(conditions[i + 1], droneId, world);
    result = operators[i] === "AND" ? result && next : result || next;
  }
  return result;
}
