import Phaser from 'phaser';
import { COLORS } from '../config.js';

const TRAIL_MAX = 8;

export class DroneSprite extends Phaser.GameObjects.Container {
  private readonly _body: Phaser.GameObjects.Image;
  private readonly _light: Phaser.GameObjects.Arc;
  private readonly _blinkTween: Phaser.Tweens.Tween;
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
    super.destroy(fromScene);
  }
}
