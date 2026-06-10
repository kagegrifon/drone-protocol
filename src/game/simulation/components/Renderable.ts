export type SpriteType = "drone" | "base" | "mine" | "charger";

export interface RenderableComponent {
  spriteType: SpriteType;
  visible: boolean;
  tint: number;
}
