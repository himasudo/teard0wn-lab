import test from 'node:test';
import assert from 'node:assert/strict';
import {Machine,assemble,DATA,STACK,RETURN,hex} from '../src/machine.js';
import {lessons,verifyLesson} from '../src/lessons.js';
import {tracks} from '../src/curriculum.js';
const run=(source,initial={})=>{const m=new Machine(assemble(source),initial);m.run();return m;};
test('label case is ignored while character literal case is preserved',()=>{
 const m=run("MOV AL, 'A'\nRET\n.data\nTarget: .quad 0\nPointer: .quad TARGET");
 assert.equal(m.regs[0],65n);
 assert.equal(m.readMem(DATA+8,64),BigInt(DATA));
});
test('emits known x86-64 bytes, not private pseudo opcodes',()=>{
 assert.equal(Buffer.from(assemble('mov eax, edi\nadd eax, edi\nret').code).toString('hex'),'89f801f8c3');
 assert.equal(Buffer.from(assemble('mov rax, 0x1122334455667788\nret').code).toString('hex'),'48b88877665544332211c3');
});
test('executes bytes independently of source annotations',()=>{const p=assemble('mov eax, 7\nret');p.instructions[0].text='mov eax, 999';p.code[1]=42;const m=new Machine(p);m.run();assert.equal(m.regs[0],42n);});
test('32-bit writes zero high bits, 16/8-bit writes preserve them',()=>{
 assert.equal(run('mov eax, 1\nret',{rax:-1n}).regs[0],1n);
 assert.equal(run('mov ax, 1\nret',{rax:-1n}).regs[0],0xffffffffffff0001n);
 assert.equal(run('mov al, 1\nret',{rax:-1n}).regs[0],0xffffffffffffff01n);
});
test('extended register and low-byte REX aliases',()=>{const m=run('mov r12, -1\nmov r12b, 42\nmov rax, r12\nmov dil, 7\nret');assert.equal(m.regs[0],0xffffffffffffff2an);assert.equal(m.regs[7],7n);});
test('ADD distinguishes carry from signed overflow',()=>{
 const a=run('mov al, 127\nadd al, 1\nret');assert.equal(a.flags.OF,true);assert.equal(a.flags.CF,false);assert.equal(a.flags.SF,true);
 const b=run('mov al, 255\nadd al, 1\nret');assert.equal(b.flags.OF,false);assert.equal(b.flags.CF,true);assert.equal(b.flags.ZF,true);
});
test('subtraction borrow and CMP do not overwrite operands',()=>{const m=run('mov eax, 1\ncmp eax, 2\nret');assert.equal(m.regs[0],1n);assert.equal(m.flags.CF,true);assert.equal(m.flags.SF,true);});
test('INC preserves carry, MOV preserves all flags',()=>{const m=run('mov eax, 0\nsub eax, 1\ninc eax\nmov ebx, 99\nret');assert.equal(m.flags.CF,true);assert.equal(m.flags.ZF,true);});
test('logical operations expose undefined AF',()=>{const m=run('xor eax, eax\nret');assert.equal(m.flags.AF,null);assert.equal(m.flags.CF,false);assert.equal(m.flags.OF,false);assert.equal(m.flags.PF,true);});
test('imul sets overflow and leaves comparison flags undefined',()=>{const m=run('mov eax, 0x7fffffff\nmov ecx, 2\nimul eax, ecx\nret');assert.equal(m.regs[0],0xfffffffen);assert.equal(m.flags.CF,true);assert.equal(m.flags.OF,true);assert.equal(m.flags.ZF,null);});
test('branching on undefined flags fails explicitly',()=>{const m=run('imul eax, edi\nje done\ndone: ret');assert.equal(m.status,'fault');assert.match(m.reason,/undefined ZF/);});
test('shift count zero preserves flags and effective count is masked',()=>{const m=run('mov eax, 0xffffffff\nadd eax, 1\nshl eax, 32\nret');assert.equal(m.regs[0],0n);assert.equal(m.flags.CF,true);assert.equal(m.flags.ZF,true);});
test('large shifts distinguish undefined carry and arithmetic sign fill',()=>{const a=run('mov al, 0x81\nshr al, 8\nret');assert.equal(a.flags.CF,null);const b=run('mov al, 0x81\nsar al, 8\nret');assert.equal(b.regs[0],255n);assert.equal(b.flags.CF,true);});
test('little endian load/store and scaled address',()=>{const m=run('lea rsi, [values]\nmov rdi, 1\nmov rax, qword ptr [rsi+rdi*8]\nret\n.data\nvalues: .quad 3, 0x1122334455667788');assert.equal(m.regs[0],0x1122334455667788n);assert.equal(m.memory[DATA+8],0x88);});
test('SIB supports r12 as index and rsp as base',()=>{const m=run('sub rsp, 16\nmov r12, 1\nmov qword ptr [rsp+r12*8], 37\nmov rax, qword ptr [rsp+8]\nadd rsp, 16\nret');assert.equal(m.regs[0],37n);});
test('LEA calculates without dereference or flags changes',()=>{const m=run('mov rdi, 0x5000\nlea rax, [rdi+8]\nret');assert.equal(m.regs[0],0x5008n);assert.equal(m.flags.CF,false);});
test('negative displacement and zero displacement rbp encoding',()=>{const m=run('mov rbp, rsp\nmov qword ptr [rbp-8], 99\nmov rax, qword ptr [rbp-8]\nret');assert.equal(m.regs[0],99n);});
test('call and return balance stack and capture the actual target',()=>{const m=run('call f\nret\nf: mov eax, 42\nret');assert.equal(m.regs[0],42n);assert.equal(m.rip,BigInt(RETURN));assert.equal(m.regs[4],BigInt(STACK+8));assert.equal(m.calls.length,0);});
test('push rsp captures original stack pointer',()=>{const m=run('push rsp\npop rax\nret');assert.equal(m.regs[0],BigInt(STACK));});
test('read-only code and non-executable data faults are explicit',()=>{const a=run('mov byte ptr [0x1000], 0\nret');assert.equal(a.status,'fault');assert.match(a.reason,/Read-only code/);const b=run('jmp 0x2000');assert.equal(b.status,'fault');assert.match(b.reason,/Non-executable/);});
test('faulting instruction rolls back architectural state',()=>{const m=new Machine(assemble('push rax\nret'),{rsp:0x7000n,rax:7n});m.step();assert.equal(m.status,'fault');assert.equal(m.regs[4],0x7000n);assert.equal(m.rip,0x1000n);m.rewind();assert.equal(m.status,'ready');});
test('rewind restores registers, flags, memory, and output',()=>{const m=new Machine(assemble('mov qword ptr [0x2000], 42\nret'));m.step();assert.equal(m.readMem(DATA,64),42n);m.rewind();assert.equal(m.readMem(DATA,64),0n);assert.equal(m.steps,0);});
test('write watchpoint triggers even when the stored byte stays equal',()=>{const m=new Machine(assemble('mov byte ptr [0x2000], 0\nmov eax, 42\nret'));m.run({watchpoints:new Set([DATA])});assert.equal(m.steps,1);assert.equal(m.reason,'Memory write watchpoint');});
test('breakpoint stops before instruction and continue skips it once',()=>{const m=new Machine(assemble('mov eax, 1\nadd eax, 2\nret')),at=m.program.instructions[1].address;m.run({breakpoints:new Set([at])});assert.equal(m.regs[0],1n);assert.equal(Number(m.rip),at);m.run({breakpoints:new Set([at])});assert.equal(m.regs[0],3n);assert.equal(m.status,'halted');});
test('step over runs a call to completion and stops after it',()=>{const src='entry:\n mov eax, 10\n call f\n add eax, 1\n ret\nf:\n add eax, 5\n add eax, 5\n ret';const m=new Machine(assemble(src)),call=m.program.instructions.find(i=>i.text.includes('call f')).address,after=m.program.instructions.find(i=>i.text.includes('add eax, 1')).address;m.run({breakpoints:new Set([call])});m.stepOver();assert.equal(m.regs[0],20n);assert.equal(Number(m.rip),after);assert.equal(m.calls.length,0);assert.equal(m.reason,'Stepped over call');});
test('step over a non-call is a single instruction',()=>{const m=new Machine(assemble('mov eax, 10\nadd eax, 1\nret'));m.stepOver();assert.equal(m.regs[0],10n);assert.equal(m.steps,1);assert.equal(m.reason,'Single instruction');});
test('a breakpoint inside a stepped-over call still stops',()=>{const src='entry:\n call f\n ret\nf:\n mov eax, 7\n ret';const m=new Machine(assemble(src)),inside=m.program.instructions.find(i=>i.text.includes('mov eax, 7')).address;m.stepOver({breakpoints:new Set([inside])});assert.equal(Number(m.rip),inside);assert.equal(m.calls.length,1);assert.equal(m.reason,'Address breakpoint');});
test('finish returns to the caller after the current frame',()=>{const src='entry:\n mov eax, 10\n call f\n add eax, 1\n ret\nf:\n add eax, 5\n add eax, 5\n ret';const m=new Machine(assemble(src)),first=m.program.instructions.find(i=>i.text.includes('add eax, 5')).address,after=m.program.instructions.find(i=>i.text.includes('add eax, 1')).address;m.run({breakpoints:new Set([first])});m.step();assert.equal(m.calls.length,1);m.finish();assert.equal(Number(m.rip),after);assert.equal(m.regs[0],20n);assert.equal(m.calls.length,0);assert.equal(m.reason,'Returned to caller');});
test('finish at the top frame runs to completion',()=>{const m=new Machine(assemble('mov eax, 1\nadd eax, 2\nret'));m.finish();assert.equal(m.status,'halted');assert.equal(m.regs[0],3n);});
test('entry breakpoint can be honored on initial run',()=>{const m=new Machine(assemble('mov eax, 1\nret'));m.run({breakpoints:new Set([0x1000]),skipCurrent:false});assert.equal(m.steps,0);assert.equal(m.reason,'Address breakpoint');});
test('infinite execution is bounded and rewind history is bounded',()=>{const m=new Machine(assemble('again: jmp again'));m.run({limit:700});assert.equal(m.steps,700);assert.equal(m.history.length,512);assert.match(m.reason,/budget/);});
test('syscall model captures output, clobbers rcx/r11, and rewinds',()=>{const m=new Machine(assemble('mov eax, 1\nmov edi, 1\nlea rsi, [message]\nmov edx, 2\nsyscall\nret\n.data\nmessage: .ascii "hi"'));for(let i=0;i<5;i++)m.step();assert.equal(m.output,'hi');assert.equal(m.regs[0],2n);assert.equal(m.regs[1],m.rip);m.rewind();assert.equal(m.output,'');assert.equal(m.regs[0],1n);});
test('unsupported syscalls never silently succeed',()=>{const m=run('mov eax, 59\nsyscall');assert.equal(m.status,'fault');assert.match(m.reason,/not modeled/);});
test('assembler rejects ambiguous widths, unknown labels, overflow, invalid forms',()=>{for(const source of ['mov [rax], 1','jmp missing','mov al, 256','mov rax, qword ptr [eax]','mov [rax], [rbx]','wat eax, 1','same: nop\nsame: ret','mov qword ptr [rax], 0xffffffff'])assert.throws(()=>assemble(source),/Line/);});
test('comments inside strings remain data',()=>{const p=assemble('ret ; end\n.data\nmessage: .ascii "a;#b"');assert.equal(new TextDecoder().decode(p.data),'a;#b');});
test('hex rendering preserves all 64 bits',()=>assert.equal(hex(0xffffffffffffffffn),'ffffffffffffffff'));
test('track prerequisites and runnable lesson references are valid',()=>{assert.equal(new Set(tracks.map(t=>t.id)).size,22);for(const t of tracks){for(const id of t.prereqs)assert.ok(tracks.some(x=>x.id===id));for(const id of t.labs)assert.ok(lessons.some(l=>l.id===id&&l.track===t.id));}assert.equal(new Set(tracks.flatMap(t=>t.labs)).size,lessons.length);});
for(const l of lessons){
 test(`${l.id}: worked solution satisfies the stated cases`,()=>assert.equal(verifyLesson(Machine,assemble,l,l.solution||l.starter,BigInt(l.answer||l.input)).ok,true));
 test(`${l.id}: starter/default candidate is not falsely marked complete`,()=>assert.equal(verifyLesson(Machine,assemble,l,l.starter,BigInt(l.input)).ok,false));
}
test('reversing verification uses original program, not edited acceptance',()=>{const l=lessons.find(l=>l.id==='recover-predicate');assert.equal(verifyLesson(Machine,assemble,l,'mov eax, 1\nret',0n).ok,false);});
