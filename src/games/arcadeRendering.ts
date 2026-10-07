import type { CaromWorld } from "./caromPhysics";
import { ballVelocity, type CanWorld } from "./canPhysics";

export function drawCarom(ctx: CanvasRenderingContext2D, world: CaromWorld, strikerX: number, aim: { x: number; y: number; power: number } | null, ready: boolean, player: 0 | 1 = 0) {
  const baseline = player === 0 ? 480 : 120;
  ctx.clearRect(0, 0, 600, 600);
  ctx.fillStyle = "#82512e"; ctx.fillRect(0, 0, 600, 600);
  ctx.fillStyle = "#c89457"; ctx.fillRect(12, 12, 576, 576);
  ctx.fillStyle = "#ecd3a1"; ctx.fillRect(31, 31, 538, 538);
  ctx.strokeStyle = "#a76e3d"; ctx.lineWidth = 3;
  ctx.strokeRect(31, 31, 538, 538);
  ctx.beginPath(); ctx.arc(300, 300, 65, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(300, 300, 13, 0, Math.PI * 2); ctx.stroke();
  for (let side = 0; side < 4; side++) {
    ctx.save(); ctx.translate(300, 300); ctx.rotate(side * Math.PI / 2); ctx.translate(-300, -300);
    ctx.beginPath(); ctx.moveTo(110, 465); ctx.lineTo(490, 465); ctx.moveTo(110, 495); ctx.lineTo(490, 495); ctx.stroke();
    for (const x of [110, 490]) { ctx.beginPath(); ctx.arc(x, 480, 15, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  for (const [x, y] of [[31,31],[569,31],[31,569],[569,569]]) {
    ctx.fillStyle = "#59351f"; ctx.beginPath(); ctx.arc(x, y, 28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1e2724"; ctx.beginPath(); ctx.arc(x, y, 21, 0, Math.PI * 2); ctx.fill();
  }
  if (ready && !world.discs.some(d => d.id === 0)) {
    ctx.strokeStyle = "#276550"; ctx.lineWidth = 6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(115, baseline); ctx.lineTo(485, baseline); ctx.stroke();
    if (aim) {
      ctx.strokeStyle = "#276550"; ctx.lineWidth = 2; ctx.setLineDash([5, 7]);
      ctx.beginPath(); ctx.arc(strikerX, baseline, 85, player === 0 ? 0 : Math.PI, player === 0 ? Math.PI : Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#d8c49a"; ctx.fillRect(strikerX - 40, player === 0 ? 580 : 12, 80, 8);
      ctx.fillStyle = "#255a4a"; ctx.fillRect(strikerX - 40, player === 0 ? 580 : 12, 80 * aim.power, 8);
      ctx.strokeStyle = "#255a4a"; ctx.lineWidth = 4; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(strikerX, baseline); ctx.lineTo(strikerX + aim.x * (90 + aim.power * 170), baseline + aim.y * (90 + aim.power * 170)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#255a4a"; ctx.beginPath(); ctx.arc(strikerX + aim.x * 180, baseline + aim.y * 180, 6, 0, Math.PI * 2); ctx.fill();
    }
  }
  for (const disc of world.discs) {
    if (disc.pocketed) {
      if (disc.sink) {
        ctx.globalAlpha = disc.sink / .28; ctx.fillStyle = disc.id === 1 ? "#b63836" : "#e8d4ac";
        ctx.beginPath(); ctx.arc(disc.x, disc.y, disc.r * disc.sink / .28, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      }
      continue;
    }
    const striker = disc.id === 0;
    ctx.fillStyle = "#69442a"; ctx.beginPath(); ctx.arc(disc.x + 2, disc.y + 3, disc.r + 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = striker ? "#f5e9bf" : disc.id === 1 ? "#b63836" : disc.id % 2 === 0 ? "#f3e7d0" : "#323432";
    ctx.beginPath(); ctx.arc(disc.x, disc.y, disc.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = striker ? "#a96c37" : "#794b35"; ctx.lineWidth = striker ? 5 : 2;
    ctx.beginPath(); ctx.arc(disc.x, disc.y, disc.r - 3, 0, Math.PI * 2); ctx.stroke();
  }
  for (const flash of world.flashes) {
    ctx.strokeStyle = `rgba(255,255,230,${Math.min(.7, flash.life * 3)})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(flash.x, flash.y, 27 + (1 - flash.life / .28) * 7, 0, Math.PI * 2); ctx.stroke();
  }
  if (ready && !world.discs.some(d => d.id === 0)) {
    ctx.fillStyle = "#f5e9bf"; ctx.beginPath(); ctx.arc(strikerX, baseline, 20, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#9b6234"; ctx.lineWidth = 5; ctx.stroke();
  }
}

export function drawCans(ctx: CanvasRenderingContext2D, world: CanWorld, aim: { x: number; y: number; power: number } | null, ready: boolean) {
  ctx.clearRect(0, 0, 600, 620);
  ctx.fillStyle = "#c6dce0"; ctx.fillRect(0, 0, 600, 300);
  ctx.fillStyle = "#d9c59f"; ctx.fillRect(0, 300, 600, 320);
  ctx.fillStyle = "#796045"; ctx.fillRect(24, 405, 552, 16);
  ctx.fillStyle = "#ab8460"; ctx.fillRect(24, 421, 552, 20);
  for (const can of [...world.cans].sort((a, b) => a.y - b.y)) {
    ctx.save(); ctx.translate(can.x, can.y); ctx.rotate(can.angle);
    const fill = ctx.createLinearGradient(-26, 0, 26, 0);
    fill.addColorStop(0, "#759da1"); fill.addColorStop(.5, "#dce7df"); fill.addColorStop(1, "#71979a");
    ctx.fillStyle = fill; ctx.strokeStyle = "#40676c"; ctx.lineWidth = 3;
    ctx.fillRect(-26, -30, 52, 60); ctx.strokeRect(-26, -30, 52, 60);
    ctx.fillStyle = "#e8f0e8"; ctx.beginPath(); ctx.ellipse(0, -27, 23, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#28525a"; ctx.font = "bold 20px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(can.id), 0, 3);
    ctx.restore();
  }
  ctx.strokeStyle = "#6a7157"; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
  ctx.strokeRect(180, 480, 240, 120); ctx.setLineDash([]);
  if (world.ball) {
    const radius = 16;
    ctx.fillStyle = "#ad6746"; ctx.beginPath(); ctx.arc(world.ball.x, world.ball.y, Math.max(8, radius), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#6d3c2a"; ctx.lineWidth = 3; ctx.stroke();
  } else if (ready) {
    ctx.fillStyle = "#b96f48"; ctx.beginPath(); ctx.arc(300, 535, 22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#71402a"; ctx.lineWidth = 4; ctx.stroke();
    if (aim) {
      ctx.strokeStyle = "#255a4a"; ctx.lineWidth = 4; ctx.setLineDash([9, 7]);
      const velocity = ballVelocity(aim.x, aim.y, aim.power);
      ctx.beginPath(); ctx.moveTo(300, 535);
      for (let time = .03; time < .55; time += .03) ctx.lineTo(300 + velocity.vx * time, 535 + velocity.vy * time + 130 * time * time); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#255a4a"; ctx.beginPath(); ctx.arc(aim.x, aim.y, 7, 0, Math.PI * 2); ctx.fill();
    }
  }
}
