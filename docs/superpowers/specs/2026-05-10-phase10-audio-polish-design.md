# Phase 10 — Аудио и полировка: дизайн-документ

_Дата: 2026-05-10_

---

## Контекст

Фазы 0–9 завершены: ECS, симуляция, рендеринг, React UI, 4 обучающих миссии. Игра полностью функциональна, но лишена звука и атмосферных деталей. Фаза 10 добавляет аудио, визуальную полировку, начальный экран и контроль громкости.

Целевая атмосфера (GDD): **тихая медитативная автоматизация**, calm synth ambient, soft industrial, никакой агрессии в звуках.

---

## Аудио-ассеты

### Файлы (уже в репозитории)

| Файл | Путь | Назначение |
|------|------|-----------|
| Orbital Rain.mp3 | `assets/music/Orbital Rain.mp3` | Фоновый ambient loop |
| mine_click.mp3 | `assets/sound/mine_click.mp3` | Звук добычи руды |
| robot_click.wav | `assets/sound/robot_click.wav` | Шаг дрона (сервопривод) |
| drone_hum.mp3 | `assets/sound/drone_hum.mp3` | Гул работающего дрона |

### Синтезированные звуки (Web Audio API в BootScene)

| Ключ | Алгоритм |
|------|----------|
| `drop_ore` | Тон 400→200 Hz за 0.3s + белый шум 0.05s; экспоненциальный fade gain |
| `charge_buzz` | Осциллятор 120 Hz + FM-wobble ±5 Hz, loopable буфер 1s |
| `mission_complete` | Ноты C5(523)→E5(659)→G5(784) Hz, по 0.15s каждая, затем fade out 0.4s |

Синтез происходит в `BootScene.preload()` через `Phaser.Sound.WebAudioSoundManager.context` → `AudioContext`. Результат регистрируется как Phaser sound buffer под соответствующим ключом.

---

## Архитектура аудио

### Событийная шина `src/shared/events/gameEvents.ts`

Лёгкий typed EventEmitter без внешних зависимостей. Симуляция импортирует только из `src/shared/` — правило «никогда не импортировать Phaser» не нарушается.

```
Events: 'ore:mined' | 'ore:dropped' | 'charge:started' | 'charge:completed' | 'mission:complete'
```

**Эмитируют:**
- `MiningSystem` → `ore:mined`, `ore:dropped`
- `EnergySystem` → `charge:started`, `charge:completed`
- `GameController` → `mission:complete`

**Слушают:**
- `GameScene` → вызывает `AudioManager` + запускает визуальные эффекты

### `src/renderer/audio/AudioManager.ts`

Оборачивает Phaser Sound Manager. Методы:
- `playMusic()` / `stopMusic()`
- `play(key: SfxKey)` — одиночный звук
- `startLoop(key: SfxKey)` — запуск looping SFX
- `stopLoop(key: SfxKey)` — остановка looping SFX
- `setMusicVolume(v: number)` — 0.0–1.0
- `setSfxVolume(v: number)` — 0.0–1.0, применяется ко всем активным SFX

### Таблица триггеров

| Событие игры | Звук | Режим | Троттл |
|-------------|------|-------|--------|
| Старт игры | `Orbital Rain.mp3` | loop | — |
| `ore:mined` | `mine_click` | one-shot | раз в 3 тика на дрона |
| Смена клетки | `robot_click` | one-shot | раз в шаг на дрона |
| Running-дрон появился | `drone_hum` | loop start | — |
| Все дроны idle | `drone_hum` | loop stop | — |
| `ore:dropped` | `drop_ore` | one-shot | — |
| `charge:started` | `charge_buzz` | loop start | — |
| `charge:completed` | `charge_buzz` | loop stop | — |
| `mission:complete` | `mission_complete` | one-shot | — |

---

## Визуальная полировка

### Idle-анимация дронов (`DroneSprite.ts`)

- Состояние idle/waiting: Tween `scale` 0.95→1.05, duration 2000ms, yoyo, repeat -1, ease Sine.easeInOut
- При начале движения: `tween.stop()`, `setScale(1.0)`

### Улучшенный glow (`DroneSprite.ts`)

Метод `setGlowMode(mode: 'normal' | 'mining' | 'charging')`:

| Режим | Цвет `_light` | Радиус | Период пульса |
|-------|--------------|--------|---------------|
| normal | `0x00ffcc` | 8 | 700ms |
| mining | `0xff8800` | 12 | 500ms |
| charging | `0x00aaff` | 10 | 300ms |

GameScene переключает режим при получении событий `ore:mined` / `charge:started` и сбрасывает на normal по таймеру или событию.

### Mining dust particles (`GameScene.ts`)

При `ore:mined` (позиция шахты):
- 5 частиц, цвет `0x8B7355`, scale 0.3→0, alpha 1→0, lifespan 500ms
- Направление: вверх ±30°, скорость 40–80 px/s
- Реализация: `Phaser.GameObjects.Particles.ParticleEmitter` (один emitter на сцену, вызов `explode(5, x, y)`)

### Base flash (`GameScene.ts`)

При `ore:dropped`:
- Tween tint base-спрайта: `0xffffff` → базовый цвет за 200ms

---

## Начальный экран

### Поток `App.tsx`

```
gamePhase: 'start' | 'loading' | 'game'

'start'   → <StartScreen />
'loading' → <LoadingScreen /> (preload spinner)
'game'    → Phaser canvas + sidebar
```

### `src/ui/screens/StartScreen.tsx`

Полноэкранный компонент, sci-fi terminal стиль (тот же что у сайдбара):

- Заголовок **DRONE LOOP** — крупный моноширинный шрифт, CSS `text-shadow: 0 0 20px #00ffcc`
- Подзаголовок `AUTOMATION PROTOCOL v1.0` — мелкий, opacity 0.6
- Сетка карточек миссий (2×2): номер, название, цель, сложность (★☆☆ / ★★☆ / ★★★)
- Выбранная карточка — border `1px solid #00ffcc`
- Кнопка «ЗАПУСТИТЬ» → `gamePhase = 'loading'`, затем `gamePhase = 'game'`

`MissionSelectOverlay.tsx` — удалить; логика карточек переходит в StartScreen.

### `src/ui/screens/LoadingScreen.tsx`

Показывается пока Phaser инициализируется и грузит аудио (`gamePhase === 'loading'`):
- Простой спиннер (CSS анимация) + текст «ИНИЦИАЛИЗАЦИЯ СИСТЕМ…»
- После `GameRenderer.ready` → `gamePhase = 'game'`

`GameRenderer` добавляет callback `onReady?: () => void` — вызывается после `'create'` в GameScene.

---

## Контроль громкости

### `src/ui/controls/AudioControls.tsx`

Новый компонент, размещается в сайдбаре над `SimControls`:

```
🎵  ──●──────  70%
🔊  ──●────    50%
```

- HTML `<input type="range" min="0" max="100">` для каждого канала
- Значения: `musicVolume`, `sfxVolume` в Zustand store
- `useEffect` → `audioManager.setMusicVolume(v / 100)` при изменении

### `src/shared/store/gameStore.ts`

Добавить поля:
- `musicVolume: number` (default 70)
- `sfxVolume: number` (default 80)
- `gamePhase: 'start' | 'loading' | 'game'` (default 'start')

---

## Credits

Мелкий текст в нижней части сайдбара (или footer StartScreen):
```
Drone Loop v1.0 · 2026
```
Реализация: статический `<div>` в `App.tsx` (в игровом режиме) и в `StartScreen.tsx`.

---

## Балансировка

После реализации аудио и полировки — ручная проверка и точечные правки:

| Параметр | Где | Что проверить |
|---------|-----|--------------|
| `drainPerMove` | `createDrone.ts` | Хватает ли энергии на маршрут без зарядки |
| `drainPerMine` | `createDrone.ts` | Не иссякает ли энергия раньше инвентаря |
| `oreRemaining` | `createMine.ts` | Достаточно ли для win условий миссий |
| `chargeRate` | `createCharger.ts` | Не слишком ли долгая зарядка |
| Mission 4 `ore_per_min >= 8` | `mission4.ts` | Достижимо ли с правильной программой |

---

## Затрагиваемые файлы

### Новые файлы
- `src/shared/events/gameEvents.ts`
- `src/renderer/audio/AudioManager.ts`
- `src/ui/controls/AudioControls.tsx`
- `src/ui/screens/StartScreen.tsx`
- `src/ui/screens/LoadingScreen.tsx`

### Изменённые файлы
- `src/renderer/scenes/BootScene.ts` — загрузка аудиофайлов + синтез 3 звуков
- `src/renderer/scenes/GameScene.ts` — подписка на gameEvents, particles, glow, AudioManager вызовы
- `src/renderer/sprites/DroneSprite.ts` — idle tween + `setGlowMode()`
- `src/renderer/GameRenderer.ts` — создание AudioManager, `onReady` callback
- `src/game/simulation/systems/MiningSystem.ts` — emit `ore:mined`, `ore:dropped`
- `src/game/simulation/systems/EnergySystem.ts` — emit `charge:started`, `charge:completed`
- `src/game/GameController.ts` — emit `mission:complete`
- `src/shared/store/gameStore.ts` — `musicVolume`, `sfxVolume`, `gamePhase`
- `src/ui/controls/SimControls.tsx` — кнопка «К миссиям» (сброс `gamePhase → 'start'`)
- `src/App.tsx` — условный рендер по `gamePhase`, Credits
- `src/ui/overlays/MissionSelectOverlay.tsx` — удалить

---

## Проверка (verification)

1. `npm run type-check` — 0 ошибок
2. `npm test` — все 92 теста проходят (новые тесты для gameEvents)
3. Ручная проверка аудио: открыть игру, убедиться что музыка играет, ползунки работают
4. Проверить все 4 триггера SFX: добыча, шаг, сдача руды, зарядка
5. Проверить синтезированные звуки: drop_ore, charge_buzz, mission_complete
6. Начальный экран: выбор миссии → loading → игра → кнопка «К миссиям» → старт
7. Idle-анимация дронов: остановить симуляцию, убедиться в покачивании
8. Mining dust: наблюдать частицы при добыче
9. Балансировка: пройти все 4 миссии
