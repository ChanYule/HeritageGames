# Singapore Heritage Games

Four heritage games for shared devices, with English/Chinese, larger text, contrast preferences, standalone play and a Heritage Games Challenge for two to four named players. No backend or account is required.

## Run locally

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

On Windows PowerShell, use `npm.cmd` if script execution is restricted. Tests use Node's `--test-isolation=none`; use a Node runtime supporting this flag. No tests should be removed to accommodate an older runtime.

## Heritage Games Challenge

Select **Start Challenge** on Home, or **Add to Challenge** on a game card.

1. **Choose Your Challenge**: Quick Challenge has two selected games (estimated 10–15 minutes); Full Challenge has all four (estimated 20–30 minutes). These are approximate estimates, especially for full Carrom games.
2. **Who's Playing?**: choose two, three or four players, enter names or use defaults, and select a shared game difficulty.
3. **Challenge Lobby**: review players, identities, game order and duration. Edit Players or Edit Games before pressing **Start Challenge**.
4. Press **Ready** for the current player's attempt or Carrom matchup. Finished results save automatically. The next person sees a handover and must press Ready.
5. After everyone completes a game, review **Round Results** and **Overall Scores**. Press **Start Next Game**; games never advance automatically.
6. The final results show the champion or shared champions, everyone's ranking and individual game results. **Play Again** uses the same players, games and level with fresh results; **New Challenge** returns to setup; **Return Home** exits.

Each player has a stable colour and name. Names are always shown; colour is never the only identity cue. Progress is measured in games, not league matches. Overall Scores can expand during play; fullscreen includes a compact Game progress control without changing the active game state.

### Individual attempts

- **Marbles**: a fresh, identical seeded layout for each player; six shots or until the ring is empty. Each shot has a 45-second aiming limit, paused while rolling; timeout ends the attempt. Hit the shared target colour first; only matching captures score 100 each, with 50 extra each for two or more matching captures.
- **Pick-Up Sticks**: the same seeded pile and level for each player; 45 seconds to extract sticks carefully. Moving another stick beyond tolerance, timeout or an empty pile ends the attempt. Selecting alone is safe. Drag slowly or use the direction buttons; three clean pickups add 20 points and five add 50.
- **Tin-Can Knockdown**: three balls per player on an identical fixed level (levels 1/3/5 for Easy/Medium/Difficult). Each fallen tin scores 100; clearing adds 200 plus 50 per unused ball. Scoring waits for sustained quiet.

### Carrom format

Carrom plays one singles board in both standalone and Challenge mode. Player 1 breaks with nine white coins; Player 2 has nine black coins and shoots from the opposite baseline. The rack uses the compact white Y arrangement. A missed break allows up to three attempts; a striker pocket before touching the rack passes the turn without a due. Own coins retain the turn; a miss after the break passes it. The red queen requires an own coin already pocketed and no outstanding due, followed by same-shot or next-shot cover. Queen plus the first own coin needs a further cover; queen plus two first own coins covers immediately. An uncovered queen returns. Striker alone costs one own coin and the turn; striker plus own coins returns those coins plus a due and retains the turn. Unpaid dues carry forward. Pocketing the last own coin before the queen loses the board; finishing the opponent's coins also ends the board. The winner gets remaining opponent coins plus three points only if they covered the queen. Board points replace the old 100-point targets; the winner determines Challenge advancement.

This is an accessible single-board adaptation of the [AICF Laws of Carrom](https://www.indiancarrom.co.in/laws-of-carrom/), not a 25-point/eight-board tournament match. Digital strokes are treated as proper strokes. Coin returns are automatically placed in free central positions, dues avoid the centre circle, and referee placement choices, optional additional-point claims, physical posture/hand fouls and tournament timers are omitted. Controls: tap the highlighted baseline to place the striker, pull back and release to shoot, or use **Adjust shot** and **Shoot striker**. Both players can shoot in any direction; cushion rebounds and opponent coins remain part of play. The in-game **How to play Carrom** guide and live coin/queen/due status explain the rules.

- **Two players**: one full duel.
- **Three players**: three duels, each pair once. Everyone plays twice and starts once. Within this game only, a duel win is worth 3, a draw 1. Rank these outcomes to award Challenge Points; tied outcomes share placement. Raw coin scores do not break ties between different opponents.
- **Four players**: two semifinals, a final and a placement game. Everyone plays two completed games. Drawn semifinals replay without awarding extra points. A tied final shares first; a tied placement game shares third. There is no long round-robin schedule.

### Challenge Points and ties

For N players, a game's rank r receives `N + 1 - r` Challenge Points. Four players receive 4/3/2/1, three receive 3/2/1, two receive 2/1. Equal game results share rank and points, skipping following ranks: 1/1/3/4.

Overall ranking uses total Challenge Points, then game wins, second-place finishes, and total normalised performance. Individual performance is raw score divided by that game's highest raw score (all-zero games give equal performance). Carrom performance uses normalised placement because opponents differ. Remaining ties share rank and championship; names and random choice never decide a winner. The final screen explains a tie-break that affects the champion.

### Saving and recovery

Challenge progress uses `heritage-games-challenge-v2`. Completed results and round-results boundaries survive refresh. In-progress physics is not saved; only the current unfinished attempt restarts behind Ready with the same layout and level. Saved placements, points, colours and progress are recalculated from validated results.

The old `heritage-games-competition-v1` league save is retained separately and is not converted into placement points: its repeated-match rules are incompatible. Language and display settings remain independent. Storage failures are shown visibly.

## Standalone games and accessibility

**Play Game** on a game card opens standalone play. The existing two-player mechanics, difficulty controls, pause/resume, gesture and keyboard alternatives, sound/mute, restart and fullscreen remain available. Marbles and Sticks practice timers remain 30 seconds. Fullscreen uses native fullscreen where supported and a CSS fallback otherwise, including safe-area padding.

## Verification

`npm test` covers Challenge creation, placement points, tie rules, handovers, progression, all Carrom formats, duplicate/stale callbacks, restarts and validated storage recovery, plus existing physics and mechanics. Server-rendered integration tests verify standalone controls, individual scoreboards and initial Challenge setup; they do not prove live interaction or viewport fit.

The 21 October 2026 upgrade includes headless Edge measurements of all six registered games in normal view, native fullscreen and a forced immersive fallback. See [implementation and verification notes](docs/pick-up-sticks-responsive-upgrade.md) for viewport sizes, screenshots, automated gameplay checks and remaining physical-device checks. Before a real event, rehearse on the actual phones and tablets. Walk Quick and Full through setup, all player handovers, game results, champion, Play Again, New Challenge and Return Home. Check English/Chinese, larger text, contrast, touch controls and refresh recovery. Phone/tablet acceptance remains unverified until these checks are run.


### Tin-Can slingshot and Marbles colour challenge

Tin-Can Knockdown now uses an original side-view Canvas scene and planar cannon-es rigid bodies. Pull the launcher ball backwards and release; angle/strength sliders and Shoot ball provide alternatives. Five curated levels introduce breakable crates, solid walls, elevated supports and ramps. The collision-aware dotted guide stops at first contact. Each player receives a fresh identical level and three balls. Standalone play progresses through all five levels; Challenge uses its selected shared difficulty.

Marbles now has four validated board patterns, balanced colour groups with R/B/Y/G markings, a horizontal shooter launch rail and a dedicated pull-back zone. The first-contact guide uses expanded-circle geometry and the same rolling range as the physics solver. Only actual matching-colour captures after a correct first hit earn points: 100 / 250 / 450 for one / two / three, then +200 for each additional matching capture. The shared target follows Red, Blue, Yellow and Green, skipping exhausted groups. Turns, timers, pause, seeded Challenge attempts and single-result reporting remain. See [the Marbles redesign report](docs/marbles-redesign/README.md) for changed files, screenshots, verification and remaining device checks.

See [the gameplay redesign handover](docs/gameplay-redesign.md) for scoring, level solutions, changed files, test results and remaining device checks. The previous 3D Tin-Can files remain in the repository but are no longer the active game route.
