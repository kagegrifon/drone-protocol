import type {
  ConditionLeaf,
  ConditionLogic,
  FunctionCall,
  ObjectRef,
  Operand,
} from "../../game/programs/types.js";
import type { EntityMeta } from "../../game/missions/types.js";

export function formatObjectRef(
  ref: ObjectRef,
  entities: EntityMeta[],
): string {
  if (ref.kind === "self") return "Self";
  return entities.find((e) => e.id === ref.id)?.label ?? `#${ref.id}`;
}

export function formatFunctionCall(
  call: FunctionCall,
  entities: EntityMeta[],
  compact = false,
): string {
  const sep = compact ? "," : ", ";
  const args = call.args.map((a) => formatObjectRef(a, entities)).join(sep);
  return `${call.fn}(${args})`;
}

export function formatOperand(
  op: Operand,
  entities: EntityMeta[],
  compact = false,
): string {
  return op.kind === "number"
    ? String(op.value)
    : formatFunctionCall(op.call, entities, compact);
}

export function formatLeaf(
  leaf: ConditionLeaf,
  entities: EntityMeta[],
  compact = false,
): string {
  const space = compact ? "" : " ";
  return `${formatFunctionCall(leaf.left, entities, compact)}${space}${leaf.operator}${space}${formatOperand(leaf.right, entities, compact)}`;
}

export function formatConditions(
  conditions: ConditionLeaf[],
  operators: ConditionLogic[],
  entities: EntityMeta[],
  compact = false,
): string {
  if (conditions.length === 0) return "(нет условий)";
  const sep = compact ? " " : " ";
  return conditions
    .map((c, i) => {
      const leaf = formatLeaf(c, entities, compact);
      return i === 0 ? leaf : `${operators[i - 1]}${sep}${leaf}`;
    })
    .join(sep);
}
