import { useState } from 'react';
import { useGameStore } from '../../../shared/store/gameStore.js';
import { InstructionBlock } from './InstructionBlock.js';
import { makeDefaultInstruction, AddInstructionMenu } from './instructionUtils.js';
import type { Instruction } from '../../../game/programs/types.js';
import type { EntityMeta } from '../../../game/missions/types.js';

const TAB_BTN = (active: boolean): React.CSSProperties => ({
  background: active ? '#0d2040' : 'transparent',
  border: 'none',
  borderBottom: active ? '2px solid #00d4ff' : '2px solid transparent',
  color: active ? '#00d4ff' : '#445566',
  fontFamily: 'monospace',
  fontSize: '12px',
  padding: '6px 14px',
  cursor: 'pointer',
  letterSpacing: '0.5px',
});

export function ProgramEditor({ entities }: { entities: EntityMeta[] }) {
  const [tab, setTab] = useState<'drone' | 'library'>('drone');
  const [newProgramName, setNewProgramName] = useState('');

  const selectedId = useGameStore((s) => s.selectedDroneId);
  const drones = useGameStore((s) => s.drones);
  const programs = useGameStore((s) => s.programs);
  const addInstruction = useGameStore((s) => s.addInstruction);
  const createProgram = useGameStore((s) => s.createProgram);
  const assignProgram = useGameStore((s) => s.assignProgram);
  const restartProgram = useGameStore((s) => s.restartProgram);

  const drone = drones.find((d) => d.id === selectedId);
  const droneProgram = programs.find((p) => p.id === drone?.currentProgramId);
  const programIds = programs.map((p) => p.id);

  const handleAddTopLevel = (type: Instruction['type']) => {
    if (!droneProgram) return;
    const instr = makeDefaultInstruction(type, entities, programIds);
    addInstruction(droneProgram.id, instr);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #1e3a5f', flexShrink: 0 }}>
        <button style={TAB_BTN(tab === 'drone')} onClick={() => setTab('drone')}>DRONE</button>
        <button style={TAB_BTN(tab === 'library')} onClick={() => setTab('library')}>LIBRARY</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        {tab === 'drone' && (
          <>
            {!drone && (
              <div style={{ color: '#445566', fontFamily: 'monospace', fontSize: '12px', textAlign: 'center', paddingTop: '16px' }}>
                Select a drone
              </div>
            )}
            {drone && !droneProgram && (
              <div style={{ color: '#445566', fontFamily: 'monospace', fontSize: '12px', textAlign: 'center', paddingTop: '16px' }}>
                No program assigned
              </div>
            )}
            {drone && droneProgram && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <span style={{ color: '#4488ff', fontFamily: 'monospace', fontSize: '11px', letterSpacing: '1px', flex: 1 }}>
                    {droneProgram.name}
                  </span>
                  <button
                    onClick={() => restartProgram(drone.id)}
                    title="Перезапустить программу"
                    style={{
                      background: '#0a1628',
                      border: '1px solid #1e3a5f',
                      color: '#00ff88',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      padding: '2px 8px',
                      cursor: 'pointer',
                      borderRadius: '2px',
                    }}
                  >
                    ↺ RESTART
                  </button>
                </div>
                {droneProgram.instructions.map((instr, i) => (
                  <InstructionBlock
                    key={i}
                    instruction={instr}
                    programId={droneProgram.id}
                    path={[i]}
                    entities={entities}
                    programIds={programIds}
                    activeInstructionPath={drone.currentInstructionPath ?? null}
                  />
                ))}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 8px',
                  marginTop: '4px',
                  borderTop: '1px solid #1e3a5f',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: drone.waitingFor ? '#00ff88' : '#445566',
                }}>
                  <span>{drone.waitingFor ? '⚡' : '◌'}</span>
                  <span>{drone.currentInstruction}</span>
                </div>
                <AddInstructionMenu onAdd={handleAddTopLevel} />
              </>
            )}
          </>
        )}

        {tab === 'library' && (
          <>
            {programs.map((prog) => (
              <div key={prog.id} style={{ background: '#060f1e', border: '1px solid #1e3a5f', borderRadius: '4px', padding: '8px 10px', marginBottom: '6px', fontFamily: 'monospace', fontSize: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#c0cfe0', flex: 1 }}>{prog.name}</span>
                  <span style={{ color: '#445566', fontSize: '11px' }}>{prog.instructions.length} instr</span>
                  {selectedId !== null && (
                    <button
                      onClick={() => assignProgram(selectedId, prog.id)}
                      style={{ background: '#0a1628', border: '1px solid #1e3a5f', color: '#00ff88', fontFamily: 'monospace', fontSize: '10px', padding: '2px 8px', cursor: 'pointer', borderRadius: '2px' }}
                    >
                      Assign
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <input
                value={newProgramName}
                onChange={(e) => setNewProgramName(e.target.value)}
                placeholder="program name"
                style={{ flex: 1, background: '#060f1e', border: '1px solid #1e3a5f', color: '#c0cfe0', fontFamily: 'monospace', fontSize: '12px', padding: '4px 8px', borderRadius: '3px' }}
              />
              <button
                onClick={() => { if (newProgramName.trim()) { createProgram(newProgramName.trim()); setNewProgramName(''); } }}
                style={{ background: '#0a1628', border: '1px solid #1e3a5f', color: '#00d4ff', fontFamily: 'monospace', fontSize: '12px', padding: '4px 10px', cursor: 'pointer', borderRadius: '3px' }}
              >
                + New
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

