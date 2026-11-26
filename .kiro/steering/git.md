---
inclusion: always
---
# Git rules

## Branches
- Never commit directly to `main`. `main` deploys to Railway on push, so it stays releasable.
- One branch per spec task (or per small group of closely related tasks). Create it from the latest local `main` with `git switch -c <name>` before the first edit. If a task depends on an unmerged branch, branch from that one and say so in the log.
- Name branches `<type>/<spec>-task-<nn>-<slug>`, for example `feat/spec1-task-05-night-factors` or `docs/spec1-task-01-wind-evidence`. Use the same types as commits. Non-task work: `<type>/<slug>`.
- Check `git branch --show-current` before every commit. If it says `main`, stop and create a branch first.
- Merge into `main` only when the user asks: `git merge --ff-only <branch>` when possible, otherwise `git merge --no-ff`. Never rebase or squash. Delete a branch only after the user confirms it is merged.
- Pushing, opening a PR, and force-pushing happen only when the user asks. Run `npm run check` before suggesting a push.
- Record the branch name in the matching `docs/kiro-log.md` entry.

## Commits

- Commit small: one logical change per commit (one task step, one test file, one bug fix). Never bundle unrelated changes.
- Run `npm test` before every commit. Don't commit if tests fail unless the user says so.
- Stage only the files for that change with `git add <paths>`. Never use `git add .` or `git add -A`.
- Use Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`. Keep the subject under 72 characters, in present tense.
- In the commit body, add trailers when they apply: `Task: <spec task number>`, `Requirement: <R-ids>`, `Evidence: <E-ids>`.
- Never commit `.env` files, API keys or `node_modules`.
- Never push, force-push, rebase or reset unless the user asks.
- After committing, add the commit hash to the matching entry in `docs/kiro-log.md`.
