// Plain-JS bootstrap: registers tsx's TS/ESM loader inside the worker thread,
// then imports the actual (TypeScript) worker entry point.
//
// Required because Node's `--import` register hooks (passed via `execArgv`)
// do not propagate to `node:worker_threads` workers — the loader has to be
// registered from inside the worker itself via the `tsx/esm/api` register().
import { register } from "tsx/esm/api";

register();

await import("./nodeWorkerEntry.js");
