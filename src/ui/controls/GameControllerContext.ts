import { createContext, useContext } from "react";
import type { GameController } from "../../game/GameController.js";

/** Доступ к активному GameController из любой UI-точки игровой фазы. */
export const GameControllerContext = createContext<GameController | null>(null);

export function useGameController(): GameController | null {
  return useContext(GameControllerContext);
}
