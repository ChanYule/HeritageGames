# Marbles interface refinement — 22 October 2026

This update changes the Marbles interface and setup controls. The existing physics, scoring, target progression, shooter positioning, aim prediction, timer rules, turn switching, completion callback and Challenge contracts were retained. Earlier gameplay changes already present in the working tree were preserved.

## Layout

- Desktop and tablet landscape: flexible square board plus a 280–320px sidebar, 16px column gap, 16px sidebar padding and 12px section gaps. Both columns align at the top.
- Portrait: compact scores, target and turn information above the canvas; essential controls below it. Secondary match options expand when needed.
- Ready: centred card up to 420px wide, one primary action, three setup difficulty buttons in one row. Scores and target stay visible; gameplay controls stay hidden. The selected difficulty locks at match start and unlocks for a new match.
- Short phone landscape: tighter section spacing and text-only secondary controls keep the board and 48px essential controls accessible. The shared measured viewport and safe-area handling remain in use.
- Instructions now live in an expandable section below the regular play area. New Match lives in Match options. English and Chinese are supported.

## Files for this refinement

- `src/games/MarblesGame.tsx`: information hierarchy, Ready card, hidden setup controls, difficulty selection lock and secondary menus.
- `src/games/marbles.css`: Marbles-specific responsive layout and visual states.
- `src/locales/zh.ts`: translations for new interface copy.
- `scripts/marbles-interface-browser-check.mjs`: Ready, active and paused layout checks and screenshots.
- `scripts/marbles-gameplay-browser-check.mjs`: result/handover bounds and match difficulty checks added to existing gameplay verification.
- `scripts/expanded-controls-browser-check.mjs`: uses actual rendered visibility when inspecting collapsed menus.

## Browser coverage

Headless Microsoft Edge with touch enabled. Normal, native fullscreen and immersive fallback views at:

1440×900; 1024×768; 1180×820; 1280×800; 1366×1024; 768×1024; 820×1180; 320×568; 360×640; 390×844; 414×896; 844×390; 667×375.

`layout-results.json` records bounds, clipping, overflow, square canvas sizing and Ready-control visibility. Screenshots cover Ready, active and paused states at tablet landscape, tablet portrait, phone portrait and phone landscape sizes. `expanded-controls-results.json` records shot adjustments, shooter placement and Chinese larger-text checks across all six registered games. `gameplay-results.json` records real touch input, cancellation, resize, pause, settled scoring, handover, six-shot Challenge completion and restart checks.

## Results

- 244 automated tests passed.
- 117 Ready/active/paused layout cases passed across 13 viewports and three display modes.
- 30 expanded-control cases passed across all six games, including Chinese larger text.
- 13 gameplay checks passed, including persistent result visibility, touch input, pause, handover, resizing, restart and Challenge completion.
- No uncaught browser errors.
- TypeScript and the Vite production build passed.

## Limits

Browser emulation does not replace a physical iPad, Android tablet or Safari rehearsal. The existing production bundle-size advisory remains.
