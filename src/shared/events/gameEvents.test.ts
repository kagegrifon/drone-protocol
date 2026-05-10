import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gameEvents } from './gameEvents.js';

beforeEach(() => gameEvents.clearAll());

describe('gameEvents', () => {
  it('вызывает listener при emit', () => {
    const fn = vi.fn();
    gameEvents.on('ore:mined', fn);
    gameEvents.emit('ore:mined', { droneId: 1, x: 3, y: 4 });
    expect(fn).toHaveBeenCalledWith({ droneId: 1, x: 3, y: 4 });
  });

  it('не вызывает listener после off', () => {
    const fn = vi.fn();
    gameEvents.on('ore:dropped', fn);
    gameEvents.off('ore:dropped', fn);
    gameEvents.emit('ore:dropped', { droneId: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it('поддерживает несколько listeners на одно событие', () => {
    const a = vi.fn();
    const b = vi.fn();
    gameEvents.on('charge:started', a);
    gameEvents.on('charge:started', b);
    gameEvents.emit('charge:started', { droneId: 2 });
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });

  it('emit undefined payload для mission:complete', () => {
    const fn = vi.fn();
    gameEvents.on('mission:complete', fn);
    gameEvents.emit('mission:complete', undefined);
    expect(fn).toHaveBeenCalledWith(undefined);
  });
});
