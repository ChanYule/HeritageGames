export type Marble = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  target: boolean;
  captured: boolean;
  color: string;
  group?: MarbleColour;
};

export const MARBLES_WIDTH = 900;
export const MARBLES_HEIGHT = 900;
export const MARBLES_RING = { x: MARBLES_WIDTH / 2, y: 330, radius: 270 };

export const MARBLES_LAUNCH = { x: MARBLES_WIDTH / 2, y: 720 };
export const MARBLES_MAX_PULL = 140;

export function placeMarbleShooter(marbles: Marble[], x: number, y: number) {
  const shooter = marbles.find(m => !m.target);
  if (!shooter || !Number.isFinite(x + y) || marbles.some(m => !m.captured && Math.hypot(m.vx, m.vy) > 0)) return false;
  const margin = shooter.radius + MARBLES_MAX_PULL;
  if (x < margin || x > MARBLES_WIDTH - margin || y < margin || y > MARBLES_HEIGHT - margin) return false;
  if (Math.hypot(x - MARBLES_RING.x, y - MARBLES_RING.y) < MARBLES_RING.radius + shooter.radius + 8) return false;
  if (marbles.some(m => m.target && !m.captured && Math.hypot(x - m.x, y - m.y) < shooter.radius + m.radius + 4)) return false;
  shooter.x = x; shooter.y = y;
  return true;
}

export function returnShooterToStart(marbles: Marble[]) {
  const shooter = marbles.find((marble) => !marble.target);
  if (!shooter) return;
  shooter.x = MARBLES_RING.x;
  // A target still touching the ring cannot overlap this starting position.
  shooter.y = MARBLES_LAUNCH.y;
  shooter.vx = 0;
  shooter.vy = 0;
}

/** Advance one fixed physics step, banking targets as soon as they leave the ring. */
function advanceSubstep(marbles: Marble[], dt: number, shot?: MarbleShot) {
  let captured = 0;
  const captureOutside = (marble: Marble) => {
    if (!marble.target || marble.captured) return;
    if (Math.hypot(marble.x - MARBLES_RING.x, marble.y - MARBLES_RING.y) - marble.radius <= MARBLES_RING.radius) return;
    marble.captured = true;
    marble.vx = 0;
    marble.vy = 0;
    captured += 1;
    if (shot && !shot.captured.some(item => item.id === marble.id)) shot.captured.push({ id: marble.id, colour: marble.group });
  };

  const starts = new Map(marbles.map(m => [m.id, { x: m.x, y: m.y }]));
  for (const marble of marbles) {
    if (marble.captured) continue;
    marble.x += marble.vx * dt;
    marble.y += marble.vy * dt;
    marble.vx *= Math.pow(0.985, dt);
    marble.vy *= Math.pow(0.985, dt);
    captureOutside(marble);
    if (marble.captured) continue;

    if (marble.x - marble.radius < 0) {
      marble.x = marble.radius;
      marble.vx = Math.abs(marble.vx) * 0.65;
    } else if (marble.x + marble.radius > MARBLES_WIDTH) {
      marble.x = MARBLES_WIDTH - marble.radius;
      marble.vx = -Math.abs(marble.vx) * 0.65;
    }
    if (marble.y - marble.radius < 0) {
      marble.y = marble.radius;
      marble.vy = Math.abs(marble.vy) * 0.65;
    } else if (marble.y + marble.radius > MARBLES_HEIGHT) {
      marble.y = MARBLES_HEIGHT - marble.radius;
      marble.vy = -Math.abs(marble.vy) * 0.65;
    }
  }

  // Resolve actual overlapping contacts in swept entry-time order. The first-hit
  // event is emitted only when this solver transfers an approaching impulse.
  const entryTime = (a: Marble, b: Marble) => {
    const oldA = starts.get(a.id)!, oldB = starts.get(b.id)!;
    const px = oldB.x - oldA.x, py = oldB.y - oldA.y;
    const dx = (b.x - oldB.x) - (a.x - oldA.x), dy = (b.y - oldB.y) - (a.y - oldA.y);
    const radius = a.radius + b.radius, aa = dx * dx + dy * dy;
    const bb = 2 * (px * dx + py * dy), cc = px * px + py * py - radius * radius;
    const disc = bb * bb - 4 * aa * cc;
    return cc <= 0 || aa === 0 || disc < 0 ? 0 : Math.max(0, (-bb - Math.sqrt(disc)) / (2 * aa));
  };
  const pairs: { a: Marble; b: Marble; time: number }[] = [];
  for (let i = 0; i < marbles.length; i++) for (let j = i + 1; j < marbles.length; j++) {
    const a = marbles[i], b = marbles[j]; pairs.push({ a, b, time: entryTime(a, b) });
  }
  pairs.sort((p, q) => p.time - q.time || Math.min(p.a.id, p.b.id) - Math.min(q.a.id, q.b.id) || Math.max(p.a.id, p.b.id) - Math.max(q.a.id, q.b.id));
  for (let pass = 0; pass < 4; pass++) {
    for (const { a, b } of pairs) {
      if (a.captured || b.captured) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      const minDistance = a.radius + b.radius;
      if (distance >= minDistance) continue;
      const nx = distance === 0 ? 1 : dx / distance;
      const ny = distance === 0 ? 0 : dy / distance;
      const overlap = minDistance - distance;
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;

      const speedAlongNormal = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (speedAlongNormal < 0) {
        if (shot && a.target !== b.target) {
          const target = a.target ? a : b;
          if (!shot.contacts.some(item => item.id === target.id)) shot.contacts.push({ id: target.id, colour: target.group });
          shot.first ??= { id: target.id, colour: target.group };
        }
        const inverseA = 1 / (a.radius * a.radius), inverseB = 1 / (b.radius * b.radius);
        const impulse = -(1 + 0.88) * speedAlongNormal / (inverseA + inverseB);
        a.vx -= impulse * inverseA * nx;
        a.vy -= impulse * inverseA * ny;
        b.vx += impulse * inverseB * nx;
        b.vy += impulse * inverseB * ny;
      }
    }
  }

  for (const marble of marbles) {
    captureOutside(marble);
    if (!marble.captured) {
      marble.x = Math.max(marble.radius, Math.min(MARBLES_WIDTH - marble.radius, marble.x));
      marble.y = Math.max(marble.radius, Math.min(MARBLES_HEIGHT - marble.radius, marble.y));
    }
    if (Math.hypot(marble.vx, marble.vy) < 0.07) {
      marble.vx = 0;
      marble.vy = 0;
    }
  }
  return { captured, moving: marbles.some((marble) => !marble.captured && (marble.vx !== 0 || marble.vy !== 0)) };
}

/** Adaptive substeps bound travel to a fraction of a marble radius. */
export function advanceMarbles(marbles: Marble[], dt = 1, shot?: MarbleShot) {
  if (!Number.isFinite(dt) || dt <= 0) return { captured: 0, moving: false };
  const duration = Math.min(dt, 2);
  const speed = Math.max(0, ...marbles.map(m => Math.hypot(m.vx, m.vy)));
  const radius = Math.min(13, ...marbles.map(m => m.radius));
  const steps = Math.max(1, Math.ceil(speed * duration / (radius * .4)));
  let captured = 0, moving = false;
  for (let i = 0; i < steps; i++) {
    const result = advanceSubstep(marbles, duration / steps, shot);
    captured += result.captured; moving = result.moving;
  }
  if (shot) shot.complete = !moving;
  return { captured, moving };
}

export const MARBLE_COLOURS = ["Red", "Blue", "Yellow", "Green"] as const;
export type MarbleColour = typeof MARBLE_COLOURS[number];
export const MARBLE_STYLE = {
  Red: { color: "#c83c38", symbol: "R" }, Blue: { color: "#276ac4", symbol: "B" },
  Yellow: { color: "#d5a51b", symbol: "Y" }, Green: { color: "#28834c", symbol: "G" },
};
export type MarbleContact = { id: number; colour?: MarbleColour };
export type MarbleShot = { target?:MarbleColour; first: MarbleContact | null; contacts: MarbleContact[]; captured: MarbleContact[]; complete: boolean; scored: boolean };
export const createMarbleShot = (target?:MarbleColour): MarbleShot => ({ target, first: null, contacts: [], captured: [], complete: false, scored: false });
export function nextMarbleColour(marbles: Marble[], current?: MarbleColour, advance = false): MarbleColour | undefined {
  const start = current ? MARBLE_COLOURS.indexOf(current) + (advance ? 1 : 0) : 0;
  for (let i = 0; i < 4; i++) {
    const colour = MARBLE_COLOURS[(start + i) % 4];
    if (marbles.some(m => m.target && !m.captured && m.group === colour)) return colour;
  }
}
export function scoreMarbleShot(shot: MarbleShot, target?: MarbleColour) {
  const valid = Boolean(target && shot.first?.colour === target);
  const count = valid ? new Set(shot.captured.filter(m => m.colour === target).map(m => m.id)).size : 0;
  const points = count === 0 ? 0 : count === 1 ? 100 : count === 2 ? 250 : 450 + (count - 3) * 200;
  return { count, points, reason: !shot.first ? "No contact" : !valid ? "Wrong colour hit first" : !count ? "No target-colour capture" : "Correct first hit" };
}

/** Bank one settled shot, advance the shared target and alternate exactly once. */
export function resolveMarbleTurn(shot: MarbleShot, target: MarbleColour | undefined, marbles: Marble[], player: 0 | 1, individual = false, shotsUsed = 0, shotLimit = Infinity) {
  if (!shot.complete || shot.scored) return null;
  shot.scored = true;
  const score = scoreMarbleShot(shot, target);
  return {
    ...score,
    nextTarget: nextMarbleColour(marbles, target, score.points > 0),
    nextPlayer: (individual ? 0 : player === 0 ? 1 : 0) as 0 | 1,
    finished: !marbles.some(m => m.target && !m.captured) || (individual && shotsUsed >= shotLimit),
  };
}


export const MARBLES_LAUNCH_LINE = { min:160, max:740, y:MARBLES_LAUNCH.y };
/** Launch rail retains the safety checks of the legacy free-placement API. */
export function positionMarbleOnLine(marbles:Marble[], x:number) {
  if (!Number.isFinite(x)) return false;
  return placeMarbleShooter(marbles, Math.max(MARBLES_LAUNCH_LINE.min,Math.min(MARBLES_LAUNCH_LINE.max,x)),MARBLES_LAUNCH_LINE.y);
}
export function marbleCanvasPoint(x:number,y:number,rect:{left:number;top:number;width:number;height:number}) {
  return {x:(x-rect.left)*MARBLES_WIDTH/rect.width,y:(y-rect.top)*MARBLES_HEIGHT/rect.height};
}
export function marblePullVelocity(dx:number,dy:number) {
  if(!Number.isFinite(dx+dy))return {x:0,y:0,power:0};
  const length=Math.hypot(dx,dy),power=Math.min(1,length/MARBLES_MAX_PULL);
  return {x:length && dx ? -dx/length*16.2*power:0,y:length && dy ? -dy/length*16.2*power:0,power};
}
export type MarblePrediction = {id:number;colour?:MarbleColour;distance:number;x:number;y:number;normal:{x:number;y:number}};
/** Expanded-circle ray entry, limited by friction and the first board boundary.
 * It predicts the unobstructed first contact, never later bounces/chain captures. */
export function predictMarbleContact(marbles:Marble[],vx:number,vy:number) {
  const shooter=marbles.find(m=>!m.target), speed=Math.hypot(vx,vy);
  if(!shooter || speed<.07 || !Number.isFinite(speed)) return {contact:null as MarblePrediction|null,end:{x:shooter?.x??0,y:shooter?.y??0},distance:0};
  const dx=vx/speed,dy=vy/speed;
  let maxDistance=marbleRollingRange(speed,Math.min(13,...marbles.map(m=>m.radius)));
  for(const [coordinate,direction,maximum] of [[shooter.x,dx,MARBLES_WIDTH],[shooter.y,dy,MARBLES_HEIGHT]]) {
    if(direction>0) maxDistance=Math.min(maxDistance,(maximum-shooter.radius-coordinate)/direction);
    if(direction<0) maxDistance=Math.min(maxDistance,(shooter.radius-coordinate)/direction);
  }
  let contact:MarblePrediction|null=null;
  for(const m of marbles) {
    if(!m.target || m.captured) continue;
    const px=m.x-shooter.x,py=m.y-shooter.y,projection=px*dx+py*dy,r=shooter.radius+m.radius;
    const perpendicular=px*px+py*py-projection*projection;
    if(perpendicular>r*r || projection<0) continue;
    const distance=Math.max(0,projection-Math.sqrt(Math.max(0,r*r-perpendicular)));
    if(distance>maxDistance || (contact && (distance>contact.distance+1e-8 || (Math.abs(distance-contact.distance)<1e-8 && m.id>contact.id)))) continue;
    const x=shooter.x+dx*distance,y=shooter.y+dy*distance,n=Math.hypot(m.x-x,m.y-y)||1;
    contact={id:m.id,colour:m.group,distance,x,y,normal:{x:(m.x-x)/n,y:(m.y-y)/n}};
  }
  const distance=contact?.distance??maxDistance;
  return {contact,end:{x:shooter.x+dx*distance,y:shooter.y+dy*distance},distance};
}

/** Match the solver's adaptive integration and stopping threshold before impact. */
export function marbleRollingRange(initialSpeed:number, radius=13) {
  if(!Number.isFinite(initialSpeed)||initialSpeed<.07)return 0;
  let speed=initialSpeed,distance=0;
  for(let frame=0;frame<2000&&speed>=.07;frame++) {
    const steps=Math.max(1,Math.ceil(speed/(radius*.4))),friction=Math.pow(.985,1/steps);
    for(let step=0;step<steps&&speed>=.07;step++) {distance+=speed/steps;speed*=friction;}
  }
  return distance;
}
