import React from "react";
import { useGameStore } from "../../../shared/store/gameStore.js";
import { useGameController } from "../../controls/GameControllerContext.js";
import type { EntityId } from "../../../shared/types/index.js";

const PANEL: React.CSSProperties = {
  display: "flex",
  gap: "6px",
  alignItems: "center",
  background: "#1a0d05",
  border: "1px solid #5a3a1f",
  borderRadius: "4px",
  padding: "6px 8px",
  marginBottom: "8px",
};

const LABEL: React.CSSProperties = {
  color: "#ff7a1a",
  fontFamily: "monospace",
  fontSize: "10px",
  letterSpacing: "1px",
  marginRight: "4px",
};

const STEP_BTN: React.CSSProperties = {
  background: "#0a1628",
  border: "1px solid #5a3a1f",
  color: "#ff7a1a",
  fontFamily: "monospace",
  fontSize: "11px",
  padding: "4px 10px",
  cursor: "pointer",
  borderRadius: "3px",
};

const STEP_BTN_PRIMARY: React.CSSProperties = {
  ...STEP_BTN,
  background: "#ff7a1a",
  color: "#1a0d00",
  border: "1px solid #ff7a1a",
  fontWeight: "bold",
};

interface StepControlsProps {
  droneId: EntityId;
}

/** Полоса управления Step-режимом над хлебными крошками DRONE-таба. */
export function StepControls({ droneId }: StepControlsProps) {
  const controller = useGameController();
  const setStepMode = useGameStore((s) => s.setStepMode);

  const stepAction = () => controller?.stepDroneAction(droneId);
  const stepTick = () => controller?.step();
  const continueRun = () => {
    setStepMode(false);
    controller?.start();
  };

  return (
    <div style={PANEL} data-testid="step-controls">
      <span style={LABEL}>STEP</span>
      <button style={STEP_BTN_PRIMARY} onClick={stepAction} data-testid="step-action-btn">
        ⤵ Step action
      </button>
      <button style={STEP_BTN} onClick={stepTick} data-testid="step-tick-btn">
        → Step tick
      </button>
      <button style={STEP_BTN} onClick={continueRun} data-testid="step-continue-btn">
        ▶ Continue
      </button>
    </div>
  );
}
