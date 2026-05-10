import { useState, useEffect } from 'react';
import type { AudioManager } from '../../renderer/audio/AudioManager.js';

interface AudioControlsProps {
  audioManager: AudioManager | null;
}

const SLIDER: React.CSSProperties = {
  width: '100%',
  accentColor: '#00d4ff',
  cursor: 'pointer',
};

const ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '6px',
};

const LABEL: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '11px',
  color: '#4a8aaa',
  width: '20px',
  flexShrink: 0,
};

const VAL: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '10px',
  color: '#2a6a8a',
  width: '28px',
  textAlign: 'right',
  flexShrink: 0,
};

export function AudioControls({ audioManager }: AudioControlsProps) {
  const [musicVol, setMusicVol] = useState(70);
  const [sfxVol, setSfxVol] = useState(80);

  useEffect(() => {
    audioManager?.setMusicVolume(musicVol / 100);
  }, [audioManager, musicVol]);

  useEffect(() => {
    audioManager?.setSfxVolume(sfxVol / 100);
  }, [audioManager, sfxVol]);

  return (
    <div style={{ padding: '8px 12px', borderBottom: '1px solid #1e3a5f' }}>
      <div style={ROW}>
        <span style={LABEL}>🎵</span>
        <input
          type="range" min={0} max={100} value={musicVol}
          style={SLIDER}
          onChange={(e) => setMusicVol(+e.target.value)}
        />
        <span style={VAL}>{musicVol}%</span>
      </div>
      <div style={ROW}>
        <span style={LABEL}>🔊</span>
        <input
          type="range" min={0} max={100} value={sfxVol}
          style={SLIDER}
          onChange={(e) => setSfxVol(+e.target.value)}
        />
        <span style={VAL}>{sfxVol}%</span>
      </div>
    </div>
  );
}
