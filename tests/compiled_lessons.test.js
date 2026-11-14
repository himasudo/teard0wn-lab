import test from 'node:test';
import assert from 'node:assert/strict';
import {Machine,programFromImage,unsigned} from '../src/machine.js';
import {compiledLessons} from '../src/compiled.js';

// Each committed compiled lesson must run in the engine and reach its expected
// result, and every instruction must map to a real source line. This verifies
// the generated src/compiled.js without depending on reproducing exact gcc bytes.
for(const l of compiledLessons){
  test(`compiled lesson ${l.id} runs to its expected result`,()=>{
    const m=new Machine(programFromImage(l),l.input);
    let budget=4000000;
    while(budget>0&&!['halted','fault'].includes(m.status)){const used=m.run({limit:budget});budget-=used;if(!used)break;}
    assert.equal(m.status,'halted',`${l.id}: ${m.reason}`);
    assert.equal(unsigned(m.regs[0],l.retBits).toString(16).padStart(l.retBits/4,'0'),l.expect);
    assert.ok(l.insns.length>0&&l.entry>=0x1000);
    for(const i of l.insns)assert.ok(i.line===null||(i.line>=1&&i.line<=l.source.length),`${l.id} line ${i.line} out of range`);
  });
}
