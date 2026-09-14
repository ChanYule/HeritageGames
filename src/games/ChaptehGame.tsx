import { useEffect, useRef, useState } from "react";

type Chapteh = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
};

const WIDTH = 760;
const HEIGHT = 560;
const GROUND = HEIGHT - 58;

export default function ChaptehGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chaptehRef = useRef<Chapteh>({ x: WIDTH / 2, y: 160, vx: 1.2, vy: 0, radius: 22 });
  const runningRef = useRef(false);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef(performance.now());

  const [running, setRunning] = useState(false);
  const [rally, setRally] = useState(0);
  const [best, setBest] = useState(0);
  const [leftKicks, setLeftKicks] = useState(0);
  const [rightKicks, setRightKicks] = useState(0);
  const [message, setMessage] = useState("Start a rally, then use A / D or tap the left / right side.");

  const resetBall = () => {
    chaptehRef.current = { x: WIDTH / 2, y: 150, vx: 1.0, vy: 0, radius: 22 };
  };

  const start = () => {
    resetBall();
    setRally(0);
    setLeftKicks(0);
    setRightKicks(0);
    runningRef.current = true;
    setRunning(true);
    setMessage("Keep it up. Time each kick near the bottom.");
  };

  const stop = (finalRally: number) => {
    runningRef.current = false;
    setRunning(false);
    setBest((value) => Math.max(value, finalRally));
    setMessage(finalRally === 0 ? "Missed the first kick. Try again." : `Rally ended at ${finalRally} kicks.`);
  };

  const kick = (side: "left" | "right") => {
    if (!runningRef.current) return;
    const c = chaptehRef.current;
    const inKickZone = c.y > GROUND - 130 && c.y < GROUND - 8;
    const onCorrectHalf =
      side === "left" ? c.x < WIDTH / 2 + 55 : c.x > WIDTH / 2 - 55;

    if (!inKickZone || !onCorrectHalf) {
      setMessage("Too early or too far away. Wait until the chapteh reaches your foot.");
      return;
    }

    const centerOffset = (c.x - WIDTH / 2) / (WIDTH / 2);
    c.vy = -11.1;
    c.vx += (side === "left" ? 1.35 : -1.35) - centerOffset * 0.5;

    setRally((value) => {
      const next = value + 1;
      setBest((bestValue) => Math.max(bestValue, next));
      return next;
    });

    if (side === "left") setLeftKicks((value) => value + 1);
    else setRightKicks((value) => value + 1);

    setMessage(side === "left" ? "Clean left-foot kick." : "Clean right-foot kick.");
  };

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "a" || event.key === "ArrowLeft") kick("left");
      if (event.key.toLowerCase() === "d" || event.key === "ArrowRight") kick("right");
    };
    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const c = chaptehRef.current;

      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      bg.addColorStop(0, "#e7dfd1");
      bg.addColorStop(1, "#c9bea9");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = "#9d8f7c";
      ctx.fillRect(0, GROUND, WIDTH, HEIGHT - GROUND);

      ctx.strokeStyle = "rgba(89,75,58,0.16)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(WIDTH / 2, GROUND - 125);
      ctx.lineTo(WIDTH / 2, GROUND);
      ctx.stroke();

      ctx.fillStyle = "rgba(79,95,82,0.16)";
      ctx.fillRect(0, GROUND - 118, WIDTH / 2, 118);
      ctx.fillStyle = "rgba(134,83,71,0.14)";
      ctx.fillRect(WIDTH / 2, GROUND - 118, WIDTH / 2, 118);

      ctx.fillStyle = "#625749";
      ctx.font = "600 15px system-ui";
      ctx.fillText("LEFT FOOT", 26, GROUND - 24);
      ctx.fillText("RIGHT FOOT", WIDTH - 130, GROUND - 24);

      ctx.save();
      ctx.translate(c.x, c.y);

      ctx.strokeStyle = "#a94f41";
      ctx.lineWidth = 8;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 5, -4);
        ctx.quadraticCurveTo(i * 11, -40, i * 17, -70);
        ctx.stroke();
      }

      ctx.fillStyle = "#d6c493";
      ctx.beginPath();
      ctx.ellipse(0, 6, 18, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#514839";
      ctx.beginPath();
      ctx.ellipse(0, 13, 13, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      ctx.strokeStyle = "rgba(70,60,50,0.22)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(WIDTH / 2 - 92, GROUND + 12, 52, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(WIDTH / 2 + 92, GROUND + 12, 52, Math.PI, Math.PI * 2);
      ctx.stroke();
    };

    const frame = (time: number) => {
      const dt = Math.min((time - lastTimeRef.current) / 16.67, 2);
      lastTimeRef.current = time;

      if (runningRef.current) {
        const c = chaptehRef.current;
        c.vy += 0.34 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.vx *= 0.998;

        if (c.x < 28) {
          c.x = 28;
          c.vx = Math.abs(c.vx) * 0.75;
        }
        if (c.x > WIDTH - 28) {
          c.x = WIDTH - 28;
          c.vx = -Math.abs(c.vx) * 0.75;
        }

        if (c.y >= GROUND - 2) {
          c.y = GROUND - 2;
          stop(rally);
        }
      }

      draw();
      animationRef.current = requestAnimationFrame(frame);
    };

    animationRef.current = requestAnimationFrame(frame);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [rally]);

  const handleCanvasTap = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    kick(x < rect.width / 2 ? "left" : "right");
  };

  return (
    <section className="game-layout">
      <aside className="game-panel">
        <div className="panel-card">
          <p className="eyebrow">How to play</p>
          <h2>Keep it airborne</h2>
          <p>Kick only when the chapteh reaches the lower kick zone. Alternate sides as it moves.</p>
        </div>
        <div className="stat-grid">
          <div><span>Rally</span><strong>{rally}</strong></div>
          <div><span>Best</span><strong>{best}</strong></div>
          <div><span>Left kicks</span><strong>{leftKicks}</strong></div>
          <div><span>Right kicks</span><strong>{rightKicks}</strong></div>
        </div>
        <div className="panel-card compact">
          <span className="status-dot" />
          <p>{message}</p>
        </div>
        <button className="primary-button" onClick={start}>
          {running ? "Restart rally" : "Start rally"}
        </button>
      </aside>

      <div className="play-column">
        <div className="canvas-frame chapteh-frame">
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            onPointerDown={handleCanvasTap}
          />
        </div>
        <p className="control-hint">Keyboard: A / Left Arrow and D / Right Arrow. Touch: tap the matching half.</p>
      </div>
    </section>
  );
}
