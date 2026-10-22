import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const b=await chromium.launch({channel:'msedge',headless:true});
const sizes=[[1440,900],[1024,768],[1180,820],[1280,800],[1366,1024],[768,1024],[820,1180],[320,568],[360,640],[390,844],[414,896],[844,390],[667,375]];
const results=[],errors=[],dir='docs/marbles-interface';mkdirSync(dir,{recursive:true});
for(const mode of ['normal','native','fallback']){
 const c=await b.newContext({hasTouch:true,viewport:{width:1024,height:768}});
 if(mode==='fallback')await c.addInitScript(()=>Object.defineProperty(document,'fullscreenEnabled',{get:()=>false}));
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5173/?game=marbles');await p.locator('.game-board-slot').waitFor();await p.waitForTimeout(800);
 if(mode!=='normal')await p.getByRole('button',{name:'Enter fullscreen',exact:true}).click();
 for(const state of ['ready','active','paused']){
  if(state==='active'){await p.getByRole('button',{name:'I am ready',exact:true}).click();await p.getByRole('button',{name:'Turn timer',exact:true}).click();}
  if(state==='paused')await p.locator('.mobile-game-toolbar').getByRole('button',{name:'Pause',exact:true}).click();
  for(const [width,height] of sizes){
   await p.setViewportSize({width,height});await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(250);
   if(mode==='normal')await p.locator('.marble-redesign').evaluate(e=>window.scrollTo(0,e.getBoundingClientRect().top+scrollY));await p.waitForTimeout(100);
   const r=await p.locator('.marble-redesign').evaluate((root)=>{
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const visible=e=>e.getClientRects().length&&e.getBoundingClientRect().width&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('details:not([open]) button');
    const nodes=[...root.querySelectorAll('button,summary,.marble-hud,.marble-ready-card,.canvas-frame')].filter(visible);
    const outside=nodes.map(e=>({text:e.textContent?.slice(0,40),...rect(e)})).filter(r=>r.x< -1||r.y< -1||r.right>innerWidth+1||r.bottom>innerHeight+1);
    const clipped=nodes.filter(e=>{const r=rect(e);for(let a=e.parentElement;a&&a!==root;a=a.parentElement){if(getComputedStyle(a).overflow==='hidden'){const q=rect(a);if(r.x<q.x-1||r.y<q.y-1||r.right>q.right+1||r.bottom>q.bottom+1)return true;}}return false;}).map(e=>e.textContent?.slice(0,40));
    return {outside,clipped,overflow:root.scrollHeight>root.clientHeight+2,horizontal:document.documentElement.scrollWidth>innerWidth+1,board:rect(root.querySelector('canvas')),readyControls:[...root.querySelectorAll('.marble-shot-controls button,.shot-adjustments summary')].filter(visible).length};
   });results.push({mode,state,width,height,...r});
   if(mode==='native'&&[[1024,768],[768,1024],[390,844],[667,375]].some(s=>s[0]===width&&s[1]===height))await p.screenshot({path:`${dir}/${state}-${width}x${height}.png`});
  }
 }
 await c.close();
}
await b.close();const failures=results.filter(r=>r.outside.length||r.clipped.length||r.overflow||r.horizontal||Math.abs(r.board.width/r.board.height-1)>.01||(r.state==='ready'&&r.readyControls));writeFileSync(`${dir}/layout-results.json`,JSON.stringify({results,failures,errors},null,2));console.log(JSON.stringify({checks:results.length,failures:failures.map(r=>({mode:r.mode,state:r.state,width:r.width,height:r.height,outside:r.outside,clipped:r.clipped,overflow:r.overflow,readyControls:r.readyControls})),errors},null,2));assert.equal(failures.length,0);assert.deepEqual(errors,[]);
