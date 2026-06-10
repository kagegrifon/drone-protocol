import type { DriverMessage, WorkerMessage } from "./types.js";

/** Абстракция над worker-каналом: Web Worker (прод) / worker_threads (тесты). */
export interface CodeWorkerPort {
  postMessage(msg: DriverMessage): void;
  onMessage(cb: (msg: WorkerMessage) => void): void;
  onError(cb: (err: Error) => void): void;
  terminate(): void;
}
