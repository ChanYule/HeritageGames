# Pick-Up Sticks and responsive gameplay upgrade

Implemented on 21 October 2026 in the existing React/TypeScript/Vite application.

## Gameplay

Pick-Up Sticks now simulates extraction in a fixed 900 × 560 world. A selected stick stays in the pile and follows the drag, retaining the initial finger offset. A separate selection label keeps its colour and value readable. Mouse, touch and pen use Pointer Events and capture; keyboard arrows and four direction buttons run the same contact simulation. Enter/Space selects instead of collecting automatically. Cancellation restores the attempt baseline without a penalty. Resizing during a captured gesture does not introduce phantom movement.

Capsule geometry follows the rendered rotation, length, width and stack order. Two-unit swept steps detect contacts even during a fast drag. Sliding an underneath stick transfers translation and torque to sticks above it; a top stick can lift clear of lower layers. Each attempt records the other sticks' original positions and angles. Exceeding either tolerance fails once, highlights the disturbed stick and awards no points. This is a deterministic 2.5D approximation, not a full rigid-body or 3D simulation. Successful extraction requires at least 105 units of displacement and clearance from upper sticks.

| Difficulty | Sticks | Pile spread | Translation tolerance | Rotation tolerance | Hints per turn |
| --- | ---: | ---: | ---: | ---: | ---: |
| Easy | 10 | 370 | 7 | 3 degrees | Unlimited |
| Medium | 18 | 260 | 4 | 1.8 degrees | 2 |
| Difficult | 28 | 170 | 2.2 | 1 degree | 1 |

Touch selection has at least a 24 CSS-pixel radius at every board size. Logical tolerances do not change with screen size. Piles use seeded geometry in Challenge, contain exposed endpoints and crossing angles, and always have a removable highest stick. Valuable sticks generally start lower in the stack. Tests repeatedly remove every layer across 100 seeds per difficulty.

Existing colour values remain Red/Blue 10, Yellow/Green 20 and Purple 50. The third consecutive clean pickup adds 20; the fifth adds 50. Each threshold awards once per streak. A failed extraction or shared-turn timeout resets the streak. Optional colour missions are off by default, configured before play in the instruction panel, and award 30 separately for an available colour. Missions are unavailable in competition to keep its rules equal.

Player names, shared turns, 30-second practice timers, 45-second Challenge timers, fixed difficulty, identical seeded individual attempts, Challenge Points and the `onComplete({ scores })` contract remain intact. Completion is guarded against duplicate reporting. Concise result messages, sound/mute, selected/disturbed outlines and reduced-motion support provide feedback. The colour-value guide remains accessible through “Stick values”.

## Shared layout

`GamePlayArea` now puts the board in a measured slot and keeps scores and essential controls in a separate panel. ResizeObserver measures the actual remaining space after controls and the fullscreen toolbar. The board is fitted without stretching or changing simulation coordinates. VisualViewport resize events handle browser viewport changes; observers/listeners are cleaned up on unmount.

Portrait layouts stack the board and controls. Landscape layouts put controls beside the board. Short landscape layouts let the control panel use the full height while the exit/language toolbar occupies space above the board. Native fullscreen and the immersive browser-window fallback share this layout. Fallback removes ancestor animation containment, locks page scrolling and keeps existing focus/inert handling. Its exit control identifies it as an immersive view. Entering/exiting either mode retains the same game component and state. The fullscreen entry button waits until lazy-loaded games have mounted their play area.

Normal view aligns the game surface when a gameplay button is used, and Challenge aligns it on mount; navigation, setup and expanded instructions remain elsewhere on the page. Optional shot-adjustment panels can scroll internally. On short screens, secondary Marbles positioning text is reduced while the target name, positioning buttons and gameplay actions stay available.

| Game | Responsive changes |
| --- | --- |
| Marbles | Preserves the 900:700 board, full ring and shooter pull-back space; keeps target, scores, turn, pause, positioning, shot controls and restart accessible. |
| Pick-Up Sticks | Preserves the 900:560 extraction world, pile and drag space; keeps turn, score, streak, directional lift, hint, cancellation, sound and restart together. |
| Carrom | Preserves the square board, all pockets and striker controls; adds pause/resume that freezes an active physics shot. |
| Tin-Can Knockdown | Preserves the 1200:620 camera/world proportions, launcher and targets; groups ready/shoot/adjust/sound/restart/pause controls; pause freezes the active simulation. |
| SKY 1942 | Preserves the 2:3 flight area; places joystick, FIRE and LOOP beside it in landscape; keeps HUD, pause, sound and settings available. |
| Galaxy Defenders | Preserves the 2:3 alien playfield; keeps LEFT, RIGHT and FIRE visible on touch and desktop; fits HUD, pause and settings beside the board. |

The catalog registers these six games. Legacy Five Stones, Chapteh and older Tin-Can implementations remain in the repository but are not registered play routes.

## Verification

The browser evidence is from headless Microsoft Edge on Windows, with touch-capable contexts. These are viewport emulations, not physical-device certification.

Main layout matrix: six games × thirteen viewports × normal/native fullscreen/forced immersive fallback = **234 cases**. Checks cover measured board/button positions, viewport overflow, ancestor clipping, board/control overlap, aspect ratios, native-versus-fallback state and browser errors.

Viewports: 1440×900, 768×1024, 1024×768, 820×1180, 1180×820, 1366×1024, 1280×800, 320×568, 360×640, 390×844, 414×896, 844×390 and 667×375.

- [Layout measurements](viewport-evidence/results.json)
- [Gameplay browser checks](viewport-evidence/gameplay-results.json)
- [Expanded controls and Chinese/larger text checks](viewport-evidence/expanded-controls-results.json)
- [Pick-Up Sticks tablet screenshot](viewport-evidence/pick-up-sticks-1024x768.png)
- [Pick-Up Sticks short landscape screenshot](viewport-evidence/pick-up-sticks-667x375.png)
- [Marbles tablet screenshot](viewport-evidence/marbles-1024x768.png)
- [Carrom tablet screenshot](viewport-evidence/carom-1024x768.png)
- [Tin-Can tablet screenshot](viewport-evidence/tin-can-knockdown-1024x768.png)
- [SKY 1942 short landscape screenshot](viewport-evidence/sky-1942-667x375.png)
- [Galaxy Defenders tablet screenshot](viewport-evidence/galaxy-defenders-1024x768.png)

Browser gameplay checks cover captured pointer cancellation, complete-travel scoring, duplicate prevention, exact streak bonuses, scores/positions across resize and fullscreen exit, one completion callback, a failed shared turn after a clean pickup, hint limits, resize during a captured drag, real touch extraction/cancellation, restart, optional mission scoring and active-shot pause/resume for Carrom and Tin-Can.

Automated suite: **213 tests passed**, including 14 new deterministic physics/rules tests. All 234 main viewport checks, 30 expanded-control/Chinese/larger-text checks and 14 browser gameplay checks passed without browser exceptions. TypeScript and the Vite production build passed. The existing bundle-size warning remains; the main bundle is approximately 582 kB before gzip.

To reproduce browser checks, start Vite with `npm run dev -- --host 127.0.0.1`, install Playwright externally or locally, and run the three `scripts/*browser-check.mjs` files. An external installation can be supplied through `PLAYWRIGHT_MODULE` pointing to its `index.mjs`. The scripts use the installed Microsoft Edge channel. Unit tests run with `npm test`.

## Files

Created:

- `src/games/stickPhysics.ts`
- `src/gameViewport.css`
- `tests/stick-physics.test.mjs`
- `tests/browser/sticks-harness.html`
- `scripts/responsive-browser-check.mjs`
- `scripts/sticks-browser-check.mjs`
- `scripts/expanded-controls-browser-check.mjs`
- This report and the JSON/screenshot evidence in `docs/viewport-evidence/`.

Modified:

- `src/games/PickUpSticksGame.tsx`
- `src/components/GamePlayArea.tsx`
- `src/components/GameShell.tsx`
- `src/games/MarblesGame.tsx`
- `src/games/ArcadeTargetGame.tsx`
- `src/games/TinSlingGame.tsx`
- `src/components/Competition.tsx` (updated Pick-Up Sticks guidance)
- `src/locales/zh.ts`
- `src/main.tsx`
- `README.md`

## Remaining checks

Rehearse on the actual iPads/Android tablets and venue browsers. Safari native-fullscreen availability, real safe-area insets, stylus hardware, physical touch feel, audible sound, GPU performance, browser chrome and long live sessions were not verified by desktop Edge emulation. The new disturbance tolerances need human playtesting for difficulty and senior comfort. Full Challenge event flows, deployment and recovery were not newly certified by this change. No deployment or publication was performed.
