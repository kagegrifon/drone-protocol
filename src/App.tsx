import { useEffect, useRef } from 'react';
import { GameController } from './game/GameController.js';
import { useGameStore } from './shared/store/gameStore.js';
import { SimControls } from './ui/controls/SimControls.js';
import { DroneList } from './ui/panels/DroneList.js';
import { DroneInspector } from './ui/panels/DroneInspector/index.js';
import { ProgramEditor } from './ui/editor/ProgramEditor/index.js';
import { StatsPanel } from './ui/panels/StatsPanel/index.js';
import { GameStatusOverlay } from './ui/overlays/GameStatusOverlay.js';
import type { EntityId } from './shared/types/index.js';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<GameController | null>(null);
  const entityIdsRef = useRef<EntityId[]>([]);
  const selectDrone = useGameStore((s) => s.selectDrone);

  useEffect(() => {
    if (!containerRef.current) return;

    const controller = new GameController({
      win: { type: 'ore_mined', target: 100 },
      fail: { type: 'time_limit', maxTicks: 600 },
    });
    controller.setup(containerRef.current, (id) => selectDrone(id));
    entityIdsRef.current = controller.entityIds;
    controllerRef.current = controller;

    return () => controller.destroy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: 'flex', background: '#050810', minHeight: '100vh', color: '#c0cfe0' }}>
      {/* Canvas area */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '16px',
        position: 'relative',
      }}>
        <div ref={containerRef} />
        <GameStatusOverlay onReset={() => controllerRef.current?.reset()} />
      </div>

      {/* Sidebar */}
      <div style={{
        width: '340px',
        minWidth: '340px',
        background: '#0a0e1a',
        borderLeft: '1px solid #1e3a5f',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflowY: 'auto',
      }}>
        <SimControls
          onPlay={() => controllerRef.current?.start()}
          onPause={() => controllerRef.current?.pause()}
          onStep={() => controllerRef.current?.step()}
        />

        <SectionDivider label="DRONES" />
        <DroneList />

        <SectionDivider label="INSPECTOR" />
        <DroneInspector />

        <SectionDivider label="PROGRAM" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '200px' }}>
          <ProgramEditor entityIds={entityIdsRef.current} />
        </div>

        <SectionDivider label="STATS" />
        <StatsPanel />
      </div>
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{
      background: '#060d1a',
      borderTop: '1px solid #1e3a5f',
      borderBottom: '1px solid #1e3a5f',
      padding: '3px 12px',
      color: '#2a4a6a',
      fontFamily: 'monospace',
      fontSize: '10px',
      letterSpacing: '2px',
    }}>
      {label}
    </div>
  );
}
