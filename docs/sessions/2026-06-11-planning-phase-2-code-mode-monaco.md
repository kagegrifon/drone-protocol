# 2026-06-11 — Planning Phase 2 Code Mode (Monaco Editor)

**Goal:** Design implementation plan for Phase 2 (Monaco editor + code/block toggle) of Code Mode feature.

**Status:** ✅ Complete — plan approved, ready for implementation.

---

## Summary

**Phase 1 (code mode core)** was merged to main with 25 commits (0d000a2..3d7d30b). Drones can now execute async/await JS/TS code in Web Workers via `CodeBehaviorDriver`, alongside block-based `AstBehaviorDriver`. All tests passing (241/241), type-check green.

**Phase 2 objective:** Give players a real code editor (Monaco with type hints from `drone-api.d.ts`) and a global code/block mode toggle.

### Key Architecture Decisions (User-Locked)

1. **Global mode flag** — not per-drone/per-program
   - Single `codeModeEnabled: boolean` in `gameStore` (persists to localStorage)
   - Fixer during mission (can't change gameStatus during running/paused)
   - Determines which `BehaviorDriver` all drones use
   - Filters library to show only programs of current mode

2. **Personal programs only during mission**
   - Created fresh each mission, no persistence
   - When `codeModeEnabled=true`, `gameStore.init()` converts personal program to code mode
   - Editing available via Monaco in DRONE tab while mission running
   - No separate CODE tab — Monaco replaces block list in existing DRONE/PROGRAM tabs

3. **CodeBehaviorDriver wiring**
   - Currently only in tests, not in `gameStore.init()` production code
   - Phase C adds it, prerequisite for Phase F UI

### Implementation Plan (8 phases, 8 commits)

| Phase | Name | Files | Estimated |
|-------|------|-------|-----------|
| A | Global flag + data model | gameStore.ts, types.ts, missions | 1 hour |
| B | Dispatch logic | ProgramExecutionSystem.ts, tests | 1 hour |
| C | Wire CodeBehaviorDriver | gameStore.ts init() | 30 min |
| D | Monaco + Vite | package.json, vite.config, monacoSetup.ts | 1 hour |
| E | CodeEditor component | CodeEditor.tsx | 30 min |
| F | Settings toggle + integration | AudioSettingsModal, ProgramEditor | 2 hours |
| G | E2E test | code-mode.spec.ts | 1 hour |
| H | Documentation | docs/, feature move | 30 min |

Full detail in `C:\Users\Master\.claude\plans\1-code-squishy-eagle.md`.

---

## Design Clarifications (from user Q&A)

**Q: Separate `behaviorMode` fields for personal vs library programs?**  
A: Yes, each `ProgramDef` gets `behaviorMode: "block" | "code"` set at creation. Since mode is global and fixed during mission, in practice all programs in a session have the same mode. Missions always create `behaviorMode: "block"`; `gameStore.init()` post-processes personal programs to `"code"` when `codeModeEnabled=true`.

**Q: Persist code/block mode or just programDefinitions?**  
A: Only `codeModeEnabled` (like audio settings). Program contents stay in-memory, reset on reload.

**Q: Can you edit code while drone running?**  
A: Yes — `gameStore.init()` happens once at mission start, but `setProgramCodeSource()` action is available anytime during mission (as long as drone exists).

**Q: Adaptive Monaco height?**  
A: Monaco uses `automaticLayout: true` (default in `@monaco-editor/react`) inside flex container with `flex: 1, minHeight: 0`. Resizes with `BottomPanel` drag-handle and fullscreen toggle automatically.

---

## Resources Created

- **Plan file:** `C:\Users\Master\.claude\plans\1-code-squishy-eagle.md`
- **Session memory:** `C:\Users\Master\.claude\projects\...\memory\session_2026_06_11_phase_2_planning.md`
- **Next session prompt:** `C:\Users\Master\.claude\projects\...\memory\next_session_prompt.md`

---

## Next Steps

1. Start Phase A implementation (global flag + data model)
2. Execute phases B–H sequentially with commits
3. Total ~8 hours of coding + testing + docs

Ready to begin Phase A in next session.

## Метрики сессии
- Модель: claude-haiku-4-5-20251001
- Input: 5,465 токенов (кеш: 9,159,411 / запись в кеш: 716,912)
- Output: 97,261 токенов
- Контекст: 141,311 / 200,000 токенов (70.7%)
- Стоимость: $6.912
