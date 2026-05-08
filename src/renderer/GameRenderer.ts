import Phaser from 'phaser';
import type { World } from '../game/simulation/world/World.js';
import type { Grid } from '../game/simulation/world/Grid.js';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { CANVAS_W, CANVAS_H, COLORS } from './config.js';

export class GameRenderer {
  private readonly _game: Phaser.Game;

  constructor(world: World, grid: Grid, parent: HTMLElement) {
    this._game = new Phaser.Game({
      type: Phaser.AUTO,
      width: CANVAS_W,
      height: CANVAS_H,
      backgroundColor: `#${COLORS.BG.toString(16).padStart(6, '0')}`,
      parent,
      scene: [BootScene, GameScene],
      callbacks: {
        preBoot: (game: Phaser.Game) => {
          game.registry.set('world', world);
          game.registry.set('grid', grid);
        },
      },
    });
  }

  // GameRenderer does NOT own the simulation tick loop.
  // Phase 8 GameController will drive simulation ticks externally.
  destroy(): void {
    this._game.destroy(true);
  }
}
