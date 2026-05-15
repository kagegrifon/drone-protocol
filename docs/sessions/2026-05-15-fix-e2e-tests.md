# Session: Fix failing e2e tests

**Date:** 2026-05-15  
**Goal:** Починить 3 падающих e2e теста

## Проблема

При запуске `npm run test:e2e` падали 3 теста:
1. `move-to-picker.spec.ts` — `move-to-toggle` not found
2. `regression.spec.ts` Bug 2 — кнопка `← Миссии` not found (timeout)
3. `regression.spec.ts` Bug 3 — кнопка `← Миссии` not found (timeout)

## Корневые причины

**Bug 2 & Bug 3:** Коммит `d9db075` перенёс кнопку возврата к миссиям из SimControls в `AudioSettingsModal`. Текст кнопки изменился с `← Миссии` на `← ВЫБОР МИССИЙ`, и кнопка стала доступна только после открытия модалки настроек (⚙).

**move-to-picker:** Инструкции `MOVE_TO` находятся в библиотечной программе `sharedLoop` (mission 3). Вкладка DRONE в `ProgramEditor` показывает только название назначенной программы без инструкций — `move-to-toggle` рендерится лишь во вкладке PROGRAM. Тест не выполнял навигацию Library → Edit → PROGRAM.

## Исправления

- `e2e/regression.spec.ts` — оба теста теперь открывают модалку через `getByTitle('Настройки')`, затем кликают `← ВЫБОР МИССИЙ`
- `e2e/move-to-picker.spec.ts` — добавлена навигация: `Открыть в библиотеке` → `Edit` перед поиском `move-to-toggle`
- `src/game/programs/interpreter.test.ts` — исправлен тип поля Deposit: `maxOre` → `mineRate` (уже было в рабочей копии)

## Результат

4/4 e2e теста проходят. 122/122 unit-тестов проходят.
