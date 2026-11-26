---
inclusion: always
---
# Product: Layover

Layover is a mobile-first web app that coordinates dawn bird-collision patrols for existing volunteer groups (for example, a city's local bird-safe-buildings group).

## What it does
- Ranks tonight's patrol routes by collision risk, with plain-language reasons.
- Opens claimable slots for patrol shifts. Open slots work like surplus-food apps: a shift that still needs a person is offered, and a volunteer claims it in one tap.
- Shows coordinators coverage gaps: routes and time windows with no volunteer.

## Two views, one app
- Volunteer view at `#volunteer`: tonight's routes, open slots, my boarding passes.
- Organization view at `#org`: ranked routes, coverage gaps, slot management.
Routing is hash-based. Unknown hashes fall back to `#volunteer`.

## Theme: night airport
Departures board for route lists, boarding passes for claimed slots. Dark navy background with amber accents. Keep contrast high and text readable at night.

## Rules (non-negotiable)
- Layover is a coordination tool for existing groups. It does not train people or replace a group's protocols.
- Untrained people never handle birds. The UI must not suggest touching, catching or transporting birds. Trained group members handle birds under their group's own procedures.
- Risk is shown only as `low`, `elevated` or `high`, each with plain reasons. Never show a death or casualty prediction or a numeric "birds at risk".
- All sample or demo data is visibly labelled as sample data.
- Every interactive control is at least 44x44 px.
- Do not use the branding, names or logos of inspiration products or existing groups. Layover has its own identity.
- Exception: plain-text credits and outbound links that name a data source or a resource the user can visit (for example the migration forecast dashboard, OpenStreetMap, the dataset authors) are allowed and encouraged. No logos, no look-alike styling, and no wording that suggests partnership or endorsement.
- Risk logic follows the evidence rules in `research.md`.
