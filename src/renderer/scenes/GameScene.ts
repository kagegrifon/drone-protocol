import Phaser from "phaser";
import type { World } from "../../game/simulation/world/World.js";
import type { Grid } from "../../game/simulation/world/Grid.js";
import type { CellType } from "../../shared/constants/cellTypes.js";
import type { EntityId } from "../../shared/types/index.js";
import { DroneSprite } from "../sprites/DroneSprite.js";
import { AudioManager } from "../audio/AudioManager.js";
import { gameEvents } from "../../shared/events/gameEvents.js";
import { TILE_SIZE, COLORS, TILE_COLORS } from "../config.js";
import { useGameStore } from "../../shared/store/gameStore.js";
import { DT } from "../../game/simulation/constants.js";
import { interpolateVisualPos } from "./interpolatePosition.js";

const BUILDING_TILES = new Set<CellType>(["mine", "base", "charger"]);

export class GameScene extends Phaser.Scene {
  private _world!: World;
  private _grid!: Grid;
  private _droneSprites: Map<EntityId, DroneSprite> = new Map();
  private _staticSprites: Map<EntityId, Phaser.GameObjects.Image> = new Map();
  private _trailGraphics!: Phaser.GameObjects.Graphics;
  private _audio!: AudioManager;
  private _dustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private _chargingCount = 0;
  private _tick = 0;
  private _hoverHighlight!: Phaser.GameObjects.Graphics;
  private _hoverPrevCell: { x: number; y: number } | null = null;

  // Доинтерполяция внутри симуляционного тика: засекаем начало каждого тика,
  // чтобы плавно «доводить» прогресс шага между дискретными апдейтами симуляции.
  private _lastSimTick = -1;
  private _tickStartMs = 0;
  private _lastSelectedId: EntityId | null = null;

  constructor() {
    super({ key: "GameScene" });
  }

  create(): void {
    this._world = this.registry.get("world") as World;
    this._grid = this.registry.get("grid") as Grid;

    // AudioManager
    this._audio = new AudioManager(this.sound);
    const dropOreBuf = this.registry.get("synth_drop_ore") as AudioBuffer;
    const chargeBuf = this.registry.get("synth_charge_buzz") as AudioBuffer;
    const completeBuf = this.registry.get(
      "synth_mission_complete",
    ) as AudioBuffer;
    this._audio.addSynthBuffer("drop_ore", dropOreBuf);
    this._audio.addSynthBuffer("charge_buzz", chargeBuf);
    this._audio.addSynthBuffer("mission_complete", completeBuf);
    this._audio.playMusic();

    const onAudioReady = this.registry.get("onAudioReady") as
      | ((am: AudioManager) => void)
      | undefined;
    onAudioReady?.(this._audio);

    // Particle emitter for mining dust (texture создана в BootScene)
    this._dustEmitter = this.add.particles(0, 0, "particle_dust", {
      speed: { min: 40, max: 80 },
      angle: { min: 250, max: 290 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 500,
      tint: 0x8b7355,
      emitting: false,
    });
    this._dustEmitter.setDepth(15);

    // Subscribe to game events
    this._setupEventListeners();
    // "gameout" fires when the pointer leaves the canvas element (not a game object).
    // "pointerout" fires when the pointer leaves an interactive game object — wrong for this use.
    this.input.on("gameout", () => this.clearHover());

    const worldW = this._grid.width * TILE_SIZE;
    const worldH = this._grid.height * TILE_SIZE;
    this.drawTileMap(worldW, worldH);
    this._trailGraphics = this.add.graphics().setDepth(8);
    this._hoverHighlight = this.add.graphics().setDepth(6);
    this._hoverHighlight.setVisible(false);
    this.setupEntitySprites();
    this.setupCamera(worldW, worldH);

    const onReady = this.registry.get("onReady") as (() => void) | undefined;
    onReady?.();
  }

  private _setupEventListeners(): void {
    gameEvents.on("ore:mined", ({ droneId, x, y }) => {
      this._audio.playOnce("mine_click");
      const px = x * TILE_SIZE + TILE_SIZE / 2;
      const py = y * TILE_SIZE + TILE_SIZE / 2;
      this._dustEmitter.explode(5, px, py);

      const sprite = this._droneSprites.get(droneId);
      if (sprite) {
        sprite.setGlowMode("mining");
        this.time.delayedCall(800, () => {
          if (this._droneSprites.has(droneId)) sprite.setGlowMode("normal");
        });
      }
    });

    gameEvents.on("ore:dropped", ({ droneId }) => {
      this._audio.playSynth("drop_ore");
      const pos = this._world.getComponent(droneId, "Position");
      if (pos) {
        for (const [id, img] of this._staticSprites) {
          const sp = this._world.getComponent(id, "Position");
          if (sp && sp.x === pos.x && sp.y === pos.y) {
            img.setTint(0xffffff);
            this.time.delayedCall(200, () => img.clearTint());
            break;
          }
        }
      }
    });

    gameEvents.on("charge:started", () => {
      this._chargingCount++;
      if (this._chargingCount === 1) this._audio.startSynthLoop("charge_buzz");
    });

    gameEvents.on("charge:completed", ({ droneId }) => {
      this._chargingCount = Math.max(0, this._chargingCount - 1);
      if (this._chargingCount === 0) this._audio.stopSynthLoop("charge_buzz");
      const sprite = this._droneSprites.get(droneId);
      sprite?.setGlowMode("normal");
    });

    gameEvents.on("mission:complete", () => {
      this._audio.playSynth("mission_complete");
    });
  }

  update(): void {
    this._tick++;
    this._trailGraphics.clear();
    this.syncSprites();
  }

  private drawTileMap(worldW: number, worldH: number): void {
    const g = this.add.graphics().setDepth(0);
    for (let ty = 0; ty < this._grid.height; ty++) {
      for (let tx = 0; tx < this._grid.width; tx++) {
        const cellType = this._grid.getTile(tx, ty);
        g.fillStyle(TILE_COLORS[cellType], 1);
        g.fillRect(
          tx * TILE_SIZE + 1,
          ty * TILE_SIZE + 1,
          TILE_SIZE - 2,
          TILE_SIZE - 2,
        );
      }
    }
    g.lineStyle(1, COLORS.GRID_LINE, 0.25);
    for (let i = 0; i <= this._grid.width; i++) {
      g.beginPath();
      g.moveTo(i * TILE_SIZE, 0);
      g.lineTo(i * TILE_SIZE, worldH);
      g.strokePath();
    }
    for (let i = 0; i <= this._grid.height; i++) {
      g.beginPath();
      g.moveTo(0, i * TILE_SIZE);
      g.lineTo(worldW, i * TILE_SIZE);
      g.strokePath();
    }
  }

  private drawHoverHighlight(cell: { x: number; y: number; isBuilding: boolean }): void {
    const px = cell.x * TILE_SIZE;
    const py = cell.y * TILE_SIZE;

    this._hoverHighlight.clear();
    if (!cell.isBuilding) {
      this._hoverHighlight.fillStyle(COLORS.DRONE_GLOW, 0.12);
      this._hoverHighlight.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    }
    this._hoverHighlight.lineStyle(2, COLORS.DRONE_GLOW, 0.9);
    // Обводку вжимаем на 1px со всех сторон, чтобы 2px-линия осталась внутри клетки.
    this._hoverHighlight.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    this._hoverHighlight.setVisible(true);
  }

  private isBuildingTile(tile: CellType): boolean {
    return BUILDING_TILES.has(tile);
  }

  private clearHover(): void {
    if (this._hoverPrevCell === null) return;
    this._hoverPrevCell = null;
    this._hoverHighlight.setVisible(false);
    useGameStore.getState().setHoveredCell(null);
  }

  private updateHoveredCell(pointer: Phaser.Input.Pointer): void {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cellX = Math.floor(world.x / TILE_SIZE);
    const cellY = Math.floor(world.y / TILE_SIZE);

    const tile = this._grid.getTile(cellX, cellY);
    const onField = tile !== "wall";
    if (!onField) {
      this.clearHover();
      return;
    }

    const prev = this._hoverPrevCell;
    if (prev !== null && prev.x === cellX && prev.y === cellY) return;

    this._hoverPrevCell = { x: cellX, y: cellY };
    this.drawHoverHighlight({ x: cellX, y: cellY, isBuilding: this.isBuildingTile(tile) });
    useGameStore.getState().setHoveredCell({ x: cellX, y: cellY });
  }

  private setupEntitySprites(): void {
    for (const entityId of this._world.query("Position", "Renderable")) {
      this.ensureSprite(entityId);
    }
  }

  private ensureSprite(entityId: EntityId): void {
    const pos = this._world.getComponent(entityId, "Position");
    const renderable = this._world.getComponent(entityId, "Renderable");
    if (!pos || !renderable) return;

    const cx = pos.x * TILE_SIZE + TILE_SIZE / 2;
    const cy = pos.y * TILE_SIZE + TILE_SIZE / 2;

    if (renderable.spriteType === "drone") {
      if (!this._droneSprites.has(entityId)) {
        const sprite = new DroneSprite(this, cx, cy);
        const onDroneClick = this.registry.get("onDroneClick") as
          | ((id: EntityId) => void)
          | undefined;
        if (onDroneClick) {
          sprite.setSize(TILE_SIZE, TILE_SIZE);
          sprite.setInteractive();
          sprite.on("pointerdown", () => onDroneClick(entityId));
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
    const entities = this._world.query("Position", "Renderable");
    const activeIds = new Set(entities);
    const store = useGameStore.getState();
    const selectedId = store.selectedDroneId;

    if (selectedId !== null && selectedId !== this._lastSelectedId) {
      const sprite = this._droneSprites.get(selectedId);
      if (sprite) {
        this.cameras.main.pan(sprite.x, sprite.y, 500, "Sine.easeInOut");
      }
    }
    this._lastSelectedId = selectedId;

    // Обнаружить новый симуляционный тик — засечь его начало для доинтерполяции
    const simTick = store.stats.tick;
    if (simTick !== this._lastSimTick) {
      this._lastSimTick = simTick;
      this._tickStartMs = performance.now();
    }

    for (const [id, sprite] of this._droneSprites) {
      if (!activeIds.has(id)) {
        sprite.destroy();
        this._droneSprites.delete(id);
      }
    }
    for (const [id, img] of this._staticSprites) {
      if (!activeIds.has(id)) {
        img.destroy();
        this._staticSprites.delete(id);
      }
    }

    // Коэффициент интерполяции между двумя последними симуляционными тиками
    const tickMs = DT * 1000;
    const elapsed = performance.now() - this._tickStartMs;
    const t = Phaser.Math.Clamp(elapsed / tickMs, 0, 1);

    for (const entityId of entities) {
      this.ensureSprite(entityId);

      const pos = this._world.getComponent(entityId, "Position")!;
      const renderable = this._world.getComponent(entityId, "Renderable")!;

      if (renderable.spriteType === "drone") {
        const sprite = this._droneSprites.get(entityId)!;
        const program = this._world.getComponent(entityId, "Program");

        const isIdle = !program || program.state === "idle";
        sprite.setIdleAnimation(isIdle);

        if (program?.state === "charge") {
          sprite.setGlowMode("charging");
        }

        sprite.setSelected(entityId === selectedId);
        sprite.setErrorState(!!program?.codeError);

        const energy = this._world.getComponent(entityId, "Energy");
        const inventory = this._world.getComponent(entityId, "Inventory");
        const energyRatio =
          energy && energy.max > 0 ? energy.current / energy.max : 0;
        const loadRatio =
          inventory && inventory.capacity > 0
            ? inventory.ore / inventory.capacity
            : 0;
        sprite.updateStats(energyRatio, loadRatio);

        const movement = this._world.getComponent(entityId, "Movement");

        // Дрон реально едет, только если зарезервировал целевую клетку или уже
        // накопил progress. Ждущий дрон (цель занята, движение не начато) держит
        // путь, но стоит на месте — его не нужно тянуть к целевой клетке.
        const hasReservedCell = movement?.reserved != null;
        const hasStartedMoving = (movement?.progress ?? 0) > 0;
        const isDriving = hasReservedCell || hasStartedMoving;

        let targetCell: { x: number; y: number } | null = null;
        if (movement && movement.path.length > 0 && isDriving) {
          targetCell = movement.path[0];
        }

        // При паузе: симуляция не продвигает progress, но t осциллирует
        // каждый глобальный тик → дрон дрожит без t-компоненты. То же для
        // ждущего дрона: targetCell === null, поэтому он остаётся на месте.
        const interpT = program?.localPaused ? 0 : t;
        const { x, y } = interpolateVisualPos(
          pos,
          targetCell,
          movement?.progress ?? 0,
          movement?.speed ?? 0,
          interpT,
          TILE_SIZE,
        );
        const prevX = sprite.x;
        const prevY = sprite.y;
        sprite.updateVisual(x, y);

        if (Math.abs(x - prevX) > 0.5 || Math.abs(y - prevY) > 0.5) {
          this._audio.stopShot("mine_click");
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

  private setupCamera(worldW: number, worldH: number): void {
    const cam = this.cameras.main;
    const maxZoom = 2.0;

    cam.setBounds(0, 0, worldW, worldH);
    cam.setBackgroundColor(COLORS.BG);

    const computeMinZoom = (): number => {
      const vw = this.scale.gameSize.width;
      const vh = this.scale.gameSize.height;
      if (vw === 0 || vh === 0) return 0.1;
      return Math.min(vw / worldW, vh / worldH);
    };

    cam.setZoom(1.0);
    const fp = this.registry.get("focusPoint") as
      | { x: number; y: number }
      | undefined;
    const cx = fp ? fp.x * TILE_SIZE + TILE_SIZE / 2 : worldW / 2;
    const cy = fp ? fp.y * TILE_SIZE + TILE_SIZE / 2 : worldH / 2;
    cam.centerOn(cx, cy);

    this.time.delayedCall(0, () => {
      const minZoom = computeMinZoom();
      if (cam.zoom < minZoom) cam.setZoom(minZoom);
    });

    this.scale.on("resize", () => {
      const minZoom = computeMinZoom();
      if (cam.zoom < minZoom) cam.setZoom(minZoom);
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
        cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
        this.clearHover();
        return;
      }
      this.updateHoveredCell(pointer);
    });

    this.sys.game.canvas.addEventListener(
      "wheel",
      (e: WheelEvent) => {
        e.preventDefault();
        if (!e.ctrlKey) return;
        const minZoom = computeMinZoom();
        cam.setZoom(
          Phaser.Math.Clamp(cam.zoom - e.deltaY * 0.001, minZoom, maxZoom),
        );
      },
      { passive: false },
    );
  }
}
