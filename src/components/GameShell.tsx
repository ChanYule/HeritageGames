import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: ReactNode;
};

export default function GameShell({ title, subtitle, onBack, children }: Props) {
  return (
    <main className="game-page">
      <header className="game-header">
        <button className="ghost-button" onClick={onBack} aria-label="Back to games">
          ← Back to games
        </button>
        <div>
          <p className="eyebrow">Singapore Heritage Games</p>
          <h1>{title}</h1>
          <p className="game-subtitle">{subtitle}</p>
        </div>
      </header>
      {children}
    </main>
  );
}
