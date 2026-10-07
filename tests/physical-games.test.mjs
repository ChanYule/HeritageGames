import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

async function load(name) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../src/games/${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const c = await load("caromPhysics"), tin = await load("canPhysics"), m = await load("marblesPhysics");
const disc = (id, x, y, vx = 0, vy = 0) => ({ id, x, y, vx, vy, r:15, pocketed:false });
const settle = (world, step, done) => {
  for (let i=0; i<2400 && !done(world); i++) step(world, 1/120);
  assert.ok(done(world), "physical motion must settle without a timeout shortcut");
};

test("carrom has nine light, nine dark and one queen in a separated rack", () => {
  const w=c.createCaromWorld();
  for (const [colour, count] of [["light",9],["dark",9],["queen",1]]) assert.equal(w.discs.filter(d=>c.coinColour(d.id)===colour).length,count);
  for (const a of w.discs) for (const b of w.discs) if(a.id!==b.id) assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=30);
});
test("head-on hits transfer momentum and strong hits transfer more", () => {
  const results=[];
  for(const speed of [100,600]) {
    const w=c.createCaromWorld(); w.discs=[disc(2,200,300,speed),disc(3,231,300)];
    c.stepCarom(w,1/60); assert.ok(w.discs[1].vx>0); results.push(w.discs[1].vx);
  }
  assert.ok(results[1]>results[0]*3);
});
test("glancing carrom collision transfers an angled impulse", () => {
  const w=c.createCaromWorld(); w.discs=[disc(2,200,300,400),disc(3,225,316)];
  c.stepCarom(w,1/60); assert.ok(w.discs[1].vx>0 && w.discs[1].vy>0); assert.ok(w.discs[0].vy<0);
});
test("very fast carrom shot cannot tunnel through another coin", () => {
  const w=c.createCaromWorld(); w.discs=[disc(2,150,300,8000),disc(3,250,300)];
  c.stepCarom(w,1/60); assert.ok(w.impacts>0); assert.ok(w.discs[1].vx>0);
});
test("coincident carrom coins separate with finite coordinates", () => {
  const w=c.createCaromWorld(); w.discs=[disc(2,300,300),disc(3,300,300)]; c.stepCarom(w,1/60);
  assert.ok(Math.hypot(w.discs[0].x-w.discs[1].x,w.discs[0].y-w.discs[1].y)>=30-.01);
  for(const d of w.discs) assert.ok([d.x,d.y,d.vx,d.vy].every(Number.isFinite));
});
test("corner striker pocket is a foul and returns one own coin", () => {
  const w=c.createCaromWorld(), match=c.createCaromMatch();
  w.discs.find(d=>d.id===2).pocketed=true;
  w.discs.push({...disc(0,57,57,-200,-200),r:20});
  for(let i=0;i<30;i++)c.stepCarom(w,1/120);
  assert.ok(w.pocketed.includes(0)); const result=c.resolveCaromTurn(w,match);
  assert.equal(result.foul,true); assert.equal(match.active,1); assert.equal(w.discs.find(d=>d.id===2).pocketed,false);
});
test("own coin grants another turn while a miss passes the turn", () => {
  const w=c.createCaromWorld(), match=c.createCaromMatch(); w.pocketed=[2]; w.discs[1].pocketed=true;
  c.resolveCaromTurn(w,match); assert.equal(match.active,0);
  w.pocketed=[]; c.resolveCaromTurn(w,match); assert.equal(match.active,1);
});
test("queen can be covered on the following shot and returns on failed cover", () => {
  for(const cover of [true,false]) {
    const w=c.createCaromWorld(), match=c.createCaromMatch(); w.pocketed=[1]; w.discs[0].pocketed=true;
    c.resolveCaromTurn(w,match); assert.equal(match.queenPending,0); assert.equal(match.active,0);
    w.pocketed=cover?[2]:[]; w.discs[1].pocketed=cover; c.resolveCaromTurn(w,match);
    assert.equal(match.queenPending,null); assert.equal(match.queenCovered,cover?0:null); assert.equal(w.discs[0].pocketed,cover);
  }
});
test("last own coin wins only after queen is covered", () => {
  for(const covered of [true,false]) {
    const w=c.createCaromWorld(), match=c.createCaromMatch();
    for(const d of w.discs) if(c.coinColour(d.id)==="light") d.pocketed=true;
    w.pocketed=[18]; match.queenCovered=covered?1:null;
    c.resolveCaromTurn(w,match); assert.equal(match.winner,covered?0:null);
    if(!covered)assert.equal(w.discs.find(d=>d.id===18).pocketed,false);
  }
});
test("carrom settling never truncates a still-moving disc", () => {
  const w=c.createCaromWorld(); w.elapsed=20; w.discs=[disc(2,300,300,100)]; assert.equal(c.caromSettled(w),false);
  settle(w,c.stepCarom,c.caromSettled); assert.equal(w.discs[0].vx,0);
});
test("marbles launch provides a full maximum pull within the court", () => {
  assert.ok(m.MARBLES_HEIGHT-m.MARBLES_LAUNCH.y>=130);
  assert.ok(m.MARBLES_LAUNCH.y+m.MARBLES_MAX_PULL<m.MARBLES_HEIGHT);
});
test("high-speed marble collision does not tunnel", () => {
  const w=[{id:1,x:300,y:260,vx:300,vy:0,radius:18,target:false,captured:false,color:"teal"}, {id:2,x:400,y:260,vx:0,vy:0,radius:18,target:true,captured:false,color:"red"}];
  m.advanceMarbles(w); assert.ok(w[1].vx>0 || w[1].captured);
  assert.ok(w.every(d=>[d.x,d.y,d.vx,d.vy].every(Number.isFinite)));
});
test("tin ball hits along its path before reaching the selected endpoint", () => {
  const w=tin.createCanWorld(); tin.throwBall(w,105,200,1);
  let contacted=false;
  for(let i=0;i<200;i++) { tin.stepCans(w,1/120); if(w.impacts) { contacted=true; assert.ok(w.elapsed<.33); break; } }
  assert.ok(contacted);
});
test("direct continuous impact pushes a tin and redirects the ball", () => {
  const w=tin.createCanWorld(); w.cans=[w.cans[1]]; tin.throwBall(w,300,315,1);
  for(let i=0;i<100 && !w.impacts;i++)tin.stepCans(w,1/120);
  assert.ok(w.impacts>0); assert.ok(w.cans[0].vy<0);
  assert.ok(w.ball.vy>tin.ballVelocity(300,315,1).vy+100, "the ball loses momentum to the tin");
});
test("off-centre ball impact rotates a tin", () => {
  const w=tin.createCanWorld(); w.cans=[w.cans[1]]; tin.throwBall(w,335,315,1);
  for(let i=0;i<100 && !w.impacts;i++)tin.stepCans(w,1/120);
  assert.ok(w.impacts>0); assert.ok(Math.abs(w.cans[0].spin)>.1);
});
test("gravity and floor contacts settle a dropped tin without penetration", () => {
  const w=tin.createCanWorld(); w.cans=[{...w.cans[0],y:100}]; tin.stepCans(w,1/60); assert.ok(w.cans[0].vy>0 && w.cans[0].y>100);
  settle(w,tin.stepCans,tin.cansSettled); assert.ok(w.cans[0].y<=375+.1); assert.equal(w.cans[0].vy,0);
});
test("falling upper tin collides with and transfers force to lower tin", () => {
  const w=tin.createCanWorld(); w.cans=[{...w.cans[0],x:300,y:180,vy:600},{...w.cans[1]}];
  for(let i=0;i<60;i++)tin.stepCans(w,1/120);
  assert.ok(w.impacts>0); assert.ok(Math.abs(w.cans[0].y-w.cans[1].y)>=59);
});
test("direct stack hit produces a physical chain reaction with finite settled values", () => {
  const w=tin.createCanWorld(); tin.throwBall(w,300,315,1); settle(w,tin.stepCans,tin.cansSettled);
  assert.ok(w.impacts>1); assert.ok(w.falls>0);
  assert.ok(w.cans.filter(can=>Math.abs(can.x-[244,300,356,272,328,300][can.id-1])>10).length>1);
  for(const can of w.cans) assert.ok([can.x,can.y,can.angle,can.vx,can.vy,can.spin].every(Number.isFinite));
});
test("tins score physical orientation once and a resting stack never scores", () => {
  const w=tin.createCanWorld(); w.cans[0].angle=.8; tin.stepCans(w,1/120); assert.ok(w.cans[0].fallen); const count=w.falls;
  tin.stepCans(w,1/120); assert.equal(w.falls,count);
  const rest=tin.createCanWorld(); settle(rest,tin.stepCans,tin.cansSettled); assert.equal(rest.falls,0); assert.equal(rest.impacts,0);
});
test("tins need sustained quiet and never score because time expired", () => {
  const w=tin.createCanWorld(); w.elapsed=30; w.cans[0].vx=100; assert.equal(tin.cansSettled(w),false);
  settle(w,tin.stepCans,tin.cansSettled); assert.ok(w.quiet>=.35);
});
test("stronger throws have greater launch speed; invalid throws cannot corrupt a world", () => {
  const weak=tin.ballVelocity(300,315,.2),strong=tin.ballVelocity(300,315,1);
  assert.ok(Math.hypot(strong.vx,strong.vy)>Math.hypot(weak.vx,weak.vy));
  const w=tin.createCanWorld(); assert.equal(tin.throwBall(w,NaN,300,1),false); assert.equal(w.ball,null);
});
