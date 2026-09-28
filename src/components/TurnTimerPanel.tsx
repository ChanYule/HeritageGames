import { t, useLanguage } from "../i18n";
import { AnimatePresence, motion } from "framer-motion";
import { Clock3, Pause, Play, TimerOff } from "lucide-react";

type Props = {
  enabled: boolean;
  seconds: number;
  duration: number;
  paused?: boolean;
  autoPaused?: boolean;
  gameOver?: boolean;
  waiting?: boolean;
  locked?: boolean;
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
  waiting = false,
  locked = false,
  onToggle,
  onPauseToggle,
}: Props) {
  useLanguage();
  const percentage = Math.max(0, Math.min(100, (seconds / duration) * 100));
  const countdownPaused = paused || autoPaused || waiting;
  const urgent = enabled && seconds <= 10 && !countdownPaused && !gameOver;
  const warning = enabled && seconds > 10 && seconds <= 20 && !countdownPaused && !gameOver;
  const pauseAvailable = enabled && !gameOver && !waiting && Boolean(onPauseToggle);

  let status = t("No time limit");
  if (enabled) {
    if (gameOver) status = t("Finished");
    else if (waiting) status = t("Waiting for player");
    else if (paused) status = t("Game paused");
    else if (autoPaused) status = t("Shot in progress");
    else status = t("Counting down");
  }

  return (
    <motion.div
      className={`turn-timer-panel premium-timer-panel ${warning ? "timer-warning" : ""} ${urgent ? "timer-urgent" : ""} ${!enabled ? "timer-disabled" : ""} ${paused ? "timer-manual-paused" : ""}`}
    >
      <div className="turn-timer-heading">
        <div className="premium-timer-title">
          <span className="timer-icon-shell">{enabled ? <Clock3 size={16} /> : <TimerOff size={16} />}</span>
          <div>
            <span className="timer-label">{t("Turn timer")}</span>
            <strong>{status}</strong>
          </div>
        </div>
        <label className="timer-toggle premium-toggle">
          <input
            type="checkbox"
            aria-label={t("Turn timer")}
            checked={enabled}
            disabled={gameOver || locked}
            onChange={(event) => onToggle(event.target.checked)}
          />
          <span className="premium-toggle-track"><span /></span>
          <em>{enabled ? t("On") : t("Off")}</em>
        </label>
      </div>

      {enabled ? (
        <>
          <div className="timer-readout" role="timer" aria-live="off" aria-label={t("{0} seconds remaining", seconds)}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.strong
                key={seconds}
                className="timer-second-pop"
                initial={false}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.18 }}
              >
                {seconds}
              </motion.strong>
            </AnimatePresence>
            <span>{t("seconds")}</span>
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
              {paused ? t("Resume turn") : t("Pause turn")}
            </motion.button>
          ) : null}

          <p>
            {gameOver
              ? t("The timer stops when the match ends.")
              : waiting
                ? t("Take your time. The timer starts when you press Ready.")
              : paused
                ? t("Time and gameplay are frozen. Resume continues the same player's turn.")
                : autoPaused
                  ? t("The countdown is held while the shot is resolving.")
                  : t("When it reaches 0, the turn passes automatically.")}
          </p>
        </>
      ) : (
        <p>{t("Players take as long as they need. Turn switching still follows the normal game rules.")}</p>
      )}
    </motion.div>
  );
}
