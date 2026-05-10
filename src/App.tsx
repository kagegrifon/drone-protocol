import { useEffect, useRef, useState } from 'react';
import { GameController } from './game/GameController.js';
import { ALL_MISSIONS } from './game/missions/index.js';
import { useGameStore } from './shared/store/gameStore.js';
import { SimControls } from './ui/controls/SimControls.js';
import { DroneList } from './ui/panels/DroneList.js';
import { DroneInspector } from './ui/panels/DroneInspector/index.js';
import { ProgramEditor } from './ui/editor/ProgramEditor/index.js';
import { StatsPanel } from './ui/panels/StatsPanel/index.js';
import { MissionGoalPanel } from './ui/panels/MissionGoalPanel.js';
import { GameStatusOverlay } from './ui/overlays/GameStatusOverlay.js';
import { MissionSelectOverlay } from './ui/overlays/MissionSelectOverlay.js';
import type { EntityId } from './shared/types/index.js';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<GameController | null>(null);
  const entityIdsRef = useRef<EntityId[]>([]);
  const selectDrone = useGameStore((s) => s.selectDrone);
  const [missionIndex, setMissionIndex] = useState<number | null>(null);

  const currentMission = missionIndex !== null ? ALL_MISSIONS[missionIndex] : null;
  const isLastMission = missionIndex !== null && missionIndex === ALL_MISSIONS.length - 1;

  useEffect(() => {
    if (!containerRef.current || missionIndex === null) return;

    controllerRef.current?.destroy();
    const ctrl = new GameController(ALL_MISSIONS[missionIndex]);
    ctrl.setup(containerRef.current, (id) => selectDrone(id));
    entityIdsRef.current = ctrl.entityIds;
    controllerRef.current = ctrl;

    return () => ctrl.destroy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionIndex]);

  return (
    <div style={{ display: 'flex', background: '#050810', minHeight: '100vh', color: '#c0cfe0' }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', position: 'relative' }}>
        <div ref={containerRef} />
        {missionIndex === null && (
          <MissionSelectOverlay missions={ALL_MISSIONS} onSelect={setMissionIndex} />
        )}
        {missionIndex !== null && (
          <GameStatusOverlay
            onReset={() => controllerRef.current?.reset()}
            onNextMission={() => setMissionIndex((i) => (i !== null && i < ALL_MISSIONS.length - 1 ? i + 1 : i))}
            isLastMission={isLastMission}
          />
        )}
      </div>

      <div style={{ width: '340px', minWidth: '340px', background: '#0a0e1a', borderLeft: '1px solid #1e3a5f', display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>
        <SimControls
          onPlay={() => controllerRef.current?.start()}
          onPause={() => controllerRef.current?.pause()}
          onStep={() => controllerRef.current?.step()}
        />
        {currentMission && <MissionGoalPanel mission={currentMission} />}
        <SectionLabel label="DRONES" />
        <DroneList />
        <SectionLabel label="INSPECTOR" />
        <DroneInspector />
        <SectionLabel label="PROGRAM" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '200px' }}>
          <ProgramEditor entityIds={entityIdsRef.current} />
        </div>
        <SectionLabel label="STATS" />
        <StatsPanel />
      </div>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ background: '#060d1a', borderTop: '1px solid #1e3a5f', borderBottom: '1px solid #1e3a5f', padding: '3px 12px', color: '#2a4a6a', fontFamily: 'monospace', fontSize: '10px', letterSpacing: '2px' }}>
      {label}
    </div>
  );
}
