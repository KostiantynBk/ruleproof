#!/usr/bin/env node
/**
 * publish-results.mjs
 * Copies a RuleProof results JSON file to dashboard/data/results.json.
 *
 * Usage:
 *   node scripts/publish-results.mjs [path/to/results.json]
 *
 * Default source: results/results.json
 */

import { copyFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const src = resolve(root, process.argv[2] ?? 'results/results.json');
const dest = resolve(root, 'dashboard/data/results.json');

await mkdir(dirname(dest), { recursive: true });
await copyFile(src, dest);
console.log(`Published: ${src} → ${dest}`);
