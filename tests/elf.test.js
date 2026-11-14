import test from 'node:test';
import assert from 'node:assert/strict';
import {elf} from '../src/elfdata.js';

test('extracted ELF data is internally consistent', () => {
  assert.match(elf.header.type, /DYN/);
  assert.ok(elf.interp.startsWith('/'), 'has a dynamic linker path');
  assert.ok(elf.segments.some(s => s.type === 'LOAD' && s.flags === 'R E'), 'an executable LOAD segment');
  assert.ok(elf.sections.some(s => s.name === '.plt' || s.name === '.plt.sec'), 'a PLT section');
  // the heart of lazy binding: the stub jumps through the slot the relocation patches
  assert.equal(elf.pltStub.gotTarget, elf.reloc.offset);
  assert.equal(elf.reloc.type, 'R_X86_64_JUMP_SLOT');
  assert.match(elf.relocStory.obj, /^e8 00 00 00 00$/, 'the .o call is a zeroed placeholder');
  assert.notEqual(elf.relocStory.linked, elf.relocStory.obj, 'the linker filled the offset');
});
