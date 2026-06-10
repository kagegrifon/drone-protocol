import { parentPort } from "node:worker_threads";
import { runCode } from "./codeRuntime.js";
import type { DriverMessage, WorkerMessage } from "../types.js";

if (!parentPort) {
  throw new Error("nodeWorkerEntry must run inside a worker thread");
}

const port = parentPort;
let started = false;

port.on("message", (msg: DriverMessage) => {
  if (msg.type === "start" && !started) {
    started = true;
    runCode(
      msg,
      (out: WorkerMessage) => port.postMessage(out),
      (cb) => port.on("message", cb),
    );
  }
});
