import { useState } from 'react';
import type { MissionDef } from '../../game/missions/types.js';

interface StartScreenProps {
  missions: MissionDef[];
  onStart: (missionIndex: number) => void;
}

const DIFFICULTY = ['★☆☆', '★★☆', '★★☆', '★★★'];

const CARD: React.CSSProperties = {
  background: '#0a1628',
  border: '1px solid #1e3a5f',
  borderRadius: '4px',
  padding: '14px 20px',
  cursor: 'pointer',
  transition: 'border-color 0.15s',
  minWidth: '300px',
  maxWidth: '360px',
};

const BTN: React.CSSProperties = {
  background: '#0d2040',
  border: '1px solid #00d4ff',
  color: '#00d4ff',
  padding: '10px 32px',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: '14px',
  borderRadius: '3px',
  letterSpacing: '2px',
  marginTop: '8px',
};

export function StartScreen({ missions, onStart }: StartScreenProps) {
  const [selected, setSelected] = useState(0);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: '#050810',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '12px',
    }}>
      <div style={{
        fontFamily: 'monospace', fontSize: '36px', letterSpacing: '8px',
        color: '#00d4ff',
        textShadow: '0 0 20px #00d4ff, 0 0 40px #007799',
        marginBottom: '4px',
      }}>
        DRONE LOOP
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: '11px', letterSpacing: '3px', color: '#2a4a6a', marginBottom: '16px' }}>
        AUTOMATION PROTOCOL v1.0
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {missions.map((mission, index) => (
          <div
            key={mission.id}
            style={{ ...CARD, borderColor: selected === index ? '#00d4ff' : '#1e3a5f' }}
            onClick={() => setSelected(index)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#2a4a6a', letterSpacing: '2px' }}>
                МИССИЯ {index + 1}
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#00d4ff' }}>
                {DIFFICULTY[index] ?? '★☆☆'}
              </span>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#c0cfe0', fontWeight: 'bold', marginBottom: '4px' }}>
              {mission.title.replace(/^Миссия \d+:\s*/, '')}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#4a6a8a', marginBottom: '6px', lineHeight: 1.4 }}>
              {mission.description}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#00ff88' }}>
              ▶ {mission.goalText}
            </div>
          </div>
        ))}
      </div>

      <button style={BTN} onClick={() => onStart(selected)}>
        ЗАПУСТИТЬ
      </button>

      <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#1a2a3a', marginTop: '16px' }}>
        Drone Loop v1.0 · 2026
      </div>
    </div>
  );
}
