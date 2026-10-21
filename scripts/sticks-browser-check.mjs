import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {writeFileSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const b=await chromium.launch({channel:'msedge',headless:true});
const p=await b.newPage({viewport:{width:1024,height:768},hasTouch:true});const errors=[],checks=[];p.on('pageerror',e=>errors.push(e.message));
const url='http://127.0.0.1:5173/tests/browser/sticks-harness.html';
const fullscreen=()=>p.getByRole('button',{name:'Enter fullscreen',exact:true}).click();
const select=async id=>{await p.locator(`[data-stick-id="${id}"]`).focus();await p.keyboard.press('Enter');};
const move=async(n=9)=>{const button=p.locator('.stick-directions').getByRole('button',{name:'Right',exact:true});for(let i=0;i<n;i++){if(await button.isDisabled())break;await button.click();}};
const scores=()=>p.locator('.player-score').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label').match(/, (\d+) points/)[1]));
await p.goto(url+'?individual');await fullscreen();
// Cancel a live captured pointer without a score or turn penalty.
const top=p.locator('[data-stick-id="9"]');const baseline=await top.getAttribute('style');const box=await top.boundingBox();
await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+box.width/2+10,box.y+box.height/2,{steps:4});
await p.locator('.sticks-board').dispatchEvent('pointercancel',{pointerId:1,isPrimary:true});await p.mouse.up();
assert.equal(await top.getAttribute('style'),baseline);assert.deepEqual(await scores(),['0']);checks.push('captured pointer cancellation restores the baseline without scoring');
await select(9);for(let i=0;i<6;i++)await p.keyboard.press('ArrowRight');assert.deepEqual(await scores(),['0']);for(let i=0;i<5;i++)await p.keyboard.press('ArrowRight');assert.deepEqual(await scores(),['10']);assert.ok((await top.getAttribute('class')).includes('removed'));checks.push('keyboard arrows award stick points only after complete travel');
await move();assert.deepEqual(await scores(),['10']);checks.push('completed pickup cannot score twice');
for(const id of [8,7,6,5]){await select(id);await move();}
assert.deepEqual(await scores(),['140']);checks.push('third and fifth pickups award +20 and +50 exactly once');
const styles=await p.locator('.stick:not(.removed)').evaluateAll(es=>es.map(e=>e.getAttribute('style')));
await p.setViewportSize({width:390,height:844});await p.waitForTimeout(150);assert.deepEqual(await scores(),['140']);
assert.deepEqual(await p.locator('.stick:not(.removed)').evaluateAll(es=>es.map(e=>e.getAttribute('style'))),styles);
await p.locator('.game-fullscreen-toolbar').getByRole('button',{name:'Exit fullscreen',exact:true}).click();assert.deepEqual(await scores(),['140']);checks.push('resize and fullscreen exit preserve scores and logical stick positions');
await fullscreen();
for(const id of [4,3,2,1,0]){await select(id);await move();}
assert.deepEqual(await p.evaluate(()=>window.results),[{scores:[330,0]}]);
await p.setViewportSize({width:1024,height:768});await p.waitForTimeout(120);assert.equal(await p.evaluate(()=>window.results.length),1);checks.push('clearing the pile reports the competition result once');
await p.goto(url+'?difficulty=medium');await fullscreen();await p.getByRole('button',{name:'I am ready',exact:true}).click();
await p.locator('.stick-pick-controls').getByRole('button',{name:'Hint',exact:true}).click();await p.locator('.stick-pick-controls').getByRole('button',{name:'Hint',exact:true}).click();await p.locator('.stick-pick-controls').getByRole('button',{name:'Hint',exact:true}).click();
assert.match(await p.locator('.stick-pick-controls').innerText(),/No free hints left/);
await select(17);await move();assert.deepEqual(await scores(),['10','0']);
// Select a genuinely blocked stick, using the same geometry exported by the production module.
const blockedId=await p.evaluate(async()=>{const m=await import('/src/games/stickPhysics.ts');const pile=[...document.querySelectorAll('.stick')].map(e=>({id:+e.dataset.stickId,x:parseFloat(e.style.left)*9,y:parseFloat(e.style.top)*5.6,length:parseFloat(e.style.width)*9,width:8,angle:+e.style.transform.match(/rotate\(([^d]+)/)[1],removed:false}));return pile.find(s=>m.blocked(s,pile)).id;});
await select(blockedId);await move(8);assert.deepEqual(await scores(),['10','0']);assert.ok(await p.getByRole('button',{name:'I am ready',exact:true}).isVisible());
assert.match(await p.locator('.play-status-bar').innerText(),/Ahmad/);assert.match(await p.locator('.play-status-bar').innerText(),/Streak 0/);assert.match(await p.locator('.stick-pick-controls').innerText(),/No points awarded/);checks.push('disturbance gives zero points, resets streak and hands the shared pile to Ahmad');
await p.getByRole('button',{name:'I am ready',exact:true}).click();assert.deepEqual(await scores(),['10','0']);
assert.equal(await p.evaluate(()=>window.results.length),0);checks.push('failed shared-pile turn does not submit an unfinished competition result');
// Resizing a captured pointer leaves the logical extraction intact, with no phantom motion.
await p.goto(url+'?individual');await fullscreen();
const dragBox=await p.locator('[data-stick-id="9"]').boundingBox();const mx=dragBox.x+dragBox.width/2,my=dragBox.y+dragBox.height/2;
await p.mouse.move(mx,my);await p.mouse.down();await p.mouse.move(mx+6,my);
const partial=await p.locator('[data-stick-id="9"]').getAttribute('style');
await p.setViewportSize({width:820,height:1180});await p.waitForTimeout(150);await p.mouse.move(mx+6,my);
assert.equal(await p.locator('[data-stick-id="9"]').getAttribute('style'),partial);
await p.locator('.sticks-board').dispatchEvent('pointercancel',{pointerId:1,isPrimary:true});await p.mouse.up();assert.deepEqual(await scores(),['0']);
checks.push('resizing during captured drag introduces no phantom movement or score');
await p.setViewportSize({width:1024,height:768});
// Genuine touch input through Chromium's input API, including cancellation.
await p.goto(url+'?individual&practice');await fullscreen();
const cdp=await p.context().newCDPSession(p);
const touchBox=await p.locator('[data-stick-id="9"]').boundingBox();
const startPoint={x:touchBox.x+touchBox.width/2,y:touchBox.y+touchBox.height/2};
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[startPoint]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.deepEqual(await scores(),['0']);
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[startPoint]});
const width=(await p.locator('.sticks-board').boundingBox()).width;
for(let i=1;i<=6;i++) {await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:startPoint.x+i*20*width/900,y:startPoint.y}]});await p.waitForTimeout(25);}
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.deepEqual(await scores(),['10']);
checks.push('real touch extraction and touch cancellation use the same scoring rules');
await p.locator('.stick-pick-controls').getByRole('button',{name:'New match',exact:true}).click();
assert.deepEqual(await scores(),['0']);assert.equal(await p.locator('.stick:not(.removed)').count(),10);checks.push('restart clears scores, streak, extraction and removed sticks');
// Optional mission configuration is available before entering fullscreen.
await p.locator('.game-fullscreen-toolbar').getByRole('button',{name:'Exit fullscreen',exact:true}).click();
await p.getByLabel('Colour mission').check();await fullscreen();
for(const id of [9,8,7,6,5,4,3,2,1,0]){await select(id);await move();}
assert.deepEqual(await scores(),['360']);checks.push('optional colour mission awards +30 separately from stick and streak points');
for(const game of ['carom','tin-can-knockdown']) {
 await p.setViewportSize({width:1024,height:768});await p.goto(`http://127.0.0.1:5173/?game=${game}`);await fullscreen();
 const controls=p.locator('.arcade-controls');
 const ready=controls.getByRole('button',{name:'Player 1 is ready',exact:true});await ready.click();
 await controls.getByRole('button',{name:game==='carom'?'Shoot striker':'Shoot ball',exact:true}).click();
 await p.waitForTimeout(70);await controls.getByRole('button',{name:'Pause',exact:true}).click();
 const canvas=p.locator('canvas');const frozen=await canvas.evaluate(e=>e.toDataURL());await p.waitForTimeout(200);
 assert.equal(await canvas.evaluate(e=>e.toDataURL()),frozen);
 await controls.getByRole('button',{name:'Resume',exact:true}).click();await p.waitForTimeout(100);
 assert.notEqual(await canvas.evaluate(e=>e.toDataURL()),frozen);checks.push(`${game}: pause freezes an active physics shot and resume continues it`);
}
assert.deepEqual(errors,[]);await b.close();writeFileSync('docs/viewport-evidence/gameplay-results.json',JSON.stringify({checks,errors},null,2));console.log(checks.join('\n'));

