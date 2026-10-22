export type Difficulty = "easy" | "medium" | "difficult";

export const difficultySettings = {
  easy: { label: "Easy", marbles: 8, marbleRadius: 22, sticks: 10, stickSpread: 46, stickLength: 28 },
  medium: { label: "Medium", marbles: 12, marbleRadius: 20, sticks: 18, stickSpread: 36, stickLength: 38 },
  difficult: { label: "Difficult", marbles: 16, marbleRadius: 18, sticks: 28, stickSpread: 20, stickLength: 38 },
} as const;

export type Point = { x: number; y: number };

export function shotVelocity(dx: number, dy: number) {
  const distance = Math.hypot(dx, dy);
  const scale = distance === 0 ? 0 : 0.09 * Math.min(distance, 180) / distance;
  return { x: dx * scale, y: dy * scale };
}

export function segmentsOverlap(a: Point, b: Point, c: Point, d: Point, thickness = 11) {
  const cross = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const distance = (p: Point, q: Point, r: Point) => {
    const dx = r.x - q.x, dy = r.y - q.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - q.x) * dx + (p.y - q.y) * dy) / lengthSquared));
    return Math.hypot(p.x - q.x - t * dx, p.y - q.y - t * dy);
  };
  const crossing = cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
  return crossing || Math.min(distance(a, c, d), distance(b, c, d), distance(c, a, b), distance(d, a, b)) <= thickness;
}

export function canKick(y: number, vy: number, ground: number) {
  return vy > 0 && y > ground - 130 && y < ground - 8;
}

export function chaptehPaceLevel(rally: number, totalPoints: number) {
  const rallySteps = Math.floor(Math.max(0, rally) / 4);
  const matchSteps = Math.floor(Math.max(0, totalPoints) / 3);
  return Math.min(5, rallySteps + matchSteps);
}

export function chaptehFlightTuning(level: number) {
  const safeLevel = Math.max(0, Math.min(5, level));
  return {
    horizontalSpeed: 4.8 + safeLevel * 0.32,
    gravity: 0.34 + safeLevel * 0.027,
  };
}

export type MarblePattern = 'scattered' | 'clusters' | 'central' | 'mixed';
export const MARBLE_PATTERNS:MarblePattern[]=['scattered','clusters','central','mixed'];
/** Balanced, seeded formations. Four exposed front anchors give every colour
 * a direct shot from the launch rail; remaining marbles form the chosen pattern. */
export function randomMarblePositions(random = Math.random, difficulty: Difficulty = 'medium', pattern?:MarblePattern):Point[] {
  const settings=difficultySettings[difficulty], gap=settings.marbleRadius*2+9;
  const selected=pattern??MARBLE_PATTERNS[Math.floor(random()*4)%4];
  const positions:Point[]=[45,75,105,135].map(degrees=>({x:Math.cos(degrees*Math.PI/180)*225+(random()-.5)*5,y:Math.sin(degrees*Math.PI/180)*225+(random()-.5)*5}));
  const legal=(p:Point)=>Math.hypot(p.x,p.y)<=232 && positions.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>=gap) && positions.slice(0,4).every(q=>p.y<q.y-gap || Math.abs(p.x-q.x)>gap);
  for(let i=4;i<settings.marbles;i++) {
    let placed=false;
    for(let attempt=0;attempt<160;attempt++) {
      let p:Point;
      if(selected==='central' || (selected==='mixed'&&i%2===0)) {
        const columns=5,row=Math.floor((attempt+i-4)/columns)%5,col=(attempt+i-4)%columns;
        p={x:(col-2)*gap,y:(row-2)*gap-40};
      } else if(selected==='clusters') {
        const centre=[{x:-130,y:-95},{x:130,y:-95},{x:0,y:50}][(i+Math.floor(attempt/12))%3];
        const angle=(attempt%6)*Math.PI/3;
        p={x:centre.x+Math.cos(angle)*gap*(attempt%2),y:centre.y+Math.sin(angle)*gap*(attempt%2)};
      } else {
        // Stratified sectors prevent all of the random samples falling in one corner.
        const angle=Math.PI+(i-4+random()*.45)/(settings.marbles-3)*Math.PI;
        const radius=100+random()*128;
        p={x:Math.cos(angle)*radius,y:Math.sin(angle)*radius+20};
      }
      if(legal(p)) {positions.push(p);placed=true;break;}
    }
    if(!placed) {
      // Validated lattice fallback, including adversarial constant random sources.
      outer:for(let y=-200;y<=120;y+=gap)for(let x=-220;x<=220;x+=gap)if(legal({x,y})){positions.push({x,y});placed=true;break outer;}
    }
    if(!placed) throw new Error('No valid marble formation');
  }
  return positions;
}

/** Identical challenge layouts for each player; standalone games keep Math.random. */
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
