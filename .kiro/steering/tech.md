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
