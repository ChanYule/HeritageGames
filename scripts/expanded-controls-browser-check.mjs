import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {writeFileSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const b=await chromium.launch({channel:'msedge',headless:true});const p=await b.newPage({hasTouch:true});const results=[],errors=[];p.on('pageerror',e=>errors.push(e.message));
for(const game of ['marbles','pick-up-sticks','carom','tin-can-knockdown','sky-1942','galaxy-defenders']) {
 await p.setViewportSize({width:1024,height:768});await p.goto(`http://127.0.0.1:5173/?game=${game}`);await p.locator('.game-board-slot').waitFor();await p.locator('.game-header-actions .game-fullscreen-button').click();
 const start=p.getByRole('button',{name:'Start Game',exact:true});if(await start.count())await start.click();
 const ready=p.getByRole('button',{name:'I am ready',exact:true});if(await ready.count())await ready.click();
 const shotReady=p.locator('.arcade-controls').getByRole('button',{name:'Player 1 is ready',exact:true});if(await shotReady.count())await shotReady.click();
 const measure=async(state)=>{
  await p.waitForTimeout(100);
  const result=await p.locator('.measured-game-layout').evaluate((root,state)=>{
   const nodes=[...root.querySelectorAll('.game-essential-controls button,.game-essential-controls summary,.game-essential-controls input,.sky-controls button,.galaxy-controls button,.game-fullscreen-toolbar button')].filter(e=>e.getBoundingClientRect().width&&!e.closest('details:not([open]) .shot-adjustment-fields'));
   const outside=nodes.filter(e=>{const r=e.getBoundingClientRect();return r.x< -1||r.y< -1||r.right>innerWidth+1||r.bottom>innerHeight+1;}).map(e=>e.textContent||e.type);
   return {state,width:innerWidth,height:innerHeight,outside,overflow:root.scrollHeight>root.clientHeight+2};
  },state);results.push({game,...result});
 };
 for(const size of [[320,568],[667,375],[1024,768]]) {
  console.log(game,size);await p.setViewportSize({width:size[0],height:size[1]});
  const adjust=p.locator('.shot-adjustments');if(await adjust.count()) {await adjust.locator('summary').click();await measure('shot adjustments open');await adjust.locator('summary').click();}
  if(game==='marbles') {await p.getByRole('button',{name:'Move shooter',exact:true}).click();await measure('shooter placement');await p.getByRole('button',{name:'Done positioning',exact:true}).click();}
  await p.locator('.game-fullscreen-toolbar button[lang="zh-Hans"]').click();await p.evaluate(()=>document.documentElement.dataset.largeText='true');await measure('Chinese and larger text');
  if(game==='pick-up-sticks'&&size[0]===320)await p.screenshot({path:'docs/viewport-evidence/pick-up-sticks-chinese-320x568.png'});
  await p.locator('.game-fullscreen-toolbar button[lang="en"]').click();await p.evaluate(()=>document.documentElement.dataset.largeText='false');
 }
}
await b.close();writeFileSync('docs/viewport-evidence/expanded-controls-results.json',JSON.stringify({results,errors},null,2));const failures=results.filter(r=>r.outside.length||r.overflow);console.log(JSON.stringify({checks:results.length,failures,errors},null,2));assert.equal(failures.length,0);assert.deepEqual(errors,[]);
