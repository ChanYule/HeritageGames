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
| Carom | Press Ready, move the striker along the marked baseline, then drag back from it and release. Sliders and Shoot striker offer keyboard control. | A pocketed coin earns 100 points. Pocketing the striker is a 100 point foul. Each player has six shots. |
| Tin Can Knockdown | Press Ready, then drag from the ball toward the stack and release. Aim and strength sliders offer keyboard control. | Each newly fallen can earns 100 points. Each player has six throws. |

Carom and Tin Can Knockdown use the same turn handover in practice and competition. Sound can be muted in each game.

## Timing and accessibility

- Marbles and Pick-Up Sticks default to Easy. Practice turns allow 30 seconds; competition turns allow 45 seconds. Competition fixes the level and timer for both players.
- Marbles pauses its countdown while a shot is rolling. Pick-Up Sticks uses one countdown for the entire turn.
- Turn timers stay stopped during handovers. Pause and Resume retain the current player and progress.
- All games pause active play when the page is hidden. Chapteh and Five Stones also pause when the browser window loses focus. Resume is explicit.
- Gentle Chapteh pace gives extra time in the visible kick zone and stays consistent throughout competition. Lively pace is available for practice; sound is optional.
- Fullscreen includes the board and its controls, with a fallback for browsers without native fullscreen support. Exit fullscreen returns to the game page.
- Larger text, stronger contrast and language choices are saved when browser storage is available. Scores and timers avoid pulsing motion.

## Verification

`npm test` covers competition schedules, balanced starting duties, shared standings, invalid saved data, marble physics, stick overlap geometry, and Carom and Tin Can physics across repeated turns.

The senior UI pass was checked with TypeScript, the production build, 32 automated tests, translation coverage, and server rendering of every initial route in both languages. Server rendering checks markup; it does not verify browser interaction or layout.

A connected browser was unavailable during this pass. Before a live event, run both arcade games on the intended device and check touch input, fullscreen, English/Chinese, larger text, portrait/landscape layout, result confirmation and saved progress after reload.

## Technology

React, TypeScript, Vite, Canvas, Pointer Events, Framer Motion and Lucide React. The current senior presentation is in `src/senior.css`; game artwork is local SVG in `src/components/Home.tsx`.
