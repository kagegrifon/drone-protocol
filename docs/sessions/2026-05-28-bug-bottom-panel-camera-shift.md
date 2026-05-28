# Session: fix camera shift from bottom panel resize

**Date:** 2026-05-28

## Goal

Исправить два бага с нижней панелью (BottomPanel):
1. После Fullscreen → Restore игровое поле не видно / камера не возвращается на место
2. При ресайзе нижней панели за handle камера смещается

## Root cause

BottomPanel находилась в flex-потоке внутри `main`. При Fullscreen (`flex: 1 1 100%`) canvas-wrapper сжимался до 0px — Phaser терял состояние камеры. При ручном ресайзе изменение высоты canvas меняло `cam.height`, а `cam.scrollY` оставался на месте — визуальный центр мира смещался.

Попытка workaround через `savedCenter` в `GameScene.ts` не сработала из-за неопределённого порядка: Phaser `scale.on('resize')` и `update()` выполняются в рамках одного requestAnimationFrame, savedCenter мог быть уже перезаписан до восстановления.

## Solution

Архитектурный фикс: BottomPanel переведена в `position: absolute` — накладывается поверх canvas снизу, не участвует в flex-расчёте.

**Изменения:**

- `src/App.tsx` — `main` стал простым `position: relative` контейнером. Canvas (`containerRef`) и BottomPanel рядом как абсолютные дети. Вся логика `flex-column` для canvas убрана.
- `src/ui/layout/BottomPanel.tsx` — контейнер: `position: absolute; bottom: 0; left: 0; right: 0`. Fullscreen: добавляется `top: 0`. Flex-свойства (`flex`, `flexBasis`) убраны. `e.stopPropagation()` на resize-handle.

Canvas теперь всегда занимает 100% `main` независимо от состояния панели.

## Метрики сессии
- Модель: claude-sonnet-4-6
- Input: 72 токенов (кеш: 2,577,417 / запись в кеш: 236,617)
- Output: 65,266 токенов
- Контекст: 71,490 / 200,000 токенов (35.7%)
- Стоимость: $2.640
