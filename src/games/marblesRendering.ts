import {t} from '../i18n';
import {MARBLES_WIDTH as W,MARBLES_HEIGHT as H,MARBLES_RING as R,MARBLES_LAUNCH_LINE as L,MARBLES_MAX_PULL as P,MARBLE_STYLE,type Marble,type MarbleColour,type MarblePrediction} from './marblesPhysics';
import type {Difficulty} from './mechanics';
export type MarblesView={colour:string;player:0|1;target?:MarbleColour;positioning:boolean;moving:boolean;ready:boolean;difficulty:Difficulty;pull?:{x:number;y:number};power:number;prediction:{contact:MarblePrediction|null;end:{x:number;y:number};distance:number}};
export function drawMarblesBoard(ctx:CanvasRenderingContext2D,marbles:Marble[],view:MarblesView) {
  ctx.clearRect(0,0,W,H);
  const floor=ctx.createLinearGradient(0,0,0,H);floor.addColorStop(0,'#e6daca');floor.addColorStop(1,'#cbbda5');ctx.fillStyle=floor;ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#6c563411';for(let i=0;i<110;i++){ctx.beginPath();ctx.arc((i*83+29)%W,(i*47+61)%H,1+(i%3)*.3,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle='#ffffff20';ctx.beginPath();ctx.arc(R.x,R.y,R.radius,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#71573d';ctx.lineWidth=6;ctx.stroke();ctx.strokeStyle='#fff8ddaa';ctx.lineWidth=2;ctx.beginPath();ctx.arc(R.x,R.y,R.radius-5,0,Math.PI*2);ctx.stroke();
  // Dedicated launch apron and an explicit horizontal positioning rail.
  ctx.fillStyle='#f7f2e45c';ctx.fillRect(0,600,W,H-600);
  ctx.strokeStyle=view.positioning?'#17618d':'#627368';ctx.lineWidth=view.positioning?5:3;
  ctx.beginPath();ctx.moveTo(L.min,L.y);ctx.lineTo(L.max,L.y);ctx.stroke();
  for(const x of [L.min,L.max]){ctx.beginPath();ctx.moveTo(x,L.y-10);ctx.lineTo(x,L.y+10);ctx.stroke();}
  const shooter=marbles.find(m=>!m.target)!;
  if(!view.moving && view.ready) {
    ctx.save();ctx.strokeStyle='#45665b66';ctx.lineWidth=2;ctx.setLineDash([7,9]);ctx.beginPath();ctx.arc(shooter.x,shooter.y,P,0,Math.PI);ctx.stroke();ctx.restore();
    if(view.positioning){ctx.strokeStyle='#17618d';ctx.lineWidth=3;ctx.strokeRect(shooter.x-49,shooter.y-31,98,62);ctx.fillStyle='#17618d';ctx.font='bold 30px system-ui';ctx.textAlign='center';ctx.fillText('\u2190',shooter.x-70,shooter.y+10);ctx.fillText('\u2192',shooter.x+70,shooter.y+10);}
    else {
      const prediction=view.prediction, contact=prediction.contact;
      const dx=prediction.end.x-shooter.x,dy=prediction.end.y-shooter.y,d=Math.hypot(dx,dy)||1;
      const distance=Math.min(d,view.difficulty==='easy'?Infinity:view.difficulty==='medium'?300:95);
      const end={x:shooter.x+dx/d*distance,y:shooter.y+dy/d*distance};
      ctx.save();ctx.strokeStyle=view.difficulty==='easy'&&contact?(contact.colour===view.target?'#216b45':'#a2492f'):'#305c68';ctx.lineWidth=3;
      ctx.setLineDash([9,7]);ctx.beginPath();ctx.moveTo(shooter.x,shooter.y);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.setLineDash([]);
      ctx.beginPath();ctx.arc(end.x,end.y,6,0,Math.PI*2);ctx.stroke();
      if(contact && view.difficulty!=='difficult') {
        const target=marbles.find(m=>m.id===contact.id)!;
        ctx.beginPath();ctx.arc(target.x,target.y,target.radius+10,0,Math.PI*2);ctx.stroke();
        if(view.difficulty==='easy') {ctx.beginPath();ctx.moveTo(target.x,target.y);ctx.lineTo(target.x+contact.normal.x*56,target.y+contact.normal.y*56);ctx.stroke();}
      }
      ctx.restore();
    }
    if(view.pull && !view.positioning) {
      ctx.strokeStyle=view.colour;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(shooter.x,shooter.y);ctx.lineTo(view.pull.x,view.pull.y);ctx.stroke();
      ctx.strokeStyle='#fffdf2';ctx.lineWidth=2;ctx.beginPath();ctx.arc(view.pull.x,view.pull.y,12,0,Math.PI*2);ctx.stroke();
    }
    ctx.strokeStyle=view.colour;ctx.lineWidth=6;ctx.beginPath();ctx.arc(shooter.x,shooter.y,33,-Math.PI/2,-Math.PI/2+Math.PI*2*view.power);ctx.stroke();
  }
  for(const m of marbles) {
    if(m.captured)continue;
    ctx.save();ctx.shadowColor='#25201438';ctx.shadowBlur=5;ctx.shadowOffsetY=4;
    const glass=ctx.createRadialGradient(m.x-m.radius*.38,m.y-m.radius*.42,1,m.x,m.y,m.radius);
    glass.addColorStop(0,'#fffef2');glass.addColorStop(.23,m.color);glass.addColorStop(.75,m.color);glass.addColorStop(1,'#243d46');
    ctx.fillStyle=glass;ctx.beginPath();ctx.arc(m.x,m.y,m.radius,0,Math.PI*2);ctx.fill();ctx.shadowColor='transparent';
    ctx.strokeStyle='#fff8e4b0';ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle='#ffffffaa';ctx.beginPath();ctx.ellipse(m.x-m.radius*.4,m.y-m.radius*.45,m.radius*.23,m.radius*.12,-.7,0,Math.PI*2);ctx.fill();
    if(m.target&&m.group){ctx.font=`800 ${Math.round(m.radius)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.strokeStyle='#17313d';ctx.lineWidth=2;ctx.strokeText(MARBLE_STYLE[m.group].symbol,m.x,m.y+1);ctx.fillStyle='#fff';ctx.fillText(MARBLE_STYLE[m.group].symbol,m.x,m.y+1);}
    else {ctx.strokeStyle='#f3fffa';ctx.lineWidth=3;ctx.beginPath();if(view.player===0){ctx.arc(m.x,m.y,m.radius*.55,.2,Math.PI*1.7);}else{const r=m.radius*.48;ctx.moveTo(m.x-r,m.y-r);ctx.lineTo(m.x+r,m.y+r);ctx.moveTo(m.x+r,m.y-r);ctx.lineTo(m.x-r,m.y+r);}ctx.stroke();}
    ctx.restore();
  }
  ctx.fillStyle='#345548';ctx.font='600 20px system-ui';ctx.textAlign='center';ctx.fillText(t(view.positioning?'Slide along the launch line':'Pull back to aim and release'),W/2,H-12);ctx.textAlign='start';
}
