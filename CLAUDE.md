# Robot Protocol — Claude instructions

## Quick start

```
npm run dev        # run the game
npm test           # unit tests (Vitest)
npm run test:e2e   # e2e tests (Playwright)
npm run type-check # type check
npm run build      # build
```

Read [DECISIONS.md](DECISIONS.md) before starting — key architectural decisions and rationale.

---

## Code quality — READABILITY is the top priority

Optimize every change for the next human reader, not for brevity or cleverness.

- **No nested ternaries.** Never chain `a ? b : c ? d : e`. Extract a helper function, a `switch`, or precompute a variable instead.
- **Name intermediate values.** A well-named `const` beats a complex inline expression. If a JSX prop value needs more than a trivial expression, compute it above `return` with a descriptive name.
- **Keep JSX flat and scannable.** Avoid deep inline conditionals and multi-branch expressions inside markup. Pull logic out into variables or small components.
- **One responsibility per function/component.** If you can't describe what it does in one sentence, split it.
- **Prefer clarity over fewer lines.** More lines that read top-to-bottom are better than dense one-liners.
- **Object parameters over positional ones.** When a function has **3+ parameters**, OR 2 parameters where one is `boolean`, OR 2 parameters of the same type, OR parameters whose role is hard to read at the call site — pass a single options object so every argument is named at the call site. Positional args are fine only when 1–2 parameters of distinct types read unambiguously.
  ```ts
  // ✗ call site is opaque: topoSortDeps(entry, registry, slugIndex, parseFor)
  function topoSortDeps(entryId: string, registry: ProgramRegistry, slugIndex: Map<string, string>, parseFor: (def: ProgramDef) => ParsedModule)
  // ✓ each argument is self-describing
  function topoSortDeps({ entryId, registry, slugIndex, parseFor }: TopoSortDepsArgs)
  ```
- **Descriptive names — never cryptic abbreviations.** No `imp`, `s`, `p`, `mod` as standalone identifiers. Loop variables, params, and locals get full words (`importDecl`, `slug`, `program`). This is a hard rule, not a preference. **Exception:** a short single-letter name is fine in a short inline callback where the element is obvious — e.g. `someArr.map(v => v.name)`. The exception does not apply to multi-line callbacks or anything beyond a trivial expression.
- **Replace long `if/else if` and `switch` chains with data structures.** When dispatching on a value, prefer a lookup map/record of handlers over branch chains — it reads declaratively and extends without touching control flow.
  ```ts
  // ✗ branch chain
  if (kind === "move") { ... } else if (kind === "mine") { ... } else if (kind === "drop") { ... }
  // ✓ declarative dispatch
  const HANDLERS: Record<ActionKind, () => void> = { move: () => ..., mine: () => ..., drop: () => ... };
  HANDLERS[kind]();
  ```
- **Model scattered logic as data in the right structure.** When several lines branch, compare, or accumulate over a fixed set of values, that's usually a data structure in disguise. Recognise it, then pick the structure whose shape matches the operation — readability, performance, and extensibility all follow from the fit. Adding a case becomes editing data, not rewriting control flow.

  | The operation is… | The fitting structure |
  |---|---|
  | «is this value one of N known options?» | `Set` (membership, O(1)) |
  | «which handler/value for this key?» | `Record`/`Map` (lookup, replaces `if`/`switch` chains) |
  | «count / group / dedupe by key» | `Map` keyed by that key |
  | «does this number fall in a range/bucket?» | sorted bounds array, not stacked `if (x < a) … else if (x < b)` |
  | «ordered set of steps/states» | array (or state map), iterate instead of unrolling |

  The membership case below is the most common smell — a long `x === a || x === b || x === c`:
  ```ts
  // ✗ piecewise OR-chain — grows with every new option
  const isBuildingTile = (tile: CellType) => tile === "mine" || tile === "base" || tile === "charger";
  // ✓ membership against a named set
  const BUILDING_TILES = new Set<CellType>(["mine", "base", "charger"]);
  const isBuildingTile = (tile: CellType) => BUILDING_TILES.has(tile);
  ```
  Before writing a third branch/comparison in a row, ask: «is there a structure whose native operation *is* this logic?» Usually yes.

When in doubt: would a teammate understand this at a glance without untangling it? If not, rewrite it.

**Post-implementation readability pass.** At the end of every coding task, before claiming it done, re-scan your own diff against all the rules above — specifically for cryptic names, multi-parameter functions that should take an options object, and `if`/`switch` chains that should be lookup maps — and fix what you find. The rules apply both while writing and as a final review.

---

## Reference documents

- [Game Design Document (GDD).md](Game Design Document (GDD).md) — mechanics, visuals, audio, missions. Read when working on phases 9–10 or when in doubt about game design.
- [Technical Architecture.md](Technical Architecture.md) — stack, architecture, data types. Read only when making new architectural decisions.
- [DECISIONS.md](DECISIONS.md) — key decisions with rationale. Update for any non-trivial architectural choice.

---

## Game name

The game is called **Drone Loop**. Project codename (folder, repo): `robot-protocol`.
Use "Drone Loop" in documentation and titles; "Robot Protocol" — only as the technical name.

---

## Architecture

- **Simulation Layer** (`src/game/simulation/`) — pure game logic. **Never imports Phaser.**
- **Presentation Layer** — Phaser (`src/renderer/`) renders state, React (`src/ui/`) shows UI.
- Phaser only **observes** simulation state — never modifies it.
- Data flow: `React UI → command → Simulation → Phaser renders → Zustand updates UI`
- Zustand store: `src/shared/store/gameStore.ts`

### System tick order

```
CollisionSystem → ProgramExecutionSystem → MovementSystem → MiningSystem → EnergySystem → StatisticsSystem
```

---

## Testing

- Unit tests — Vitest, next to the file (`*.test.ts`). Cover simulation layer systems.
- E2E tests — Playwright (`tests/` or `e2e/`).
  - Run in parallel — each test must be self-contained with an isolated context (own browser context / `localStorage`); never rely on shared state or ordering between tests.
  - **Always select UI elements by `data-testid` attribute.** Never rely on text content, tag names, or class names for selection. This ensures tests remain stable when text or styles change. Example:
    ```ts
    // ✗ brittle: breaks if text changes
    await page.getByText("Start Game").click();
    
    // ✓ stable: explicit test identifier
    await page.locator('[data-testid="start-button"]').click();
    ```
- Simulation layer tested without Phaser — pure TS.

---

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

Документацию коммить вместе с кодом фазы (тип `docs:`). После завершения фазы оцени, нужна ли
новая сессия (размер контекста, связь со следующей задачей, сложность); если да — дай готовый
starter prompt со сводкой контекста.

---

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

---

## Git rules

### Branch workflow

- All feature/fix work happens in a dedicated branch, **never directly on `main`**.
- Branch naming: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`.
- At the start of each session, check the current branch. If on `main`, create a feature branch first:
  ```
  git checkout -b feat/<slug>
  ```

### Git Worktrees (parallel agents)

- When running multiple agents in parallel, each agent works in its own git worktree under `.worktrees/`.
- Use the `EnterWorktree` tool (or `using-git-worktrees` skill) to set up an isolated workspace before starting parallel work.
- `node_modules` is symlinked automatically — no need to run `npm install` in each worktree.
- Each worktree has its own branch; merging back is the user's responsibility via PR.

### Commits

- Each phase — a separate commit after completion. Do not commit unfinished work.
- Commit message format: `<type>: <description> (Phase N)`
  - `feat:` — new functionality
  - `fix:` — bug fix
  - `refactor:` — refactoring without behavior change
  - `docs:` — documentation changes
  - `chore:` — configuration, dependencies
- Commit description — Russian imperative («Добавить», «Реализовать», not «Добавил»). English imperative is also fine («Add», «Fix»).
- Do not commit `node_modules/`, `.env`, build artifacts `dist/`.
- Never use `git push --force` or `git reset --hard` without explicit user request.
- Before committing, check `git status` — commit only files related to the current task, never `git add -A`.

