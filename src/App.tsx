import { useEffect, useRef, useState } from 'react';
import { GameController } from './game/GameController.js';
import { ALL_MISSIONS } from './game/missions/index.js';
import { useGameStore } from './shared/store/gameStore.js';
import { SimControls } from './ui/controls/SimControls.js';
import { AudioControls } from './ui/controls/AudioControls.js';
import { DroneList } from './ui/panels/DroneList.js';
import { DroneInspector } from './ui/panels/DroneInspector/index.js';
import { ProgramEditor } from './ui/editor/ProgramEditor/index.js';
import { StatsPanel } from './ui/panels/StatsPanel/index.js';
import { MissionGoalPanel } from './ui/panels/MissionGoalPanel.js';
import { GameStatusOverlay } from './ui/overlays/GameStatusOverlay.js';
import { StartScreen } from './ui/screens/StartScreen.js';
import { LoadingScreen } from './ui/screens/LoadingScreen.js';
import type { EntityId } from './shared/types/index.js';
import type { AudioManager } from './renderer/audio/AudioManager.js';

type GamePhase = 'start' | 'loading' | 'game';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<GameController | null>(null);
  const entityIdsRef = useRef<EntityId[]>([]);
  const selectDrone = useGameStore((s) => s.selectDrone);

  const [gamePhase, setGamePhase] = useState<GamePhase>('start');
  const [missionIndex, setMissionIndex] = useState<number>(0);
  const [audioManager, setAudioManager] = useState<AudioManager | null>(null);

  const currentMission = ALL_MISSIONS[missionIndex] ?? ALL_MISSIONS[0];
  const isLastMission = missionIndex === ALL_MISSIONS.length - 1;

  const handleStart = (index: number) => {
    setMissionIndex(index);
    setGamePhase('loading');
  };

  const handleBackToMissions = () => {
    controllerRef.current?.pause();
    controllerRef.current?.destroy();
    controllerRef.current = null;
    setAudioManager(null);
    setGamePhase('start');
  };

  useEffect(() => {
    if (gamePhase !== 'loading') return;
    if (!containerRef.current) return;

    controllerRef.current?.destroy();
    const ctrl = new GameController(ALL_MISSIONS[missionIndex]);
    ctrl.setup(containerRef.current, {
      onDroneClick: (id) => selectDrone(id),
      onReady: () => setGamePhase('game'),
      onAudioReady: (am) => setAudioManager(am),
    });
    entityIdsRef.current = ctrl.entityIds;
    controllerRef.current = ctrl;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, missionIndex]);

  useEffect(() => {
    return () => controllerRef.current?.destroy();
  }, []);

  return (
    <div style={{ display: 'flex', background: '#050810', minHeight: '100vh', color: '#c0cfe0' }}>
      {/* Phaser canvas — always mounted so containerRef is available */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', position: 'relative' }}>
        <div ref={containerRef} />
        {gamePhase === 'game' && (
          <GameStatusOverlay
            onReset={() => controllerRef.current?.reset()}
            onNextMission={() => {
              const next = missionIndex < ALL_MISSIONS.length - 1 ? missionIndex + 1 : missionIndex;
              setMissionIndex(next);
              setGamePhase('loading');
            }}
            isLastMission={isLastMission}
          />
        )}
      </div>

      {/* Sidebar — visible only in game phase */}
      {gamePhase === 'game' && (
        <div style={{ width: '340px', minWidth: '340px', background: '#0a0e1a', borderLeft: '1px solid #1e3a5f', display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>
          <SimControls
            onPlay={() => controllerRef.current?.start()}
            onPause={() => controllerRef.current?.pause()}
            onStep={() => controllerRef.current?.step()}
            onBackToMissions={handleBackToMissions}
          />
          <AudioControls audioManager={audioManager} />
          <MissionGoalPanel mission={currentMission} />
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
          <div style={{ padding: '6px 12px', borderTop: '1px solid #0a1a2a', textAlign: 'center' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#1a2a3a' }}>
              Drone Loop v1.0 · 2026
            </span>
          </div>
        </div>
      )}

      {/* Overlays */}
      {gamePhase === 'start' && (
        <StartScreen missions={ALL_MISSIONS} onStart={handleStart} />
      )}
      {gamePhase === 'loading' && <LoadingScreen />}
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
