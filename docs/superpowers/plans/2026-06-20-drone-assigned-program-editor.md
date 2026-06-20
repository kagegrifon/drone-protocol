# Drone Tab: Assigned Program Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show assigned program code in a collapsible CodeEditor on the DRONE tab, making it editable symmetrically with the personal program.

**Architecture:** All changes are confined to a single file — `src/ui/editor/ProgramEditor/index.tsx`. Add `assignedExpanded` state (mirrors `personalExpanded`). Expand the assigned-program block to include a `CodeEditor` wired to `setProgramCodeSource(assignedProgram.id, code)`. Move `codeError` so it renders under whichever program is active (assigned if present, personal otherwise).

**Tech Stack:** React 18, TypeScript, existing `CodeEditor` component, Zustand store (`useGameStore`).

## Global Constraints

- Single file change only: `src/ui/editor/ProgramEditor/index.tsx`
- No changes to worker / simulation / Zustand store / types
- Existing buttons (↗ open-in-library, radio unassign) must continue to work
- `npm run type-check` must pass green
- e2e tests must pass

---

### Task 1: Add `assignedExpanded` state and collapse toggle for assigned program block

**Files:**
- Modify: `src/ui/editor/ProgramEditor/index.tsx:39` (state declarations, ~line 39)

**Interfaces:**
- Consumes: existing `personalExpanded` / `setPersonalExpanded` pattern
- Produces: `assignedExpanded: boolean`, `setAssignedExpanded: (v: boolean) => void` — used by Task 2

- [ ] **Step 1: Add the state**

In [src/ui/editor/ProgramEditor/index.tsx](src/ui/editor/ProgramEditor/index.tsx), after line 39 (`const [personalExpanded, setPersonalExpanded] = useState(true);`), add:

```tsx
const [assignedExpanded, setAssignedExpanded] = useState(true);
```

- [ ] **Step 2: Add collapse toggle button to the assigned-program block header**

Locate the assigned-program block header (currently lines ~134–173). The existing header `<div>` contains radio + name span + ↗ button. Add a collapse toggle button **before** the ↗ button:

```tsx
<button
  onClick={() => setAssignedExpanded(!assignedExpanded)}
  style={{
    background: "transparent",
    border: "none",
    color: "#445566",
    cursor: "pointer",
    fontFamily: "monospace",
    fontSize: "11px",
    padding: "0 4px",
  }}
>
  {assignedExpanded ? "▲" : "▼"}
</button>
```

Also add `marginBottom: assignedExpanded ? "8px" : 0` to the header `<div>` style (same as personal program header does).

- [ ] **Step 3: Type-check**

```
npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/ui/editor/ProgramEditor/index.tsx
git commit -m "feat: добавить состояние assignedExpanded и кнопку сворачивания назначенной программы"
```

---

### Task 2: Add CodeEditor for assigned program (collapsed/expanded)

**Files:**
- Modify: `src/ui/editor/ProgramEditor/index.tsx:131–174` (assigned block body)

**Interfaces:**
- Consumes: `assignedExpanded` from Task 1; `assignedProgram` (already derived at line 59); `setProgramCodeSource` (already imported at line 52)
- Produces: visible `CodeEditor` under assigned program name when `assignedExpanded === true`

- [ ] **Step 1: Add the CodeEditor inside the assigned block**

After the closing `</div>` of the header row (the one with radio + name + toggle + ↗), add the conditional editor:

```tsx
{assignedExpanded && (
  <CodeEditor
    value={assignedProgram.behavior.code}
    onChange={(code) =>
      setProgramCodeSource(assignedProgram.id, code)
    }
    height="240px"
  />
)}
```

- [ ] **Step 2: Verify visually (manual)**

Run `npm run dev`, select a drone that has an assigned program. Confirm:
- Assigned program name shows with ▲/▼ toggle and ↗ button.
- Editor is visible and shows code.
- Clicking ▲ collapses, ▼ expands.
- Editing code in the editor updates the drone's behavior (drone re-executes next tick — visible via its `currentInstruction`).

- [ ] **Step 3: Type-check**

```
npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/ui/editor/ProgramEditor/index.tsx
git commit -m "feat: показать CodeEditor назначенной программы на вкладке DRONE"
```

---

### Task 3: Move `codeError` to render under the active program

**Files:**
- Modify: `src/ui/editor/ProgramEditor/index.tsx:223–248` (personal block body where codeError currently lives)

**Interfaces:**
- Consumes: `drone.codeError` (already available); `assignedProgram` (already derived); `assignedExpanded` from Task 1
- Produces: `codeError` shown under assigned-program editor when assigned is active; shown under personal editor when personal is active (no assigned)

**Current state:** `drone.codeError` is rendered only inside the personal-program block (lines ~232–244). When there is an assigned program, the personal block is visually dimmed/inactive but the error still appears there — wrong.

- [ ] **Step 1: Remove codeError from personal program block**

In the personal block, delete the existing error div (currently inside the `personalExpanded &&` section):

```tsx
{drone.codeError && (
  <div
    style={{
      color: "#ff4444",
      fontFamily: "monospace",
      fontSize: "11px",
      marginTop: "6px",
      whiteSpace: "pre-wrap",
    }}
  >
    {drone.codeError}
  </div>
)}
```

- [ ] **Step 2: Add codeError inside assigned block (when assigned is expanded)**

In the assigned program block, after the `CodeEditor`, add:

```tsx
{drone.codeError && (
  <div
    style={{
      color: "#ff4444",
      fontFamily: "monospace",
      fontSize: "11px",
      marginTop: "6px",
      whiteSpace: "pre-wrap",
    }}
  >
    {drone.codeError}
  </div>
)}
```

So the full `assignedExpanded &&` section becomes:

```tsx
{assignedExpanded && (
  <>
    <CodeEditor
      value={assignedProgram.behavior.code}
      onChange={(code) =>
        setProgramCodeSource(assignedProgram.id, code)
      }
      height="240px"
    />
    {drone.codeError && (
      <div
        style={{
          color: "#ff4444",
          fontFamily: "monospace",
          fontSize: "11px",
          marginTop: "6px",
          whiteSpace: "pre-wrap",
        }}
      >
        {drone.codeError}
      </div>
    )}
  </>
)}
```

- [ ] **Step 3: Re-add codeError inside personal block for the case when personal is active**

The personal block still needs to show the error when there is NO assigned program (personal is the active one). Inside `personalExpanded &&`, after `<CodeEditor …/>`, add the same error div back:

```tsx
{!assignedProgram && drone.codeError && (
  <div
    style={{
      color: "#ff4444",
      fontFamily: "monospace",
      fontSize: "11px",
      marginTop: "6px",
      whiteSpace: "pre-wrap",
    }}
  >
    {drone.codeError}
  </div>
)}
```

- [ ] **Step 4: Type-check**

```
npm run type-check
```

Expected: no errors.

- [ ] **Step 5: Verify manually**

Run `npm run dev`.

Scenario A — drone with assigned program that has a code error:
- Error appears below assigned program editor, not inside personal block.

Scenario B — drone with no assigned program, personal program has error:
- Error appears below personal editor as before.

- [ ] **Step 6: Run e2e tests**

```
npm run test:e2e
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/ui/editor/ProgramEditor/index.tsx
git commit -m "fix: показывать codeError под редактором активной программы"
```

---

## Self-Review Checklist

- [x] Spec requirement: assigned program code shown in editor on DRONE tab → Task 2
- [x] Spec requirement: editable via `setProgramCodeSource` → Task 2
- [x] Spec requirement: collapsible block, same `BLOCK_STYLE`, `personalExpanded` pattern → Task 1 + 2
- [x] Spec requirement: existing buttons (↗, radio) preserved → only adding to header, not replacing
- [x] Spec requirement: no assigned program → behavior unchanged → Tasks preserve existing paths
- [x] Spec requirement: `codeError` under active program → Task 3
- [x] Spec requirement: `npm run type-check` green → type-check step in every task
- [x] No placeholder steps — all code shown inline
- [x] Type consistency: `assignedExpanded` / `setAssignedExpanded` introduced in Task 1, used in Tasks 2–3
