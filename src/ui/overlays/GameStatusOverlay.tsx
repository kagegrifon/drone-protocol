import { useGameStore } from '../../shared/store/gameStore.js';

interface Props {
  onReset: () => void;
  onNextMission?: () => void;
  isLastMission: boolean;
}

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

export function GameStatusOverlay({ onReset, onNextMission, isLastMission }: Props) {
  const gameStatus = useGameStore((s) => s.gameStatus);
  const statusMessage = useGameStore((s) => s.statusMessage);

  if (gameStatus !== 'won' && gameStatus !== 'failed') return null;

  const isWon = gameStatus === 'won';

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(5, 8, 16, 0.88)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '16px', zIndex: 100,
    }}>
      <div style={{ color: isWon ? '#00ff88' : '#ff4444', fontFamily: 'monospace', fontSize: '22px', fontWeight: 'bold', letterSpacing: '2px' }}>
        {isWon ? '[  ЦЕЛЬ ДОСТИГНУТА  ]' : '[  МИССИЯ ПРОВАЛЕНА  ]'}
      </div>
      {statusMessage && (
        <div style={{ color: '#c0cfe0', fontFamily: 'monospace', fontSize: '13px' }}>
          {statusMessage}
        </div>
      )}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button style={BTN} onClick={onReset}>Заново</button>
        {isWon && !isLastMission && onNextMission && (
          <button style={{ ...BTN, borderColor: '#00ff88', color: '#00ff88' }} onClick={onNextMission}>
            Следующая миссия →
          </button>
        )}
      </div>
    </div>
  );
}
