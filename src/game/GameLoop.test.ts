import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameLoop } from './GameLoop.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('GameLoop', () => {
  it('starts not running', () => {
    const loop = new GameLoop();
    expect(loop.isRunning).toBe(false);
  });

  it('calls callback at 100ms intervals', () => {
    vi.useFakeTimers();
    const loop = new GameLoop();
    const spy = vi.fn();

    loop.start(spy);
    expect(loop.isRunning).toBe(true);

    vi.advanceTimersByTime(300);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('stops calling callback after stop()', () => {
    vi.useFakeTimers();
    const loop = new GameLoop();
    const spy = vi.fn();

    loop.start(spy);
    vi.advanceTimersByTime(200);
    loop.stop();
    vi.advanceTimersByTime(200);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(loop.isRunning).toBe(false);
  });

  it('ignores duplicate start() calls', () => {
    vi.useFakeTimers();
    const loop = new GameLoop();
    const spy = vi.fn();

    loop.start(spy);
    loop.start(spy); // second call ignored
    vi.advanceTimersByTime(100);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('stop() is safe when not running', () => {
    const loop = new GameLoop();
    expect(() => loop.stop()).not.toThrow();
  });
});
