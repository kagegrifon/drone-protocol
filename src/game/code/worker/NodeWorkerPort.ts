import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import type { CodeWorkerPort } from "../CodeWorkerPort.js";
import type { DriverMessage, WorkerMessage } from "../types.js";

// Node's `--import` register hooks don't propagate into worker_threads, so the
// worker loads a plain-JS bootstrap that registers tsx itself before importing
// the (TypeScript) entry point.
const ENTRY_PATH = fileURLToPath(
  new URL("./nodeWorkerBootstrap.mjs", import.meta.url),
);

/** CodeWorkerPort поверх node:worker_threads — используется в Vitest. */
export class NodeWorkerPort implements CodeWorkerPort {
  private readonly worker: Worker;
  private online = false;
  private terminated = false;
  private readonly pending: DriverMessage[] = [];

  constructor() {
    this.worker = new Worker(ENTRY_PATH);
    // The bootstrap registers the tsx loader and dynamically imports the
    // entry point asynchronously, so its message listener isn't attached yet
    // when the worker spawns. Buffer messages until the worker is online to
    // avoid losing the initial "start" message.
    this.worker.once("online", () => {
      this.online = true;
      if (this.terminated) {
        return;
      }
      for (const msg of this.pending.splice(0)) {
        this.worker.postMessage(msg);
      }
    });
  }

  postMessage(msg: DriverMessage): void {
    if (this.online) {
      this.worker.postMessage(msg);
    } else {
      this.pending.push(msg);
    }
  }

  onMessage(cb: (msg: WorkerMessage) => void): void {
    this.worker.on("message", cb);
  }

  onError(cb: (err: Error) => void): void {
    this.worker.on("error", cb);
  }

  terminate(): void {
    this.terminated = true;
    this.pending.length = 0;
    void this.worker.terminate();
  }
}
