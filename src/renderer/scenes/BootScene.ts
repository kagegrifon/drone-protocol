import Phaser from 'phaser';
import { COLORS } from '../config.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    this.createDroneTexture();
    this.createBaseTexture();
    this.createMineTexture();
    this.createChargerTexture();
    this.scene.start('GameScene');
  }

  private createDroneTexture(): void {
    const g = this.make.graphics();
    // Glow rings (outer → inner, increasing alpha)
    g.fillStyle(COLORS.DRONE_GLOW, 0.05);
    g.fillCircle(24, 24, 22);
    g.fillStyle(COLORS.DRONE_GLOW, 0.12);
    g.fillCircle(24, 24, 17);
    g.fillStyle(COLORS.DRONE_GLOW, 0.25);
    g.fillCircle(24, 24, 13);
    // Solid body
    g.fillStyle(COLORS.DRONE_BODY, 1.0);
    g.fillCircle(24, 24, 9);
    g.generateTexture('sprite_drone', 48, 48);
    g.destroy();
  }

  private createBaseTexture(): void {
    const g = this.make.graphics();
    g.fillStyle(COLORS.BASE_ACCENT, 0.12);
    g.fillRect(2, 2, 44, 44);
    g.fillStyle(COLORS.BASE_ACCENT, 0.55);
    g.fillRect(8, 8, 32, 32);
    g.lineStyle(2, COLORS.BASE_ACCENT, 1);
    g.strokeRect(4, 4, 40, 40);
    g.generateTexture('sprite_base', 48, 48);
    g.destroy();
  }

  private createMineTexture(): void {
    const g = this.make.graphics();
    g.fillStyle(COLORS.MINE_ACCENT, 0.10);
    g.fillRect(4, 4, 40, 40);
    g.fillStyle(COLORS.MINE_ACCENT, 0.45);
    g.fillRect(9, 9, 30, 30);
    g.lineStyle(2, COLORS.MINE_ACCENT, 0.8);
    g.strokeRect(6, 6, 36, 36);
    // Diamond outline
    g.lineStyle(1, COLORS.MINE_ACCENT, 0.35);
    g.beginPath();
    g.moveTo(24, 10);
    g.lineTo(38, 24);
    g.lineTo(24, 38);
    g.lineTo(10, 24);
    g.lineTo(24, 10);
    g.strokePath();
    g.generateTexture('sprite_mine', 48, 48);
    g.destroy();
  }

  private createChargerTexture(): void {
    const g = this.make.graphics();
    g.fillStyle(COLORS.CHARGER_ACCENT, 0.12);
    g.fillRect(2, 2, 44, 44);
    g.fillStyle(COLORS.CHARGER_ACCENT, 0.45);
    g.fillRect(8, 8, 32, 32);
    g.lineStyle(2, COLORS.CHARGER_ACCENT, 1);
    g.strokeRect(5, 5, 38, 38);
    // Lightning bolt
    g.fillStyle(COLORS.CHARGER_ACCENT, 0.9);
    g.fillTriangle(24, 11, 30, 25, 24, 25);
    g.fillTriangle(24, 25, 18, 25, 24, 37);
    g.generateTexture('sprite_charger', 48, 48);
    g.destroy();
  }
}
