import type { EntityId } from "../../shared/types/index.js";
import { DT } from "../simulation/constants.js";
import type { ProgramComponent } from "../simulation/components/Program.js";
import { planAstarMove } from "../programs/interpreter.js";
import type { BehaviorDriver, BehaviorTickContext } from "./BehaviorDriver.js";
import type { CodeWorkerPort } from "./CodeWorkerPort.js";
import { collectSensors } from "./sensors.js";
import type { WorkerMessage } from "./types.js";

const DEFAULT_TIMEOUT_MS = 1000;

type Phase = "idle" | "action-pending" | "waiting" | "done";

interface Session {
  port: CodeWorkerPort;
  phase: Phase;
  pending: WorkerMessage | null;
  waitRemaining: number;
  timeoutHandle: ReturnType<typeof setTimeout> | null;
  entities: Record<string, EntityId>;
}

export interface CodeBehaviorDriverOptions {
  createPort: () => CodeWorkerPort;
  timeoutMs?: number;
  /** Именованные сущности, доступные коду игрока как глобальные переменные. */
  entities?: (droneId: EntityId, ctx: BehaviorTickContext) => Record<string, EntityId>;
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

  constructor(private readonly options: CodeBehaviorDriverOptions) {}

  step(droneId: EntityId, ctx: BehaviorTickContext): void {
    const program = ctx.world.getComponent(droneId, "Program");
    if (!program) return;

    let session = this.sessions.get(droneId);

    if (!session) {
      const activeProgramId =
        program.currentProgramId ?? program.personalProgramId;
      const code = ctx.registry.get(activeProgramId)?.codeSource;
      if (!code) return;
      const entities = this.options.entities?.(droneId, ctx) ?? {};
      const port = this.options.createPort();
      session = {
        port,
        phase: "idle",
        pending: null,
        waitRemaining: 0,
        timeoutHandle: null,
        entities,
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
        entities,
        sensors: collectSensors(ctx.world, droneId, entities),
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
        sensors: collectSensors(ctx.world, droneId, session.entities),
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
        sensors: collectSensors(ctx.world, droneId, session.entities),
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
          if (msg.targetId !== undefined) {
            planAstarMove(droneId, msg.targetId, ctx.world, ctx.grid, ctx.occupied);
          }
          program.state = "move";
        } else if (msg.action === "mine") {
          program.state = "mine";
        } else if (msg.action === "drop") {
          program.state = "drop";
        } else if (msg.action === "charge") {
          program.state = "charge";
        }
        session.phase = "action-pending";
        return;
      }
      case "wait": {
        session.waitRemaining = msg.seconds;
        session.phase = "waiting";
        return;
      }
      case "finished": {
        session.phase = "done";
        program.state = "idle";
        this.clearTimeout(session);
        session.port.terminate();
        return;
      }
      case "error": {
        session.phase = "done";
        program.state = "idle";
        program.codeError = msg.message;
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
    }, timeoutMs);
  }

  private clearTimeout(session: Session): void {
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
      session.timeoutHandle = null;
    }
  }
}
