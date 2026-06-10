import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AudioState {
  musicVol: number;
  sfxVol: number;
  setMusicVol: (v: number) => void;
  setSfxVol: (v: number) => void;
}

export const useAudioStore = create<AudioState>()(
  persist(
    (set) => ({
      musicVol: 70,
      sfxVol: 80,
      setMusicVol: (v) => set({ musicVol: v }),
      setSfxVol: (v) => set({ sfxVol: v }),
    }),
    { name: "drone-loop-audio" },
  ),
);
