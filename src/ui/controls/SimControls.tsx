import { useGameStore } from '../../shared/store/gameStore.js';

interface SimControlsProps {
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onBackToMissions: () => void;
  onOpenSettings: () => void;
}

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
  border: '1px solid #00d4ff',
};

const BTN_DISABLED: React.CSSProperties = {
  ...BTN,
  opacity: 0.4,
  cursor: 'default',
};

export function SimControls({ onPlay, onPause, onStep, onBackToMissions, onOpenSettings }: SimControlsProps) {
  const isRunning = useGameStore((s) => s.isRunning);
  const gameStatus = useGameStore((s) => s.gameStatus);
  const tick = useGameStore((s) => s.stats.tick);

  const isFinished = gameStatus === 'won' || gameStatus === 'failed';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderBottom: '1px solid #1e3a5f', flexWrap: 'wrap' }}>
      <button
        style={isFinished ? BTN_DISABLED : (isRunning ? BTN_ACTIVE : BTN)}
        disabled={isFinished}
        onClick={() => isRunning ? onPause() : onPlay()}
      >
        {isRunning ? '⏸ Pause' : '▶ Play'}
      </button>
      <button
        style={isRunning || isFinished ? BTN_DISABLED : BTN}
        onClick={onStep}
        disabled={isRunning || isFinished}
      >
        {'→| '}Step
      </button>
      <span style={{ color: '#4488ff', fontFamily: 'monospace', fontSize: '12px', marginLeft: '8px', flex: 1 }}>
        Tick: {tick}
      </span>
      <button style={{ ...BTN, fontSize: '11px', padding: '4px 10px', color: '#4a6a8a' }} onClick={onBackToMissions}>
        ← Миссии
      </button>
      <button style={{ ...BTN, fontSize: '13px', padding: '4px 8px', color: '#4a8aaa' }} onClick={onOpenSettings} title="Настройки">
        ⚙
      </button>
    </div>
  );
}
