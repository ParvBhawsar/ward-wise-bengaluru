import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {researchIndex} from '../dist/assets/research.js';
import {loadEvidence} from '../dist/assets/evidence-client.js';

test('online evidence, peer selection, cache and service fallback', async t => {
  const data = name => JSON.parse(readFileSync(new URL('../dist/data/'+name+'.json', import.meta.url)));
  const index = researchIndex(data('atlas'), data('audit'));
  const wards = new Set([85,150]);
  const used = [];
  const fallback = () => { used.push('fallback'); return index; };
  const fetch = t.mock.method(globalThis,'fetch', async url => {
    used.push(url);
    const params = new URL(url,'https://example.org').searchParams;
    const category = Number(params.get('category'));
    const ids = [Number(params.get('ward'))];
    if(params.has('peer')) ids.push(Number(params.get('peer')));
    const series = Object.fromEntries(ids.map(w => [w,Array.from({length:20},(_,i) => index.record(w,category,i))]));
    return Response.json({version:1,parameters:index.parameters,series});
  });
  const first = await loadEvidence('#lab/85/1/19',wards,fallback);
  assert.deepEqual(first.record(85,1,19),index.record(85,1,19));
  assert.equal(await loadEvidence('#lab/85/1/0',wards,fallback),first);
  const peer = await loadEvidence('#lab/85/1/0/150',wards,fallback);
  assert.deepEqual(peer.record(150,1,0),index.record(150,1,0));
  assert.equal(used.length,2);
  fetch.mock.mockImplementationOnce(async () => Response.json({version:1}));
  assert.equal(await loadEvidence('#lab/85/2/0',wards,fallback),index);
  fetch.mock.mockImplementationOnce(async () => {throw Error('offline')});
  assert.equal(await loadEvidence('#lab/85/2/0',wards,fallback),index);
  assert.equal(used.filter(value=>value==='fallback').length,2);
  assert.deepEqual((await loadEvidence('#lab/85/2/0',wards,fallback)).record(85,2,0),index.record(85,2,0));
});
