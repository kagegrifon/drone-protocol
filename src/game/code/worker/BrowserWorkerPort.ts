import type { CodeWorkerPort } from "../CodeWorkerPort.js";
import type { DriverMessage, WorkerMessage } from "../types.js";
// Vite-нативный импорт воркера: `?worker` надёжно создаёт worker-бандл и не
// зависит от import.meta.url, который под HMR приходит с ?t=<timestamp> и ломает
// трансформацию `new Worker(new URL(...))` (воркер тогда грузится как обычный
// модуль и его onmessage не срабатывает).
import BrowserWorkerEntry from "./browserWorkerEntry.ts?worker";

/** CodeWorkerPort поверх браузерного Worker — используется в проде (Vite). */
export class BrowserWorkerPort implements CodeWorkerPort {
  private readonly worker: Worker;

  constructor() {
    this.worker = new BrowserWorkerEntry();
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
