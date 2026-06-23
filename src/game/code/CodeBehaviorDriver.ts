import type { EntityId, WorldObjectType } from "../../shared/types/index.js";
import { DT } from "../simulation/constants.js";
import type { ProgramComponent } from "../simulation/components/Program.js";
import { planNextStep } from "../pathfinding/planMove.js";
import type { BehaviorDriver, BehaviorTickContext } from "./BehaviorDriver.js";
import type { CodeWorkerPort } from "./CodeWorkerPort.js";
import { collectWorld } from "./worldSnapshot.js";
import type { WorkerMessage } from "./types.js";
import { gameEvents } from "../../shared/events/gameEvents.js";
import type { World } from "../simulation/world/World.js";

// Бюджет на ответ воркера. Большой запас нужен из-за холодного старта в dev:
// первый запуск worker-модуля под Vite (компиляция + конкуренция с Monaco
// TS-воркером) может занять до нескольких секунд, хотя последующие ответы
// приходят за ~15ms.
const DEFAULT_TIMEOUT_MS = 10000;

type Phase = "idle" | "action-pending" | "waiting" | "done";

type LastAction = "moveTo" | "mine" | "drop" | "charge" | "wait" | null;

interface Session {
  port: CodeWorkerPort;
  phase: Phase;
  pending: WorkerMessage | null;
  waitRemaining: number;
  timeoutHandle: ReturnType<typeof setTimeout> | null;
  lastAction: LastAction;
  // Ссылка на world сохраняется при каждом step() для использования в
  // обработчике drone:moved (collectWorld нужен актуальный world).
  world: World | null;
  // Флаг: drone:blocked пришёл до drone:moved — не делаем ранний resume.
  blocked: boolean;
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
 *
 * Для moveTo ранний resume отправляется по событию drone:moved (~15ms после
 * завершения шага), что устраняет паузу в 1 тик между шагами движения.
 */
export class CodeBehaviorDriver implements BehaviorDriver {
  private readonly sessions = new Map<EntityId, Session>();
  private readonly typeMap: ReadonlyMap<EntityId, WorldObjectType>;

  private readonly onDroneMoved: (data: {
    droneId: EntityId;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  }) => void;

  private readonly onDroneBlocked: (data: { droneId: EntityId }) => void;

  constructor(private readonly options: CodeBehaviorDriverOptions) {
    this.typeMap = options.typeMap ?? new Map();

    this.onDroneMoved = ({ droneId }) => {
      const session = this.sessions.get(droneId);
      if (
        !session ||
        session.phase !== "action-pending" ||
        session.lastAction !== "moveTo" ||
        session.blocked ||
        !session.world
      )
        return;

      // moveTo = «умный шаг»: один шаг завершён (path пуст в момент события),
      // позиция обновлена. Шлём ранний resume сразу (~15ms) — воркер успевает
      // вернуть новый intent до конца следующего шага, дрон не тормозит.
      session.phase = "idle";
      session.port.postMessage({
        type: "resume",
        world: collectWorld(session.world, droneId, this.typeMap),
      });
      // Таймаут перевооружается через program, которого здесь нет —
      // он будет снят и перезаведён на следующем step() в idle-ветке.
    };

    this.onDroneBlocked = ({ droneId }) => {
      const session = this.sessions.get(droneId);
      if (!session || session.phase !== "action-pending") return;
      session.blocked = true;
    };

    gameEvents.on("drone:moved", this.onDroneMoved);
    gameEvents.on("drone:blocked", this.onDroneBlocked);
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
        lastAction: null,
        world: ctx.world,
        blocked: false,
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

    // Обновляем ссылку на world при каждом тике — нужна актуальная для drone:moved.
    session.world = ctx.world;

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
      // вернут state обратно в 'running'. Для moveTo resume уже мог быть
      // отправлен по drone:moved — в этом случае phase уже idle.
      if (program.state !== "running") return;
      session.phase = "idle";
      session.blocked = false;
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
          if (msg.point !== undefined) {
            // moveTo = ОДИН шаг: всегда планируем ровно следующую клетку к цели.
            // После шага path пустеет → MovementSystem вернёт state=running →
            // driver резолвит воркер → код игрока исполняет следующую строку
            // (может сменить цель/действие). Плавность обеспечивает ранний resume
            // на drone:moved: воркер успевает прислать следующий moveTo до конца
            // текущего шага. См. модель single-step в спеке continuous-movement.
            planNextStep(
              droneId,
              msg.point,
              ctx.world,
              ctx.grid,
              ctx.occupied,
            );
          }
          program.state = "move";
          session.lastAction = "moveTo";
        } else if (msg.action === "mine") {
          program.state = "mine";
          session.lastAction = "mine";
        } else if (msg.action === "drop") {
          program.state = "drop";
          session.lastAction = "drop";
        } else if (msg.action === "charge") {
          program.state = "charge";
          session.lastAction = "charge";
        }
        program.currentLine = msg.line;
        session.phase = "action-pending";
        session.blocked = false;
        return;
      }
      case "wait": {
        session.waitRemaining = msg.seconds;
        session.lastAction = "wait";
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
    gameEvents.off("drone:moved", this.onDroneMoved);
    gameEvents.off("drone:blocked", this.onDroneBlocked);
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
