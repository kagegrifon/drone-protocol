import type { EntityId, WorldObjectType } from "../../shared/types/index.js";
import { DT } from "../simulation/constants.js";
import type { ProgramComponent } from "../simulation/components/Program.js";
import { extendPathTail, planMoveToPoint } from "../pathfinding/planMove.js";
import type { BehaviorDriver, BehaviorTickContext } from "./BehaviorDriver.js";
import type { CodeWorkerPort } from "./CodeWorkerPort.js";
import { collectWorld } from "./worldSnapshot.js";
import type { WorkerMessage } from "./types.js";

// Бюджет на ответ воркера. Большой запас нужен из-за холодного старта в dev:
// первый запуск worker-модуля под Vite (компиляция + конкуренция с Monaco
// TS-воркером) может занять до нескольких секунд, хотя последующие ответы
// приходят за ~15ms.
const DEFAULT_TIMEOUT_MS = 10000;

type Phase = "idle" | "action-pending" | "waiting" | "done";

interface Session {
  port: CodeWorkerPort;
  phase: Phase;
  pending: WorkerMessage | null;
  waitRemaining: number;
  timeoutHandle: ReturnType<typeof setTimeout> | null;
}

export interface CodeBehaviorDriverOptions {
  createPort: () => CodeWorkerPort;
  timeoutMs?: number;
  /**
   * Карта типов статических сущностей мира (mine/base/charger), из
   * scene.staticEntities. По ней collectWorld строит World.mines/bases/chargers.
   */
  typeMap?: ReadonlyMap<EntityId, WorldObjectType>;
}

/**
 * Driver для дронов с behavior.source === 'code'. Держит по одной worker-сессии
 * на дрона. Каждый await drone.<action>() в коде игрока становится одним
 * intent → program.state выставляется и step() возвращает управление, как
 * в stepProgram. Когда системы вернули state в 'running', driver шлёт воркеру
 * 'resume' со свежим снапшотом сенсоров — промис в воркере резолвится.
 */
export class CodeBehaviorDriver implements BehaviorDriver {
  private readonly sessions = new Map<EntityId, Session>();
  private readonly typeMap: ReadonlyMap<EntityId, WorldObjectType>;

  constructor(private readonly options: CodeBehaviorDriverOptions) {
    this.typeMap = options.typeMap ?? new Map();
  }

  step(droneId: EntityId, ctx: BehaviorTickContext): void {
    const program = ctx.world.getComponent(droneId, "Program");
    if (!program) return;

    let session = this.sessions.get(droneId);

    if (!session) {
      const activeProgramId =
        program.currentProgramId ?? program.personalProgramId;
      const activeDef = ctx.registry.get(activeProgramId);
      const code =
        activeDef?.behavior.sourceForm === "code"
          ? activeDef.behavior.code
          : undefined;
      if (!code) return;
      const port = this.options.createPort();
      session = {
        port,
        phase: "idle",
        pending: null,
        waitRemaining: 0,
        timeoutHandle: null,
      };
      this.sessions.set(droneId, session);

      port.onMessage((msg) => {
        session!.pending = msg;
        this.clearTimeout(session!);
      });
      port.onError((err) => {
        session!.pending = { type: "error", message: err.message };
        this.clearTimeout(session!);
      });

      port.postMessage({
        type: "start",
        code,
        selfId: droneId,
        world: collectWorld(ctx.world, droneId, this.typeMap),
      });
      this.armTimeout(session, program);
      return;
    }

    // Driver-side ожидание drone.wait(seconds) — не требует похода в воркер.
    if (session.phase === "waiting") {
      session.waitRemaining -= DT;
      if (session.waitRemaining > 1e-9) return;
      session.phase = "idle";
      session.port.postMessage({
        type: "resume",
        world: collectWorld(ctx.world, droneId, this.typeMap),
      });
      this.armTimeout(session, program);
      return;
    }

    if (session.phase === "action-pending") {
      // Действие применено (program.state !== 'running'); ждём, пока системы
      // вернут state обратно в 'running'.
      if (program.state !== "running") return;
      session.phase = "idle";
      session.port.postMessage({
        type: "resume",
        world: collectWorld(ctx.world, droneId, this.typeMap),
      });
      this.armTimeout(session, program);
      return;
    }

    if (session.phase === "done") return;

    // phase === 'idle': проверяем, прислал ли воркер сообщение.
    const msg = session.pending;
    if (!msg) return;
    session.pending = null;

    switch (msg.type) {
      case "intent": {
        if (msg.action === "moveTo") {
          const movement = ctx.world.getComponent(droneId, "Movement")!;

          if (msg.point !== undefined) {
            // если уже двигались, то сначала доезжаем до конца, а потом уже меняем направление
            if (movement.progress !== 0) {
              extendPathTail(
                droneId,
                msg.point,
                ctx.world,
                ctx.grid,
                ctx.occupied,
              );
            } else {
              planMoveToPoint(
                droneId,
                msg.point,
                ctx.world,
                ctx.grid,
                ctx.occupied,
              );
            }
          }
          program.state = "move";
        } else if (msg.action === "mine") {
          program.state = "mine";
        } else if (msg.action === "drop") {
          program.state = "drop";
        } else if (msg.action === "charge") {
          program.state = "charge";
        }
        program.currentLine = msg.line;
        session.phase = "action-pending";
        return;
      }
      case "wait": {
        session.waitRemaining = msg.seconds;
        program.currentLine = msg.line;
        session.phase = "waiting";
        return;
      }
      case "finished": {
        session.phase = "done";
        program.state = "idle";
        program.currentLine = null;
        this.clearTimeout(session);
        session.port.terminate();
        return;
      }
      case "error": {
        session.phase = "done";
        program.state = "idle";
        program.codeError = msg.message;
        program.currentLine = null;
        this.clearTimeout(session);
        session.port.terminate();
        return;
      }
    }
  }

  dispose(droneId: EntityId): void {
    const session = this.sessions.get(droneId);
    if (!session) return;
    this.clearTimeout(session);
    session.port.terminate();
    this.sessions.delete(droneId);
  }

  disposeAll(): void {
    for (const droneId of [...this.sessions.keys()]) this.dispose(droneId);
  }

  private armTimeout(session: Session, program: ProgramComponent): void {
    this.clearTimeout(session);
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    session.timeoutHandle = setTimeout(() => {
      session.port.terminate();
      session.phase = "done";
      program.state = "idle";
      program.codeError = `code execution timeout (${timeoutMs}ms) — likely an infinite loop without await`;
      program.currentLine = null;
    }, timeoutMs);
  }

  private clearTimeout(session: Session): void {
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
      session.timeoutHandle = null;
    }
  }
}
