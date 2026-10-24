import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true});const results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const game of ['marbles','pick-up-sticks','carom','tin-can-knockdown','sky-1942','galaxy-defenders']){
 await page.goto(`http://127.0.0.1:4173/?game=${game}`);await page.locator('.game-board-slot').waitFor();await page.waitForTimeout(500);
 const level=page.locator('.difficulty-picker').getByRole('button',{name:'Difficult',exact:true});if(await level.count())await level.click();
 await page.getByRole('button',{name:'Enter fullscreen',exact:true}).click();
 for(const name of ['Start Game','I am ready','Player 1 is ready']){const button=page.getByRole('button',{name,exact:true});if(await button.count())await button.click();}
 await page.waitForTimeout(700);
 if(game==='sky-1942'||game==='galaxy-defenders')await page.keyboard.down('Space');
 if(game==='marbles')await page.getByRole('button',{name:'Shoot marble',exact:true}).click();
 if(game==='carom')await page.getByRole('button',{name:'Shoot striker',exact:true}).click();
 if(game==='tin-can-knockdown')await page.getByRole('button',{name:'Shoot ball',exact:true}).click();
 if(game==='pick-up-sticks'){const stick=page.locator('.stick:not(.removed)').last();await stick.focus();await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');}
 const timing=await page.evaluate(()=>new Promise(resolve=>{
  const frames=[],tasks=[];let last=performance.now(),id=0;const start=last;
  const observer=PerformanceObserver.supportedEntryTypes.includes('longtask')?new PerformanceObserver(list=>tasks.push(...list.getEntries().map(e=>e.duration))):null;observer?.observe({type:'longtask',buffered:false});
  const frame=time=>{frames.push(time-last);last=time;if(time-start<6000)id=requestAnimationFrame(frame);else{observer?.disconnect();const sorted=frames.slice(1).sort((a,b)=>a-b);resolve({samples:sorted.length,meanFrameMs:sorted.reduce((s,x)=>s+x,0)/sorted.length,p95FrameMs:sorted[Math.floor(sorted.length*.95)],maxFrameMs:sorted.at(-1),longTasks:tasks.length,largestLongTaskMs:Math.max(0,...tasks)});}};id=requestAnimationFrame(frame);
 }));
 await page.keyboard.up('Space');results.push({game,...timing});console.log(JSON.stringify(results.at(-1)));await page.locator('.game-fullscreen-toolbar .game-fullscreen-button').click();
}
await browser.close();mkdirSync('docs/gameplay-audit',{recursive:true});writeFileSync('docs/gameplay-audit/frame-timing.json',JSON.stringify({environment:'Production build; headless Edge; 1280x800; 6 second samples after warm-up; desktop simulation only',results,errors},null,2));assert.deepEqual(errors,[]);assert.ok(results.every(r=>r.samples>0));
