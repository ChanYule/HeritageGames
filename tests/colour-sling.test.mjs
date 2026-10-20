import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
async function load(name) {
 const text = ts.transpileModule(readFileSync(new URL(`../src/games/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace('"cannon-es"',JSON.stringify(import.meta.resolve('cannon-es')));
 return import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);
}
const m=await load('marblesPhysics'), g=await load('tinSlingPhysics');
const marble=(id,group,x,y,vx=0,vy=0,target=true)=>({id,group,x,y,vx,vy,target,radius:18,captured:false,color:'#c33'});
const settle=w=>{let steps=0;while(!w.settled&&steps++<4800)g.stepSling(w,1/120);assert.ok(w.settled,'rigid bodies must settle');return steps;};
for(const [name,first,captures,expected] of [
 ['wrong first colour','Blue',['Red','Red'],0],['wrong captured colour','Red',['Blue'],0],['two valid captures','Red',['Red','Red'],300],['no capture','Red',[],0],['mixed captures','Red',['Red','Blue'],100],['no contact',null,['Red'],0],['three valid captures','Red',['Red','Red','Red'],450],
])test(`Marbles scoring: ${name}`,()=>{
 const s=m.createMarbleShot();s.first=first?{id:1,colour:first}:null;s.captured=captures.map((colour,id)=>({id,colour}));
 assert.equal(m.scoreMarbleShot(s,'Red').points,expected);
});
test('Marbles scoring ignores duplicate capture IDs',()=>{const s=m.createMarbleShot();s.first={id:1,colour:'Red'};s.captured=[s.first,s.first];assert.equal(m.scoreMarbleShot(s,'Red').points,100);});
test('Marbles target selection starts Red, rotates and skips exhausted groups',()=>{
 const board=m.MARBLE_COLOURS.map((colour,i)=>marble(i,colour,450+i*40,260));
 assert.equal(m.nextMarbleColour(board),'Red');assert.equal(m.nextMarbleColour(board,'Red',true),'Blue');
 board[1].captured=true;assert.equal(m.nextMarbleColour(board,'Red',true),'Yellow');assert.equal(m.nextMarbleColour(board,'Red',false),'Red');
 board[0].captured=true;assert.equal(m.nextMarbleColour(board,'Red'),'Yellow');board.forEach(x=>x.captured=true);assert.equal(m.nextMarbleColour(board,'Yellow'),undefined);
});
test('Marbles actual shooter contact records first ID/colour and never overwrites it',()=>{
 const board=[marble(9,'Blue',450,320),marble(2,'Red',450,240),marble(100,undefined,450,370,0,-16,false)],shot=m.createMarbleShot();
 for(let i=0;i<100;i++)m.advanceMarbles(board,1,shot);
 assert.equal(shot.first.id,9);assert.equal(shot.first.colour,'Blue');assert.ok(shot.contacts.length>=1);
 const next=m.createMarbleShot();assert.equal(next.first,null);
});
test('Marbles contacts ordered by physical entry time despite target array order',()=>{
 const board=[marble(1,'Red',450,250),marble(2,'Blue',450,330),marble(100,undefined,450,400,0,-150,false)],shot=m.createMarbleShot();
 m.advanceMarbles(board,1,shot);assert.equal(shot.first.colour,'Blue');
});
test('Marbles wall/target-target contacts and stationary overlaps do not set first contact',()=>{
 const board=[marble(1,'Red',450,250,4),marble(2,'Blue',480,250),marble(100,undefined,22,600,-10,0,false)],shot=m.createMarbleShot();
 m.advanceMarbles(board,1,shot);assert.equal(shot.first,null);
 const overlap=[marble(1,'Red',450,250),marble(100,undefined,450,250,0,0,false)];m.advanceMarbles(overlap,1,shot);assert.equal(shot.first,null);
});
test('Marbles newly captured event contains ID and colour only once, plus completion',()=>{
 const board=[marble(5,'Green',668,260,4)],shot=m.createMarbleShot();
 m.advanceMarbles(board,1,shot);m.advanceMarbles(board,1,shot);
 assert.deepEqual(shot.captured,[{id:5,colour:'Green'}]);assert.equal(shot.complete,true);
});
test('Marbles repeated high-speed collisions remain finite and finish',()=>{
 const board=[marble(0,'Red',440,260,15,-8),marble(1,'Blue',480,280,-10,3),marble(100,undefined,450,570,0,-120,false)],shot=m.createMarbleShot();
 for(let i=0;i<1800;i++){m.advanceMarbles(board,1,shot);assert.ok(board.every(b=>Number.isFinite(b.x+b.y+b.vx+b.vy)));if(shot.complete)break;}
 assert.equal(shot.complete,true);
});
test('Slingshot launches opposite pull, clamps power and rejects tiny or invalid gestures',()=>{
 const v=g.slingVelocity(-.8,-.4);assert.ok(v.x>0&&v.y>0);
 assert.ok(Math.hypot(...Object.values(g.slingVelocity(-100,-100)))<=g.MAX_PULL*13+.001);
 assert.ok(g.slingVelocity(-.3,0).x<g.slingVelocity(-.7,0).x);
 for(const p of [[.01,.01],[NaN,0],[0,Infinity]])assert.equal(g.slingVelocity(...p),null);
});
test('Slingshot gravity acts on a real ball and prevents double/invalid launches',()=>{
 const w=g.createSlingWorld();assert.equal(g.launchSling(w,NaN,0),false);assert.equal(w.balls,3);
 assert.equal(g.launchSling(w,-.6,-.6),true);assert.equal(w.balls,2);assert.equal(w.shots,1);
 const vy=w.ball.velocity.y,x=w.ball.position.x;g.stepSling(w,1/60);assert.ok(w.ball.velocity.y<vy);assert.ok(w.ball.position.x>x);
 assert.equal(g.launchSling(w,-1,0),false);const elapsed=w.elapsed;g.stepSling(w,NaN);assert.equal(w.elapsed,elapsed);
});
for(let level=0;level<5;level++)test(`Slingshot level ${level+1}: identical six-tin supported starting layouts`,()=>{
 const a=g.createSlingWorld(level),b=g.createSlingWorld(level);
 assert.equal(a.objects.filter(o=>o.kind==='tin').length,6);
 assert.deepEqual(a.objects.map(o=>[o.kind,o.body.position.toArray(),o.body.quaternion.toArray()]),b.objects.map(o=>[o.kind,o.body.position.toArray(),o.body.quaternion.toArray()]));
 assert.ok(a.objects.filter(o=>o.kind==='tin').every(o=>!o.fallen&&o.body.position.y>.5));
 g.launchSling(a,.25,0);settle(a);assert.equal(a.score,0,'a shot away from tins must not score support jitter');
});
test('Slingshot solid wall blocks a fast ball and rebounds without breaking',()=>{
 const w=g.createSlingWorld(2),wall=w.objects.find(o=>o.kind==='stone');g.launchSling(w,-1,0);w.ball.position.set(5.7,1,0);w.ball.velocity.set(100,0,0);
 let rebound=false;for(let i=0;i<20;i++){g.stepSling(w,1/120);if(w.ball?.velocity.x<0)rebound=true;}
 assert.ok(rebound);assert.ok(!wall.broken);assert.ok(!w.objects.some(o=>o.fallen));
});
test('Slingshot strong crate impacts break wood and preserve the ball after impact',()=>{
 const w=g.createSlingWorld(1);g.launchSling(w,-1,0);w.ball.position.set(7.3,.9,0);w.ball.velocity.set(15,0,0);
 for(let i=0;i<25;i++)g.stepSling(w,1/120);
 assert.ok(w.breaks>0);assert.ok(w.ball);assert.ok(w.objects.some(o=>o.kind==='wood'&&o.broken));
});
test('Slingshot off-centre tin impacts rotate tins and transfer momentum to neighbours',()=>{
 const w=g.createSlingWorld();g.launchSling(w,-1,0);w.ball.position.set(8.2,.85,0);w.ball.velocity.set(14,0,0);
 for(let i=0;i<120;i++)g.stepSling(w,1/120);
 const tins=w.objects.filter(o=>o.kind==='tin');assert.ok(tins.some(o=>Math.abs(o.body.quaternion.z)>.1));assert.ok(tins.filter(o=>o.fallen).length>=2);settle(w);
 assert.ok(w.score>=200);const score=w.score;for(let i=0;i<100;i++)g.stepSling(w,1/120);assert.equal(w.score,score);
});
test('Slingshot all-clear bonuses awarded once and no extra shots after resolution',()=>{
 const w=g.createSlingWorld();g.launchSling(w,.4,0);
 for(const tin of w.objects.filter(o=>o.kind==='tin')){tin.body.position.x+=1;tin.body.sleep();}
 settle(w);assert.deepEqual(w.breakdown,{tins:600,clear:200,unused:100});assert.equal(w.score,900);assert.equal(w.resolved,true);
 const score=w.score;for(let i=0;i<100;i++)g.stepSling(w,1/120);assert.equal(w.score,score);assert.equal(g.launchSling(w,-1,0),false);
});
test('Slingshot three misses consume exactly three balls and finish without bonus',()=>{
 const w=g.createSlingWorld();for(let i=0;i<3;i++){assert.ok(g.launchSling(w,.4,0));settle(w);assert.equal(w.balls,2-i);}
 assert.equal(w.resolved,true);assert.equal(w.score,0);assert.equal(g.launchSling(w,-1,0),false);
});
test('Slingshot guide uses gravity and stops at solid contact',()=>{
 const w=g.createSlingWorld(2),points=g.slingTrajectory(w,-1,0);assert.ok(points.length>3);
 assert.ok(points.at(-1).x<6.5);assert.ok(points.at(-1).y<points[0].y);
});
for(const [level,shots] of [
 [0,[[10,1],[10,.7]]], [1,[[10,1],[10,.7]]], [2,[[10,1],[30,.55]]], [3,[[10,.55]]], [4,[[10,.85],[40,.55],[20,.55]]],
])test(`Slingshot curated level ${level+1} can be cleared within its three-ball allowance`,()=>{
 const w=g.createSlingWorld(level);
 for(const[angle,power]of shots){const a=angle*Math.PI/180;assert.ok(g.launchSling(w,-Math.cos(a)*g.MAX_PULL*power,-Math.sin(a)*g.MAX_PULL*power));settle(w);}
 assert.equal(w.breakdown.tins,600);assert.equal(w.breakdown.clear,200);assert.equal(w.resolved,true);assert.equal(w.balls,3-shots.length);
 assert.equal(w.score,800+w.balls*50);
});
test('Marbles turn resolution banks settled shots once, alternates players and ends on empty board',()=>{
 const board=[marble(1,'Red',450,250),marble(2,'Blue',480,250)],s=m.createMarbleShot();s.first={id:1,colour:'Red'};s.captured=[s.first];board[0].captured=true;
 assert.equal(m.resolveMarbleTurn(s,'Red',board,0),null,'cannot bank moving shots');s.complete=true;
 const turn=m.resolveMarbleTurn(s,'Red',board,0);assert.equal(turn.points,100);assert.equal(turn.nextTarget,'Blue');assert.equal(turn.nextPlayer,1);assert.equal(turn.finished,false);
 assert.equal(m.resolveMarbleTurn(s,'Red',board,0),null,'repeated settling must not bank again');
 board[1].captured=true;const last=m.createMarbleShot();last.complete=true;
 const end=m.resolveMarbleTurn(last,'Blue',board,1);assert.equal(end.finished,true);assert.equal(end.nextTarget,undefined);
});
test('Marbles zero-point turns keep available target, alternate, and respect individual shot cap',()=>{
 const board=[marble(1,'Red',450,250),marble(2,'Blue',480,250)];
 const invalid=m.createMarbleShot();invalid.complete=true;invalid.first={id:2,colour:'Blue'};
 const turn=m.resolveMarbleTurn(invalid,'Red',board,1);assert.equal(turn.points,0);assert.equal(turn.nextTarget,'Red');assert.equal(turn.nextPlayer,0);
 const last=m.createMarbleShot();last.complete=true;const end=m.resolveMarbleTurn(last,'Red',board,0,true,6,6);assert.equal(end.finished,true);assert.equal(end.nextPlayer,0);
});

test('Marbles shooter can choose clear starting positions outside the ring without changing targets',()=>{
 const board=[marble(1,'Red',450,260),marble(100,undefined,450,570,0,0,false)],target={...board[0]};
 for(const[x,y]of [[150,260],[750,260],[450,540],[150,130]]){
  assert.equal(m.placeMarbleShooter(board,x,y),true);assert.equal(board[1].x,x);assert.equal(board[1].y,y);assert.deepEqual(board[0],target);
  assert.ok(x>=board[1].radius+m.MARBLES_MAX_PULL&&x<=m.MARBLES_WIDTH-board[1].radius-m.MARBLES_MAX_PULL);
  assert.ok(y>=board[1].radius+m.MARBLES_MAX_PULL&&y<=m.MARBLES_HEIGHT-board[1].radius-m.MARBLES_MAX_PULL);
 }
});
test('Marbles placement rejects the ring, insufficient pull-back room and invalid coordinates',()=>{
 const board=[marble(100,undefined,450,570,0,0,false)],start={...board[0]};
 for(const[x,y]of [[450,260],[450,480],[20,570],[880,260],[450,680],[150,20],[NaN,570],[150,Infinity]]){
  assert.equal(m.placeMarbleShooter(board,x,y),false);assert.deepEqual(board[0],start);
 }
});
test('Marbles placement blocks target overlap near the ring edge and any rolling shot',()=>{
 const board=[marble(1,'Red',450,470),marble(100,undefined,450,570,0,0,false)];
 assert.equal(m.placeMarbleShooter(board,450,490),false);
 board[0].vx=1;assert.equal(m.placeMarbleShooter(board,150,260),false);board[0].vx=0;
 board[1].vy=-10;assert.equal(m.placeMarbleShooter(board,150,260),false);board[1].vy=0;
 board[0].captured=true;assert.equal(m.placeMarbleShooter(board,450,490),true);
});
for(const[x,vx]of [[150,16.2],[750,-16.2]])test(`Marbles physics and colour scoring work from chosen starting x=${x}`,()=>{
 const board=[marble(1,'Red',450,260),marble(100,undefined,450,570,0,0,false)],shot=m.createMarbleShot();
 assert.ok(m.placeMarbleShooter(board,x,260));assert.equal(shot.first,null);assert.equal(shot.captured.length,0);
 board[1].vx=vx;
 for(let i=0;i<1600&&!shot.complete;i++)m.advanceMarbles(board,1,shot);
 assert.equal(shot.complete,true);assert.equal(shot.first.colour,'Red');assert.equal(m.scoreMarbleShot(shot,'Red').points,100);
 m.returnShooterToStart(board);assert.equal(board[1].x,m.MARBLES_LAUNCH.x);assert.equal(board[1].y,m.MARBLES_LAUNCH.y);
});
