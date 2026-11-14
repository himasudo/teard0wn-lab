import test from 'node:test';
import assert from 'node:assert/strict';
import {Microarch,LINE,PAGE} from '../src/micro.js';

const rd = a => ({lastAccesses:[{address:a,write:false}], lastBranch:null});
const feed = (m, addrs) => addrs.forEach(a => m.observe(rd(a)));

test('a reused line misses once then hits in L1', () => {
  const m = new Microarch();
  for (let i = 0; i < 100; i++) m.observe(rd(0x2000));
  assert.equal(m.stats.DRAM, 1);   // cold miss installs the line
  assert.equal(m.stats.L1, 99);    // every later access hits L1
});

test('rescanning data that fits in L1 hits L1 the second time', () => {
  const m = new Microarch();
  const n = 512, scan = Array.from({length: n}, (_, i) => i * LINE); // 512 lines < 768
  feed(m, scan); assert.equal(m.stats.DRAM, n);     // first pass: all cold
  m.stats.L1 = 0;
  feed(m, scan); assert.equal(m.stats.L1, n);        // second pass: all L1
});

test('a scan larger than L1 but within L2 falls to L2 on rescan', () => {
  const m = new Microarch();
  const n = 2000, scan = Array.from({length: n}, (_, i) => i * LINE); // >768, <8192
  feed(m, scan);
  const before = {...m.stats};
  feed(m, scan);
  const l2 = m.stats.L2 - before.L2, l1 = m.stats.L1 - before.L1;
  assert.equal(l2, n);   // every line hits in L2 on the second pass
  assert.equal(l1, 0);   // none stay resident in L1
});

test('the bimodal predictor learns a biased branch', () => {
  const m = new Microarch();
  for (let i = 0; i < 100; i++) m.observe({lastAccesses: [], lastBranch: {pc: 0x1000, taken: true}});
  const mp = m.stats.mispred;
  for (let i = 0; i < 50; i++) m.observe({lastAccesses: [], lastBranch: {pc: 0x1000, taken: true}});
  assert.equal(m.stats.mispred, mp);        // no new mispredicts once learned
  assert.ok(mp <= 2);                        // learned within a couple of iterations
});

test('TLB pressure forces page walks, then warm pages hit', () => {
  const m = new Microarch();
  for (let p = 0; p < 200; p++) m.observe(rd(p * PAGE));  // 200 pages > 64-entry DTLB
  assert.ok(m.stats.walks > 0);
  const w = m.stats.walks;
  for (let p = 0; p < 32; p++) m.observe(rd(p * PAGE));   // recently-used pages stay warm
  assert.equal(m.stats.walks, w);                          // no new walks
});

test('cycles accumulate base + miss penalties and reset cleanly', () => {
  const m = new Microarch();
  m.observe(rd(0x2000));                 // base + DRAM + walk (cold)
  assert.ok(m.cycles >= 200);
  m.reset();
  assert.equal(m.cycles, 0);
  assert.equal(m.stats.insns, 0);
});
