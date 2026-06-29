# Единый процесс ведения документации — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Установить единый процесс документации фич (features = источник правды, specs/plans = история, sessions = опциональный журнал тупиков), обновить CLAUDE.md и шаблон, мигрировать две проблемные карточки.

**Architecture:** Чисто документация, без кода фич. Правки текстовых .md-файлов с перелинковкой. «Тесты» здесь — проверка связности ссылок (целевые файлы существуют) и отсутствия дублирования.

**Tech Stack:** Markdown. Git Bash для проверки существования файлов по ссылкам.

## Global Constraints

- **Не писать код фич** — только документация и процесс.
- Источник правды описания фичи — `docs/features/<slug>.md` (карточка).
- specs/ и plans/ — исторические, **не правятся задним числом** (кроме создания новых).
- Не заводить реестры `specs/index.md` / `plans/index.md` — единственный реестр `features/index.md`.
- Старые карточки `done/` и старые сессии **не трогаем** (кроме library-modules-import).
- Ссылки в карточках — относительные от расположения файла; целевой файл обязан существовать.
- Спека процесса: `docs/superpowers/specs/2026-06-29-docs-process-unification-design.md`.

---

### Task 1: Обновить шаблон карточки фичи

**Files:**
- Modify: `docs/features/FEATURE-TEMPLATE.md`

**Interfaces:**
- Produces: канонический шаблон карточки с полями Статус/Spec/Plan и секциями
  «Технические заметки», «Журнал сессий». На него ссылаются Task 4 и CLAUDE.md (Task 5).

- [ ] **Step 1: Переписать FEATURE-TEMPLATE.md**

Заменить всё содержимое файла на:

````markdown
## Шаблон карточки фичи

Карточка — **единственный источник правды** описания фичи: что/зачем/поведение/критерии,
актуальные на сегодня. Spec и plan — исторические артефакты сессий, на них ссылаются.

```markdown
# <Название фичи>

**Статус:** planned | in-progress | done
**Spec:** docs/superpowers/specs/<date>-<topic>-design.md   (если есть)
**Plan:** docs/superpowers/plans/<date>-<topic>.md           (если есть)

## Зачем
## Поведение
## Критерии готовности
## Технические заметки

> Кратко. Детали дизайна — в спеке, пошаговая реализация — в плане (по ссылкам выше).
> Не дублировать сюда содержание спеки/плана.

## Журнал сессий

> Опционально. Только сессии с нетривиальным нарративом (отброшенные подходы, root-cause,
> «почему так»). Ссылка, не пересказ.

- docs/sessions/<date>-... — <что произошло>
```

Поля **Spec/Plan** и секцию **Журнал сессий** опускают, если соответствующих артефактов нет
(мелкие фичи без brainstorming).
````

- [ ] **Step 2: Проверить, что файл не содержит плейсхолдеров-заготовок**

Run: `grep -nE "TBD|TODO|FIXME" "docs/features/FEATURE-TEMPLATE.md"`
Expected: пусто (нет совпадений).

- [ ] **Step 3: Commit**

```bash
git add docs/features/FEATURE-TEMPLATE.md
git commit -m "docs: новый шаблон карточки фичи (Spec/Plan/Журнал сессий)"
```

---

### Task 2: Починить карточку library-modules-import

**Files:**
- Modify: `docs/features/done/library-modules-import.md:5`

**Interfaces:**
- Consumes: шаблон из Task 1 (поля Spec/Plan/«Журнал сессий»).
- Контекст: спеки в репозитории у этой фичи **нет** (план был внешний, `.claude/plans/`,
  вне репозитория). Поэтому поле Spec опускаем, Plan опускаем, оставляем «Журнал сессий».

- [ ] **Step 1: Удалить битую строку ссылки на внешний план**

Удалить строку 5 целиком:

```
План реализации: [hidden-kindling-gizmo.md](../../../../../.claude/plans/hidden-kindling-gizmo.md) (локальный, вне репозитория)
```

- [ ] **Step 2: Добавить секцию «Журнал сессий» в конец файла**

В конец `docs/features/done/library-modules-import.md` добавить:

```markdown

## Журнал сессий

- [2026-06-28-feat-library-modules-import.md](../../sessions/2026-06-28-feat-library-modules-import.md)
  — рефакторинг обхода AST на acorn-walk, E2E-тесты, финальная верификация и документация.
```

- [ ] **Step 3: Проверить, что ссылка на сессию указывает на существующий файл**

Run: `ls "docs/sessions/2026-06-28-feat-library-modules-import.md"`
Expected: путь существует (файл найден).

- [ ] **Step 4: Проверить отсутствие битой внешней ссылки**

Run: `grep -n "hidden-kindling-gizmo" "docs/features/done/library-modules-import.md"`
Expected: пусто (ссылка удалена).

- [ ] **Step 5: Commit**

```bash
git add docs/features/done/library-modules-import.md
git commit -m "docs: убрать битую внешнюю ссылку, добавить Журнал сессий (library-modules-import)"
```

---

### Task 3: Завести недостающую карточку фичи отладки многомодульных программ

**Files:**
- Create: `docs/features/done/multimodule-debugging.md`

**Interfaces:**
- Consumes: шаблон из Task 1.
- Сводит четыре разбросанных артефакта (2 спеки + 2 плана + 3 сессии) в один источник
  правды — это и есть «починка» проблемы step-debug без карточки.
- Все ссылки относительны от `docs/features/done/` → `../../superpowers/...`, `../../sessions/...`.

- [ ] **Step 1: Создать карточку**

Создать `docs/features/done/multimodule-debugging.md`:

```markdown
# Отладка многомодульных программ (stack trace + подсветка вызова подпрограммы)

**Статус:** done
**Spec:** [subprogram-call-highlight](../../superpowers/specs/2026-06-29-subprogram-call-highlight-design.md), [step-debug stack trace](../../superpowers/specs/2026-06-29-step-debug-stack-trace-design.md)
**Plan:** [subprogram-call-highlight](../../superpowers/plans/2026-06-29-subprogram-call-highlight.md), [step-debug stage A](../../superpowers/plans/2026-06-29-step-debug-stack-trace-stage-a-plan.md)

## Зачем

В Code Mode код дрона может импортировать подпрограммы из библиотеки. До этой фичи подсветка
текущей строки работала только для entry-программы: пока исполнение уходило в тело
импортированного модуля, подсветка гасла, а стек вызовов был не виден — отладка
многомодульных программ была «слепой».

## Поведение

- При исполнении тела импортированной подпрограммы подсвечивается активная строка в правильном
  файле (entry или модуль), а не гаснет.
- Над редактором вкладки DRONE показывается **Call Stack** — горизонтальные хлебные крошки
  кадров вызова; переход по кадрам открывает соответствующий файл.
- Код модуля при step-into показывается как read-only превью с подсветкой (редактирование
  модуля остаётся на вкладке PROGRAM).

## Критерии готовности

- `lineStack` (стек склеенных строк вызова) проходит от воркера через драйвер до UI.
- Политика маппинга «гасить в модулях» заменена на «показывать полный стек кадров».
- Call Stack рендерится крошками над редактором DRONE; навигация по кадрам работает.
- `npm test`, `npm run type-check`, `npm run test:e2e` зелёные.

## Технические заметки

> Детали дизайна — в спеках, пошаговая реализация — в планах (по ссылкам выше).

Фича сделана в две стадии. Подготовительная (subprogram-call-highlight) заложила
инфраструктуру `lineStack` в [codeRuntime.ts](../../../src/game/code/worker/codeRuntime.ts)
(`__line/__pushCall/__popCall/__call`). Stage A (step-debug stack trace) заменил политику
маппинга в [mapLine.ts](../../../src/game/code/linker/mapLine.ts) и провёл `StackFrame[]` до UI.
Движок исполнения не менялся. Стадии B (Pause/Step/Continue) и C (statement-level + breakpoints)
— возможные будущие этапы, в эту фичу не входят.

## Журнал сессий

- [2026-06-29-1900-subprogram-highlight-tasks1-3.md](../../sessions/2026-06-29-1900-subprogram-highlight-tasks1-3.md)
  — инфраструктура call-stack-маппинга (Tasks 1–3).
- [2026-06-29-2000-feat-step-debug-stack-trace-stage-a-steps1-4.md](../../sessions/2026-06-29-2000-feat-step-debug-stack-trace-stage-a-steps1-4.md)
  — Stage A, шаги 1–4.
- [2026-06-29-2030-feat-step-debug-stack-trace-stage-a-steps5-7.md](../../sessions/2026-06-29-2030-feat-step-debug-stack-trace-stage-a-steps5-7.md)
  — Stage A, шаги 5–7 (завершение, готов к merge).
```

- [ ] **Step 2: Проверить, что все 7 ссылок на артефакты указывают на существующие файлы**

Run:
```bash
for f in \
  "docs/superpowers/specs/2026-06-29-subprogram-call-highlight-design.md" \
  "docs/superpowers/specs/2026-06-29-step-debug-stack-trace-design.md" \
  "docs/superpowers/plans/2026-06-29-subprogram-call-highlight.md" \
  "docs/superpowers/plans/2026-06-29-step-debug-stack-trace-stage-a-plan.md" \
  "docs/sessions/2026-06-29-1900-subprogram-highlight-tasks1-3.md" \
  "docs/sessions/2026-06-29-2000-feat-step-debug-stack-trace-stage-a-steps1-4.md" \
  "docs/sessions/2026-06-29-2030-feat-step-debug-stack-trace-stage-a-steps5-7.md"; do
  test -f "$f" && echo "OK $f" || echo "MISSING $f"; done
```
Expected: семь строк `OK ...`, ни одной `MISSING`.

- [ ] **Step 3: Commit**

```bash
git add docs/features/done/multimodule-debugging.md
git commit -m "docs: завести карточку фичи отладки многомодульных программ"
```

---

### Task 4: Обновить index.md фич

**Files:**
- Modify: `docs/features/index.md:36-40`

**Interfaces:**
- Consumes: новую карточку из Task 3.
- Добавляет строку новой фичи в таблицу `done`.

- [ ] **Step 1: Добавить строку в таблицу done**

В `docs/features/index.md`, в конец таблицы секции `### done` (после строки
`library-modules-import`), добавить:

```markdown
| [multimodule-debugging.md](done/multimodule-debugging.md) | Отладка многомодульных программ (stack trace + подсветка вызова подпрограммы) |
```

- [ ] **Step 2: Проверить, что ссылка из index указывает на существующий файл**

Run: `ls "docs/features/done/multimodule-debugging.md"`
Expected: путь существует.

- [ ] **Step 3: Commit**

```bash
git add docs/features/index.md
git commit -m "docs: добавить multimodule-debugging в реестр фич"
```

---

### Task 5: Обновить CLAUDE.md (разделы Feature planning и Documentation)

**Files:**
- Modify: `CLAUDE.md` (раздел «## Feature planning», раздел «## Documentation»)

**Interfaces:**
- Consumes: роли каталогов и правила из спеки процесса.
- Финальный шаг — фиксирует процесс, чтобы будущие сессии не плодили дубли.

- [ ] **Step 1: Заменить раздел «## Documentation»**

Найти текущий раздел `## Documentation` и заменить его тело на:

```markdown
## Documentation — каталоги и их роли

| Каталог | Роль | Кто ведёт |
|---|---|---|
| `docs/features/` | **Источник правды.** Одна фича = одна карточка: актуальное что/зачем/поведение/критерии, статус, ссылки на spec/plan/сессии. `index.md` — единственный реестр. | Вручную |
| `docs/superpowers/specs/` | Дизайн-артефакт сессии (brainstorming). Датированный снимок «как придумали». Не правится задним числом. | Авто (скилл) |
| `docs/superpowers/plans/` | План реализации (writing-plans). Датированный. Не правится задним числом. | Авто (скилл) |
| `docs/sessions/` | **Опциональный** журнал решений и тупиков. | Вручную, по необходимости |

**Принцип «один факт — одно место»:** описание фичи живёт только в карточке; spec/session
**ссылаются**, не пересказывают. «Как придумали» — в спеке, «как делали» — в плане,
«что отброшено / почему так» — в сессии.

**Сессии (`docs/sessions/`) — опциональны и нарративны.** Писать сессию, **только** когда есть
нетривиальный нарратив: отброшенные подходы, найденный root-cause, неочевидное «почему так».
Сессия вида «реализовал по плану, всё зелёное» **не пишется** — это уже в карточке/плане/git.
Сессия ссылается на карточку/спеку, не дублирует их. Имя: `docs/sessions/<date+time+type+slug>.md`.
Карточка фичи собирает ссылки на свои сессии в секции «Журнал сессий».

Документацию коммить вместе с кодом фазы (тип `docs:`).
```

- [ ] **Step 2: Заменить раздел «## Feature planning»**

Найти текущий раздел `## Feature planning` и заменить его тело на:

```markdown
## Feature planning

Карточка `docs/features/<slug>.md` — **единственный источник правды** описания фичи.
Шаблон: `docs/features/FEATURE-TEMPLATE.md`. Структура каталогов:

```
docs/features/
  planned/   ← описана, ждёт очереди
  done/      ← реализована
```

- **Каждая фича обязана иметь карточку.** brainstorming/writing-plans создают spec и plan
  как обычно, но фича заводится карточкой, которая на них ссылается (при старте реализации
  либо по завершении). Spec без карточки — незавершённый процесс.
- Новая фича → карточка в `planned/` из шаблона, строка в `docs/features/index.md`.
- Карточка линкует на spec/plan (если есть) в шапке и на сессии в «Журнале сессий».
  Не дублировать в карточку содержание спеки/плана — только ссылки + актуальное описание.
- `planned → done` = переместить файл из `planned/` в `done/`, обновить статус внутри файла
  и таблицу в `docs/features/index.md`.
- Реестр — только `docs/features/index.md`. Реестры для specs/plans не заводим.
```

- [ ] **Step 3: Проверить отсутствие старой формулировки «в конце каждой сессии»**

Run: `grep -n "конце каждой сессии" CLAUDE.md`
Expected: пусто (старое обязательное правило убрано).

- [ ] **Step 4: Проверить, что оба раздела на месте**

Run: `grep -nE "^## (Documentation|Feature planning)" CLAUDE.md`
Expected: две строки (оба заголовка присутствуют).

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: единый процесс документации в CLAUDE.md (источник правды + опциональные сессии)"
```

---

## Self-Review

**Spec coverage** (сверка с `2026-06-29-docs-process-unification-design.md`):
- Роли каталогов → Task 5 (таблица в CLAUDE.md). ✓
- Принцип «один факт — одно место» → Task 5. ✓
- Правило «каждая фича обязана иметь карточку» → Task 5 (Feature planning). ✓
- Новый шаблон карточки → Task 1. ✓
- Роль/правила sessions → Task 5 (Documentation). ✓
- Миграция library-modules-import (битая ссылка + журнал) → Task 2. ✓
- Завести недостающую карточку step-debug → Task 3 (+ Task 4 реестр). ✓
- Не трогаем старые карточки/specs/plans/sessions, не заводим лишние реестры → Global Constraints + явно в Task 5. ✓

**Placeholder scan:** плейсхолдеров-заготовок в шагах нет; всё содержимое приведено дословно. ✓

**Type/имена consistency:** имена файлов специфицированы точно и сверены glob/grep'ом до написания
плана (обе спеки, оба плана, три сессии существуют; у library-modules-import спеки в репозитории
нет — поля Spec/Plan правомерно опущены в Task 2). ✓

**Замечание по объёму:** library-modules-import не получает поля Spec/Plan, т.к. в репозитории нет
её спеки/плана (план был внешний). Это соответствует шаблону («поля опускаются, если артефактов нет»).
