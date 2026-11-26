---
inclusion: always
---
# Tech stack

- Build: Vite, vanilla JavaScript (ES modules). No UI framework.
- Map: Leaflet with OpenStreetMap tiles. Keep the required attribution visible.
- Building data: Overpass API (OpenStreetMap). Handle timeouts, rate limits and empty results with a visible fallback.
- Tests: Vitest for unit tests, fast-check for property-based tests. Run with `npm test`.

## Conventions
- Pure logic lives in `src/lib` and never touches the DOM, `window`, `document` or the network. Pass data in, return data out, so it is testable without a browser.
- DOM, Leaflet and fetch code lives outside `src/lib` (views, map, API modules).
- Escape all data (API results, user input, sample data) before inserting it into HTML. Prefer `textContent` and DOM APIs; if building HTML strings, use a shared `escapeHtml` helper.
- Risk factors and weights follow `research.md` (evidence IDs in comments).
- Controls are at least 44px tall and wide.
- Never commit `.env` files or keys.

## Quality gates
- Git hooks (Husky): pre-commit runs lint-staged (ESLint, Prettier, secretlint) and `npm test`; commit-msg runs commitlint; pre-push runs `npm run check`. Never bypass with `--no-verify`.
- Readability limits are ESLint errors: complexity 8, cognitive complexity 10, depth 3, 40 lines per function, names of 3+ characters, no abbreviations, no nested ternaries. Write small functions with descriptive names and early returns.
- `package.json` and `package-lock.json` change together. Dependencies are pinned exactly (`.npmrc`).
- Node 22.12 or newer (`.nvmrc`).
- CI: GitHub Actions. Deploy: Railway, linked to the GitHub repo, builds on push to `main`. Work happens on branches and reaches `main` only when the user merges (see git.md). Vite `base` stays `/`.
