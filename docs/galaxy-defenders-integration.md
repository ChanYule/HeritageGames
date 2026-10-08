# Galaxy Defenders integration

Galaxy Defenders is a native React/TypeScript canvas game at `?game=galaxy-defenders`, alongside SKY 1942 in Retro Arcade. The original four Heritage Games and their Challenge selection, scoring, schedules and stored sessions remain separate.

## Gameplay and presentation

- Original cyan spaceship, red/green/purple two-frame alien families, spaceship life icons, red player lasers, gold cross-shaped enemy lasers, small stars and restrained pixel explosions. No external art, fonts, sound files, network API or new dependency is required.
- A 480 × 720 logical playfield with a 9-column, 5-row formation: two red rows, two green rows and one purple row. Simulation runs at 120 fixed steps/second and rendering uses requestAnimationFrame.
- Aliens move as a group. Living aliens define the bounds; hitting an edge reverses direction and starts a smooth 18-pixel descent. Remaining alien count and wave increase movement speed, with mode-specific caps.
- Only the lowest surviving alien in a column can fire. Wave 1 has sparse vertical fire; wave 3 introduces two-shot bursts with a mildly aimed shot; wave 6 supports three-shot bursts. Projectile speed, active counts and firing intervals are capped.
- Keyboard movement uses Left/Right or A/D. Hold Space to shoot; P pauses. Bright lasers have a .22-second cooldown and swept collision against moving targets. Shots hit the closest alien first and are removed on impact/offscreen.
- Three starting lives, a forgiving Beginner hitbox and 1.8 seconds of protection after damage. The outlined ship indicates protection. Losing all lives or allowing an alien to cross the dashed defence line ends play exactly once; scoring stops immediately.
- Red/green/purple aliens award 30/20/10 points. A cleared wave awards 100 once, followed by a two-second transition. Score and remaining lives carry into the next formation. Difficulty values are centralised in `config.ts`.
- Beginner defaults to auto-fire, slower aliens/projectiles and fewer enemy shots. Classic defaults to manual fire with faster attacks and a larger player hitbox. Mode changes are offered before starting, and mode is displayed in the HUD/results.

The prompt described a screenshot, but the supplied attachment folder contained only `Pasted text.txt`; no screenshot was available for inspection. The artwork follows the detailed written visual description. Visual matching to the missing image remains unverified.

## Interface, controls and integration

The homepage uses matching arcade cards, Play Now actions, a dedicated local Galaxy pixel preview and the existing category anchor links. `GameKey` now includes `galaxy-defenders`; Heritage-only keys continue to restrict Challenge APIs. The existing query navigation, history handling and return-to-Retro anchor are retained. Both arcade games load as separate chunks.

Start, How to Play, difficulty selection, settings, pause and game-over screens are React UI. English/Chinese use the existing language store; switching language does not reinitialize the game. Restart and in-game exit, including the shell Back button, ask before discarding an active run. Browser Back/Forward follows normal browser navigation.

Touch controls have separate LEFT, RIGHT and larger FIRE buttons with pointer capture, cancellation/lost-capture handling and pressed states. Every pointer has its own action, so releasing one finger does not release another. Relative horizontal drag is optional and maps current display width into logical coordinates without snapping on initial contact. Auto Fire is visible in the toolbar and uses the normal cooldown only during active play.

The existing `GameShell`/`GamePlayArea` owns native and fallback fullscreen. Scoped responsive CSS preserves aspect ratio, uses safe-area spacing, places controls beside the canvas in short landscape, and hides unnecessary touch controls on large fine-pointer desktops. Menus have labelled buttons/fields, focus management and a Tab loop. Gameplay controls remain large; zoom is not disabled globally. Reduced motion stops stars, alien frame cycling, ship lean and muzzle flashes. The game pauses and clears input when the tab becomes hidden or the browser loses focus.

Original Web Audio tones from the existing arcade synthesizer provide shooting, destruction, damage, wave, game-over and record effects with bounded voices and one context per mount. Audio is unlocked through interaction and closes on unmount. A shared `heritage-games-arcade-muted` preference inherits the existing SKY 1942 mute value on first use and keeps mute consistent between the two arcade games. SKY mechanics and score keys are unchanged.

## Scores and persistence

Each mode has its own validated top five, personal best and latest score/wave:

| Mode | Keys |
| --- | --- |
| Beginner | `galaxy_defenders_beginner_scores_v1`, `galaxy_defenders_beginner_best_v1`, `galaxy_defenders_beginner_latest_v1` |
| Classic | `galaxy_defenders_classic_scores_v1`, `galaxy_defenders_classic_best_v1`, `galaxy_defenders_classic_latest_v1` |

`galaxy_defenders_settings_v1` stores mode, controls and arcade settings. Language uses the existing Heritage language preference. Data validation rejects invalid scores/waves and mismatched modes, trims names, sorts records and keeps five. Names render as React text. Best/latest record at game over; named submissions are limited to one successful submission per run. Storage failures keep gameplay usable and display a warning. These are browser-local rankings.

## Created and modified files

Created:

- `src/games/GalaxyDefendersGame.tsx`
- `src/games/galaxyDefenders/{config,types,entities,collision,engine,input,runtime,rendering,audio,scoring}.ts`
- `src/games/galaxyDefenders/GalaxyArtwork.tsx`
- `src/games/galaxyDefenders/galaxyDefenders.css`
- `src/games/arcadePreferences.ts`
- `tests/galaxy-defenders.test.mjs`
- `docs/galaxy-defenders-integration.md`

Modified for this addition:

- `src/App.tsx`, `src/types.ts`, `src/gameCatalog.ts`
- `src/components/Home.tsx`, `src/home.css`
- `src/games/Sky1942Game.tsx` (shared mute preference only)
- `src/locales/zh.ts`
- `tests/sky1942.test.mjs` (catalogue expectation now verifies both arcade games)

Previously uncommitted SKY integration, Tin Can 3D, README, dependency and other test edits were preserved.

## Verification

`npm test`: 157 passing tests, including 29 Galaxy tests and all 128 existing tests. Galaxy coverage includes initialization/start/restart, pause/resume, movement at 30/60/144 Hz, boundaries, manual/auto firing, swept hits, unique scores, projectile/effect limits, group motion, reversal/descent, living bounds, lowest-column shooting, capped progression, both modes, damage/protection/life loss, invasion loss, wave completion, next formations, multi-pointer combinations and cancellation, relative drag, typing guards, keyboard repeats, blur/listener cleanup, transition input cleanup, animation teardown, mode-specific scores, storage failure, duplicate submissions, shared mute, catalogue/deep links, Challenge restoration/exclusion, original pixel assets and translated React markup.

Scripted aiming/firing cleared three complete formations into wave 4 in both Beginner and Classic, using temporary invincibility to isolate movement, shooting, wave progression and resource bounds. This is engine verification, not a real-device difficulty or touch acceptance test.

`npm run build`: TypeScript and Vite production build passed. Both arcade implementations are code-split. The existing main/3D chunks still trigger Vite's >500 kB warning. No lint or browser test script is configured.

`git diff --check`: passed.

Browser discovery returned `{"apps":[],"browsers":[]}`. No live browser emulation or real-device checks were performed. Responsive visual layout, simultaneous real touch, audible output, native/fallback fullscreen, browser-history interactions, frame rate and difficulty feel require live acceptance.

## Manual acceptance checklist

Run `npm run dev -- --host 127.0.0.1` and open the printed URL. Check 320×568, 360×640, 390×844, 414×896, 768×1024, 820×1180, 1024×768 and 1440×900; swap dimensions for phone/tablet landscape.

1. Confirm all four Heritage cards, both arcade cards, category links and Play Now actions. Open Galaxy directly with `?game=galaxy-defenders`; exercise browser Back/Forward and the Retro Arcade return anchor.
2. Inspect each size in English and Chinese. Confirm no horizontal scrolling, clipped/distorted canvas, overlapping HUD/aliens, hidden controls or controls behind browser bars. Start a run and confirm essential controls fit without gameplay scrolling.
3. Select Beginner, inspect its auto-fire default and start. Move with arrows/A/D and hold Space; verify controls are immediate, boundaries hold and shots move upwards. Select Classic for a fresh run; verify manual-fire default and stronger attacks.
4. On a real touchscreen, hold LEFT or RIGHT and FIRE with separate fingers, change directions, release each independently, drag outside buttons and trigger pointer cancellation. Confirm pressed feedback and no stuck input. Repeat with two pointers holding the same action.
5. Enable drag controls. Start away from the ship, drag horizontally, resize/rotate, then release/cancel. Confirm no initial snap, correct movement scale and no menu interference. Toggle Auto Fire and verify that firing stops in pause, transitions and game over.
6. Observe formation edge reversal and smooth descent, faster final aliens, lowest-in-column shooting and readable dodge opportunities. Destroy red/green/purple aliens, verify 30/20/10 points, clear a wave, verify one +100 bonus and preserved score/lives on the next wave.
7. Take a hit: one life is lost, the outline appears and repeat hits are ignored briefly. Test three lost lives and an invasion loss; verify the correct explanation, stopped gameplay and no post-game scoring.
8. Pause/resume, cancel Restart and Exit confirmations, and cancel the shell Back confirmation. Switch language during a paused run; confirm unchanged score, wave, lives and difficulty.
9. Enter/exit native fullscreen, repeat in the shared fallback mode, rotate/resize and confirm aspect ratio, aligned coordinates, reachable controls and preserved progress. Check short landscape with safe areas and browser controls visible.
10. Hide the tab or switch apps while moving/firing. Return to a paused run, verify cleared input and resume explicitly. Repeat opening/playing/exiting ten times while monitoring console and memory for duplicate listeners/loops/audio.
11. Finish and save a qualifying named score once. Verify mode-specific top five, best/latest, mode and wave after reload. Confirm names containing `<`/`>` render as text and blocked storage shows a warning. No result should appear in SKY or Heritage Challenge standings.
12. Verify all sounds after interaction, immediate mute, inherited mute when switching arcade games and silence after leaving. Test reduced motion and visible keyboard focus; type names without gameplay key interception.
13. Launch SKY 1942 and every original game, then restore a saved Heritage Challenge. Verify fullscreen, language and scoring regression behavior. Play several waves in both modes on ordinary devices and record difficulty/performance observations before declaring device acceptance complete.
