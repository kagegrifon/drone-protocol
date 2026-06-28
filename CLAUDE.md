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

## Documentation

- At the end of each session add an entry to `docs/sessions/<date+time+feature|bug|config...+slug>.md`: goal, results.
- Commit documentation changes together with the phase code (type `docs:`).
- After completing a phase, assess whether a new session is warranted (context size, relatedness to next task, complexity). If yes — provide a ready-to-paste starter prompt with the relevant context summary.

---

## Feature planning

Features are stored in `docs/features/planned/` and `docs/features/done/`.
- New feature → create `docs/features/planned/<slug>.md` from the template in `docs/features/FEATURE-TEMPLATE.md`, add to `docs/features/index.md`.
- Done → move file from `planned/` to `done/`, update `docs/features/index.md`.
- Feature index: `docs/features/index.md`.

A feature stays in `planned/` until complete; update status inside the file and in the `docs/features/index.md` table.

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

