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
  const pauseAvailable = enabled && !gameOver && Boolean(onPauseToggle);

  let status = "No time limit";
  if (enabled) {
    if (gameOver) status = "Finished";
    else if (paused) status = "Game paused";
    else if (autoPaused) status = "Shot in progress";
    else status = "Counting down";
  }

  return (
    <div
      className={`turn-timer-panel ${urgent ? "timer-urgent" : ""} ${!enabled ? "timer-disabled" : ""} ${paused ? "timer-manual-paused" : ""}`}
    >
      <div className="turn-timer-heading">
        <div>
          <span className="timer-label">Turn timer</span>
          <strong>{status}</strong>
        </div>
        <label className="timer-toggle">
          <input
            type="checkbox"
            checked={enabled}
            disabled={gameOver}
            onChange={(event) => onToggle(event.target.checked)}
          />
          <span>{enabled ? "On" : "Off"}</span>
        </label>
      </div>

      {enabled ? (
        <>
          <div className="timer-readout" aria-live="polite" aria-label={`${seconds} seconds remaining`}>
            <strong>{seconds}</strong>
            <span>seconds</span>
          </div>
          <div className="timer-track" aria-hidden="true">
            <span style={{ width: `${percentage}%` }} />
          </div>

          {onPauseToggle ? (
            <button
              type="button"
              className={`timer-pause-button ${paused ? "is-paused" : ""}`}
              disabled={!pauseAvailable}
              onClick={() => onPauseToggle(!paused)}
            >
              <span aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span>
              {paused ? "Resume turn" : "Pause turn"}
            </button>
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
    </div>
  );
}
