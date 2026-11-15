// Instruction-level binary diff (patch analysis).
//
// Align two disassemblies of the same function with a longest-common-
// subsequence diff so the security-relevant change stands out as added or
// removed instructions. Jump-target addresses and objdump's "<fn+0x..>"
// annotations are normalized away first, so only real instruction changes
// surface rather than every address that shifted when code was inserted.
export function normalize(text) {
  return text
    .replace(/\s*<[^>]*>/g, '')
    .replace(/\b(j[a-z]+|call|loop[a-z]*)\s+(?:0x)?[0-9a-f]+/, '$1 L')
    .replace(/\s+/g, ' ')
    .trim();
}

export function diffInsns(a, b) {
  const A = a.map(i => ({...i, key: normalize(i.text)}));
  const B = b.map(i => ({...i, key: normalize(i.text)}));
  const n = A.length, m = B.length;
  const dp = Array.from({length: n + 1}, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = A[i].key === B[j].key ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const rows = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i].key === B[j].key) { rows.push({kind: 'same', a: A[i], b: B[j]}); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { rows.push({kind: 'del', a: A[i]}); i++; }
    else { rows.push({kind: 'add', b: B[j]}); j++; }
  }
  while (i < n) rows.push({kind: 'del', a: A[i++]});
  while (j < m) rows.push({kind: 'add', b: B[j++]});
  return rows;
}

export function diffStats(rows) {
  return {added: rows.filter(r => r.kind === 'add').length,
          removed: rows.filter(r => r.kind === 'del').length,
          same: rows.filter(r => r.kind === 'same').length};
}
