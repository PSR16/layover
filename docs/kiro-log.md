# Kiro Build Log: Kiroween 2026

A running, factual record of how Kiro was used to build this project. Entries are append-only. Corrections are added as dated "Update" lines, never by deleting earlier text.

## Timeline

### 2026-11-26: Build tracking set up
- **Phase/task:** Project setup.
- **What Kiro did:** Created this log, the always-on steering file that keeps it current, and a hook that checks the log whenever a spec task finishes.
- **Files changed:**
  - `docs/kiro-log.md` (created)
  - `.kiro/steering/kiro-journal.md` (created, `inclusion: always`)
  - `.kiro/hooks/log-task-completion.kiro.hook` (created, trigger: post task execution)
- **Corrected or rejected:** Nothing yet.

### 2026-11-26: Product, tech and structure steering
- **Phase/task:** Project setup.
- **What Kiro did:** Wrote three always-on steering files from the user's brief: product (purpose, two views, night-airport theme, safety rules), tech (Vite, vanilla JS, Leaflet, Overpass, Vitest, fast-check, pure `src/lib`, escaping) and structure (folder layout, dependency direction).
- **Files changed:**
  - `.kiro/steering/product.md` (created, `inclusion: always`)
  - `.kiro/steering/tech.md` (created, `inclusion: always`)
  - `.kiro/steering/structure.md` (created, `inclusion: always`)
- **Commit:** `641b4af`

### 2026-11-26: Earlier setup files committed
- **Phase/task:** Project setup.
- **What Kiro did:** Committed files created before this entry, in three commits: git and journal steering (`a219ad1`), risk evidence table `docs/research.md` with `.kiro/steering/research.md` (`59e903c`), and the hooks in `.kiro/hooks/` (`61d6f96`).
- **Corrected or rejected:** Nothing.
- **Corrected or rejected:** User: "Do not brand with things like lights out or too good to go as these are insirpiration". Kiro's first draft had no inspiration names in the files, and a rule now forbids using them. The first draft's slot description ("surplus-food apps") was kept generic.

## Surfaces

_No entries yet._ Record work done in Kiro IDE, CLI, Web or Crew, and how they compared.

## Spec-driven development

_No entries yet._ Record spec structure, changes to requirements, design or tasks and why, and where the spec prevented rework compared with vibe coding.

## Steering

- `.kiro/steering/product.md`, `tech.md`, `structure.md`: inclusion `always`. Purpose: product rules, stack conventions and folder layout in every session. Before/after examples: none yet.
- `.kiro/steering/kiro-journal.md`: inclusion `always` (loaded in every session). Purpose: makes Kiro update this log before reporting work done. Before/after examples: none yet.

## Hooks

- **log-task-completion** (`.kiro/hooks/log-task-completion.kiro.hook`)
  - Trigger: a spec task finishes (post task execution).
  - Automates: checks `docs/kiro-log.md` for an entry about the task and adds one if missing.
  - Caught so far: nothing yet.

## MCP

_No entries yet._ Record each server, its use, and what it made possible.

## Custom agents

_No entries yet._ Record each agent, its allowed tools, the surface it ran in, and what it produced.

## Property-based testing

_No entries yet._ Record each property, its requirement or evidence ID, and any bug found that unit tests missed (with the failing example).

## Powers

_No entries yet._

## Research

_No entries yet._ Record evidence IDs added, and where research changed the design or the weights. See `docs/research.md`.

## Mistakes and fixes

_No entries yet._ Record what Kiro got wrong, how it was caught, and the fix.

## Numbers

| Metric | Value |
| --- | --- |
| Tasks completed | 0 |
| Unit tests | 0 |
| Property-based tests | 0 |
| Bugs caught by tests | 0 |
| Bugs caught by hooks | 0 |
| Hours spent | 0 |

## Screenshots to take

- [ ] `.kiro/hooks/log-task-completion.kiro.hook` in the Agent Hooks panel
- [ ] `.kiro/steering/kiro-journal.md` showing `inclusion: always`
- [ ] The three new steering files (`product.md`, `tech.md`, `structure.md`) in the Steering panel
- [ ] First hook run adding a log entry after a spec task
