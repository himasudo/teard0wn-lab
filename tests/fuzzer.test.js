import test from 'node:test';
import assert from 'node:assert/strict';
import {Fuzzer,coverageRun} from '../src/fuzzer.js';
import {programFromImage} from '../src/machine.js';
import {fuzzTargets} from '../src/fuzz.js';

const target = id => fuzzTargets.find(t => t.id === id);

test('coverage-guided fuzzing cracks the byte-gated target', () => {
  const f = new Fuzzer(target('f-crackme'));
  while (!f.crash && f.execs < 400000) f.step(2000);
  assert.ok(f.crash, `no crash in ${f.execs} execs`);
  assert.equal(f.crash.input >>> 0, 0x42421337);
  assert.match(f.crash.reason, /divide by zero/i);
  assert.ok(f.corpus.length >= 4, 'corpus grew through each gate (coverage guidance worked)');
});

test('the shallow target is found quickly', () => {
  const f = new Fuzzer(target('f-modhash'));
  while (!f.crash && f.execs < 100000) f.step(1000);
  assert.ok(f.crash, `no crash in ${f.execs} execs`);
  assert.match(f.crash.reason, /divide by zero/i);
});

test('the gated target crashes with a memory fault, not a divide', () => {
  const f = new Fuzzer(target('f-tablefault'));
  while (!f.crash && f.execs < 400000) f.step(2000);
  assert.ok(f.crash, `no crash in ${f.execs} execs`);
  assert.equal(f.crash.input & 0xffff, 0x3c5a, 'both byte gates were satisfied');
  assert.match(f.crash.reason, /read at 0x/i, 'the crash is an out-of-bounds read');
  assert.doesNotMatch(f.crash.reason, /divide/i);
});

test('the known crashing input faults; a benign input does not', () => {
  const p = programFromImage(target('f-crackme'));
  assert.equal(coverageRun(p, 0x42421337).fault, true);
  assert.equal(coverageRun(p, 0).fault, false);
  // reaching deeper gates covers strictly more instructions
  assert.ok(coverageRun(p, 0x00000037).cov.size > coverageRun(p, 0).cov.size);
});
