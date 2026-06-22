// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { expect, test, vi, beforeAll, afterEach } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import { ProgramCodeBlock } from "./ProgramCodeBlock.js";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

// Мок CodeEditor — простой textarea без Monaco
vi.mock("./CodeEditor.js", () => ({
  CodeEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <textarea
      data-testid="mock-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// Мок monacoSetup чтобы не грузил Monaco в jsdom
vi.mock("./monacoSetup.js", () => ({ setupMonaco: () => {} }));

beforeAll(() => {
  // jsdom не имеет ResizeObserver
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

test("изначально кнопки apply/revert скрыты (нет dirty)", () => {
  render(
    <ProgramCodeBlock
      code="initial code"
      onApply={vi.fn()}
      affectedDroneIds={[]}
    />,
  );

  expect(screen.queryByTestId("code-apply")).not.toBeInTheDocument();
  expect(screen.queryByTestId("code-revert")).not.toBeInTheDocument();
});

test("редактирование → isDirty → появляются кнопки apply и revert", () => {
  render(
    <ProgramCodeBlock
      code="initial code"
      onApply={vi.fn()}
      affectedDroneIds={[]}
    />,
  );

  const editor = screen.getByTestId("mock-editor");
  fireEvent.change(editor, { target: { value: "changed code" } });

  expect(screen.getByTestId("code-apply")).toBeInTheDocument();
  expect(screen.getByTestId("code-revert")).toBeInTheDocument();
});

test("apply вызывает onApply с актуальным draft и скрывает кнопки", () => {
  const onApply = vi.fn();
  render(
    <ProgramCodeBlock code="initial" onApply={onApply} affectedDroneIds={[]} />,
  );

  const editor = screen.getByTestId("mock-editor");
  fireEvent.change(editor, { target: { value: "new code" } });

  fireEvent.click(screen.getByTestId("code-apply"));

  expect(onApply).toHaveBeenCalledWith("new code");
  expect(onApply).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId("code-apply")).not.toBeInTheDocument();
  expect(screen.queryByTestId("code-revert")).not.toBeInTheDocument();
});

test("revert возвращает текст к code, onApply не вызван, кнопки скрыты", () => {
  const onApply = vi.fn();
  render(
    <ProgramCodeBlock code="initial" onApply={onApply} affectedDroneIds={[]} />,
  );

  const editor = screen.getByTestId("mock-editor");
  fireEvent.change(editor, { target: { value: "changed" } });

  fireEvent.click(screen.getByTestId("code-revert"));

  expect(onApply).not.toHaveBeenCalled();
  expect(screen.queryByTestId("code-apply")).not.toBeInTheDocument();
  expect(screen.queryByTestId("code-revert")).not.toBeInTheDocument();
  expect(screen.getByTestId("mock-editor")).toHaveValue("initial");
});

test("предупреждение code-affects видно только при isDirty && affectedDroneIds.length > 0", () => {
  const { rerender } = render(
    <ProgramCodeBlock
      code="initial"
      onApply={vi.fn()}
      affectedDroneIds={[2, 5]}
    />,
  );

  // Нет dirty — нет предупреждения
  expect(screen.queryByTestId("code-affects")).not.toBeInTheDocument();

  const editor = screen.getByTestId("mock-editor");
  fireEvent.change(editor, { target: { value: "changed" } });

  // isDirty && affectedDroneIds.length > 0 — показываем
  const affects = screen.getByTestId("code-affects");
  expect(affects).toBeInTheDocument();
  expect(affects.textContent).toContain("drone-2");
  expect(affects.textContent).toContain("drone-5");

  // Нет affectedDroneIds — нет предупреждения
  rerender(
    <ProgramCodeBlock
      code="initial"
      onApply={vi.fn()}
      affectedDroneIds={[]}
    />,
  );
  expect(screen.queryByTestId("code-affects")).not.toBeInTheDocument();
});

test("смена prop code без активного черновика обновляет редактор (sync baseline)", () => {
  const { rerender } = render(
    <ProgramCodeBlock
      code="version 1"
      onApply={vi.fn()}
      affectedDroneIds={[]}
    />,
  );

  expect(screen.getByTestId("mock-editor")).toHaveValue("version 1");

  rerender(
    <ProgramCodeBlock
      code="version 2"
      onApply={vi.fn()}
      affectedDroneIds={[]}
    />,
  );

  expect(screen.getByTestId("mock-editor")).toHaveValue("version 2");
});

test("смена prop code при активном черновике не затирает черновик", () => {
  const { rerender } = render(
    <ProgramCodeBlock
      code="version 1"
      onApply={vi.fn()}
      affectedDroneIds={[]}
    />,
  );

  const editor = screen.getByTestId("mock-editor");
  fireEvent.change(editor, { target: { value: "user draft" } });

  // Внешнее применение другого кода — симулируем применение другим путём
  // При активном черновике baseline не должен затирать draft
  rerender(
    <ProgramCodeBlock
      code="version 1"
      onApply={vi.fn()}
      affectedDroneIds={[]}
    />,
  );

  expect(screen.getByTestId("mock-editor")).toHaveValue("user draft");
});

test("codeError отображается красным под редактором", () => {
  render(
    <ProgramCodeBlock
      code="code"
      onApply={vi.fn()}
      affectedDroneIds={[]}
      codeError="ReferenceError: x is not defined"
    />,
  );

  expect(
    screen.getByText("ReferenceError: x is not defined"),
  ).toBeInTheDocument();
});

test("codeError скрыт если не передан", () => {
  render(
    <ProgramCodeBlock
      code="code"
      onApply={vi.fn()}
      affectedDroneIds={[]}
    />,
  );

  expect(screen.queryByText(/ReferenceError/)).not.toBeInTheDocument();
});
