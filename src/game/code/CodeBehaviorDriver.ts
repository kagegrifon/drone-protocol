import type { EntityId, WorldObjectType } from "../../shared/types/index.js";
import { gameEvents } from "../../shared/events/gameEvents.js";
import { DT } from "../simulation/constants.js";
import type { ProgramComponent } from "../simulation/components/Program.js";
import { extendPathTail, planMoveToPoint } from "../pathfinding/planMove.js";
import type { BehaviorDriver, BehaviorTickContext } from "./BehaviorDriver.js";
import type { CodeWorkerPort } from "./CodeWorkerPort.js";
import { collectWorld } from "./worldSnapshot.js";
import type { WorkerMessage } from "./types.js";
import { linkProgram, type LineMapSegment } from "./linker/linkProgram.js";
import { LinkError } from "./linker/errors.js";
import { mapStackToFrames, type StackFrame } from "./linker/mapLine.js";

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
  /** id entry-программы сессии — для маппинга строк через lineMap. */
  entryId: string;
  /** Карта строк склеенного кода → исходные программы (см. linkProgram). */
  lineMap: LineMapSegment[];
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
      if (activeDef?.behavior.sourceForm !== "code") return;
      // Новый запуск кода — сбрасываем ошибку предыдущего прогона.
      program.codeError = undefined;

      // Линкуем программу с её модулями на главном потоке. LinkError (цикл,
      // неизвестный импорт, отсутствующий экспорт…) выводим как codeError и не
      // стартуем воркер — ровно как существующий путь runtime-ошибки.
      let linked;
      try {
        linked = linkProgram(activeProgramId, ctx.registry);
      } catch (err) {
        if (err instanceof LinkError) {
          program.state = "idle";
          program.codeError = err.message;
          this.clearStack(program);
          return;
        }
        throw err;
      }

      const port = this.options.createPort();
      session = {
        port,
        phase: "idle",
        pending: null,
        waitRemaining: 0,
        timeoutHandle: null,
        entryId: activeProgramId,
        lineMap: linked.lineMap,
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
        code: linked.code,
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
      gameEvents.emit("drone:actionResumed", { droneId });
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
      gameEvents.emit("drone:actionResumed", { droneId });
      return;
    }

    if (session.phase === "done") return;

    // phase === 'idle': проверяем, прислал ли воркер сообщение.
    const msg = session.pending;
    if (!msg) return;
    session.pending = null;

    switch (msg.type) {
      case "intent": {
        const movement = ctx.world.getComponent(droneId, "Movement")!;
        // позволяем дрону дойти до конца начатое движение
        if (msg.action !== "moveTo") {
          movement.path.length = movement.path.length ? 1 : 0;
        }

        if (msg.action === "moveTo") {
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
        this.applyStack(session, program, msg.lineStack);
        session.phase = "action-pending";
        return;
      }
      case "wait": {
        session.waitRemaining = msg.seconds;
        this.applyStack(session, program, msg.lineStack);
        session.phase = "waiting";
        return;
      }
      case "finished": {
        session.phase = "done";
        program.state = "idle";
        this.clearStack(program);
        this.clearTimeout(session);
        session.port.terminate();
        return;
      }
      case "error": {
        session.phase = "done";
        program.state = "idle";
        program.codeError = msg.message;
        this.clearStack(program);
        this.clearTimeout(session);
        session.port.terminate();
        return;
      }
    }
  }

  /**
   * Заполняет program.codeStack полным стеком кадров (включая модульные) и
   * derived program.currentLine = строка самого глубокого кадра.
   */
  private applyStack(
    session: Session,
    program: ProgramComponent,
    lineStack: number[],
  ): void {
    const frames = mapStackToFrames({ lineStack, lineMap: session.lineMap });
    program.codeStack = frames;
    const deepestFrame: StackFrame | undefined = frames[frames.length - 1];
    program.currentLine = deepestFrame ? deepestFrame.line : null;
  }

  /** Сбрасывает стек и подсветку — нет активного действия. */
  private clearStack(program: ProgramComponent): void {
    program.codeStack = null;
    program.currentLine = null;
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
      this.clearStack(program);
    }, timeoutMs);
  }

  private clearTimeout(session: Session): void {
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
      session.timeoutHandle = null;
    }
  }
}
