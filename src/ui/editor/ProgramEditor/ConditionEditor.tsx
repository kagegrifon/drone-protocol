import { useState } from 'react';
import type { ConditionLeaf, ConditionLogic, ConditionOperator, ConditionProperty } from '../../../game/programs/types.js';
import type { EntityMeta } from '../../../game/missions/types.js';

interface Props {
  conditions: ConditionLeaf[];
  operators: ConditionLogic[];
  entities: EntityMeta[];
  onSave: (conditions: ConditionLeaf[], operators: ConditionLogic[]) => void;
  onCancel: () => void;
}

const OPERATORS: ConditionOperator[] = ['<', '<=', '=', '>=', '>'];

function defaultLeaf(): ConditionLeaf {
  return { property: { kind: 'ENERGY', unit: '%' }, operator: '<', value: 50 };
}

function propertyHasUnit(p: ConditionProperty): p is { kind: 'ENERGY'; unit: '%' | 'abs' } | { kind: 'INVENTORY'; unit: '%' | 'abs' } {
  return p.kind === 'ENERGY' || p.kind === 'INVENTORY';
}

function propertyIsDistance(p: ConditionProperty): p is { kind: 'DISTANCE'; targetEntityId: number } {
  return p.kind === 'DISTANCE';
}

function valueSuffix(leaf: ConditionLeaf): string {
  if (leaf.property.kind === 'DISTANCE') return ' кл.';
  if (leaf.property.kind === 'DEPOSIT') return ' ед.';
  if (propertyHasUnit(leaf.property)) return leaf.property.unit === '%' ? '%' : ' ед.';
  return '';
}

function formatChip(leaf: ConditionLeaf, entities: EntityMeta[]): string {
  const op = leaf.operator;
  const v = leaf.value;
  const suffix = valueSuffix(leaf);
  switch (leaf.property.kind) {
    case 'ENERGY':    return `⚡ ${op} ${v}${suffix}`;
    case 'INVENTORY': return `📦 ${op} ${v}${suffix}`;
    case 'DEPOSIT':   return `⛏️ ${op} ${v}${suffix}`;
    case 'DISTANCE': {
      const targetId = (leaf.property as { kind: 'DISTANCE'; targetEntityId: number }).targetEntityId;
      const label = entities.find(e => e.id === targetId)?.label ?? `#${targetId}`;
      return `📍${label} ${op} ${v}${suffix}`;
    }
  }
}

function buildPreview(conditions: ConditionLeaf[], operators: ConditionLogic[], entities: EntityMeta[]): string {
  if (conditions.length === 0) return '(нет условий)';
  return conditions
    .map((c, i) => {
      const chip = formatChip(c, entities);
      return i === 0 ? chip : `${operators[i - 1]} ${chip}`;
    })
    .join(' ');
}

const selectStyle: React.CSSProperties = {
  background: '#0a1628',
  border: '1px solid #1e3a5f',
  color: '#aabbcc',
  fontFamily: 'monospace',
  fontSize: '11px',
  padding: '2px 4px',
  borderRadius: '2px',
};

const inputStyle: React.CSSProperties = {
  ...selectStyle,
  width: '36px',
};

export function ConditionEditor({ conditions: initConditions, operators: initOperators, entities, onSave, onCancel }: Props) {
  const [conditions, setConditions] = useState<ConditionLeaf[]>(initConditions.length > 0 ? initConditions : [defaultLeaf()]);
  const [operators, setOperators] = useState<ConditionLogic[]>(initOperators);

  function updateCondition(index: number, updated: ConditionLeaf) {
    setConditions(prev => prev.map((c, i) => i === index ? updated : c));
  }

  function removeCondition(index: number) {
    setConditions(prev => prev.filter((_, i) => i !== index));
    setOperators(prev => {
      const next = [...prev];
      next.splice(index === 0 ? 0 : index - 1, 1);
      return next;
    });
  }

  function addCondition() {
    setConditions(prev => [...prev, defaultLeaf()]);
    setOperators(prev => [...prev, 'AND']);
  }

  function toggleOperator(index: number) {
    setOperators(prev => prev.map((op, i) => i === index ? (op === 'AND' ? 'OR' : 'AND') : op));
  }

  return (
    <div style={{ marginTop: '6px', padding: '10px', background: '#060f1e', border: '1px solid #1e3a5f', borderRadius: '4px' }}>
      <div style={{ color: '#445566', fontFamily: 'monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
        ⚙️ Условие IF
      </div>

      {conditions.map((leaf, index) => (
        <div key={index}>
          <ConditionRow
            leaf={leaf}
            entities={entities}
            onChange={(updated) => updateCondition(index, updated)}
            onRemove={() => removeCondition(index)}
          />
          {index < operators.length && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0' }}>
              <div style={{ flex: 1, height: '1px', background: '#1e3a5f' }} />
              <button
                onClick={() => toggleOperator(index)}
                style={{
                  background: '#0a1628',
                  border: '1px solid #1e3a5f',
                  color: '#00d4ff',
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  padding: '1px 8px',
                  borderRadius: '2px',
                  cursor: 'pointer',
                }}
              >
                {operators[index]}
              </button>
              <div style={{ flex: 1, height: '1px', background: '#1e3a5f' }} />
            </div>
          )}
        </div>
      ))}

      <button
        onClick={addCondition}
        style={{
          background: 'none',
          border: '1px dashed #1e3a5f',
          color: '#445566',
          fontFamily: 'monospace',
          fontSize: '11px',
          padding: '3px 10px',
          borderRadius: '3px',
          cursor: 'pointer',
          width: '100%',
          marginTop: '6px',
          marginBottom: '8px',
        }}
      >
        + добавить условие
      </button>

      <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#4488ff', background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: '2px', padding: '4px 8px', marginBottom: '8px' }}>
        👁 {buildPreview(conditions, operators, entities)}
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={() => onSave(conditions, operators)}
          style={{ flex: 1, background: '#0a2a0a', border: '1px solid #1a5f1a', color: '#4caf50', fontFamily: 'monospace', fontSize: '11px', padding: '4px', borderRadius: '3px', cursor: 'pointer' }}
        >
          Сохранить
        </button>
        <button
          onClick={onCancel}
          style={{ flex: 1, background: '#0a1628', border: '1px solid #1e3a5f', color: '#445566', fontFamily: 'monospace', fontSize: '11px', padding: '4px', borderRadius: '3px', cursor: 'pointer' }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

function ConditionRow({
  leaf,
  entities,
  onChange,
  onRemove,
}: {
  leaf: ConditionLeaf;
  entities: EntityMeta[];
  onChange: (updated: ConditionLeaf) => void;
  onRemove: () => void;
}) {
  function setKind(kind: ConditionProperty['kind']) {
    let property: ConditionProperty;
    switch (kind) {
      case 'ENERGY':    property = { kind, unit: '%' }; break;
      case 'INVENTORY': property = { kind, unit: '%' }; break;
      case 'DEPOSIT':   property = { kind }; break;
      case 'DISTANCE':  property = { kind, targetEntityId: entities[0]?.id ?? 1 }; break;
    }
    onChange({ ...leaf, property });
  }

  const prop = leaf.property;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px', flexWrap: 'wrap' }}>
      {/* Property select */}
      <select
        style={selectStyle}
        value={prop.kind}
        onChange={(e) => setKind(e.target.value as ConditionProperty['kind'])}
      >
        <option value="ENERGY">⚡ Энергия</option>
        <option value="INVENTORY">📦 Загрузка рудой</option>
        <option value="DEPOSIT">⛏️ Депозит</option>
        <option value="DISTANCE">📍 Расстояние</option>
      </select>

      {/* Unit select — only for ENERGY / INVENTORY */}
      {propertyHasUnit(prop) && (
        <select
          style={selectStyle}
          value={prop.unit}
          onChange={(e) => onChange({ ...leaf, property: { ...prop, unit: e.target.value as '%' | 'abs' } })}
        >
          <option value="%">%</option>
          <option value="abs">ед.</option>
        </select>
      )}

      {/* Object select — only for DISTANCE */}
      {propertyIsDistance(prop) && (
        <select
          style={selectStyle}
          value={prop.targetEntityId}
          onChange={(e) => onChange({ ...leaf, property: { kind: 'DISTANCE', targetEntityId: Number(e.target.value) } })}
        >
          {entities.map(({ id, label }) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      )}

      {/* Operator */}
      <select
        style={{ ...selectStyle, width: '40px' }}
        value={leaf.operator}
        onChange={(e) => onChange({ ...leaf, operator: e.target.value as ConditionOperator })}
      >
        {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
      </select>

      {/* Value */}
      <input
        type="number"
        style={inputStyle}
        value={leaf.value}
        onChange={(e) => onChange({ ...leaf, value: Number(e.target.value) })}
      />

      {/* Suffix label */}
      <span style={{ color: '#445566', fontFamily: 'monospace', fontSize: '10px', width: '22px' }}>
        {valueSuffix(leaf)}
      </span>

      {/* Remove */}
      <button
        onClick={onRemove}
        style={{ background: 'none', border: 'none', color: '#445566', cursor: 'pointer', fontSize: '14px', padding: '0 2px', lineHeight: 1 }}
        title="Удалить"
      >
        ×
      </button>
    </div>
  );
}
