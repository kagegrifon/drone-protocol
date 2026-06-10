import { describe, it, expect, beforeEach } from "vitest";
import { World } from "./World.js";
import { gameEvents } from "../../../shared/events/gameEvents.js";
import { initWorkSlotsIndex, getSlotRefAt } from "./workSlotsIndex.js";
import { slotsOf, freeSlotsCount, validateNoDroneOnSlot } from "./workSlots.js";
import type { EntityId } from "../../../shared/types/index.js";

function makeWorld() {
  return new World();
}

function makeStation(world: World, x: number, y: number): EntityId {
  const id = world.createEntity();
  world.addComponent(id, "Position", { x, y });
  world.addComponent(id, "WorkSlots", { slots: [{ x, y, occupiedBy: null }] });
  return id;
}

function makeDroneAt(world: World, x: number, y: number): EntityId {
  const id = world.createEntity();
  world.addComponent(id, "Position", { x, y });
  world.addComponent(id, "Movement", {
    targetX: x,
    targetY: y,
    path: [],
    progress: 0,
    speed: 1,
  });
  return id;
}

describe("workSlotsIndex — инициализация", () => {
  let world: World;

  beforeEach(() => {
    world = makeWorld();
    gameEvents.clearAll();
  });

  it("getSlotRefAt возвращает undefined до initWorkSlotsIndex", () => {
    makeStation(world, 3, 3);
    expect(getSlotRefAt(world, 3, 3)).toBeUndefined();
  });

  it("после init — getSlotRefAt находит слот по координатам", () => {
    const station = makeStation(world, 3, 3);
    initWorkSlotsIndex(world);
    const ref = getSlotRefAt(world, 3, 3);
    expect(ref).toBeDefined();
    expect(ref!.entityId).toBe(station);
    expect(ref!.slotIndex).toBe(0);
  });

  it("getSlotRefAt возвращает undefined для клетки без слота", () => {
    makeStation(world, 3, 3);
    initWorkSlotsIndex(world);
    expect(getSlotRefAt(world, 0, 0)).toBeUndefined();
  });
});

describe("workSlotsIndex — drone:moved обновляет occupiedBy", () => {
  let world: World;
  let station: EntityId;

  beforeEach(() => {
    world = makeWorld();
    gameEvents.clearAll();
    station = makeStation(world, 5, 5);
    initWorkSlotsIndex(world);
  });

  it("дрон заходит в слот → occupiedBy устанавливается", () => {
    const droneId = 42 as EntityId;
    gameEvents.emit("drone:moved", {
      droneId,
      fromX: 4,
      fromY: 5,
      toX: 5,
      toY: 5,
    });
    const ws = world.getComponent(station, "WorkSlots")!;
    expect(ws.slots[0].occupiedBy).toBe(droneId);
  });

  it("дрон уходит из слота → occupiedBy = null", () => {
    const droneId = 42 as EntityId;
    // Сначала заселяем
    world.getComponent(station, "WorkSlots")!.slots[0].occupiedBy = droneId;
    // Эмитируем уход
    gameEvents.emit("drone:moved", {
      droneId,
      fromX: 5,
      fromY: 5,
      toX: 6,
      toY: 5,
    });
    const ws = world.getComponent(station, "WorkSlots")!;
    expect(ws.slots[0].occupiedBy).toBeNull();
  });

  it("чужой дрон не вытесняет уже занятый слот", () => {
    const drone1 = 10 as EntityId;
    const drone2 = 20 as EntityId;
    world.getComponent(station, "WorkSlots")!.slots[0].occupiedBy = drone1;
    gameEvents.emit("drone:moved", {
      droneId: drone2,
      fromX: 4,
      fromY: 5,
      toX: 5,
      toY: 5,
    });
    const ws = world.getComponent(station, "WorkSlots")!;
    expect(ws.slots[0].occupiedBy).toBe(drone1); // не изменился
  });

  it("движение дрона вне слотов не меняет occupiedBy", () => {
    gameEvents.emit("drone:moved", {
      droneId: 99 as EntityId,
      fromX: 0,
      fromY: 0,
      toX: 1,
      toY: 0,
    });
    const ws = world.getComponent(station, "WorkSlots")!;
    expect(ws.slots[0].occupiedBy).toBeNull(); // без изменений
  });
});

describe("workSlotsIndex — entity:removed очищает occupiedBy", () => {
  let world: World;
  let station: EntityId;

  beforeEach(() => {
    world = makeWorld();
    gameEvents.clearAll();
    station = makeStation(world, 5, 5);
    initWorkSlotsIndex(world);
  });

  it("удаление дрона из слота → occupiedBy = null", () => {
    const drone = makeDroneAt(world, 5, 5);
    world.getComponent(station, "WorkSlots")!.slots[0].occupiedBy = drone;
    world.destroyEntity(drone); // emit entity:removed happens inside
    const ws = world.getComponent(station, "WorkSlots")!;
    expect(ws.slots[0].occupiedBy).toBeNull();
  });
});

describe("slotsOf", () => {
  it("возвращает слоты сущности", () => {
    const world = makeWorld();
    const station = makeStation(world, 2, 3);
    const slots = slotsOf(world, station);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ x: 2, y: 3, occupiedBy: null });
  });

  it("возвращает пустой массив для сущности без WorkSlots", () => {
    const world = makeWorld();
    const entity = world.createEntity();
    expect(slotsOf(world, entity)).toEqual([]);
  });
});

describe("freeSlotsCount", () => {
  it("возвращает 1 для незанятого слота", () => {
    const world = makeWorld();
    const station = makeStation(world, 1, 1);
    expect(freeSlotsCount(world, station)).toBe(1);
  });

  it("возвращает 0 для занятого слота", () => {
    const world = makeWorld();
    const station = makeStation(world, 1, 1);
    world.getComponent(station, "WorkSlots")!.slots[0].occupiedBy =
      99 as EntityId;
    expect(freeSlotsCount(world, station)).toBe(0);
  });

  it("возвращает 0 для сущности без WorkSlots", () => {
    const world = makeWorld();
    const entity = world.createEntity();
    expect(freeSlotsCount(world, entity)).toBe(0);
  });
});

describe("validateNoDroneOnSlot", () => {
  it("не бросает ошибку если дроны не на слотах", () => {
    const world = makeWorld();
    gameEvents.clearAll();
    makeStation(world, 5, 5);
    makeDroneAt(world, 1, 1);
    initWorkSlotsIndex(world);
    expect(() => validateNoDroneOnSlot(world)).not.toThrow();
  });

  it("бросает Error если дрон стоит на слоте", () => {
    const world = makeWorld();
    gameEvents.clearAll();
    makeStation(world, 3, 3);
    makeDroneAt(world, 3, 3); // на позиции слота!
    initWorkSlotsIndex(world);
    expect(() => validateNoDroneOnSlot(world)).toThrow(/Mission setup error/);
    expect(() => validateNoDroneOnSlot(world)).toThrow(/3, 3/);
  });
});
