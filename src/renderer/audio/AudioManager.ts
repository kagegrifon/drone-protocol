import Phaser from "phaser";

type FileSoundKey = "music" | "mine_click" | "robot_click" | "drone_hum";
type SynthSoundKey = "drop_ore" | "charge_buzz" | "mission_complete";

export class AudioManager {
  private readonly _sm: Phaser.Sound.WebAudioSoundManager;
  private readonly _ctx: AudioContext;
  private readonly _sfxGain: GainNode;

  private _musicSound: Phaser.Sound.WebAudioSound | null = null;
  private _musicVol = 0.7;
  private _sfxVol = 0.8;

  private readonly _fileLoops = new Map<
    FileSoundKey,
    Phaser.Sound.WebAudioSound
  >();
  private readonly _playingShots = new Map<
    FileSoundKey,
    Phaser.Sound.WebAudioSound
  >();
  private readonly _synthBuffers = new Map<SynthSoundKey, AudioBuffer>();
  private readonly _synthLoops = new Map<
    SynthSoundKey,
    AudioBufferSourceNode
  >();

  constructor(sm: Phaser.Sound.BaseSoundManager) {
    this._sm = sm as Phaser.Sound.WebAudioSoundManager;
    this._ctx = this._sm.context;

    this._sfxGain = this._ctx.createGain();
    this._sfxGain.gain.value = this._sfxVol;
    this._sfxGain.connect(this._ctx.destination);
  }

  addSynthBuffer(key: SynthSoundKey, buffer: AudioBuffer): void {
    this._synthBuffers.set(key, buffer);
  }

  playMusic(): void {
    if (this._musicSound?.isPlaying) return;
    this._musicSound?.destroy();
    this._musicSound = this._sm.add("music", {
      loop: true,
      volume: this._musicVol,
    }) as Phaser.Sound.WebAudioSound;
    this._musicSound.play();
  }

  stopMusic(): void {
    this._musicSound?.stop();
  }

  play(key: FileSoundKey): void {
    this._sm.play(key, { volume: this._sfxVol });
  }

  playOnce(key: FileSoundKey): void {
    const existing = this._playingShots.get(key);
    if (existing?.isPlaying) return;
    existing?.destroy();
    const sound = this._sm.add(key, {
      volume: this._sfxVol,
    }) as Phaser.Sound.WebAudioSound;
    sound.once("complete", () => {
      this._playingShots.delete(key);
      sound.destroy();
    });
    sound.play();
    this._playingShots.set(key, sound);
  }

  stopShot(key: FileSoundKey): void {
    const sound = this._playingShots.get(key);
    if (!sound) return;
    sound.stop();
    sound.destroy();
    this._playingShots.delete(key);
  }

  startFileLoop(key: FileSoundKey): void {
    if (this._fileLoops.has(key)) return;
    const s = this._sm.add(key, {
      loop: true,
      volume: this._sfxVol,
    }) as Phaser.Sound.WebAudioSound;
    s.play();
    this._fileLoops.set(key, s);
  }

  stopFileLoop(key: FileSoundKey): void {
    const s = this._fileLoops.get(key);
    if (!s) return;
    s.stop();
    s.destroy();
    this._fileLoops.delete(key);
  }

  playSynth(key: SynthSoundKey): void {
    const buffer = this._synthBuffers.get(key);
    if (!buffer) return;
    const src = this._ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this._sfxGain);
    src.start();
  }

  startSynthLoop(key: SynthSoundKey): void {
    if (this._synthLoops.has(key)) return;
    const buffer = this._synthBuffers.get(key);
    if (!buffer) return;
    const src = this._ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(this._sfxGain);
    src.start();
    this._synthLoops.set(key, src);
  }

  stopSynthLoop(key: SynthSoundKey): void {
    const src = this._synthLoops.get(key);
    if (!src) return;
    src.stop();
    this._synthLoops.delete(key);
  }

  setMusicVolume(v: number): void {
    this._musicVol = v;
    this._musicSound?.setVolume(v);
  }

  setSfxVolume(v: number): void {
    this._sfxVol = v;
    this._sfxGain.gain.value = v;
    for (const s of this._fileLoops.values()) s.setVolume(v);
    for (const s of this._playingShots.values()) s.setVolume(v);
  }

  destroy(): void {
    this._musicSound?.destroy();
    for (const s of this._fileLoops.values()) {
      s.stop();
      s.destroy();
    }
    for (const s of this._playingShots.values()) {
      s.stop();
      s.destroy();
    }
    for (const src of this._synthLoops.values()) {
      try {
        src.stop();
      } catch {
        /* ignore */
      }
    }
  }
}
