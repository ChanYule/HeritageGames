import { useMemo, useState } from "react";

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
  return Array.from({ length: 18 }, (_, i) => {
    const tone = palette[i % palette.length];
    return {
      id: i,
      x: 23 + ((i * 37) % 54),
      y: 20 + ((i * 53) % 55),
      length: 46 + (i % 4) * 4,
      angle: -65 + ((i * 31) % 130),
      color: tone.color,
      points: tone.points,
      removed: false,
    };
  });
}

function angleDiff(a: number, b: number) {
  let d = Math.abs(a - b) % 180;
  if (d > 90) d = 180 - d;
  return d;
}

export default function PickUpSticksGame() {
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
    setScore(0);
    setMistakes(0);
    setStreak(0);
    setDragging(null);
    setOrigin(null);
    setMessage("Choose an exposed stick and drag it away slowly.");
  };

  const isBlocked = (stick: Stick) => {
    return sticks.some((other) => {
      if (other.removed || other.id <= stick.id || other.id === stick.id) return false;
      const dx = Math.abs(other.x - stick.x);
      const dy = Math.abs(other.y - stick.y);
      const close = dx < 17 && dy < 17;
      const crossing = angleDiff(other.angle, stick.angle) > 16;
      return close && crossing;
    });
  };

  const startDrag = (event: React.PointerEvent<HTMLDivElement>, stick: Stick) => {
    if (stick.removed) return;
    if (isBlocked(stick)) {
      setMistakes((value) => value + 1);
      setStreak(0);
      setMessage("That stick is trapped underneath another. Try one on top.");
      return;
    }

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
    event.currentTarget.style.transform = `translate(${dx}px, ${dy}px) rotate(${stick.angle}deg)`;
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>, stick: Stick) => {
    if (dragging !== stick.id || !origin) return;

    const distance = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);
    event.currentTarget.style.transform = `rotate(${stick.angle}deg)`;

    if (distance > 90) {
      setSticks((current) =>
        current.map((item) => (item.id === stick.id ? { ...item, removed: true } : item))
      );
      setScore((value) => value + stick.points);
      setStreak((value) => value + 1);
      setMessage(stick.points === 50 ? "Rare purple stick collected!" : "Clean pickup.");
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
        <div className="panel-card compact">
          <span className="status-dot" />
          <p>{cleared ? "Pile cleared. Perfect finish." : message}</p>
        </div>
        <button className="secondary-button" onClick={reset}>Restart pile</button>
      </aside>

      <div className="play-column">
        <div className="sticks-board">
          <div className="floor-label">PICK-UP STICKS</div>
          {sticks.map((stick) => (
            <div
              key={stick.id}
              className={`stick ${stick.removed ? "removed" : ""}`}
              style={{
                left: `${stick.x}%`,
                top: `${stick.y}%`,
                width: `${stick.length}%`,
                background: stick.color,
                transform: `rotate(${stick.angle}deg)`,
                zIndex: stick.id + 1,
              }}
              onPointerDown={(event) => startDrag(event, stick)}
              onPointerMove={(event) => moveDrag(event, stick)}
              onPointerUp={(event) => finishDrag(event, stick)}
              onPointerCancel={(event) => finishDrag(event, stick)}
              role="button"
              tabIndex={0}
              aria-label={`Stick worth ${stick.points} points`}
            />
          ))}
        </div>
        <p className="control-hint">Tip: sticks drawn later sit above earlier sticks. Clear the top layer first.</p>
      </div>
    </section>
  );
}
