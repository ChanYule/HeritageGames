import type { Difficulty } from './mechanics';
export type Stick = { id:number; x:number; y:number; length:number; width:number; angle:number; color:string; name:string; points:number; removed:boolean };
export const palette = [
  {color:'#d55f4b',name:'Red',points:10}, {color:'#2d7181',name:'Blue',points:10},
  {color:'#d7a63d',name:'Yellow',points:20}, {color:'#5d7f57',name:'Green',points:20}, {color:'#7b5e8b',name:'Purple',points:50},
];
// All simulation coordinates are in the same 900 × 560 world at every screen size.
export const stickTuning = {
  easy:{count:10,spread:370,length:220,tolerance:7,angleTolerance:3,hit:24,hints:Infinity},
  medium:{count:18,spread:260,length:260,tolerance:4,angleTolerance:1.8,hit:20,hints:2},
  difficult:{count:28,spread:170,length:285,tolerance:2.2,angleTolerance:1,hit:18,hints:1},
};
export function createSticks(difficulty:Difficulty, seed = Math.floor(Math.random()*2**32)):Stick[] {
  let state=seed >>> 0;
  const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
  const c=stickTuning[difficulty];
  // Valuable sticks are generally lower in the stack. The highest layer always has a free lift.
  const tones=Array.from({length:c.count},(_,id)=>palette[id===0 ? 4 : id%5]).sort((a,b)=>b.points-a.points);
  return Array.from({length:c.count},(_,id)=>{
    const tone=tones[id];
    return {id,x:450+(random()-.5)*c.spread,y:280+(random()-.5)*140,length:c.length+random()*35,width:8,angle:random()*180,...tone,removed:false};
  });
}
export function endpoints(s:Stick) {
  const a=s.angle*Math.PI/180, dx=Math.cos(a)*s.length/2,dy=Math.sin(a)*s.length/2;
  return [{x:s.x-dx,y:s.y-dy},{x:s.x+dx,y:s.y+dy}] as const;
}
function pointDistance(p:{x:number;y:number},a:{x:number;y:number},b:{x:number;y:number}) {
  const dx=b.x-a.x,dy=b.y-a.y;
  const u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(p.x-a.x-u*dx,p.y-a.y-u*dy);
}
export function contact(a:Stick,b:Stick) {
  const [p,q]=endpoints(a),[r,s]=endpoints(b);
  const cross=(a:typeof p,b:typeof p,c:typeof p)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const intersects=cross(p,q,r)*cross(p,q,s)<0 && cross(r,s,p)*cross(r,s,q)<0;
  return intersects || Math.min(pointDistance(p,r,s),pointDistance(q,r,s),pointDistance(r,p,q),pointDistance(s,p,q))<=(a.width+b.width)/2;
}
export function blocked(stick:Stick,pile:Stick[]) { return pile.some(s=>!s.removed && s.id>stick.id && contact(stick,s)); }
export function mapStickPoint(x:number,y:number,rect:{left:number;top:number;width:number;height:number}) {
  return {x:(x-rect.left)*900/rect.width,y:(y-rect.top)*560/rect.height};
}
export function selectStick(pile:Stick[],p:{x:number;y:number},difficulty:Difficulty, hitRadius=stickTuning[difficulty].hit) {
  return [...pile].reverse().find(s=>!s.removed && pointDistance(p,...endpoints(s))<=hitRadius);
}
export type Extraction = { id:number; baseline:Stick[]; pile:Stick[]; travelled:number; disturbed:number|null; complete:boolean };
export function beginExtraction(pile:Stick[],id:number):Extraction {
  return {id,baseline:pile.map(s=>({...s})),pile:pile.map(s=>({...s})),travelled:0,disturbed:null,complete:false};
}
export function disturbance(pile:Stick[],baseline:Stick[],id:number,difficulty:Difficulty) {
  const c=stickTuning[difficulty];
  return pile.find(s=>{
    const start=baseline.find(b=>b.id===s.id)!;
    const delta=Math.abs(s.angle-start.angle)%360;
    return s.id!==id && !s.removed && (Math.hypot(s.x-start.x,s.y-start.y)>c.tolerance || Math.min(delta,360-delta)>c.angleTolerance);
  })?.id ?? null;
}
export function moveExtraction(attempt:Extraction,dx:number,dy:number,difficulty:Difficulty,elapsed=100):Extraction {
  if(attempt.complete || attempt.disturbed!==null || !Number.isFinite(dx+dy)) return attempt;
  const next={...attempt,pile:attempt.pile.map(s=>({...s}))};
  const selected=next.pile.find(s=>s.id===next.id);
  if(!selected || selected.removed) return attempt;
  const distance=Math.min(500,Math.hypot(dx,dy)),raw=Math.hypot(dx,dy)||1;
  dx*=distance/raw; dy*=distance/raw;
  // Swept steps prevent fast pointer events tunnelling through upper sticks.
  const steps=Math.max(1,Math.ceil(distance/2)),sx=dx/steps,sy=dy/steps;
  const speed=distance/Math.max(16,elapsed),impulse=.30+Math.min(.65,speed*.28);
  for(let i=0;i<steps;i++) {
    const contacts=next.pile.filter(s=>!s.removed && s.id>selected.id && contact(selected,s));
    selected.x+=sx;selected.y+=sy;
    for(const other of next.pile) {
      if(other.removed || other.id<=selected.id) continue;
      if(!contacts.includes(other) && !contact(selected,other)) continue;
      // Upper sticks are supported by the selected stick: friction transfers translation and torque.
      other.x+=sx*impulse;other.y+=sy*impulse;
      const lever=((other.x-selected.x)*sy-(other.y-selected.y)*sx)/(other.length*other.length);
      other.angle+=lever*impulse*90;
    }
    next.disturbed=disturbance(next.pile,next.baseline,next.id,difficulty);
    if(next.disturbed!==null) break;
  }
  const start=next.baseline.find(s=>s.id===next.id)!;
  next.travelled=Math.hypot(selected.x-start.x,selected.y-start.y);
  // A top stick lifts above lower layers; an underneath stick must slide out without moving its supports.
  next.complete=next.disturbed===null && next.travelled>=105 && !blocked(selected,next.pile);
  return next;
}
export function pickupAward(points:number,streak:number) { const bonus=streak===3?20:streak===5?50:0;return {points,bonus,total:points+bonus}; }
export type ColourMission={name:string;remaining:number;bonus:number};
export function createMission(pile:Stick[]):ColourMission|null {
  const target=pile.find(s=>!s.removed && s.name==='Purple') ?? pile.find(s=>!s.removed);
  return target ? {name:target.name,remaining:1,bonus:30}:null;
}
export function advanceMission(mission:ColourMission|null,stick:Stick) {
  if(!mission || mission.remaining===0 || mission.name!==stick.name) return {mission,bonus:0};
  const remaining=Math.max(0,mission.remaining-1);
  return {mission:{...mission,remaining},bonus:remaining===0?mission.bonus:0};
}
