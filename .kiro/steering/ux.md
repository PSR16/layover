---
inclusion: fileMatch
fileMatchPattern: ["src/views/**", "src/components/**", "src/styles/**", "index.html", ".kiro/specs/**/*.md"]
---
# UI and UX standards

Layover is used outdoors, at night or at dawn, one-handed, often in gloves. The screen must be quick to read and hard to get wrong. These standards apply to every view, component, style and piece of copy. They add to the rules in `product.md` and do not replace them.

## Principles
1. **One job per screen.** Each screen answers one question ("Is tonight risky?", "Which slot do I take?"). The most important answer is the largest thing on the screen.
2. **One primary action.** At most one amber primary button per screen. Everything else is quieter.
3. **Short flows.** Claiming a slot takes 3 taps or fewer from the volunteer view. No dead ends: every empty or failed state says what to do next.
4. **Sensible defaults.** Pick the likeliest choice for the person (tonight, the nearest slot). Ask only for what is needed.
5. **Reversible.** Anything the user can do, they can undo (release a claimed slot, edit a find). Confirm only actions that cannot be undone, and say what will happen.
6. **Show, don't decorate.** Every element earns its place by helping a decision. If removing it changes nothing, remove it.

## Look
- **Palette:** the navy and amber tokens only. No new hues, gradients, glow, glassmorphism, drop-shadow stacks or decorative blur.
- **Hierarchy comes from size, weight and spacing**, not from boxing everything in a bordered card. Use a container only when it groups things that belong together (a boarding pass, the departures board).
- **Type:** the system font for text. The monospace font is for board data only (times, codes, risk words), never for sentences. Body text at least 18 px, line length under 65 characters.
- **Spacing:** the 4 and 8 px scale from `tokens.css`. Align to one left edge. Do not center body text.
- **Icons and emoji:** none as decoration. An icon is allowed only where it replaces a label people already know (a clear symbol for close) and always has a text name for screen readers.
- **Status labels:** at most two visible by default (for example the night, and whether the weather is saved). Put the rest under a "Details" control. A row of five badges is a smell.
- **Color is never the only signal.** Risk and sample status always carry a word.

## Layout
- Design at 390 px wide first, one column, then widen to a readable column (about 48rem), not to a grid of cards.
- No horizontal scrolling at any width from 320 px.
- Primary actions sit within thumb reach, near the bottom of the screen on a phone. Keep 8 px or more between tap targets, each at least 44 by 44 px.
- Respect safe areas and the on-screen keyboard. A focused field is never hidden behind it.

## Copy
- Plain, specific and short. Sentence case. Verbs on buttons ("Claim slot", "Check in", "Log a find"), not "Submit" or "OK".
- Say what is true now, with real details (a route name, a time like 5:45, a place). No filler, no marketing voice, no exclamation marks.
- Never ship placeholder copy such as "coming soon", "will appear here" or lorem ipsum. If a feature is not built, the control is not on the screen.
- Words to avoid: seamless, empower, unlock, elevate, journey, delve, leverage, robust, "let's", "welcome to", "simply", "just".
- Avoid em-dash chains and tidy tricolons ("fast, simple and reliable"). Write the way a coordinator would speak to a volunteer.
- Errors say what happened and what to do: "Could not load weather. Showing the last saved weather." Not "Something went wrong."
- Product rules still hold: sample data is labelled, risk is only low, elevated or high, nothing predicts deaths, nothing tells an untrained person to touch a bird.

## Signs a screen looks machine-made (avoid all of these)
- A heading, then a sentence that restates the heading.
- Three equal cards in a row, or a grid of identical rounded boxes.
- Everything centered, with no clear left edge or hierarchy.
- Every item wearing a badge, border and shadow.
- Generic headings ("Overview", "Dashboard", "Get started") and generic microcopy.
- Symmetry for its own sake: equal sizes for things of unequal importance.

## States
- **Loading:** show the layout with a short text status in place; no spinner-only screens.
- **Empty:** say why it is empty and offer the next step ("No open slots near you. Check tomorrow's routes.").
- **Offline or failed:** keep what is already on screen, say what is out of date, and offer a retry.
- **Success:** confirm in place with the new state (the slot now shows "Claimed"), not a pop-up.

## Motion
- Keep motion to a minimum: short fades or slides under 200 ms, only to show where something went. Nothing essential depends on motion. Respect `prefers-reduced-motion`.

## Accessibility (also tested)
- Text 4.5:1 and control edges 3:1 against their surface (tested in `tests/styles-tokens.test`).
- Real labels for every field, headings in order, landmarks for the header, navigation and main area, a visible focus ring, and tab order that follows the reading order.
- Test with the keyboard and a screen reader on each new flow.

## Before a UI change is done
1. Screenshot at 390 px and at 1280 px, saved under `docs/screenshots/`.
2. Do the flow one-handed on a phone-sized screen.
3. Read all the copy aloud, and cut every sentence that does not help someone decide or act.
4. Check the list "Signs a screen looks machine-made" against the screenshot.
5. Log what you changed and why in `docs/kiro-log.md`.
