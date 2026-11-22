import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {researchIndex,labSelection,expectedSteps} from '../dist/assets/research.js';
import {parseTransfer,readEntry,revise,legacyKey,caseKey,prefix} from '../dist/assets/review-store.js';

const data = name=>JSON.parse(fs.readFileSync(new URL('../dist/data/'+name+'.json',import.meta.url)));
const atlas=data('atlas'), audit=data('audit'), index=researchIndex(atlas,audit);
const qname=t=>'Q'+(1+t%4)+' '+(2020+Math.floor(t/4));

test('selected cards and all eligible scores agree with the reference release',()=>{
  assert.equal(audit.scores.length,5472);
  assert.equal(new Set(audit.scores.map(r=>r.slice(0,3).join('/'))).size,5472);
  assert.equal(audit.scores.filter(r=>r[7]==='selected').length,22);
  for (const r of atlas.queues.flat()) {
    const v=index.record(r.ward,r.cat,r.t);
    assert.equal(v.O,r.observed); assert.equal(v.N,r.volume);
    assert.deepEqual(v.score,{expected:r.expected,low:r.low,high:r.high,z:r.z,decision:'selected'});
  }
  for(const [w,c,t] of audit.scores){
    const r=index.record(w,c,t), steps=expectedSteps(r,40);
    assert.ok(Math.abs(steps.p*r.N-r.score.expected)<=.05000001);
    assert.ok(r.N>=25 && r.T>=25 && r.A<=r.B && r.C<=r.D);
  }
});
test('worked example, empty quarter, historical baseline and sparse categories',()=>{
  const r=index.record(85,1,19);
  assert.deepEqual([r.H,r.T,r.A,r.B,r.C,r.D,r.O,r.N],[190,455,869,17341,520,3878,36,142]);
  assert.equal(r.prev.z,-3.621);
  assert.equal(index.record(85,1,18).reason,'unconfirmed');
  assert.equal(index.record(85,1,0).reason,'baseline');
  const map=new Map([[85,{}],[150,{}]]);
  assert.deepEqual(labSelection('#lab/x/999/-2/85',map),{w:85,c:1,t:19,peer:0});
  assert.deepEqual(labSelection('#lab/85/1/0/150',map),{w:85,c:1,t:0,peer:150});
});
test('review handoff accepts the original export, rejects invalid or repeated entries and preserves concurrent writes',async()=>{
  const store=new Map();
  globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
  const cases=atlas.queues.flat(),r=cases.at(-1);
  const entry={status:'Need more information',note:'Demo',updated:'2026-11-22T09:00:00.000Z'};
  const row={ward:r.ward,category:atlas.categories[r.cat],period:qname(r.t),...entry};
  const parse=x=>parseTransfer(JSON.stringify(x),cases,atlas.categories,qname);
  assert.deepEqual(parse([row]),[{r,entry}]);
  for(const x of [[row,row],[{...row,ward:0}],[{...row,updated:'yesterday'}],[{...row,note:'x'.repeat(601)}],[null]])assert.throws(()=>parse(x));
  store.set(legacyKey,JSON.stringify({[caseKey(r)]:entry}));
  assert.deepEqual(readEntry(r),entry);
  assert.equal(await revise(r,entry,null),'conflict');
  const edit={...entry,note:'Updated'};
  assert.equal(await revise(r,edit,entry),'saved');
  assert.equal(await revise(r,entry,entry),'conflict');
  assert.deepEqual(readEntry(r),edit);
  assert.ok(store.has(prefix+caseKey(r)));
  const second=cases[0]; assert.equal(await revise(second,entry,null),'saved');assert.deepEqual(readEntry(r),edit);
  globalThis.localStorage.setItem=()=>{throw Error('storage unavailable')};
  assert.equal(await revise(r,entry,edit),'session');assert.deepEqual(readEntry(r),entry);
});
