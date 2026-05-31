import { useAudioStore } from "../../shared/store/audioStore.js";

export function playMenuMissionClick(): void {
  const vol = useAudioStore.getState().sfxVol / 100;
  const audio = new Audio("/sound/menu_hover.mp3");
  audio.volume = vol;
  audio.play().catch(() => {});
}

export function playMenuStart(): void {
  const vol = useAudioStore.getState().sfxVol / 100;
  const audio = new Audio("/sound/menu_click.mp3");
  audio.volume = vol;
  audio.play().catch(() => {});
}

