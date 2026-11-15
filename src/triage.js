// Crash triage — classifying a fault and rating its exploitability.
//
// When a fuzzer finds a crashing input, the next question is what kind of bug
// it is and whether it can be weaponized. A triage pass reads the faulting
// access — read or write, and at what address — and maps it to a bug class and
// a severity, the way tools like CERT's "!exploitable" do: a controllable write
// is the worst case, an out-of-bounds read leaks memory, a near-null access is
// usually just a denial of service, and a divide fault corrupts nothing.
const NEAR_NULL = 0x1000n;

export function classifyFault(reason) {
  const r = reason || '';
  if (/divide by zero/i.test(r)) {
    return {bugClass: 'Arithmetic exception (divide by zero)', cwe: 'CWE-369', access: null, address: null,
      nearNull: false, verdict: 'not-exploitable',
      rationale: 'A division fault crashes the process but corrupts no memory and yields no control — a denial of service at worst.'};
  }
  const m = r.match(/(read|write)\s+at\s+(0x[0-9a-f]+)/i);
  if (m) {
    const access = m[1].toLowerCase();
    const address = m[2];
    const nearNull = BigInt(address) < NEAR_NULL;
    if (access === 'write') {
      return nearNull
        ? {bugClass: 'Null-pointer write', cwe: 'CWE-476', access, address, nearNull, verdict: 'probably-not',
           rationale: 'A write through a near-null pointer usually just crashes; it is exploitable only where low memory can be mapped.'}
        : {bugClass: 'Out-of-bounds write', cwe: 'CWE-787', access, address, nearNull, verdict: 'exploitable',
           rationale: 'A write to a controllable out-of-bounds address is a memory-corruption primitive — the highest-severity class.'};
    }
    return nearNull
      ? {bugClass: 'Null-pointer read', cwe: 'CWE-476', access, address, nearNull, verdict: 'probably-not',
         rationale: 'A read through a near-null pointer typically just crashes — a denial of service.'}
      : {bugClass: 'Out-of-bounds read', cwe: 'CWE-125', access, address, nearNull, verdict: 'probably',
         rationale: 'An out-of-bounds read can leak memory: an information-disclosure primitive, and often the first half of an exploit chain.'};
  }
  return {bugClass: 'Unclassified fault', cwe: null, access: null, address: null, nearNull: false, verdict: 'unknown',
    rationale: 'The fault reason did not match a known class.'};
}

export const VERDICTS = {
  'exploitable': 'Exploitable',
  'probably': 'Probably exploitable',
  'probably-not': 'Probably not exploitable',
  'not-exploitable': 'Not exploitable',
  'unknown': 'Unknown'
};
