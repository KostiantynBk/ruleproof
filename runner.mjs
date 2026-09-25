#!/usr/bin/env node
/**
 * ruleproof/runner.mjs – A/B engine for rule validation
 *
 * Per-rule mode:
 *   node runner.mjs --rules R1,R2 --repeats 3 --max-cost 0.3 [--fake] [--out results/results.json]
 *
 * Suite mode:
 *   node runner.mjs --suite --repeats 3 --max-cost 0.3 [--fake]
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ──────────────────────────────────────────────────────────────────────────────
// Resolve paths
// ──────────────────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
// runner.mjs lives inside ruleproof/ which IS the workspace root
const REPO_ROOT  = __dirname;

const BOB_JS = process.env.BOB_JS ||
  path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'bobshell', 'dist', 'bob.js');

// ──────────────────────────────────────────────────────────────────────────────
// CLI parsing
// ──────────────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    rules:   [],
    repeats: 3,
    maxCost: 0.3,
    fake:    false,
    suite:   false,
    out:     path.join(REPO_ROOT, 'results', 'results.json'),
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--rules':    opts.rules   = args[++i].split(',').map(s => s.trim()); break;
      case '--repeats':  opts.repeats = parseInt(args[++i], 10);                 break;
      case '--max-cost': opts.maxCost = parseFloat(args[++i]);                   break;
      case '--fake':     opts.fake    = true;                                    break;
      case '--suite':    opts.suite   = true;                                    break;
      case '--out':      opts.out     = args[++i];                               break;
      default: console.error(`Unknown argument: ${args[i]}`); process.exit(1);
    }
  }

  if (!opts.suite && opts.rules.length === 0) {
    console.error('Error: --rules is required (or use --suite)');
    process.exit(1);
  }
  return opts;
}

// ──────────────────────────────────────────────────────────────────────────────
// Evidence verification
// ──────────────────────────────────────────────────────────────────────────────
function loadText(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); }
  catch { return null; }
}

function verifyEvidence(rule) {
  const unverifiable = [];

  for (const ev of rule.evidence) {
    // ev.source is relative to REPO_ROOT
    const sourceFile = path.join(REPO_ROOT, ev.source);
    const text = loadText(sourceFile);
    if (text === null) {
      unverifiable.push({ quote: ev.quote, reason: `file not found: ${ev.source}` });
      continue;
    }
    if (!text.includes(ev.quote)) {
      unverifiable.push({ quote: ev.quote, reason: `quote not found in ${ev.source}` });
    }
  }

  return unverifiable;
}

// ──────────────────────────────────────────────────────────────────────────────
// File-system helpers
// ──────────────────────────────────────────────────────────────────────────────
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function unifiedDiff(oldText, newText, filename = 'src/orders.js') {
  if (oldText === newText) return '';

  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const n = oldLines.length;
  const m = newLines.length;

  // Build LCS table
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack
  const chunks = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      chunks.unshift({ type: ' ', line: oldLines[i - 1], ol: i, nl: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      chunks.unshift({ type: '+', line: newLines[j - 1], ol: i, nl: j });
      j--;
    } else {
      chunks.unshift({ type: '-', line: oldLines[i - 1], ol: i, nl: j });
      i--;
    }
  }

  const CONTEXT = 3;
  const changeIdxs = chunks.reduce((acc, c, idx) => {
    if (c.type !== ' ') acc.push(idx);
    return acc;
  }, []);

  if (changeIdxs.length === 0) return '';

  // Merge context windows into hunks
  const hunks = [];
  let hunkStart = Math.max(0, changeIdxs[0] - CONTEXT);
  let hunkEnd   = Math.min(chunks.length - 1, changeIdxs[0] + CONTEXT);

  for (let k = 1; k < changeIdxs.length; k++) {
    const nextStart = Math.max(0, changeIdxs[k] - CONTEXT);
    const nextEnd   = Math.min(chunks.length - 1, changeIdxs[k] + CONTEXT);
    if (nextStart <= hunkEnd + 1) {
      hunkEnd = nextEnd;
    } else {
      hunks.push([hunkStart, hunkEnd]);
      hunkStart = nextStart;
      hunkEnd   = nextEnd;
    }
  }
  hunks.push([hunkStart, hunkEnd]);

  let result = `--- a/${filename}\n+++ b/${filename}\n`;

  for (const [hs, he] of hunks) {
    const hunkChunks = chunks.slice(hs, he + 1);
    const firstOld = hunkChunks.find(c => c.type !== '+');
    const firstNew = hunkChunks.find(c => c.type !== '-');
    const oldStart = firstOld ? firstOld.ol : 1;
    const newStart = firstNew ? firstNew.nl : 1;
    const oldCount = hunkChunks.filter(c => c.type !== '+').length;
    const newCount = hunkChunks.filter(c => c.type !== '-').length;

    result += `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@\n`;
    for (const c of hunkChunks) {
      result += `${c.type}${c.line}\n`;
    }
  }

  return result;
}

// ──────────────────────────────────────────────────────────────────────────────
// Run Bob (or fake)
// ──────────────────────────────────────────────────────────────────────────────
function runBobFake(_copyDir) {
  // Fake: leave the copy unchanged so every check fails
  return Promise.resolve({
    status:    'fake',
    cost:      0,
    toolCalls: 0,
    bobTaskId: null,
  });
}

function runBob(copyDir, prompt, maxCost) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(BOB_JS)) {
      return reject(new Error(`BOB_JS not found: ${BOB_JS}`));
    }

    const args = [
      BOB_JS, 'run',
      '--workspace', copyDir,
      '--mode',      'agent',
      '--format',    'json',
      '--max-cost',  String(maxCost),
      '--max-turns', '15',
      '--trust',
      '--disable-mcp',
      '--disable-subagents',
      '--disable-tool-groups', 'execute,mcp,subagent',
    ];

    const child = spawn(process.execPath, args, {
      cwd:   copyDir,
      shell: false,
      env:   { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    // Send task prompt then close stdin so Bob doesn't hang
    child.stdin.end(prompt, 'utf8');

    const TIMEOUT_MS = 300_000;
    const timer = setTimeout(() => {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { shell: true });
      } else {
        try { process.kill(-child.pid, 'SIGKILL'); } catch {}
      }
      reject(new Error('Bob timed out after 300s'));
    }, TIMEOUT_MS);

    child.on('close', code => {
      clearTimeout(timer);
      const stderrSnippet = stderr.slice(0, 800) || undefined;
      try {
        const parsed = JSON.parse(stdout.trim());
        const status = parsed.status ?? (code === 0 ? 'ok' : 'error');
        const result = {
          status,
          cost:      parsed.stats?.session_costs ?? 0,
          toolCalls: parsed.stats?.tool_calls    ?? 0,
          bobTaskId: parsed.stats?.task_id       ?? null,
        };
        // Include stderr when status is not 'success'
        if (status !== 'success' && stderrSnippet) result.stderr = stderrSnippet;
        resolve(result);
      } catch {
        resolve({
          status:    code === 0 ? 'ok' : 'error',
          cost:      0,
          toolCalls: 0,
          bobTaskId: null,
          stderr:    stderrSnippet,
        });
      }
    });

    child.on('error', err => { clearTimeout(timer); reject(err); });
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Run check script
// ──────────────────────────────────────────────────────────────────────────────
function runCheck(ruleId, copyDir) {
  return new Promise((resolve) => {
    const checkScript = path.join(REPO_ROOT, 'checks', `${ruleId}.cjs`);
    if (!fs.existsSync(checkScript)) {
      return resolve({ pass: false, assertions: {}, error: `check script not found: ${checkScript}` });
    }

    const child = spawn(process.execPath, [checkScript, copyDir], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', () => {});

    child.on('close', () => {
      try {
        const lines = stdout.trim().split('\n');
        const jsonLine = [...lines].reverse().find(l => l.trim().startsWith('{'));
        if (!jsonLine) {
          resolve({ pass: false, assertions: {}, error: `No JSON output. stdout: ${stdout.slice(0, 200)}` });
          return;
        }
        const r = JSON.parse(jsonLine);
        resolve({ pass: !!r.pass, assertions: r.assertions ?? {}, error: r.error ?? null });
      } catch (e) {
        resolve({ pass: false, assertions: {}, error: `Check parse error: ${e.message}` });
      }
    });

    child.on('error', e => resolve({ pass: false, assertions: {}, error: e.message }));
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Verdict calculation
// ──────────────────────────────────────────────────────────────────────────────
function calcVerdict(p_without, p_with) {
  if (p_without >= 2 / 3)                             return 'REDUNDANT';
  if (p_with - p_without >= 0.5 && p_with >= 2 / 3)  return 'KEEP';
  if (p_with < p_without)                             return 'HARMFUL';
  return 'INEFFECTIVE';
}

// ──────────────────────────────────────────────────────────────────────────────
// Summary markdown
// ──────────────────────────────────────────────────────────────────────────────
function buildSummary(report) {
  const lines = [
    `# Ruleproof Results`,
    ``,
    `Generated: ${report.generatedAt}  `,
    `Bob version: ${report.bobVersion}  `,
    `Max cost: ${report.maxCost} coins  `,
    `Repeats: ${report.repeats}  `,
    `Total cost: ${report.totalCost.toFixed(4)} coins  `,
    ``,
    `| Rule | Layer | p_without | p_with | Verdict |`,
    `|------|-------|----------:|-------:|---------|`,
  ];

  for (const r of report.rules) {
    const pw = (r.p_without * 100).toFixed(0) + '%';
    const pt = (r.p_with    * 100).toFixed(0) + '%';
    lines.push(`| ${r.id} | ${r.layer} | ${pw} | ${pt} | **${r.verdict}** |`);
  }

  lines.push('');
  lines.push('## Details');
  lines.push('');

  for (const r of report.rules) {
    lines.push(`### ${r.id}`);
    lines.push('');
    lines.push(`> ${r.rule}`);
    lines.push('');
    lines.push(`Verdict: **${r.verdict}**  p_without=${(r.p_without*100).toFixed(0)}%  p_with=${(r.p_with*100).toFixed(0)}%`);
    lines.push('');

    if (r.runs?.length > 0) {
      lines.push('| cond | run | pass | cost | error |');
      lines.push('|------|-----|------|------|-------|');
      for (const run of r.runs) {
        lines.push(`| ${run.cond} | ${run.run} | ${run.pass ? '✅' : '❌'} | ${(run.cost||0).toFixed(4)} coins | ${run.error || ''} |`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ──────────────────────────────────────────────────────────────────────────────
// Suite mode helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Build the ruleproof.md content from results/results.json (KEEP rules only). */
function buildRuleproofMd() {
  const resultsPath = path.join(REPO_ROOT, 'results', 'results.json');
  if (!fs.existsSync(resultsPath)) return '';
  try {
    const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    const kept = (data.rules || []).filter(r => r.verdict === 'KEEP');
    return kept.map(r => `- ${r.rule}`).join('\n') + (kept.length ? '\n' : '');
  } catch { return ''; }
}

/** Measure the rules text size given to Bob for each condition. */
function rulesSize(cond, ruleproofMd) {
  if (cond === 'none') return 0;
  if (cond === 'ruleproof') return Buffer.byteLength(ruleproofMd, 'utf8');

  // 'init': sum of all AGENTS.md / .bob files in baseline-init
  const initDir = path.join(REPO_ROOT, 'baseline-init');
  let total = 0;
  function walkSize(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkSize(full);
      else total += fs.statSync(full).size;
    }
  }
  if (fs.existsSync(initDir)) walkSize(initDir);
  return total;
}

/** Prepare a temp workspace copy and inject the condition's rules. */
function prepareSuiteCopy(condName, taskId, runIndex, ruleproofMd) {
  const SAMPLE_DIR = path.join(REPO_ROOT, 'samples', 'harbor-orders');
  const tmpName  = `ruleproof_suite_${condName}_${taskId}_${runIndex}`;
  const copyDir  = path.join(os.tmpdir(), tmpName);

  if (fs.existsSync(copyDir)) fs.rmSync(copyDir, { recursive: true, force: true });
  copyDirSync(SAMPLE_DIR, copyDir);

  if (condName === 'init') {
    const initDir = path.join(REPO_ROOT, 'baseline-init');
    // Copy AGENTS.md to workspace root
    const agentsFile = path.join(initDir, 'AGENTS.md');
    if (fs.existsSync(agentsFile)) {
      fs.copyFileSync(agentsFile, path.join(copyDir, 'AGENTS.md'));
    }
    // Copy .bob/ subtree
    const initBobDir = path.join(initDir, '.bob');
    if (fs.existsSync(initBobDir)) {
      copyDirSync(initBobDir, path.join(copyDir, '.bob'));
    }
  } else if (condName === 'ruleproof') {
    const rulesDir = path.join(copyDir, '.bob', 'rules');
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(path.join(rulesDir, 'ruleproof.md'), ruleproofMd, 'utf8');
  }

  return copyDir;
}

/** Build the "Head-to-head" section to append to summary.md. */
function buildSuiteSection(suiteReport) {
  const conds  = ['none', 'init', 'ruleproof'];
  const tasks  = ['R1', 'R2', 'R3', 'R4', 'R5'];
  const lines  = [
    '',
    '## Head-to-head',
    '',
    '| Condition | Pass rate | Avg cost / run | Rules size (chars) |',
    '|-----------|----------:|---------------:|-------------------:|',
  ];

  for (const c of conds) {
    const agg = suiteReport.aggregates[c];
    if (!agg) continue;
    lines.push(
      `| ${c} | ${(agg.passRate * 100).toFixed(0)}% | ` +
      `${agg.avgCostPerRun.toFixed(4)} | ${agg.rulesSize} |`
    );
  }

  lines.push('');
  lines.push('### Per-task pass rate');
  lines.push('');

  // Header
  const header = '| Task | ' + conds.join(' | ') + ' |';
  const sep    = '|------|' + conds.map(() => '------:').join('|') + '|';
  lines.push(header);
  lines.push(sep);

  for (const t of tasks) {
    const cells = conds.map(c => {
      const agg = suiteReport.aggregates[c];
      const rate = agg?.passRatePerTask?.[t];
      return rate === undefined ? '—' : (rate * 100).toFixed(0) + '%';
    });
    lines.push(`| ${t} | ${cells.join(' | ')} |`);
  }

  lines.push('');
  return lines.join('\n');
}

/** Main suite runner. */
async function runSuite(opts) {
  const SAMPLE_DIR     = path.join(REPO_ROOT, 'samples', 'harbor-orders');
  const ORDERS_JS_PATH = path.join(SAMPLE_DIR, 'src', 'orders.js');
  const originalOrdersJs = fs.readFileSync(ORDERS_JS_PATH, 'utf8');

  const ruleproofMd = buildRuleproofMd();
  const tasks = ['R1', 'R2', 'R3', 'R4', 'R5'];
  const conds = ['none', 'init', 'ruleproof'];

  const allRuns = [];
  let totalCost = 0;

  console.log(`\n🔬 Suite mode  tasks=${tasks.join(',')}  conds=${conds.join(',')}  repeats=${opts.repeats}  fake=${opts.fake}`);

  for (const cond of conds) {
    console.log(`\n── Condition: ${cond} ──────────────────────────────────`);

    for (const taskId of tasks) {
      const taskFile = path.join(REPO_ROOT, 'tasks', `${taskId}.txt`);
      if (!fs.existsSync(taskFile)) {
        console.warn(`  [${cond}/${taskId}] task file not found, skipping`);
        continue;
      }
      const prompt = fs.readFileSync(taskFile, 'utf8');

      for (let i = 0; i < opts.repeats; i++) {
        process.stdout.write(`  [${cond} / ${taskId} / run ${i}] copying... `);

        const copyDir = prepareSuiteCopy(cond, taskId, i, ruleproofMd);

        const runStart = Date.now();
        let bobResult;
        let runError = null;

        try {
          bobResult = opts.fake
            ? await runBobFake(copyDir)
            : await runBob(copyDir, prompt, opts.maxCost);
        } catch (e) {
          bobResult = { status: 'error', cost: 0, toolCalls: 0, bobTaskId: null };
          runError  = e.message;
        }

        const seconds = (Date.now() - runStart) / 1000;
        const checkResult = await runCheck(taskId, copyDir);

        const afterPath = path.join(copyDir, 'src', 'orders.js');
        const afterText = fs.existsSync(afterPath) ? fs.readFileSync(afterPath, 'utf8') : '';
        const diff = unifiedDiff(originalOrdersJs, afterText);

        const runRecord = {
          cond,
          task:       taskId,
          run:        i,
          pass:       checkResult.pass,
          assertions: checkResult.assertions,
          error:      runError ?? checkResult.error,
          cost:       bobResult.cost,
          toolCalls:  bobResult.toolCalls,
          bobTaskId:  bobResult.bobTaskId,
          seconds,
          diff,
        };

        allRuns.push(runRecord);
        totalCost += bobResult.cost;

        const mark = checkResult.pass ? '✅' : '❌';
        console.log(`${mark}  cost=${bobResult.cost.toFixed(4)}  ${seconds.toFixed(1)}s${checkResult.error ? `  err: ${checkResult.error}` : ''}`);
      }
    }
  }

  // Aggregate
  const aggregates = {};
  for (const cond of conds) {
    const condRuns = allRuns.filter(r => r.cond === cond);
    const passRate = condRuns.length > 0
      ? condRuns.filter(r => r.pass).length / condRuns.length : 0;
    const totalCondCost = condRuns.reduce((s, r) => s + (r.cost || 0), 0);
    const avgCostPerRun = condRuns.length > 0 ? totalCondCost / condRuns.length : 0;

    const passRatePerTask = {};
    for (const taskId of tasks) {
      const taskRuns = condRuns.filter(r => r.task === taskId);
      passRatePerTask[taskId] = taskRuns.length > 0
        ? taskRuns.filter(r => r.pass).length / taskRuns.length : 0;
    }

    aggregates[cond] = {
      passRate,
      passRatePerTask,
      totalCost: totalCondCost,
      avgCostPerRun,
      rulesSize: rulesSize(cond, ruleproofMd),
    };
  }

  const suiteReport = {
    generatedAt: new Date().toISOString(),
    repeats:     opts.repeats,
    maxCost:     opts.maxCost,
    totalCost,
    aggregates,
    runs:        allRuns,
  };

  // Write suite.json
  const suiteOut = path.join(REPO_ROOT, 'results', 'suite.json');
  fs.mkdirSync(path.dirname(suiteOut), { recursive: true });
  fs.writeFileSync(suiteOut, JSON.stringify(suiteReport, null, 2), 'utf8');
  console.log(`\n✅ ${suiteOut}`);

  // Append to summary.md
  const summaryPath = path.join(REPO_ROOT, 'results', 'summary.md');
  const suiteSection = buildSuiteSection(suiteReport);
  if (fs.existsSync(summaryPath)) {
    // Remove any existing Head-to-head section before appending
    let existing = fs.readFileSync(summaryPath, 'utf8');
    const hhIdx = existing.indexOf('\n## Head-to-head');
    if (hhIdx !== -1) existing = existing.slice(0, hhIdx);
    fs.writeFileSync(summaryPath, existing + suiteSection, 'utf8');
  } else {
    fs.writeFileSync(summaryPath, suiteSection.trimStart(), 'utf8');
  }
  console.log(`✅ ${summaryPath} (Head-to-head appended)`);

  console.log(`\nDone  totalCost=${totalCost.toFixed(4)}`);
  for (const cond of conds) {
    const agg = aggregates[cond];
    console.log(`  ${cond.padEnd(12)} passRate=${(agg.passRate * 100).toFixed(0)}%  avgCost=${agg.avgCostPerRun.toFixed(4)}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv);

  // Require API key unless --fake
  if (!opts.fake && !process.env.BOB_API_KEY) {
    console.error(
      'Error: BOB_API_KEY environment variable is not set.\n' +
      'Set it before running, or use --fake to test the pipeline without Bob.'
    );
    process.exit(1);
  }

  // ── Suite mode ────────────────────────────────────────────────────
  if (opts.suite) {
    return runSuite(opts);
  }

  // Load candidates
  const candidatesPath = path.join(REPO_ROOT, 'out', 'candidates.json');
  if (!fs.existsSync(candidatesPath)) {
    console.error(`Error: out/candidates.json not found at ${candidatesPath}`);
    process.exit(1);
  }
  const candidates = JSON.parse(fs.readFileSync(candidatesPath, 'utf8'));

  // Filter to requested rules
  const selectedCandidates = candidates.filter(c => opts.rules.includes(c.id));
  const missingRules = opts.rules.filter(r => !candidates.find(c => c.id === r));
  if (missingRules.length > 0) {
    console.warn(`Warning: Rules not found in candidates.json: ${missingRules.join(', ')}`);
  }

  const SAMPLE_DIR     = path.join(REPO_ROOT, 'samples', 'harbor-orders');
  const ORDERS_JS_PATH = path.join(SAMPLE_DIR, 'src', 'orders.js');
  const originalOrdersJs = fs.readFileSync(ORDERS_JS_PATH, 'utf8');

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(opts.out), { recursive: true });

  const startTime  = Date.now();
  const ruleResults = [];
  let totalCost = 0;

  // ── Step 1: Verify evidence ────────────────────────────────────────────────
  const verifiedRules = [];
  for (const rule of selectedCandidates) {
    const bad = verifyEvidence(rule);
    if (bad.length > 0) {
      console.log(`[${rule.id}] REJECTED_EVIDENCE:`);
      for (const b of bad) console.log(`  ✗ ${b.reason}`);
      ruleResults.push({
        id: rule.id, rule: rule.rule, layer: rule.layer, evidence: rule.evidence,
        verdict: 'REJECTED_EVIDENCE', p_without: 0, p_with: 0, runs: [],
      });
    } else {
      console.log(`[${rule.id}] Evidence verified ✓`);
      verifiedRules.push(rule);
    }
  }

  // ── Steps 2–6: A/B runs ────────────────────────────────────────────────────
  for (const rule of verifiedRules) {
    console.log(`\n[${rule.id}] A/B test  repeats=${opts.repeats}  fake=${opts.fake}`);

    const taskFile = path.join(REPO_ROOT, 'tasks', `${rule.id}.txt`);
    const prompt   = fs.existsSync(taskFile)
      ? fs.readFileSync(taskFile, 'utf8')
      : rule.test_task ?? `Implement: ${rule.rule}`;

    const runs = [];

    for (const cond of ['without', 'with']) {
      for (let i = 0; i < opts.repeats; i++) {
        const tmpName = `ruleproof_${rule.id}_${cond}_${i}`;
        const copyDir = path.join(os.tmpdir(), tmpName);

        process.stdout.write(`  [${cond} ${i}] copying... `);

        // Wipe any stale copy
        if (fs.existsSync(copyDir)) fs.rmSync(copyDir, { recursive: true, force: true });
        copyDirSync(SAMPLE_DIR, copyDir);

        // For "with": write .bob/rules/<rule>.md
        if (cond === 'with') {
          const ruleDestDir = path.join(copyDir, '.bob', 'rules');
          fs.mkdirSync(ruleDestDir, { recursive: true });
          fs.writeFileSync(path.join(ruleDestDir, `${rule.id}.md`), rule.rule, 'utf8');
        }

        const runStart = Date.now();
        let bobResult;
        let runError = null;

        try {
          bobResult = opts.fake
            ? await runBobFake(copyDir)
            : await runBob(copyDir, prompt, opts.maxCost);
        } catch (e) {
          bobResult = { status: 'error', cost: 0, toolCalls: 0, bobTaskId: null };
          runError  = e.message;
        }

        const seconds = (Date.now() - runStart) / 1000;
        const checkResult = await runCheck(rule.id, copyDir);

        // Diff orders.js before/after
        const afterPath = path.join(copyDir, 'src', 'orders.js');
        const afterText = fs.existsSync(afterPath) ? fs.readFileSync(afterPath, 'utf8') : '';
        const diff = unifiedDiff(originalOrdersJs, afterText);

        const runRecord = {
          rule:       rule.id,
          cond,
          run:        i,
          pass:       checkResult.pass,
          assertions: checkResult.assertions,
          error:      runError ?? checkResult.error,
          cost:       bobResult.cost,
          toolCalls:  bobResult.toolCalls,
          bobTaskId:  bobResult.bobTaskId,
          seconds,
          diff,
        };

        runs.push(runRecord);
        totalCost += bobResult.cost;

        const mark = checkResult.pass ? '✅' : '❌';
        console.log(`${mark}  cost=${bobResult.cost.toFixed(4)} coins  ${seconds.toFixed(1)}s${checkResult.error ? `  err: ${checkResult.error}` : ''}`);
      }
    }

    const withoutRuns = runs.filter(r => r.cond === 'without');
    const withRuns    = runs.filter(r => r.cond === 'with');
    const p_without   = withoutRuns.length > 0 ? withoutRuns.filter(r => r.pass).length / withoutRuns.length : 0;
    const p_with      = withRuns.length    > 0 ? withRuns.filter(r => r.pass).length    / withRuns.length    : 0;
    const verdict     = calcVerdict(p_without, p_with);

    console.log(`  → p_without=${(p_without*100).toFixed(0)}%  p_with=${(p_with*100).toFixed(0)}%  verdict=${verdict}`);

    ruleResults.push({
      id: rule.id, rule: rule.rule, layer: rule.layer, evidence: rule.evidence,
      verdict, p_without, p_with, runs,
    });
  }

  // ── Step 7: Write output ───────────────────────────────────────────────────
  let bobVersion = 'unknown';
  try {
    const bobPkgPath = path.join(path.dirname(BOB_JS), '..', 'package.json');
    if (fs.existsSync(bobPkgPath)) {
      bobVersion = JSON.parse(fs.readFileSync(bobPkgPath, 'utf8')).version ?? 'unknown';
    }
  } catch {}

  const report = {
    generatedAt: new Date().toISOString(),
    bobVersion,
    maxCost:     opts.maxCost,
    repeats:     opts.repeats,
    totalCost,
    rules:       ruleResults,
  };

  fs.writeFileSync(opts.out, JSON.stringify(report, null, 2), 'utf8');
  const summaryPath = path.join(path.dirname(opts.out), 'summary.md');
  fs.writeFileSync(summaryPath, buildSummary(report), 'utf8');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ ${opts.out}`);
  console.log(`✅ ${summaryPath}`);
  console.log(`Done in ${elapsed}s  totalCost=${totalCost.toFixed(4)} coins`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
