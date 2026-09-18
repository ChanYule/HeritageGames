import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: ReactNode;
};

export default function GameShell({ title, subtitle, onBack, children }: Props) {
  return (
    <main className="game-page page-enter">
      <header className="game-header">
        <button className="back-button" onClick={onBack} aria-label="Back to all games">
          <span aria-hidden="true">←</span>
          <span>All games</span>
        </button>
        <div className="game-title-block">
          <p className="eyebrow">Now playing</p>
          <h1>{title}</h1>
          <p className="game-subtitle">{subtitle}</p>
        </div>
        <div className="game-header-badge" aria-hidden="true">
          <span>SG</span>
          <small>Heritage Play</small>
        </div>
      </header>
      <div className="game-content-enter">{children}</div>
    </main>
  );
}
