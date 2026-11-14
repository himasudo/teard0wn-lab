// A small, explicit microarchitecture model: data caches, TLBs, and a branch
// predictor, driven by the addresses and branches the engine actually executes.
// Sizes follow the Memory Systems Lab's model machine. Latencies are
// REPRESENTATIVE UNLOADED cycle counts for teaching, not measurements of any
// real processor and not a timing simulation (no queueing, contention, MLP, or
// prefetch). The point is to make locality and prediction visible, not to
// predict wall-clock time.

export const LINE = 64;        // cache line / coherence granule, bytes
export const PAGE = 4096;      // page size, bytes

// Representative unloaded latencies, in cycles.
export const LAT = {base:1, L1:4, L2:12, L3:40, DRAM:200, tlbL2:7, walk:30, mispredict:15};

// Set-associative cache with true LRU. `unit` is the block size (LINE for data,
// PAGE for a TLB). `entries` total blocks; `ways` associativity (ways===entries
// gives a fully-associative structure with one set).
class SetAssoc {
  constructor(entries, ways, unit) {
    this.ways = ways; this.unit = unit; this.sets = entries / ways;
    if (!Number.isInteger(this.sets)) throw new Error('entries must be a multiple of ways');
    this.reset();
  }
  reset() { this.tag = Array.from({length: this.sets}, () => []); } // [0] = most-recent
  // Access the block containing `addr`; returns true on hit. LRU updated, with
  // one block installed on a miss.
  access(addr) {
    const block = Math.floor(addr / this.unit);
    const set = ((block % this.sets) + this.sets) % this.sets;
    const tag = Math.floor(block / this.sets);
    const line = this.tag[set];
    const i = line.indexOf(tag);
    if (i >= 0) { line.splice(i, 1); line.unshift(tag); return true; }
    line.unshift(tag); if (line.length > this.ways) line.pop();
    return false;
  }
}

export class Microarch {
  constructor() {
    // Data cache hierarchy (model machine): 48 KiB L1d 12-way, 512 KiB L2 8-way,
    // 4 MiB L3 16-way. Accessing a level installs on miss, modelling inclusive fills.
    this.L1 = new SetAssoc(768, 12, LINE);     // 48 KiB
    this.L2 = new SetAssoc(8192, 8, LINE);     // 512 KiB
    this.L3 = new SetAssoc(65536, 16, LINE);   // 4 MiB
    // TLBs: 64-entry fully-associative L1 DTLB, 512-entry 8-way L2 TLB, 4 KiB pages.
    this.dtlb = new SetAssoc(64, 64, PAGE);
    this.stlb = new SetAssoc(512, 8, PAGE);
    // Branch predictor: 1024-entry 2-bit bimodal (counter 0..3, >=2 predicts taken).
    this.bp = new Uint8Array(1024).fill(1);
    this.reset();
  }
  reset() {
    for (const c of [this.L1, this.L2, this.L3, this.dtlb, this.stlb]) c.reset();
    this.bp.fill(1);
    this.cycles = 0;
    this.stats = {insns:0, loads:0, stores:0, L1:0, L2:0, L3:0, DRAM:0,
                  tlbHit:0, tlbL2:0, walks:0, branches:0, mispred:0};
    this.last = null; // per-step summary for the UI
  }
  _data(addr, write) {
    // Translate first, then look up the line.
    let tlb;
    if (this.dtlb.access(addr)) { tlb = 'L1'; this.stats.tlbHit++; }
    else if (this.stlb.access(addr)) { tlb = 'L2'; this.stats.tlbL2++; this.cycles += LAT.tlbL2; }
    else { tlb = 'walk'; this.stats.walks++; this.cycles += LAT.walk; }
    let level;
    if (this.L1.access(addr)) { level = 'L1'; this.cycles += LAT.L1; }
    else if (this.L2.access(addr)) { level = 'L2'; this.cycles += LAT.L2; }
    else if (this.L3.access(addr)) { level = 'L3'; this.cycles += LAT.L3; }
    else { level = 'DRAM'; this.cycles += LAT.DRAM; }
    this.stats[level]++;
    this.stats[write ? 'stores' : 'loads']++;
    return {addr, write, level, tlb};
  }
  _branch(pc, taken) {
    const i = (pc >>> 0) & 1023, c = this.bp[i], predicted = c >= 2, correct = predicted === taken;
    this.bp[i] = taken ? Math.min(3, c + 1) : Math.max(0, c - 1);
    this.stats.branches++;
    if (!correct) { this.stats.mispred++; this.cycles += LAT.mispredict; }
    return {pc, taken, predicted, correct};
  }
  // Observe one retired instruction from the engine (see machine step records).
  observe(machine) {
    this.stats.insns++; this.cycles += LAT.base;
    const accesses = (machine.lastAccesses || []).map(a => this._data(a.address, a.write));
    const branch = machine.lastBranch ? this._branch(machine.lastBranch.pc, machine.lastBranch.taken) : null;
    this.last = {accesses, branch};
    return this.last;
  }
}
