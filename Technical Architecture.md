# 2. Technical Architecture Doc

````md id="tech-architecture-drone-loop-v1"
# Drone Loop — Technical Architecture

Version: 0.1  
Status: MVP Architecture

---

# Technology Stack

## Rendering / Game Engine
- Phaser 3

## UI
- React
- TypeScript

## Styling
- CSS Modules or Tailwind (TBD)

## Build Tool
- Vite

## State Management
Initially:
- React local state
- lightweight event system

Possible future:
- Zustand

---

# High-Level Architecture

Game split into two major layers:

## 1. Simulation Layer
Pure game logic.

Responsibilities:
- drones
- movement
- mining
- energy
- programs
- pathfinding
- collisions

IMPORTANT:
Simulation must NOT depend on Phaser.

---

## 2. Presentation Layer

### Phaser
Responsible for:
- rendering
- camera
- particles
- animation
- ambience
- world visuals

### React
Responsible for:
- program editor
- drone panels
- statistics
- mission UI
- overlays

---

# Core Principle

```txt
Simulation State
    ↓
Renderer observes state
    ↓
UI modifies state through commands
````

---

# Folder Structure (Proposed)

src/

game/
simulation/
systems/
entities/
components/
world/

renderer/
phaser/
scenes/
sprites/

ui/
components/
panels/
editor/

shared/
types/
constants/
utils/

---

# Simulation Architecture

ECS-lite approach.

NOT full ECS framework.

Goal:

* simple,
* flexible,
* fast to prototype.

---

# Core Entities

## Drone

Properties:

* id
* position
* direction
* energy
* inventory
* programId
* state

## Mine

* resource amount
* mining speed

## Base

* storage
* drone production

## Charger

* charging speed
* occupancy

---

# Components

## PositionComponent

```ts
{
  x: number;
  y: number;
}
```

## EnergyComponent

```ts
{
  current: number;
  max: number;
}
```

## InventoryComponent

```ts
{
  ore: number;
  capacity: number;
}
```

## ProgramComponent

```ts
{
  currentProgramId: string;
  instructionPointer: number;
}
```

---

# Systems

## MovementSystem

Handles:

* grid movement
* path traversal
* movement timing

## CollisionSystem

Handles:

* occupied cells
* congestion
* waiting

## MiningSystem

Handles:

* mining progress
* resource extraction

## EnergySystem

Handles:

* energy consumption
* charging

## ProgramExecutionSystem

Handles:

* instruction execution
* conditions
* loops
* subprogram calls

## StatisticsSystem

Tracks:

* ore/min
* idle time
* congestion
* efficiency

---

# Grid System

## World

Tile-based grid.

MVP size:
20x20

## Cell Types

* empty
* wall
* mine
* base
* charger

---

# Movement

Movement should:

* feel smooth,
* readable,
* slightly slow,
* pleasant to observe.

NOT twitchy.

---

# Pathfinding

Initial MVP:

* A*
* recalculated on demand

No advanced optimization initially.

---

# Program System

Programs stored as structured data.

Example:

```ts
type Instruction =
  | MoveToInstruction
  | MineInstruction
  | PickupInstruction
  | DropInstruction
  | ChargeInstruction
  | WaitInstruction
  | IfInstruction
  | LoopInstruction
  | RunProgramInstruction;
```

## MOVE_TO Architecture

MOVE_TO does not search targets automatically in MVP.

Instead, it references explicit entities.

Example:

```ts
type MoveToInstruction = {
  type: "MOVE_TO";
  targetId: EntityId;
};
```

Examples:

targetId = "base_1"
targetId = "mine_1"
targetId = "charger_1"

Possible future instructions:

```ts
type MoveToNearestMine = {
  type: "MOVE_TO_NEAREST",
  entityType: "MINE"
}
```



---

# Example Program Data

```ts
{
  id: "main",
  instructions: [
    {
      type: "IF",
      condition: "LOW_ENERGY",
      action: {
        type: "RUN_PROGRAM",
        target: "recharge"
      }
    }
  ]
}
```

---

# React UI Responsibilities

## Program Editor

* instruction list
* add/remove instructions
* edit conditions
* assign programs

## Drone Inspector

* energy
* inventory
* current task
* current program

## Statistics

* throughput
* congestion
* efficiency

---

# Phaser Responsibilities

## Visual Rendering

* world rendering
* drone sprites
* particles
* glow effects

## Camera

* panning
* zoom

## Audio

* ambient music
* sound effects

## Animation

* movement interpolation
* blinking lights
* idle animation

---

# Communication Between React and Phaser

Recommended:
Shared game store/service.

Example flow:

React UI
→ dispatch command
→ simulation updates
→ Phaser renders new state

---

# Tick Model

Simulation runs on fixed timestep.

Recommended:

* 10 ticks/sec simulation
* rendering independent

---

# Rendering Model

Phaser interpolates between simulation states for smooth visuals.

---

# Audio Design Notes

Important:
audio should support relaxation.

Avoid:

* aggressive alerts
* loud repetitive sounds
* chaotic mixing

---

# MVP Development Order

## Phase 1

* grid
* rendering
* drone movement

## Phase 2

* mining
* inventory
* base

## Phase 3

* energy
* charging

## Phase 4

* program execution

## Phase 5

* conditions
* loops
* subprograms

## Phase 6

* React editor UI

## Phase 7

* polish
* particles
* ambience
* sound

---

# Major Risks

## Scope Explosion

Main risk.

Avoid:

* complex economy
* combat
* advanced AI
* multiplayer

## Overengineering

Avoid:

* heavy ECS frameworks
* premature abstractions
* complicated editors

---

# MVP Philosophy

Small but polished.

Priority:

1. atmosphere
2. clarity
3. pleasant observation
4. satisfying automation

NOT feature count.
MVP intentionally favors explicit player-authored logic over smart automation.
Advanced abstraction and autonomous search behaviors are part of future progression systems.

```
```
