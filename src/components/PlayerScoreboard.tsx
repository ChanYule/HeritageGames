import { AnimatePresence, motion } from "framer-motion";
import { Pause, Trophy } from "lucide-react";

type Props = {
  activePlayer: 0 | 1;
  scores: [number, number];
  labels?: [string, string];
  gameOver?: boolean;
  secondary?: [string, string];
  paused?: boolean;
  pausedBy?: 0 | 1 | null;
};

export default function PlayerScoreboard({
  activePlayer,
  scores,
  labels = ["Player 1", "Player 2"],
  gameOver = false,
  secondary,
  paused = false,
  pausedBy = null,
}: Props) {
  const pausedPlayer = pausedBy ?? activePlayer;

  return (
    <motion.div
      className={`player-scoreboard premium-scoreboard ${paused ? "is-paused" : ""}`}
      aria-label="Two player scoreboard"
      layout
    >
      <AnimatePresence initial={false}>
        {paused && !gameOver ? (
          <motion.div
            className="scoreboard-pause-banner premium-pause-banner"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
          >
            <div className="scoreboard-pause-title">
              <Pause size={15} />
              <span className={`player-dot player-dot-${pausedPlayer + 1}`} />
              <strong>Paused by {labels[pausedPlayer]}</strong>
            </div>
            <span>Press Resume to continue this turn.</span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        className={`scoreboard-turn-rail player-${activePlayer + 1}`}
        aria-hidden="true"
        layout
      >
        <motion.span layoutId="scoreboard-active-rail" />
      </motion.div>

      {[0, 1].map((index) => {
        const player = index as 0 | 1;
        const isActive = !gameOver && activePlayer === player;

        return (
          <motion.div
            key={labels[player]}
            className={`player-score player-${player + 1} ${isActive ? "active" : ""} ${
              paused && isActive ? "paused-active" : ""
            }`}
            animate={{ scale: isActive ? 1.015 : 1, y: isActive ? -2 : 0 }}
            transition={{ type: "spring", stiffness: 330, damping: 26 }}
            layout
          >
            <div className="player-score-name">
              <span className="player-dot" />
              <strong>{labels[player]}</strong>
              {isActive && (
                <motion.span
                  className={`turn-pill ${paused ? "paused" : ""}`}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  {paused ? "Paused" : "Your turn"}
                </motion.span>
              )}
            </div>
            <div className="premium-score-value-wrap">
              {gameOver && scores[player] === Math.max(...scores) && scores[0] !== scores[1] ? <Trophy size={16} /> : null}
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.strong
                  key={`${player}-${scores[player]}`}
                  className="player-score-value"
                  initial={{ opacity: 0, y: -12, scale: 1.18 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.9 }}
                  transition={{ duration: 0.22 }}
                >
                  {scores[player]}
                </motion.strong>
              </AnimatePresence>
            </div>
            {secondary && <span className="player-score-secondary">{secondary[player]}</span>}
            {paused && isActive ? (
              <span className="player-score-pause-hint">Resume keeps this player active.</span>
            ) : null}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
