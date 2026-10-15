# Tin-Can and Marbles gameplay redesign

Implemented 15 October 2026.

## Tin-Can Knockdown

`TinSlingGame.tsx` and `tinSlingPhysics.ts` replace the active 3D Tin-Can route with an original side-view carnival scene. Carrom remains on its existing component and rule engine. Legacy 2D/3D physics files remain available and their regression tests still run.

The installed `cannon-es` library provides planar rigid bodies: X/Y translation and Z rotation. A real sphere follows gravity, damping, friction and contact impulses throughout its flight. Travel-bounded substeps prevent tunnelling. Tins transfer momentum, rotate and settle on their supports. Fall detection uses displacement, loss of height or tipping; touching alone cannot score. Off-stage bodies leave simulation so they cannot prevent settling forever. Shot completion requires sustained low linear and angular speed, without a forced elapsed-time success.

Pull back on the ball and release. Power is proportional to pull length, clamped to 1.15 world units; gestures below 0.12 are cancelled. The fork applies launch velocity opposite the pull. Pointer capture, single-pointer ownership, cancellation, resize/visibility cleanup and a synchronous shot lock prevent accidental launches. Angle/strength sliders and Space/Enter provide alternatives. The collision-aware dotted guide runs a cloned physics scene with the same gravity, sphere and launch velocity and stops at first contact; later/harder levels use a shorter guide. Impacts have bounded particles and synthesised sounds; mute and reduced-motion controls are respected.

Each attempt gets three balls. Fallen tins remain fallen between shots. Each tin is worth 100; clearing adds 200 plus 50 per unused ball. The results show each part. Run totals bank each player's current level attempt, replacing a retried level's previous score rather than accumulating repeat bonuses.

Both players receive fresh identical layouts and play their three-ball attempts in sequence. Standalone play proceeds through five levels; either player's clear unlocks the next level after both have played. Failed attempts can be retried. Challenge selects levels 1/3/5 for Easy/Medium/Difficult, locks the layout and provides three balls per participant. Individual Challenge attempts report automatically; paired rounds report after both players finish. The existing `onComplete({ scores })` contract is retained.

| Level | Design | Tested clear: angle / power |
| --- | --- | --- |
| First Throw | Six-tin pyramid | 10 degrees / 100%, then 10 / 70% |
| Wooden Defence | Pyramid behind two breakable crates | 10 / 100%, then 10 / 70% |
| Over the Wall | Unbreakable stone wall | 10 / 100%, then 30 / 55% |
| Falling Structures | Dynamic shelf resting on breakable wooden supports | 10 / 55% |
| Master Challenge | Two stacks, crate, stone barrier and angled ramp | 10 / 85%, 40 / 55%, 20 / 55% |

These sequences are regression fixtures using the real simulation; other solutions are possible. The guide shows the first contact, not the subsequent chain reaction. Obstacles are fixed designs; there is no moving barrier or procedural generation.

## Marbles Colour Challenge

Easy/Medium/Difficult have 8/12/16 targets, distributed equally across Red, Blue, Yellow and Green. R/B/Y/G markings distinguish colours, with a ring highlight on the current group. The shared target indicator stays above the board. The next available colour follows Red, Blue, Yellow, Green, repeating.

The adaptive collision solver records the first actual approaching shooter-to-target contact when applying its impulse. Overlapping pairs are processed by swept entry time, with deterministic ID tie-breaks. Target-to-target and wall collisions do not set first contact; later hits cannot replace it. Capture events contain IDs and colour groups. Each shot starts with a fresh event record.

A correct first hit is required. Only captured marbles matching that shot's target earn 100 each. Two or more matching captures add 50 each. Wrong first contact, no contact, no matching captures and wrong-colour captures give zero. All captured targets leave play regardless of eligibility. Zero-point shots retain the target unless that colour is exhausted. Successful shots advance to the next available group. `resolveMarbleTurn` banks a settled shot exactly once, picks the next target, alternates players and checks completion.

Existing names, seeded Challenge layouts, 30-second standalone / 45-second Challenge timers, handover, pause, six-shot individual attempts and score submission remain. Feedback explains first hit, target and points. The aiming guide uses cloned marble physics, ends at first contact and shortens with difficulty. The launch area retains room for a full backward pull.

## Verification and limits

`npm test`: 194 tests passed at the complete-suite checkpoint, including 34 new physics/rules tests and three added integration tests. Tests cover all five level solutions, finite repeated collisions, high-speed barrier contact, rebounds, crate destruction, tin rotation/chain reactions, missed shots, settling, ammunition, score/bonus idempotence, first-hit events, colour progression, combos, turn resolution, balanced seeded layouts and bilingual rendered controls. Existing Carrom, Sticks, Retro Arcade, SKY 1942, Galaxy Defenders, navigation and Challenge tests pass.

`npm run build`: TypeScript and Vite production build passed. Vite reports the existing main-chunk size warning. No dependency was added.

No browser surface is available in this session. Real-device touch/stylus input, audible sound, performance and visual fullscreen acceptance remain unverified. Responsive coordinate mapping, a 56 CSS-pixel launcher hit area, safe-area-aware shared fullscreen and dedicated landscape layouts are implemented. Manual acceptance should cover 320/360/390/414/768/820/1024 widths, portrait/landscape, pointer cancellation, language changes, mute, reduced motion and entering/exiting fullscreen mid-turn.

## Files

Created: `src/games/TinSlingGame.tsx`, `src/games/tinSlingPhysics.ts`, `tests/colour-sling.test.mjs`, this document.

Modified: `README.md`, `src/games/ArcadeTargetGame.tsx`, `src/games/MarblesGame.tsx`, `src/games/marblesPhysics.ts`, `src/games/mechanics.ts`, `src/games/arcade.css`, `src/physical-games.css`, `src/components/Competition.tsx`, `src/locales/zh.ts`, `tests/challenge-integration.test.mjs`.
