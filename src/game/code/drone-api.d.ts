/**
 * Контракт API, доступного коду игрока в Code Mode. Используется как:
 * - документация рантайма (codeRuntime реализует этот контракт);
 * - источник подсказок (автодополнение) для Monaco.
 *
 * Управляемый дрон — `self`. Мир — `World` (множества по типам сущностей).
 * У каждой сущности есть `id`, `type`, `position` и метод `distanceTo`.
 * `moveTo(point)` только перемещает; добыча/разгрузка/зарядка — отдельные
 * команды mine()/drop()/charge(), срабатывающие на клетке объекта.
 *
 * Примеры:
 *
 *   // 1. Базовый цикл: добыть полный трюм и отвезти на базу
 *   while (true) {
 *     const mine = World.mines[0];
 *     await self.moveTo(mine.position);           // встаём на клетку шахты
 *     while (self.inventory < self.inventoryMax && mine.oreRemaining > 0) {
 *       await self.mine();                        // по 1 руде за вызов
 *     }
 *     const base = World.bases[0];
 *     await self.moveTo(base.position);
 *     while (self.inventory > 0) {
 *       await self.drop();                        // пока трюм не пуст
 *     }
 *   }
 *
 *   // 2. Ближайшая непустая шахта + зарядка по необходимости
 *   while (true) {
 *     if (self.energy < 30) {
 *       const charger = self.findClosest(World.chargers);
 *       await self.moveTo(charger.position);
 *       while (self.energy < self.energyMax) {
 *         await self.charge();
 *       }
 *       continue;
 *     }
 *     const mine = self.findClosest(World.mines.filter((m) => m.oreRemaining > 0));
 *     if (!mine) break;
 *     await self.moveTo(mine.position);
 *     await self.mine();
 *   }
 *
 *   // 3. Расстояния и координаты
 *   const mine = World.mines[0];
 *   const d = self.distanceTo(mine);              // Manhattan
 *   const p = self.position;                      // { x, y }
 *   await self.moveTo({ x: p.x + 1, y: p.y });    // движение в произвольную точку
 */

interface Position {
  x: number;
  y: number;
}

interface Entity {
  readonly id: number;
  readonly type: "mine" | "charger" | "base" | "drone";
  /** Текущая позиция сущности на сетке (снапшот на начало тика). */
  readonly position: Position;
  /** Manhattan-расстояние до другой сущности или точки. */
  distanceTo(other: Entity | Position): number;
}

interface MineEntity extends Entity {
  readonly type: "mine";
  readonly oreRemaining: number;
  readonly freeSlots: number;
}

interface ChargerEntity extends Entity {
  readonly type: "charger";
  readonly freeSlots: number;
}

interface BaseEntity extends Entity {
  readonly type: "base";
  readonly freeSlots: number;
  readonly storedOre: number;
}

interface DroneEntity extends Entity {
  readonly type: "drone";
  readonly energy: number;
  readonly energyMax: number;
  readonly inventory: number;
  readonly inventoryMax: number;
}

interface DroneApi extends DroneEntity {
  /**
   * Доехать до точки (A*). Только перемещает — НЕ майнит и НЕ разгружает.
   * Чтобы майнить/разгружать/заряжаться, после moveTo вызови mine()/drop()/charge(),
   * стоя на клетке объекта: `await self.moveTo(mine.position); await self.mine();`
   */
  moveTo(point: Position): Promise<void>;
  /** Добыть 1 руду. Работает только если self стоит на клетке шахты. */
  mine(): Promise<void>;
  /** Выгрузить 1 руду. Работает только на клетке базы. */
  drop(): Promise<void>;
  /** Зарядиться. Работает только на клетке зарядки. */
  charge(): Promise<void>;
  /** Подождать N секунд игрового времени. */
  wait(seconds: number): Promise<void>;
  /** Ближайшая (по Manhattan) сущность из списка или null, если список пуст. */
  findClosest<T extends Entity>(list: readonly T[]): T | null;
}

interface WorldApi {
  readonly mines: MineEntity[];
  readonly chargers: ChargerEntity[];
  readonly bases: BaseEntity[];
  /** Все дроны мира, включая self. */
  readonly drones: DroneEntity[];
}

/** Текущий управляемый дрон. */
declare const self: DroneApi;
/** Мир: множества сущностей по типам. */
declare const World: WorldApi;
