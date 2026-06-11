/**
 * Контракт API, доступного коду игрока в Code Mode. Используется как:
 * - документация рантайма (codeRuntime реализует этот контракт);
 * - (этап 2) источник подсказок для Monaco.
 */

/** Идентификатор сущности симуляции (дрон, залежь руды, станция и т.п.). */
type EntityRef = number;

interface DroneApi {
  /** Идентификатор самого дрона. */
  readonly self: EntityRef;

  /** Текущий заряд энергии (снапшот на начало тика). */
  readonly energy: number;
  /** Максимальный заряд энергии. */
  readonly energyMax: number;
  /** Текущее количество руды в трюме (снапшот на начало тика). */
  readonly inventory: number;
  /** Вместимость трюма. */
  readonly inventoryMax: number;
  /** Свободные слоты на целевой станции/залежи (снапшот на начало тика). */
  readonly freeSlots: number;

  /** Доехать до сущности (астар, как в блоке MOVE_TO). Резолвится по прибытии. */
  moveTo(target: EntityRef): Promise<void>;
  /** Добыть руду (один тик добычи, как в блоке MINE). */
  mine(): Promise<void>;
  /** Выгрузить руду (как в блоке DROP). */
  drop(): Promise<void>;
  /** Зарядиться (как в блоке CHARGE). */
  charge(): Promise<void>;
  /** Подождать N секунд игрового времени (как в блоке WAIT). */
  wait(seconds: number): Promise<void>;
}

/** Manhattan-расстояние между двумя сущностями (снапшот на начало тика). */
declare function distance(a: EntityRef, b: EntityRef): number;
/** Остаток руды в залежи (снапшот на начало тика). */
declare function deposit(target: EntityRef): number;

declare const drone: DroneApi;

export {};
