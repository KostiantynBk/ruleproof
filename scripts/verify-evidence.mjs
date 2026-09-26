#!/usr/bin/env node
/**
 * verify-evidence.mjs
 * Verifies that every evidence quote in a candidates.json file can be found
 * in the corresponding source files.
 *
 * Normalisation applied to BOTH the quote and the source before searching:
 *   - typographic quotes/apostrophes (' ' " ") → ASCII (' ")
 *   - all whitespace runs → single space
 *
 * For reviews.json files, searches the "body" fields rather than raw text.
 *
 * Usage:
 *   node scripts/verify-evidence.mjs <candidates.json> <historyDir> [srcDir]
 *
 * Writes <candidates dir>/verification.json.
 * Exits 1 if any quote fails verification.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Normalisation ────────────────────────────────────────────────────────────

function normalise(text) {
  return text
    // Typographic single quotes / apostrophes → ASCII apostrophe
    .replace(/[\u2018\u2019\u201A\u201B\u02BC\u02BB]/g, "'")
    // Typographic double quotes → ASCII double quote
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    // Collapse all whitespace runs (including \r\n, \n, \t) to a single space
    .replace(/\s+/g, ' ')
    .trim();
}

// ── File-walking ─────────────────────────────────────────────────────────────

/**
 * Walk a directory recursively and return all file paths.
 */
function walkFiles(dir) {
  const results = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkFiles(full));
      } else {
        results.push(full);
      }
    }
  } catch {
    // ignore unreadable dirs
  }
  return results;
}

/**
 * Build a normalised corpus from a directory.
 * For reviews.json files, concatenates all "body" field values.
 * For all other files, uses the raw file text.
 * Returns Map<filePath, normalisedText>.
 */
function buildCorpus(dir) {
  const corpus = new Map();
  if (!dir) return corpus;

  for (const filePath of walkFiles(dir)) {
    try {
      const raw = readFileSync(filePath, 'utf8');
      let text;
      if (filePath.endsWith('reviews.json')) {
        // Extract body fields from JSON array
        const entries = JSON.parse(raw);
        text = Array.isArray(entries)
          ? entries.map(e => (e.body ?? '')).join('\n')
          : raw;
      } else {
        text = raw;
      }
      corpus.set(filePath, normalise(text));
    } catch {
      // skip unreadable / invalid files
    }
  }
  return corpus;
}

// ── Core verification ─────────────────────────────────────────────────────────

export function verifyEvidence(candidates, historyDir, srcDir) {
  const corpusHistory = buildCorpus(historyDir);
  const corpusSrc     = buildCorpus(srcDir);

  // Merge into one searchable corpus (normalised text values)
  const allCorpus = new Map([...corpusHistory, ...corpusSrc]);

  const results = [];
  let anyFailed = false;

  for (const candidate of candidates) {
    const ruleResult = { id: candidate.id, rule: candidate.rule, evidence: [] };
    let verified = 0;

    for (const ev of (candidate.evidence || [])) {
      const normQuote = normalise(ev.quote);

      // Search all corpus entries for the normalised quote
      let found = false;
      for (const normText of allCorpus.values()) {
        if (normText.includes(normQuote)) {
          found = true;
          break;
        }
      }

      ruleResult.evidence.push({
        quote:    ev.quote,
        ref:      ev.ref,
        url:      ev.url ?? null,
        verified: found,
        reason:   found ? null : 'quote not found in any source after normalisation',
      });

      if (found) verified++;
      else anyFailed = true;
    }

    ruleResult.verified    = verified;
    ruleResult.total       = (candidate.evidence || []).length;
    results.push(ruleResult);
  }

  return { results, anyFailed };
}

// ── CLI entry point ───────────────────────────────────────────────────────────

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [,, candidatesPath, historyDir, srcDir] = process.argv;

  if (!candidatesPath || !historyDir) {
    console.error('Usage: node scripts/verify-evidence.mjs <candidates.json> <historyDir> [srcDir]');
    process.exit(1);
  }

  const candidates = JSON.parse(readFileSync(resolve(candidatesPath), 'utf8'));
  const { results, anyFailed } = verifyEvidence(
    candidates,
    resolve(historyDir),
    srcDir ? resolve(srcDir) : null,
  );

  // Print summary
  for (const r of results) {
    const status = r.verified === r.total ? '✓' : '✗';
    console.log(`${status} ${r.id}: ${r.verified}/${r.total} verified`);
    for (const ev of r.evidence) {
      if (!ev.verified) {
        console.log(`    FAIL: "${ev.quote.slice(0, 80)}…"`);
      }
    }
  }

  // Write verification.json
  const outPath = join(dirname(resolve(candidatesPath)), 'verification.json');
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${outPath}`);

  process.exit(anyFailed ? 1 : 0);
}
