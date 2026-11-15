import {DATA,STACK,unsigned} from './machine.js';
export const sources={
 intel:{label:'Intel instruction reference',url:'https://intel.github.io/SDM/sdm.html'},
 abi:{label:'System V AMD64 ABI',url:'https://gitlab.com/x86-psABIs/x86-64-ABI'},
 gas:{label:'GNU assembler: Intel syntax',url:'https://sourceware.org/binutils/docs/as/i386_002dVariations.html'},
 memory:{label:'Prerequisite · Memory Systems Lab',url:'https://himasudo.github.io/memory-system-interactive/'},
 syscall:{label:'Linux x86-64 syscall table',url:'https://github.com/torvalds/linux/blob/master/arch/x86/entry/syscalls/syscall_64.tbl'}
};
const section=(title,...p)=>({title,p});
const retValue=(m,x)=>m.regs[0]===unsigned(x);
export const lessons=[
{
 id:'first-stop',track:'start',title:'Your first breakpoint',subtitle:'Make the machine explain itself.',duration:20,difficulty:'Orientation',input:'7',inputLabel:'Argument n (EDI)',mode:'repair',
 goal:'Repair a function so it returns 2 × n for every tested 32-bit input.',
 starter:`entry:
    mov eax, edi
    add eax, 1
    ret`,
 solution:`entry:
    mov eax, edi
    add eax, edi
    ret`,
 initial:n=>({edi:n}),cases:[0n,1n,7n,41n,0x80000000n,0xffffffffn],check:(m,n)=>retValue(m,unsigned(n*2n,32)),
 sections:[
 section('A prediction before a button','The function receives an unsigned 32-bit argument in <code>EDI</code> and returns a result in <code>EAX</code>. For n = 7, the specification says 14. Read the three instructions and write down what you think they actually produce. Intel syntax places the destination first: <code>mov eax, edi</code> copies the argument into the result register. It does not erase EDI.','This workbench assembles your text into real x86-64 instruction bytes. A bounded teaching engine decodes those bytes and executes its supported subset. It has no native Linux process, hardware timing, or external network. Open Engine reference for exact boundaries. Those boundaries matter when interpreting an observation.'),
 section('Stop before the wrong change','Select <strong>Build</strong>, then click the hollow breakpoint circle beside <code>add</code> in the disassembly. <strong>Run</strong> stops before that instruction. RIP is the address of the next instruction to execute. At this point EAX and EDI should both hold 7.','Select <strong>Step</strong>. EAX becomes 8. The debugger highlights changed registers; flags also change because ADD is arithmetic. <strong>Back</strong> restores the preceding state, including memory writes. The history keeps the most recent 512 steps; it is a teaching convenience rather than a claim about native debugger recording.'),
 section('Build a causal explanation','The observed result follows from an immediate operand of 1. We wanted a second copy of n. Replace that immediate with EDI, rebuild, and repeat the experiment. Editing text does not silently change the loaded program: the source becomes dirty and execution requires a new build.','Run to the final RET. The harness supplied a synthetic return address on the stack; returning to it completes this function. The output pane reports the final result. There is no printed output unless a lesson explicitly writes to the modeled console.'),
 section('A repair is a general claim','Select <strong>Verify repair</strong>. Verification executes fresh machines across inputs, including zero and a value whose doubled result wraps at 32 bits. Passing one example is weaker evidence than satisfying the specified arithmetic across boundary cases.','Local exercise checks are visible in this open-source project. They are learning feedback, not a secure exam grader or proof of correctness for all possible programs. Try a different n yourself and explain the result before you run it.'),
 section('Carry this method forward','Use the same sequence throughout the course: state the contract, predict a result, stop near the first divergence, inspect the relevant state, repair the cause, then test the boundary. A debugger shows evidence; your explanation connects that evidence to the program.','Your saved source, input, and completed exercises stay in this browser. Export progress from the Progress page to move them to another device. Nothing is uploaded by the workbench.')],
 hints:['After MOV, EAX already contains one copy of n.','ADD can take a register as its second operand. Which register still contains n?','Use add eax, edi, then rebuild and verify.'],
 quiz:{q:'When an address breakpoint is hit, has the instruction at that address executed?',options:['Yes; the state shows its result.','No; RIP identifies the instruction that will execute next.','Only if the instruction changes flags.'],answer:1,why:'An address breakpoint stops before execution. A write watchpoint in this workbench stops after the matching instruction, so its changed bytes are visible.'},refs:['intel','abi']
},
{
 id:'register-widths',track:'assembly',title:'One register, four widths',subtitle:'Why writing EAX changes more than 32 bits.',duration:30,difficulty:'Foundation',input:'42',inputLabel:'Low 32-bit value (EDI)',mode:'repair',
 goal:'Return the unsigned low 32 bits of EDI in the full RAX register, independently of its old high bits.',
 starter:`entry:
    mov ax, di
    ret`,solution:`entry:
    mov eax, edi
    ret`,
 initial:n=>({rax:0xfeedface12345678n,rdi:n}),cases:[0n,42n,0x12345678n,0x80000000n,0xffffffffn],check:(m,n)=>retValue(m,unsigned(n,32)),
 sections:[section('Names are overlapping views','RAX is a 64-bit register. EAX names its low 32 bits; AX names its low 16; AL names its low 8. They are overlapping views, not independent storage. If you change AL, a later read of RAX sees that change. The rest of RAX depends on the width of the write.','The laboratory initializes RAX to <code>0xfeedface12345678</code>. The function should replace it with the zero-extended 32-bit input. Step MOV AX, DI and inspect the entire 16-digit hexadecimal RAX value. The low 16 bits changed, but the old upper bits survived.'),
 section('The architectural 32-bit rule','In 64-bit mode, a general-purpose 32-bit register write zeroes the upper 32 bits of the corresponding 64-bit register. An 8-bit or 16-bit write preserves the other bits. This is an architectural rule you can rely on, not an optimization that happens only on one vendor’s processor.','Change AX/DI to EAX/EDI. With input 42, the full result becomes <code>0x000000000000002a</code>. With input 0xffffffff, it becomes <code>0x00000000ffffffff</code>. This is zero-extension, not sign-extension; the second value is positive when read as a signed 64-bit integer.'),
 section('A width is part of the operation','A register name chooses an operand width. <code>add eax, edi</code> computes a 32-bit result and then zeroes the upper half of RAX. <code>add rax, rdi</code> computes a 64-bit result. The same-looking source change can therefore change arithmetic and the final bit pattern.','MOV preserves the arithmetic flags. If a flag appears unchanged after this instruction, that is expected. Do not infer equality or zero from old flags unless an instruction has just established them.'),
 section('Observe, then repair','Try replacing the instruction with <code>mov al, dil</code> and predict which two hexadecimal digits can change. Rebuild and step. Next try the 16-bit and 32-bit variants with an input that has nonzero bits in every byte.','Restore the general repair and verify. A hardcoded MOV of 42 could pass your first manual example but fails the varied inputs. The engine supports low-byte names such as DIL; legacy high-byte registers AH/BH/CH/DH are deliberately outside this release’s subset.')],
 hints:['AX writes only 16 bits and preserves the rest of RAX.','A 32-bit destination write has a special zero-extension rule in 64-bit mode.','Use mov eax, edi.'],
 quiz:{q:'Starting with RAX = 0xffffffffffffffff, what does mov eax, 1 leave in RAX?',options:['0xffffffff00000001','0x0000000000000001','0xffffffffffff0001'],answer:1,why:'A write to EAX zeroes the high 32 bits of RAX.'},refs:['intel','memory']
},
{
 id:'signed-branches',track:'assembly',title:'The same bits, two orderings',subtitle:'Catch a boundary bug in a single conditional jump.',duration:35,difficulty:'Foundation',input:'4294967295',inputLabel:'Unsigned length (EDI)',mode:'repair',
 goal:'Return 1 exactly when the unsigned 32-bit length is at most 8; return 0 otherwise.',
 starter:`entry:
    cmp edi, 8
    jle allowed
    mov eax, 0
    ret
allowed:
    mov eax, 1
    ret`,
 solution:`entry:
    cmp edi, 8
    jbe allowed
    mov eax, 0
    ret
allowed:
    mov eax, 1
    ret`,initial:n=>({edi:n}),cases:[0n,1n,7n,8n,9n,0x7fffffffn,0x80000000n,0xffffffffn],check:(m,n)=>retValue(m,unsigned(n,32)<=8n?1n:0n),
 sections:[section('CMP produces evidence, not a boolean','CMP performs a subtraction for the purpose of setting flags, then discards the numerical result. <code>cmp edi, 8</code> sets flags as if it had computed EDI − 8 at 32-bit width. EDI itself remains unchanged. The next branch chooses which relationship to test.','For unsigned subtraction, CF reports a borrow and ZF reports a zero result. Unsigned “below or equal” is CF or ZF. For signed ordering, SF and OF must be considered together: “less” is SF different from OF; “less or equal” additionally includes ZF.'),
 section('A plausible check with a dangerous interpretation','The contract calls EDI an unsigned length. The starter uses JLE, which tests a signed relationship. The bit pattern 0xffffffff represents 4,294,967,295 unsigned and −1 signed. A signed comparison can therefore allow a length that should be rejected.','Set a breakpoint on the branch. Step CMP with inputs 8, 9, 0x80000000, and 0xffffffff. Read CF, ZF, SF, and OF, and predict the branch before stepping. The register’s bits never announce which interpretation the programmer intended.'),
 section('Follow the contract through the branch','Replace JLE with the unsigned condition JBE. Rebuild for each experiment. Equal-to-limit still succeeds through ZF, smaller values succeed through CF, and values above the bound fail.','The reverse ordering is also useful: after CMP, JA means unsigned above; JG means signed greater. A function’s argument type and intended range are essential evidence when reverse engineering either instruction.'),
 section('Extend the investigation','Try CMP with values where signed subtraction overflows. SF alone is insufficient for signed comparisons because the stored sign bit can disagree with the mathematical sign after overflow. OF supplies that missing information.','This lesson isolates a machine-level signedness error. In C, integer promotions and usual arithmetic conversions determine which comparison the compiler implements. A later language-boundary module follows those rules through generated assembly. Verification here checks unsigned boundary cases, including the sign-bit transition.')],
 hints:['The contract says unsigned, while JLE is a signed conditional jump.','Unsigned below-or-equal uses CF or ZF.','Replace jle allowed with jbe allowed.'],quiz:{q:'Which condition implements unsigned a ≤ b after cmp a, b?',options:['SF = 1','ZF = 1 or SF ≠ OF','CF = 1 or ZF = 1'],answer:2,why:'CF represents unsigned borrow; ZF handles equality. SF/OF implement signed ordering.'},refs:['intel']
},
{
 id:'address-arithmetic',track:'assembly',title:'An address is a calculation',subtitle:'Trace a scaled index into a little-endian array.',duration:35,difficulty:'Foundation',input:'2',inputLabel:'Array index (0–3)',mode:'repair',
 goal:'Return values[index] from an array of four 64-bit integers.',
 starter:`entry:
    lea rsi, [values]
    mov rax, qword ptr [rsi+rdi*4]
    ret
.data
values:
    .quad 3, 7, 11, 19`,
 solution:`entry:
    lea rsi, [values]
    mov rax, qword ptr [rsi+rdi*8]
    ret
.data
values:
    .quad 3, 7, 11, 19`,initial:n=>({rdi:n}),cases:[0n,1n,2n,3n],check:(m,n)=>retValue(m,[3n,7n,11n,19n][Number(n)]),
 sections:[section('Separate address formation from memory access','The expression <code>[rsi+rdi*4]</code> combines a base, an index, and a scale. Memory is byte-addressed. If the base is 0x2000 and the index is 2, the expression selects address 0x2008. The operand width then determines how many bytes MOV reads from that address.','A QWORD is eight bytes. Loading eight bytes does not automatically multiply the index by eight: element size and operand width are separate choices in the instruction. The starter therefore selects the wrong element, or a sequence crossing two elements.'),
 section('Read the bytes in order','Open Memory at 0x2000. The first QWORD, 3, appears as <code>03 00 00 00 00 00 00 00</code>. A little-endian load treats the lowest-addressed byte as the least significant. At index 1 the broken expression starts four bytes into the first element and reads across into the second.','With the supplied values, that misaligned read is still inside mapped memory. The engine executes it; there is no automatic “wrong array element” exception. Real x86 also supports ordinary unaligned integer loads, although other instruction types and access boundaries can impose additional restrictions.'),
 section('LEA does not read the addressed bytes','LEA computes an address expression and writes the result to a register. It does not dereference the memory operand and does not update arithmetic flags. In this program, it places the address of values into RSI. The following MOV performs the memory access.','Try replacing the load temporarily with <code>lea rax, [rsi+rdi*8]</code>. You should obtain an address rather than the element’s value. This is a useful experiment for separating pointer computation from dereferencing.'),
 section('Repair the scale, preserve the width','The element stride is eight bytes, so use a scale of 8 while retaining the QWORD load. Check every valid index. Index zero alone hides the bug because multiplying zero by either stride gives the same address.','The verification contract for this exercise only covers indices 0–3. The later object-bounds lesson adds validation for untrusted indices. The region addresses here belong to the teaching machine; native processes have their own mapped addresses and relocations.')],hints:['QWORD selects an 8-byte load; it does not determine the index scale.','The distance between adjacent .quad elements is 8 bytes.','Change rdi*4 to rdi*8.'],quiz:{q:'What does lea rax, [rsi+rdi*8] put in RAX?',options:['The value stored at that address','The computed address','Eight consecutive array elements'],answer:1,why:'LEA calculates an effective address without dereferencing it.'},refs:['intel','memory']
},
{
 id:'loop-boundary',track:'assembly',title:'Find the missing iteration',subtitle:'Use an invariant to repair a loop, including zero.',duration:40,difficulty:'Foundation',input:'5',inputLabel:'n (0–32)',mode:'repair',
 goal:'Return 1 + 2 + … + n, with a result of 0 when n is 0. Supported input domain: 0–32.',
 starter:`entry:
    xor eax, eax
    mov ecx, 1
again:
    add eax, ecx
    inc ecx
    cmp ecx, edi
    jl again
    ret`,
 solution:`entry:
    xor eax, eax
    mov ecx, 1
again:
    cmp ecx, edi
    jg done
    add eax, ecx
    inc ecx
    jmp again
done:
    ret`,initial:n=>({edi:n}),cases:[0n,1n,2n,5n,16n,32n],check:(m,n)=>retValue(m,n*(n+1n)/2n),
 sections:[section('Name the state at the loop boundary','Let ECX be the next integer to add and EAX the sum of all integers already added. At the top of a correct loop, the invariant is EAX = 1 + … + (ECX − 1). Initialization with EAX = 0 and ECX = 1 satisfies it.','Set a breakpoint on ADD. Each stop gives a snapshot of this invariant. Single-step through the update, increment, comparison, and branch. Count actual additions rather than estimating from the source indentation.'),
 section('Two failures can hide in one condition','For n = 5, the starter omits the final addition. After adding 4 it increments ECX to 5, compares 5 with 5, and the strict JL fails. Changing JL to JLE repairs that case, but n = 0 still executes the body once and returns 1.','This is a post-tested loop. A zero-iteration input needs a condition before the first body execution, or a separate entry guard. Testing only a normal positive n cannot distinguish these cases.'),
 section('Put the contract at the boundary','One clear repair tests ECX > n before ADD. If true, it returns; otherwise it adds ECX and advances. The original invariant then explains correctness: when the loop exits, all values through n have been added exactly once.','The inputs for this exercise are deliberately small nonnegative integers. This keeps focus on loop boundaries. A production implementation would also define behavior for negative n, values outside the domain, and arithmetic overflow; silently expanding the domain would change the specification.'),
 section('Debug termination as well as output','Try removing the increment and running. The workbench pauses at its instruction budget rather than freezing the page forever. A budget pause is not a successful return. Verification treats nontermination within its bound as failure.','Use Back to compare neighboring loop states. If the loop-control state never moves toward the exit condition, an output-only explanation is incomplete. Finish by verifying n = 0, 1, and several larger values.')],hints:['Changing JL to JLE fixes positive n but still fails n = 0.','Move the comparison before ADD so zero iterations are possible.','At again: compare ECX with EDI; JG done; then ADD, INC, and JMP again.'],quiz:{q:'Why does testing n = 0 matter here?',options:['It checks whether the loop can execute zero times.','It forces signed overflow.','It checks whether INC changes CF.'],answer:0,why:'A post-tested loop executes its body once before checking whether work was needed.'},refs:['intel']
},
{
 id:'call-contract',track:'assembly',title:'A function owes its caller',subtitle:'A correct return value can still violate the ABI.',duration:40,difficulty:'Intermediate',input:'17',inputLabel:'First addend (RDI)',mode:'repair',
 goal:'Return RDI + RSI while preserving the caller’s RBX value and balancing the stack. RSI is 9.',
 starter:`entry:
    sub rsp, 8
    call add_pair
    add rsp, 8
    ret
add_pair:
    mov rbx, rdi
    add rbx, rsi
    mov rax, rbx
    ret`,
 solution:`entry:
    sub rsp, 8
    call add_pair
    add rsp, 8
    ret
add_pair:
    push rbx
    mov rbx, rdi
    add rbx, rsi
    mov rax, rbx
    pop rbx
    ret`,initial:n=>({rdi:n,rsi:9n,rbx:0x1122334455667788n}),cases:[0n,17n,100n,0xfffffffffffffff0n],check:(m,n)=>retValue(m,n+9n)&&m.regs[3]===0x1122334455667788n&&m.regs[4]===BigInt(STACK+8),
 sections:[section('An ABI is an agreement between independently compiled code','For ordinary integer arguments in the System V AMD64 convention, RDI and RSI carry the first two arguments and RAX carries an integer return value. The convention also divides registers into ones the callee may clobber and ones it must preserve. RBX is callee-saved.','The starter computes the right sum in RAX but destroys the caller’s RBX. A caller may keep a live value there across a call. If that value changes, failure may appear far away from this function, after the result has already been used.'),
 section('CALL and RET manipulate concrete bytes','CALL pushes the address after the call onto the stack, then transfers control. RET reads an address from the stack and transfers to it. Neither instruction understands a C function declaration or checks whether an ABI was obeyed.','Inspect the stack before and after CALL. The synthetic function-entry stack starts at an address congruent to 8 modulo 16. The caller subtracts 8 before its nested CALL so the pre-call stack is 16-byte aligned, as required for this ordinary call. The callee then enters with its return address on the stack.'),
 section('Preserve what you borrow','One repair saves RBX with PUSH at add_pair’s entry, performs the computation, then restores RBX with POP before RET. The stack must be restored in the reverse order of saves. Missing the POP makes RET consume the saved RBX value as an address.','Another repair can use a caller-saved scratch register instead. Verification checks the observable contract, not whether your source matches a preferred solution. The Calls panel is an explanatory record of CALL/RET events; it is not a DWARF unwinder and can lose correspondence when return addresses are corrupted.'),
 section('Expand the evidence','Check RAX, RBX, and RSP at the final return. A result-only test would miss the original error. Changing a callee-saved register temporarily is legal if it is restored before the caller resumes.','The full ABI includes more than this lesson: additional preserved registers, floating/vector arguments, aggregates, variadic calls, red-zone rules, and unwinding. Those remain explicit units in the track. Here the experiment isolates preservation, alignment, and return-address lifetime.')],hints:['RBX belongs to the caller across this call. Save it before changing it.','PUSH RBX at add_pair entry must be balanced with POP RBX before RET.','You may also compute directly in RAX without using RBX.'],quiz:{q:'A function returns the right RAX but unexpectedly changes RBX. Is it correct under this contract?',options:['Yes; only the return value matters.','No; preserving RBX is part of the function’s interface.','Yes, if the function has fewer than six arguments.'],answer:1,why:'The caller may rely on callee-saved register values after the call.'},refs:['abi','intel']
},
{
 id:'recover-predicate',track:'reversing',title:'Recover a hidden predicate',subtitle:'Undo a byte transformation using observed state.',duration:35,difficulty:'Intermediate',input:'0',inputLabel:'Candidate byte (0–255)',mode:'solve',
 goal:'Find an input byte accepted by the original validator. Verification always runs the original bytes, even if you edit your scratch program.',
 starter:`entry:
    mov eax, edi
    xor al, 0x5a
    add al, 7
    cmp al, 0xa0
    jne denied
    mov eax, 1
    ret
denied:
    xor eax, eax
    ret`,answer:'195',initial:n=>({edi:n}),check:(m,n)=>n>=0n&&n<=255n&&retValue(m,1n),
 sections:[section('Translate the data flow, not the spelling','There is no C source here. Read the instruction sequence and reconstruct a relation between the input and the accepted state. MOV transfers the input to EAX; the following XOR and ADD operate only on AL. Therefore the relevant arithmetic is on the low byte, modulo 256.','A successful branch requires <code>((input XOR 0x5a) + 7) mod 256 = 0xa0</code>. This equation is a hypothesis extracted from the instructions. Stepping several candidates is how you check that your interpretation matches execution.'),
 section('Walk backward from the comparison','Subtract 7 from the target byte, modulo 256. The result is 0x99. XOR is its own inverse, so XOR that value with 0x5a. This reconstructs the candidate before either transformation.','Use the Candidate field to load your value, rebuild, and break before CMP. AL should equal 0xa0. Step CMP and inspect ZF. Then step JNE: a not-equal branch should not be taken when ZF is set.'),
 section('A local patch is a different claim','You can edit the scratch program to learn how a branch behaves. Replacing the failure path with a success return demonstrates a patch, but it does not prove you recovered a valid input. The Solve check therefore executes the original validator with your candidate.','This distinction matters in reversing: “I can modify my copy” and “I understand the original acceptance condition” are separate achievements. In later crackmes, several constraints and state transitions must all hold.'),
 section('Width determines the algebra','If the ADD were on EAX, carries could propagate beyond the low byte. If the comparison were on the full register, preserved high bits could matter. An algebraic solution must retain the widths seen in the instructions.','Try a deliberately wrong candidate that differs by one bit. Track how XOR and addition affect it. Keep a concise explanation of which state made the branch choose rejection; naming the final input alone does not explain the program.')],hints:['AL must be 0xa0 immediately before CMP. Undo ADD first.','0xa0 − 7 = 0x99; XOR is its own inverse.','0x99 XOR 0x5a = 0xc3, or 195 decimal.'],quiz:{q:'Why is the transformation modulo 256?',options:['Every x86 register is 8 bits.','The arithmetic destination is AL, an 8-bit register view.','CMP always truncates its operands to a byte.'],answer:1,why:'The operand width determines where this addition wraps.'},refs:['intel']
},
{
 id:'structure-layout',track:'reversing',title:'Recover a field from its offset',subtitle:'Distinguish a useful layout hypothesis from a guessed type.',duration:35,difficulty:'Intermediate',input:'1234605616436508552',inputLabel:'Value stored in the third field',mode:'repair',
 goal:'Return the 64-bit value at byte offset 16 in the record addressed by RDI.',
 starter:`entry:
    mov rax, qword ptr [rdi+8]
    ret
.data
record:
    .quad 0x54444c42, 24, 0`,solution:`entry:
    mov rax, qword ptr [rdi+16]
    ret
.data
record:
    .quad 0x54444c42, 24, 0`,initial:()=>({rdi:DATA}),setup:(m,n)=>{m.writeMem(DATA+16,64,n);m.writes=[];},cases:[0n,42n,0x1122334455667788n,0xffffffffffffffffn],check:(m,n)=>retValue(m,n),
 sections:[section('An offset is stronger evidence than a field name','A binary load gives you a base, a displacement, and a width. <code>mov rax, qword ptr [rdi+8]</code> reads eight bytes starting eight bytes after RDI. It does not reveal whether those bytes were called length, timestamp, or pointer in the original source.','This exercise supplies a contract: a record has three consecutive 64-bit fields, and the requested value is the third. The first is a marker, the second stores 24, and the third is populated from the Input field by the harness.'),
 section('Validate the layout against bytes','Inspect memory at 0x2000, 0x2008, and 0x2010. The marker, size-like value, and candidate occupy separate eight-byte spans. Predict what RAX receives with the starter offset. Then stop on MOV and check.','A little-endian byte sequence can look reversed when read as text. The byte at the lowest address is the least significant part of the integer. Keep address order and numeric display order separate in your notes.'),
 section('A structure may contain padding','This record uses three equally sized fields, so its offsets are straightforward. General C structures can contain padding between members and at the end to satisfy alignment. Field order alone is insufficient to determine offsets without the relevant ABI and types.','In real reversing, gather uses of the same base pointer: load widths, offsets, arithmetic, and comparisons constrain possible layouts. Several source structures can fit the same observed accesses. State what the evidence supports and what remains unknown.'),
 section('Repair one access, then vary the data','Change the displacement to 16 and verify with several values, including one with every byte different and one with every bit set. This avoids passing by accidentally returning a constant that matches the current record.','The fixture writes the chosen value into memory before execution. The program must load it through the pointer; a repaired source file does not contain the test values. Later units connect these observations to debug information, C++ inheritance, vtables, and optimized access patterns.')],hints:['The displacement is measured in bytes.','There are two eight-byte fields before the desired value.','Load qword ptr [rdi+16].'],quiz:{q:'Does an 8-byte load at offset 16 prove the original member was named value?',options:['Yes; the instruction encodes its name.','No; it establishes an access width and offset, not the source-level name.','Only on little-endian machines.'],answer:1,why:'Names and some types may be absent from a stripped binary. Access patterns constrain hypotheses.'},refs:['intel','abi']
},
{
 id:'three-gates',track:'crackmes',title:'Three gates, one key',subtitle:'Keep every path constraint in view.',duration:40,difficulty:'Intermediate',input:'256',inputLabel:'Candidate key (0–65535)',mode:'solve',goal:'Find a key accepted by the unmodified three-gate validator.',
 starter:`entry:
    cmp edi, 0x100
    jbe denied
    mov eax, edi
    and eax, 0xff
    cmp eax, 0x5a
    jne denied
    mov eax, edi
    shr eax, 8
    cmp eax, 3
    jne denied
    mov eax, 1
    ret
denied:
    xor eax, eax
    ret`,answer:'858',initial:n=>({edi:n}),check:(m,n)=>n>=0n&&n<=65535n&&retValue(m,1n),
 sections:[section('Acceptance is the intersection of conditions','A successful input must pass every gate. The first requires an unsigned value greater than 0x100. The second masks with 0xff and compares the low byte with 0x5a. The third shifts a fresh copy of the input right by eight bits and compares the remaining value with 3.','Write these conditions separately. Solving the low-byte condition alone produces many candidates, and satisfying the first threshold says almost nothing about the other gates.'),
 section('Keep track of overwritten registers','EAX is scratch state. After AND it contains only the low byte; before SHR, MOV reloads the original input. Missing that reload would lead to a very different—and impossible—interpretation of the final condition.','Set breakpoints at all three comparisons. Run candidate values and record the first failing gate. Inspect the transformed value at each stop, not just the final return. This turns an opaque rejection into a precise explanation.'),
 section('Combine the constraints','The third condition selects an upper portion of 3. The second selects a low byte of 0x5a. Combining them gives 0x35a. Check that it also satisfies the first unsigned threshold. Then enter the candidate, rebuild, and run through the success path.','Verification uses the original validator, so changing a conditional jump in the editor does not count as solving the puzzle. The editor remains useful for counterfactual experiments.'),
 section('Generalize without overclaiming','This puzzle has independent bit constraints and a small solution. Real validators may couple bytes through carries, checksums, state machines, or table lookups. Recovering the control flow and tracking data dependencies remain useful even when simple algebra stops being sufficient.','Later crackmes introduce those complications progressively, followed by symbolic execution with explicit limits on environment modeling and path explosion. A tool-generated key still needs validation against the original program.')],hints:['Gate two fixes the low byte to 0x5a.','Gate three fixes the value after shifting right by 8 to 3.','Combine (3 << 8) | 0x5a = 0x35a = 858.'],quiz:{q:'Why does the second mov eax, edi matter?',options:['It restores the original input before the next transformation.','It converts a signed number to a different bit pattern.','It clears every arithmetic flag.'],answer:0,why:'The mask destroyed most of the first copy, so the next gate reloads its own copy.'},refs:['intel']
},
{
 id:'write-without-libc',track:'shellcoding',title:'A write without libc',subtitle:'Follow registers across a modeled syscall boundary.',duration:35,difficulty:'Intermediate',input:'0',inputLabel:'Unused input',mode:'repair',goal:'Write exactly “hello” followed by a newline to the modeled console, then exit with status 0.',
 starter:`entry:
    mov eax, 1
    mov edi, 1
    lea rsi, [message]
    mov edx, 4
    syscall
    mov eax, 60
    xor edi, edi
    syscall
.data
message:
    .ascii "hello\\n"`,
 solution:`entry:
    mov eax, 1
    mov edi, 1
    lea rsi, [message]
    mov edx, 6
    syscall
    mov eax, 60
    xor edi, edi
    syscall
.data
message:
    .ascii "hello\\n"`,initial:()=>({}),cases:[0n],check:m=>m.output==='hello\n'&&m.reason==='Modeled exit(0)',
 sections:[section('A syscall has its own calling convention','The Linux x86-64 syscall convention places a number in RAX and the first three arguments in RDI, RSI, and RDX. This lesson models write(number 1) and exit(number 60). It performs no actual host system call. The supported boundary is deliberately small and documented.','For write, RDI selects a descriptor, RSI points to bytes, and RDX gives their count. Here descriptor 1 means the laboratory console. A pointer does not encode the length of its data.'),
 section('A string is bytes plus a convention','The message contains h, e, l, l, o, and a newline: six bytes. The starter requests four, so the console receives only “hell”. WRITE does not keep reading until a NUL byte; its count controls the requested span.','Inspect the message in Memory, then break before SYSCALL. Verify RSI points at its first byte and RDX names the intended span. Change the count to six, rebuild, and observe the complete output.'),
 section('Observe the boundary effects','The modeled successful WRITE returns the number of bytes written in RAX. SYSCALL also clobbers RCX and R11 according to the instruction’s return-address/flags convention. That matters when code keeps live values across a syscall boundary.','This laboratory always completes an allowed write in full. Native Linux can report short writes, interruptions, or errors, so a real write loop needs more handling. The Networking & Storage track covers those semantics. Do not generalize this simplified successful-write model into a production I/O contract.'),
 section('Machine code is not automatically portable shellcode','The emitted code is real x86-64 encoding, but the current message address belongs to this fixture. Moving the bytes elsewhere without adjusting absolute addresses can break them. Position independence is a separate unit, as are byte restrictions and i386 versus x86-64 conventions.','The first step in shellcoding is understanding exactly which bytes execute and which environment they assume. Export the GNU assembly to inspect it with external tools; native compilation/loading and browser fixture addresses are different environments.')],hints:['WRITE uses a byte count, not a string terminator.','“hello” is five bytes; the newline is one more.','Set EDX to 6.'],quiz:{q:'Does write(fd, pointer, count) stop automatically at a NUL byte?',options:['Yes; all output APIs do.','No; count determines the requested span.','Only when count is larger than 4.'],answer:1,why:'The system call treats the buffer as bytes. String conventions belong to higher-level APIs.'},refs:['syscall','intel']
},
{
 id:'bounds-before-load',track:'vulnerabilities',title:'Mapped does not mean in bounds',subtitle:'Protect an object boundary that the CPU cannot see.',duration:45,difficulty:'Intermediate',input:'4',inputLabel:'Untrusted 64-bit index (RDI)',mode:'repair',goal:'Return values[i] for indices 0–3; return UINT64_MAX for every other tested index, before any invalid element access.',
 starter:`entry:
    lea rsi, [values]
    mov rax, qword ptr [rsi+rdi*8]
    ret
.data
values:
    .quad 3, 7, 11, 19`,
 solution:`entry:
    cmp rdi, 4
    jae invalid
    lea rsi, [values]
    mov rax, qword ptr [rsi+rdi*8]
    ret
invalid:
    mov rax, -1
    ret
.data
values:
    .quad 3, 7, 11, 19`,initial:n=>({rdi:n}),cases:[0n,1n,2n,3n,4n,5n,128n,0xffffffffffffffffn,0x2000000000000000n],check:(m,n)=>retValue(m,n<4n?[3n,7n,11n,19n][Number(n)]:-1n),
 sections:[section('The memory map is not an object map','The four-element array occupies 32 bytes beginning at 0x2000. The data region extends farther. An access at index 4 begins just past the array but remains in mapped memory. It can return a plausible value without a page fault.','A CPU normally enforces page permissions and address validity, not the boundaries of every C array. An out-of-bounds access can expose neighboring data or corrupt another object even when no protection exception occurs. The source-language rules and the hardware checks answer different questions.'),
 section('Check before scaling and dereferencing','The input is a 64-bit unsigned index. Require it to be below the element count before computing and using the element address. <code>cmp rdi, 4</code> followed by <code>jae invalid</code> rejects equality and larger values.','Doing the check after the load is too late: the access already occurred. Checking only the computed pointer is also subtle because scaling and addition can wrap. A huge index can produce a small effective address after 64-bit modular arithmetic.'),
 section('Negative text can become a large unsigned value','Enter −1 in the Input field. The harness stores its 64-bit two’s-complement representation in RDI. Under this unsigned contract that is the maximum index, so it must be rejected. A signed comparison would treat it as a small negative number and could allow it.','The repair must preserve valid behavior at index zero and the last element. Returning an error for every input avoids the bad access but violates the function’s useful contract. The verification cases check both sides of the boundary.'),
 section('Reproduce, explain, repair','Run index 4 on the starter and inspect the returned zero. That result is from bytes beyond the object; it is not proof that the function safely supports a fifth element. Then test a huge index and observe how address formation behaves.','Add the guard and an error-return path. Verify the repaired program across ordinary, boundary, and wraparound-provoking inputs. This teaches one spatial-safety invariant. Heap lifetime, integer allocation sizes, format strings, and concurrent lifetime errors are separate units in the same track.')],hints:['The array has four entries; valid unsigned indices are strictly less than 4.','Compare RDI with 4 before the memory load, and reject with JAE.','Return mov rax, -1 on the invalid path.'],quiz:{q:'Why can reading one element past an array return a value instead of faulting?',options:['The CPU tracks every array size and extends it.','The address may remain inside a readable mapped region.','Out-of-bounds reads always return zero.'],answer:1,why:'Page permissions do not encode individual object boundaries. Zero here is just this fixture’s initialized memory.'},refs:['intel','memory']
},
{
 id:'signed-bound',track:'vulnerabilities',title:'A signed check on an unsigned index',subtitle:'The guard is there — it just compares the wrong way.',duration:40,difficulty:'Intermediate',input:'4',inputLabel:'Untrusted index (RDI)',mode:'repair',goal:'Return buf[i] for indices 0–3 and UINT64_MAX for every other tested input, including a negative index and the off-by-one at 4.',
 starter:`entry:
    cmp rdi, 4
    jg invalid
    lea rsi, [buf]
    mov rax, qword ptr [rsi+rdi*8]
    ret
invalid:
    mov rax, -1
    ret
.data
buf:
    .quad 10, 20, 30, 40`,
 solution:`entry:
    cmp rdi, 4
    jae invalid
    lea rsi, [buf]
    mov rax, qword ptr [rsi+rdi*8]
    ret
invalid:
    mov rax, -1
    ret
.data
buf:
    .quad 10, 20, 30, 40`,initial:n=>({rdi:n}),cases:[0n,1n,2n,3n,4n,5n,0xffffffffffffffffn],check:(m,n)=>retValue(m,n<4n?[10n,20n,30n,40n][Number(n)]:-1n),
 sections:[section('The bug is the comparison, not a missing check','This function already guards the index: it compares RDI with 4 and jumps away on failure. But it uses JG, a signed comparison. The index is an untrusted 64-bit value with no sign, so reading it as signed is the vulnerability.','JG asks whether RDI, read as a two’s-complement integer, is greater than 4. For an index of 0 to 3 that is fine. For a value like 0xffffffffffffffff it reads as −1, which is not greater than 4, so the guard passes and the access proceeds with an enormous effective address.'),
 section('Reproduce both escapes','Enter 4 and run the starter. JG rejects only strictly-greater values, so 4 slips through and reads one element past the array — an off-by-one. Then enter −1: the harness stores 0xffffffffffffffff, the signed guard treats it as small, and the scaled access leaves mapped memory and faults.','Two different inputs break the same guard for the same reason: the comparison’s view of the number disagrees with how the address arithmetic uses it. Scaling by 8 only widens that disagreement.'),
 section('Fix: compare as unsigned','Replace JG with JAE. Unsigned above-or-equal rejects 4 and every larger value, and because a negative index is a huge unsigned number it rejects those too — one comparison closes both escapes. Verify across 0, the last valid index, the off-by-one, and the negative case.','The lesson generalizes: index and length checks must use the unsigned jumps (JAE/JB/JBE/JA) whenever the value is an address, size, or count. A signed compare on attacker-controlled data is a recurring root cause in real advisories.')],
 hints:['The guard uses a signed jump; the index is unsigned.','JAE rejects 4-and-above, and a negative index is huge when unsigned, so it is rejected too.','Keep the error path returning mov rax, -1.'],
 quiz:{q:'Why does a negative-looking index pass a JG guard but fail a JAE guard?',options:['JG sign-extends the array base address.','As signed it is small, but as unsigned it is above the limit.','JAE reads a different register than JG.'],answer:1,why:'0xffffffffffffffff is −1 signed (not > 4) but about 1.8e19 unsigned (≥ 4). The access uses it as an unsigned offset, so the unsigned test is the correct one.'},refs:['intel','memory']
},
{
 id:'index-truncation',track:'vulnerabilities',title:'A 32-bit check on a 64-bit index',subtitle:'The guard inspects half of the value the load uses.',duration:40,difficulty:'Intermediate',input:'4294967299',inputLabel:'Untrusted index (RDI)',mode:'repair',goal:'Return buf[i] for indices 0–3 and UINT64_MAX otherwise, including values whose low 32 bits look valid but whose full width does not.',
 starter:`entry:
    mov eax, edi
    cmp eax, 4
    jae invalid
    lea rsi, [buf]
    mov rax, qword ptr [rsi+rdi*8]
    ret
invalid:
    mov rax, -1
    ret
.data
buf:
    .quad 10, 20, 30, 40`,
 solution:`entry:
    cmp rdi, 4
    jae invalid
    lea rsi, [buf]
    mov rax, qword ptr [rsi+rdi*8]
    ret
invalid:
    mov rax, -1
    ret
.data
buf:
    .quad 10, 20, 30, 40`,initial:n=>({rdi:n}),cases:[0n,1n,2n,3n,4n,0x100000003n,0x100000000n],check:(m,n)=>retValue(m,n<4n?[10n,20n,30n,40n][Number(n)]:-1n),
 sections:[section('The guard and the use disagree on width','MOV EAX, EDI copies only the low 32 bits of the index, and the guard tests EAX. The load, however, addresses with the full 64-bit RDI. The check and the access are reading two different numbers that merely share a name.','Writing EAX also zeroes the upper half of RAX, which is why this reads as a deliberate narrowing. The programmer validated the index — but validated a truncated copy of it.'),
 section('Reproduce the bypass','Enter 4294967299 (0x1_0000_0003). Its low 32 bits are 3, so CMP EAX, 4 passes, yet RDI is over four billion. The scaled address leaves the mapped region and the engine faults: a validated index that was never really validated.','Try 4294967296 (0x1_0000_0000): the low 32 bits are 0, the guard is perfectly satisfied, and the full index is still enormous. Any multiple of 2^32 plus a small value defeats the 32-bit check.'),
 section('Fix: check the value you actually use','Compare the full-width RDI (CMP RDI, 4 / JAE) so the guard and the load agree, and drop the narrowing MOV EAX, EDI. Verify small valid indices, the boundary, and the two truncation inputs.','Width-mismatch bugs are quiet: on ordinary inputs the truncated and full values agree, so tests pass and the flaw hides until an attacker supplies a value whose halves disagree. Validate at the width of the eventual use.')],
 hints:['The check reads EAX (32-bit); the load reads RDI (64-bit).','Compare the full RDI so the guard matches the access.','Remove the truncating MOV EAX, EDI.'],
 quiz:{q:'Why does index 0x100000003 pass the starter’s guard?',options:['0x100000003 is numerically less than 4.','Its low 32 bits (3) are what CMP EAX, 4 tests.','JAE ignores the high bits of RDI.'],answer:1,why:'EAX holds only the low 32 bits (3), which passes, while the load scales the full 0x100000003 and goes out of bounds.'},refs:['intel','memory']
},
{
 id:'off-by-one-guard',track:'vulnerabilities',title:'One past the end overwrites the length',subtitle:'An out-of-bounds write corrupts the metadata beside it.',duration:45,difficulty:'Intermediate',input:'4',inputLabel:'Index to write (RDI)',mode:'repair',goal:'Write only within buf[0..3] and return the intact length 4 for valid indices, UINT64_MAX otherwise. The out-of-range write at 4 must not reach the length field.',
 starter:`entry:
    cmp rdi, 4
    ja invalid
    lea rsi, [buf]
    mov qword ptr [rsi+rdi*8], 255
    mov rax, qword ptr [len]
    ret
invalid:
    mov rax, -1
    ret
.data
buf:
    .quad 0, 0, 0, 0
len:
    .quad 4`,
 solution:`entry:
    cmp rdi, 4
    jae invalid
    lea rsi, [buf]
    mov qword ptr [rsi+rdi*8], 255
    mov rax, qword ptr [len]
    ret
invalid:
    mov rax, -1
    ret
.data
buf:
    .quad 0, 0, 0, 0
len:
    .quad 4`,initial:n=>({rdi:n}),cases:[0n,1n,2n,3n,4n,5n],check:(m,n)=>retValue(m,n<4n?4n:-1n),
 sections:[section('Off-by-one: the boundary is inclusive by mistake','The array holds four elements at indices 0 to 3. The guard uses JA — jump if above — so it rejects only indices strictly greater than 4. Index 4 is allowed, and buf[4] is the eight bytes immediately after the array: the len field.','This is the canonical off-by-one. A single wrong comparison, ≤ where < was meant, lets one element past the end be accessed. On a write, that element is whatever lives next in memory — here, a length the program trusts later.'),
 section('Watch the corruption in memory','Open the Memory tab, enter 4, and step. The store lands at 0x2000+32, the len field, and changes 4 into 0xff. The function then returns that corrupted length. In a larger program a length inflated this way becomes the next bug: a loop or copy sized by it now runs far past its buffer.','This is why metadata adjacency matters. An out-of-bounds write is rarely interesting for the byte it corrupts; it is interesting for what that byte controls. Length and size fields sitting next to buffers are a recurring target.'),
 section('Fix: make the boundary exclusive','Replace JA with JAE so index 4 is rejected along with everything larger. The valid writes to 0 through 3 still succeed and the length stays 4; the out-of-range write never reaches it. Verify every index, and confirm len is unchanged after a valid write.','The pattern to internalize: for N elements, valid indices are strictly less than N. JAE (reject ≥ N) and JB (accept < N) encode that; JA and JG do not. One comparison stands between a contained write and corrupted adjacent state.')],
 hints:['JA allows index 4; valid indices are strictly below 4.','JAE rejects 4 and above, keeping the write inside buf.','The length field sits immediately after the array in memory.'],
 quiz:{q:'Why is the out-of-bounds write more dangerous than an equivalent read here?',options:['Writes are slower than reads.','It corrupts a length the program later trusts.','The CPU faults on every write past an array.'],answer:1,why:'The stray write changes len from 4 to 0xff; any later use of that length then operates on a wrong, attacker-influenced size.'},refs:['intel','memory']
},
{
 id:'saved-return',track:'binary',title:'Who chooses the next instruction?',subtitle:'Follow a saved return address from data into control flow.',duration:45,difficulty:'Intermediate',input:'0',inputLabel:'Unused input',mode:'repair',goal:'In this deliberately vulnerable fixture, redirect the overwritten return address to win and reach its return value of 42.',
 starter:`entry:
    call vulnerable
    ret
win:
    mov eax, 42
    ret
vulnerable:
    sub rsp, 16
    mov rax, 0
    mov qword ptr [rsp+16], rax
    add rsp, 16
    ret`,
 solution:`entry:
    call vulnerable
    ret
win:
    mov eax, 42
    ret
vulnerable:
    sub rsp, 16
    mov rax, win
    mov qword ptr [rsp+16], rax
    add rsp, 16
    ret`,initial:()=>({}),cases:[0n],check:m=>retValue(m,42n)&&m.history.some(h=>h.instruction==='ret'&&h.before.rip===BigInt(m.program.instructions.at(-1).address)),
 sections:[section('CALL leaves the future in writable memory','CALL stores its return address on the stack. The callee’s RET later reads that memory and uses it as its target. If a memory-corruption bug lets an input modify that saved address, data corruption can become a control-flow change.','This fixture makes the write explicit. It contains no external target, network access, or real process exploit. It is an inspectable model of the control-flow mechanism. The “payload” is the value loaded into RAX before the corrupting store.'),
 section('Account for the stack adjustment','At vulnerable’s entry, RSP points to the saved return address from CALL. The function subtracts 16 to reserve local space, so the saved address now sits at <code>[rsp+16]</code>. The starter writes zero there, restores RSP, and executes RET.','Run it and observe the eventual execution fault at address zero. Rewind to the store. Set a write watchpoint on 0x7ff0, the location of this nested call’s saved return address, and rerun. The watchpoint stops after the store, letting you inspect the overwritten bytes.'),
 section('Choose a controlled destination','The fixture’s win label identifies a function returning 42. Replace the zero immediate in the payload assignment with <code>win</code>. The assembler resolves that label into its address. Rebuild, stop before the corrupting store, and predict the next RET target.','The final RET in vulnerable now transfers to win. Win’s RET consumes the harness return address still above it on the stack, completing the exercise. The Calls panel is an event record, so corrupted return flow is best understood from actual RSP, memory, and RIP rather than an assumed source-level stack trace.'),
 section('Understand the assumptions before generalizing','This deliberately easy fixture has known addresses, writable stack data, and no canary or control-flow integrity. It is not a demonstration of bypassing ASLR, a shadow stack, or any modern mitigation. Each changes the available assumptions and belongs to its own later unit.','After observing the redirection, repair the underlying store to target a valid local slot, such as [rsp+8], and explain why ordinary return behavior resumes. The exercise check evaluates the controlled redirection task; your follow-up repair is a separate investigation. Exploit mechanics and prevention should both follow from the same memory layout.')],hints:['After SUB RSP, 16, the saved return address is at [rsp+16].','The payload register controls the value written to that address.','Change mov rax, 0 to mov rax, win.'],quiz:{q:'What causes RET to jump to the new address?',options:['RET recognizes a function named win.','RET loads its target from the overwritten stack slot.','Writing RAX immediately changes RIP.'],answer:1,why:'The memory write changes a future control-flow operand. RET subsequently reads that operand.'},refs:['intel','abi']
}
];
export const lessonById=id=>lessons.find(l=>l.id===id);
export function createFixture(Machine,assemble,lesson,source,input){
 const program=assemble(source),machine=new Machine(program,lesson.initial(input));
 if(lesson.setup)lesson.setup(machine,input);return machine;
}
export function verifyLesson(Machine,assemble,lesson,source,input){
 const cases=lesson.mode==='solve'?[input]:lesson.cases;
 const results=[];
 for(const value of cases){
  try{
   const m=createFixture(Machine,assemble,lesson,lesson.mode==='solve'?lesson.starter:source,value);
   // Continue through explicit INT3 instructions; all work shares one total budget.
   let remaining=10000;
   while(remaining>0&&!['halted','fault'].includes(m.status)){
    const used=m.run({limit:remaining});remaining-=used;if(!used)break;
   }
   const ok=m.status==='halted'&&lesson.check(m,value);
   results.push({input:String(value),ok,actual:'0x'+m.regs[0].toString(16),reason:ok?'Contract satisfied':m.status==='halted'?'Result or preserved state violates the contract':m.reason});
  }catch(e){results.push({input:String(value),ok:false,reason:e.message});}
 }
 return {ok:results.every(x=>x.ok),results};
}
