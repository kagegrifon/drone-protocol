import { useGameStore } from '../../../shared/store/gameStore.js';

function StatRow({ label, value, unit = '' }: { label: string; value: number | string; unit?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 12px', borderBottom: '1px solid #0a1628' }}>
      <span style={{ color: '#445566', fontFamily: 'monospace', fontSize: '11px', letterSpacing: '0.5px' }}>
        {label}
      </span>
      <span style={{ color: '#00ff88', fontFamily: 'monospace', fontSize: '14px' }}>
        {value}<span style={{ color: '#445566', fontSize: '11px' }}>{unit}</span>
      </span>
    </div>
  );
}

export function StatsPanel() {
  const stats = useGameStore((s) => s.stats);

  return (
    <div>
      <div style={{ color: '#4488ff', fontFamily: 'monospace', fontSize: '11px', padding: '6px 12px 4px', letterSpacing: '1px', borderBottom: '1px solid #1e3a5f' }}>
        STATISTICS
      </div>
      <StatRow label="ore/min" value={stats.orePerMin} />
      <StatRow label="congestion" value={stats.congestion} unit="%" />
      <StatRow label="efficiency" value={stats.efficiency} unit="%" />
    </div>
  );
}
