#!/usr/bin/env node
// fetch-reviews.mjs — fetch public PR review comments from GitHub REST API
// Usage: node scripts/fetch-reviews.mjs <owner/repo> <outDir> [maxComments=300]
// Node 24+, built-in fetch, no dependencies, no auth token required.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [, , repoArg, outDir, maxArg] = process.argv;

if (!repoArg || !outDir) {
  console.error("Usage: node scripts/fetch-reviews.mjs <owner/repo> <outDir> [maxComments=300]");
  process.exit(1);
}

const MAX_COMMENTS = maxArg ? parseInt(maxArg, 10) : 300;

// ---------- chatter filters ----------

const CHATTER_RE = /^\s*(thanks[!.]?|thank you[!.]?|done[!.]?|fixed[!.]?|resolved[!.]?|will do[!.]?|good point[!.]?|lgtm[!.]?|👍|✅|)\s*$/i;

function isChatter(body) {
  if (body.length < 25) return true;
  if (CHATTER_RE.test(body.trim())) return true;
  // pure suggestion block with no other text
  const stripped = body.replace(/```suggestion[\s\S]*?```/g, "").trim();
  if (stripped.length === 0) return true;
  return false;
}

// ---------- anonymizer ----------

const loginMap = new Map();
let reviewerCount = 0;

function anonymize(login) {
  if (!loginMap.has(login)) {
    reviewerCount += 1;
    loginMap.set(login, `reviewer_${reviewerCount}`);
  }
  return loginMap.get(login);
}

// Links to organisations/projects are kept; links to anyone else's GitHub account are redacted.
const KEEP_OWNERS = new Set([repoArg.split("/")[0].toLowerCase(), "nodejs", "tc39", "whatwg", "pillarjs", "jshttp", "expressjs", "fastify", "sindresorhus", "orgs", "user-attachments", "features", "advisories"]);

function stripMentions(text) {
  return text
    .replace(/@[A-Za-z0-9_-]+/g, "@user")
    .replace(/github\.com\/([A-Za-z0-9-]+)(\/[^\s)\]]*)?/g, (m, owner) =>
      KEEP_OWNERS.has(owner.toLowerCase()) ? m : "github.com/[redacted]");
}

// ---------- fetch loop ----------

async function fetchAllComments(repo) {
  const comments = [];
  let page = 1;

  while (comments.length < MAX_COMMENTS) {
    const url = `https://api.github.com/repos/${repo}/pulls/comments?per_page=100&sort=created&direction=desc&page=${page}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "fetch-reviews-script",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
    }

    const batch = await res.json();
    if (batch.length === 0) break;

    comments.push(...batch);
    if (batch.length < 100) break; // last page
    page += 1;
  }

  return comments.slice(0, MAX_COMMENTS);
}

// ---------- transform ----------

function transform(raw) {
  const prNumber = raw.pull_request_url
    ? parseInt(raw.pull_request_url.split("/").pop(), 10)
    : null;

  const date = raw.created_at ? raw.created_at.slice(0, 10) : null;

  const reviewer = anonymize(raw.user?.login ?? "unknown");

  const body = stripMentions(raw.body ?? "");

  return {
    pr: prNumber,
    file: raw.path ?? null,
    line: raw.line ?? raw.original_line ?? null,
    date,
    reviewer,
    body,
    url: raw.html_url ?? null,
  };
}

// ---------- main ----------

(async () => {
  console.log(`Fetching up to ${MAX_COMMENTS} PR review comments from ${repoArg} …`);

  const rawComments = await fetchAllComments(repoArg);
  console.log(`  fetched: ${rawComments.length}`);

  const kept = rawComments
    .filter((c) => !isChatter(c.body ?? ""))
    .map(transform);

  const prs = new Set(kept.map((c) => c.pr)).size;
  const reviewers = loginMap.size;

  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "reviews.json"), JSON.stringify(kept, null, 2), "utf8");

  console.log(`  kept:      ${kept.length}`);
  console.log(`  PRs:       ${prs}`);
  console.log(`  reviewers: ${reviewers} (anonymized)`);
  console.log(`Written → ${join(outDir, "reviews.json")}`);
})();
