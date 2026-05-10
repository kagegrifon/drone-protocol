import { useGameStore } from '../../shared/store/gameStore.js';
import type { MissionDef } from '../../game/missions/types.js';

interface Props {
  mission: MissionDef;
}

function progressText(mission: MissionDef, oreMined: number, orePerMin: number, efficiency: number): string {
  const { win } = mission.config;
  switch (win.type) {
    case 'ore_mined':    return `${oreMined} / ${win.target}`;
    case 'ore_per_min':  return `${orePerMin.toFixed(1)} / ${win.target} ore/min`;
    case 'efficiency':   return `${efficiency}% / ${win.target}%`;
  }
}

export function MissionGoalPanel({ mission }: Props) {
  const stats = useGameStore((s) => s.stats);

  return (
    <div style={{ padding: '8px 12px', borderBottom: '1px solid #1e3a5f', background: '#060d1a' }}>
      <div style={{ color: '#2a4a6a', fontFamily: 'monospace', fontSize: '10px', letterSpacing: '2px', marginBottom: '4px' }}>
        ЦЕЛЬ
      </div>
      <div style={{ color: '#c0cfe0', fontFamily: 'monospace', fontSize: '12px', marginBottom: '4px' }}>
        {mission.goalText}
      </div>
      <div style={{ color: '#00ff88', fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold' }}>
        {progressText(mission, stats.oreMined, stats.orePerMin, stats.efficiency)}
      </div>
    </div>
  );
}
