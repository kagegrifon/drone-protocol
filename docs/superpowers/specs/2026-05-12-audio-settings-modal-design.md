# Дизайн: Глобальная модалка настроек аудио

**Дата:** 2026-05-12  
**Контекст:** Настройки музыки сейчас хранятся как локальный state в `AudioControls.tsx` (сайдбар игры) и сбрасываются при старте новой миссии, так как создаётся новый `AudioManager` с дефолтами. На StartScreen настроек нет совсем. Цель — вынести настройки в глобальную модалку, доступную с обоих экранов, и сохранять их через localStorage.

---

## 1. Хранилище состояния

**Файл:** `src/shared/store/audioStore.ts` (новый)

Zustand store с `persist` middleware, ключ в localStorage: `drone-loop-audio`.

```ts
interface AudioState {
  musicVol: number        // 0–100, default 70
  sfxVol: number          // 0–100, default 80
  setMusicVol: (v: number) => void
  setSfxVol: (v: number) => void
}
```

- Значения в диапазоне 0–100 (целые числа)
- При изменении — оба setter немедленно применяют значение к `AudioManager` (передаётся извне, через ref или параметр)
- Store не хранит ссылку на AudioManager — он stateless с точки зрения аудио-движка

---

## 2. Применение настроек при создании AudioManager

**Файл:** `src/App.tsx` (изменение)

После того как `audioManager` стал доступен (событие готовности gameController), один раз применить текущие значения из store:

```ts
const { musicVol, sfxVol } = useAudioStore.getState()
audioManager.setMusicVolume(musicVol / 100)
audioManager.setSfxVolume(sfxVol / 100)
```

Это заменяет дефолты AudioManager (0.7 / 0.8) на пользовательские настройки при каждой загрузке миссии.

---

## 3. Компонент модалки

**Файл:** `src/ui/modals/AudioSettingsModal.tsx` (новый)

### Props

```ts
interface AudioSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  audioManager: AudioManager | null
}
```

### Поведение

- Overlay: `position: fixed, inset: 0, zIndex: 400, background: rgba(0,0,0,0.7)`
- Панель по центру: `~340px` ширина, стиль игры (`#0a1628`, border `1px solid #1a3a5a`, monospace)
- Заголовок: `⚙ НАСТРОЙКИ`
- Секция **АУДИО**:
  - Слайдер 🎵 Музыка (0–100%), значение из `useAudioStore`
  - Слайдер 🔊 Звуки (0–100%), значение из `useAudioStore`
  - Изменения немедленно применяются к `audioManager` и сохраняются в store (→ localStorage)
- Кнопка «✕ Закрыть» или клик по оверлею — вызывает `onClose`
- Структура допускает добавление других секций в будущем (например, «Управление», «Выход в меню»)

### Стиль слайдеров

Аналогичен текущему `AudioControls.tsx` — сохраняем визуальный язык. После реализации `AudioControls.tsx` удаляется.

---

## 4. Управление открытием/закрытием

**Файл:** `src/App.tsx` (изменение)

Состояние модалки — локальный `useState` в `App.tsx`:

```ts
const [isSettingsOpen, setIsSettingsOpen] = useState(false)
```

При открытии модалки во время игры:
1. Запомнить текущее состояние игры (`wasRunning = gameController.isRunning`)
2. Вызвать `gameController.pause()` (если игра шла)

При закрытии модалки во время игры:
1. Если `wasRunning === true` → `gameController.start()`

На StartScreen: открытие/закрытие модалки без влияния на игру.

`wasRunning` хранится как `useRef<boolean>` в `App.tsx`.

---

## 5. Клавиша Esc

**Файл:** `src/App.tsx` (изменение)

`useEffect` вешает `keydown` listener на `document`:

```ts
if (e.key === 'Escape') {
  if (isSettingsOpen) {
    closeSettings()   // восстанавливает состояние игры
  } else if (gamePhase === 'game') {
    openSettings()    // паузирует если нужно
  }
}
```

На StartScreen Esc не открывает модалку (gamePhase !== 'game') — только в игре.

---

## 6. Кнопка ⚙ на экранах

### StartScreen (`src/ui/screens/StartScreen.tsx`)

- Позиция: правый верхний угол, `position: absolute, top: 16px, right: 16px`
- Кнопка: `⚙` с hover-эффектом (cyan glow), `zIndex: 10`
- Вызывает `onOpenSettings` callback (проп из App.tsx)

### Игровой экран (сайдбар)

- В заголовочной области сайдбара или рядом с `SimControls`
- Кнопка: `⚙ Настройки` или просто `⚙` — небольшая, в стиле `SimControls`
- Вызывает `openSettings()` (функция из App.tsx)

---

## 7. Удаляемые компоненты

| Компонент | Статус |
|-----------|--------|
| `src/ui/controls/AudioControls.tsx` | Удалить полностью |
| Строка `<AudioControls>` в `App.tsx` | Удалить |

---

## 8. Файлы, затрагиваемые изменениями

| Файл | Действие |
|------|----------|
| `src/shared/store/audioStore.ts` | Создать |
| `src/ui/modals/AudioSettingsModal.tsx` | Создать |
| `src/ui/controls/AudioControls.tsx` | Удалить |
| `src/App.tsx` | Изменить (добавить store, модалку, Esc, кнопку в сайдбаре, применение настроек к AudioManager) |
| `src/ui/screens/StartScreen.tsx` | Изменить (добавить кнопку ⚙, callback `onOpenSettings`) |

---

## 9. Верификация (ручное тестирование)

1. **Сохранение через сессии:** изменить громкость → перезагрузить страницу → слайдеры показывают сохранённые значения, музыка играет с нужной громкостью.
2. **Глобальность:** изменить громкость → запустить другую миссию → громкость не сбрасывается.
3. **Пауза:** во время работы игры открыть модалку → игра встаёт на паузу → закрыть → игра возобновляется.
4. **Esc:** во время игры нажать Esc → модалка открывается, игра паузируется → ещё раз Esc → модалка закрывается, игра продолжается.
5. **StartScreen:** открыть модалку со стартового экрана → настроить → запустить миссию → настройки применены.
6. **Стиль:** модалка визуально вписывается в дизайн игры (тёмный фон, cyan акценты, monospace).
