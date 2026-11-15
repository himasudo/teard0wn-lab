// Triage classification is checked against the fault strings the engine
// actually produces for each crash class.
import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyFault} from '../src/triage.js';

test('a far out-of-bounds write is the highest-severity class', () => {
  const c = classifyFault('Unmapped write at 0x900000000.');
  assert.equal(c.bugClass, 'Out-of-bounds write');
  assert.equal(c.cwe, 'CWE-787');
  assert.equal(c.verdict, 'exploitable');
});

test('a far out-of-bounds read is an information-disclosure class', () => {
  const c = classifyFault('Unmapped read at 0x800002018.');
  assert.equal(c.bugClass, 'Out-of-bounds read');
  assert.equal(c.verdict, 'probably');
});

test('a near-null read is a null dereference, not exploitable', () => {
  const c = classifyFault('Unmapped memory: read at 0x0.');
  assert.equal(c.nearNull, true);
  assert.equal(c.bugClass, 'Null-pointer read');
  assert.equal(c.verdict, 'probably-not');
});

test('a divide fault corrupts nothing', () => {
  const c = classifyFault('Integer divide by zero.');
  assert.match(c.bugClass, /Arithmetic/);
  assert.equal(c.verdict, 'not-exploitable');
});
