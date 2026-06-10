import { runCode } from "./codeRuntime.js";
import type { DriverMessage, WorkerMessage } from "../types.js";

let started = false;

self.onmessage = (ev: MessageEvent<DriverMessage>) => {
  const msg = ev.data;
  if (msg.type === "start" && !started) {
    started = true;
    runCode(
      msg,
      (out: WorkerMessage) => self.postMessage(out),
      (cb) => {
        self.onmessage = (e: MessageEvent<DriverMessage>) => cb(e.data);
      },
    );
  }
};
