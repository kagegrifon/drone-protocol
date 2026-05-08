import type { EntityId } from '../../shared/types/index.js';
import type { World } from '../simulation/world/World.js';
import type { Grid } from '../simulation/world/Grid.js';
import type { Instruction, ProgramRegistry, Condition } from './types.js';
import { astar } from '../pathfinding/astar.js';

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

  if (frame.waitRemaining !== undefined && frame.waitRemaining > 0) {
    frame.waitRemaining--;
    return;
  }

  const instructions = (frame.inlineInstructions as Instruction[] | undefined) ??
    registry.get(frame.programId)?.instructions ?? [];

  if (frame.instructionIndex >= instructions.length) {
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
      frame.waitRemaining = instruction.ticks;
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

    case 'RUN_PROGRAM':
      program.callStack.push({
        programId: instruction.programId,
        instructionIndex: 0,
      });
      // parent index is advanced when sub-frame pops
      break;

    case 'IF': {
      const met = evaluateCondition(instruction.condition, droneId, world);
      if (met && instruction.then.length > 0) {
        program.callStack.push({
          programId: '__inline__',
          instructionIndex: 0,
          inlineInstructions: instruction.then,
        });
        // parent index is advanced when sub-frame pops
      } else if (!met && instruction.else && instruction.else.length > 0) {
        program.callStack.push({
          programId: '__inline__',
          instructionIndex: 0,
          inlineInstructions: instruction.else,
        });
        // parent index is advanced when sub-frame pops
      } else {
        frame.instructionIndex++;
      }
      break;
    }
  }
}

function evaluateCondition(condition: Condition, droneId: EntityId, world: World): boolean {
  switch (condition.type) {
    case 'INVENTORY_FULL': {
      const inv = world.getComponent(droneId, 'Inventory');
      return inv !== undefined && inv.ore >= inv.capacity;
    }
    case 'INVENTORY_EMPTY': {
      const inv = world.getComponent(droneId, 'Inventory');
      return inv === undefined || inv.ore === 0;
    }
    case 'ENERGY_LOW': {
      const energy = world.getComponent(droneId, 'Energy');
      return energy !== undefined && energy.current <= condition.threshold;
    }
    case 'ENERGY_FULL': {
      const energy = world.getComponent(droneId, 'Energy');
      return energy !== undefined && energy.current >= energy.max;
    }
    case 'DEPOSIT_EMPTY': {
      const pos = world.getComponent(droneId, 'Position');
      if (!pos) return true;
      for (const depId of world.query('Position', 'Deposit')) {
        const depPos = world.getComponent(depId, 'Position')!;
        if (depPos.x === pos.x && depPos.y === pos.y) {
          return world.getComponent(depId, 'Deposit')!.oreRemaining <= 0;
        }
      }
      return true;
    }
  }
}
