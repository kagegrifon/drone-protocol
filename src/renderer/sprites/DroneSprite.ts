import Phaser from 'phaser';
import { COLORS } from '../config.js';

const TRAIL_MAX = 8;

type GlowMode = 'normal' | 'mining' | 'charging';

const GLOW_CONFIG: Record<GlowMode, { color: number; radius: number; duration: number }> = {
  normal:   { color: COLORS.DRONE_LIGHT, radius: 3,  duration: 700 },
  mining:   { color: 0xff8800,           radius: 5,  duration: 400 },
  charging: { color: 0x00aaff,           radius: 4,  duration: 280 },
};

export class DroneSprite extends Phaser.GameObjects.Container {
  private readonly _body: Phaser.GameObjects.Image;
  private readonly _light: Phaser.GameObjects.Arc;
  private _blinkTween: Phaser.Tweens.Tween;
  private _idleTween: Phaser.Tweens.Tween | null = null;
  private _glowMode: GlowMode = 'normal';
  private readonly _trail: { x: number; y: number }[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    this._body = scene.add.image(0, 0, 'sprite_drone');
    this._light = scene.add.arc(10, -10, 3, 0, 360, false, COLORS.DRONE_LIGHT, 1);

    this.add([this._body, this._light]);
    this.setDepth(10);
    scene.add.existing(this);

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
