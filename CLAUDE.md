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
- Add `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` to every commit trailer.
