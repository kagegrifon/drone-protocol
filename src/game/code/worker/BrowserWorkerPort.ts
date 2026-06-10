import type { CodeWorkerPort } from "../CodeWorkerPort.js";
import type { DriverMessage, WorkerMessage } from "../types.js";

/** CodeWorkerPort поверх браузерного Worker — используется в проде (Vite). */
export class BrowserWorkerPort implements CodeWorkerPort {
  private readonly worker: Worker;

  constructor() {
    this.worker = new Worker(
      new URL("./browserWorkerEntry.ts", import.meta.url),
      {
        type: "module",
      },
    );
  }

  postMessage(msg: DriverMessage): void {
    this.worker.postMessage(msg);
  }

  onMessage(cb: (msg: WorkerMessage) => void): void {
    this.worker.onmessage = (ev: MessageEvent<WorkerMessage>) => cb(ev.data);
  }

  onError(cb: (err: Error) => void): void {
    this.worker.onerror = (ev: ErrorEvent) => cb(new Error(ev.message));
  }

  terminate(): void {
    this.worker.terminate();
  }
}
