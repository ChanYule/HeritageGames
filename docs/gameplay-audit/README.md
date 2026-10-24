# Gameplay and scoring audit ? 24 October 2026

Audited all six registered games: Marbles, Pick-Up Sticks, Carrom, Tin-Can Knockdown, SKY 1942 and Galaxy Defenders. Existing Carrom live-score changes in the working tree were preserved and rechecked.

## Fixes

- Tin-Can Knockdown now credits the main total after every settled shot, including partial captures before the three-ball attempt finishes.
- Retry credits track the best score separately for each player and level. Weaker retries cannot subtract earned points; equal scores cannot farm duplicate points; better retries add only the improvement. Clear and unused-ball bonuses are credited once. The rule is explained in English and Chinese.
- Shared score counters now render immediately by default, preventing numeric fade animations from hiding current totals. Carrom retains separate live coin counts and final board points.
- The layout checker now tests actual visibility so buttons inside collapsed menus are not mistaken for visible overflowing controls.

Physics, existing point values, colour rules, turn timers, and final Challenge result contracts were retained.

## Results

- **251 automated tests passed**, including new retry-credit, partial-score, player/level separation and invalid-total regressions.
- **58 browser gameplay checks passed** across all six games.
- **234 layout checks passed**: six games ? 13 viewport sizes ? normal, native fullscreen and immersive fallback views.
- **30 expanded-control checks passed**, including Chinese with larger text, shot adjustments and shooter placement.
- **No uncaught browser errors** in these checks.
- TypeScript and the Vite production build passed. The existing large-bundle advisory remains.

| Game | Browser verification |
| --- | --- |
| Marbles | Real touch shots/cancellation, first-colour scoring, settled captures, pause, handover, persistent results, restart, resize/fullscreen, six-shot Challenge and one completion callback |
| Pick-Up Sticks | Real touch and keyboard extraction, zero points for disturbance, no duplicate pickups, streak and mission bonuses, handover, full-pile completion once, cancellation, restart, resize/fullscreen |
| Carrom | Actual opening-rack shots, live totals 0?0 ? 1?0 ? 2?0 ? 2?1, miss/handover, pause, resize/fullscreen and reset; queen/dues/final-board scoring also covered by rule tests |
| Tin-Can Knockdown | Real touch/cancellation, partial-shot live totals, pause, weaker/better retry accounting, handover, level progression, restart, and completed Easy/Medium/Difficult Challenge attempts against an independent physics replica |
| SKY 1942 | Real hit scoring, pause, natural game over, frozen final score, one leaderboard save, persistence after reload and new-game reset |
| Galaxy Defenders | Real hit scoring, pause, natural game over, frozen final score, one leaderboard save, persistence after reload and new-game reset |

Challenge tests also cover two-, three- and four-player ranking, tied placements, result validation and recovery of saved progress.

Viewport sizes: 1440?900, 768?1024, 1024?768, 820?1180, 1180?820, 1366?1024, 1280?800, 320?568, 360?640, 390?844, 414?896, 844?390 and 667?375.

## Frame timing

Production build served locally, headless Microsoft Edge, 1280?800, one game at a time with six-second foreground samples after warm-up. These are animation-frame timing samples, not physical-device/GPU certification.

| Game | Average frame rate | 95th-percentile frame interval | Maximum interval | Main-thread tasks over 50 ms |
| --- | ---: | ---: | ---: | ---: |
| marbles | 59.5 | 16.8 ms | 50.2 ms | 0 |
| pick-up-sticks | 60.0 | 16.8 ms | 17.8 ms | 0 |
| carom | 59.8 | 16.9 ms | 33.3 ms | 0 |
| tin-can-knockdown | 60.0 | 17.0 ms | 19.6 ms | 0 |
| sky-1942 | 60.0 | 16.9 ms | 18.4 ms | 0 |
| galaxy-defenders | 60.0 | 16.9 ms | 18.1 ms | 0 |

The samples averaged approximately 60 FPS. Marbles had one approximately 50 ms frame interval; its 95th percentile remained approximately 17 ms. No main-thread long tasks were recorded in the six samples. Short samples do not prove sustained event-length performance.

## Evidence and reproduction

- `validation-summary.json`: combined counts and failures.
- `unit-tests.txt`: automated test output.
- `marbles-results.json`, `sticks-results.json`, `carrom-results.json`, `tin-results.json`, `tin-touch-results.json`, `arcade-results.json`: gameplay records.
- `layout/results.json`, `layout/expanded-controls-results.json`: layout/control bounds and errors, with representative screenshots in the same directory.
- `frame-timing.json`: production frame samples.

Run `npm.cmd test` and `npm.cmd run build`. Browser scripts use an installed Playwright module via `PLAYWRIGHT_MODULE`, a Vite development server at `127.0.0.1:5173`, and the production frame check uses Vite preview at `127.0.0.1:4173`.

## Remaining acceptance

A physical iPad/Android/Safari rehearsal remains necessary for touch feel, device graphics, browser chrome, thermal throttling and long sessions. No deployment or physical-device verification was performed. Current checks support local desktop-browser readiness, not a guarantee for every device or every possible sequence of actions.
