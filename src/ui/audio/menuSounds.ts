import { playUiSound } from "./uiAudio.js";
import { useAudioStore } from "../../shared/store/audioStore.js";

function sfxVol(): number {
  return useAudioStore.getState().sfxVol / 100;
}

export function playMenuMissionClick(): void {
  playUiSound("menu_hover", sfxVol());
}

export function playMenuStart(): void {
  playUiSound("menu_click", sfxVol());
}
