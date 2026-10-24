# Carrom live-score fix

The scoreboard previously displayed only end-of-board points, leaving both players at zero during play. It now shows each colour's secured coin count after the shot settles and the rules resolve returns and dues. Queen and striker pockets do not inflate that count. New Match clears both totals. At board completion the label switches to Board points; existing winner, queen bonus, final points and Challenge completion scoring are preserved.

Carrom numbers render directly so a score-change animation cannot hide the current value. English and Chinese labels identify the live totals clearly.

Validation: 247 automated tests, TypeScript and production build passed. Seven browser checks used actual shots from the opening rack: 0-0 to 1-0 to 2-0, a miss retaining 2-0, then Player 2 reaching 2-1. The checks also covered score visibility, phone/tablet resizing, fullscreen exit and restart. No uncaught browser errors occurred.

See browser-results.json, live-scores.png and unit-tests.txt. Physical devices were not tested; the existing bundle-size advisory remains.
