import Phaser from 'phaser';
import type { World } from '../../game/simulation/world/World.js';
import type { Grid } from '../../game/simulation/world/Grid.js';
import type { PositionComponent } from '../../game/simulation/components/Position.js';
import type { MovementComponent } from '../../game/simulation/components/Movement.js';
import type { EntityId } from '../../shared/types/index.js';
import { DroneSprite } from '../sprites/DroneSprite.js';
import { TILE_SIZE, GRID_SIZE, CANVAS_W, CANVAS_H, COLORS, TILE_COLORS } from '../config.js';

export class GameScene extends Phaser.Scene {
  private _world!: World;
  private _grid!: Grid;
  private _droneSprites: Map<EntityId, DroneSprite> = new Map();
  private _staticSprites: Map<EntityId, Phaser.GameObjects.Image> = new Map();
  private _trailGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this._world = this.registry.get('world') as World;
    this._grid = this.registry.get('grid') as Grid;

    this.drawTileMap();
    this._trailGraphics = this.add.graphics().setDepth(8);
    this.setupEntitySprites();
    this.setupCamera();
  }

  update(): void {
    this._trailGraphics.clear();
    this.syncSprites();
  }

  private drawTileMap(): void {
    const g = this.add.graphics().setDepth(0);

    for (let ty = 0; ty < GRID_SIZE; ty++) {
      for (let tx = 0; tx < GRID_SIZE; tx++) {
        const cellType = this._grid.getTile(tx, ty);
        g.fillStyle(TILE_COLORS[cellType], 1);
        g.fillRect(tx * TILE_SIZE + 1, ty * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      }
    }

    // Grid lines
    g.lineStyle(1, COLORS.GRID_LINE, 0.25);
    for (let i = 0; i <= GRID_SIZE; i++) {
      g.beginPath();
      g.moveTo(i * TILE_SIZE, 0);
      g.lineTo(i * TILE_SIZE, CANVAS_H);
      g.strokePath();
      g.beginPath();
      g.moveTo(0, i * TILE_SIZE);
      g.lineTo(CANVAS_W, i * TILE_SIZE);
      g.strokePath();
    }
  }

  private setupEntitySprites(): void {
    for (const entityId of this._world.query('Position', 'Renderable')) {
      this.ensureSprite(entityId);
    }
  }

  private ensureSprite(entityId: EntityId): void {
    const pos = this._world.getComponent(entityId, 'Position');
    const renderable = this._world.getComponent(entityId, 'Renderable');
    if (!pos || !renderable) return;

    const cx = pos.x * TILE_SIZE + TILE_SIZE / 2;
    const cy = pos.y * TILE_SIZE + TILE_SIZE / 2;

    if (renderable.spriteType === 'drone') {
      if (!this._droneSprites.has(entityId)) {
        this._droneSprites.set(entityId, new DroneSprite(this, cx, cy));
      }
    } else {
      if (!this._staticSprites.has(entityId)) {
        const img = this.add.image(cx, cy, `sprite_${renderable.spriteType}`);
        img.setDepth(5);
        this._staticSprites.set(entityId, img);
      }
    }
  }

  private syncSprites(): void {
    const entities = this._world.query('Position', 'Renderable');
    const activeIds = new Set(entities);

    // Remove sprites for destroyed entities
    for (const [id, sprite] of this._droneSprites) {
      if (!activeIds.has(id)) { sprite.destroy(); this._droneSprites.delete(id); }
    }
    for (const [id, img] of this._staticSprites) {
      if (!activeIds.has(id)) { img.destroy(); this._staticSprites.delete(id); }
    }

    for (const entityId of entities) {
      this.ensureSprite(entityId);

      const pos = this._world.getComponent(entityId, 'Position')!;
      const renderable = this._world.getComponent(entityId, 'Renderable')!;
      const movement = this._world.getComponent(entityId, 'Movement');

      if (renderable.spriteType === 'drone') {
        const sprite = this._droneSprites.get(entityId)!;
        const { x, y } = this.getInterpolatedPos(pos, movement);
        sprite.updateVisual(x, y);

        // Draw trail
        const trail = sprite.getTrail();
        for (let i = 0; i < trail.length; i++) {
          const alpha = ((i + 1) / trail.length) * 0.35;
          this._trailGraphics.fillStyle(COLORS.DRONE_BODY, alpha);
          this._trailGraphics.fillCircle(trail[i].x, trail[i].y, 3);
        }
      } else {
        const img = this._staticSprites.get(entityId);
        if (img) img.setVisible(renderable.visible);
      }
    }
  }

  // NOTE: movement.progress assumed to be 0–1 for the current path step.
  // Verify and adjust in Phase 8 after GameLoop integration.
  private getInterpolatedPos(
    pos: PositionComponent,
    movement: MovementComponent | undefined,
  ): { x: number; y: number } {
    const baseX = pos.x * TILE_SIZE + TILE_SIZE / 2;
    const baseY = pos.y * TILE_SIZE + TILE_SIZE / 2;

    if (!movement || movement.path.length === 0 || movement.progress <= 0) {
      return { x: baseX, y: baseY };
    }

    const nextX = movement.path[0].x * TILE_SIZE + TILE_SIZE / 2;
    const nextY = movement.path[0].y * TILE_SIZE + TILE_SIZE / 2;
    const t = Phaser.Math.Clamp(movement.progress, 0, 1);

    return {
      x: Phaser.Math.Linear(baseX, nextX, t),
      y: Phaser.Math.Linear(baseY, nextY, t),
    };
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, CANVAS_W, CANVAS_H);
    cam.setBackgroundColor(COLORS.BG);

    // Pan on drag
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
        cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
      }
    });

    // Zoom on scroll wheel, clamped between 0.4× and 2.5×
    this.input.on('wheel', (_p: unknown, _go: unknown, _dx: unknown, dy: number) => {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.001, 0.4, 2.5));
    });
  }
}
