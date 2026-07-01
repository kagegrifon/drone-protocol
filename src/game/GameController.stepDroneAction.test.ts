import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../renderer/GameRenderer.js", () => ({ GameRenderer: class {} }));

import { useGameStore } from "../shared/store/gameStore.js";
import type { EntityId } from "../shared/types/index.js";
import { gameEvents } from "../shared/events/gameEvents.js";
import { World } from "./simulation/world/World.js";
import type { ProgramComponent } from "./simulation/components/Program.js";
import { GameController } from "./GameController.js";

function setAction(
  world: World,
  droneId: EntityId,
  state: ProgramComponent["state"],
  line: number | null,
) {
  const program = world.getComponent(droneId, "Program")!;
  program.state = state;
  program.currentLine = line;
}

function makeStepController() {
  const world = new World();
  const droneId = world.createEntity();
  world.addComponent(droneId, "Program", {
    currentProgramId: null,
    callStack: [],
    state: "running",
    commandSlots: 1,
    personalProgramId: String(droneId),
  });

  const tickSpy = vi.fn();
  // Подменяем стор-tick тестовой реализацией; stepDroneAction зовёт getState().tick().
  useGameStore.setState({ tick: tickSpy } as never);

  // Контроллер с доступом к world (минуем тяжёлый setup — присваиваем приватное поле
  // через as-cast, допустимо в unit-тесте инфраструктуры).
  const controller = new GameController({
    config: { win: { type: "ore_mined", target: 1 } },
    buildScene: () => {
      throw new Error("not used in unit test");
    },
  } as never);
  (controller as unknown as { world: World }).world = world;

  /** Настраивает tickSpy так, чтобы CodeBehaviorDriver "прислал resume" после N тиков. */
  function resumeAfterTicks(opts: {
    afterTicks: number;
    toState: ProgramComponent["state"];
    toLine: number;
  }) {
    let count = 0;
    tickSpy.mockImplementation(() => {
      count++;
      if (count >= opts.afterTicks) {
        setAction(world, droneId, opts.toState, opts.toLine);
        gameEvents.emit("drone:actionResumed", { droneId });
      }
    });
  }

  return { controller, world, droneId, tickSpy, resumeAfterTicks };
}

describe("GameController.stepDroneAction", () => {
  // Чистый стор перед каждым тестом — изоляция.
  beforeEach(() => {
    useGameStore.setState({ gameStatus: "paused", isRunning: false } as never);
  });

  it("no-op при won/failed", () => {
    const { controller, world, droneId } = makeStepController();
    useGameStore.getState().setGameStatus("won");
    setAction(world, droneId, "move", 3);
    controller.stepDroneAction(droneId);
    // currentLine не двигался — тиков не было
    expect(world.getComponent(droneId, "Program")!.currentLine).toBe(3);
  });

  it("крутит тики, пока driver не пришлёт resume для этого дрона", () => {
    const { controller, world, droneId, resumeAfterTicks, tickSpy } =
      makeStepController();
    setAction(world, droneId, "move", 3);
    resumeAfterTicks({ afterTicks: 2, toState: "running", toLine: 4 });
    controller.stepDroneAction(droneId);
    const program = world.getComponent(droneId, "Program")!;
    expect(program.currentLine).toBe(4);
    expect(tickSpy.mock.calls.length).toBe(2);
  });

  it("останавливается на первом же resume, а не на конце всего пути moveTo", () => {
    // Регрессия: раньше детектор сравнивал program.state/currentLine только до/после
    // всего цикла. При moveTo (многошаговое движение — один await, continuous
    // movement шлёт resume на каждой клетке) currentLine не менялся между шагами,
    // и Step action пролетал сразу до конца всего маршрута.
    const { controller, droneId, tickSpy } = makeStepController();
    tickSpy.mockImplementation(() => {
      // Имитация одного реального шага движения: driver сразу шлёт resume,
      // хотя код дрона всё ещё в том же await self.moveTo(...) (следующая клетка).
      gameEvents.emit("drone:actionResumed", { droneId });
    });
    controller.stepDroneAction(droneId);
    expect(tickSpy.mock.calls.length).toBe(1);
  });

  it("игнорирует resume другого дрона", () => {
    const { controller, droneId, tickSpy } = makeStepController();
    const otherDroneId = (droneId + 1) as EntityId;
    let count = 0;
    tickSpy.mockImplementation(() => {
      count++;
      if (count === 1) gameEvents.emit("drone:actionResumed", { droneId: otherDroneId });
      if (count === 3) gameEvents.emit("drone:actionResumed", { droneId });
    });
    controller.stepDroneAction(droneId);
    expect(tickSpy.mock.calls.length).toBe(3);
  });

  it("останавливается на MAX_STEP_TICKS, если resume не приходит", () => {
    const { controller, tickSpy } = makeStepController();
    // resume никогда не приходит → должны упереться в лимит
    controller.stepDroneAction(1 as EntityId);
    expect(tickSpy.mock.calls.length).toBeLessThanOrEqual(600);
    expect(tickSpy.mock.calls.length).toBeGreaterThan(0);
  });
});
