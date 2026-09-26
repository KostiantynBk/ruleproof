#!/usr/bin/env node
/**
 * publish-results.mjs
 * Copies a RuleProof results JSON file to dashboard/data/results.json.
 * Also copies results/suite.json to dashboard/data/suite.json if it exists.
 * Also merges out/real-ky/candidates.json + out/real-ky/verification.json
 * into dashboard/data/real-ky.json if the candidates file exists.
 *
 * Usage:
 *   node scripts/publish-results.mjs [path/to/results.json]
 *
 * Default source: results/results.json
 */

import { copyFile, mkdir, access, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const src  = resolve(root, process.argv[2] ?? 'results/results.json');
const dest = resolve(root, 'dashboard/data/results.json');

await mkdir(dirname(dest), { recursive: true });
await copyFile(src, dest);
console.log(`Published: ${src} → ${dest}`);

// Copy suite.json if it exists
const suiteSrc  = resolve(root, 'results/suite.json');
const suiteDest = resolve(root, 'dashboard/data/suite.json');
try {
  await access(suiteSrc);
  await copyFile(suiteSrc, suiteDest);
  console.log(`Published: ${suiteSrc} → ${suiteDest}`);
} catch {
  // suite.json doesn't exist yet — that's fine
}

// Merge real-ky candidates + verification → dashboard/data/real-ky.json
const realKyCandidatesSrc    = resolve(root, 'out/real-ky/candidates.json');
const realKyVerificationSrc  = resolve(root, 'out/real-ky/verification.json');
const realKyDest             = resolve(root, 'dashboard/data/real-ky.json');
try {
  await access(realKyCandidatesSrc);
  const candidates   = JSON.parse(await readFile(realKyCandidatesSrc, 'utf8'));

  // Load verification results if available; keyed by rule id
  let verificationMap = {};
  try {
    const verResults = JSON.parse(await readFile(realKyVerificationSrc, 'utf8'));
    for (const r of verResults) verificationMap[r.id] = r;
  } catch {
    // verification.json absent — proceed without it
  }

  // Merge: attach per-evidence verified flag and summary counts
  const merged = candidates.map(c => {
    const ver = verificationMap[c.id];
    const evidence = (c.evidence || []).map((ev, i) => {
      const verEv = ver?.evidence?.[i];
      return { ...ev, verified: verEv?.verified ?? null };
    });
    return {
      ...c,
      evidence,
      verifiedCount: ver?.verified ?? null,
      totalCount:    ver?.total    ?? evidence.length,
    };
  });

  await writeFile(realKyDest, JSON.stringify(merged, null, 2));
  console.log(`Published: real-ky merged → ${realKyDest}`);
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
  // out/real-ky/candidates.json doesn't exist — skip silently
}
