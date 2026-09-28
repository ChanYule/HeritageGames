import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
const files = ['src/App.tsx', ...['components', 'games'].flatMap(dir => readdirSync(`src/${dir}`).filter(f => f.endsWith('.tsx')).map(f => `src/${dir}/${f}`))];
const entries = new Set();
for (const file of files) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 't') return;
    if (ts.isImportDeclaration(node) || ts.isTypeAliasDeclaration(node)) return;
    if (ts.isJsxAttribute(node) && !['aria-label','title','placeholder','steps'].includes(node.name.text)) return;
    let value;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) value = node.text;
    if (ts.isJsxText(node)) value = node.text.replace(/\s+/g, ' ').trim();
    if (ts.isTemplateExpression(node)) value = node.head.text + node.templateSpans.map((s, i) => `{${i}}${s.literal.text}`).join('');
    if (value && /[A-Z]|[a-z] [a-z]/.test(value) && !/^(?:[.#/]|rgb|https|translate|rotate|input,|canvas|0 |M\d)/.test(value)) entries.add(value);
    ts.forEachChild(node, visit);
  }
  visit(source);
}
console.log(JSON.stringify([...entries], null, 2));
