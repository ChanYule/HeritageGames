import { useMemo, useRef, useState } from "react";

import { segmentsOverlap } from "./mechanics";

type Stick = {
  id: number;
  x: number;
  y: number;
  length: number;
  angle: number;
  color: string;
  points: number;
  removed: boolean;
};

const palette = [
  { color: "#d55f4b", points: 10 },
  { color: "#2d7181", points: 10 },
  { color: "#d7a63d", points: 20 },
  { color: "#5d7f57", points: 20 },
  { color: "#7b5e8b", points: 50 },
];

function createSticks(): Stick[] {
  const tones = Array.from({ length: 18 }, (_, i) => palette[i % palette.length]);
  for (let i = tones.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tones[i], tones[j]] = [tones[j], tones[i]];
  }
  return tones.map((tone, i) => {
    return {
      id: i,
      x: 32 + Math.random() * 36,
      y: 40 + Math.random() * 20,
      length: 38 + Math.random() * 9,
      angle: Math.random() * 180,
      color: tone.color,
      points: tone.points,
      removed: false,
    };
  });
}

export default function PickUpSticksGame() {
  const boardRef = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState<number | null>(null);
  const [sticks, setSticks] = useState<Stick[]>(createSticks);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [message, setMessage] = useState("Choose an exposed stick and drag it away slowly.");

  const activeSticks = useMemo(() => sticks.filter((s) => !s.removed), [sticks]);

  const reset = () => {
    setSticks(createSticks());
    setHint(null);
    setScore(0);
    setMistakes(0);
    setStreak(0);
    setDragging(null);
    setOrigin(null);
    setMessage("Choose an exposed stick and drag it away slowly.");
  };

  const isBlocked = (stick: Stick) => {
    const board = boardRef.current;
    const rect = board ? { width: board.clientWidth, height: board.clientHeight } : null;
    if (!rect) return true;
    const segment = (item: Stick) => {
      const angle = item.angle * Math.PI / 180;
      const half = item.length / 100 * rect.width / 2;
      const x = item.x / 100 * rect.width;
      const y = item.y / 100 * rect.height;
      return [{ x: x - Math.cos(angle) * half, y: y - Math.sin(angle) * half },
        { x: x + Math.cos(angle) * half, y: y + Math.sin(angle) * half }];
    };
    return sticks.some((other) => {
      if (other.removed || other.id <= stick.id) return false;
      const [a, b] = segment(stick);
      const [c, d] = segment(other);
      return segmentsOverlap(a, b, c, d);
    });
  };

  const collect = (stick: Stick) => {
    if (stick.removed) return;
    if (isBlocked(stick)) {
      setMistakes((value) => value + 1);
      setStreak(0);
      setMessage("That stick is underneath another. Clear the one above first.");
      return;
    }
    setSticks((current) => current.map((item) => item.id === stick.id ? { ...item, removed: true } : item));
    setHint(null);
    setScore((value) => value + stick.points);
    setStreak((value) => value + 1);
    setMessage(stick.points === 50 ? "Purple stick! +50 points." : `Clean pickup! +${stick.points} points.`);
  };

  const startDrag = (event: React.PointerEvent<HTMLDivElement>, stick: Stick) => {
    if (stick.removed) return;
    if (isBlocked(stick)) {
      setMistakes((value) => value + 1);
      setStreak(0);
      setMessage("That stick is trapped underneath another. Try one on top.");
      return;
    }

    if (!event.isPrimary || dragging !== null) return;
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    setDragging(stick.id);
    setOrigin({ x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    setMessage("Keep dragging it away from the pile...");
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>, stick: Stick) => {
    if (dragging !== stick.id || !origin) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    event.currentTarget.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${stick.angle}deg)`;
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>, stick: Stick) => {
    if (dragging !== stick.id || !origin) return;

    const distance = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);
    event.currentTarget.style.transform = `translate(-50%, -50%) rotate(${stick.angle}deg)`;

    if (distance > Math.min(90, (boardRef.current?.clientWidth ?? 600) * 0.15)) {
      collect(stick);
    } else {
      setMessage("Drag the stick farther away to collect it.");
    }

    setDragging(null);
    setOrigin(null);
  };

  const cleared = activeSticks.length === 0;

  return (
    <section className="game-layout">
      <aside className="game-panel">
        <div className="panel-card">
          <p className="eyebrow">How to play</p>
          <h2>Do not disturb the pile</h2>
          <p>Drag an exposed stick away. A stick underneath another is blocked until the one above is removed.</p>
        </div>
        <div className="stat-grid">
          <div><span>Score</span><strong>{score}</strong></div>
          <div><span>Left</span><strong>{activeSticks.length}</strong></div>
          <div><span>Mistakes</span><strong>{mistakes}</strong></div>
          <div><span>Streak</span><strong>{streak}</strong></div>
        </div>
        <div className="score-legend">
          {palette.map((item, i) => (
            <div key={item.color + i}>
              <span className="legend-line" style={{ background: item.color }} />
              <span>{item.points} pts</span>
            </div>
          ))}
        </div>
        <div className="panel-card compact" role="status" aria-live="polite">
          <span className="status-dot" />
          <p>{cleared ? `Pile cleared! ${score} points / ${mistakes === 0 ? "Perfect finish." : `${mistakes} mistakes. Try for a clean round!`}` : message}</p>
        </div>
        <button className="secondary-button" disabled={cleared} onClick={() => {
          const exposed = activeSticks.find((stick) => !isBlocked(stick));
          if (exposed) { setHint(exposed.id); setMessage("The highlighted stick is free. Drag it away or focus it and press Enter."); }
        }}>Show a free stick</button>
        <button className="secondary-button" onClick={reset}>New random pile</button>
      </aside>

      <div className="play-column">
        <div className="sticks-board" ref={boardRef}>
          <div className="floor-label">PICK-UP STICKS</div>
          {activeSticks.map((stick) => (
            <div
              key={stick.id}
              className={`stick ${hint === stick.id ? "hinted" : ""}`}
              style={{
                left: `${stick.x}%`,
                top: `${stick.y}%`,
                width: `${stick.length}%`,
                background: stick.color,
                transform: `translate(-50%, -50%) rotate(${stick.angle}deg)`,
                zIndex: stick.id + 1,
              }}
              onPointerDown={(event) => startDrag(event, stick)}
              onPointerMove={(event) => moveDrag(event, stick)}
              onPointerUp={(event) => finishDrag(event, stick)}
              onPointerCancel={(event) => {
                event.currentTarget.style.transform = `translate(-50%, -50%) rotate(${stick.angle}deg)`;
                setDragging(null); setOrigin(null);
              }}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && !event.repeat) { event.preventDefault(); collect(stick); }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Stick worth ${stick.points} points`}
            />
          ))}
        </div>
        <p className="control-hint">Drag a top stick away to collect it. Keyboard: Tab to a stick, then Enter or Space to lift. Need help? Show a free stick.</p>
      </div>
    </section>
  );
}
