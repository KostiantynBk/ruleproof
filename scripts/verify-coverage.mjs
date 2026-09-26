#!/usr/bin/env node
/**
 * verify-coverage.mjs
 * Verifies that every initQuote in a coverage.json file appears verbatim
 * (after the same normalisation as verify-evidence.mjs) in its initFile.
 *
 * Normalisation applied to BOTH the quote and the file content before searching:
 *   - typographic quotes/apostrophes (' ' " ") → ASCII (' ")
 *   - all whitespace runs → single space
 *
 * Usage (run from workspace root):
 *   node scripts/verify-coverage.mjs
 *
 * Prints per-repo counts (covered / partial / missing) and exits 1 if any
 * initQuote cannot be found verbatim in its initFile.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Normalisation (same as verify-evidence.mjs) ───────────────────────────────

function normalise(text) {
  return text
    .replace(/[\u2018\u2019\u201A\u201B\u02BC\u02BB]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Per-repo coverage files ───────────────────────────────────────────────────

const REPOS = ['ky', 'express', 'fastify'];

let anyFailed = false;

for (const repo of REPOS) {
  const coveragePath = resolve(ROOT, `out/real-${repo}/coverage.json`);
  let coverage;
  try {
    coverage = JSON.parse(readFileSync(coveragePath, 'utf8'));
  } catch (err) {
    console.error(`ERROR: Cannot read ${coveragePath}: ${err.message}`);
    anyFailed = true;
    continue;
  }

  let covered = 0;
  let partial = 0;
  let missing = 0;
  let quoteFailed = 0;

  console.log(`\n=== ${repo.toUpperCase()} (initChars: ${coverage.initChars}) ===`);

  for (const rule of coverage.rules) {
    switch (rule.coverage) {
      case 'covered': covered++; break;
      case 'partial': partial++; break;
      case 'missing': missing++; break;
      default:
        console.error(`  ERROR [${rule.id}]: unknown coverage value "${rule.coverage}"`);
        anyFailed = true;
    }

    if (rule.initQuote !== null) {
      // Must have an initFile
      if (!rule.initFile) {
        console.error(`  FAIL [${rule.id}]: initQuote is set but initFile is null`);
        anyFailed = true;
        quoteFailed++;
        continue;
      }

      // Read the initFile and verify the quote appears in it
      const filePath = resolve(ROOT, rule.initFile);
      let fileContent;
      try {
        fileContent = readFileSync(filePath, 'utf8');
      } catch (err) {
        console.error(`  FAIL [${rule.id}]: Cannot read initFile "${rule.initFile}": ${err.message}`);
        anyFailed = true;
        quoteFailed++;
        continue;
      }

      const normFile = normalise(fileContent);
      const normQuote = normalise(rule.initQuote);

      if (!normFile.includes(normQuote)) {
        console.error(`  FAIL [${rule.id}]: initQuote not found verbatim in "${rule.initFile}"`);
        console.error(`    Quote (normalised): "${normQuote.slice(0, 120)}${normQuote.length > 120 ? '…' : ''}"`);
        anyFailed = true;
        quoteFailed++;
      } else {
        console.log(`  OK   [${rule.id}] (${rule.coverage}): quote verified in ${rule.initFile}`);
      }
    } else {
      // missing rules must have initFile = null
      if (rule.initFile !== null) {
        console.error(`  FAIL [${rule.id}]: initQuote is null but initFile is "${rule.initFile}" (should also be null)`);
        anyFailed = true;
      } else {
        console.log(`  OK   [${rule.id}] (${rule.coverage}): no quote required`);
      }
    }
  }

  console.log(`  → covered: ${covered}  partial: ${partial}  missing: ${missing}${quoteFailed > 0 ? `  quote-failures: ${quoteFailed}` : ''}`);
}

console.log('');
if (anyFailed) {
  console.error('verify-coverage: FAILED — one or more quotes could not be verified.');
  process.exit(1);
} else {
  console.log('verify-coverage: all quotes verified successfully.');
  process.exit(0);
}
