import Phaser from 'phaser';
import type { World } from '../../game/simulation/world/World.js';
import type { Grid } from '../../game/simulation/world/Grid.js';
import type { PositionComponent } from '../../game/simulation/components/Position.js';
import type { MovementComponent } from '../../game/simulation/components/Movement.js';
import type { EntityId } from '../../shared/types/index.js';
import { DroneSprite } from '../sprites/DroneSprite.js';
import { AudioManager } from '../audio/AudioManager.js';
import { gameEvents } from '../../shared/events/gameEvents.js';
import { TILE_SIZE, GRID_SIZE, CANVAS_W, CANVAS_H, COLORS, TILE_COLORS } from '../config.js';

export class GameScene extends Phaser.Scene {
  private _world!: World;
  private _grid!: Grid;
  private _droneSprites: Map<EntityId, DroneSprite> = new Map();
  private _staticSprites: Map<EntityId, Phaser.GameObjects.Image> = new Map();
  private _trailGraphics!: Phaser.GameObjects.Graphics;
  private _audio!: AudioManager;
  private _dustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private _miningThrottle = new Map<EntityId, number>(); // droneId → last emit tick
  private _robotThrottle = new Map<EntityId, number>();
  private _chargingCount = 0;
  private _droneHumActive = false;
  private _tick = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this._world = this.registry.get('world') as World;
    this._grid = this.registry.get('grid') as Grid;

    // AudioManager
    this._audio = new AudioManager(this.sound);
    const dropOreBuf = this.registry.get('synth_drop_ore') as AudioBuffer;
    const chargeBuf = this.registry.get('synth_charge_buzz') as AudioBuffer;
    const completeBuf = this.registry.get('synth_mission_complete') as AudioBuffer;
    this._audio.addSynthBuffer('drop_ore', dropOreBuf);
    this._audio.addSynthBuffer('charge_buzz', chargeBuf);
    this._audio.addSynthBuffer('mission_complete', completeBuf);
    this._audio.playMusic();

    const onAudioReady = this.registry.get('onAudioReady') as ((am: AudioManager) => void) | undefined;
    onAudioReady?.(this._audio);

    // Particle emitter for mining dust (texture создана в BootScene)
    this._dustEmitter = this.add.particles(0, 0, 'particle_dust', {
      speed: { min: 40, max: 80 },
      angle: { min: 250, max: 290 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 500,
      tint: 0x8B7355,
      emitting: false,
    });
    this._dustEmitter.setDepth(15);

    // Subscribe to game events
    this._setupEventListeners();

    this.drawTileMap();
    this._trailGraphics = this.add.graphics().setDepth(8);
    this.setupEntitySprites();
    this.setupCamera();

    const onReady = this.registry.get('onReady') as (() => void) | undefined;
    onReady?.();
  }

  private _setupEventListeners(): void {
    gameEvents.on('ore:mined', ({ droneId, x, y }) => {
      const now = this._tick;
      const last = this._miningThrottle.get(droneId) ?? -99;
      if (now - last >= 3) {
        this._audio.play('mine_click');
        this._miningThrottle.set(droneId, now);
      }
      const px = x * TILE_SIZE + TILE_SIZE / 2;
      const py = y * TILE_SIZE + TILE_SIZE / 2;
      this._dustEmitter.explode(5, px, py);

      const sprite = this._droneSprites.get(droneId);
      if (sprite) {
        sprite.setGlowMode('mining');
        this.time.delayedCall(800, () => {
          if (this._droneSprites.has(droneId)) sprite.setGlowMode('normal');
        });
      }
    });

    gameEvents.on('ore:dropped', ({ droneId }) => {
      this._audio.playSynth('drop_ore');
      const pos = this._world.getComponent(droneId, 'Position');
      if (pos) {
        for (const [id, img] of this._staticSprites) {
          const sp = this._world.getComponent(id, 'Position');
          if (sp && sp.x === pos.x && sp.y === pos.y) {
            img.setTint(0xffffff);
            this.time.delayedCall(200, () => img.clearTint());
            break;
          }
        }
      }
    });

    gameEvents.on('charge:started', () => {
      this._chargingCount++;
      if (this._chargingCount === 1) this._audio.startSynthLoop('charge_buzz');
    });

    gameEvents.on('charge:completed', ({ droneId }) => {
      this._chargingCount = Math.max(0, this._chargingCount - 1);
      if (this._chargingCount === 0) this._audio.stopSynthLoop('charge_buzz');
      const sprite = this._droneSprites.get(droneId);
      sprite?.setGlowMode('normal');
    });

    gameEvents.on('mission:complete', () => {
      this._audio.playSynth('mission_complete');
    });
  }

  update(): void {
    this._tick++;
    this._trailGraphics.clear();
    this.syncSprites();
    this.updateDroneHum();
  }

  private updateDroneHum(): void {
    const anyRunning = this._world
      .query('Program')
      .some((id) => this._world.getComponent(id, 'Program')!.state === 'running');

    if (anyRunning && !this._droneHumActive) {
      this._droneHumActive = true;
      this._audio.startFileLoop('drone_hum');
    } else if (!anyRunning && this._droneHumActive) {
      this._droneHumActive = false;
      this._audio.stopFileLoop('drone_hum');
    }
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
    g.lineStyle(1, COLORS.GRID_LINE, 0.25);
    for (let i = 0; i <= GRID_SIZE; i++) {
      g.beginPath(); g.moveTo(i * TILE_SIZE, 0); g.lineTo(i * TILE_SIZE, CANVAS_H); g.strokePath();
      g.beginPath(); g.moveTo(0, i * TILE_SIZE); g.lineTo(CANVAS_W, i * TILE_SIZE); g.strokePath();
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
        const sprite = new DroneSprite(this, cx, cy);
        const onDroneClick = this.registry.get('onDroneClick') as ((id: EntityId) => void) | undefined;
        if (onDroneClick) {
          sprite.setSize(TILE_SIZE, TILE_SIZE);
          sprite.setInteractive();
          sprite.on('pointerdown', () => onDroneClick(entityId));
        }
        this._droneSprites.set(entityId, sprite);
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
        const program = this._world.getComponent(entityId, 'Program');

        const isIdle = !program || program.state === 'idle';
        sprite.setIdleAnimation(isIdle);

        if (program?.waitingFor === 'charge') {
          sprite.setGlowMode('charging');
        }

        const { x, y } = this.getInterpolatedPos(pos, movement);
        const prev = { x: sprite.x, y: sprite.y };
        sprite.updateVisual(x, y);

        if (Math.abs(x - prev.x) > 0.5 || Math.abs(y - prev.y) > 0.5) {
          const last = this._robotThrottle.get(entityId) ?? -99;
          if (this._tick - last >= 10) {
            this._audio.play('robot_click');
            this._robotThrottle.set(entityId, this._tick);
          }
        }

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
    return { x: Phaser.Math.Linear(baseX, nextX, t), y: Phaser.Math.Linear(baseY, nextY, t) };
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    const worldW = CANVAS_W;
    const worldH = CANVAS_H;
    const minZoom = Math.max(CANVAS_W / worldW, CANVAS_H / worldH);
    const maxZoom = 2.0;

    cam.setBounds(0, 0, worldW, worldH);
    cam.setBackgroundColor(COLORS.BG);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
        cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
      }
    });

    this.sys.game.canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      if (!e.ctrlKey) return;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom - e.deltaY * 0.001, minZoom, maxZoom));
    }, { passive: false });
  }
}
