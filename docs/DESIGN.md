# Design and decisions

A running record of the architecture and the reasoning behind it, so the build
can be followed one decision at a time.

## What the platform is

A static site (no server, GitHub Pages). Lessons are read, code is edited, and a
bounded x86-64 engine runs it in the browser with an inspectable debugger. The
Memory Systems Lab is the prerequisite; this is the hands-on sequel.

Because the site is static, the "debugger" is an x86-64 emulator written from
scratch in `src/machine.js`, not a real-CPU debugger behind a server. That is
also the advantage: an emulator can show state a real debugger cannot and can
step backward.

## Debugger model

The engine executes exactly one machine instruction per step; there is no
source-line layer yet, so every step is instruction granularity (`si`).

- **Step** — one instruction.
- **Over** — if the instruction is a call, run the callee to completion and stop
  at the instruction after the call. Breakpoints and watchpoints inside the
  callee still stop.
- **Finish** — run to the current function's return.
- **Back** — reverse one step, restoring registers, flags, memory writes, output,
  and call-event state (last 512 steps).
- Breakpoints stop before an instruction; write watchpoints stop after.

Over and Finish are built on a depth-aware `run({until})` predicate: Over records
the call depth, steps once, and if depth increased, runs until it returns to the
starting depth; Finish runs until depth drops below the current frame.

## Execution engine

The hand assembler (`assemble`) emits genuine x86-64 bytes for a small, readable
subset. The decoder/executor is deliberately a **superset** of what the assembler
emits, so it can also decode and run real `gcc` output.

Decision: expand the **decoder**, not the assembler. Authored lessons stay in the
safe, readable subset a learner types; compiled lessons can run real binaries
without widening what the editor accepts. The decoder adds `movzx`/`movsx`/
`movsxd`, one-operand `mul`/`div`/`idiv` with `cdq`/`cqo`/`cdqe`, `cmov`, `setcc`,
`leave`, `xchg`, `CL` shifts, sign-extended `imm8` arithmetic, `rel8` branches,
indirect `call`/`jmp`/`push`, `endbr64`, multi-byte `nop`, and the surrounding
prefixes.

## Verification strategy

Correctness is the whole value of the project, so semantics are checked against a
real CPU at three layers:

1. **Unit** (`tests/machine.test.js`) — known-byte encodings, flag semantics,
   debugger behavior, every lesson's worked solution and starter.
2. **Native differential** (`tests/native_check.py`) — the assembler's emitted
   bytes executed on the host CPU vs the engine: registers and architecturally
   defined flags, 421 fixtures across widths, arithmetic/logic/shift/`imul`, all
   16 `Jcc`, and REX aliasing.
3. **Compiled-C differential** (`tests/compiled_check.mjs`) — compile C with
   `gcc`, run it natively, then run the **same bytes** in the engine and compare
   return values across many inputs. At `-O0` (the teaching target) real
   functions covering recursion, division/modulo, `switch`, local arrays,
   variable shifts, and width conversion all match; `-O2` matches too, including
   packed-SSE vectorized functions.

## Current boundaries

- Packed SSE/SSE2 runs (integer and FP lane arithmetic plus the lane-build/
  extract moves `-O2` emits); 256-bit AVX (VEX encoding) and legacy x87 do not.
  gcc's SSE2 baseline — what x86-64 uses by default — executes; `-mavx` does not.
- Flat memory map for execution: results never depend on timing. Cache/TLB/branch
  behaviour is modelled separately as the Micro overlay (see below), not fed back
  into execution.
- Modeled syscalls only (`write` to stdout/stderr, `exit`).

## Shipped

- **Debugger.** Step (instruction), Over, Finish, Back, breakpoints, write
  watchpoints.
- **Compiled C.** The decoder runs real `gcc -O0`/`-O2` output (RIP-relative,
  `const` globals, strings, jump tables, and packed SSE2 vectorization).
  `tools/compile_lesson.py` generates `src/compiled.js`; the Compiled C section
  shows C and asm side by side with source-line `step`/`next` and instruction
  `stepi`.
- **SSE / packed SIMD.** Scalar FP and packed SSE2 run over a 16-register XMM
  file: packed integer add/sub (8/16/32/64-bit lanes) and bitwise and/andn/or/
  xor, packed single/double add/mul/sub/div, and the `movd`/`movq`, `pshufd`,
  `unpck*`/`punpck*`, and `cvtdq2ps`/`cvtdq2pd` lane plumbing `-O2` emits to
  build and reduce vectors — all bit-exact against the host. The Registers view
  shows each XMM value as four int32 lanes and a double, and a compiled lesson
  (`c-simd`) steps a `paddd` that adds four lanes at once.
- **Microarchitecture overlay.** `src/micro.js` models the Memory Systems Lab
  machine's data caches, TLBs, and a bimodal predictor; the Micro tab shows
  per-instruction hit level, TLB outcome, prediction, and modeled cycles.
- **Coverage-guided fuzzing.** `src/fuzzer.js` mutates inputs to a compiled
  target, keeps any input that covers a new instruction, and reports an engine
  fault as a crash. The Fuzzing section shows a live coverage map; the gated
  target is cracked in the low thousands of executions where blind search could
  not. Targets build through the same pipeline (`lessons/fuzz/`).
- **Memory ordering.** `src/tso.js` is an operational x86-TSO model (per-thread
  FIFO store buffers, drain-to-memory, store-buffer-forwarding loads, MFENCE).
  The Concurrency section runs the classic litmus tests and marks each outcome
  allowed iff the model can reach it.
- **Linking & loading.** `tools/elf_extract.py` captures the real ELF structure
  of a dynamically-linked gcc build into `src/elfdata.js`; the Linking section
  walks the header, segments, sections, the resolved vs PLT call, the relocation
  behind the direct call, and PLT/GOT lazy binding — with a test asserting the
  stub jumps through exactly the GOT slot the JUMP_SLOT relocation patches.

## Roadmap

1. **AVX and x87.** Packed SSE2 now runs — integer and floating-point lane
   arithmetic plus the `movd`/`pshufd`/`unpck`/`cvtdq2*` plumbing — so gcc's
   SSE2-baseline `-O2` vectorized functions execute bit-exact (404 differential
   cases across `-O0`/`-O2`). The remaining gaps are 256-bit AVX (VEX encoding)
   and legacy x87. Between the scalar core, writable globals, and packed SSE,
   essentially any SSE2-targeted C function now runs in the engine.
