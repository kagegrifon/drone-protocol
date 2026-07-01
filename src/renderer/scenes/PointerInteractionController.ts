import Phaser from "phaser";
import type { Grid } from "../../game/simulation/world/Grid.js";
import type { CellType } from "../../shared/constants/cellTypes.js";
import { TILE_SIZE, COLORS } from "../config.js";
import { useGameStore } from "../../shared/store/gameStore.js";

const BUILDING_TILES = new Set<CellType>(["mine", "base", "charger"]);

// Смещение указателя (в пикселях) больше этого порога считаем панорамированием, а не кликом.
const CLICK_DRAG_THRESHOLD_PX = 4;

/**
 * Ховер клетки и выбор клетки кликом — вынесено из GameScene (фича cell-coordinates-hud).
 * Владеет собственной hover-графикой; вешает свои обработчики pointermove/down/up/gameout.
 * Выбор дрона имеет приоритет над клеткой под ним: спрайт дрона взводит флаг жеста через
 * markDroneSelectedThisGesture().
 */
export class PointerInteractionController {
  private readonly _scene: Phaser.Scene;
  private readonly _grid: Grid;
  private readonly _hoverHighlight: Phaser.GameObjects.Graphics;
  private _hoverPrevCell: { x: number; y: number } | null = null;
  // Различаем клик по клетке от драг-панорамирования: запоминаем старт жеста,
  // а флаг взводится, если на этом жесте уже выбран дрон (у дрона приоритет).
  private _pointerDownAt: { x: number; y: number } | null = null;
  private _droneSelectedThisGesture = false;

  constructor(options: { scene: Phaser.Scene; grid: Grid }) {
    this._scene = options.scene;
    this._grid = options.grid;

    this._hoverHighlight = this._scene.add.graphics().setDepth(6);
    this._hoverHighlight.setVisible(false);

    // "gameout" fires when the pointer leaves the canvas element (not a game object).
    // "pointerout" fires when the pointer leaves an interactive game object — wrong for this use.
    this._scene.input.on("gameout", () => this.clearHover());

    this._scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      // При драге (панорамирование камеры) ховер скрыт; сам скролл камеры
      // делает GameScene своим отдельным pointermove-слушателем.
      if (pointer.isDown) {
        this.clearHover();
        return;
      }
      this.updateHoveredCell(pointer);
    });

    // Клик по клетке (не по дрону, не панорама) → выбрать клетку в INSPECTOR.
    // Флаг _droneSelectedThisGesture НЕ сбрасываем здесь: Phaser эмитит
    // object-level "pointerdown" спрайта дрона раньше сценевого "pointerdown"
    // (см. InputPlugin.processDownEvents), так что сброс тут перезаписал бы
    // флаг, который спрайт уже взвёл в рамках того же жеста. Сбрасываем его
    // в pointerup — к следующему жесту он снова false.
    this._scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this._pointerDownAt = { x: pointer.x, y: pointer.y };
    });

    this._scene.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      const downAt = this._pointerDownAt;
      this._pointerDownAt = null;
      const droneSelected = this._droneSelectedThisGesture;
      this._droneSelectedThisGesture = false;
      if (droneSelected) return; // дрон уже выбран этим жестом
      if (!downAt) return;

      const moved = Math.hypot(pointer.x - downAt.x, pointer.y - downAt.y);
      if (moved > CLICK_DRAG_THRESHOLD_PX) return; // это было панорамирование

      const cell = this.pointerToCell(pointer);
      if (!cell) return;

      const onCellClick = this._scene.registry.get("onCellClick") as
        | ((cell: { x: number; y: number }) => void)
        | undefined;
      onCellClick?.(cell);
    });
  }

  /**
   * Спрайт дрона вызывает это в своём pointerdown: дрон имеет приоритет над выбором
   * клетки, помечаем жест, чтобы pointerup не перезаписал выбор клеткой под дроном.
   */
  markDroneSelectedThisGesture(): void {
    this._droneSelectedThisGesture = true;
  }

  private isBuildingTile(tile: CellType): boolean {
    return BUILDING_TILES.has(tile);
  }

  /**
   * Курсор действительно над спрайтом дрона (hit-test по реальной, интерполированной
   * позиции на экране) — дрон плавно едет между клетками, поэтому логическая Position
   * не годится: во время движения она отстаёт от того, что видит игрок.
   */
  private isPointerOverDrone(pointer: Phaser.Input.Pointer): boolean {
    const objectsUnderPointer = this._scene.input.hitTestPointer(pointer);
    return objectsUnderPointer.some(
      (obj) => obj.getData?.("isDrone") === true,
    );
  }

  private clearHover(): void {
    this._scene.sys.game.canvas.style.cursor = "default";
    this.clearHoverHighlightOnly();
  }

  /** Убрать подсветку клетки и сброс store, не трогая курсор мыши. */
  private clearHoverHighlightOnly(): void {
    if (this._hoverPrevCell === null) return;
    this._hoverPrevCell = null;
    this._hoverHighlight.setVisible(false);
    useGameStore.getState().setHoveredCell(null);
  }

  private updateHoveredCell(pointer: Phaser.Input.Pointer): void {
    // Над дроном не работает механизм ховера клетки вообще (как будто вне поля):
    // дрон плавно едет между клетками, у него своё кольцо выделения, а заливка
    // клетки под ним визуально путается с выбором дрона.
    if (this.isPointerOverDrone(pointer)) {
      this._scene.sys.game.canvas.style.cursor = "pointer";
      this.clearHoverHighlightOnly();
      return;
    }

    const world = this._scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cellX = Math.floor(world.x / TILE_SIZE);
    const cellY = Math.floor(world.y / TILE_SIZE);

    const tile = this._grid.getTile(cellX, cellY);
    const onField = tile !== "wall";
    if (!onField) {
      this.clearHover();
      return;
    }

    const isBuilding = this.isBuildingTile(tile);
    this._scene.sys.game.canvas.style.cursor = isBuilding
      ? "pointer"
      : "default";

    const prev = this._hoverPrevCell;
    if (prev !== null && prev.x === cellX && prev.y === cellY) return;

    this._hoverPrevCell = { x: cellX, y: cellY };
    this.drawHoverHighlight({ x: cellX, y: cellY, isBuilding });
    useGameStore.getState().setHoveredCell({ x: cellX, y: cellY });
  }

  private drawHoverHighlight(cell: {
    x: number;
    y: number;
    isBuilding: boolean;
  }): void {
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

  /** Клетка сетки под указателем, либо null если указатель вне сетки. */
  private pointerToCell(
    pointer: Phaser.Input.Pointer,
  ): { x: number; y: number } | null {
    const world = this._scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cellX = Math.floor(world.x / TILE_SIZE);
    const cellY = Math.floor(world.y / TILE_SIZE);
    if (this._grid.getTile(cellX, cellY) === "wall") return null;
    return { x: cellX, y: cellY };
  }
}
