# Сессия 2026-05-15 — Перенос кнопки «Выбор миссий» в модалку настроек

## Цель

Убрать кнопку «← Миссии» из панели управления симуляцией (`SimControls`) и перенести переход к выбору миссий в модалку настроек.

## Результаты

- **`src/ui/controls/SimControls.tsx`** — удалена кнопка «← Миссии» и проп `onBackToMissions`.
- **`src/ui/modals/AudioSettingsModal.tsx`** — добавлен опциональный проп `onBackToMissions?: () => void`; при его наличии отображается кнопка «← ВЫБОР МИССИЙ» над кнопкой «✕ ЗАКРЫТЬ».
- **`src/App.tsx`** — удалён `onBackToMissions` из `<SimControls>`, передан в `<AudioSettingsModal>` только во время фазы `game`; обёртка вызывает `setIsSettingsOpen(false)` + `handleBackToMissions()` без возобновления игры.
