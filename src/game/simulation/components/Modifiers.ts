export type ModifierId = 'drained' | 'overloaded:light' | 'overloaded:medium' | 'overloaded:heavy';

export interface ModifiersComponent {
  active: ModifierId[];
}
