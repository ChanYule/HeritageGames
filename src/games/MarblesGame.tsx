import { useEffect, useMemo, useRef, useState } from "react";

import { randomMarblePositions, shotVelocity } from "./mechanics";

type Marble = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  target: boolean;
  captured: boolean;
  color: string;
};

const WIDTH = 900;
const HEIGHT = 560;
const RING = { x: WIDTH / 2, y: HEIGHT / 2, radius: 175 };

function createMarbles(): Marble[] {
  const targets: Marble[] = [];
  const colors = ["#d96f46", "#2f7282", "#d6a23d", "#7c6355", "#67864a", "#bd5c72"];
  const positions = randomMarblePositions();
  for (let i = 0; i < positions.length; i++) {
    targets.push({
      id: i,
      x: RING.x + positions[i].x,
      y: RING.y + positions[i].y,
      vx: 0,
      vy: 0,
      radius: 18,
      target: true,
      captured: false,
      color: colors[i % colors.length],
    });
  }
  return [
    ...targets,
    {
      id: 100,
      x: RING.x,
      y: HEIGHT - 70,
      vx: 0,
      vy: 0,
      radius: 20,
      target: false,
      captured: false,
      color: "#f3eee4",
    },
  ];
}

export default function MarblesGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [initialMarbles] = useState(createMarbles);
  const marblesRef = useRef<Marble[]>(initialMarbles);
  const draggingRef = useRef(false);
  const movingRef = useRef(false);
  const pointerRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number | null>(null);

  const [score, setScore] = useState(0);
  const [shots, setShots] = useState(0);
  const [scoringShots, setScoringShots] = useState(0);
  const [aim, setAim] = useState(-90);
  const [power, setPower] = useState(65);
  const [captured, setCaptured] = useState(0);
  const [message, setMessage] = useState("Drag the white shooter backwards, then release.");
  const [moving, setMoving] = useState(false);

  const reset = () => {
    marblesRef.current = createMarbles();
    setScore(0);
    setShots(0);
    setScoringShots(0);
    draggingRef.current = false;
    setCaptured(0);
    setMessage("Drag the white shooter backwards, then release.");
    setMoving(false);
    movingRef.current = false;
  };

  const getCanvasPoint = (event: PointerEvent | React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      const floor = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      floor.addColorStop(0, "#d8d0bf");
      floor.addColorStop(1, "#c7bdab");
      ctx.fillStyle = floor;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.strokeStyle = "rgba(87, 72, 55, 0.14)";
      ctx.lineWidth = 1;
      for (let x = 0; x < WIDTH; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < HEIGHT; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(RING.x, RING.y, RING.radius, 0, Math.PI * 2);
      ctx.strokeStyle = "#7c5f46";
      ctx.lineWidth = 7;
      ctx.stroke();

      const marbles = marblesRef.current;

      if (draggingRef.current) {
        const shooter = marbles.find((m) => !m.target);
        if (shooter) {
          const p = pointerRef.current;
          const dx = shooter.x - p.x;
          const dy = shooter.y - p.y;
          const length = Math.min(Math.hypot(dx, dy), 170);
          const angle = Math.atan2(dy, dx);
          const endX = shooter.x + Math.cos(angle) * length;
          const endY = shooter.y + Math.sin(angle) * length;

          ctx.setLineDash([10, 8]);
          ctx.strokeStyle = "#5e4638";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(shooter.x, shooter.y);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.strokeStyle = "rgba(94,70,56,0.35)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(shooter.x, shooter.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
      }

      marbles.forEach((m) => {
        if (m.captured) return;
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.25)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 5;

        const gradient = ctx.createRadialGradient(
          m.x - m.radius / 2,
          m.y - m.radius / 2,
          3,
          m.x,
          m.y,
          m.radius
        );
        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(0.18, m.color);
        gradient.addColorStop(1, "#263d42");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowColor = "transparent";
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(m.x - 5, m.y - 5, m.radius * 0.34, 0, Math.PI * 1.4);
        ctx.stroke();
        ctx.restore();
      });
    };

    const update = (dt: number) => {
      const marbles = marblesRef.current;
      let anyMoving = false;

      marbles.forEach((m) => {
        if (m.captured) return;

        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.vx *= Math.pow(0.985, dt);
        m.vy *= Math.pow(0.985, dt);

        if (Math.abs(m.vx) < 0.02) m.vx = 0;
        if (Math.abs(m.vy) < 0.02) m.vy = 0;

        if (m.x - m.radius < 0) {
          m.x = m.radius;
          m.vx *= -0.65;
        }
        if (m.x + m.radius > WIDTH) {
          m.x = WIDTH - m.radius;
          m.vx *= -0.65;
        }
        if (m.y - m.radius < 0) {
          m.y = m.radius;
          m.vy *= -0.65;
        }
        if (m.y + m.radius > HEIGHT) {
          m.y = HEIGHT - m.radius;
          m.vy *= -0.65;
        }

        if (Math.hypot(m.vx, m.vy) > 0.03) anyMoving = true;
      });

      for (let i = 0; i < marbles.length; i++) {
        for (let j = i + 1; j < marbles.length; j++) {
          const a = marbles[i];
          const b = marbles[j];
          if (a.captured || b.captured) continue;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          const minDist = a.radius + b.radius;
          if (dist > 0 && dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;

            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;

            const relativeVx = b.vx - a.vx;
            const relativeVy = b.vy - a.vy;
            const speedAlongNormal = relativeVx * nx + relativeVy * ny;

            if (speedAlongNormal < 0) {
              const restitution = 0.88;
              const impulse = (-(1 + restitution) * speedAlongNormal) / 2;
              const ix = impulse * nx;
              const iy = impulse * ny;
              a.vx -= ix;
              a.vy -= iy;
              b.vx += ix;
              b.vy += iy;
            }
          }
        }
      }

      if (!anyMoving && movingRef.current) {
        movingRef.current = false;
        let newlyCaptured = 0;
        marbles.forEach((m) => {
          if (!m.target || m.captured) return;
          const distance = Math.hypot(m.x - RING.x, m.y - RING.y);
          if (distance - m.radius > RING.radius) {
            m.captured = true;
            newlyCaptured += 1;
          }
        });

        if (newlyCaptured > 0) {
          setScoringShots((value) => value + 1);
          const bonus = newlyCaptured > 1 ? newlyCaptured * 50 : 0;
          setCaptured((value) => value + newlyCaptured);
          setScore((value) => value + newlyCaptured * 100 + bonus);
          setMessage(newlyCaptured > 1 ? `${newlyCaptured} marbles in one shot!` : "Nice shot!");
        } else {
          setMessage("No capture. Line up your next shot.");
        }

        const shooter = marbles.find((m) => !m.target);
        if (shooter) {
          shooter.x = Math.min(Math.max(shooter.x, 60), WIDTH - 60);
          shooter.y = Math.min(Math.max(shooter.y, 60), HEIGHT - 60);
        }

        setMoving(false);
    movingRef.current = false;
      }

    };

    let previous = performance.now();
    let accumulator = 0;
    const frame = (time: number) => {
      accumulator += Math.min(time - previous, 50);
      previous = time;
      while (accumulator >= 1000 / 60) {
        update(1);
        accumulator -= 1000 / 60;
      }
      draw();
      animationRef.current = requestAnimationFrame(frame);
    };
    animationRef.current = requestAnimationFrame(frame);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [moving]);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (movingRef.current || captured >= 7 || !event.isPrimary) return;
    const point = getCanvasPoint(event);
    const shooter = marblesRef.current.find((m) => !m.target);
    if (!shooter) return;
    if (Math.hypot(point.x - shooter.x, point.y - shooter.y) <= shooter.radius + 18) {
      draggingRef.current = true;
      pointerRef.current = point;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return;
    pointerRef.current = getCanvasPoint(event);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current || moving) return;
    draggingRef.current = false;
    const point = getCanvasPoint(event);
    const shooter = marblesRef.current.find((m) => !m.target);
    if (!shooter) return;

    const dx = shooter.x - point.x;
    const dy = shooter.y - point.y;
    const distance = Math.min(Math.hypot(dx, dy), 180);
    if (distance < 12) {
      setMessage("Pull farther back to take a shot.");
      return;
    }

    const velocity = shotVelocity(dx, dy);
    shooter.vx = velocity.x;
    shooter.vy = velocity.y;
    setShots((value) => value + 1);
    setMoving(true);
    movingRef.current = true;
    setMessage("Shot in motion...");
  };

  const shootWithControls = () => {
    if (movingRef.current || captured >= 7) return;
    const shooter = marblesRef.current.find((m) => !m.target)!;
    const radians = aim * Math.PI / 180;
    shooter.vx = Math.cos(radians) * power / 100 * 16.2;
    shooter.vy = Math.sin(radians) * power / 100 * 16.2;
    draggingRef.current = false;
    movingRef.current = true;
    setMoving(true);
    setShots((value) => value + 1);
    setMessage("Shot in motion...");
  };

  const complete = captured >= 7;
  const accuracy = useMemo(() => (shots === 0 ? 0 : Math.round((scoringShots / shots) * 100)), [scoringShots, shots]);

  return (
    <section className="game-layout">
      <aside className="game-panel">
        <div className="panel-card">
          <p className="eyebrow">How to play</p>
          <h2>Knock them out</h2>
          <p>
            Press the white shooter, drag backwards and release. Capture a target when it fully
            leaves the ring.
          </p>
        </div>
        <div className="stat-grid">
          <div><span>Score</span><strong>{score}</strong></div>
          <div><span>Shots</span><strong>{shots}</strong></div>
          <div><span>Captured</span><strong>{captured}/7</strong></div>
          <div><span>Accuracy</span><strong>{accuracy}%</strong></div>
        </div>
        <div className="panel-card compact" role="status" aria-live="polite">
          <span className="status-dot" />
          <p>{complete ? "Round complete. Great control." : message}</p>
        </div>
        <button className="secondary-button" onClick={reset}>New random round</button>
      </aside>

      <div className="play-column">
        <div className="canvas-frame">
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { draggingRef.current = false; }}
            aria-label="Marbles ring. Drag the white marble to shoot, or use the aim and power controls below."
          />
        </div>
        <div className="shot-controls">
          <label>Aim <strong>{aim} degrees</strong><input aria-label="Aim" type="range" min="-180" max="180" value={aim} onChange={(event) => setAim(Number(event.target.value))} /></label>
          <label>Power <strong>{power}%</strong><input aria-label="Power" type="range" min="15" max="100" value={power} onChange={(event) => setPower(Number(event.target.value))} /></label>
          <button className="primary-button" disabled={moving || complete} onClick={shootWithControls}>{moving ? "Rolling..." : "Shoot"}</button>
        </div>
        <p className="control-hint">Aim -90 degrees points up; 0 degrees points right. Mouse or touch: drag backwards from the white marble, then release.</p>
      </div>
    </section>
  );
}
