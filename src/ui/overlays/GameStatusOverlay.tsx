import { useGameStore } from '../../shared/store/gameStore.js';

interface GameStatusOverlayProps {
  onReset: () => void;
}

const OVERLAY: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(5, 8, 16, 0.88)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '16px',
  zIndex: 100,
};

const BTN: React.CSSProperties = {
  background: '#0a1628',
  border: '1px solid #1e3a5f',
  color: '#00d4ff',
  padding: '8px 24px',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: '14px',
  borderRadius: '3px',
};

export function GameStatusOverlay({ onReset }: GameStatusOverlayProps) {
  const gameStatus = useGameStore((s) => s.gameStatus);
  const statusMessage = useGameStore((s) => s.statusMessage);

  if (gameStatus !== 'won' && gameStatus !== 'failed') return null;

  const isWon = gameStatus === 'won';

  return (
    <div style={OVERLAY}>
      <div style={{
        color: isWon ? '#00ff88' : '#ff4444',
        fontFamily: 'monospace',
        fontSize: '22px',
        fontWeight: 'bold',
        letterSpacing: '2px',
      }}>
        {isWon ? '[  ЦЕЛЬ ДОСТИГНУТА  ]' : '[  МИССИЯ ПРОВАЛЕНА  ]'}
      </div>
      {statusMessage && (
        <div style={{ color: '#c0cfe0', fontFamily: 'monospace', fontSize: '13px' }}>
          {statusMessage}
        </div>
      )}
      <button style={BTN} onClick={onReset}>
        Заново
      </button>
    </div>
  );
}
