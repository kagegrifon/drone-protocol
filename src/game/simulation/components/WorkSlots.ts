import type { EntityId } from '../../../shared/types/index.js';

export interface WorkSlot {
  x: number;
  y: number;
  occupiedBy: EntityId | null;
}

export interface WorkSlotsComponent {
  slots: WorkSlot[];
}
