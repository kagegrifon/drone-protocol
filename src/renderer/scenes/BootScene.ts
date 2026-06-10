import Phaser from "phaser";
import { COLORS } from "../config.js";
import { BASE_PATH } from "@/constant.js";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    this.load.audio("music", `${BASE_PATH}music/Orbital Rain.mp3`);
    this.load.audio("mine_click", `${BASE_PATH}sound/mine_click.mp3`);
    this.load.audio("robot_click", `${BASE_PATH}sound/robot_click.wav`);
    this.load.audio("drone_hum", `${BASE_PATH}sound/drone_hum.mp3`);
  }

  create(): void {
    this.createDroneTexture();
    this.createBaseTexture();
    this.createMineTexture();
    this.createChargerTexture();
    this.createParticleTexture();
    this.synthesizeAudio();
    this.scene.start("GameScene");
  }

  private createParticleTexture(): void {
    const g = this.make.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture("particle_dust", 8, 8);
    g.destroy();
  }

  private synthesizeAudio(): void {
    const ctx = (this.sound as Phaser.Sound.WebAudioSoundManager).context;
    const sr = ctx.sampleRate;

    // drop_ore: нисходящий тон 400→200 Hz + шум
    {
      const dur = 0.35;
      const n = Math.floor(sr * dur);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const freq = 400 - 200 * (t / 0.3);
        const gain = Math.exp(-t * 10);
        const tone = Math.sin(2 * Math.PI * freq * t) * gain * 0.5;
        const noise =
          t < 0.05 ? (Math.random() * 2 - 1) * Math.exp(-t * 80) * 0.3 : 0;
        d[i] = tone + noise;
      }
      this.registry.set("synth_drop_ore", buf);
    }

    // charge_buzz: 120 Hz с FM wobble ±5 Hz, loopable
    {
      const dur = 1.0;
      const n = Math.floor(sr * dur);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const wobble = Math.sin(2 * Math.PI * 5 * t) * 5;
        const phase = ((120 + wobble) * t) % 1;
        d[i] = phase < 0.5 ? 0.12 : -0.12;
      }
      this.registry.set("synth_charge_buzz", buf);
    }

    // mission_complete: C5→E5→G5
    {
      const dur = 1.5;
      const n = Math.floor(sr * dur);
      const buf = ctx.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      const notes = [
        { freq: 523.25, start: 0, end: 0.5 },
        { freq: 659.25, start: 0.15, end: 0.75 },
        { freq: 783.99, start: 0.3, end: 1.5 },
      ];
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        let s = 0;
        for (const note of notes) {
          if (t < note.start || t > note.end) continue;
          const lt = t - note.start;
          const env = lt < 0.01 ? lt / 0.01 : Math.exp(-(lt - 0.01) * 3);
          s += Math.sin(2 * Math.PI * note.freq * lt) * env * 0.25;
        }
        d[i] = Math.max(-1, Math.min(1, s));
      }
      this.registry.set("synth_mission_complete", buf);
    }
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
    g.generateTexture("sprite_drone", 48, 48);
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
    g.generateTexture("sprite_base", 48, 48);
    g.destroy();
  }

  private createMineTexture(): void {
    const g = this.make.graphics();
    g.fillStyle(COLORS.MINE_ACCENT, 0.1);
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
    g.generateTexture("sprite_mine", 48, 48);
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
    g.generateTexture("sprite_charger", 48, 48);
    g.destroy();
  }
}
