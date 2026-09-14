# Singapore Heritage Games

A browser-based collection of four playable heritage games:

- Marbles
- Pick-Up Sticks
- Five Stones
- Chapteh

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

## Controls

### Marbles
Every round starts with seven randomly placed, non-overlapping targets inside the ring. Use New random round to reshuffle. Drag backwards from the white shooter marble and release. For keyboard play, use the Aim and Power sliders, then Shoot. Aim -90 degrees points up and 0 degrees points right.

### Pick-Up Sticks
Drag an exposed stick away from the pile to collect it. Use Show a free stick for a hint. Keyboard: Tab to a stick and press Enter or Space to lift it. New random pile reshuffles positions, angles, lengths and colour order while keeping the same total points.

### Five Stones
Choose Practice or Challenge pacing. Press Toss, collect the required ground stones, then catch while the airborne stone is falling. Keyboard: focus the board, use Space to toss/catch and 1-4 to collect.

### Chapteh
Press A / Left Arrow for the left foot and D / Right Arrow for the right foot. On touch screens, tap the left or right side of the play area or use the foot buttons. Kick only while falling in the shaded zone. Your best rally is saved on this browser when storage is available.

## Technology

- React
- TypeScript
- Vite
- HTML5 Canvas
- Pointer Events

No backend is required.

## Gameplay checks

```bash
npm test
```

Checks cover shot power limits, stick overlap geometry, and Chapteh kick timing.
