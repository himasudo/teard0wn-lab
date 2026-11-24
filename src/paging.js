// x86-64 four-level address translation.
//
// A 48-bit virtual address is four 9-bit table indices and a 12-bit page
// offset. The CPU walks PML4 → PDPT → PD → PT: each level's entry points to
// the next table, and the last gives the physical frame. A not-present entry
// anywhere on the walk is a page fault. This is the layer between the virtual
// addresses the engine runs on and the physical memory the caches model.
export const LEVELS = ['PML4', 'PDPT', 'PD', 'PT'];

export function split(vaddr) {
  const v = BigInt(vaddr) & ((1n << 48n) - 1n);
  return {
    indices: [Number((v >> 39n) & 0x1ffn), Number((v >> 30n) & 0x1ffn), Number((v >> 21n) & 0x1ffn), Number((v >> 12n) & 0x1ffn)],
    offset: Number(v & 0xfffn)
  };
}

// hierarchy: { root, tables: { <tableId>: { <index>: {present, target?, frame?} } } }
// target names the next-level table (levels 0-2); frame is the physical frame
// number (level 3). translate returns the per-level steps and either the
// physical address or the level at which the walk faulted.
export function translate(vaddr, hierarchy) {
  const {indices, offset} = split(vaddr);
  const steps = [];
  let table = hierarchy.root;
  for (let l = 0; l < 4; l++) {
    const idx = indices[l];
    const entry = (hierarchy.tables[table] || {})[idx] || null;
    steps.push({level: LEVELS[l], table, index: idx, entry});
    if (!entry || !entry.present) return {ok: false, faultLevel: LEVELS[l], steps, offset, indices};
    table = entry.target;
  }
  const frame = steps[3].entry.frame;
  const phys = (BigInt(frame) << 12n) | BigInt(offset);
  return {ok: true, steps, offset, indices, frame, phys};
}

// A small mapped hierarchy for the walkthrough: two pages under one path,
// with the rest of the address space unmapped so faults are reachable.
export const sampleHierarchy = {
  root: 'PML4',
  tables: {
    'PML4': {0: {present: true, target: 'PDPT-0'}},
    'PDPT-0': {0: {present: true, target: 'PD-0'}},
    'PD-0': {2: {present: true, target: 'PT-2'}},
    'PT-2': {1: {present: true, frame: 0x1a3}, 2: {present: true, frame: 0x1a4}}
  }
};

