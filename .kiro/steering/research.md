---
inclusion: fileMatch
fileMatchPattern: ["src/lib/risk*", "src/lib/**/*.js", ".kiro/specs/**/*.md", "tests/**"]
---
# Evidence rules for the risk model
 
The full evidence table is in #[[file:docs/research.md]]. Follow these rules whenever you write or change risk logic, requirements or tests.
 
1. Every risk factor and weight must cite at least one evidence ID (E1–E21) in a code comment and in the design doc. If a factor has no evidence, say so and mark it "assumption".
2. Migration volume is the largest single factor (E1, E3, E5). Weather is a modifier that matters most when migration is heavy (E2).
3. Keep two wind effects separate, and never score the same wind twice. (a) Favorable wind (fall: from the north; spring: from the south) means more migration. It belongs in the migration input, not in the collision score (E13). (b) Unfavorable wind on a heavy-migration night raises collision risk. Fall: from the south or west. Spring: from the north or west (E2, E17). Flag a tailwind that turns into a headwind before dawn (E4). Wind directions are the direction the wind comes from (checked against the Chen et al. 2024 abstract).
4. Low cloud ceiling and fog increase how strongly lights attract birds (E10, E11). Apply them as multipliers on lit-venue risk, not as flat points.
5. Lit glass matters more than building height (E1, E7, E14). Rank buildings by glass and night lighting first, nearby vegetation second (E6), height last.
6. Stadiums and high-intensity light installations are major hazards (E6, E8).
7. Fall nights carry higher base risk than spring (E5). Risk can carry over from the previous 2–3 nights (E4).
8. A small share of nights causes most deaths (E5). Surge slots should concentrate on those nights rather than spreading evenly.
9. Never present a score as a prediction of deaths. Use "low / elevated / high" with plain-language reasons.
10. When studies disagree (see "Where studies disagree"), prefer the more conservative behavior and note it.
 