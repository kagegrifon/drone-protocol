import type { Instruction, ActionBlock, FlowBlock, ConditionBlock } from '../../../game/programs/types.js';
import type { EntityId } from '../../../shared/types/index.js';
import { useGameStore } from '../../../shared/store/gameStore.js';

const ICONS: Record<string, string> = {
  MOVE_TO: '→', MINE: '⛏', DROP: '↓', CHARGE: '⚡', WAIT: '⏱',
  LOOP: '🔄', REPEAT: '↩', IF: '?', RUN_PROGRAM: '▶',
};

interface Props {
  instruction: Instruction;
  programId: string;
  path: number[];
  entityIds: EntityId[];
  programIds: string[];
}

function labelForEntityId(id: EntityId): string {
  return `#${id}`;
}

export function InstructionBlock({ instruction, programId, path, entityIds, programIds }: Props) {
  const removeInstruction = useGameStore((s) => s.removeInstruction);
  const addInstruction = useGameStore((s) => s.addInstruction);

  const CARD: React.CSSProperties = {
    background: '#060f1e',
    border: '1px solid #1e3a5f',
    borderRadius: '4px',
    padding: '6px 8px',
    marginBottom: '4px',
    fontFamily: 'monospace',
    fontSize: '12px',
  };

  const isContainer = instruction.type === 'LOOP' || instruction.type === 'REPEAT' || instruction.type === 'IF';
  const children: Instruction[] =
    instruction.type === 'LOOP' || instruction.type === 'REPEAT'
      ? instruction.body
      : instruction.type === 'IF'
      ? instruction.then
      : [];

  const handleAddChild = () => {
    addInstruction(programId, { type: 'WAIT', ticks: 1 }, path);
  };

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ color: '#4488ff', fontSize: '14px' }}>{ICONS[instruction.type] ?? '•'}</span>
        <span style={{ color: '#00d4ff', flex: 1 }}>{instruction.type}</span>
        <InstructionParams instruction={instruction} entityIds={entityIds} programIds={programIds} />
        <button
          onClick={() => removeInstruction(programId, path)}
          style={{ background: 'none', border: 'none', color: '#445566', cursor: 'pointer', fontSize: '14px', padding: '0 2px', lineHeight: 1 }}
          title="Remove"
        >
          ×
        </button>
      </div>

      {isContainer && (
        <div style={{ marginTop: '6px', paddingLeft: '12px', borderLeft: '1px solid #1e3a5f' }}>
          {children.map((child, i) => (
            <InstructionBlock
              key={i}
              instruction={child}
              programId={programId}
              path={[...path, i]}
              entityIds={entityIds}
              programIds={programIds}
            />
          ))}
          <button
            onClick={handleAddChild}
            style={{ background: 'none', border: '1px dashed #1e3a5f', color: '#445566', cursor: 'pointer', fontFamily: 'monospace', fontSize: '11px', padding: '3px 8px', borderRadius: '3px', width: '100%', marginTop: '2px' }}
          >
            + add inside
          </button>
        </div>
      )}
    </div>
  );
}

function InstructionParams({
  instruction,
  entityIds,
  programIds,
}: {
  instruction: Instruction;
  entityIds: EntityId[];
  programIds: string[];
}) {
  const style: React.CSSProperties = {
    background: '#0a1628',
    border: '1px solid #1e3a5f',
    color: '#aabbcc',
    fontFamily: 'monospace',
    fontSize: '11px',
    padding: '2px 4px',
    borderRadius: '2px',
  };

  if (instruction.type === 'MOVE_TO') {
    return (
      <span style={{ color: '#778899', fontSize: '11px' }}>
        {labelForEntityId((instruction as ActionBlock & { type: 'MOVE_TO' }).targetEntityId)}
      </span>
    );
  }

  if (instruction.type === 'WAIT') {
    return (
      <span style={{ color: '#778899', fontSize: '11px' }}>
        {(instruction as ActionBlock & { type: 'WAIT' }).ticks}t
      </span>
    );
  }

  if (instruction.type === 'REPEAT') {
    return (
      <span style={{ color: '#778899', fontSize: '11px' }}>
        ×{(instruction as FlowBlock & { type: 'REPEAT' }).count}
      </span>
    );
  }

  if (instruction.type === 'RUN_PROGRAM') {
    return (
      <span style={{ color: '#778899', fontSize: '11px' }}>
        {(instruction as FlowBlock & { type: 'RUN_PROGRAM' }).programId}
      </span>
    );
  }

  if (instruction.type === 'IF') {
    const cond = (instruction as ConditionBlock).condition;
    return (
      <span style={{ color: '#ffd700', fontSize: '11px' }}>
        {cond.type}
      </span>
    );
  }

  // Suppress unused param warnings
  void style; void entityIds; void programIds;
  return null;
}
