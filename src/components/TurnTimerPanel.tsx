import { AnimatePresence, motion } from "framer-motion";
import { Clock3, Pause, Play, TimerOff } from "lucide-react";

type Props = {
  enabled: boolean;
  seconds: number;
  duration: number;
  paused?: boolean;
  autoPaused?: boolean;
  gameOver?: boolean;
  onToggle: (enabled: boolean) => void;
  onPauseToggle?: (paused: boolean) => void;
};

export default function TurnTimerPanel({
  enabled,
  seconds,
  duration,
  paused = false,
  autoPaused = false,
  gameOver = false,
  onToggle,
  onPauseToggle,
}: Props) {
  const percentage = Math.max(0, Math.min(100, (seconds / duration) * 100));
  const countdownPaused = paused || autoPaused;
  const urgent = enabled && seconds <= 10 && !countdownPaused && !gameOver;
  const warning = enabled && seconds > 10 && seconds <= 20 && !countdownPaused && !gameOver;
  const pauseAvailable = enabled && !gameOver && Boolean(onPauseToggle);

  let status = "No time limit";
  if (enabled) {
    if (gameOver) status = "Finished";
    else if (paused) status = "Game paused";
    else if (autoPaused) status = "Shot in progress";
    else status = "Counting down";
  }

  return (
    <motion.div
      className={`turn-timer-panel premium-timer-panel ${warning ? "timer-warning" : ""} ${urgent ? "timer-urgent" : ""} ${!enabled ? "timer-disabled" : ""} ${paused ? "timer-manual-paused" : ""}`}
      animate={urgent ? { scale: [1, 1.012, 1] } : { scale: 1 }}
      transition={urgent ? { duration: 0.9, repeat: Infinity } : { duration: 0.2 }}
    >
      <div className="turn-timer-heading">
        <div className="premium-timer-title">
          <span className="timer-icon-shell">{enabled ? <Clock3 size={16} /> : <TimerOff size={16} />}</span>
          <div>
            <span className="timer-label">Turn timer</span>
            <strong>{status}</strong>
          </div>
        </div>
        <label className="timer-toggle premium-toggle">
          <input
            type="checkbox"
            checked={enabled}
            disabled={gameOver}
            onChange={(event) => onToggle(event.target.checked)}
          />
          <span className="premium-toggle-track"><span /></span>
          <em>{enabled ? "On" : "Off"}</em>
        </label>
      </div>

      {enabled ? (
        <>
          <div className="timer-readout" aria-live="polite" aria-label={`${seconds} seconds remaining`}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.strong
                key={seconds}
                className="timer-second-pop"
                initial={{ opacity: 0, y: -10, scale: 1.14 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                transition={{ duration: 0.18 }}
              >
                {seconds}
              </motion.strong>
            </AnimatePresence>
            <span>seconds</span>
          </div>
          <div className="timer-track premium-timer-track" aria-hidden="true">
            <motion.span
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>

          {onPauseToggle ? (
            <motion.button
              type="button"
              className={`timer-pause-button premium-timer-button ${paused ? "is-paused" : ""}`}
              disabled={!pauseAvailable}
              onClick={() => onPauseToggle(!paused)}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
              {paused ? "Resume turn" : "Pause turn"}
            </motion.button>
          ) : null}

          <p>
            {gameOver
              ? "The timer stops when the match ends."
              : paused
                ? "Time and gameplay are frozen. Resume continues the same player's turn."
                : autoPaused
                  ? "The countdown is held while the shot is resolving."
                  : "When it reaches 0, the turn passes automatically."}
          </p>
        </>
      ) : (
        <p>Players take as long as they need. Turn switching still follows the normal game rules.</p>
      )}
    </motion.div>
  );
}
