// Run with PLAYWRIGHT_MODULE pointing to an installed Playwright module if it is not local.
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const sizes=[[1440,900],[768,1024],[1024,768],[820,1180],[1180,820],[1366,1024],[1280,800],[320,568],[360,640],[390,844],[414,896],[844,390],[667,375]];
const games=['marbles','pick-up-sticks','carom','tin-can-knockdown','sky-1942','galaxy-defenders'];
const results=[],errors=[];mkdirSync('docs/viewport-evidence',{recursive:true});
for(const fallback of [false,true]) {
 const context=await browser.newContext({viewport:{width:1024,height:768},hasTouch:true});
 if(fallback) await context.addInitScript(()=>Object.defineProperty(document,'fullscreenEnabled',{get:()=>false}));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const game of games) {
  await page.goto(`http://127.0.0.1:5173/?game=${game}`);await page.locator('.game-board-slot').waitFor();await page.waitForTimeout(200);
  const start=page.getByRole('button',{name:'Start Game',exact:true});if(await start.count())await start.click();
  const ready=page.getByRole('button',{name:'I am ready',exact:true});if(await ready.count())await ready.click();
  for(const mode of (fallback?['fallback']:['normal','native'])) {
   if(mode!=='normal') {await page.getByRole('button',{name:'Enter fullscreen',exact:true}).click();await page.waitForTimeout(100);}
   for(const [width,height] of sizes) {
    await page.setViewportSize({width,height});await page.waitForTimeout(100);
    if(mode==='normal')await page.locator('.measured-game-layout').evaluate(e=>window.scrollTo(0,e.getBoundingClientRect().top+window.scrollY));
    const result=await page.locator('.measured-game-layout').evaluate((root,{game,mode,width,height})=>{
     const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
     const board=root.querySelector('.sky-screen,.galaxy-screen,.canvas-frame,.sticks-board,.carom-board,.sling-scene');
     const nodes=[board,...root.querySelectorAll('.game-essential-controls button,.game-essential-controls summary,.sky-controls button,.sky-joystick,.galaxy-controls button,.game-fullscreen-toolbar button')].filter(e=>e && e.getBoundingClientRect().width && !e.closest('details:not([open]) .shot-adjustment-fields'));
     const outside=nodes.map(e=>({tag:e.className,text:e.textContent?.trim().slice(0,35),...rect(e)})).filter(r=>r.x< -1||r.y< -1||r.right>innerWidth+1||r.bottom>innerHeight+1);
     const b=rect(board);
     const clipped=nodes.filter(e=>{const r=e.getBoundingClientRect();for(let parent=e.parentElement;parent&&parent!==root;parent=parent.parentElement){const c=getComputedStyle(parent);if(c.overflowX==='hidden'||c.overflowY==='hidden'){const a=parent.getBoundingClientRect();if(r.left<a.left-1||r.right>a.right+1||r.top<a.top-1||r.bottom>a.bottom+1)return true;}}return false;}).map(e=>e.className);
     const controls=root.querySelector('.game-essential-controls').getBoundingClientRect();
     const overlap=Math.max(0,Math.min(b.right,controls.right)-Math.max(b.x,controls.x))*Math.max(0,Math.min(b.bottom,controls.bottom)-Math.max(b.y,controls.y));
     return {game,mode,width,height,board:b,outside,clipped,overlap,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,native:!!document.fullscreenElement,overflow:root.scrollHeight>root.clientHeight+2,ratio:b.width/b.height};
    },{game,mode,width,height});results.push(result);
    if(mode==='native' && ((width===1024&&height===768)||(width===667&&height===375)))await page.screenshot({path:`docs/viewport-evidence/${game}-${width}x${height}.png`});
   }
   if(mode!=='normal')await page.locator('.game-fullscreen-toolbar .game-fullscreen-button').click();
  }
 }
 await context.close();
}
await browser.close();writeFileSync('docs/viewport-evidence/results.json',JSON.stringify({results,errors},null,2));
const ratios={'marbles':900/700,'pick-up-sticks':900/560,'carom':1,'tin-can-knockdown':1200/620,'sky-1942':2/3,'galaxy-defenders':2/3};
const failures=results.filter(r=>Math.abs(r.ratio-ratios[r.game])>.02||r.pageOverflow||r.outside.length||r.clipped.length||r.overlap>1||r.overflow||r.board.width<20||((r.mode==='native')!==r.native));
console.log(JSON.stringify({checks:results.length,failures,errors},null,2));if(failures.length||errors.length)process.exitCode=1;
