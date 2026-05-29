import Phaser from 'phaser';
import { COLORS } from '../config.js';

const TRAIL_MAX = 8;

type GlowMode = 'normal' | 'mining' | 'charging';

const GLOW_CONFIG: Record<GlowMode, { color: number; radius: number; duration: number }> = {
  normal:   { color: COLORS.DRONE_LIGHT, radius: 3,  duration: 700 },
  mining:   { color: 0xff8800,           radius: 5,  duration: 400 },
  charging: { color: 0x00aaff,           radius: 4,  duration: 280 },
};

const SELECTION_RING_RADIUS = 16;
const SELECTION_RING_COLOR = 0xffffff;
const SELECTION_RING_THICKNESS = 2;

const BAR_WIDTH = 28;
const BAR_HEIGHT = 3;
const BAR_BG_COLOR = 0x000000;
const BAR_BG_ALPHA = 0.55;
const ENERGY_BAR_Y = -16;
const LOAD_BAR_Y = -12;
const ENERGY_BAR_COLOR = 0x00d4ff;
const LOAD_BAR_COLOR = 0x00ff88;

export class DroneSprite extends Phaser.GameObjects.Container {
  private readonly _body: Phaser.GameObjects.Image;
  private readonly _light: Phaser.GameObjects.Arc;
  private readonly _selectionRing: Phaser.GameObjects.Arc;
  private readonly _energyBar: Phaser.GameObjects.Graphics;
  private readonly _loadBar: Phaser.GameObjects.Graphics;
  private _blinkTween: Phaser.Tweens.Tween;
  private _idleTween: Phaser.Tweens.Tween | null = null;
  private _glowMode: GlowMode = 'normal';
  private readonly _trail: { x: number; y: number }[] = [];
  private _lastEnergyRatio = -1;
  private _lastLoadRatio = -1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    this._body = scene.add.image(0, 0, 'sprite_drone');
    this._light = scene.add.arc(10, -10, 3, 0, 360, false, COLORS.DRONE_LIGHT, 1);

    this._selectionRing = scene.add.arc(0, 0, SELECTION_RING_RADIUS, 0, 360, false);
    this._selectionRing.setStrokeStyle(SELECTION_RING_THICKNESS, SELECTION_RING_COLOR, 1);
    this._selectionRing.setFillStyle();
    this._selectionRing.setVisible(false);

    this._energyBar = scene.add.graphics();
    this._loadBar = scene.add.graphics();

    this.add([this._light, this._selectionRing, this._body, this._energyBar, this._loadBar]);
    this.setDepth(10);
    scene.add.existing(this);

    this._redrawBar(this._energyBar, 0, ENERGY_BAR_Y, ENERGY_BAR_COLOR);
    this._redrawBar(this._loadBar, 0, LOAD_BAR_Y, LOAD_BAR_COLOR);

    this._blinkTween = scene.tweens.add({
      targets: this._light,
      alpha: { from: 1, to: 0 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  setGlowMode(mode: GlowMode): void {
    if (this._glowMode === mode) return;
    this._glowMode = mode;

    const cfg = GLOW_CONFIG[mode];
    this._light.setFillStyle(cfg.color, 1);
    this._light.setRadius(cfg.radius);

    this._blinkTween.remove();
    this._blinkTween = this.scene.tweens.add({
      targets: this._light,
      alpha: { from: 1, to: 0 },
      duration: cfg.duration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  setIdleAnimation(idle: boolean): void {
    if (idle) {
      if (this._idleTween) return;
      this._idleTween = this.scene.tweens.add({
        targets: this,
        scaleX: { from: 0.95, to: 1.05 },
        scaleY: { from: 0.95, to: 1.05 },
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      this._idleTween?.remove();
      this._idleTween = null;
      this.setScale(1);
    }
  }

  setSelected(selected: boolean): void {
    this._selectionRing.setVisible(selected);
  }

  updateStats(energyRatio: number, loadRatio: number): void {
    const e = Phaser.Math.Clamp(energyRatio, 0, 1);
    const l = Phaser.Math.Clamp(loadRatio, 0, 1);
    if (e !== this._lastEnergyRatio) {
      this._redrawBar(this._energyBar, e, ENERGY_BAR_Y, ENERGY_BAR_COLOR);
      this._lastEnergyRatio = e;
    }
    if (l !== this._lastLoadRatio) {
      this._redrawBar(this._loadBar, l, LOAD_BAR_Y, LOAD_BAR_COLOR);
      this._lastLoadRatio = l;
    }
  }

  private _redrawBar(g: Phaser.GameObjects.Graphics, ratio: number, y: number, fillColor: number): void {
    const x = -BAR_WIDTH / 2;
    g.clear();
    g.fillStyle(BAR_BG_COLOR, BAR_BG_ALPHA);
    g.fillRect(x, y, BAR_WIDTH, BAR_HEIGHT);
    if (ratio > 0) {
      g.fillStyle(fillColor, 1);
      g.fillRect(x, y, BAR_WIDTH * ratio, BAR_HEIGHT);
    }
  }

  updateVisual(px: number, py: number): void {
    this._trail.push({ x: this.x, y: this.y });
    if (this._trail.length > TRAIL_MAX) this._trail.shift();
    this.setPosition(px, py);
  }

  getTrail(): ReadonlyArray<{ x: number; y: number }> {
    return this._trail;
  }

  destroy(fromScene?: boolean): void {
    this._blinkTween.remove();
    this._idleTween?.remove();
    super.destroy(fromScene);
  }
}
