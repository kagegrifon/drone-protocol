export class GameLoop {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs = 100;

  start(onTick: () => void): void {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(onTick, this.intervalMs);
  }

  stop(): void {
    if (this.intervalId === null) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  get isRunning(): boolean {
    return this.intervalId !== null;
  }
}
