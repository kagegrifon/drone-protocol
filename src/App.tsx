import { useEffect, useRef } from 'react';
import { World } from './game/simulation/world/World.js';
import { Grid } from './game/simulation/world/Grid.js';
import { createBase } from './game/simulation/entities/createBase.js';
import { createMine } from './game/simulation/entities/createMine.js';
import { createCharger } from './game/simulation/entities/createCharger.js';
import { createDrone } from './game/simulation/entities/createDrone.js';
import { GameRenderer } from './renderer/GameRenderer.js';

function buildTestScene(): { world: World; grid: Grid } {
  const world = new World();
  const grid = new Grid();

  grid.setTile(1, 1, 'base');
  grid.setTile(18, 1, 'mine');
  grid.setTile(10, 10, 'mine');
  grid.setTile(1, 18, 'charger');
  grid.setTile(10, 5, 'charger');

  createBase(world, 1, 1);
  createMine(world, 18, 1);
  createMine(world, 10, 10);
  createCharger(world, 1, 18);
  createCharger(world, 10, 5);
  createDrone(world, 5, 5);
  createDrone(world, 12, 12);

  return { world, grid };
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const { world, grid } = buildTestScene();
    const renderer = new GameRenderer(world, grid, containerRef.current);

    // Temporary tick loop for Phase 6 visual testing.
    // Phase 8 GameController will replace this setInterval.
    // No simulation systems called here — static scene is enough to verify rendering.

    return () => renderer.destroy();
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '16px', background: '#050810', minHeight: '100vh' }}>
      <div ref={containerRef} />
    </div>
  );
}
