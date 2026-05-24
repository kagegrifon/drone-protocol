import { useMemo, useState } from 'react';
import type { Instruction, FlowBlock, ConditionBlock, ConditionLeaf, ConditionLogic } from '../../../game/programs/types.js';
import type { EntityMeta } from '../../../game/missions/types.js';
import { useGameStore } from '../../../shared/store/gameStore.js';
import { makeDefaultInstruction, AddInstructionMenu } from './instructionUtils.js';
import { ConditionEditor } from './ConditionEditor.js';

const ICONS: Record<string, string> = {
  MOVE_TO: '→', MINE: '⛏', DROP: '↓', CHARGE: '⚡', WAIT: '⏱',
  LOOP: '🔄', REPEAT: '↩', IF: '?', RUN_PROGRAM: '▶',
};

function opSymbol(op: string): string {
  if (op === '<=') return '≤';
  if (op === '>=') return '≥';
  return op;
}

function conditionChips(instruction: ConditionBlock, entities: EntityMeta[]): Array<{ label: string; isOperator: boolean }> {
  const chips: Array<{ label: string; isOperator: boolean }> = [];
  instruction.conditions.forEach((leaf, i) => {
    if (i > 0) chips.push({ label: instruction.operators[i - 1], isOperator: true });
    const op = opSymbol(leaf.operator);
    const prop = leaf.property;
    let text: string;
    switch (prop.kind) {
      case 'ENERGY':    text = `⚡ ${op} ${leaf.value}${prop.unit === '%' ? '%' : ' ед.'}`; break;
      case 'INVENTORY': text = `📦 ${op} ${leaf.value}${prop.unit === '%' ? '%' : ' ед.'}`; break;
      case 'DEPOSIT':   text = `⛏️ ${op} ${leaf.value} ед.`; break;
      case 'DISTANCE': {
        const label = entities.find(e => e.id === prop.targetEntityId)?.label ?? `#${prop.targetEntityId}`;
        text = `📍${label} ${op} ${leaf.value} кл.`;
        break;
      }
    }
    chips.push({ label: text, isOperator: false });
  });
  return chips;
}

interface Props {
  instruction: Instruction;
  programId: string;
  path: number[];
  entities: EntityMeta[];
  programIds: string[];
  activeInstructionPath: number[] | null;
}

export function InstructionBlock({ instruction, programId, path, entities, programIds, activeInstructionPath }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const removeInstruction = useGameStore((s) => s.removeInstruction);
  const addInstruction = useGameStore((s) => s.addInstruction);
  const updateInstruction = useGameStore((s) => s.updateInstruction);

  const cardStyle = useMemo<React.CSSProperties>(() => {
    const isActive =
      activeInstructionPath !== null &&
      path.length === activeInstructionPath.length &&
      path.every((v, i) => v === activeInstructionPath[i]);

    const isAncestor =
      activeInstructionPath !== null &&
      path.length < activeInstructionPath.length &&
      path.every((v, i) => v === activeInstructionPath[i]);

    return {
      background: isActive ? '#00ff8812' : '#060f1e',
      border: `1px solid ${isActive ? '#00ff88' : isAncestor ? '#00ff8840' : '#1e3a5f'}`,
      borderRadius: '4px',
      padding: '6px 8px',
      marginBottom: '4px',
      fontFamily: 'monospace',
      fontSize: '12px',
    };
  }, [activeInstructionPath, path]);

  const isContainer = instruction.type === 'LOOP' || instruction.type === 'REPEAT' || instruction.type === 'IF';
  const children: Instruction[] =
    instruction.type === 'LOOP' || instruction.type === 'REPEAT'
      ? instruction.body
      : instruction.type === 'IF'
      ? instruction.then
      : [];

  return (
    <div style={cardStyle}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ color: '#4488ff', fontSize: '14px' }}>{ICONS[instruction.type] ?? '•'}</span>
        <span style={{ color: '#00d4ff' }}>{instruction.type}</span>

        {instruction.type === 'MOVE_TO' && (() => {
          const label = entities.find(e => e.id === instruction.targetEntityId)?.label
                        ?? `#${instruction.targetEntityId}`;
          return (
            <button
              data-testid="move-to-toggle"
              onClick={() => setPickerOpen(p => !p)}
              style={{
                background: '#0a1628',
                border: `1px solid ${pickerOpen ? '#00d4ff' : '#1e3a5f'}`,
                color: '#aabbcc',
                fontFamily: 'monospace',
                fontSize: '11px',
                padding: '2px 6px',
                borderRadius: '2px',
                cursor: 'pointer',
              }}
            >
              {label} {pickerOpen ? '▴' : '▾'}
            </button>
          );
        })()}

        {instruction.type === 'IF' && (() => {
          const noConditions = instruction.conditions.length === 0;
          const chips = noConditions ? [] : conditionChips(instruction, entities);
          return (
            <>
              {noConditions
                ? <span style={{ color: '#ff8844', fontFamily: 'monospace', fontSize: '11px', fontStyle: 'italic' }}>условие не задано</span>
                : chips.map((chip, i) => (
                    <span
                      key={i}
                      style={{
                        background: chip.isOperator ? 'transparent' : '#0a2040',
                        color: chip.isOperator ? '#ff8844' : '#4488ff',
                        fontFamily: 'monospace',
                        fontSize: '10px',
                        padding: chip.isOperator ? '0' : '1px 6px',
                        borderRadius: '10px',
                        border: chip.isOperator ? 'none' : '1px solid #1e3a5f',
                        fontWeight: chip.isOperator ? 'bold' : 'normal',
                      }}
                    >
                      {chip.label}
                    </span>
                  ))
              }
              <button
                onClick={() => setEditorOpen(o => !o)}
                style={{
                  background: 'none',
                  border: '1px solid #1e3a5f',
                  color: '#445566',
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                {noConditions ? '✏️ задать' : '✏️'}
              </button>
            </>
          );
        })()}

        {instruction.type !== 'MOVE_TO' && instruction.type !== 'IF' && (
          <InstructionParams instruction={instruction} programIds={programIds} />
        )}

        <button
          onClick={() => removeInstruction(programId, path)}
          style={{ background: 'none', border: 'none', color: '#445566', cursor: 'pointer', fontSize: '14px', padding: '0 2px', lineHeight: 1, marginLeft: instruction.type === 'IF' ? '0' : 'auto' }}
          title="Remove"
        >
          ×
        </button>
      </div>

      {instruction.type === 'IF' && editorOpen && (
        <ConditionEditor
          conditions={instruction.conditions}
          operators={instruction.operators}
          entities={entities}
          onSave={(conditions: ConditionLeaf[], operators: ConditionLogic[]) => {
            updateInstruction(programId, path, { ...instruction, conditions, operators });
            setEditorOpen(false);
          }}
          onCancel={() => setEditorOpen(false)}
        />
      )}

      {instruction.type === 'MOVE_TO' && pickerOpen && (
        <div style={{ marginTop: '6px', paddingLeft: '12px', borderLeft: '1px solid #1e3a5f' }}>
          {entities.map(({ id, label }) => (
            <button
              key={id}
              data-testid={`move-to-option-${label}`}
              onClick={() => {
                updateInstruction(programId, path, { type: 'MOVE_TO', targetEntityId: id });
                setPickerOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: id === instruction.targetEntityId ? '#0d2040' : 'none',
                border: '1px solid',
                borderColor: id === instruction.targetEntityId ? '#00d4ff' : '#1e3a5f',
                color: id === instruction.targetEntityId ? '#00d4ff' : '#aabbcc',
                fontFamily: 'monospace',
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '3px',
                cursor: 'pointer',
                marginBottom: '3px',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {isContainer && (
        <div style={{ marginTop: '6px', paddingLeft: '12px', borderLeft: '1px solid #1e3a5f' }}>
          {children.map((child, i) => (
            <InstructionBlock
              key={i}
              instruction={child}
              programId={programId}
              path={[...path, i]}
              entities={entities}
              programIds={programIds}
              activeInstructionPath={activeInstructionPath}
            />
          ))}
          <AddInstructionMenu
            onAdd={(type) => {
              addInstruction(programId, makeDefaultInstruction(type, entities, programIds), path);
            }}
          />
        </div>
      )}
    </div>
  );
}

function InstructionParams({
  instruction,
  programIds,
}: {
  instruction: Instruction;
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

  if (instruction.type === 'WAIT') {
    return (
      <span style={{ color: '#778899', fontSize: '11px' }}>
        {instruction.seconds}s
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

  void style; void programIds;
  return null;
}
