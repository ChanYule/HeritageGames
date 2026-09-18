# Singapore Heritage Games

A browser-based collection of four playable heritage games:

- Marbles, local 2-player
- Pick-Up Sticks, local 2-player
- Five Stones, single-player
- Chapteh, local 2-player

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown by Vite.

## Production build

```bash
npm run build
npm run preview
```

## Multiplayer rules

### Marbles
Player 1 and Player 2 alternate after every shot on the same board. Drag backwards from the coloured shooter and release, or use the Aim and Power controls. A target scores after it fully leaves the ring. Multi-captures earn bonus points. The higher score wins when the ring is empty.

### Pick-Up Sticks
Both players share one pile. A clean pickup scores the stick value and lets the same player continue. Choosing a blocked stick counts as a mistake and passes the turn. The higher score wins after the final stick is removed.

### Chapteh
The match has three rounds. Player 1 takes one rally, then Player 2 takes one rally. Each successful kick adds to that player's match total. After both players complete all three rounds, the higher total wins.

## Five Stones
Five Stones stays single-player. Choose Practice or Challenge pacing. Toss the main stone, collect the required ground stones, then catch the airborne stone while it is falling. Complete the patterns 1+1+1+1, 2+2, 3+1, and 4.

## Controls

### Marbles
- Mouse or touch: press the coloured shooter, drag backwards, release.
- Alternative controls: set Aim and Power, then press Shoot.

### Pick-Up Sticks
- Mouse or touch: drag an exposed stick completely away from the pile.
- Keyboard: Tab to a stick, then press Enter or Space.
- Use Show a free stick for a hint.

### Five Stones
- Press Toss Stone.
- Tap the required ground stones.
- Tap the airborne stone after it starts falling.
- Keyboard: 1-4 to collect and Space to toss or catch.

### Chapteh
- Left foot: A or Left Arrow.
- Right foot: D or Right Arrow.
- Touch: tap the left or right side of the court.
- Kick only while the chapteh is falling inside the shaded kick zone.

## Technology

- React
- TypeScript
- Vite
- HTML5 Canvas
- Pointer Events

No backend is required for local multiplayer.

## Gameplay checks

```bash
npm test
```

Checks cover shot power limits, stick overlap geometry, Chapteh kick timing, and marble layouts.


## Turn timer

Marbles and Pick-Up Sticks use a 30-second local multiplayer turn timer by default. Players can switch the timer off from the game panel.

- Marbles: the countdown runs while the active player is aiming and pauses while the marbles are moving. If it reaches 0 before a shot, the turn passes to the other player.
- Pick-Up Sticks: the countdown covers the full turn. Successful pickups let the same player continue with the remaining time. If it reaches 0, the turn passes automatically.


## Pause / Resume

Marbles and Pick-Up Sticks include a Pause turn button when the 30-second turn timer is enabled. Pausing freezes the countdown and blocks gameplay input. Resuming continues with the same active player and the exact remaining time. Turning the timer off clears the paused state.

### Paused score indicator

When Marbles or Pick-Up Sticks is paused, the shared scoreboard clearly shows which player paused the game. The active player's card also shows a paused badge and a short reminder that Resume continues the same turn.

## UI and interaction polish

The current version also includes:

- Clear top navigation and improved homepage flow
- Collection highlights and local multiplayer labels
- Four-step Choose → Learn → Play → Pass guide
- Animated game-card entrances and hover feedback
- Smoother home-to-game transitions
- Sticky desktop game controls for easier play
- Stronger active-player and turn-state visuals
- Timer urgency animation and polished pause feedback
- Improved button, game-board and control interactions
- Responsive mobile layouts
- Reduced-motion support for accessibility

## UI polish update

This version includes a full interaction and visual refresh:

- Sticky glass-style navigation and game header
- Collapsible in-game instructions
- Animated score and timer changes
- Stronger active-player states
- Improved responsive game panels and play areas
- Marbles motion streaks and distinct player shooters
- Pick-Up Sticks collection and hint effects
- Five Stones toss and catch-window feedback
- Chapteh kick particles and rally feedback
- Reduced-motion support for accessibility

## Chapteh local versus mode

Player 1 controls the left half with A / Left Arrow. Player 2 controls the right half with D / Right Arrow. Each kick sends the chapteh across to the other player. If it lands on your side, the opponent scores. First to 7 points wins.

## Chapteh rally streak

The two-player Chapteh mode now includes a live rally streak counter. Every successful kick increases the streak. The display celebrates longer exchanges at 4, 8 and 12 successful kicks, and resets to 0 immediately when a rally ends because a player misses or the chapteh goes out.

## Premium UI layer

This version adds:

- Framer Motion for page, card, score, timer and panel transitions.
- Lucide React for a consistent icon system.
- Glass-like shared surfaces, improved spacing, depth and responsive states.
- Motion respects the user's reduced-motion preference through CSS fallbacks.

## Featured game carousel

The home page includes a featured-game carousel for all four games. Use the previous/next buttons, the game tabs below the carousel, or focus the carousel and press the Left/Right Arrow keys. Each slide includes game mode, difficulty, skill, controls, player count, and a direct Play now action.

## Mobile and tablet support

The interface includes responsive layouts for phones, portrait tablets, and landscape tablets.

- Featured carousel supports touch swipe, arrow buttons, dots, and keyboard arrows.
- Marbles has a larger touch hit area for the shooter on touch screens.
- Marbles and Pick-Up Sticks expose mobile pause and timer controls beside the play area.
- Five Stones exposes mobile Toss and Restart controls beside the board.
- Chapteh keeps large left and right kick controls near the bottom of the screen on phones.
- Game boards, score panels, timers, instructions, difficulty controls, and cards reflow based on screen width.

## Professional public-facing UI

The interface uses a restrained design system intended for broad public use:

- Clear typographic hierarchy and consistent spacing
- Responsive phone, tablet and desktop layouts
- Touch, mouse and keyboard support
- Visible keyboard focus states
- Reduced-motion and higher-contrast preference support
- Large touch targets and readable game status information
- Consistent navigation, cards, controls and game shells
- No account or sign-in requirement

The home page also includes an accessibility and device-support section so visitors understand how the collection is intended to be used.


## Mobile fullscreen hint

A compact touch-device hint appears below the game header before fullscreen is active. It explains how to enter fullscreen, return with the Exit fullscreen control, and notes that some mobile browsers expose their own exit gesture or control. Desktop layouts are unchanged.
