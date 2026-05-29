# Session: Fix interpreter — continuous drone movement

**Date:** 2026-05-29  
**Goal:** Eliminate 1-tick pauses in drone movement caused by control-flow instructions in interpreter.

## Problem

`LOOP { MOVE_TO target }` produced a step/pause/step pattern: control-flow nodes (LOOP push, end-of-body reset) each consumed a full tick without issuing a move, so the drone moved only on every other tick.

Root cause: `stepProgram` executed exactly one "unit" per call. Control-flow instructions (LOOP, REPEAT, WHILE, IF, RUN_PROGRAM, end-of-body) returned immediately after pushing/resetting a frame, without continuing to the next real instruction.

## Solution

Converted `stepProgram` from a single-step function into a loop that continues processing instructions within the same tick until a yield is reached:

- **Yield instructions** (`return` from loop) — hand off execution to other systems:
  - `MOVE_TO`, `MINE`, `DROP`, `CHARGE` → set `state='waiting'`
  - `WAIT` → sets `waitRemaining`, exits immediately to preserve timing semantics
- **Non-yield (control-flow)** → `continue` within the loop:
  - `LOOP`, `REPEAT`, `WHILE`, `IF`, `RUN_PROGRAM` frame pushes
  - End-of-body resets for LOOP/REPEAT/WHILE
  - Frame pop + parent `instructionIndex` increment
- `MAX_STEPS_PER_TICK = 1000` guard against infinite-body-less loops

WAIT pre-check (decrement `waitRemaining`) was kept outside the main loop to preserve exact tick-count semantics for existing tests.

## Files changed

- `src/game/programs/interpreter.ts` — `stepProgram` loop + MAX_STEPS_PER_TICK guard

## Results

- All 218 unit tests pass (unchanged)
- Type-check clean
- Drone movement is now continuous: each tick produces one step, no 1-tick pauses between iterations

## Метрики сессии
- Модель: claude-sonnet-4-6
- Input: 59 токенов (кеш: 1,554,416 / запись в кеш: 278,372)
- Output: 60,335 токенов
- Контекст: 57,721 / 200,000 токенов (28.9%)
- Стоимость: $2.415
