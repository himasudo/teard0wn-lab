// Structure recovery.
//
// Given the base-relative memory accesses a function makes through a struct
// pointer — each an offset and a width — reconstruct the struct's layout: the
// widest access at each offset is the field size, the size implies a type, and
// the gaps between fields are the padding the compiler inserted for alignment.
// This is how a reverser turns [rdi+0xc] DWORD into "int at offset 12".
const TYPE = {1: 'int8 / char', 2: 'int16 / short', 4: 'int32', 8: 'int64 / pointer'};

export function recoverStruct(accesses) {
  const byOff = new Map();
  for (const a of accesses) byOff.set(a.off, Math.max(byOff.get(a.off) || 0, a.size));
  const offs = [...byOff.keys()].sort((x, y) => x - y);
  const fields = [];
  let cursor = 0;
  for (const o of offs) {
    const size = byOff.get(o);
    if (o > cursor) fields.push({pad: true, off: cursor, size: o - cursor});
    fields.push({off: o, size, type: TYPE[size] || `${size} bytes`});
    cursor = o + size;
  }
  const align = Math.max(1, ...offs.map(o => byOff.get(o)));
  const size = Math.ceil(cursor / align) * align;
  if (size > cursor) fields.push({pad: true, off: cursor, size: size - cursor});
  return {fields, size, align};
}
