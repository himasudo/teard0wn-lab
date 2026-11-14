# Curriculum and coverage ledger

The screenshot’s twelve tracks are baseline scope. Ten additional tracks expand systems and research coverage. A listed curriculum unit is a development commitment, not a completed lesson.

## Current runnable work

| Track | Runnable lessons | Full planned units |
| --- | ---: | ---: |
| 00 · Start here | 1 | 4 |
| 01 · Assembly & the ABI | 5 | 10 |
| 02 · Reverse engineering | 2 | 8 |
| 03 · Crackmes | 1 | 6 |
| 04 · Shellcoding | 1 | 6 |
| 05 · Vulnerability classes | 1 | 8 |
| 06 · Binary exploitation | 1 | 9 |
| 07 · Heap exploitation | 0 | 8 |
| 08 · Crash triage & sanitizers | 0 | 7 |
| 09 · Fuzzing | 0 | 8 |
| 10 · ARM TrustZone | 0 | 8 |
| 11 · Kernel exploitation | 0 | 8 |
| 12 · C & C++ boundaries | 0 | 7 |
| 13 · From source to process | 0 | 8 |
| 14 · Concurrency & memory models | 0 | 8 |
| 15 · Linux internals | 0 | 8 |
| 16 · Networking & storage | 0 | 8 |
| 17 · Performance investigation | 0 | 8 |
| 18 · Symbolic execution | 0 | 8 |
| 19 · eBPF & verifier reasoning | 0 | 7 |
| 20 · Virtualization & isolation | 0 | 7 |
| 21 · Microarchitectural security | 0 | 7 |

## Delivery standard

A delivered lab needs a contract, prerequisite links, first-principles explanations, observable execution, failure and edge cases, staged hints, an explained solution, meaningful checks, and primary references. Version-sensitive security techniques need pinned versions and explicit mitigation assumptions. Hardware measurements need recorded environment and evidence.

## 00 · Start here

Learn the workbench. Make a prediction, stop the machine, and follow the evidence.

Level/runtime direction: Orientation. Prerequisites: Memory Systems Lab.

Runnable now: Your first breakpoint.

Full progression:

1. The investigation loop
2. Registers, memory, and evidence
3. Using the debugger
4. Reproducing and reporting a result

## 01 · Assembly & the ABI

From one instruction to the contracts between compiled functions.

Level/runtime direction: Foundation → advanced. Prerequisites: Start here.

Runnable now: One register, four widths; The same bits, two orderings; An address is a calculation; Find the missing iteration; A function owes its caller.

Full progression:

1. Instruction encodings
2. Register widths and aliasing
3. Arithmetic and flags
4. Signed and unsigned control flow
5. Address calculation and data layout
6. Loops and boundary conditions
7. Stack frames and call/return
8. System V AMD64 ABI
9. Floating point and SIMD
10. AArch64 and its calling convention

## 02 · Reverse engineering

Recover behavior from bytes. Separate observation from a convincing guess.

Level/runtime direction: Foundation → advanced. Prerequisites: Assembly & the ABI.

Runnable now: Recover a hidden predicate; Recover a field from its offset.

Full progression:

1. Static versus dynamic analysis
2. Recovering predicates
3. Inferring structures
4. Optimized and stripped binaries
5. Control-flow graphs
6. C++ objects, RTTI, and exceptions
7. Decompilation and its failure modes
8. Binary diffing and patch analysis

## 03 · Crackmes

Original puzzles that make you reconstruct a program’s rules.

Level/runtime direction: Progressive challenges. Prerequisites: Reverse engineering.

Runnable now: Three gates, one key.

Full progression:

1. One predicate
2. Multiple independent gates
3. Checksum and state-machine puzzles
4. Constraint-based solving
5. Obfuscation and opaque predicates
6. Virtual-machine reversing

## 04 · Shellcoding

Understand executable bytes, operating-system boundaries, and payload constraints.

Level/runtime direction: Foundation → advanced. Prerequisites: Assembly & the ABI.

Runnable now: A write without libc.

Full progression:

1. A syscall without libc
2. Instruction bytes and restrictions
3. Position independence
4. i386 and x86-64 syscall conventions
5. Restricted-byte exercises
6. Controlled payload execution and mitigations

## 05 · Vulnerability classes

Find the broken invariant behind overflows, lifetime errors, and races.

Level/runtime direction: Foundation → advanced. Prerequisites: Assembly & the ABI.

Runnable now: Mapped does not mean in bounds.

Full progression:

1. Object bounds versus mapped memory
2. Integer overflow and conversions
3. Stack and heap overflows
4. Use-after-free and double-free
5. Format strings
6. Uninitialized memory and information leaks
7. Race conditions and TOCTOU
8. Root-cause repair and regression testing

## 06 · Binary exploitation

Follow corruption into control flow in deliberately vulnerable lab programs.

Level/runtime direction: Intermediate → advanced. Prerequisites: Vulnerability classes, Reverse engineering, Shellcoding.

Runnable now: Who chooses the next instruction?.

Full progression:

1. Saved return addresses and ret2win
2. pwntools and binary I/O
3. Finding offsets and constructing inputs
4. Leaks and ASLR
5. ret2libc
6. GOT/PLT and RELRO
7. ROP and stack pivots
8. Canaries, PIE, NX, and CFI
9. Reliability, failure analysis, and repairs

## 07 · Heap exploitation

Read allocator state before studying what corruption can make it do.

Level/runtime direction: Intermediate → advanced. Prerequisites: Binary exploitation, C & C++ boundaries.

Runnable now: none; planned track.

Full progression:

1. Build an allocator
2. Chunks, bins, and invariants
3. Pinned glibc allocator versions
4. Tcache and double-free
5. Tcache poisoning and safe-linking
6. House of spirit and house of force (historical)
7. Unsafe unlink and its checks (historical)
8. Lifetime design and exploit-resistant repair

## 08 · Crash triage & sanitizers

Turn a crash into a minimized reproducer and an explained fix.

Level/runtime direction: Intermediate. Prerequisites: Vulnerability classes.

Runnable now: none; planned track.

Full progression:

1. Fault classification
2. Core dumps and unwinding
3. ASan and UBSan
4. MSan and TSan constraints
5. Reproducer minimization
6. Crash deduplication
7. Regression testing a repair

## 09 · Fuzzing

Build harnesses, measure coverage, and investigate what the fuzzer finds.

Level/runtime direction: Intermediate → advanced. Prerequisites: Crash triage & sanitizers.

Runnable now: none; planned track.

Full progression:

1. Harness boundaries and determinism
2. Coverage feedback
3. Corpus selection and minimization
4. Mutation and structured inputs
5. Stateful protocol fuzzing
6. Differential and metamorphic fuzzing
7. Crash triage and regression corpora
8. Measuring campaign quality

## 10 · ARM TrustZone

Study world separation and the boundary between trusted and untrusted software.

Level/runtime direction: Advanced · VM track. Prerequisites: Assembly & the ABI, Vulnerability classes, Virtualization & isolation.

Runnable now: none; planned track.

Full progression:

1. Threat model and architecture
2. Secure and Normal worlds
3. Secure monitor calls
4. Trusted applications
5. Shared-memory validation
6. OP-TEE lab environment
7. Controlled TEE memory corruption
8. Mitigations and boundary repair

## 11 · Kernel exploitation

Investigate deliberately vulnerable kernels and drivers inside disposable machines.

Level/runtime direction: Advanced · VM track. Prerequisites: Binary exploitation, Linux internals, Heap exploitation.

Runnable now: none; planned track.

Full progression:

1. Kernel address spaces and privileges
2. Kernel debugging and Oops analysis
3. A deliberately vulnerable driver
4. Null dereferences and historical assumptions
5. Kernel lifetime bugs
6. Controlled privilege-boundary exercises
7. KASLR, SMEP/SMAP, and allocator defenses
8. Patch analysis and regression tests

## 12 · C & C++ boundaries

Connect the language’s rules to the machine’s behavior.

Level/runtime direction: Intermediate → advanced. Prerequisites: Assembly & the ABI.

Runnable now: none; planned track.

Full progression:

1. Object representation and padding
2. Lifetime and pointer provenance
3. Integer promotions and conversions
4. Undefined behavior and optimization
5. Aliasing and effective types
6. C++ object lifetime and virtual dispatch
7. Sanitizer coverage and blind spots

## 13 · From source to process

Take apart compilation, ELF, linking, loading, and startup.

Level/runtime direction: Intermediate → advanced. Prerequisites: Assembly & the ABI.

Runnable now: none; planned track.

Full progression:

1. Preprocessing and translation units
2. Compiler IR and optimization
3. Object files and symbols
4. Relocations and linkers
5. ELF segments versus sections
6. Dynamic loading and symbol resolution
7. GOT/PLT and thread-local storage
8. Process startup and DWARF

## 14 · Concurrency & memory models

Reason about visibility, lifetime, and progress across threads.

Level/runtime direction: Intermediate → advanced. Prerequisites: C & C++ boundaries.

Runnable now: none; planned track.

Full progression:

1. Language versus hardware memory models
2. Happens-before and data races
3. Acquire/release and sequential consistency
4. Litmus tests
5. Mutexes and futexes
6. Deadlock and progress guarantees
7. Lock-free queues and ABA
8. Hazard pointers, epochs, and RCU

## 15 · Linux internals

Trace the operating-system mechanisms behind everyday programs.

Level/runtime direction: Intermediate → advanced. Prerequisites: From source to process.

Runnable now: none; planned track.

Full progression:

1. Syscall entry and return
2. Processes, threads, and scheduling
3. Signals and interrupted calls
4. File descriptors and open file descriptions
5. Virtual-memory policy
6. Namespaces and cgroups
7. Seccomp and capabilities
8. Tracing kernel/user transitions

## 16 · Networking & storage

Build correct I/O around partial work, backpressure, and failure.

Level/runtime direction: Intermediate → advanced. Prerequisites: Linux internals, Concurrency & memory models.

Runnable now: none; planned track.

Full progression:

1. Socket lifetime and partial I/O
2. epoll and readiness
3. Backpressure and queues
4. Zero-copy tradeoffs
5. Filesystem caching
6. fsync and durable updates
7. Write-ahead logging
8. Crash consistency and fault injection

## 17 · Performance investigation

Make measurements that can distinguish explanations.

Level/runtime direction: Advanced · native measurements. Prerequisites: Assembly & the ABI, Concurrency & memory models.

Runnable now: none; planned track.

Full progression:

1. Experimental design and confounders
2. Profiling and sampling
3. PMU access and limitations
4. Assembly and vectorization
5. False sharing and contention
6. NUMA placement
7. Branch behavior
8. Reporting reproducible evidence

## 18 · Symbolic execution

Express path conditions and understand where solver-driven analysis breaks down.

Level/runtime direction: Advanced. Prerequisites: Crackmes, C & C++ boundaries.

Runnable now: none; planned track.

Full progression:

1. Symbolic values and constraints
2. Path predicates
3. SMT and bit vectors
4. Concolic execution
5. Path explosion
6. Environment modeling
7. Solving original crackmes
8. False confidence and validation

## 19 · eBPF & verifier reasoning

Inspect verifier state, bounds, and helper contracts.

Level/runtime direction: Advanced · VM track. Prerequisites: Linux internals, Vulnerability classes.

Runnable now: none; planned track.

Full progression:

1. eBPF execution model
2. Register types and ranges
3. Verifier state exploration
4. Maps and helper contracts
5. Tracing labs
6. Rejected-program investigations
7. Published patch case studies

## 20 · Virtualization & isolation

Understand the boundaries between guests, kernels, and devices.

Level/runtime direction: Advanced · VM track. Prerequisites: Linux internals.

Runnable now: none; planned track.

Full progression:

1. Guest/host execution
2. Nested address translation
3. VM exits
4. Device emulation
5. Virtio queues
6. Snapshot and replay workflows
7. Isolation threat models

## 21 · Microarchitectural security

Connect cache and speculation mechanisms to information leakage.

Level/runtime direction: Advanced · measured experiments. Prerequisites: Performance investigation, Vulnerability classes.

Runnable now: none; planned track.

Full progression:

1. Architectural versus microarchitectural state
2. Timing and measurement noise
3. Cache side-channel models
4. Speculative execution
5. Controlled published case studies
6. Mitigation tradeoffs
7. Limits of emulation and inference

## Staged implementation

1. Foundation release: the current 12 labs and inspectable workbench; complete rendered QA and Pages publication.
2. Toolchain/runtime milestone: validate a native x86-64 compiler/debugger path in an isolated environment; add ELF, ABI, debug information, and C-boundary labs. Browser feasibility must be measured before promising a full native browser VM.
3. Security core: expand reversing/crackmes/shellcoding, complete vulnerability classes, pwntools, binary exploitation, allocator internals, pinned heap techniques, triage/sanitizers, and fuzzing.
4. Systems depth: concurrency, Linux internals, networking/storage, and native performance experiments.
5. Advanced environments: ARM/OP-TEE, kernel labs, eBPF verifier, virtualization, symbolic execution, and microarchitectural security, with environment-specific evidence.

These stages are sequencing, not permission to remove any baseline track. Exact parity with an unseen complete external lesson catalogue has not been independently established; the supplied screenshot’s named scope is preserved.
