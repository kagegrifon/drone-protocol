import Phaser from "phaser";
import type { World } from "../game/simulation/world/World.js";
import type { Grid } from "../game/simulation/world/Grid.js";
import type { EntityId } from "../shared/types/index.js";
import type { AudioManager } from "./audio/AudioManager.js";
import { BootScene } from "./scenes/BootScene.js";
import { GameScene } from "./scenes/GameScene.js";
import { COLORS } from "./config.js";

export interface GameRendererOptions {
  onDroneClick?: (id: EntityId) => void;
  onReady?: () => void;
  onAudioReady?: (am: AudioManager) => void;
}

export class GameRenderer {
  private readonly _game: Phaser.Game;

  constructor(
    world: World,
    grid: Grid,
    parent: HTMLElement,
    options: GameRendererOptions = {},
  ) {
    this._game = new Phaser.Game({
      type: Phaser.AUTO,
      backgroundColor: `#${COLORS.BG.toString(16).padStart(6, "0")}`,
      parent,
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: "100%",
        height: "100%",
      },
      scene: [BootScene, GameScene],
      callbacks: {
        preBoot: (game: Phaser.Game) => {
          game.registry.set("world", world);
          game.registry.set("grid", grid);
          if (options.onDroneClick)
            game.registry.set("onDroneClick", options.onDroneClick);
          if (options.onReady) game.registry.set("onReady", options.onReady);
          if (options.onAudioReady)
            game.registry.set("onAudioReady", options.onAudioReady);
        },
      },
    });
  }

  destroy(): void {
    this._game.destroy(true);
  }
}
