import { useEffect, useRef, useState } from "react";
import { GameController } from "./game/GameController.js";
import { ALL_MISSIONS } from "./game/missions/index.js";
import { useGameStore } from "./shared/store/gameStore.js";
import { useAudioStore } from "./shared/store/audioStore.js";
import { SimControls } from "./ui/controls/SimControls.js";
import { DroneList } from "./ui/panels/DroneList.js";
import { DroneInspector } from "./ui/panels/DroneInspector/index.js";
import { ProgramEditor } from "./_block_instruction/ProgramEditor/index.js";
import { StatsPanel } from "./ui/panels/StatsPanel/index.js";
import { OreHud } from "./ui/overlays/OreHud.js";
import { MissionGoalButton } from "./ui/overlays/MissionGoalButton.js";
import { GameStatusOverlay } from "./ui/overlays/GameStatusOverlay.js";
import { BottomPanel } from "./ui/layout/BottomPanel.js";
import { IntroScreen } from "./ui/screens/IntroScreen.js";
import { StartScreen } from "./ui/screens/StartScreen.js";
import { LoadingScreen } from "./ui/screens/LoadingScreen.js";
import { AudioSettingsModal } from "./ui/modals/AudioSettingsModal.js";
import type { EntityMeta } from "./game/missions/types.js";
import type { AudioManager } from "./renderer/audio/AudioManager.js";
import { preloadUiSounds } from "./ui/audio/uiAudio.js";
import "./global.css";

type GamePhase = "intro" | "start" | "loading" | "game";

const SIDEBAR_WIDTH = 280;

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<GameController | null>(null);
  const entityMetasRef = useRef<EntityMeta[]>([]);
  const wasRunningRef = useRef<boolean>(false);
  const selectDrone = useGameStore((s) => s.selectDrone);

  const [gamePhase, setGamePhase] = useState<GamePhase>("intro");
  const [missionIndex, setMissionIndex] = useState<number>(0);
  const [audioManager, setAudioManager] = useState<AudioManager | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const selectedDroneId = useGameStore((s) => s.selectedDroneId);

  const currentMission = ALL_MISSIONS[missionIndex] ?? ALL_MISSIONS[0];
  const isLastMission = missionIndex === ALL_MISSIONS.length - 1;

  const openSettings = () => {
    if (gamePhase === "game") {
      const { isRunning } = useGameStore.getState();
      wasRunningRef.current = isRunning;
      if (isRunning) controllerRef.current?.pause();
    }
    setIsSettingsOpen(true);
  };

  const closeSettings = () => {
    setIsSettingsOpen(false);
    if (gamePhase === "game" && wasRunningRef.current) {
      controllerRef.current?.start();
    }
  };

  const handleStart = (index: number) => {
    setMissionIndex(index);
    setGamePhase("loading");
  };

  const handleBackToMissions = () => {
    controllerRef.current?.pause();
    controllerRef.current?.destroy();
    controllerRef.current = null;
    setAudioManager(null);
    setGamePhase("start");
  };

  useEffect(() => {
    if (gamePhase !== "loading") return;
    if (!containerRef.current) return;

    controllerRef.current?.destroy();
    const ctrl = new GameController(ALL_MISSIONS[missionIndex]);
    ctrl.setup(containerRef.current, {
      onDroneClick: (id) => selectDrone(id),
      onReady: () => setGamePhase("game"),
      onAudioReady: (am) => {
        const { musicVol, sfxVol } = useAudioStore.getState();
        am.setMusicVolume(musicVol / 100);
        am.setSfxVolume(sfxVol / 100);
        setAudioManager(am);
      },
    });
    entityMetasRef.current = ctrl.entities;
    controllerRef.current = ctrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, missionIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isSettingsOpen) {
        closeSettings();
      } else if (gamePhase === "game") {
        openSettings();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSettingsOpen, gamePhase]);

  useEffect(() => {
    if (selectedDroneId !== null && audioManager) {
      audioManager.play("robot_click");
    }
  }, [selectedDroneId, audioManager]);

  useEffect(() => {
    preloadUiSounds();
  }, []);

  useEffect(() => {
    return () => controllerRef.current?.destroy();
  }, []);

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        display: "flex",
        background: "#050810",
        color: "#c0cfe0",
        minWidth: 1024,
      }}
    >
      {/* Sidebar — visible only in game phase */}
      {gamePhase === "game" && (
        <aside
          style={{
            width: SIDEBAR_WIDTH,
            minWidth: SIDEBAR_WIDTH,
            background: "#0a0e1a",
            borderRight: "1px solid #1e3a5f",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflowY: "auto",
          }}
        >
          <SimControls
            onPlay={() => controllerRef.current?.start()}
            onPause={() => controllerRef.current?.pause()}
            onOpenSettings={openSettings}
          />
          <SectionLabel label="DRONES" />
          <DroneList />
          <SectionLabel label="INSPECTOR" />
          <DroneInspector />
          <SectionLabel label="STATISTICS" />
          <StatsPanel />
          <div
            style={{
              marginTop: "auto",
              padding: "6px 12px",
              borderTop: "1px solid #0a1a2a",
              textAlign: "center",
            }}
          >
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "10px",
                color: "#1a2a3a",
              }}
            >
              Drone Loop v1.0 · 2026
            </span>
          </div>
        </aside>
      )}

      {/* Main area — canvas fills 100%, bottom panel overlays absolutely */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          height: "100%",
          position: "relative",
          background: "#050810",
          overflow: "hidden",
        }}
      >
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
        {gamePhase === "game" && (
          <>
            <OreHud />
            <MissionGoalButton mission={currentMission} />
            <GameStatusOverlay
              onReset={() => controllerRef.current?.reset()}
              onNextMission={() => {
                const next =
                  missionIndex < ALL_MISSIONS.length - 1
                    ? missionIndex + 1
                    : missionIndex;
                setMissionIndex(next);
                setGamePhase("loading");
              }}
              isLastMission={isLastMission}
            />
            <BottomPanel>
              <ProgramEditor entities={entityMetasRef.current} />
            </BottomPanel>
          </>
        )}
      </main>

      {/* Overlays */}
      {gamePhase === "intro" && (
        <IntroScreen onStart={() => setGamePhase("start")} />
      )}
      {gamePhase === "start" && (
        <StartScreen
          missions={ALL_MISSIONS}
          onStart={handleStart}
          onOpenSettings={openSettings}
        />
      )}
      {gamePhase === "loading" && <LoadingScreen />}

      <AudioSettingsModal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        audioManager={audioManager}
        onBackToMissions={
          gamePhase === "game"
            ? () => {
                setIsSettingsOpen(false);
                handleBackToMissions();
              }
            : undefined
        }
      />
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        background: "#060d1a",
        borderTop: "1px solid #1e3a5f",
        borderBottom: "1px solid #1e3a5f",
        padding: "3px 12px",
        color: "#2a4a6a",
        fontFamily: "monospace",
        fontSize: "10px",
        letterSpacing: "2px",
      }}
    >
      {label}
    </div>
  );
}
