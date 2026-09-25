#!/usr/bin/env node
/**
 * publish-results.mjs
 * Copies a RuleProof results JSON file to dashboard/data/results.json.
 * Also copies results/suite.json to dashboard/data/suite.json if it exists.
 *
 * Usage:
 *   node scripts/publish-results.mjs [path/to/results.json]
 *
 * Default source: results/results.json
 */

import { copyFile, mkdir, access } from 'node:fs/promises';
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
