import { describe, it, expect } from "vitest";
import { Grid } from "./Grid.js";

describe("Grid constructor", () => {
  it("создаёт поле 30×30 при вызове без аргументов", () => {
    const g = new Grid();
    expect(g.width).toBe(30);
    expect(g.height).toBe(30);
  });

  it("создаёт поле с явными размерами 40×50", () => {
    const g = new Grid(40, 50);
    expect(g.width).toBe(40);
    expect(g.height).toBe(50);
  });

  it("выбрасывает Error при width < 30", () => {
    expect(() => new Grid(20, 30)).toThrow("Grid size must be at least 30×30");
  });

  it("выбрасывает Error при height < 30", () => {
    expect(() => new Grid(30, 20)).toThrow("Grid size must be at least 30×30");
  });

  it("выбрасывает Error при обоих размерах < 30", () => {
    expect(() => new Grid(10, 10)).toThrow("Grid size must be at least 30×30");
  });
});

describe("Grid tile access", () => {
  it("возвращает wall за пределами поля", () => {
    const g = new Grid(30, 30);
    expect(g.getTile(-1, 0)).toBe("wall");
    expect(g.getTile(0, -1)).toBe("wall");
    expect(g.getTile(30, 0)).toBe("wall");
    expect(g.getTile(0, 30)).toBe("wall");
  });

  it("getTile работает в крайних валидных координатах", () => {
    const g = new Grid(30, 30);
    g.setTile(29, 29, "mine");
    expect(g.getTile(29, 29)).toBe("mine");
  });

  it("инициализирует все клетки как empty", () => {
    const g = new Grid(30, 30);
    expect(g.getTile(0, 0)).toBe("empty");
    expect(g.getTile(15, 15)).toBe("empty");
  });

  it("isWalkable возвращает false для wall", () => {
    const g = new Grid(30, 30);
    expect(g.isWalkable(-1, 0)).toBe(false);
    expect(g.isWalkable(30, 0)).toBe(false);
  });

  it("isWalkable возвращает true для non-wall клеток", () => {
    const g = new Grid(30, 30);
    expect(g.isWalkable(0, 0)).toBe(true);
    g.setTile(10, 10, "mine");
    expect(g.isWalkable(10, 10)).toBe(true);
  });

  it("setTile игнорирует записи за пределами поля", () => {
    const g = new Grid(30, 30);
    g.setTile(-1, 0, "mine");
    expect(g.getTile(-1, 0)).toBe("wall");
    g.setTile(30, 15, "mine");
    expect(g.getTile(30, 15)).toBe("wall");
  });
});

describe("Grid.neighbours", () => {
  it("угловая клетка 0,0 имеет 2 соседа", () => {
    const g = new Grid(30, 30);
    expect(g.neighbours(0, 0)).toHaveLength(2);
  });

  it("центральная клетка имеет 4 соседа", () => {
    const g = new Grid(30, 30);
    expect(g.neighbours(15, 15)).toHaveLength(4);
  });
});
