import { useGameStore } from "../../../shared/store/gameStore.js";
import type { BuildingState } from "../../../shared/store/gameStore.js";
import { Row } from "./Row.js";
import { CopyableValue } from "./CopyableValue.js";
import { MONO } from "./styles.js";

function BuildingRows({ building }: { building: BuildingState }) {
  return (
    <>
      <Row label="REF">
        <CopyableValue
          testId="cell-inspector-ref"
          copyTestId="cell-inspector-ref-copy"
          color="#4488ff"
          text={building.ref}
          copyText={building.ref}
          title="Скопировать ссылку"
        />
      </Row>
      {building.type === "mine" && (
        <Row label="ORE">
          <span
            data-testid="cell-inspector-ore"
            style={{ ...MONO, color: "#00ff88" }}
          >
            {building.oreRemaining}
          </span>
        </Row>
      )}
    </>
  );
}

export function CellInspector({ cell }: { cell: { x: number; y: number } }) {
  const buildings = useGameStore((s) => s.buildings);
  const building = buildings.find((b) => b.x === cell.x && b.y === cell.y);

  return (
    <div data-testid="cell-inspector" style={{ padding: "12px" }}>
      <div
        style={{
          color: "#c0cfe0",
          fontFamily: "monospace",
          fontSize: "13px",
          marginBottom: "12px",
          borderBottom: "1px solid #1e3a5f",
          paddingBottom: "8px",
        }}
      >
        Cell
      </div>

      <Row label="POS">
        <CopyableValue
          testId="cell-inspector-pos"
          copyTestId="cell-inspector-copy"
          color="#00d4ff"
          text={`x: ${cell.x} y: ${cell.y}`}
          copyText={`{ x: ${cell.x}, y: ${cell.y} }`}
          title="Скопировать координаты"
        />
      </Row>

      {building && <BuildingRows building={building} />}
    </div>
  );
}
