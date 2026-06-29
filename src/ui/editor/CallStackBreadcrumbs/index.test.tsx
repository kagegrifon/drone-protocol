// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { expect, test, vi, afterEach } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import { CallStackBreadcrumbs } from "./index.js";
import type { StackFrame } from "../../../game/code/linker/mapLine.js";
import type { ProgramRegistry, ProgramDef } from "../../../game/programs/types.js";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

function program(id: string, name: string): ProgramDef {
  return { id, name, behavior: { sourceForm: "code", code: "" } };
}

function makeRegistry(...defs: ProgramDef[]): ProgramRegistry {
  return new Map(defs.map((def) => [def.id, def]));
}

test("рендерит по одной крошке на кадр", () => {
  const frames: StackFrame[] = [
    { programId: "harvest", line: 5 },
    { programId: "moveTo", line: 2 },
  ];
  const registry = makeRegistry(
    program("harvest", "harvest"),
    program("moveTo", "moveTo"),
  );

  render(
    <CallStackBreadcrumbs
      frames={frames}
      selectedIndex={null}
      onSelectFrame={vi.fn()}
      registry={registry}
    />,
  );

  expect(screen.getByTestId("callstack-crumb-0")).toBeInTheDocument();
  expect(screen.getByTestId("callstack-crumb-1")).toBeInTheDocument();
  expect(screen.queryByTestId("callstack-crumb-2")).not.toBeInTheDocument();
});

test("крошка показывает имя программы и строку в формате имя:строка", () => {
  const frames: StackFrame[] = [{ programId: "harvest", line: 5 }];
  const registry = makeRegistry(program("harvest", "harvest"));

  render(
    <CallStackBreadcrumbs
      frames={frames}
      selectedIndex={null}
      onSelectFrame={vi.fn()}
      registry={registry}
    />,
  );

  expect(screen.getByTestId("callstack-crumb-0").textContent).toContain(
    "harvest:5",
  );
});

test("неизвестный programId не ломает рендер (fallback на id)", () => {
  const frames: StackFrame[] = [{ programId: "ghost", line: 3 }];
  const registry = makeRegistry();

  render(
    <CallStackBreadcrumbs
      frames={frames}
      selectedIndex={null}
      onSelectFrame={vi.fn()}
      registry={registry}
    />,
  );

  expect(screen.getByTestId("callstack-crumb-0").textContent).toContain(
    "ghost:3",
  );
});

test("клик по крошке вызывает onSelectFrame с её индексом", () => {
  const frames: StackFrame[] = [
    { programId: "harvest", line: 5 },
    { programId: "moveTo", line: 2 },
  ];
  const registry = makeRegistry(
    program("harvest", "harvest"),
    program("moveTo", "moveTo"),
  );
  const onSelectFrame = vi.fn();

  render(
    <CallStackBreadcrumbs
      frames={frames}
      selectedIndex={null}
      onSelectFrame={onSelectFrame}
      registry={registry}
    />,
  );

  fireEvent.click(screen.getByTestId("callstack-crumb-0"));

  expect(onSelectFrame).toHaveBeenCalledWith(0);
});

test("при selectedIndex=null самый глубокий кадр помечен активным (aria-current)", () => {
  const frames: StackFrame[] = [
    { programId: "harvest", line: 5 },
    { programId: "moveTo", line: 2 },
  ];
  const registry = makeRegistry(
    program("harvest", "harvest"),
    program("moveTo", "moveTo"),
  );

  render(
    <CallStackBreadcrumbs
      frames={frames}
      selectedIndex={null}
      onSelectFrame={vi.fn()}
      registry={registry}
    />,
  );

  // follow → активен последний (самый глубокий) кадр
  expect(screen.getByTestId("callstack-crumb-1")).toHaveAttribute(
    "aria-current",
    "true",
  );
  expect(screen.getByTestId("callstack-crumb-0")).not.toHaveAttribute(
    "aria-current",
    "true",
  );
});

test("при заданном selectedIndex выбранный кадр помечен (aria-selected)", () => {
  const frames: StackFrame[] = [
    { programId: "harvest", line: 5 },
    { programId: "moveTo", line: 2 },
  ];
  const registry = makeRegistry(
    program("harvest", "harvest"),
    program("moveTo", "moveTo"),
  );

  render(
    <CallStackBreadcrumbs
      frames={frames}
      selectedIndex={0}
      onSelectFrame={vi.fn()}
      registry={registry}
    />,
  );

  expect(screen.getByTestId("callstack-crumb-0")).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("контейнер имеет testid callstack-breadcrumbs", () => {
  const frames: StackFrame[] = [{ programId: "harvest", line: 5 }];
  const registry = makeRegistry(program("harvest", "harvest"));

  render(
    <CallStackBreadcrumbs
      frames={frames}
      selectedIndex={null}
      onSelectFrame={vi.fn()}
      registry={registry}
    />,
  );

  expect(screen.getByTestId("callstack-breadcrumbs")).toBeInTheDocument();
});
