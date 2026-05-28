import type { EntityId } from '../../shared/types/index.js';
import type { World } from '../simulation/world/World.js';
import { DT, EPSILON } from '../simulation/constants.js';
import type { Grid } from '../simulation/world/Grid.js';
import type { Instruction, ProgramRegistry, ConditionLeaf, ConditionLogic } from './types.js';
import { astar } from '../pathfinding/astar.js';
import { evaluateFunctionCall } from './functions.js';

export function stepProgram(
  droneId: EntityId,
  world: World,
  registry: ProgramRegistry,
  grid: Grid,
  occupied: Set<string>
): void {
  const program = world.getComponent(droneId, 'Program');
  if (!program || program.state !== 'running') return;

  if (program.callStack.length === 0) {
    program.state = 'idle';
    return;
  }

  const frame = program.callStack[program.callStack.length - 1];

  if (frame.waitRemaining !== undefined && frame.waitRemaining > EPSILON) {
    frame.waitRemaining -= DT;
    return;
  }

  const instructions = (frame.inlineInstructions as Instruction[] | undefined) ??
    registry.get(frame.programId)?.instructions ?? [];

  if (frame.instructionIndex >= instructions.length) {
    if (frame.whileConditions) {
      const again = evaluateConditions(frame.whileConditions, frame.whileOperators ?? [], droneId, world);
      if (again) {
        frame.instructionIndex = 0;
        return;
      }
    }
    if (frame.isLoop) {
      frame.instructionIndex = 0;
      return;
    }
    if (frame.repeatRemaining !== undefined && frame.repeatRemaining > 0) {
      frame.repeatRemaining--;
      frame.instructionIndex = 0;
      return;
    }
    program.callStack.pop();
    if (program.callStack.length > 0) {
      program.callStack[program.callStack.length - 1].instructionIndex++;
    } else {
      program.state = 'idle';
    }
    return;
  }

  const instruction = instructions[frame.instructionIndex];

  switch (instruction.type) {
    case 'MOVE_TO': {
      const dronePos = world.getComponent(droneId, 'Position');
      const targetPos = world.getComponent(instruction.targetEntityId, 'Position');
      if (dronePos && targetPos) {
        const path = astar(grid, dronePos, targetPos, occupied);
        const movement = world.getComponent(droneId, 'Movement');
        if (movement && path !== null) {
          movement.path = path;
          movement.targetX = targetPos.x;
          movement.targetY = targetPos.y;
          movement.progress = 0;
        }
      }
      program.state = 'waiting';
      program.waitingFor = 'move';
      frame.instructionIndex++;
      break;
    }

    case 'MINE':
      program.state = 'waiting';
      program.waitingFor = 'mine';
      frame.instructionIndex++;
      break;

    case 'DROP':
      program.state = 'waiting';
      program.waitingFor = 'drop';
      frame.instructionIndex++;
      break;

    case 'CHARGE':
      program.state = 'waiting';
      program.waitingFor = 'charge';
      frame.instructionIndex++;
      break;

    case 'WAIT':
      frame.waitRemaining = instruction.seconds;
      frame.instructionIndex++;
      break;

    case 'LOOP':
      program.callStack.push({
        programId: '__inline__',
        instructionIndex: 0,
        isLoop: true,
        inlineInstructions: instruction.body,
      });
      break;

    case 'REPEAT':
      program.callStack.push({
        programId: '__inline__',
        instructionIndex: 0,
        repeatRemaining: instruction.count - 1,
        inlineInstructions: instruction.body,
      });
      break;

    case 'WHILE': {
      const met = evaluateConditions(instruction.conditions, instruction.operators, droneId, world);
      if (met) {
        program.callStack.push({
          programId: '__inline__',
          instructionIndex: 0,
          whileConditions: instruction.conditions,
          whileOperators: instruction.operators,
          inlineInstructions: instruction.body,
        });
      } else {
        frame.instructionIndex++;
      }
      break;
    }

    case 'RUN_PROGRAM':
      program.callStack.push({
        programId: instruction.programId,
        instructionIndex: 0,
      });
      // parent index is advanced when sub-frame pops
      break;

    case 'IF': {
      const met = evaluateConditions(instruction.conditions, instruction.operators, droneId, world);
      if (met && instruction.then.length > 0) {
        program.callStack.push({
          programId: '__inline__',
          instructionIndex: 0,
          inlineInstructions: instruction.then,
        });
      } else if (!met && instruction.else && instruction.else.length > 0) {
        program.callStack.push({
          programId: '__inline__',
          instructionIndex: 0,
          inlineInstructions: instruction.else,
        });
      } else {
        frame.instructionIndex++;
      }
      break;
    }
  }
}

function evaluateLeaf(leaf: ConditionLeaf, droneId: EntityId, world: World): boolean {
  const left = evaluateFunctionCall(leaf.left, droneId, world);
  const right = leaf.right.kind === 'number'
    ? leaf.right.value
    : evaluateFunctionCall(leaf.right.call, droneId, world);
  if (left === null || right === null) return false;
  switch (leaf.operator) {
    case '<':  return left < right;
    case '<=': return left <= right;
    case '=':  return left === right;
    case '>=': return left >= right;
    case '>':  return left > right;
  }
}

function evaluateConditions(
  conditions: ConditionLeaf[],
  operators: ConditionLogic[],
  droneId: EntityId,
  world: World
): boolean {
  if (conditions.length === 0) return false;
  let result = evaluateLeaf(conditions[0], droneId, world);
  for (let i = 0; i < operators.length; i++) {
    const next = evaluateLeaf(conditions[i + 1], droneId, world);
    result = operators[i] === 'AND' ? result && next : result || next;
  }
  return result;
}
