# Kiro build log · Layover (Kiroween 2026)

How to use this file:
- Kiro adds entries automatically (see .kiro/steering/kiro-journal.md and the log-check hook).
- Lines starting with **Me:** are written by me, not Kiro. Those are my own judgments and comparisons.
- Never delete entries. Add "Update:" lines instead.

---

## Timeline
<!-- One entry per task, hook, agent, MCP change or notable moment. Newest at the bottom. -->
<!-- Format:
### YYYY-MM-DD · Task N / short title
- Surface: IDE | CLI | Web | Crew
- What Kiro did:
- Files:
- Requirements / evidence: R?, E?
- Tests: added / passing / failing
- Commits: abc1234, def5678
- My correction (quoted):
- Screenshot: yes/no (file name)
-->

### Spec 1 · Foundation and risk engine: requirements draft
- Surface: IDE
- What Kiro did: Read the idea brief and docs/research.md, asked clarifying questions, proposed a 4-spec split (foundation and risk, map and data, slots and volunteer journey, coordinator tools; shared claims optional). Drafted spec 1 requirements R1 to R29 in EARS form with evidence IDs and a property-test table.
- Files: .kiro/specs/01-foundation-risk-engine/requirements.md
- Requirements / evidence: R1 to R29; E1 to E8, E10, E11, E14, E15, E17
- Tests: none yet (requirements only)
- Commits: dcfe529 (steering wind rule), 67c0d4c (spec 1 requirements, design, tasks)
- Update: My instruction: "make sure to use branches too and update any steering docs for this". Branch `chore/branch-workflow-steering` adds a Branches section to `.kiro/steering/git.md` (no commits on `main`, one branch per spec task, naming pattern, merge only when asked), a note in `tech.md`, and a branch check in the test-and-commit hook prompt. The earlier spec 1 commits (dcfe529, 67c0d4c, 825d517) were made directly on `main` before this rule existed.
- Update: Task 1 on branch `docs/spec1-task-01-wind-evidence` (stacked on the steering branch). Chen et al. 2024 abstract is consistent with "wind from" (full text paywalled, not read). New finding: spring low visibility roughly triples collisions independent of migration traffic, so R15 now treats it as unfavorable even without migration data. Added E18 to E21 to docs/research.md. The Muenchow abstract states hypotheses only, so it changes no weight.
- Update: Dataset identified as Van Doren et al. 2021 (Mendeley, DOI 10.17632/mjvt3yxdkv.2). I gave the file as ChicagoBirds.zip and confirmed "CC BY 4.0". Kiro listed the zip, extracted only the collision, radar and weather files to ~/Documents/Development/layover-data (outside the repo), and found 3,468 dawn surveys (1999 to 2020) where the top 15% of days hold 67% of birds. Branch `docs/data-licence-attribution` adds docs/data-sources.md and R36 (credits text). Lighting codes still to decode.
- Update: I asked "where is the .rmd file" (I had listed but not unpacked code.tar.gz). Kiro unpacked it, read collisions_analysis_archive.Rmd, and wrote docs/data-profile.md on branch `docs/data-profile-mcp` (stacked on `docs/data-licence-attribution`): lighting codes decoded (lit only when `YN`), night split in thirds by sunset to sunrise, wind as "from" with u/v components, moon illumination as a candidate factor. The meaning of the second code letter is inferred and marked so.
- Update: I approved ("sure") merging the data branches and updating spec 1. Branches `docs/data-licence-attribution` and `docs/data-profile-mcp` were fast-forwarded into `main`. Branch `docs/spec1-radar-thirds-lake` adds R37 (night parts), R38 (lakeshore with westerly wind), R39 (lit share, dim and covered unlit), a radar-based replay-night definition in R26, the matching design section 10 and a new Task 9a (build the radar-night table). Open: where the build script lives (design point 6).
- Update: Task 2 done on branch `feat/spec1-task-02-season-wind-night-parts` (merged radar/thirds branch into main first, as I approved with "sure"). Added src/lib/season.js, wind.js, night-parts.js, night-times.js (suncalc 2.1.4, pinned) and 4 test files; 32 tests passing, `npm run check` passes. Commits: db8dacd (suncalc), eb7eb38 (season), 2406dab (wind), bc8e151 (night parts and times).
- Update: Tests caught three problems before commit. (1) `getNightPart` returned `undefined` instead of `null` for an invalid time (NaN progress slipped through). (2) My first property test for splitting nights was wrong: rounding to milliseconds put a reading just past sunrise inside the night; fixed by generating whole minutes. (3) suncalc returns `null`, not an invalid Date, when the sun never sets, so the polar-day check needed `instanceof Date`. Also fixed a season property test that generated invalid dates.
- Update: Task 3 done on branch `feat/spec1-task-03-default-config` (Task 2 branch merged to main first). src/lib/risk-config.js holds weights, thresholds, wind sectors, season dates and reason wording as plain data, every entry tagged with evidence IDs or "assumption". tests/risk-config.test.js reads docs/research.md and fails if a cited evidence ID does not exist; 55 tests pass. Commits: 946ae94 (eslint override for the config file), 075e528 (config and tests).
- Update: I asked how close this is to BirdCast and about linking out to its dashboard (https://dashboard.birdcast.org/region/US-OH?night=2026-06-02). Kiro checked the URL pattern (state `US-OH`, county `US-OH-049`, optional `?night=`). Idea noted for a later spec as a plain outbound link, not an API. Open: product.md says not to use names of existing groups, so the link label and credit wording need a decision.
- Update: My decision: "label BirdCast is fine". Branch `docs/product-allow-source-credits` adds an exception to the naming rule in product.md (plain-text credits and outbound links to data sources are allowed; no logos, no endorsement wording) and records the dashboard URL pattern in docs/data-sources.md. This is a change to a product rule, made at my request.
- Update: I said "this is a fine start". Kiro then wrote tasks.md (16 tasks in 3 phases, with a requirement coverage check).
- My correction (quoted): "if that's too much right now, we don't have to have those linked. Just have the data shown next to an individual as 'trained'" (trained status is a flag, no approval flow). Also chose Chicago as the first city and the Oct 2026 Northwestern event as a replay night.
- Note: `.kiro/steering/research.md` conflicted with E2 on wind direction and cited E1 to E14 only. Flagged as an open question in the requirements.
- Update: Applied the recommended answers (R15 floor at `elevated`, missing-migration cap, surge rule to spec 4). My request: "make sure this engine is designed in an easily editable way". Added R30 to R35 (config as data, factor registry, validator, config override, trace) and wrote design.md with module layout, factor registry, config shape and validator rules.
- Update: I explained the conflict (favorable wind drives migration volume, unfavorable wind raises collisions on heavy nights). User said "yes", so I rewrote steering rule 3 into two parts and changed the range to E1 to E17. Design task added to confirm wind-direction convention in Chen et al. 2024.

---

## 1. Surfaces (IDE, CLI, Web, Crew)
| Task | Surface | Time taken | What worked | What didn't |
|---|---|---|---|---|

**Me:** How they felt different, and when I'd pick each one.

## 2. Custom agents
| Agent | Allowed tools | Can edit | Surface used | What it produced | Impact on the build |
|---|---|---|---|---|---|
| research-scout | consensus, fetch | docs/research.md | | | |
| field-tester | playwright | docs/field-test.md | | | |

**Me:** Did limiting tools keep agents focused? Example.

## 3. Agent hooks
| Hook | Trigger | Action | Times fired | Times it caught something | Example catch |
|---|---|---|---|---|---|
| Log check | Spec task finished | Adds missing log entry | | | |
| Test on save | src/lib saved | npm test, propose fix | | | |
| Evidence check | risk.js saved | Weights without E-ids | | | |
| Data guard | src/data changed | Validate routes, sample labels | | | |
| Commit | Spec task finished | Test, small commits, log hashes | | | |
| Mobile check | Manual | Playwright 390px screenshots | | | |

**Me:** Which hook saved the most time or caught the most important problem?

## 4. Spec-driven development
- Spec structure: requirements (EARS, with evidence IDs) → design (weights table with sources) → tasks (ordered, IDs per task)
- Requirements I changed (before → after, why):
- Design changes I pushed for:
- Task order changes:
- Moments the spec prevented rework:

**Vibe-coding comparison (deliberate experiment):**
- Feature tried without a spec:
- Result vs spec-driven version (time, bugs, rework):

**Me:** Overall comparison in 2–3 sentences.

## 5. Steering
| File | Inclusion | Purpose |
|---|---|---|
| product.md | always | |
| tech.md | always | |
| structure.md | always | |
| research.md | fileMatch (risk, specs, tests) | |
| git.md | always | |
| kiro-journal.md | always | |

**Before/after examples** (same prompt with and without a steering file):
- Prompt:
- Without steering:
- With steering:

**Me:** The strategy that made the biggest difference, and why.

## 6. MCP
| Server | Used for | What it enabled | Would it have been hard without it? |
|---|---|---|---|
| consensus | Finding peer-reviewed studies → evidence table | | |
| playwright | Mobile testing, screenshots | | |
| fetch | Reading API docs (Overpass, weather.gov) | | |
| github | Branches, PRs | | |

## 7. Property-based testing
> Update 2026-11-26: the earlier timeline entries were dropped when this file was reformatted; they remain in git history (commit 3aa598a).
