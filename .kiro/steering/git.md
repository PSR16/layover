---
inclusion: always
---
# Git rules

- Commit small: one logical change per commit (one task step, one test file, one bug fix). Never bundle unrelated changes.
- Run `npm test` before every commit. Don't commit if tests fail unless the user says so.
- Stage only the files for that change with `git add <paths>`. Never use `git add .` or `git add -A`.
- Use Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`. Keep the subject under 72 characters, in present tense.
- In the commit body, add trailers when they apply: `Task: <spec task number>`, `Requirement: <R-ids>`, `Evidence: <E-ids>`.
- Never commit `.env` files, API keys or `node_modules`.
- Never push, force-push, rebase or reset unless the user asks.
- After committing, add the commit hash to the matching entry in `docs/kiro-log.md`.
