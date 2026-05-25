import type { FunctionCall, FunctionName, ObjectRef } from '../../../game/programs/types.js';
import type { EntityMeta } from '../../../game/missions/types.js';
import { FUNCTIONS } from '../../../game/programs/functions.js';
import { ObjectSelect } from './ObjectSelect.js';

const FUNCTION_ORDER: FunctionName[] = ['Energy', 'EnergyMax', 'Inventory', 'InventoryMax', 'Deposit', 'Distance'];

const selectStyle: React.CSSProperties = {
  background: '#0a1628',
  border: '1px solid #1e3a5f',
  color: '#aabbcc',
  fontFamily: 'monospace',
  fontSize: '11px',
  padding: '2px 4px',
  borderRadius: '2px',
};

function defaultCallForFn(fn: FunctionName): FunctionCall {
  const self: ObjectRef = { kind: 'self' };
  if (fn === 'Distance') return { fn: 'Distance', args: [self, self] };
  return { fn, args: [self] } as FunctionCall;
}

interface Props {
  value: FunctionCall;
  entities: EntityMeta[];
  onChange: (next: FunctionCall) => void;
}

export function FunctionCallEditor({ value, entities, onChange }: Props) {
  const spec = FUNCTIONS[value.fn];

  function setFn(fn: FunctionName) {
    onChange(defaultCallForFn(fn));
  }

  function setArg(index: number, ref: ObjectRef) {
    const args = [...value.args] as ObjectRef[];
    args[index] = ref;
    onChange({ ...value, args } as FunctionCall);
  }

  // Статический UI-фильтр опций аргумента по типу EntityMeta (argFilter из спеки
  // требует World и предназначен для рантайма — здесь используем тип).
  const typeFilter: ((e: EntityMeta) => boolean) | undefined = (() => {
    switch (value.fn) {
      case 'Energy':
      case 'EnergyMax':
      case 'Inventory':
      case 'InventoryMax':
        return undefined;
      case 'Deposit':
        return (e) => e.type === 'mine';
      case 'Distance':
        return undefined;
    }
  })();

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
      <select
        style={selectStyle}
        value={value.fn}
        onChange={(e) => setFn(e.target.value as FunctionName)}
      >
        {FUNCTION_ORDER.map((name) => (
          <option key={name} value={name}>{FUNCTIONS[name].icon} {FUNCTIONS[name].label}</option>
        ))}
      </select>
      <span style={{ color: '#445566' }}>(</span>
      {value.args.map((arg, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
          {i > 0 && <span style={{ color: '#445566' }}>,</span>}
          <ObjectSelect
            value={arg}
            entities={entities}
            filter={typeFilter}
            label={spec.argLabels[i] || undefined}
            onChange={(next) => setArg(i, next)}
          />
        </span>
      ))}
      <span style={{ color: '#445566' }}>)</span>
    </span>
  );
}
