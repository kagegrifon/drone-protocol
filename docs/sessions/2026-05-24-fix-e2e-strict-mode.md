# Сессия 2026-05-24 — Исправление e2e strict mode

## Цель

Исправить упавший e2e тест после прошлой сессии (time-in-seconds-and-per-drone-controls).

## Проблема

`npm run test:e2e` — 1 тест из 8 падал:

```
Error: strict mode violation: locator('text=Select a drone').or(...) resolved to 2 elements
```

Тест `кнопки в DroneList не меняют выбранного дрона` использовал текстовый локатор `text=Select a drone`. В прошлой сессии в `ProgramEditor` добавили аналогичную заглушку "Select a drone" (вкладка DRONE, дрон не выбран). Playwright в strict mode запрещает неоднозначные локаторы — тест упал.

## Решение

- `DroneInspector/index.tsx` — добавлен `data-testid="drone-inspector-empty"` на div пустого состояния.
- `e2e/drone-controls.spec.ts:93` — локатор заменён с `text=Select a drone` на `[data-testid="drone-inspector-empty"]`.

## Результат

8/8 e2e тестов зелёные.
