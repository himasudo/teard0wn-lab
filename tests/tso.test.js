import test from 'node:test';
import assert from 'node:assert/strict';
import {explore,questionReachable,litmus} from '../src/tso.js';

const byId=id=>litmus.find(l=>l.id===id);

test('SB allows both reads to return 0 under TSO', () => {
  const r=explore(byId('sb'));
  assert.ok(r.has('0,0'), 'the store-buffer relaxation (0,0) is reachable');
  // the other three outcomes are also reachable
  for(const o of ['0,1','1,0','1,1']) assert.ok(r.has(o), `${o} reachable`);
});

test('MFENCE removes the SB reordering', () => {
  assert.equal(questionReachable(byId('sb-fence')), false);
  assert.ok(!explore(byId('sb-fence')).has('0,0'));
});

test('MP forbids seeing the flag set but stale data', () => {
  const r=explore(byId('mp'));
  assert.equal(r.has('1,0'), false, '(flag=1, data=0) must be unreachable');
  assert.ok(r.has('1,1') && r.has('0,0'), 'ordered outcomes are reachable');
});

test('LB forbids both loads returning 1 under TSO', () => {
  assert.equal(explore(byId('lb')).has('1,1'), false);
});

test('WRC preserves write-to-read causality without a fence', () => {
  assert.equal(questionReachable(byId('wrc')), false, 'the causality-violating outcome is unreachable under TSO');
});

test('IRIW forbids the two readers disagreeing on store order', () => {
  assert.equal(questionReachable(byId('iriw')), false, 'multi-copy atomicity: a single global store order');
});

test('each litmus test\'s declared verdict matches the model', () => {
  for(const l of litmus){
    const reachable=questionReachable(l);
    assert.equal(reachable, l.tso==='allowed', `${l.id}: declared ${l.tso} but model says ${reachable?'reachable':'unreachable'}`);
  }
});
