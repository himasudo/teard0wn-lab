// AddressSanitizer-style shadow memory.
//
// A sanitizer surrounds every allocation with poisoned "redzone" bytes and
// records, in a shadow map, which bytes are legitimately addressable. Each
// memory access consults the shadow: touching a poisoned byte is a reported
// error — even when the address is mapped and the CPU would not fault. That is
// how sanitizers catch the out-of-bounds reads and writes that otherwise
// silently return or corrupt adjacent data.

// Build a shadow map for one heap allocation framed by redzones.
// Returns {bytes:[{zone}], allocBase, allocSize} where zone is
// 'redzone' (poisoned) or 'alloc' (addressable).
export function buildShadow({redzone = 16, alloc = 20} = {}) {
  const bytes = [];
  for (let i = 0; i < redzone; i++) bytes.push({zone: 'redzone'});
  for (let i = 0; i < alloc; i++) bytes.push({zone: 'alloc'});
  for (let i = 0; i < redzone; i++) bytes.push({zone: 'redzone'});
  return {bytes, allocBase: redzone, allocSize: alloc};
}

// Check an access at a byte offset (relative to the allocation base) of a given
// size. Returns {ok, kind, touched} where kind is 'ok', 'overflow', or
// 'underflow', and touched is the list of absolute shadow indices read/written.
export function checkAccess(shadow, off, size) {
  const start = shadow.allocBase + off;
  const touched = [];
  let underflow = false, overflow = false;
  for (let i = start; i < start + size; i++) {
    touched.push(i);
    if (i < 0 || i >= shadow.bytes.length || shadow.bytes[i].zone === 'redzone') {
      if (i < shadow.allocBase) underflow = true; else overflow = true;
    }
  }
  const kind = overflow ? 'overflow' : underflow ? 'underflow' : 'ok';
  return {ok: kind === 'ok', kind, touched};
}
