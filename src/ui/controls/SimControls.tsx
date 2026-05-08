import { useGameStore } from '../../shared/store/gameStore.js';

const BTN: React.CSSProperties = {
  background: '#0a1628',
  border: '1px solid #1e3a5f',
  color: '#00d4ff',
  padding: '6px 14px',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: '13px',
  borderRadius: '3px',
  transition: 'background 0.15s',
};

const BTN_ACTIVE: React.CSSProperties = {
  ...BTN,
  background: '#0d2040',
  borderColor: '#00d4ff',
};

export function SimControls() {
  const isRunning = useGameStore((s) => s.isRunning);
  const setRunning = useGameStore((s) => s.setRunning);
  const stepOnce = useGameStore((s) => s.stepOnce);
  const tick = useGameStore((s) => s.stats.tick);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderBottom: '1px solid #1e3a5f' }}>
      <button
        style={isRunning ? BTN_ACTIVE : BTN}
        onClick={() => setRunning(!isRunning)}
      >
        {isRunning ? '⏸ Pause' : '▶ Play'}
      </button>
      <button
        style={BTN}
        onClick={() => { setRunning(false); stepOnce(); }}
        disabled={isRunning}
      >
        →| Step
      </button>
      <span style={{ color: '#4488ff', fontFamily: 'monospace', fontSize: '12px', marginLeft: '8px' }}>
        Tick: {tick}
      </span>
    </div>
  );
}
