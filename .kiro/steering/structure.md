---
inclusion: always
---
# Project structure

```
layover/
  index.html            App shell, loads src/main.js
  src/
    main.js             Entry point, hash router (#volunteer, #org)
    lib/                Pure logic, no DOM or network (risk, ranking, slots, coverage, escape)
    views/              Volunteer and Organization view rendering
    components/         Reusable UI pieces (departures board row, boarding pass, risk badge)
    map/                Leaflet setup and layers
    api/                Overpass and other fetch code
    data/               Labelled sample data
    styles/             CSS (navy and amber tokens, 44px control sizes)
  tools/                One-off build scripts (Node, plus one Python export). Not part of the app bundle.
  tests/                Vitest and fast-check tests, mirroring src/lib
  docs/                 research.md (evidence table), kiro-log.md (build journal)
  .kiro/
    steering/           product.md, tech.md, structure.md, research.md, git.md, kiro-journal.md
    specs/              Requirements, design, tasks
```

## Rules
- Dependencies point inward: views and components may import from `lib`; `lib` imports nothing from the rest of `src`.
- One module per concern in `src/lib`, with a matching file in `tests/`.
- Keep `docs/kiro-log.md` current after each task or significant change.
