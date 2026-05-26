import { describe, it, expect } from 'vitest';
import { mission3 } from './mission3.js';
import { mission4 } from './mission4.js';

describe('mission3 — shared program structure', () => {
  it('sharedLoop contains LOOP with exactly 6 IF-blocks', () => {
    const scene = mission3.buildScene();
    const prog = scene.registry.get('shared-loop-m3')!;
    expect(prog).toBeDefined();
    const loop = prog.instructions[0] as any;
    expect(loop.type).toBe('LOOP');
    const body: any[] = loop.body;
    expect(body).toHaveLength(6);
    for (const instr of body) {
      expect(instr.type).toBe('IF');
    }
  });
});

describe('mission4 — demo program structure', () => {
  it('loop1 contains LOOP with exactly 4 IF-blocks', () => {
    const scene = mission4.buildScene();
    const prog = scene.registry.get('loop-m4-d1')!;
    expect(prog).toBeDefined();
    const loop = prog.instructions[0] as any;
    expect(loop.type).toBe('LOOP');
    const body: any[] = loop.body;
    expect(body).toHaveLength(4);
    for (const instr of body) {
      expect(instr.type).toBe('IF');
    }
  });

  it('loop2 contains LOOP with exactly 4 IF-blocks', () => {
    const scene = mission4.buildScene();
    const prog = scene.registry.get('loop-m4-d2')!;
    expect(prog).toBeDefined();
    const loop = prog.instructions[0] as any;
    expect(loop.type).toBe('LOOP');
    const body: any[] = loop.body;
    expect(body).toHaveLength(4);
    for (const instr of body) {
      expect(instr.type).toBe('IF');
    }
  });
});
