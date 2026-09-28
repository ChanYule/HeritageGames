# Singapore Heritage Games

Four digital childhood games for seniors to enjoy on a shared device. Includes English and Chinese, larger-text and contrast preferences, practice games, and competitions for 2–8 named players. No backend or account is required.

## Run locally

```sh
npm install
npm run dev
```

On Windows PowerShell, use `npm.cmd` if script execution is restricted. Open the URL printed by Vite.

```sh
npm run build
npm run preview
npm test
```

## Play together

Choose **Play a competition** on Home, enter distinct player names, and choose Quick Cup or Full league. A saved competition appears as **Continue competition**.

- With two players, either format plays all four games. First-player duties alternate.
- With 3–8 players, Quick Cup gives each player two matches. Full league pairs everyone once.
- Read the match instructions, then press Ready. Marbles and Pick-Up Sticks also wait for the next player to press **I am ready** after every handover.
- Each win earns 3 competition points; a draw earns 1 each. Equal points and wins share a place. Raw scores from different games are not used to break ties.
- Check both scores and confirm the result to update standings. The schedule shows completed and upcoming matches.
- Completed results, finished Five Stones attempts and results awaiting confirmation are saved on this browser and device. An unfinished game restarts if the page reloads or the player returns to the match lobby. Storage failures are shown on screen.
- Starting a new competition asks before clearing the previous results.

## Games and controls

| Game | How to play | Scoring |
| --- | --- | --- |
| Marbles | Tap the ring to aim, adjust power, then press Shoot marble. Dragging the shooter backwards and releasing also works. On a focused board, use arrows to aim and set power, and Space to shoot. | Alternate shots. A marble must fully cross the ring to score 100. Capturing two or more in one shot adds 50 per marble. The higher score wins when all targets are out. |
| Pick-Up Sticks | Tap a stick, then press Lift selected stick, or drag it away. Tab to a stick and press Enter/Space for keyboard play. Show a free stick selects an available stick. | A clean lift earns its colour's points and keeps the turn. Lifting a blocked stick or running out of time passes the turn. Selecting a stick alone is safe. |
| Five Stones | Press Toss stone, tap the required numbered stones, then use the large Catch now button during the falling phase. Number keys 1–4 collect stones; Space tosses/catches when the board is focused. | Complete patterns 1+1+1+1, 2+2, 3+1, then 4. Each collected stone earns 120 points plus up to 100 per catch for timing. Practice allows 8 seconds per toss; Challenge allows 4.8 seconds. |
| Chapteh | Share the screen: left player uses A/Left Arrow; right player uses D/Right Arrow. Tap either side or its large kick button when Kick now appears. | Send the chapteh to the other side. Landing on a player's side gives the opponent a point. The scorer serves next; first to 7 wins. |

Five Stones is solo in practice. In competition, players take separate attempts with the same practice timing and a maximum of 12 tosses each. Nine successful catches complete all patterns. An attempt can be ended early between tosses with score confirmation.

## Timing and accessibility

- Marbles and Pick-Up Sticks default to Easy. Practice turns allow 30 seconds; competition turns allow 45 seconds. Competition fixes the level and timer for both players.
- Marbles pauses its countdown while a shot is rolling. Pick-Up Sticks uses one countdown for the entire turn.
- Turn timers stay stopped during handovers. Pause and Resume retain the current player and progress.
- All games pause active play when the page is hidden. Chapteh and Five Stones also pause when the browser window loses focus. Resume is explicit.
- Gentle Chapteh pace gives extra time in the visible kick zone and stays consistent throughout competition. Lively pace is available for practice; sound is optional.
- Fullscreen includes the board and its controls, with a fallback for browsers without native fullscreen support. Exit fullscreen returns to the game page.
- Larger text, stronger contrast and language choices are saved when browser storage is available. Scores and timers avoid pulsing motion.

## Verification

`npm test` covers competition schedules for 2–8 players, balanced starting duties, shared standings, invalid saved data, duplicate results, Five Stones handovers and toss limits, marble physics, stick overlap geometry and Chapteh returns.

The senior UI pass was checked with TypeScript, the production build, 32 automated tests, translation coverage, and server rendering of every initial route in both languages. Server rendering checks markup; it does not verify browser interaction or layout.

A connected browser was unavailable during this pass. Before a live event, run a complete competition on the intended device and check touch input, pause/resume, fullscreen, English/Chinese, larger text, portrait/landscape layout, result confirmation and saved progress after reload.

## Technology

React, TypeScript, Vite, Canvas, Pointer Events, Framer Motion and Lucide React. The current senior presentation is in `src/senior.css`; game artwork is local SVG in `src/components/Home.tsx`.
