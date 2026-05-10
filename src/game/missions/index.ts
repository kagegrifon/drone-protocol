import { mission1 } from './mission1.js';
import { mission2 } from './mission2.js';
import { mission3 } from './mission3.js';
import { mission4 } from './mission4.js';
import type { MissionDef } from './types.js';

export { mission1, mission2, mission3, mission4 };
export type { MissionDef };
export type { SceneResult } from './types.js';

export const ALL_MISSIONS: MissionDef[] = [mission1, mission2, mission3, mission4];
