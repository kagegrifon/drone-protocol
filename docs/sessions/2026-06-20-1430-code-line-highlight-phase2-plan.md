# Сессия: Code Line Highlight Phase 2 — План реализации

**Дата:** 2026-06-20 14:30  
**Ветка:** `feat/code-line-highlight`  
**Статус:** Завершена подготовка и начало реализации

## Цель

Создать план реализации фичи «Подсветка текущей исполняемой строки кода дрона в Monaco-редакторе». Это этап 2 из 2; этап 1 (редактор назначенной программы на вкладке DRONE) уже влит в main (PR #6).

## Выполнено

### 1. Прочитана спека
Файл: `docs/features/planned/code-debugging-line-highlight.md`
- Этап 1 (feat/drone-assigned-program-editor) уже в main
- Подсветка работает для обеих программ: персональной и назначенной
- Scope: только текущая строка; step-режим, breakpoints и замедление **не реализуются**
- Инструментируются только `await drone.{moveTo|mine|drop|charge|wait}()`

### 2. Разработан план (5 задач)
Файл: `docs/superpowers/plans/2026-06-20-code-line-highlight.md`

**Архитектура:**
- Task 1: `instrument.ts` (acorn AST-парсер) → вставляет `(__line(N), <await-expr>)` перед каждым `await drone.*`
- Task 2: типы и runtime — добавить `line: number` в `WorkerMessage`, прокинуть `__line` в `AsyncFunction`, шлёт `line` в сообщениях
- Task 3: слой данных — `ProgramComponent.currentLine`, `CodeBehaviorDriver` записывает/сбрасывает, `snapshotDrones` прокидывает в `DroneState`
- Task 4: UI — `CodeEditor` с Monaco-декорацией (фон + glyph в gutter), `ProgramEditor` передаёт `highlightLine` только для активной программы
- Task 5: финализация — тесты, документация, перенос фичи в `done/`

**Все шаги с конкретным кодом, типами, коммит-сообщениями.**

### 3. Начата реализация (subagent-driven-development)

**Task 1 ✅ DONE:**
- Создан `src/game/code/worker/instrument.ts` с чистой функцией `instrument(code): string`
- Написано 9 юнит-тестов (instrument.test.ts): типовой код, комментарии, строковые литералы, многострочные вызовы, валидный JS на выходе
- Используется acorn с `allowAwaitOutsideFunction: true` (необходимо для top-level await в коде игрока)
- Коммит: `2abecbc`
- Ревью: Spec ✅, Quality ✅ (Minor: названия тестов, ecmaVersion note)

**Task 2 ✅ DONE:**
- Обновлены типы `WorkerMessage`: добавлено `line: number` в `intent` и `wait`
- Обновлен `codeRuntime.ts`: `currentLine`, `__line(n)`, вызов `instrument()` перед `AsyncFunction`, проброс `__line` как аргумент
- Обновлены все тесты (включая `NodeWorkerPort.test.ts`)
- Коммит: `86b33f1`
- Ревью: Spec ✅, Quality ✅

**Task 3 — Начато, найдено Important issue:**
- Коммит: `3691d6b` (Program.ts, CodeBehaviorDriver, gameStore с `currentLine`)
- **Ревью нашло:** в `armTimeout` при таймауте не сбрасывается `program.currentLine = null`
- Требуется фикс: добавить `program.currentLine = null;` в калбэке `setTimeout` в `armTimeout`
- После фикса нужно повторное ревью

## Что осталось

- [ ] Фикс Task 3 (сброс `currentLine` при таймауте)
- [ ] Повторное ревью Task 3
- [ ] Task 4: UI (CodeEditor + ProgramEditor)
- [ ] Task 5: документация, финализация
- [ ] Финальное ревью всей ветки

## Заметки для следующей сессии

**Восстановить контекст:**
- Leджер: `.superpowers/sdd/progress.md` содержит статусы Task 1–2
- Brief'ы: `.superpowers/sdd/task-{1,2,3}-brief.md` извлечены
- Отчёты: `.superpowers/sdd/task-{1,2,3}-report.md` созданы
- Diff'ы: `.superpowers/sdd/review-*.diff` для каждого таска

**Для фикса Task 3:**
```bash
# В CodeBehaviorDriver.ts, метод armTimeout, около строки 198
program.currentLine = null;  # добавить после program.codeError = ...
```

**Использовать:**
- Skill `superpowers:subagent-driven-development` для продолжения
- Task 3 фикс → повторное ревью → Task 4 → Task 5

---

**Спасибо за работу!** Подробный план позволит двигаться быстро и чётко в следующей сессии.

## Метрики сессии
- Модель: claude-haiku-4-5-20251001
- Input: 91 токенов (кеш: 4,377,157 / запись в кеш: 312,957)
- Output: 32,860 токенов
- Контекст: 101,905 / 200,000 токенов (51%)
- Стоимость: $2.980
