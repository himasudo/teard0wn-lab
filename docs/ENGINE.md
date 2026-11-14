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

A differential test (`tests/compiled_check.mjs`) compiles a set of C functions, runs them natively, then executes the identical bytes in this engine and compares return values across many inputs. At `-O0` — the readable teaching target — real functions covering recursion, division/modulo, `switch`, local arrays, variable shifts, width conversion, static tables, and string indexing all match the native CPU. `-O2` matches except where the compiler vectorizes with SSE.

Current boundaries for running compiled code: no SSE/AVX/x87, and writable `.data`/`.bss` is not loaded yet, so functions that write to mutable globals do not run. These are the next items before arbitrary compiled lessons.

## Memory

| Region | Range | Permissions |
| --- | --- | --- |
| Code | 0x1000 through assembled end, at most 0x2000 exclusive | Read, execute |
| Data | 0x2000–0x3fff | Read, write |
| Stack | 0x7000–0x7fff | Read, write |
| Harness return | 0xfff0 | Synthetic RET completion sentinel, not executable memory |

Initial RSP is 0x7ff8, holding the sentinel. A completed top-level RET advances it to 0x8000. Code/data bytes outside initialized regions start at zero, but access is permitted only in the map above. Mapped memory does not imply an access is inside a language-level object.

The flat map does not model page tables, TLBs, ASLR, a loader, caches, or permission-granularity behavior. Memory Systems Lab is the separate prerequisite for those mechanisms.

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
