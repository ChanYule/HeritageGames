import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import ts from 'typescript';
const source=readFileSync(new URL('../src/games/stickPhysics.ts',import.meta.url),'utf8');
const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}});
const m=await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const stick=(id,x=450,y=280,angle=0)=>({id,x,y,angle,length:230,width:8,color:'#fff',name:'Purple',points:50,removed:false});
test('pointer coordinates map equally in portrait, landscape and scaled boards',()=>{
 for(const [width,height] of [[900,560],[450,280],[225,140]]) assert.deepEqual(m.mapStickPoint(20+width/2,30+height/2,{left:20,top:30,width,height}),{x:450,y:280});
});
test('forgiving selection chooses the rendered upper layer and ignores removed sticks',()=>{
 const pile=[stick(0),stick(1)]; assert.equal(m.selectStick(pile,{x:450,y:300},'easy').id,1);
 pile[1].removed=true;assert.equal(m.selectStick(pile,{x:450,y:280},'easy').id,0);
 assert.equal(m.selectStick(pile,{x:100,y:100},'easy'),undefined);
});
test('capsule contacts cover crossings, parallel contacts and endpoint separation',()=>{
 assert.ok(m.contact(stick(0),stick(1,450,280,90)));
 assert.ok(m.contact(stick(0),stick(1,450,287)));
 assert.ok(!m.contact(stick(0),stick(1,450,300)));
 assert.ok(!m.contact(stick(0),stick(1,800,280)));
 assert.ok(m.blocked(stick(0),[stick(0),stick(1,450,280,90)]));
 assert.ok(!m.blocked(stick(1),[stick(0),stick(1)]));
});
test('top extraction moves visibly, requires travel, and completes without moving lower sticks',()=>{
 const pile=[stick(0),stick(1,450,280,90)];let a=m.beginExtraction(pile,1);
 a=m.moveExtraction(a,0,12,'easy');assert.equal(a.complete,false);assert.equal(a.pile[1].y,292);assert.deepEqual(a.pile[0],pile[0]);
 for(let i=0;i<8;i++) a=m.moveExtraction(a,0,12,'easy');
 assert.ok(a.complete);assert.equal(a.disturbed,null);assert.equal(pile[1].y,280);
 assert.equal(m.moveExtraction(a,200,200,'easy'),a);
});
test('underneath extraction transfers physical movement and fails once',()=>{
 let a=m.beginExtraction([stick(0),stick(1,450,280,90)],0);
 a=m.moveExtraction(a,120,0,'medium',40);assert.equal(a.disturbed,1);assert.ok(a.pile[1].x>450);assert.equal(a.complete,false);
 assert.equal(m.moveExtraction(a,100,0,'medium'),a);
});
test('slow dragging transfers less contact motion than sudden dragging',()=>{
 const a=m.beginExtraction([stick(0),stick(1,450,280,90)],0);
 const slow=m.moveExtraction(a,4,0,'easy',400),fast=m.moveExtraction(a,4,0,'easy',16);
 assert.ok(fast.pile[1].x>slow.pile[1].x);
});
test('swept fast input cannot tunnel through crossing sticks',()=>{
 const a=m.moveExtraction(m.beginExtraction([stick(0,100),stick(1,400,280,90)],0),500,0,'difficult',16);
 assert.equal(a.disturbed,1);assert.equal(a.complete,false);
});
test('translation and angular tolerances ignore numerical jitter',()=>{
 const base=[stick(0),stick(1)];let pile=base.map(s=>({...s}));pile[1].x+=.001;pile[1].angle+=.001;
 assert.equal(m.disturbance(pile,base,0,'difficult'),null);
 pile[1].x+=3;assert.equal(m.disturbance(pile,base,0,'difficult'),1);assert.equal(m.disturbance(pile,base,0,'easy'),null);
 pile=base.map(s=>({...s}));pile[1].angle=2;assert.equal(m.disturbance(pile,base,0,'medium'),1);
});
test('streak thresholds award each bonus only at its exact pickup',()=>{
 assert.deepEqual([1,2,3,4,5,6].map(n=>m.pickupAward(10,n).total),[10,10,30,10,60,10]);
 assert.equal(m.pickupAward(50,3).total,70);assert.equal(m.pickupAward(50,1).total,50);
});
for(const [difficulty,count] of [['easy',10],['medium',18],['difficult',28]]) test(`${difficulty} seeded piles have valid free extractions`,()=>{
 assert.equal(m.stickTuning[difficulty].count,count);
 for(let seed=0;seed<100;seed++) {
  const pile=m.createSticks(difficulty,seed);assert.equal(pile.length,count);assert.deepEqual(pile,m.createSticks(difficulty,seed));
  while(pile.some(s=>!s.removed)) {
   const top=pile.findLast(s=>!s.removed);assert.ok(!m.blocked(top,pile));
   const a=m.moveExtraction(m.beginExtraction(pile,top.id),110,0,difficulty,1000);assert.ok(a.complete);
   top.removed=true;
  }
 }
});
test('missions use available colours and award separately only once',()=>{
 const pile=[stick(0)];const mission=m.createMission(pile);assert.equal(mission.name,'Purple');
 const result=m.advanceMission(mission,pile[0]);assert.equal(result.bonus,30);assert.equal(m.advanceMission(result.mission,pile[0]).bonus,0);
 assert.equal(m.createMission([{...pile[0],removed:true}]),null);assert.equal(m.advanceMission(null,pile[0]).bonus,0);
});
test('cancelling restores a cloneable baseline and restart uses the same challenge seed',()=>{
 const pile=m.createSticks('medium',42),a=m.moveExtraction(m.beginExtraction(pile,17),12,0,'medium');
 assert.deepEqual(a.baseline,pile);assert.notDeepEqual(a.pile,pile);assert.deepEqual(m.createSticks('medium',42),pile);
});
