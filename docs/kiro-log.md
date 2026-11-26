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
