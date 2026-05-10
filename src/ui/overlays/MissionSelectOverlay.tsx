import { useState } from 'react';
import type { MissionDef } from '../../game/missions/types.js';

interface Props {
  missions: MissionDef[];
  onSelect: (index: number) => void;
}

const CARD_BASE: React.CSSProperties = {
  background: '#0a1628',
  border: '1px solid #1e3a5f',
  borderRadius: '4px',
  padding: '16px 24px',
  width: '360px',
  cursor: 'pointer',
  transition: 'border-color 0.15s',
};

export function MissionSelectOverlay({ missions, onSelect }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(5, 8, 16, 0.97)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '16px', zIndex: 200,
    }}>
      <div style={{ color: '#00d4ff', fontFamily: 'monospace', fontSize: '20px', letterSpacing: '4px', marginBottom: '8px' }}>
        [ ВЫБОР МИССИИ ]
      </div>
      {missions.map((mission, index) => (
        <div
          key={mission.id}
          style={{ ...CARD_BASE, borderColor: hovered === index ? '#00d4ff' : '#1e3a5f' }}
          onClick={() => onSelect(index)}
          onMouseEnter={() => setHovered(index)}
          onMouseLeave={() => setHovered(null)}
        >
          <div style={{ color: '#2a4a6a', fontFamily: 'monospace', fontSize: '10px', letterSpacing: '2px' }}>
            МИССИЯ {index + 1}
          </div>
          <div style={{ color: '#c0cfe0', fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold', margin: '4px 0' }}>
            {mission.title}
          </div>
          <div style={{ color: '#4a6a8a', fontFamily: 'monospace', fontSize: '12px', marginBottom: '8px' }}>
            {mission.description}
          </div>
          <div style={{ color: '#00ff88', fontFamily: 'monospace', fontSize: '12px' }}>
            Цель: {mission.goalText}
          </div>
        </div>
      ))}
    </div>
  );
}
