import { useGameStore } from '../../shared/store/gameStore.js';
import type { DroneState } from '../../shared/store/gameStore.js';

function statusColor(state: DroneState['programState']): string {
  switch (state) {
    case 'running': return '#00d4ff';
    case 'waiting': return '#ffd700';
    case 'idle': return '#445566';
  }
}

function statusLabel(state: DroneState['programState']): string {
  switch (state) {
    case 'running': return 'RUN';
    case 'waiting': return 'WAIT';
    case 'idle': return 'IDLE';
  }
}

export function DroneList() {
  const drones = useGameStore((s) => s.drones);
  const selectedId = useGameStore((s) => s.selectedDroneId);
  const selectDrone = useGameStore((s) => s.selectDrone);

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ color: '#4488ff', fontFamily: 'monospace', fontSize: '11px', padding: '4px 12px 8px', letterSpacing: '1px' }}>
        DRONES [{drones.length}]
      </div>
      {drones.map((d) => {
        const isSelected = d.id === selectedId;
        const color = statusColor(d.programState);
        return (
          <div
            key={d.id}
            onClick={() => selectDrone(d.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 12px',
              cursor: 'pointer',
              background: isSelected ? '#0d2040' : 'transparent',
              borderLeft: isSelected ? '2px solid #00d4ff' : '2px solid transparent',
              transition: 'background 0.1s',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ color: '#c0cfe0', fontFamily: 'monospace', fontSize: '13px', flex: 1 }}>
              Drone #{d.id}
            </span>
            <span style={{ color, fontFamily: 'monospace', fontSize: '10px', letterSpacing: '0.5px' }}>
              {statusLabel(d.programState)}
            </span>
          </div>
        );
      })}
      {drones.length === 0 && (
        <div style={{ color: '#445566', fontFamily: 'monospace', fontSize: '12px', padding: '8px 12px' }}>
          No drones
        </div>
      )}
    </div>
  );
}
