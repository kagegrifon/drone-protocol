# Audio Settings Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести настройки аудио из локального state `AudioControls.tsx` в глобальную модалку с persist-хранилищем, доступную с обоих экранов.

**Architecture:** Создаём Zustand-store с `persist` middleware для хранения громкостей (localStorage). `AudioSettingsModal` — отдельный компонент с overlay, управляемый через `isSettingsOpen` в `App.tsx`. При открытии во время игры — пауза; при закрытии — возобновление (через `wasRunningRef`).

**Tech Stack:** React 18, Zustand 4.5 (с `persist` middleware), TypeScript, inline-стили (без CSS-файлов, как в проекте)

---

## Затрагиваемые файлы

| Файл | Действие |
|------|----------|
| `src/shared/store/audioStore.ts` | Создать |
| `src/ui/modals/AudioSettingsModal.tsx` | Создать |
| `src/ui/controls/AudioControls.tsx` | Удалить |
| `src/App.tsx` | Изменить |
| `src/ui/screens/StartScreen.tsx` | Изменить |

---

## Task 1: Zustand audioStore с persist

**Files:**
- Create: `src/shared/store/audioStore.ts`

- [ ] **Step 1: Создать store**

```ts
// src/shared/store/audioStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
    { name: 'drone-loop-audio' },
  ),
);
```

- [ ] **Step 2: Проверить типы**

```bash
npm run type-check
```

Ожидаем: 0 ошибок.

- [ ] **Step 3: Коммит**

```bash
git add src/shared/store/audioStore.ts
git commit -m "feat: Добавить audioStore с persist-middleware для настроек громкости

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Компонент AudioSettingsModal

**Files:**
- Create: `src/ui/modals/AudioSettingsModal.tsx`

- [ ] **Step 1: Создать компонент**

```tsx
// src/ui/modals/AudioSettingsModal.tsx
import type { AudioManager } from '../../renderer/audio/AudioManager.js';
import { useAudioStore } from '../../shared/store/audioStore.js';

interface AudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioManager: AudioManager | null;
}

const OVERLAY: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 400,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const PANEL: React.CSSProperties = {
  width: '340px',
  background: '#0a1628',
  border: '1px solid #1a3a5a',
  borderRadius: '4px',
  padding: '20px 24px',
  fontFamily: 'monospace',
};

const TITLE: React.CSSProperties = {
  fontSize: '13px',
  letterSpacing: '3px',
  color: '#00d4ff',
  marginBottom: '16px',
};

const SECTION: React.CSSProperties = {
  fontSize: '10px',
  letterSpacing: '2px',
  color: '#2a4a6a',
  marginBottom: '10px',
};

const ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '8px',
};

const LABEL: React.CSSProperties = {
  fontSize: '11px',
  color: '#4a8aaa',
  width: '20px',
  flexShrink: 0,
};

const SLIDER: React.CSSProperties = {
  flex: 1,
  accentColor: '#00d4ff',
  cursor: 'pointer',
};

const VAL: React.CSSProperties = {
  fontSize: '10px',
  color: '#2a6a8a',
  width: '28px',
  textAlign: 'right',
  flexShrink: 0,
};

const CLOSE_BTN: React.CSSProperties = {
  marginTop: '16px',
  width: '100%',
  background: '#0d2040',
  border: '1px solid #1a3a5a',
  color: '#4a8aaa',
  padding: '8px',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: '11px',
  letterSpacing: '2px',
  borderRadius: '3px',
};

export function AudioSettingsModal({ isOpen, onClose, audioManager }: AudioSettingsModalProps) {
  const { musicVol, sfxVol, setMusicVol, setSfxVol } = useAudioStore();

  if (!isOpen) return null;

  const handleMusicVol = (v: number) => {
    setMusicVol(v);
    audioManager?.setMusicVolume(v / 100);
  };

  const handleSfxVol = (v: number) => {
    setSfxVol(v);
    audioManager?.setSfxVolume(v / 100);
  };

  return (
    <div style={OVERLAY} onClick={onClose}>
      <div style={PANEL} onClick={(e) => e.stopPropagation()}>
        <div style={TITLE}>⚙ НАСТРОЙКИ</div>
        <div style={SECTION}>АУДИО</div>
        <div style={ROW}>
          <span style={LABEL}>🎵</span>
          <input
            type="range" min={0} max={100} value={musicVol}
            style={SLIDER}
            onChange={(e) => handleMusicVol(+e.target.value)}
          />
          <span style={VAL}>{musicVol}%</span>
        </div>
        <div style={ROW}>
          <span style={LABEL}>🔊</span>
          <input
            type="range" min={0} max={100} value={sfxVol}
            style={SLIDER}
            onChange={(e) => handleSfxVol(+e.target.value)}
          />
          <span style={VAL}>{sfxVol}%</span>
        </div>
        <button style={CLOSE_BTN} onClick={onClose}>✕ ЗАКРЫТЬ</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Проверить типы**

```bash
npm run type-check
```

Ожидаем: 0 ошибок.

- [ ] **Step 3: Коммит**

```bash
git add src/ui/modals/AudioSettingsModal.tsx
git commit -m "feat: Добавить компонент AudioSettingsModal с overlay и слайдерами

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Кнопка ⚙ в StartScreen

**Files:**
- Modify: `src/ui/screens/StartScreen.tsx`

Текущий интерфейс props:
```ts
interface StartScreenProps {
  missions: MissionDef[];
  onStart: (missionIndex: number) => void;
}
```

Нужно добавить `onOpenSettings: () => void`.

- [ ] **Step 1: Обновить StartScreen**

Открыть [src/ui/screens/StartScreen.tsx](src/ui/screens/StartScreen.tsx).

Заменить интерфейс props:
```ts
// было:
interface StartScreenProps {
  missions: MissionDef[];
  onStart: (missionIndex: number) => void;
}

// стало:
interface StartScreenProps {
  missions: MissionDef[];
  onStart: (missionIndex: number) => void;
  onOpenSettings: () => void;
}
```

Добавить стиль кнопки после существующих констант (после `BTN`):
```ts
const GEAR_BTN: React.CSSProperties = {
  position: 'absolute',
  top: '16px',
  right: '16px',
  background: 'transparent',
  border: 'none',
  color: '#4a8aaa',
  fontSize: '20px',
  cursor: 'pointer',
  zIndex: 10,
  padding: '4px 8px',
  lineHeight: 1,
};
```

Обновить сигнатуру компонента и добавить кнопку:
```tsx
// было:
export function StartScreen({ missions, onStart }: StartScreenProps) {

// стало:
export function StartScreen({ missions, onStart, onOpenSettings }: StartScreenProps) {
```

Добавить кнопку ⚙ сразу после открывающего `<div style={{position: 'fixed', ...}}>`:
```tsx
<button
  style={GEAR_BTN}
  onClick={onOpenSettings}
  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#00d4ff'; }}
  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#4a8aaa'; }}
  title="Настройки"
>
  ⚙
</button>
```

- [ ] **Step 2: Проверить типы**

```bash
npm run type-check
```

Ожидаем: 1 ошибка TypeScript — `onOpenSettings` не передаётся из `App.tsx`. Это исправим в Task 4.

- [ ] **Step 3: Коммит отложен** — коммитим вместе с App.tsx в Task 4.

---

## Task 4: Интеграция в App.tsx + удаление AudioControls

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/ui/controls/AudioControls.tsx`

- [ ] **Step 1: Обновить App.tsx**

Полный новый вариант файла [src/App.tsx](src/App.tsx):

```tsx
import { useEffect, useRef, useState } from 'react';
import { GameController } from './game/GameController.js';
import { ALL_MISSIONS } from './game/missions/index.js';
import { useGameStore } from './shared/store/gameStore.js';
import { useAudioStore } from './shared/store/audioStore.js';
import { SimControls } from './ui/controls/SimControls.js';
import { DroneList } from './ui/panels/DroneList.js';
import { DroneInspector } from './ui/panels/DroneInspector/index.js';
import { ProgramEditor } from './ui/editor/ProgramEditor/index.js';
import { StatsPanel } from './ui/panels/StatsPanel/index.js';
import { MissionGoalPanel } from './ui/panels/MissionGoalPanel.js';
import { GameStatusOverlay } from './ui/overlays/GameStatusOverlay.js';
import { StartScreen } from './ui/screens/StartScreen.js';
import { LoadingScreen } from './ui/screens/LoadingScreen.js';
import { AudioSettingsModal } from './ui/modals/AudioSettingsModal.js';
import type { EntityId } from './shared/types/index.js';
import type { AudioManager } from './renderer/audio/AudioManager.js';

type GamePhase = 'start' | 'loading' | 'game';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<GameController | null>(null);
  const entityIdsRef = useRef<EntityId[]>([]);
  const wasRunningRef = useRef<boolean>(false);
  const selectDrone = useGameStore((s) => s.selectDrone);

  const [gamePhase, setGamePhase] = useState<GamePhase>('start');
  const [missionIndex, setMissionIndex] = useState<number>(0);
  const [audioManager, setAudioManager] = useState<AudioManager | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const currentMission = ALL_MISSIONS[missionIndex] ?? ALL_MISSIONS[0];
  const isLastMission = missionIndex === ALL_MISSIONS.length - 1;

  const openSettings = () => {
    if (gamePhase === 'game') {
      const { isRunning } = useGameStore.getState();
      wasRunningRef.current = isRunning;
      if (isRunning) controllerRef.current?.pause();
    }
    setIsSettingsOpen(true);
  };

  const closeSettings = () => {
    setIsSettingsOpen(false);
    if (gamePhase === 'game' && wasRunningRef.current) {
      controllerRef.current?.start();
    }
  };

  const handleStart = (index: number) => {
    setMissionIndex(index);
    setGamePhase('loading');
  };

  const handleBackToMissions = () => {
    controllerRef.current?.pause();
    controllerRef.current?.destroy();
    controllerRef.current = null;
    setAudioManager(null);
    setGamePhase('start');
  };

  useEffect(() => {
    if (gamePhase !== 'loading') return;
    if (!containerRef.current) return;

    controllerRef.current?.destroy();
    const ctrl = new GameController(ALL_MISSIONS[missionIndex]);
    ctrl.setup(containerRef.current, {
      onDroneClick: (id) => selectDrone(id),
      onReady: () => setGamePhase('game'),
      onAudioReady: (am) => {
        const { musicVol, sfxVol } = useAudioStore.getState();
        am.setMusicVolume(musicVol / 100);
        am.setSfxVolume(sfxVol / 100);
        setAudioManager(am);
      },
    });
    entityIdsRef.current = ctrl.entityIds;
    controllerRef.current = ctrl;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, missionIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isSettingsOpen) {
        closeSettings();
      } else if (gamePhase === 'game') {
        openSettings();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSettingsOpen, gamePhase]);

  useEffect(() => {
    return () => controllerRef.current?.destroy();
  }, []);

  return (
    <div style={{ display: 'flex', background: '#050810', minHeight: '100vh', color: '#c0cfe0' }}>
      {/* Phaser canvas — always mounted so containerRef is available */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', position: 'relative' }}>
        <div ref={containerRef} />
        {gamePhase === 'game' && (
          <GameStatusOverlay
            onReset={() => controllerRef.current?.reset()}
            onNextMission={() => {
              const next = missionIndex < ALL_MISSIONS.length - 1 ? missionIndex + 1 : missionIndex;
              setMissionIndex(next);
              setGamePhase('loading');
            }}
            isLastMission={isLastMission}
          />
        )}
      </div>

      {/* Sidebar — visible only in game phase */}
      {gamePhase === 'game' && (
        <div style={{ width: '340px', minWidth: '340px', background: '#0a0e1a', borderLeft: '1px solid #1e3a5f', display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>
          <SimControls
            onPlay={() => controllerRef.current?.start()}
            onPause={() => controllerRef.current?.pause()}
            onStep={() => controllerRef.current?.step()}
            onBackToMissions={handleBackToMissions}
            onOpenSettings={openSettings}
          />
          <MissionGoalPanel mission={currentMission} />
          <SectionLabel label="DRONES" />
          <DroneList />
          <SectionLabel label="INSPECTOR" />
          <DroneInspector />
          <SectionLabel label="PROGRAM" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '200px' }}>
            <ProgramEditor entityIds={entityIdsRef.current} />
          </div>
          <SectionLabel label="STATS" />
          <StatsPanel />
          <div style={{ padding: '6px 12px', borderTop: '1px solid #0a1a2a', textAlign: 'center' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#1a2a3a' }}>
              Drone Loop v1.0 · 2026
            </span>
          </div>
        </div>
      )}

      {/* Overlays */}
      {gamePhase === 'start' && (
        <StartScreen missions={ALL_MISSIONS} onStart={handleStart} onOpenSettings={openSettings} />
      )}
      {gamePhase === 'loading' && <LoadingScreen />}

      <AudioSettingsModal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        audioManager={audioManager}
      />
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ background: '#060d1a', borderTop: '1px solid #1e3a5f', borderBottom: '1px solid #1e3a5f', padding: '3px 12px', color: '#2a4a6a', fontFamily: 'monospace', fontSize: '10px', letterSpacing: '2px' }}>
      {label}
    </div>
  );
}
```

> **Внимание:** В App.tsx передаём `onOpenSettings={openSettings}` в `<SimControls>`. Нужно добавить этот prop в `SimControls` (Step 2).

- [ ] **Step 2: Обновить SimControls — добавить prop onOpenSettings**

Полный новый вариант [src/ui/controls/SimControls.tsx](src/ui/controls/SimControls.tsx):

```tsx
import { useGameStore } from '../../shared/store/gameStore.js';

interface SimControlsProps {
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onBackToMissions: () => void;
  onOpenSettings: () => void;
}

const BTN: React.CSSProperties = {
  background: '#0a1628',
  border: '1px solid #1e3a5f',
  color: '#00d4ff',
  padding: '6px 14px',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: '13px',
  borderRadius: '3px',
  transition: 'background 0.15s',
};

const BTN_ACTIVE: React.CSSProperties = {
  ...BTN,
  background: '#0d2040',
  border: '1px solid #00d4ff',
};

const BTN_DISABLED: React.CSSProperties = {
  ...BTN,
  opacity: 0.4,
  cursor: 'default',
};

export function SimControls({ onPlay, onPause, onStep, onBackToMissions, onOpenSettings }: SimControlsProps) {
  const isRunning = useGameStore((s) => s.isRunning);
  const gameStatus = useGameStore((s) => s.gameStatus);
  const tick = useGameStore((s) => s.stats.tick);

  const isFinished = gameStatus === 'won' || gameStatus === 'failed';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderBottom: '1px solid #1e3a5f', flexWrap: 'wrap' }}>
      <button
        style={isFinished ? BTN_DISABLED : (isRunning ? BTN_ACTIVE : BTN)}
        disabled={isFinished}
        onClick={() => isRunning ? onPause() : onPlay()}
      >
        {isRunning ? '⏸ Pause' : '▶ Play'}
      </button>
      <button
        style={isRunning || isFinished ? BTN_DISABLED : BTN}
        onClick={onStep}
        disabled={isRunning || isFinished}
      >
        {'→| '}Step
      </button>
      <span style={{ color: '#4488ff', fontFamily: 'monospace', fontSize: '12px', marginLeft: '8px', flex: 1 }}>
        Tick: {tick}
      </span>
      <button style={{ ...BTN, fontSize: '11px', padding: '4px 10px', color: '#4a6a8a' }} onClick={onBackToMissions}>
        ← Миссии
      </button>
      <button style={{ ...BTN, fontSize: '13px', padding: '4px 8px', color: '#4a8aaa' }} onClick={onOpenSettings} title="Настройки">
        ⚙
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Удалить AudioControls.tsx**

```bash
rm "src/ui/controls/AudioControls.tsx"
```

или через PowerShell:
```powershell
Remove-Item "src/ui/controls/AudioControls.tsx"
```

- [ ] **Step 4: Проверить типы**

```bash
npm run type-check
```

Ожидаем: 0 ошибок.

- [ ] **Step 5: Запустить тесты**

```bash
npm test
```

Ожидаем: все тесты пройдены (unit-тесты не затрагивают UI-компоненты).

- [ ] **Step 6: Коммит всего Task 3 + Task 4**

```bash
git add src/App.tsx src/ui/screens/StartScreen.tsx src/ui/controls/SimControls.tsx src/ui/modals/AudioSettingsModal.tsx
git rm src/ui/controls/AudioControls.tsx
git commit -m "feat: Добавить глобальную модалку настроек аудио и удалить AudioControls

- Кнопка ⚙ в StartScreen (правый верхний угол) и SimControls
- Открытие/закрытие через Esc во время игры
- Пауза при открытии модалки, возобновление при закрытии
- Настройки применяются к AudioManager при создании (onAudioReady)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Верификация (ручное тестирование)

После коммита запустить `npm run dev` и проверить:

1. **Сохранение через сессии:** изменить громкость → перезагрузить страницу → слайдеры показывают сохранённые значения, музыка играет с нужной громкостью.
2. **Глобальность:** изменить громкость → запустить другую миссию → громкость не сбрасывается.
3. **Пауза:** во время работы игры открыть модалку → игра встаёт на паузу → закрыть → игра возобновляется.
4. **Esc:** во время игры нажать Esc → модалка открывается, игра паузируется → ещё раз Esc → модалка закрывается, игра продолжается.
5. **StartScreen:** открыть модалку со стартового экрана → настроить → запустить миссию → настройки применены.
6. **Клик по оверлею:** нажать вне панели → модалка закрывается.
