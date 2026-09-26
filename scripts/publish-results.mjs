#!/usr/bin/env node
/**
 * publish-results.mjs
 * Copies a RuleProof results JSON file to dashboard/data/results.json.
 * Also copies results/suite.json to dashboard/data/suite.json if it exists.
 * Also merges out/real-ky/candidates.json + out/real-ky/verification.json
 * into dashboard/data/real-ky.json if the candidates file exists.
 * Also writes dashboard/data/gallery.json with all three real repos merged.
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

// ── Helper: merge candidates + verification + coverage for one repo ───────────
async function buildRepoData(repoSlug) {
  const candidatesSrc   = resolve(root, `out/real-${repoSlug}/candidates.json`);
  const verificationSrc = resolve(root, `out/real-${repoSlug}/verification.json`);
  const coverageSrc     = resolve(root, `out/real-${repoSlug}/coverage.json`);
  const reviewsSrc      = resolve(root, `samples/real-${repoSlug}.history/reviews.json`);

  await access(candidatesSrc); // throws if missing

  const candidates = JSON.parse(await readFile(candidatesSrc, 'utf8'));

  // Load verification results if available; keyed by rule id
  let verificationMap = {};
  try {
    const verResults = JSON.parse(await readFile(verificationSrc, 'utf8'));
    for (const r of verResults) verificationMap[r.id] = r;
  } catch {
    // verification.json absent — proceed without it
  }

  // Load coverage data if available; keyed by rule id
  let coverageMap = {};
  let initChars = null;
  try {
    const covData = JSON.parse(await readFile(coverageSrc, 'utf8'));
    initChars = covData.initChars ?? null;
    for (const r of covData.rules ?? []) coverageMap[r.id] = r;
  } catch {
    // coverage.json absent — proceed without it
  }

  // Count PRs and comments from reviews.json
  let comments = 0;
  let prs = 0;
  try {
    const reviews = JSON.parse(await readFile(reviewsSrc, 'utf8'));
    comments = reviews.length;
    prs = new Set(reviews.map(r => r.pr)).size;
  } catch {
    // reviews.json absent — proceed without it
  }

  // Merge: attach per-evidence verified flag and coverage fields
  const mergedCandidates = candidates.map(c => {
    const ver = verificationMap[c.id];
    const cov = coverageMap[c.id];
    const evidence = (c.evidence || []).map((ev, i) => {
      const verEv = ver?.evidence?.[i];
      return { ...ev, verified: verEv?.verified ?? null };
    });
    return {
      ...c,
      evidence,
      verifiedCount: ver?.verified ?? null,
      totalCount:    ver?.total    ?? evidence.length,
      coverage:      cov?.coverage  ?? null,
      initQuote:     cov?.initQuote ?? null,
      initFile:      cov?.initFile  ?? null,
    };
  });

  return { comments, prs, mergedCandidates, initChars };
}

// ── Repo metadata ────────────────────────────────────────────────────────────
const REPOS = [
  { slug: 'ky',      repo: 'sindresorhus/ky',      url: 'https://github.com/sindresorhus/ky',      license: 'MIT' },
  { slug: 'express', repo: 'expressjs/express',     url: 'https://github.com/expressjs/express',    license: 'MIT' },
  { slug: 'fastify', repo: 'fastify/fastify',        url: 'https://github.com/fastify/fastify',      license: 'MIT' },
];

// ── Build real-ky.json (backwards compatibility) ──────────────────────────────
const realKyDest = resolve(root, 'dashboard/data/real-ky.json');
try {
  const { mergedCandidates } = await buildRepoData('ky');
  await writeFile(realKyDest, JSON.stringify(mergedCandidates, null, 2));
  console.log(`Published: real-ky merged → ${realKyDest}`);
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
  // out/real-ky/candidates.json doesn't exist — skip silently
}

// ── Build gallery.json ───────────────────────────────────────────────────────
const galleryDest = resolve(root, 'dashboard/data/gallery.json');
try {
  const gallery = [];
  for (const { slug, repo, url, license } of REPOS) {
    try {
      const { comments, prs, mergedCandidates, initChars } = await buildRepoData(slug);
      gallery.push({
        repo,
        url,
        license,
        comments,
        prs,
        initChars,
        candidates: mergedCandidates,
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.warn(`Skipping ${slug}: candidates.json not found`);
      } else {
        throw err;
      }
    }
  }
  await writeFile(galleryDest, JSON.stringify(gallery, null, 2));
  console.log(`Published: gallery (${gallery.length} repos) → ${galleryDest}`);
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}
