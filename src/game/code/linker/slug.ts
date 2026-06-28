/**
 * Спецификатор модуля = slug имени программы.
 * `import { mineLoop } from "miner"` резолвится по slug("Miner") === "miner".
 */
export function slug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}
