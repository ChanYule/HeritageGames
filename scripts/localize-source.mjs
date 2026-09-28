// One-time migration: emits an apply_patch patch; never writes source files itself.
import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
const { outputText } = ts.transpileModule(readFileSync('src/locales/zh.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { zh } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const files = ['src/App.tsx', ...['components', 'games'].flatMap(dir => readdirSync(`src/${dir}`).filter(f => f.endsWith('.tsx') && f !== 'LanguageSwitcher.tsx').map(f => `src/${dir}/${f}`))];
let patch = '*** Begin Patch\n';
for (const file of files) {
  const original = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const source = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const add = (node, value) => edits.push({ start: node.getStart(source), end: node.end, value });
  const keyOf = node => ts.isTemplateExpression(node) ? node.head.text + node.templateSpans.map((s,i) => `{${i}}${s.literal.text}`).join('') : node.text;
  const technical = new Set(['on','off','left','right','toss','collect','wait','catch','complete']);
  function render(node, allowTechnical = false) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      return Object.hasOwn(zh,node.text) && (!technical.has(node.text) || allowTechnical) ? `t(${JSON.stringify(node.text)})` : node.getText(source);
    }
    if (ts.isTemplateExpression(node) && Object.hasOwn(zh,keyOf(node))) {
      return `t(${JSON.stringify(keyOf(node))}, ${node.templateSpans.map(s => render(s.expression,true)).join(', ')})`;
    }
    const children = [];
    ts.forEachChild(node, c => { children.push(c); });
    let value = node.getText(source);
    for (const c of children.reverse()) {
      const replacement = render(c,allowTechnical);
      value = value.slice(0,c.getStart(source)-node.getStart(source)) + replacement + value.slice(c.end-node.getStart(source));
    }
    return value;
  }
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) return;
    // Module-level game definitions stay in English and are translated where displayed.
    if (ts.isVariableStatement(node) && node.parent === source) return;
    if (ts.isJsxAttribute(node)) {
      if (!['aria-label','aria-roledescription','title','subtitle','objective','tip','description','placeholder','backLabel'].includes(node.name.text)) return;
      if (node.initializer && ts.isStringLiteral(node.initializer) && Object.hasOwn(zh,node.initializer.text)) {
        add(node.initializer,`{t(${JSON.stringify(node.initializer.text)})}`); return;
      }
    }
    if (ts.isJsxText(node)) {
      const key = node.text.replace(/\s+/g,' ').trim();
      if (Object.hasOwn(zh,key)) {
        const leading = /^\s/.test(node.text) ? ' ' : '';
        const trailing = /\s$/.test(node.text) ? ' ' : '';
        edits.push({start:node.pos,end:node.end,value:`${leading}{t(${JSON.stringify(key)})}${trailing}`});
      }
      return;
    }
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'setMessage') {
      add(node,`setMessage(() => () => ${render(node.arguments[0])})`); return;
    }
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'useState' && ts.isVariableDeclaration(node.parent) && node.parent.name.getText(source) === '[message, setMessage]') {
      const arg = node.arguments[0];
      add(node,`useState(() => () => ${render(ts.isArrowFunction(arg) ? arg.body : arg)})`); return;
    }
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'useState' && ts.isVariableDeclaration(node.parent) && node.parent.name.getText(source).includes('competitionName')) return;
    if (ts.isIdentifier(node) && node.text === 'message' && ts.isJsxExpression(node.parent)) { add(node,'message()'); return; }
    if (ts.isTemplateExpression(node) && Object.hasOwn(zh,keyOf(node))) { add(node,render(node)); return; }
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && Object.hasOwn(zh,node.text) && !technical.has(node.text)) {
      if (ts.isPropertyAssignment(node.parent) && node.parent.name === node) return;
      if (ts.isBinaryExpression(node.parent) && [ts.SyntaxKind.EqualsEqualsEqualsToken,ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(node.parent.operatorToken.kind)) return;
      add(node,render(node)); return;
    }
    if (ts.isFunctionDeclaration(node) && node.name && /^[A-Z]/.test(node.name.text) && node.body) {
      edits.push({start:node.body.getStart(source)+1,end:node.body.getStart(source)+1,value:'\n  useLanguage();'});
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  let updated = original;
  for (const e of edits.sort((a,b)=>b.start-a.start)) updated = updated.slice(0,e.start)+e.value+updated.slice(e.end);
  updated = `import { t, useLanguage } from "${file === 'src/App.tsx' ? './' : '../'}i18n";\n`+updated;
  patch += `*** Update File: ${file}\n@@\n`+original.trimEnd().split('\n').map(l=>'-'+l).join('\n')+'\n'+updated.trimEnd().split('\n').map(l=>'+'+l).join('\n')+'\n';
}
console.log(patch+'*** End Patch');
