import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const {outputText}=ts.transpileModule(readFileSync(new URL('../src/games/tinSlingScoring.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}});
const {creditSlingScore}=await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
test('Tin run totals credit every settled shot and a clear bonus once',()=>{
  const best=new Map();let total=0;
  for(const score of [100,300,850,850])total+=creditSlingScore(best,0,0,score);
  assert.equal(total,850);
});
test('a weaker or equal retry neither removes earned points nor farms duplicate points',()=>{
  const best=new Map();let total=creditSlingScore(best,0,0,300);
  for(const score of [0,100,200,300])total+=creditSlingScore(best,0,0,score);
  assert.equal(total,300);
  total+=creditSlingScore(best,0,0,850);assert.equal(total,850);
});
test('Tin scores stay separate for each level and player, and restart clears the ledger',()=>{
  const best=new Map();
  assert.equal(creditSlingScore(best,0,0,300),300);
  assert.equal(creditSlingScore(best,0,1,200),200);
  assert.equal(creditSlingScore(best,1,0,500),500);
  assert.equal(creditSlingScore(best,0,0,300),0);
  best.clear();assert.equal(creditSlingScore(best,0,0,300),300);
});
test('invalid Tin totals cannot corrupt the scoring ledger',()=>{
  const best=new Map();for(const score of [NaN,Infinity,-100,1.5,Number.MAX_SAFE_INTEGER+1])assert.equal(creditSlingScore(best,0,0,score),0);
  assert.equal(best.size,0);
});
