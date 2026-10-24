import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({channel:'msedge',headless:true});
const p=await browser.newPage({viewport:{width:1024,height:768},hasTouch:true});
const checks=[],shots=[],errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install();
const scores=()=>p.locator('.player-score').evaluateAll(es=>es.map(e=>+e.getAttribute('aria-label').match(/, (\d+) points/)[1]));
async function open(suffix){await p.goto('http://127.0.0.1:5173/tests/browser/tin-sling-harness.html'+suffix);await p.locator('.sling-scene').waitFor();await p.clock.runFor(600);await p.getByRole('button',{name:'Enter fullscreen',exact:true}).click();await p.clock.runFor(100);}
async function shot(angle,power,{pause=false,touch=false}={}){
 const ready=p.getByRole('button',{name:/^(Mary|Ahmad) is ready$/});if(await ready.count())await ready.click();
 const expected=await p.evaluate(([a,b])=>window.simulate(a,b),[angle,power]);
 await p.locator('.shot-adjustments summary').click();
 for(const [name,value] of [['Launch angle',angle],['Strength',power]])await p.getByRole('slider',{name:new RegExp('^'+name)}).evaluate((e,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,String(v));e.dispatchEvent(new Event('input',{bubbles:true}));},value);
 await p.locator('.shot-adjustments summary').click();
 const before=await scores();
 if(touch){const box=await p.locator('canvas').boundingBox(),cdp=await p.context().newCDPSession(p),r=angle*Math.PI/180;const start={x:box.x+189*box.width/1200,y:box.y+447*box.height/620};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x-Math.cos(r)*1.15*power/100*90*box.width/1200*i/6,y:start.y+Math.sin(r)*1.15*power/100*90*box.height/620*i/6}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 else await p.getByRole('button',{name:'Shoot ball',exact:true}).click();
 await p.clock.runFor(100);assert.deepEqual(await scores(),before);assert.ok(await p.getByRole('button',{name:'Shoot ball',exact:true}).isDisabled());
 if(pause){await p.getByRole('button',{name:'Pause',exact:true}).click();const image=await p.locator('canvas').evaluate(e=>e.toDataURL());await p.clock.runFor(600);assert.equal(await p.locator('canvas').evaluate(e=>e.toDataURL()),image);await p.getByRole('button',{name:'Resume',exact:true}).click();checks.push('pause freezes a moving Tin shot; resume continues it');}
 for(let i=0;i<80;i++){await p.clock.runFor(500);if(!await p.getByText('Wait for everything to settle…',{exact:true}).count())break;}
 await p.clock.runFor(120);assert.match(await p.locator('.arcade-status').innerText(),new RegExp(`Level score: ${expected.score}`));
 assert.ok(await p.locator('.player-score-value').evaluateAll(es=>es.every(e=>getComputedStyle(e).opacity==='1')));
 shots.push({angle,power,...expected,visible:await scores()});return expected;
}
if(process.env.TIN_TOUCH_ONLY==='1'){
 await open('?difficulty=easy');const box=await p.locator('canvas').boundingBox(),cdp=await p.context().newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+189*box.width/1200,y:box.y+447*box.height/620}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await p.clock.runFor(100);assert.deepEqual(await scores(),[0]);assert.match(await p.locator('.arcade-status').innerText(),/Balls left: 3/);checks.push('real touch cancellation uses no ball and awards no score');const r=await shot(10,100,{touch:true});assert.ok(r.score>0);assert.deepEqual(await scores(),[r.score]);checks.push('a real pull-and-release touch shot uses the same settled scoring as button controls');await browser.close();writeFileSync('docs/gameplay-audit/tin-touch-results.json',JSON.stringify({checks,shots,errors},null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors},null,2));process.exit(0);
}
await open('?practice');let r=await shot(10,100,{pause:true});assert.ok(!r.resolved&&r.score>0);assert.deepEqual(await scores(),[r.score,0]);checks.push('partial Tin captures update the live run total before the attempt ends');
await shot(75,12);r=await shot(75,12);assert.ok(r.resolved);const best=await scores();
await p.getByRole('button',{name:'Retry Level',exact:true}).click();await p.evaluate(()=>window.resetReplica());
for(let i=0;i<3;i++)await shot(75,12);assert.deepEqual(await scores(),best);checks.push('a weaker retry cannot remove earlier points or award duplicate tin points');
await p.getByRole('button',{name:'Retry Level',exact:true}).click();await p.evaluate(()=>window.resetReplica());await shot(10,100);r=await shot(10,70);assert.deepEqual(await scores(),[r.score,0]);checks.push('an improved retry adds only the improvement and the clear/unused-ball bonuses once');
await p.getByRole('button',{name:'Next player',exact:true}).click();await p.evaluate(()=>window.resetReplica());for(let i=0;i<3;i++)await shot(75,12);assert.deepEqual(await scores(),[r.score,0]);checks.push('Tin player handover keeps both totals separate');
await p.getByRole('button',{name:'Next Level',exact:true}).click();assert.match(await p.locator('.arcade-status').innerText(),/Level 2 of 5/);assert.deepEqual(await scores(),[r.score,0]);checks.push('next level preserves the earned run total');
await p.getByRole('button',{name:'Start new match',exact:true}).click();assert.deepEqual(await scores(),[0,0]);checks.push('Tin restart clears scores and retry credits');
for(const [difficulty,plans]of [['easy',[[10,100],[10,70]]],['medium',[[10,100],[30,55]]],['difficult',[[10,85],[40,55],[20,55]]]]){
 await open('?difficulty='+difficulty);let last;
 for(const [angle,power] of plans){last=await shot(angle,power);assert.deepEqual(await scores(),[last.score]);}
 assert.ok(last.resolved);assert.deepEqual(await p.evaluate(()=>window.results),[{scores:[last.score,0]}]);await p.setViewportSize({width:390,height:844});await p.clock.runFor(300);assert.equal(await p.evaluate(()=>window.results.length),1);await p.setViewportSize({width:1024,height:768});checks.push(`${difficulty} Tin Challenge completes with the simulated score and exactly one result`);
}
assert.deepEqual(errors,[]);mkdirSync('docs/gameplay-audit',{recursive:true});await p.screenshot({path:'docs/gameplay-audit/tin-complete.png'});await browser.close();writeFileSync('docs/gameplay-audit/tin-results.json',JSON.stringify({checks,shots,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
