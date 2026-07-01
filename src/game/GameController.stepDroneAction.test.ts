import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../renderer/GameRenderer.js", () => ({ GameRenderer: class {} }));

import { useGameStore } from "../shared/store/gameStore.js";
import type { EntityId } from "../shared/types/index.js";
import { World } from "./simulation/world/World.js";
import type { ProgramComponent } from "./simulation/components/Program.js";
import { GameController } from "./GameController.js";

// Хелпер: ставит дрону Program с заданными state/currentLine, имитируя позицию.
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

  function advanceToNextAction(opts: {
    afterTicks: number;
    toState: ProgramComponent["state"];
    toLine: number;
  }) {
    let count = 0;
    tickSpy.mockImplementation(() => {
      count++;
      if (count >= opts.afterTicks) {
        setAction(world, droneId, opts.toState, opts.toLine);
      }
    });
  }

  return { controller, world, droneId, tickSpy, advanceToNextAction };
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

  it("крутит тики, пока действие (state/line) не сменится", () => {
    const { controller, world, droneId, advanceToNextAction } =
      makeStepController();
    setAction(world, droneId, "move", 3);
    // Тестовый tick: после 2 тиков «действие сменилось» (см. фабрику).
    advanceToNextAction({ afterTicks: 2, toState: "running", toLine: 4 });
    controller.stepDroneAction(droneId);
    const program = world.getComponent(droneId, "Program")!;
    expect(program.currentLine).toBe(4);
  });

  it("останавливается на MAX_STEP_TICKS, если действие не меняется", () => {
    const { controller, world, droneId, tickSpy } = makeStepController();
    setAction(world, droneId, "move", 3);
    // действие никогда не меняется → должны упереться в лимит
    controller.stepDroneAction(droneId);
    expect(tickSpy.mock.calls.length).toBeLessThanOrEqual(600);
    expect(tickSpy.mock.calls.length).toBeGreaterThan(0);
  });
});
