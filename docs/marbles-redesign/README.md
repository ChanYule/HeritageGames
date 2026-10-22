# Marbles gameplay and interface redesign

Implemented in the existing HeritageGames application on 21 October 2026.

## What changed

Marbles now uses a larger circular ring, four balanced formation patterns, a visible horizontal launch rail, a separate pull-back apron, first-contact guidance, the requested combo scores, and a compact interface. The existing React game state, Ready/handover flow, timers, player names/colours and Challenge result contract remain. Other game implementations were not changed.

## Board arrangements and appearance

The logical board is **900 × 900**, with the ring centred at **(450, 330)** and radius **270**. The ring grew from radius 200. Its top clearance now lets a target cross the capture boundary before reaching a canvas wall in every direction.

Four formations are selected with seeded randomness: **scattered**, **small clusters**, **central formation** and **mixed**. Four exposed front anchors provide an opening to Red, Blue, Yellow and Green. The remaining marbles follow the formation, with separation checks and a deterministic lattice fallback. Small seeded variations keep rounds from repeating identically in ordinary play. Colours remain balanced: 2/3/4 of each colour in Easy/Medium/Difficult.

The board is generated at round start, restart or difficulty change, and stays physically consistent between shots. Challenge players receive identical layouts for the same seed. Glass shading, subtle reflections/contact shadows, a quieter surface texture and R/B/Y/G labels improve readability without animated glow. The shooter retains the first player's swirl and second player's cross so colour is not the only identity cue.

| Difficulty | Targets | Target radius | Touch grip radius | Assistance |
| --- | ---: | ---: | ---: | --- |
| Easy | 8 | 22 | At least 28 CSS pixels | Full reachable path, first-contact halo, correct/wrong colour, initial struck-marble direction |
| Medium | 12 | 20 | At least 24 CSS pixels | Shorter path and first-contact halo |
| Difficult | 16 | 18 | At least 20 CSS pixels | Short direction line and power; no collision halo/colour answer |

All three difficulties use the same physics and scoring functions.

## Shooter, aiming and physics

The launch rail runs from **x=160 to x=740 at y=720**. Move shooter enables a visible positioning handle; tapping/sliding the rail or using Left/Right changes the origin without shooting. Done positioning returns to aiming. The underlying free-placement helper remains available for compatibility, while the gameplay UI uses the rail.

Press the shooter, pull backwards and release to shoot in the opposite direction. Pull is capped at **140 world units** and velocity at **16.2 units per physics tick**. The launch apron keeps the entire pull within the board. Pointer capture supports mouse, touch and pen, including an off-centre grip. Cancellation, lost capture, blur, visibility loss and pause clear transient gestures without awarding points. Incremental pointer deltas prevent orientation changes from creating phantom aim movement. Keyboard arrows, Space, positioning buttons and direction/power sliders remain available; the direction slider supports one-degree adjustment.

Prediction uses the **earliest expanded-circle ray intersection**, including shooter and target radii, rather than nearest-centre distance. Its range follows the same adaptive friction integration as actual motion and stops at the first board boundary. Equal entry distances use target ID for deterministic ordering. Easy shows Correct Target or Wrong Colour and the initial impact-normal direction. Guidance predicts the unobstructed first contact only; it does not promise bank shots, chain reactions or captures.

Actual impulses remain authoritative for scoring. The solver preserves fixed ticks, travel-bounded substeps, friction, wall rebounds, four contact-resolution passes, deterministic swept contact order and settling detection. Impulse response now weights mass by radius squared. The first actual shooter/target contact is recorded once; target-to-target collisions do not replace it. A shot records the required colour plus first ID/colour and unique captured IDs/colours.

**Capture rule:** the whole target must cross the ring: centre distance minus its radius must be greater than the ring radius. Touching the boundary is not a capture. Captured targets leave play immediately, but points are banked only after all motion settles. The shooter never counts as a captured target.

## Scoring and game flow

| Matching-colour captures after a correct first hit | Points |
| --- | ---: |
| 1 | 100 |
| 2 | 250 |
| 3 | 450 |
| 4 | 650 |
| Each further matching capture | +200 |

A wrong first colour earns zero even if the required colour later leaves the ring. Other-colour captures never increase the combo. The former two-capture result of 300 is corrected to 250. Duplicate IDs and repeated settlement cannot award again.

The target follows **Red → Blue → Yellow → Green**, skips exhausted colours, advances after a scoring shot, and otherwise stays on the current available colour. Shot feedback explains the first hit, matching count and points in a small result strip outside the board. Handover waits for settlement; the next player presses Ready. Individual Challenge attempts also require Ready between shots so results are shown before continuing. A completed round displays completion rather than stale aiming advice.

Practice keeps its 30-second turns and Challenge its 45-second turns. Individual attempts retain their shot cap; shared play alternates players. Restart clears scores, shots, captures, target progression, gestures and the prediction cache. Completion uses the existing `onComplete({ scores })` callback and reports once. Existing Challenge storage/restoration, placement points and winner logic were not changed; their automated checks pass.

## Mobile, tablet and fullscreen interface

The target, active player, remaining marbles and time share one compact bar beneath the two scores. Pause, timer, restart and optional shot adjustment use a secondary toolbar. Left / Move shooter / Right / Shoot form one touch-sized action row. On short landscape screens, pause/timer use labelled icons to avoid broken text. Instructions remain in How to Play; the first Ready screen offers short guidance which experienced users can dismiss by pressing Ready.

Portrait places scores and target above the board, with controls below. Landscape retains the shared approximately 70/30 board-and-information split. The board gets the space remaining after real control measurements. `GamePlayArea` accepts an optional aspect ratio; Marbles supplies 1:1, and the other games retain their existing defaults. All Marbles CSS is scoped to its own game class.

Native fullscreen and the existing immersive fallback retain the same game instance. Display resize changes the rendering size, not physics positions, scores, target, turn or completion state. Existing focus, safe-area and immersive-exit behavior remains. English, Singapore Chinese, larger text, contrast preferences and reduced-motion behavior are preserved.

## Verification and evidence

**244 automated tests passed**, including **31 new Marbles tests**. Existing fixtures were updated for the enlarged ring and requested score table; no relevant tests were removed. New checks cover 480 seeded pattern/difficulty layouts, separation and containment, exposed routes for every colour, real simulated scoring opportunities for each pattern/difficulty combination, rail bounds, drag mapping/power, friction range, predicted versus actual contact, simultaneous contact order, momentum, capture geometry, and all requested Blue-target scoring regressions.

Headless Microsoft Edge on Windows, with touch-capable contexts:

- **234 viewport cases:** six games × thirteen sizes × normal/native fullscreen/forced immersive fallback. Checks measure board and controls, overflow, clipping, board/control overlap, aspect ratios, fullscreen state and uncaught exceptions. Fonts and resize rendering are allowed to settle before measurement.
- **30 expanded-state cases:** shot-adjustment panels, shooter positioning, Chinese and larger text, across all six games.
- **12 Marbles gameplay checks:** button and browser-generated touch positioning, cancellation, resize during capture, real touch firing, wrong-colour zero score, successful captures/progression, rolling pause/resume, a complete six-shot Challenge attempt, shared handovers, restart and duplicate-result prevention.
- **5 navigation/preference checks:** homepage launch/back, Challenge mode selection, Chinese/reading preferences, and saved arcade mute state.
- TypeScript and the Vite production build passed. The existing warning for a main bundle above 500 kB remains (approximately 585 kB before gzip).

The recorded six-shot attempt scored **0, 100, 100, 100, 100, 100 = 500**, matched the independent deterministic simulation, skipped exhausted colours, and submitted exactly one result. A separate shared-pile miss handed play to Ahmad; his valid Red capture awarded 100 and returned play to Mary.

Viewports: **1440×900, 768×1024, 1024×768, 820×1180, 1180×820, 1366×1024, 1280×800, 320×568, 360×640, 390×844, 414×896, 844×390 and 667×375**.

Evidence:

- [Tablet screenshot](tablet-initial.png)
- [320×568 phone screenshot](mobile-initial.png)
- [667×375 landscape screenshot](regression/marbles-667x375.png)
- [Chinese tablet with reading preferences](chinese-tablet.png)
- [All viewport measurements](regression/results.json)
- [Expanded controls measurements](regression/expanded-controls-results.json)
- [Gameplay results and per-shot records](gameplay-results.json)
- [Navigation/preference results](navigation-results.json)
- [Automated test output](unit-test-output.txt)

Run `npm.cmd test` and `npm.cmd run build`. Browser checks need Vite at `http://127.0.0.1:5173` and Playwright with the Microsoft Edge channel. `PLAYWRIGHT_MODULE` can point to an external Playwright `index.mjs`; no runtime dependency was added. `EVIDENCE_DIRECTORY` selects the regression scripts' output folder.

## Files

Created:

- `src/games/marblesRendering.ts`
- `src/games/marbles.css`
- `tests/marbles-redesign.test.mjs`
- `tests/browser/marbles-harness.html`
- `scripts/marbles-gameplay-browser-check.mjs`
- `scripts/marbles-navigation-browser-check.mjs`
- This report and evidence files under `docs/marbles-redesign/`.

Modified:

- `src/games/MarblesGame.tsx` — gameplay input, compact UI, handover/results and canvas integration.
- `src/games/marblesPhysics.ts` — geometry, rail, prediction, weighted impacts and scoring.
- `src/games/mechanics.ts` — Marbles difficulty sizes and formation generation only.
- `src/components/GamePlayArea.tsx` — optional aspect-ratio override.
- `src/locales/zh.ts` — new instructions, controls and feedback.
- `tests/colour-sling.test.mjs`, `tests/mechanics.test.mjs` — Marbles score/geometry fixtures.
- `scripts/responsive-browser-check.mjs`, `scripts/expanded-controls-browser-check.mjs` — updated Marbles ratio, stable resize measurement and configurable evidence destination.
- `README.md` — updated gameplay description and report link.

## Remaining limitations

Desktop viewport emulation does not certify physical iPad/Android touch feel, stylus hardware, native Safari fullscreen, real safe-area/browser-chrome behavior, venue performance or extended sessions. Rehearse on the actual event devices and playtest difficulty/pacing with the intended players. Prediction intentionally stops at the first wall/contact and does not model spin or a full billiards bank-shot path. No deployment or publication was performed.
