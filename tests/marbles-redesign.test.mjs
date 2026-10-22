import assert from 'node:assert/strict';import {test} from 'node:test';import {readFileSync} from 'node:fs';import ts from 'typescript';
async function load(name){const {outputText}=ts.transpileModule(readFileSync(new URL(`../src/games/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);}
const m=await load('marblesPhysics'),rules=await load('mechanics');
const ball=(id,group,x,y,target=true,radius=20)=>({id,group,x,y,target,radius,vx:0,vy:0,captured:false,color:'#c33'});
function board(difficulty,seed,pattern){const config=rules.difficultySettings[difficulty];return [...rules.randomMarblePositions(rules.seededRandom(seed),difficulty,pattern).map((p,id)=>ball(id,m.MARBLE_COLOURS[id%4],m.MARBLES_RING.x+p.x,m.MARBLES_RING.y+p.y,true,config.marbleRadius)),ball(100,undefined,m.MARBLES_LAUNCH.x,m.MARBLES_LAUNCH.y,false)];}
function settle(pile,shot){for(let i=0;i<1600&&!shot.complete;i++)m.advanceMarbles(pile,1,shot);assert.ok(shot.complete,'all motion must settle');}
for(const difficulty of ['easy','medium','difficult'])for(const pattern of rules.MARBLE_PATTERNS)test(`${difficulty} ${pattern}: separated balanced seeded layouts and reachable colours`,()=>{
 for(let seed=0;seed<40;seed++){
  const pile=board(difficulty,seed,pattern),targets=pile.filter(b=>b.target),shooter=pile.at(-1);assert.deepEqual(pile,board(difficulty,seed,pattern));
  assert.equal(targets.length,rules.difficultySettings[difficulty].marbles);
  assert.ok(Math.min(...targets.map(b=>b.x))<m.MARBLES_RING.x-100);assert.ok(Math.max(...targets.map(b=>b.x))>m.MARBLES_RING.x+100);
  assert.ok(targets.some(b=>b.y<m.MARBLES_RING.y-60));assert.ok(targets.some(b=>b.y>m.MARBLES_RING.y+150));
  for(const b of targets){assert.ok(Math.hypot(b.x-m.MARBLES_RING.x,b.y-m.MARBLES_RING.y)+b.radius<m.MARBLES_RING.radius);for(const a of targets)if(a.id!==b.id)assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>a.radius+b.radius);}
  for(let id=0;id<4;id++){assert.ok(m.positionMarbleOnLine(pile,targets[id].x));const hit=m.predictMarbleContact(pile,0,-16.2);assert.equal(hit.contact?.id,id,'each target colour has an exposed launch corridor');}
  assert.equal(shooter.y,m.MARBLES_LAUNCH.y);
 }
});
for(const pattern of rules.MARBLE_PATTERNS)test(`${pattern} offers a real scoring shot for every difficulty`,()=>{
 for(const difficulty of ['easy','medium','difficult']) {
  const initial=board(difficulty,15,pattern);let found=false;
  for(let x=160;x<=740&&!found;x+=40){const pile=structuredClone(initial);m.positionMarbleOnLine(pile,x);const shooter=pile.at(-1),target=pile[0],dx=target.x-shooter.x,dy=target.y-shooter.y,n=Math.hypot(dx,dy);const prediction=m.predictMarbleContact(pile,dx/n*16.2,dy/n*16.2);if(prediction.contact?.colour!=='Red')continue;const shot=m.createMarbleShot('Red');shooter.vx=dx/n*16.2;shooter.vy=dy/n*16.2;settle(pile,shot);found=m.scoreMarbleShot(shot,'Red').points>0;}
  assert.ok(found,`${difficulty} must offer a scoring opportunity`);
 }
});
test('horizontal rail clamps positioning, preserves targets and reserves pull-back space',()=>{
 const pile=board('easy',3,'scattered'),targets=structuredClone(pile.slice(0,-1)),shooter=pile.at(-1);
 for(const x of [-100,160,450,740,2000]){assert.ok(m.positionMarbleOnLine(pile,x));assert.equal(shooter.x,Math.max(160,Math.min(740,x)));assert.equal(shooter.y,m.MARBLES_LAUNCH.y);assert.ok(shooter.y+m.MARBLES_MAX_PULL+shooter.radius<m.MARBLES_HEIGHT);}
 assert.deepEqual(pile.slice(0,-1),targets);assert.equal(m.positionMarbleOnLine(pile,NaN),false);shooter.vx=1;assert.equal(m.positionMarbleOnLine(pile,450),false);
});
test('pull direction, power clamp and coordinate mapping are display independent',()=>{
 assert.deepEqual(m.marblePullVelocity(0,140),{x:0,y:-16.2,power:1});assert.deepEqual(m.marblePullVelocity(0,70),{x:0,y:-8.1,power:.5});assert.deepEqual(m.marblePullVelocity(0,0),{x:0,y:0,power:0});
 assert.ok(Math.abs(Math.hypot(...Object.values(m.marblePullVelocity(300,400)).slice(0,2))-16.2)<1e-8);
 for(const width of [260,320,600,900])assert.deepEqual(m.marbleCanvasPoint(10+width/2,20+width*.8,{left:10,top:20,width,height:width}),{x:450,y:720});
});
test('prediction uses expanded circles and entry distance instead of centre distance',()=>{
 const shooter=ball(100,undefined,450,700,false),near=ball(1,'Red',480,400,true,10),first=ball(9,'Blue',450,420,true,25);
 const prediction=m.predictMarbleContact([near,first,shooter],0,-16.2);assert.equal(prediction.contact.id,9);assert.equal(prediction.contact.y,465);
 const tangent=m.predictMarbleContact([ball(2,'Green',488,400),shooter],0,-16.2);assert.equal(tangent.contact.id,2);
 assert.equal(m.predictMarbleContact([first,shooter],0,-.5).contact,null,'weak shots cannot reach distant contacts');
});
test('prediction and actual first contact agree, including deterministic simultaneous contacts',()=>{
 for(const reverse of [false,true]){
  const targets=[ball(2,'Red',430,400),ball(1,'Blue',470,400)];const shooter=ball(100,undefined,450,500,false),pile=[...(reverse?targets.reverse():targets),shooter];
  const prediction=m.predictMarbleContact(pile,0,-16.2);assert.equal(prediction.contact.id,1);const shot=m.createMarbleShot('Blue');shooter.vy=-16.2;settle(pile,shot);assert.equal(shot.first.id,prediction.contact.id);assert.equal(shot.target,'Blue');assert.equal(new Set(shot.captured.map(b=>b.id)).size,shot.captured.length);
 }
});
test('rolling-range prediction matches isolated physics stopping distance',()=>{
 for(const speed of [.5,3,8,16.2]){const shooter=ball(100,undefined,450,850,false);shooter.vy=-speed;const shot=m.createMarbleShot();const distance=m.marbleRollingRange(speed);settle([shooter],shot);if(distance<800)assert.ok(Math.abs(850-shooter.y-distance)<1e-7);}
});
test('full-body ring exit is consistent in every direction and can occur before a wall',()=>{
 const r=22,R=m.MARBLES_RING;assert.ok(R.y-R.radius>r*2);
 for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const marble=ball(0,'Blue',R.x+dx*(R.radius+r),R.y+dy*(R.radius+r),true,r);m.advanceMarbles([marble]);assert.equal(marble.captured,false);
  marble.x+=dx*.01;marble.y+=dy*.01;const shot=m.createMarbleShot();m.advanceMarbles([marble],1,shot);assert.equal(marble.captured,true);assert.equal(shot.captured.length,1);m.advanceMarbles([marble],1,shot);assert.equal(shot.captured.length,1);
 }
});
test('radius-weighted impacts transfer momentum without adding energy',()=>{
 const target=ball(0,'Blue',450,410,true,22),shooter=ball(100,undefined,450,454,false,20);shooter.vy=-8;const expected=shooter.vy*400*Math.pow(.985,.5);m.advanceMarbles([target,shooter],.5,m.createMarbleShot());
 assert.ok(target.vy<0);assert.ok(Math.abs(target.vy*484+shooter.vy*400-expected)<1e-6);assert.ok(target.vy**2*484+shooter.vy**2*400<=8**2*400);
});
for(const [first,captured,expected] of [['Red',['Blue'],0],['Blue',[],0],['Blue',['Blue'],100],['Blue',['Blue','Blue'],250],['Blue',['Blue','Blue','Blue'],450],['Blue',['Blue','Green'],100],['Blue',['Blue','Blue','Blue','Blue'],650],['Blue',['Blue','Blue','Blue','Blue','Blue'],850]])test(`Blue target first ${first}, ${captured.length} mixed captures => ${expected}`,()=>{
 const shot=m.createMarbleShot('Blue');shot.first={id:90,colour:first};shot.captured=captured.map((colour,id)=>({id,colour}));assert.equal(m.scoreMarbleShot(shot,'Blue').points,expected);
});
