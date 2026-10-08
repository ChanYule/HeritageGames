# SKY 1942 integration and acceptance checks

SKY 1942 is implemented as a native React/TypeScript canvas game at `?game=sky-1942`. The supplied HTML is retained unchanged in `reference/sky-1942-original.html` for comparison; it is never embedded or executed by the application.

## Delivered changes

- The homepage separates Singapore Heritage Games from Retro Arcade. Category links use section anchors with header clearance. The arcade card uses the original fighter pixel map, a local ocean illustration, player/control labels and Play Now.
- `games` remains the four-game Heritage catalogue. `arcadeGames` is a separate expandable list. `HeritageGameKey` restricts Challenge APIs; `GameKey` includes arcade navigation. Competition scheduling, storage keys, scoring and restoration behavior are unchanged.
- Query navigation, browser history, page titles, legacy game aliases and the Retro Arcade return anchor remain supported. The arcade implementation loads in a separate build chunk.
- The 480 × 720 world uses a 120 Hz fixed simulation step, bounded elapsed time, normalised diagonal input, analog joystick displacement and relative drag targets. Canvas display resizing does not modify world coordinates.
- Straight, zigzag and diver aircraft use V, line, staggered and two-sided formations. Stage 1 introduces straight aircraft; stage 2 adds zigzag/diver patterns; stage 3 enables aimed enemy fire. Difficulty values are in `config.ts`.
- Swept collision tests prevent fast projectiles passing through aircraft. Weapon upgrades produce single, twin and spread shots. Player damage resets the weapon, provides 1.8 seconds of protection and preserves the original three starting lives.
- Bosses enter before firing, show an HTML health bar, alternate fan and aimed attacks, flash briefly on damage and trigger a 2.4-second stage transition when defeated. Projectile density and effects are bounded.
- LOOP starts with three charges, provides 1.1 seconds of invincibility, consumes an edge-triggered activation and does not award defensive score-farming points. Weapon, shield, life and roll pickups retain distinct original icons and translated status messages. Shield protection lasts five seconds.
- Menus include Start Game, How to Play, High Scores, Settings, pause/resume and game-over results. In-game restart, pause exit and the shell Back button confirm before discarding an active flight. Browser history navigation follows normal browser behavior.
- A large pointer-captured joystick and separate FIRE/LOOP buttons support simultaneous input. Pointer cancellation, blur, hidden tabs and unmount clear held inputs. Coarse-pointer devices default to auto-fire; other devices default to manual firing. Optional relative drag movement avoids snapping the plane to the initial finger position.
- Fullscreen uses the existing `GameShell`/`GamePlayArea` owner and its native/fallback modes. Scoped CSS supports portrait and short landscape layouts, safe areas and reduced motion without changing global zoom or touch settings.
- English and Chinese use the existing language store. Language changes do not recreate the engine. Menus have focus handling, keyboard navigation, labelled controls and status text outside Canvas.
- Original Web Audio tones/noise are synthesized locally in one context, with a master volume, mute and a bounded voice count. The audio context closes on unmount. Gameplay makes no API requests and runs offline once its assets are loaded.

## Scoring and saved data

Straight/zigzag/diver aircraft award 50/80/120 points. A fully destroyed formation awards 200, a boss awards 3,000 and a collected power-up awards 100. Boss defeat also grants a weapon pickup (100 points). Enemy and boss destruction can only award points once.

The original `sky1942_leaderboard_v1` and `sky1942_highscore_v1` keys are retained. Legacy `{ name, score }` entries receive stage 1 when read. Entries are checked for valid names, safe non-negative scores and valid stages, then sorted and limited to five. Names render through React text nodes. `sky1942_latest_v1` stores the latest final score and stage; `sky1942_settings_v1` stores arcade control/audio preferences. The existing Heritage language key remains the sole language preference. Best/latest are recorded at game over; a qualifying named score is saved only once per flight. Storage failures produce a warning and preserve playable session state.

## Files

Created:

- `reference/sky-1942-original.html`
- `src/games/Sky1942Game.tsx`
- `src/games/sky1942/{config,types,entities,collisions,engine,input,runtime,rendering,audio,scoring}.ts`
- `src/games/sky1942/SkyArtwork.tsx`
- `src/games/sky1942/sky1942.css`
- `tests/sky1942.test.mjs`
- `docs/sky1942-integration.md`

Modified:

- `src/App.tsx`, `src/types.ts`, `src/gameCatalog.ts`
- `src/components/Home.tsx`, `src/home.css`
- `src/competition.ts`, `src/components/Competition.tsx` (Heritage-only type annotations)
- `src/locales/zh.ts`

Pre-existing uncommitted Tin Can 3D code, dependency changes, README changes and tests were preserved.

## Automated verification

`npm test`: 128 tests passed, including 28 new arcade tests and all 100 existing tests. Coverage includes start/restart, pause/resume, diagonal and analog movement at 30/60/144 Hz, boundaries, relative drag targets, continuous fire/cooldowns, weapon patterns, swept collisions, unique scoring, formation escapes, enemy types/fire unlock, damage/invincibility/game over, roll charges, every pickup, boss entrance/attacks/defeat/transitions, storage validation/persistence, input/listener cleanup, animation teardown, mute, catalogue separation, deep-link parsing, legacy aliases, restored competition and English/Chinese rendered markup.

A four-minute simulated run with temporary shield protection and scripted movement/firing progressed through eight stages and over 200 kills while checking resource bounds. This verifies engine progression; it is not a device playtest or evidence that the final difficulty feels balanced.

`npm run build`: TypeScript and Vite production build passed. SKY 1942 is code-split. Vite still reports chunks over 500 kB for the main application and Tin Can 3D scene. No lint or browser-test script is configured.

`git diff --check`: passed.

## Live verification limitation

The browser inventory returned no available browsers and creating an in-app browser tab failed with “Browser is not available: iab”. Actual mouse/touch play, responsive visual layout, native/fallback fullscreen, audible output and browser back/forward have not been verified. The checks below remain required before device acceptance.

## Exact manual checks

Start with `npm run dev -- --host 127.0.0.1`, then open the local URL printed by Vite.

Viewport matrix: 320 × 568, 360 × 640, 390 × 844, 414 × 896, 768 × 1024, 820 × 1180, 1024 × 768 and 1440 × 900. Repeat phone/tablet sizes with width and height swapped. Use a real touchscreen for multi-pointer acceptance; mouse dragging cannot establish it.

1. On the homepage, confirm the four original cards/artwork and Challenge actions. Follow both category links, check sticky-header clearance, select SKY 1942 and confirm the URL is `?game=sky-1942`. Repeat by opening that URL directly.
2. Inspect the start screen, instructions, scores and settings in both languages. Tab through every menu, use Enter/Space to activate controls, and confirm visible focus. Verify browser zoom still works on menus and the rest of the website.
3. Start a flight at each viewport. Confirm that the complete aircraft, HUD, movement zone and both action buttons are visible with no overlaps or required control scrolling. Check the bottom safe area with browser navigation bars visible.
4. Hold each movement key, both diagonal directions, Space and L. Verify page scrolling is prevented during play, diagonal speed is equal, boundaries hold and a held L spends one charge. Hold FIRE with a keyboard while the button has focus. Type a name on game over and verify gameplay keys do not intercept it.
5. On touch, drag the joystick diagonally while another finger holds FIRE. Add a LOOP tap with the other controls still held. Release each pointer independently, drag outside its original target, trigger cancellation and confirm no stuck movement/fire. Verify the pressed states are visible.
6. Toggle Auto Fire, pause/resume, and inspect menus: firing must stop when paused and on menus. Change to drag movement; start a drag away from the aircraft and confirm no position jump or stretched coordinates. Release/cancel and verify the plane stops following.
7. Collect each pickup, observe its icon/message, upgraded shot patterns and shield expiry. Use LOOP to avoid an attack, then take damage after protection expires. Confirm one hit costs one life and resets the weapon.
8. Defeat a complete formation and a boss. Observe entry, health/damage feedback, dodge gaps, defeat bonus and the stage transition. Continue through stages 2 and 3 to check diver patterns and enemy shooting. Repeat the critical steps on a touch device.
9. Pause, choose Restart and Cancel, then choose Exit and Cancel. Use the shell Back button during play and cancel its confirmation. Confirm the score/state survive cancellation and resume. Switch language while paused and confirm no restart.
10. During a flight, enter native fullscreen, rotate, resize, exit and re-enter. Repeat in a browser that uses the existing fullscreen fallback. Confirm aspect ratio, aligned HUD/collisions, reachable controls, language/exit buttons and preserved score/lives. Check for unexpected damage caused by layout changes.
11. Hide the tab and switch applications while controls are held. Returning must show a paused flight, with cleared inputs and no silently advanced enemies. Resume explicitly.
12. Finish a flight. Check final score, stage, defeated enemies and new-record display. Save a qualifying name once, try submitting again, reopen High Scores and reload. Verify top five, best/latest and safe rendering of a name containing `<`/`>` characters. With browser storage blocked, confirm the warning and usable gameplay.
13. Test every sound with sound on, toggle mute while effects are playing, pause, and navigate away. Confirm mute is immediate, no audio starts before interaction and no game sound continues after leaving.
14. Use reduced motion: confirm no scrolling background, roll rotation or shake. Check that the player, protection and projectiles remain readable.
15. Repeat homepage → arcade → start → exit ten times; check the console for errors and Performance/Memory for accumulated loops, listeners or audio contexts. Play continuously for several stages.
16. Use Return to Retro Arcade, browser Back and Forward, and refresh a deep link. Launch each original Heritage Game, then start/resume a saved Heritage Challenge. Confirm SKY is absent from selection, schedules and standings.

Record viewport/device/browser results and any clipping, input or balance issues before declaring live acceptance complete.
