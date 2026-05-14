# Robot Protocol — инструкции для Claude

## Справочные документы

- [Game Design Document (GDD).md](Game Design Document (GDD).md) — механики, визуал, аудио, миссии. Читать при работе над фазами 9–10 или при сомнениях в game design.
- [Technical Architecture.md](Technical Architecture.md) — стек, архитектура, типы данных. Читать только при принятии новых архитектурных решений. Ключевые решения уже перенесены в [PROGRESS.md](PROGRESS.md) (раздел «Ключевые архитектурные решения»).

---

## Имя игры

Игра называется **Drone Loop**. Кодовое имя проекта (папка, репозиторий): `robot-protocol`.
Использовать «Drone Loop» в документации и заголовках; «Robot Protocol» — только как техническое имя.

---

## Архитектура

- **Simulation Layer** (`src/game/simulation/`) — чистая игровая логика. **Никогда не импортирует Phaser.**
- **Presentation Layer** — Phaser (`src/renderer/`) рендерит состояние, React (`src/ui/`) показывает UI.
- Phaser только **наблюдает** состояние симуляции — не изменяет его.
- Поток данных: `React UI → команда → Simulation → Phaser рендерит → Zustand обновляет UI`

### Порядок систем в тике

```
CollisionSystem → ProgramExecutionSystem → MovementSystem → MiningSystem → EnergySystem → StatisticsSystem
```

---

## Ведение документации

- В конце каждой сессии добавлять запись в `docs/sessions/<date+time+feature|bug|config...+>slug>.md: цель, результаты.
- Коммитить изменения документации вместе с кодом фазы (тип `docs:`).

---

## Планирование фич
Фичи хранятся в `docs/features/planned/` и `docs/features/done/`.
- Новая фича → создать `docs/features/planned/<slug>.md` по шаблону в `docs/features/FEATURE-TEMPLATE.md` , добавить в `docs/features/index.md`.
- Завершена → переместить файл из `planned/` в `done/`, обновить `docs/features/index.md`.
- Индекс всех фич: `docs/features/index.md`.

Фича в разработке остаётся в `planned/` до завершения, статус меняется внутри файла, а так же в таблице `docs/features/index.md`.

## Правила работы с Git

- Каждая фаза — отдельный коммит после её завершения. Не коммить незавершённую работу.
- Формат сообщений коммитов: `<type>: <описание> (Фаза N)`
  - `feat:` — новая функциональность
  - `fix:` — исправление бага
  - `refactor:` — рефакторинг без изменения поведения
  - `docs:` — изменения документации (PROGRESS.md, SESSION.md)
  - `chore:` — конфигурация, зависимости
- Описание коммита — на русском, в повелительном наклонении («Добавить», «Реализовать», а не «Добавил»). Можно на английском — тогда также в повелительном («Add», «Fix»).
- Не коммить `node_modules/`, `.env`, артефакты сборки `dist/`.
- Никогда не использовать `git push --force` или `git reset --hard` без явного запроса пользователя.
- Перед коммитом проверять `git status` — коммитить только файлы, связанные с текущей задачей, не `git add -A` огульно.
- В трейлере каждого коммита добавлять `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.


