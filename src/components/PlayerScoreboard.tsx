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
    <div
      className={`player-scoreboard ${paused ? "is-paused" : ""}`}
      aria-label="Two player scoreboard"
    >
      {paused && !gameOver ? (
        <div className="scoreboard-pause-banner" role="status" aria-live="polite">
          <div className="scoreboard-pause-title">
            <span className={`player-dot player-dot-${pausedPlayer + 1}`} />
            <strong>Paused by {labels[pausedPlayer]}</strong>
          </div>
          <span>Press Resume to continue this turn.</span>
        </div>
      ) : null}

      {[0, 1].map((index) => {
        const player = index as 0 | 1;
        const isActive = !gameOver && activePlayer === player;

        return (
          <div
            key={labels[player]}
            className={`player-score player-${player + 1} ${isActive ? "active" : ""} ${
              paused && isActive ? "paused-active" : ""
            }`}
          >
            <div className="player-score-name">
              <span className="player-dot" />
              <strong>{labels[player]}</strong>
              {isActive && (
                <span className={`turn-pill ${paused ? "paused" : ""}`}>
                  {paused ? "Paused" : "Your turn"}
                </span>
              )}
            </div>
            <strong className="player-score-value">{scores[player]}</strong>
            {secondary && <span className="player-score-secondary">{secondary[player]}</span>}
            {paused && isActive ? (
              <span className="player-score-pause-hint">Resume keeps this player active.</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
