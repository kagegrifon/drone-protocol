import { useEffect, useRef } from 'react';
import { World } from './game/simulation/world/World.js';
import { Grid } from './game/simulation/world/Grid.js';
import { createBase } from './game/simulation/entities/createBase.js';
import { createMine } from './game/simulation/entities/createMine.js';
import { createCharger } from './game/simulation/entities/createCharger.js';
import { createDrone } from './game/simulation/entities/createDrone.js';
import { GameRenderer } from './renderer/GameRenderer.js';
import { useGameStore } from './shared/store/gameStore.js';
import { SimControls } from './ui/controls/SimControls.js';
import { DroneList } from './ui/panels/DroneList.js';
import { DroneInspector } from './ui/panels/DroneInspector/index.js';
import { ProgramEditor } from './ui/editor/ProgramEditor/index.js';
import { StatsPanel } from './ui/panels/StatsPanel/index.js';
import type { ProgramRegistry, ProgramDef } from './game/programs/types.js';
import type { EntityId } from './shared/types/index.js';

function buildScene(): { world: World; grid: Grid; registry: ProgramRegistry; entityIds: EntityId[] } {
  const world = new World();
  const grid = new Grid();
  const registry: ProgramRegistry = new Map();

  grid.setTile(1, 1, 'base');
  grid.setTile(18, 1, 'mine');
  grid.setTile(10, 10, 'mine');
  grid.setTile(1, 18, 'charger');
  grid.setTile(10, 5, 'charger');

  const baseId = createBase(world, 1, 1);
  const mine1Id = createMine(world, 18, 1);
  const mine2Id = createMine(world, 10, 10);
  const charger1Id = createCharger(world, 1, 18);
  const charger2Id = createCharger(world, 10, 5);
  const drone1Id = createDrone(world, 5, 5);
  const drone2Id = createDrone(world, 12, 12);

  // Default mine-loop program
  const mineLoop: ProgramDef = {
    id: 'mine-loop',
    name: 'mine-loop',
    instructions: [
      { type: 'LOOP', body: [
        { type: 'MOVE_TO', targetEntityId: mine1Id },
        { type: 'MINE' },
        { type: 'MOVE_TO', targetEntityId: baseId },
        { type: 'DROP' },
        { type: 'IF', condition: { type: 'ENERGY_LOW', threshold: 30 }, then: [
          { type: 'MOVE_TO', targetEntityId: charger1Id },
          { type: 'CHARGE' },
        ]},
      ]},
    ],
  };
  registry.set(mineLoop.id, mineLoop);

  // Assign program to drones
  const prog1 = world.getComponent(drone1Id, 'Program')!;
  prog1.currentProgramId = mineLoop.id;
  prog1.callStack = [{ programId: mineLoop.id, instructionIndex: 0 }];
  prog1.state = 'running';

  const prog2 = world.getComponent(drone2Id, 'Program')!;
  prog2.currentProgramId = mineLoop.id;
  prog2.callStack = [{ programId: mineLoop.id, instructionIndex: 0 }];
  prog2.state = 'running';

  const entityIds: EntityId[] = [baseId, mine1Id, mine2Id, charger1Id, charger2Id];

  return { world, grid, registry, entityIds };
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const entityIdsRef = useRef<EntityId[]>([]);
  const init = useGameStore((s) => s.init);
  const isRunning = useGameStore((s) => s.isRunning);
  const tick = useGameStore((s) => s.tick);
  const selectDrone = useGameStore((s) => s.selectDrone);

  useEffect(() => {
    if (!containerRef.current) return;
    const { world, grid, registry, entityIds } = buildScene();
    entityIdsRef.current = entityIds;

    init(world, grid, registry);

    const renderer = new GameRenderer(
      world,
      grid,
      containerRef.current,
      (id) => selectDrone(id),
    );

    return () => {
      renderer.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => tick(), 100);
    return () => clearInterval(id);
  }, [isRunning, tick]);

  return (
    <div style={{ display: 'flex', background: '#050810', minHeight: '100vh', color: '#c0cfe0' }}>
      {/* Canvas area */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px' }}>
        <div ref={containerRef} />
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
        <SimControls />

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
