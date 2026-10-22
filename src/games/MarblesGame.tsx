import { t, useLanguage } from "../i18n";
import GamePlayArea from "../components/GamePlayArea";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, Timer, TimerOff } from "lucide-react";

import DifficultyPicker from "../components/DifficultyPicker";
import InstructionSteps from "../components/InstructionSteps";
import PlayerScoreboard from "../components/PlayerScoreboard";
import { difficultySettings, type Difficulty, randomMarblePositions, seededRandom } from "./mechanics";
import {drawMarblesBoard} from "./marblesRendering";
import "./marbles.css";
import type { CompetitionGameProps } from "../types";
import { MARBLE_COLOURS, MARBLE_STYLE, createMarbleShot, resolveMarbleTurn, positionMarbleOnLine, marbleCanvasPoint, marblePullVelocity, predictMarbleContact, type MarbleColour, advanceMarbles, returnShooterToStart, type Marble, MARBLES_LAUNCH, MARBLES_MAX_PULL, MARBLES_WIDTH as WIDTH, MARBLES_HEIGHT as HEIGHT, MARBLES_RING as RING } from "./marblesPhysics";

type Player = 0 | 1;

const PLAYER_COLORS = ["#2d6d79", "#a84f3e"] as const;
const TURN_SECONDS = 30;
const COMPETITION_TURN_SECONDS = 45;

export function createMarbles(difficulty: Difficulty, seed?: number, colour?: string): Marble[] {
  const targets: Marble[] = [];

  const positions = randomMarblePositions(seed === undefined ? Math.random : seededRandom(seed), difficulty);

  for (let i = 0; i < positions.length; i++) {
    targets.push({
      id: i,
      x: RING.x + positions[i].x,
      y: RING.y + positions[i].y,
      vx: 0,
      vy: 0,
      radius: difficultySettings[difficulty].marbleRadius,
      target: true,
      captured: false,
      color: MARBLE_STYLE[MARBLE_COLOURS[i % 4]].color,
      group: MARBLE_COLOURS[i % 4],
    });
  }

  return [
    ...targets,
    {
      id: 100,
      x: RING.x,
      y: MARBLES_LAUNCH.y,
      vx: 0,
      vy: 0,
      radius: 20,
      target: false,
      captured: false,
      color: colour ?? PLAYER_COLORS[0],
    },
  ];
}

export default function MarblesGame({ playerNames, competitionMode = false, onComplete, individualAttempt, fixedDifficulty, playerColours }: CompetitionGameProps = {}) {
  useLanguage();
  const [difficulty, setDifficulty] = useState<Difficulty>(fixedDifficulty ?? "easy");
  const [difficultyLocked, setDifficultyLocked] = useState(false);
  const settings = difficultySettings[difficulty];

  return (
    <>
      <DifficultyPicker
        value={difficulty}
        onChange={setDifficulty}
        disabled={Boolean(fixedDifficulty) || difficultyLocked}
        description={individualAttempt ? t("{0} shots. Knock marbles out of the ring.", individualAttempt.shots) : t("{0} targets. {1} and {2} alternate after every shot. Highest score wins when the ring is empty.", settings.marbles, playerNames?.[0] ?? t("Player 1"), playerNames?.[1] ?? t("Player 2"))}
      />
      <MarblesRound individualAttempt={individualAttempt} playerColours={playerColours} difficulty={difficulty} playerNames={playerNames} competitionMode={competitionMode} onComplete={onComplete} onRoundStart={() => setDifficultyLocked(true)} onNewMatch={() => setDifficultyLocked(false)} onDifficultyChange={setDifficulty} canChangeDifficulty={!fixedDifficulty && !difficultyLocked} />
    </>
  );
}

function MarblesRound({ difficulty, playerNames, competitionMode = false, onComplete, individualAttempt, playerColours, onRoundStart, onNewMatch, onDifficultyChange, canChangeDifficulty }: { difficulty: Difficulty; onNewMatch: () => void; onRoundStart: () => void; onDifficultyChange: (difficulty: Difficulty) => void; canChangeDifficulty: boolean } & CompetitionGameProps) {
  useLanguage();
  const PLAYER_COLORS = playerColours ?? ["#2d6d79", "#a84f3e"];
  const targetCount = difficultySettings[difficulty].marbles;
  const turnSeconds = competitionMode ? COMPETITION_TURN_SECONDS : TURN_SECONDS;
  const playerLabel = (player: Player) => playerNames?.[player] ?? t("Player {0}", player + 1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [initialMarbles] = useState(()=>createMarbles(difficulty, individualAttempt?.seed, playerColours?.[0]));
  const marblesRef = useRef<Marble[]>(initialMarbles);
  const shotRef = useRef(createMarbleShot());
  const targetRef = useRef<MarbleColour | undefined>("Red");
  const [target, setTarget] = useState<MarbleColour | undefined>("Red");
  const draggingRef = useRef(false);
  const movingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const pointerRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number | null>(null);
  const activePlayerRef = useRef<Player>(0);
  const scoresRef = useRef<[number, number]>([0, 0]);
  const capturesRef = useRef<[number, number]>([0, 0]);
  const shotsRef = useRef<[number, number]>([0, 0]);
  const totalCapturedRef = useRef(0);
  const gameOverRef = useRef(false);
  const pausedRef = useRef(false);
  const awaitingReadyRef = useRef(!individualAttempt);
  const dragPointerRef = useRef<number | null>(null);
  const aimRef = useRef(-90);
  const captureFeedbackTimerRef = useRef<number | null>(null);
  const reportedRef = useRef(false);
  const previousDifficultyRef = useRef(difficulty);

  const [activePlayer, setActivePlayer] = useState<Player>(0);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [captures, setCaptures] = useState<[number, number]>([0, 0]);
  const [shots, setShots] = useState<[number, number]>([0, 0]);
  const [message, setMessage] = useState(() => () => t("{0} starts. Drag the shooter backwards and release.", playerLabel(0)));
  const [moving, setMoving] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timeLeft, setTimeLeft] = useState(turnSeconds);
  const [paused, setPaused] = useState(false);
  const [awaitingReady, setAwaitingReady] = useState(!individualAttempt);
  const [captureFeedback, setCaptureFeedback] = useState<{ id: number; text: () => string; player: Player } | null>(null);
  const [positioning, setPositioning] = useState(false);
  const positioningRef = useRef(false);
  const [keyboardAim, setKeyboardAim] = useState(-90);
  const [keyboardPower, setKeyboardPower] = useState(75);
  const powerRef = useRef(keyboardPower); powerRef.current = keyboardPower;
  const guideCache = useRef({ key:'', value:predictMarbleContact([],0,0) });
  const [aimFeedback,setAimFeedback]=useState({id:-1,colour:'',power:75});
  const gestureRef=useRef<{mode:'aim'|'position';clientX:number;clientY:number;dx:number;dy:number}|null>(null);
  const [showIntro,setShowIntro]=useState(()=>{try{return localStorage.getItem('heritage-marbles-guide-seen')!=='true';}catch{return true;}});
  aimRef.current = keyboardAim;

  const cancelGesture = () => {
    const id=dragPointerRef.current;dragPointerRef.current=null;draggingRef.current=false;gestureRef.current=null;
    if(id!==null&&canvasRef.current?.hasPointerCapture(id))canvasRef.current.releasePointerCapture(id);
  };
  const waitForPlayer = (requireReady = !individualAttempt) => {
    cancelGesture();
    positioningRef.current = false; setPositioning(false);
    awaitingReadyRef.current = requireReady;
    setAwaitingReady(requireReady);
    draggingRef.current = false;
    dragPointerRef.current = null;
  };

  const beginTurn = () => {
    setShowIntro(false);try{localStorage.setItem('heritage-marbles-guide-seen','true');}catch{/* Session guidance still works. */}
    onRoundStart();
    awaitingReadyRef.current = false;
    setAwaitingReady(false);
    setTimeLeft(turnSeconds);
    setMessage(() => () => t("{0}: drag back and release to shoot.", playerLabel(activePlayerRef.current)));
  };

  useEffect(() => {
    const cancelDrag = cancelGesture;
    // A resize changes display scale only. Incremental client deltas keep a captured aim stable.
    window.addEventListener("blur", cancelDrag);
    const onVisibilityChange = () => {
      if (!document.hidden || gameOverRef.current || awaitingReadyRef.current) return;
      pausedRef.current = true;
      cancelGesture();
      setPaused(true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { document.removeEventListener("visibilitychange", onVisibilityChange); window.removeEventListener("blur", cancelDrag); };
  }, []);

  useEffect(() => {
    if (!gameOver || reportedRef.current || !onComplete) return;
    reportedRef.current = true;
    onComplete({ scores });
  }, [gameOver, onComplete, scores]);

  const syncPlayer = (player: Player) => {
    activePlayerRef.current = player;
    setActivePlayer(player);
    const shooter = marblesRef.current.find((marble) => !marble.target);
    if (shooter) shooter.color = PLAYER_COLORS[player];
  };

  const reset = () => {
    onNewMatch();
    if (captureFeedbackTimerRef.current !== null) window.clearTimeout(captureFeedbackTimerRef.current);
    captureFeedbackTimerRef.current = null;
    marblesRef.current = createMarbles(difficulty, individualAttempt?.seed, playerColours?.[0]);
    guideCache.current.key="";
    draggingRef.current = false;
    movingRef.current = false;
    scoresRef.current = [0, 0];
    capturesRef.current = [0, 0];
    shotsRef.current = [0, 0];
    totalCapturedRef.current = 0;
    gameOverRef.current = false;
    reportedRef.current = false;
    pausedRef.current = false;
    shotRef.current = createMarbleShot(); targetRef.current = "Red"; setTarget("Red");
    waitForPlayer();
    setScores([0, 0]);
    setCaptures([0, 0]);
    setShots([0, 0]);
    setGameOver(false);
    setMoving(false);
    setPaused(false);
    setTimeLeft(turnSeconds);
    setCaptureFeedback(null);
    setKeyboardAim(-90);
    setKeyboardPower(75);
    syncPlayer(0);
    setMessage(() => () => t("{0} starts. Drag the shooter backwards and release.", playerLabel(0)));
  };

  useEffect(() => {
    if (previousDifficultyRef.current === difficulty) return;
    previousDifficultyRef.current = difficulty;
    reset();
  }, [difficulty]);

  const switchTurnOnTimeout = () => {
    if (gameOverRef.current || movingRef.current || pausedRef.current || awaitingReadyRef.current) return;
    if (individualAttempt) { gameOverRef.current = true; setGameOver(true); return; }
    const current = activePlayerRef.current;
    const next = (current === 0 ? 1 : 0) as Player;
    draggingRef.current = false;
    syncPlayer(next);
    returnShooterToStart(marblesRef.current);
    setKeyboardAim(-90);
    waitForPlayer();
    setTimeLeft(turnSeconds);
    setMessage(() => () => t("{0} ran out of time. Pass to {1}.", playerLabel(current), playerLabel(next)));
  };

  useEffect(() => {
    setTimeLeft(turnSeconds);
  }, [activePlayer]);

  useEffect(() => {
    if (!timerEnabled || gameOver || moving || paused || awaitingReady || timeLeft <= 0) return;
    const timer = window.setTimeout(() => setTimeLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [timerEnabled, gameOver, moving, paused, awaitingReady, timeLeft]);

  useEffect(() => {
    if (timerEnabled && !gameOver && !moving && !paused && !awaitingReady && timeLeft === 0) switchTurnOnTimeout();
  }, [timerEnabled, gameOver, moving, paused, awaitingReady, timeLeft]);

  const toggleTimer = (enabled: boolean) => {
    if (competitionMode) return;
    setTimerEnabled(enabled);
    setTimeLeft(turnSeconds);
    if (!enabled) {
      pausedRef.current = false;
      setPaused(false);
    }
  };

  const togglePause = (nextPaused: boolean) => {
    if (gameOverRef.current || awaitingReadyRef.current) return;
    pausedRef.current = nextPaused;
    setPaused(nextPaused);
    cancelGesture();
    setMessage(() => () => nextPaused
        ? t("Game paused. {0} keeps the turn with {1} seconds remaining.", playerLabel(activePlayerRef.current), timeLeft)
        : t("{0} resumes with {1} seconds remaining.", playerLabel(activePlayerRef.current), timeLeft));
  };

  const getCanvasPoint = (event: PointerEvent | React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return marbleCanvasPoint(event.clientX,event.clientY,rect);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(WIDTH * pixelRatio);
    canvas.height = Math.round(HEIGHT * pixelRatio);
    canvas.style.aspectRatio = `${WIDTH} / ${HEIGHT}`;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const draw = () => {
      const board=marblesRef.current,shooter=board.find(m=>!m.target)!;
      const pull=pointerRef.current;
      const velocity=draggingRef.current && !positioningRef.current ? marblePullVelocity(pull.x-shooter.x,pull.y-shooter.y) : {x:Math.cos(aimRef.current*Math.PI/180)*16.2*powerRef.current/100,y:Math.sin(aimRef.current*Math.PI/180)*16.2*powerRef.current/100,power:powerRef.current/100};
      if(!movingRef.current) {
        const key=`${shooter.x}:${shooter.y}:${velocity.x}:${velocity.y}:${shotsRef.current.join()}:${totalCapturedRef.current}:${targetRef.current}`;
        if(guideCache.current.key!==key) {
          const prediction=predictMarbleContact(board,velocity.x,velocity.y);
          guideCache.current={key,value:prediction};
          const feedback={id:prediction.contact?.id??-1,colour:prediction.contact?.colour??'',power:Math.round(velocity.power*100)};
          setAimFeedback(previous=>previous.id===feedback.id&&previous.colour===feedback.colour&&previous.power===feedback.power?previous:feedback);
        }
      }
      drawMarblesBoard(ctx,board,{player:activePlayerRef.current,colour:PLAYER_COLORS[activePlayerRef.current],target:targetRef.current,positioning:positioningRef.current,moving:movingRef.current,ready:!awaitingReadyRef.current&&!gameOverRef.current,difficulty,pull:draggingRef.current?pull:undefined,power:velocity.power,prediction:guideCache.current.value});
    };

    const finishTurn = () => {
      movingRef.current = false;
      setMoving(false);

      const shot = shotRef.current;
      const player = activePlayerRef.current;
      const result = resolveMarbleTurn(shot, targetRef.current, marblesRef.current, player, Boolean(individualAttempt), shotsRef.current[0], individualAttempt?.shots);
      if (!result) return;
      totalCapturedRef.current += shot.captured.length;
      capturesRef.current[player] += shot.captured.length;
      scoresRef.current[player] += result.points;
      setCaptures([...capturesRef.current]); setScores([...scoresRef.current]);
      const shotTarget = targetRef.current;
      const firstColour = shot.first?.colour;
      const summary=()=>result.points>0 ? t("Correct hit! {0} {1} captured. +{2} points.",result.count,shotTarget?t(shotTarget):'',result.points) : !firstColour ? t("No contact. 0 points.") : firstColour!==shotTarget ? t("{0} hit first. Target {1}. 0 points.",t(firstColour),shotTarget?t(shotTarget):'') : t("Correct first hit. No {0} captured. 0 points.",shotTarget?t(shotTarget):'');
      setMessage(()=>summary);
      setCaptureFeedback({id:Date.now(),player,text:summary});
      if (captureFeedbackTimerRef.current !== null) window.clearTimeout(captureFeedbackTimerRef.current);
      captureFeedbackTimerRef.current = window.setTimeout(() => setCaptureFeedback(null), 1800);
      targetRef.current = result.nextTarget;
      setTarget(targetRef.current);

      if (result.finished) {
        gameOverRef.current = true;
        setGameOver(true);
        const [firstScore, secondScore] = scoresRef.current;
        if (individualAttempt) {
          setMessage(() => () => t("Attempt complete. {0} points.", firstScore));
        } else if (firstScore === secondScore) {
          setMessage(() => () => t("All marbles are out. It's a draw at {0} points each.", firstScore));
        } else {
          const winner: Player = firstScore > secondScore ? 0 : 1;
          setMessage(() => () => t("All marbles are out. {0} wins the match.", playerLabel(winner)));
        }
        return;
      }

      const next = result.nextPlayer;
      syncPlayer(next);
      returnShooterToStart(marblesRef.current);
      setKeyboardAim(-90);
      waitForPlayer(true);
      setTimeLeft(turnSeconds);
    };

    const update = (dt: number) => {
      if (pausedRef.current || awaitingReadyRef.current || !movingRef.current || document.hidden) return;
      const result = advanceMarbles(marblesRef.current, dt, shotRef.current);
      if (!result.moving) finishTurn();
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
      if (captureFeedbackTimerRef.current !== null) window.clearTimeout(captureFeedbackTimerRef.current);
    };
  }, [targetCount, difficulty]);

  const takeShot = (vx: number, vy: number) => {
    if (movingRef.current || gameOverRef.current || pausedRef.current || awaitingReadyRef.current || document.hidden || positioningRef.current || !Number.isFinite(vx + vy) || Math.hypot(vx, vy) < .1) return;
    const shooter = marblesRef.current.find((marble) => !marble.target);
    if (!shooter) return;

    onRoundStart(); cancelGesture();
    shotRef.current = createMarbleShot(targetRef.current);
    shooter.vx = vx;
    shooter.vy = vy;
    const nextShots: [number, number] = [...shotsRef.current] as [number, number];
    nextShots[activePlayerRef.current] += 1;
    shotsRef.current = nextShots;
    setShots(nextShots);
    draggingRef.current = false;
    dragPointerRef.current = null;
    movingRef.current = true;
    setMoving(true);
    setMessage(() => () => t("{0}'s shot is rolling...", playerLabel(activePlayerRef.current)));
  };

  const togglePositioning = () => {
    cancelGesture(); positioningRef.current=!positioningRef.current;setPositioning(positioningRef.current);
    const placing=positioningRef.current;
    setMessage(()=>()=>t(placing?'Slide left or right on the launch line, then press Done positioning.':'Pull back to aim and release'));
  };
  const placeShooter = (x:number) => {
    if(movingRef.current||pausedRef.current||awaitingReadyRef.current||gameOverRef.current||document.hidden)return;
    if(!positionMarbleOnLine(marblesRef.current,x))return;
    const shooter=marblesRef.current.find(m=>!m.target)!;
    setKeyboardAim(Math.round(Math.atan2(RING.y-shooter.y,RING.x-shooter.x)*180/Math.PI));
  };
  const nudgeShooter = (dx:number) => {const shooter=marblesRef.current.find(m=>!m.target);if(shooter)placeShooter(shooter.x+dx);};
  const onPointerDown = (event:React.PointerEvent<HTMLCanvasElement>) => {
    if(dragPointerRef.current!==null||movingRef.current||pausedRef.current||awaitingReadyRef.current||gameOverRef.current||document.hidden||!event.isPrimary||event.button!==0)return;
    event.preventDefault();const point=getCanvasPoint(event),shooter=marblesRef.current.find(m=>!m.target)!;
    const rect=event.currentTarget.getBoundingClientRect();
    const radius=Math.max(shooter.radius+20,(event.pointerType==='mouse'?18:difficulty==='easy'?28:difficulty==='medium'?24:20)*WIDTH/rect.width);
    let mode:'position'|'aim'='aim';
    if(positioningRef.current || (Math.abs(point.y-MARBLES_LAUNCH.y)<30 && Math.abs(point.x-shooter.x)>radius)) {
      mode='position';positioningRef.current=true;setPositioning(true);placeShooter(point.x);
    } else if(Math.hypot(point.x-shooter.x,point.y-shooter.y)>radius) {
      setKeyboardAim(Math.round(Math.atan2(point.y-shooter.y,point.x-shooter.x)*180/Math.PI));return;
    }
    draggingRef.current=true;dragPointerRef.current=event.pointerId;
    gestureRef.current={mode,clientX:event.clientX,clientY:event.clientY,dx:0,dy:0};
    dragStartRef.current={x:shooter.x,y:shooter.y};pointerRef.current={x:shooter.x,y:shooter.y};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event:React.PointerEvent<HTMLCanvasElement>) => {
    const gesture=gestureRef.current;
    if(!gesture||!draggingRef.current||pausedRef.current||dragPointerRef.current!==event.pointerId)return;
    const rect=event.currentTarget.getBoundingClientRect();
    const deltaX=(event.clientX-gesture.clientX)*WIDTH/rect.width;
    gesture.dx+=deltaX;gesture.dy+=(event.clientY-gesture.clientY)*HEIGHT/rect.height;
    gesture.clientX=event.clientX;gesture.clientY=event.clientY;
    if(gesture.mode==='position'){const shooter=marblesRef.current.find(m=>!m.target)!;placeShooter(shooter.x+deltaX);return;}
    const scale=Math.min(1,MARBLES_MAX_PULL/(Math.hypot(gesture.dx,gesture.dy)||1));
    pointerRef.current={x:dragStartRef.current.x+gesture.dx*scale,y:dragStartRef.current.y+gesture.dy*scale};
  };
  const onPointerUp = (event:React.PointerEvent<HTMLCanvasElement>) => {
    if(dragPointerRef.current!==event.pointerId||pausedRef.current)return;
    onPointerMove(event);const gesture=gestureRef.current;cancelGesture();
    if(!gesture||gesture.mode==='position')return;
    if(Math.hypot(gesture.dx,gesture.dy)<12){setMessage(()=>()=>t('Pull farther back before releasing.'));return;}
    const velocity=marblePullVelocity(gesture.dx,gesture.dy);takeShot(velocity.x,velocity.y);
  };

  const shootWithControls = () => {
    const radians = keyboardAim * Math.PI / 180;
    const speed = 16.2 * keyboardPower / 100;
    takeShot(Math.cos(radians) * speed, Math.sin(radians) * speed);
  };

  const onCanvasKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)) event.preventDefault();
    if (movingRef.current || pausedRef.current || gameOverRef.current || awaitingReadyRef.current) return;
    if (positioningRef.current) {
      if (event.key === "ArrowLeft") nudgeShooter(-15);
      if (event.key === "ArrowRight") nudgeShooter(15);
      if (event.key === "Enter" || event.key === "Escape") { event.preventDefault(); togglePositioning(); }
      return;
    }
    if (event.key === "ArrowLeft") setKeyboardAim((value) => Math.max(-180, value - 5));
    if (event.key === "ArrowRight") setKeyboardAim((value) => Math.min(180, value + 5));
    if (event.key === "ArrowUp") setKeyboardPower((value) => Math.min(100, value + 5));
    if (event.key === "ArrowDown") setKeyboardPower((value) => Math.max(20, value - 5));
    if (event.key === " " && !event.repeat) shootWithControls();
  };

  const totalCaptured = captures[0] + captures[1];
  const remaining = targetCount - totalCaptured;
  const shotDetails: [string, string] = [
    t("{0} shots · {1} captured", shots[0], captures[0]),
    t("{0} shots · {1} captured", shots[1], captures[1]),
  ];

  return (
    <section className="game-layout multiplayer-layout marbles-layout">
      <details className="game-panel marbles-help">
        <summary>{t("How to play")}</summary>
        <InstructionSteps
          title={t("Knock marbles out of the ring")}
          objective={individualAttempt ? t("Six shots to knock marbles out. The same layout and level for everyone.") : t("Hit the target colour first, then knock it outside the ring.")}
          steps={[
            individualAttempt ? t("Drag back and release to shoot.") : t("Press I am ready. Drag back and release to shoot."),
            t("Move the shooter left or right along the launch line. Then pull back and release."),
            t("Hit the target colour first. Capture 1 for 100, 2 for 250, 3 for 450; each extra adds 200."),
            individualAttempt ? t("45 seconds per shot. Running out of time ends your attempt.") : t("Take one shot each, then pass the device. The next player starts the timer when ready."),
          ]}
          tip={individualAttempt ? t("Controlled shots are often easier than full power") : t("Blue swirl marble = {0}. Red cross marble = {1}. Controlled shots often work better than maximum power.", playerLabel(0), playerLabel(1))}
        />



      </details>

      <GamePlayArea className={`marbles-play-area marble-redesign ${awaitingReady ? "is-ready" : ""} ${shots[0] + shots[1] > 0 ? "has-result" : ""}`} aspectRatio={WIDTH/HEIGHT}>
        <div className="marble-hud">
        <PlayerScoreboard individual={Boolean(individualAttempt)} colours={playerColours}
          activePlayer={activePlayer}
          scores={scores}
          labels={playerNames}
          gameOver={gameOver}
          paused={paused}
          pausedBy={paused ? activePlayer : null}
          secondary={shotDetails}
        />
        <div className="marble-target-card">
          <strong className="marble-target" aria-label={t("Target: {0}",target?t(target):t('Complete'))}><span className="target-marble" style={{background:target?MARBLE_STYLE[target].color:'#555'}}>{target?MARBLE_STYLE[target].symbol:'✓'}</span>{t("Target: {0}",target?t(target):t('Complete'))}</strong>
          <p>{target ? t('Hit {0} first, then knock it outside the ring.',t(target)) : t('Match complete')}</p>
        </div>
        <div className="marble-info-row">
          <strong>{gameOver?t('Match complete'):t("{0}'s Turn",playerLabel(activePlayer))}</strong>
          <span>{t('{0} Targets Left',remaining)}</span>
          <span className="timer-inline">{awaitingReady?t('Ready'):paused?t('Paused'):moving?t('Shot rolling'):timerEnabled?t('{0}s Remaining',timeLeft):t('Timer off')}</span>
        </div>
        <p hidden={awaitingReady} className={`marble-aim-feedback ${!gameOver&&difficulty==='easy'&&aimFeedback.colour?(aimFeedback.colour===target?'is-correct':'is-wrong'):''}`} aria-live="polite">{gameOver?t('Match complete'):moving?t('Wait for the marbles to settle'):positioning?t('Slide along the launch line'):difficulty==='difficult'?t('Direction and power'):aimFeedback.colour?(difficulty==='easy'?t(aimFeedback.colour===target?'Correct Target':'Wrong Colour')+' · ':'')+t('First: {0}',t(aimFeedback.colour)):t('No marble on this path')} {!gameOver&&<span>{t('Power {0}%',aimFeedback.power)}</span>}</p>
        </div>
        <div hidden={awaitingReady} className="mobile-game-toolbar" aria-label={t("Mobile turn controls")}>
          <button
            type="button"
            className="mobile-game-control"
            aria-label={t(paused ? "Resume" : "Pause")} title={t(paused ? "Resume" : "Pause")}
            disabled={awaitingReady || gameOver}
            onClick={() => togglePause(!paused)}
          >
            {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
            <span>{paused ? t("Resume") : t("Pause")}</span>
          </button>
          <button
            type="button"
            className="mobile-game-control secondary"
            aria-label={t("Turn timer")} title={t("Turn timer")} aria-pressed={timerEnabled}
            disabled={gameOver || competitionMode}
            onClick={() => toggleTimer(!timerEnabled)}
          >
            {timerEnabled ? <Timer size={15} aria-hidden="true" /> : <TimerOff size={15} aria-hidden="true" />}
            <span>{t("Timer")} {t(timerEnabled ? "on" : "off")}</span>
          </button>

          <details className="shot-adjustments"><summary>{t("Adjust shot")}</summary><div className="shot-adjustment-fields">
          <label>
            <span>{t("Shot direction")} <strong>{keyboardAim}°</strong></span>
            <input disabled={moving||paused||gameOver||awaitingReady} aria-label={t("Shot direction")} type="range" min={-180} max={180} step={1} value={keyboardAim} onChange={(event) => setKeyboardAim(Number(event.target.value))} />
          </label>
          <label>
            <span>{t("Power")} <strong>{keyboardPower}%</strong></span>
            <input disabled={moving||paused||gameOver||awaitingReady} aria-label={t("Power")} type="range" min={20} max={100} step={5} value={keyboardPower} onChange={(event) => setKeyboardPower(Number(event.target.value))} />
          </label>
          </div></details>

        </div>

        <div className={`canvas-frame active-play-frame pauseable-play-area ${paused ? "is-paused" : ""}`} style={{ borderColor: PLAYER_COLORS[activePlayer] }}>
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={cancelGesture}
            onLostPointerCapture={() => { if(dragPointerRef.current!==null)cancelGesture(); }}
            onKeyDown={onCanvasKeyDown}
            tabIndex={awaitingReady || paused || gameOver ? -1 : 0}
            aria-label={positioning ? t("Marbles positioning. Left/right arrows move the shooter; Enter finishes positioning.") : t("Marbles ring. Tap to aim, then use Shoot marble. Keyboard: arrows to aim and set power, Space to shoot.")}
          />
          {awaitingReady ? <div className="game-paused-overlay turn-ready-overlay">
            <div className="marble-ready-card">
            <span className="marble-ready-player">{playerLabel(activePlayer)}</span>
            <strong className="marble-ready-title">{t('Ready to Play?')}</strong>
            <p>{t('Pass the device to {0}.',playerLabel(activePlayer))}</p>
            <p>{t('Your timer starts when you press Ready.')}</p>
            {showIntro && <p className="marble-ready-tip">{t('Drag back and release to shoot.')}</p>}
            {canChangeDifficulty && shots[0] + shots[1] === 0 && <div className="ready-level-picker" role="group" aria-label={t("Choose your level")}>
              {(Object.keys(difficultySettings) as Difficulty[]).map(level => <button key={level} type="button" className={difficulty === level ? "is-selected" : ""} aria-pressed={difficulty === level} onClick={() => onDifficultyChange(level)}>{t(difficultySettings[level].label)}</button>)}
            </div>}
            <button type="button" className="primary-button" onClick={beginTurn}>{t("I am ready")}</button>
            </div>
          </div> : null}
          {paused ? <div className="game-paused-overlay"><strong>{t("Paused")}</strong><span>{t("{0} keeps this turn", playerLabel(activePlayer))}</span><button type="button" className="primary-button" onClick={() => togglePause(false)}>{t("Resume turn")}</button></div> : null}
        </div>

        <fieldset hidden={awaitingReady} className="marble-shot-controls" disabled={moving || paused || gameOver || awaitingReady}>
          <legend className="sr-only">{t('Aim, then shoot')}</legend>
          <div className="marble-launch-actions" role="group" aria-label={t('Move shooter')}>
            <button type="button" className="secondary-button" aria-label={t('Move shooter left')} onClick={()=>nudgeShooter(-20)}>{t('Left')}</button>
            <button type="button" className="secondary-button marble-position-toggle" aria-pressed={positioning} onClick={togglePositioning}>{t(positioning?'Done positioning':'Move shooter')}</button>
            <button type="button" className="secondary-button" aria-label={t('Move shooter right')} onClick={()=>nudgeShooter(20)}>{t('Right')}</button>
          </div>
          <div className="marble-fire-actions">
          <button type="button" className="primary-button" disabled={positioning} onClick={shootWithControls}>{moving ? t("Shot rolling") : t("Shoot marble")}</button>
          </div>
        </fieldset>
        <p hidden={shots[0] + shots[1] === 0 && !gameOver} className="marble-result" role="status">{captureFeedback?.text()??message()}</p>

        {!competitionMode && <details className="marble-match-menu"><summary>{t('Match options')}</summary><button type="button" className="secondary-button" onClick={event=>{event.currentTarget.closest("details")?.removeAttribute("open");reset();}}>{t('New match')}</button></details>}
        <p className="control-hint">{individualAttempt ? t("Drag back and release to shoot.") : <>{t("Drag backwards and release, or focus the board and use Arrow keys plus Space. Blue swirl marble is")} {playerLabel(0)} {t("and red cross marble is")} {playerLabel(1)}.</>}</p>
      </GamePlayArea>
    </section>
  );
}
