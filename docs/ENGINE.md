# Engine contract — v0.1

## What is executed

The assembler emits genuine x86-64 bytes. The executor decodes the bytes at RIP independently from displayed source annotations. BigInt arithmetic preserves exact integer bits. The machine is deterministic and single-threaded; it is a teaching engine, not a complete x86 implementation or native process.

Supported instructions: MOV, LEA, ADD, SUB, CMP, INC, DEC, NEG, IMUL (two-operand 16/32/64-bit), AND, OR, XOR, TEST, NOT, immediate SHL/SHR/SAR, direct near JMP/Jcc/CALL, RET, 64-bit register PUSH/POP, signed 32-bit immediate PUSH, NOP, INT3, and the modeled SYSCALL cases below.

Operand widths: 8, 16, 32, 64 bits. Register views: RAX–R15, their 32/16-bit names, and low-byte names. AH/BH/CH/DH are unsupported. The upper half is zeroed by a 32-bit register write; smaller writes preserve other bits.

Address form: 64-bit base + index × 1/2/4/8 + signed 32-bit displacement. RSP cannot be an index; R12 can. No RIP-relative/address-size override/segment forms. Unsupported instructions and ambiguous widths produce line-specific build errors.

## Decoding compiled output

The decoder understands a larger set than the hand assembler emits, so it can execute real `gcc` output byte-for-byte. Beyond the families above it decodes: `movzx`/`movsx`/`movsxd`, one-operand `mul`/`imul`/`div`/`idiv` with `cdq`/`cqo`/`cdqe`/`cwde`, `cmov`cc, `setcc`, `leave`, `xchg`, shifts by `CL`, sign-extended `imm8` arithmetic (`0x83`), short `rel8` `jmp`/`jcc`, indirect `call`/`jmp`/`push` (`FF /2,/4,/6`), `endbr64`/`endbr32` and multi-byte `nop` (as no-ops), and the legacy/REX prefixes around them.

RIP-relative operands are decoded (resolved against the next instruction's
address, after any trailing immediate), so a read-only `.text`+`.rodata` image
runs: `const` globals, string literals, and `-O2` jump tables all work.

128-bit SSE data moves (`movaps`/`movapd`/`movups`/`movupd`/`movdqa`/`movdqu`) run as well, over a 16-register XMM file, so integer-vectorized init and copy work (for example gcc's `-O2` array initialisation via a 128-bit load and store).

Scalar SSE floating-point runs too: `movsd`/`movss`, `addsd`/`subsd`/`mulsd`/`divsd` (and the `ss` forms), `cvtsi2sd`, `cvttsd2si`, `comisd`/`ucomisd`, and `pxor`. The arithmetic uses the host's IEEE-754 binary64/binary32, so results are bit-exact against x86 — the differential compares full 64-bit `xmm0` return patterns.

Packed SSE2 runs as well. Lane-parallel integer add and subtract at 8/16/32/64-bit widths (`paddb`…`paddq`, `psubb`…`psubq`), the bitwise ops (`pand`, `pandn`, `por`, `pxor`), and packed single/double floating-point add/mul/sub/div (`addps`/`addpd`/`mulpd`/… over four f32 or two f64 lanes) all compute lane by lane against the host's IEEE-754, bit-exact. The lane-build and reduce plumbing that `-O2` emits around them is decoded too: `movd`/`movq` between GPR and XMM, `pshufd`, `unpcklps`/`unpcklpd` and the integer `punpck*`, `movlhps`/`movhlps`, and the int↔float conversions `cvtdq2ps`/`cvtdq2pd` and `cvt(t)ps2dq`/`cvt(t)pd2dq`. The Registers view shows any non-zero XMM register as four int32 lanes and, for scalar FP, its low 64 bits read as a double.

A differential test (`tests/compiled_check.mjs`) compiles a set of C functions, runs them natively, then executes the identical bytes in this engine and compares return values across many inputs. At `-O0` — the readable teaching target — real functions covering recursion, division/modulo, `switch`, local arrays, variable shifts, width conversion, static tables, and string indexing all match the native CPU, and `-O2` builds match too, including packed-SSE vectorized functions (GNU vector types compiled to `paddd`/`addps`/`addpd`/`mulpd`, with the `-O2` lane build and reduce around them).

Writable `.data`/`.bss` loads too: a compiled lesson is linked with its data segment at the engine's 0x2000 window and that image is loaded writable, so functions with mutable globals run and the Memory view shows the global change as it happens. The remaining boundary is 256-bit AVX (VEX encoding) and legacy x87: SSE2-baseline code — scalar and packed — runs, but `-mavx` output does not yet.

## Memory

| Region | Range | Permissions |
| --- | --- | --- |
| Code | 0x1000 through assembled end, at most 0x2000 exclusive | Read, execute |
| Data | 0x2000–0x3fff | Read, write |
| Stack | 0x7000–0x7fff | Read, write |
| Harness return | 0xfff0 | Synthetic RET completion sentinel, not executable memory |

Initial RSP is 0x7ff8, holding the sentinel. A completed top-level RET advances it to 0x8000. Code/data bytes outside initialized regions start at zero, but access is permitted only in the map above. Mapped memory does not imply an access is inside a language-level object.

The flat map does not model page tables, TLBs, ASLR, a loader, caches, or permission-granularity behavior. Memory Systems Lab is the separate prerequisite for those mechanisms.

## Modeled microarchitecture (overlay)

Execution stays architectural: results never depend on timing. Separately, the compiled walkthroughs carry a microarchitecture overlay (the Micro tab) that watches the addresses and branches each instruction executes and models their behaviour on the Memory Systems Lab machine:

- data caches — 48 KiB L1d (12-way), 512 KiB L2 (8-way), 4 MiB L3 (16-way), 64-byte lines, true LRU;
- TLBs — 64-entry fully-associative L1 DTLB and a 512-entry L2 TLB over 4 KiB pages;
- a 1024-entry two-bit bimodal branch predictor.

It reports the per-instruction hit level, TLB outcome, and prediction, plus running totals and a modeled cycle count using representative unloaded latencies (L1 4, L2 12, L3 40, DRAM 200, mispredict 15, page walk 30). This is a locality-and-prediction teacher, not a timing simulator: no queueing, contention, memory-level parallelism, prefetching, or refresh, and the model never feeds back into execution. Its hit/miss behaviour is checked in `tests/micro.test.js`.

## Coverage-guided fuzzing

`src/fuzzer.js` runs a compiled target with a 32-bit input and takes the set of instruction addresses the run executed as its coverage. It keeps any input that reaches a new address and mutates from that corpus, so it works through byte-compared gates one at a time; a crash is an engine fault. On the byte-gated target this finds the single crashing input in the low thousands of executions, against a 2^32 space. `tests/fuzzer.test.js` checks that the gated input is found and that the known crash faults while a benign input does not.

## Memory ordering (x86-TSO)

`src/tso.js` is an operational model of x86-TSO, separate from the single-threaded engine. Each thread's stores enter a private FIFO store buffer and reach memory only on drain; the thread's own loads read its buffer first; MFENCE blocks until the buffer is empty. `explore()` enumerates every interleaving and drain order and returns the set of reachable final register tuples, so the Concurrency lab can mark an outcome allowed exactly when it is reachable. This reproduces the classic results — SB permits (0,0), an MFENCE between removes it, MP forbids reading a set flag with stale data, LB forbids both loads returning 1 — all checked in `tests/tso.test.js`.

## Flags

CF, PF, AF, ZF, SF, and OF are represented. Undefined results are null, rendered as `?`. A conditional branch depending on an undefined flag faults explicitly. This conservative behavior is a teaching choice; real hardware still has a bit value, but software may not rely on it when the architecture leaves it undefined.

INC/DEC preserve CF. MOV/LEA/NOT preserve arithmetic flags. Logical instructions clear CF/OF and leave AF undefined. Two-operand IMUL defines CF/OF and leaves SF/ZF/AF/PF undefined. Shift count masks and zero-count preservation are modeled; undefined shift flags are not fabricated.

## Debugger and limits

- Step executes one instruction. Step-over runs a called function to completion and stops after the call; finish runs to the current function's return. Both honour breakpoints and watchpoints encountered inside the region.
- Address breakpoints stop before execution. Continuing skips the just-hit breakpoint once.
- Write watchpoints stop after an instruction touches a selected byte, including a same-value write.
- Reverse stepping restores register/flag/output/call-event state and memory writes. Only the newest 512 steps are retained.
- Faulting instructions roll back architectural changes. This is a simplified precise-fault model, not every possible x86 exception behavior.
- Run executes in browser-yielding batches and stops after 10,000 instructions. The verifier uses fresh machines and an independent total budget.
- Build replaces the machine and clears address breakpoints/watchpoints.
- Call display records CALL/RET events. It is not DWARF unwinding, and corrupted return flow must be investigated using real stack bytes/RIP.
- Source limit 64,000 characters; code limit 4 KiB; initialized data limit 8 KiB; `.zero` limit 1 KiB per directive.

## Modeled operating-system boundary

SYSCALL models Linux x86-64 `write` (1) for descriptors 1/2 and `exit` (60). Write captures at most 4 KiB per call into browser output and returns the full requested length. Exit stops with its low eight status bits. RCX/R11 clobbers are modeled. No host syscall, process, file access, socket, or network operation occurs.

Short writes, signals, errno, kernel state, permissions, filesystem behavior, and other syscalls are not modeled. A lesson must not present these results as evidence of native Linux behavior beyond the explicit case.

## Verification evidence and remaining gaps

The repository includes known-byte tests, semantics/negative tests, every worked solution and starter check, and a native differential harness. Native tests execute the exact emitted bytes for bounded arithmetic/control-flow fixtures, comparing general-register results and architecturally defined flags.

This is evidence for covered cases, not full CPU conformance. Future work should expand native randomized comparisons, imported binary decoding, and compiler/runtime support before advertising broader execution fidelity. Kernel/TrustZone/PMU labs require separately validated environments.

Primary references: [Intel SDM](https://intel.github.io/SDM/sdm.html), [AMD64 psABI](https://gitlab.com/x86-psABIs/x86-64-ABI), [GNU assembler](https://sourceware.org/binutils/docs/as/i386_002dVariations.html).
