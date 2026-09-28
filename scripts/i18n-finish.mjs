import ts from 'typescript';
import { readFileSync } from 'node:fs';
const { outputText } = ts.transpileModule(readFileSync('src/locales/zh.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const {zh}=await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const files=['src/components/Competition.tsx',...['Marbles','PickUpSticks','FiveStones','Chapteh'].map(x=>`src/games/${x}Game.tsx`)];
let patch='*** Begin Patch\n';
for(const file of files){
 const old=readFileSync(file,'utf8').replace(/\r\n/g,'\n');
 let text=old;
 if(file.includes('Competition')) text=text.replaceAll('<main className="competition-page premium-page professional-page">','<main className="competition-page premium-page professional-page">\n        <div className="competition-language"><LanguageSwitcher /></div>');
 const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const edits=[];
 function walk(node,steps=false){
   if(ts.isJsxAttribute(node)) steps=node.name.text==='steps';
   if(steps && (ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)) && Object.hasOwn(zh,node.text)) edits.push([node.getStart(sf),node.end,`t(${JSON.stringify(node.text)})`]);
   else if(steps && ts.isTemplateExpression(node)){
     const key=node.head.text+node.templateSpans.map((s,i)=>`{${i}}${s.literal.text}`).join('');
     if(Object.hasOwn(zh,key)){edits.push([node.getStart(sf),node.end,`t(${JSON.stringify(key)}, ${node.templateSpans.map(s=>s.expression.getText(sf)).join(', ')})`]);return;}
   }
   ts.forEachChild(node,c=>walk(c,steps));
 }
 walk(sf);
 for(const [a,b,v] of edits.sort((a,b)=>b[0]-a[0]))text=text.slice(0,a)+v+text.slice(b);
 if(text!==old)patch+=`*** Update File: ${file}\n@@\n`+old.trimEnd().split('\n').map(l=>'-'+l).join('\n')+'\n'+text.trimEnd().split('\n').map(l=>'+'+l).join('\n')+'\n';
}
console.log(patch+'*** End Patch');
