// Checks every resolved Maven dependency against the OSV vulnerability database.
// Input: the output file of `mvn dependency:list -DoutputFile=...`.
// Exits 1 if any dependency has a known vulnerability, 2 if the check itself failed.
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node osv-check-maven.mjs <dependency-list-file>');
  process.exit(2);
}

// Lines look like: "   group:artifact:jar:version:scope -- module ..."
const deps = readFileSync(file, 'utf8')
  .split('\n')
  .map((line) => line.trim().split(' ')[0])
  .filter((coord) => coord.split(':').length >= 5)
  .map((coord) => {
    const parts = coord.split(':');
    // group:artifact:type[:classifier]:version:scope
    return { name: `${parts[0]}:${parts[1]}`, version: parts[parts.length - 2], scope: parts[parts.length - 1] };
  });

if (deps.length === 0) {
  console.error('No dependencies found in', file);
  process.exit(2);
}

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
}

try {
  const findings = [];
  // OSV accepts up to 1000 queries per batch
  for (let i = 0; i < deps.length; i += 1000) {
    const batch = deps.slice(i, i + 1000);
    const { results } = await post('https://api.osv.dev/v1/querybatch', {
      queries: batch.map((d) => ({ package: { ecosystem: 'Maven', name: d.name }, version: d.version })),
    });
    results.forEach((r, j) => (r.vulns ?? []).forEach((v) => findings.push({ dep: batch[j], id: v.id })));
  }

  for (const f of findings) {
    const res = await fetch(`https://api.osv.dev/v1/vulns/${f.id}`);
    const vuln = res.ok ? await res.json() : {};
    const severity = vuln.database_specific?.severity ?? 'unknown';
    console.log(`::error::${f.dep.name}@${f.dep.version} (${f.dep.scope}): ${f.id} [${severity}] ${vuln.summary ?? ''}`);
  }

  console.log(`Checked ${deps.length} Maven dependencies, ${findings.length} known vulnerabilities.`);
  process.exit(findings.length > 0 ? 1 : 0);
} catch (err) {
  console.error('OSV check failed:', err.message);
  process.exit(2);
}
