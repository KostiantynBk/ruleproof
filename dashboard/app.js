/* RuleProof dashboard — app.js */
/* No frameworks, no CDN, no external requests. */

(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────────
  let DATA = null;       // full parsed JSON
  let activeRule = null; // currently open rule object

  // ── Boot ─────────────────────────────────────────────────────────
  fetch('data/results.json')
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(data => {
      DATA = data;
      renderSummary(data);
      renderTable(data.rules);
      wireDownload(data.rules);
    })
    .catch(err => {
      document.getElementById('rules-tbody').innerHTML =
        '<tr><td colspan="5" class="loading">Failed to load data: ' + esc(err.message) + '</td></tr>';
    });

  // Load suite data opportunistically
  fetch('data/suite.json')
    .then(r => { if (!r.ok) throw new Error('no suite'); return r.json(); })
    .then(suite => renderSuite(suite))
    .catch(() => { /* suite.json absent — silently skip */ });

  // ── Summary tiles ────────────────────────────────────────────────
  function renderSummary(data) {
    const rules = data.rules;
    const counts = { KEEP: 0, REDUNDANT: 0, INEFFECTIVE: 0, HARMFUL: 0 };
    let totalRuns = 0;
    let totalCost = 0;

    for (const r of rules) {
      if (counts[r.verdict] !== undefined) counts[r.verdict]++;
      totalRuns += r.runs ? r.runs.length : 0;
      totalCost += r.runs ? r.runs.reduce((s, x) => s + (x.cost || 0), 0) : 0;
    }

    set('val-rules',       rules.length);
    set('val-keep',        counts.KEEP);
    set('val-redundant',   counts.REDUNDANT);
    set('val-ineffective', counts.INEFFECTIVE);
    set('val-harmful',     counts.HARMFUL);
    set('val-runs',        totalRuns);
    set('val-cost',        totalCost.toFixed(4));
  }

  // ── Rules table ──────────────────────────────────────────────────
  function renderTable(rules) {
    const tbody = document.getElementById('rules-tbody');
    if (!rules || rules.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading">No rules found.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    rules.forEach((rule, idx) => {
      const tr = document.createElement('tr');
      tr.dataset.idx = idx;
      tr.innerHTML = rowHTML(rule);
      tr.addEventListener('click', () => openDetail(rule, tr));
      tbody.appendChild(tr);
    });
  }

  function rowHTML(rule) {
    const avgCost = avgRunCost(rule);
    return `
      <td class="col-id">${esc(rule.id)}</td>
      <td class="col-rule"><span class="rule-text">${esc(rule.rule)}</span></td>
      <td class="col-verdict">${badgeHTML(rule.verdict)}</td>
      <td class="col-pass">${passBarHTML(rule)}</td>
      <td class="col-cost"><span class="cost-mono">${avgCost === null ? '—' : avgCost.toFixed(4)}</span></td>
    `;
  }

  function badgeHTML(verdict) {
    return `<span class="badge badge-${esc(verdict)}">${esc(verdict)}</span>`;
  }

  function passBarHTML(rule) {
    const pw = typeof rule.p_without === 'number' ? rule.p_without : null;
    const pp = typeof rule.p_with    === 'number' ? rule.p_with    : null;
    const fmt = v => v === null ? '—' : Math.round(v * 100) + '%';
    const pct = v => v === null ? 0   : Math.min(100, Math.round(v * 100));
    return `
      <div class="pass-bars">
        <div class="pass-row">
          <span class="pass-label">Without</span>
          <div class="bar-track"><div class="bar-fill bar-fill-without" style="width:${pct(pw)}%"></div></div>
          <span class="pass-pct">${fmt(pw)}</span>
        </div>
        <div class="pass-row">
          <span class="pass-label">With</span>
          <div class="bar-track"><div class="bar-fill bar-fill-with" style="width:${pct(pp)}%"></div></div>
          <span class="pass-pct">${fmt(pp)}</span>
        </div>
      </div>`;
  }

  function avgRunCost(rule) {
    if (!rule.runs || rule.runs.length === 0) return null;
    const total = rule.runs.reduce((s, r) => s + (r.cost || 0), 0);
    return total / rule.runs.length;
  }

  // ── Suite head-to-head ───────────────────────────────────────────
  function renderSuite(suite) {
    const conds = ['none', 'init', 'ruleproof'];
    const labels = { none: 'No rules', init: 'Bob /init', ruleproof: 'RuleProof' };
    const tasks  = ['R1', 'R2', 'R3', 'R4', 'R5'];

    // Cards
    const cardsEl = document.getElementById('suite-cards');
    cardsEl.innerHTML = conds.map(c => {
      const agg = suite.aggregates?.[c];
      if (!agg) return '';
      const pass  = Math.round((agg.passRate || 0) * 100) + '%';
      const cost  = (agg.avgCostPerRun || 0).toFixed(4);
      const size  = agg.rulesSize != null ? agg.rulesSize.toLocaleString() + ' chars' : '—';
      return `
        <div class="suite-card suite-card-${esc(c)}">
          <div class="suite-card-label">${esc(labels[c] || c)}</div>
          <div class="suite-card-pass">${esc(pass)}</div>
          <div class="suite-card-meta">Pass rate</div>
          <div class="suite-card-row"><span class="suite-meta-key">Avg cost</span><span class="suite-meta-val">${esc(cost)}</span></div>
          <div class="suite-card-row"><span class="suite-meta-key">Rules size</span><span class="suite-meta-val">${esc(size)}</span></div>
        </div>`;
    }).join('');

    // Per-task grid
    const gridEl = document.getElementById('suite-grid');
    let html = '<table class="suite-table"><thead><tr><th>Task</th>';
    for (const c of conds) html += `<th>${esc(labels[c] || c)}</th>`;
    html += '</tr></thead><tbody>';

    for (const t of tasks) {
      html += `<tr><td class="suite-task-id">${esc(t)}</td>`;
      for (const c of conds) {
        const agg  = suite.aggregates?.[c];
        const rate = agg?.passRatePerTask?.[t];
        const pct  = rate === undefined ? '—' : Math.round(rate * 100) + '%';
        const cls  = rate === undefined ? '' : rate >= 0.67 ? 'suite-cell-good' : rate > 0 ? 'suite-cell-mid' : 'suite-cell-bad';
        html += `<td class="suite-cell ${esc(cls)}">${esc(pct)}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    gridEl.innerHTML = html;

    document.getElementById('suite-section').hidden = false;
  }

  // ── Detail panel ─────────────────────────────────────────────────
  function openDetail(rule, tr) {
    // Deactivate previous active row
    const prev = document.querySelector('tbody tr.active');
    if (prev) prev.classList.remove('active');
    tr.classList.add('active');

    activeRule = rule;
    const panel = document.getElementById('detail-panel');

    set('detail-id',        rule.id);
    set('detail-rule-text', rule.rule);

    renderEvidence(rule.evidence || []);
    renderDiffSelectors(rule);

    panel.hidden = false;
    // Smoothly scroll the detail panel into view
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function renderEvidence(evidence) {
    const ul = document.getElementById('evidence-list');
    if (!evidence.length) {
      ul.innerHTML = '<li class="loading" style="list-style:none;padding:.5rem 0">No evidence recorded.</li>';
      return;
    }
    ul.innerHTML = evidence.map(e => `
      <li class="evidence-item">
        <div class="evidence-quote">"${esc(e.quote)}"</div>
        <div class="evidence-meta">${esc(e.source)} · ${esc(e.ref)}</div>
      </li>`).join('');
  }

  function renderDiffSelectors(rule) {
    const withoutRuns = (rule.runs || []).filter(r => r.cond === 'without');
    const withRuns    = (rule.runs || []).filter(r => r.cond === 'with');

    populateSelect('sel-without', withoutRuns, r => `Run ${r.run} — ${r.pass ? '✅ pass' : '❌ fail'}`);
    populateSelect('sel-with',    withRuns,    r => `Run ${r.run} — ${r.pass ? '✅ pass' : '❌ fail'}`);

    renderDiff(rule);

    document.getElementById('sel-without').onchange = () => renderDiff(rule);
    document.getElementById('sel-with').onchange    = () => renderDiff(rule);
  }

  function populateSelect(id, runs, labelFn) {
    const sel = document.getElementById(id);
    sel.innerHTML = runs.length
      ? runs.map((r, i) => `<option value="${i}">${esc(labelFn(r))}</option>`).join('')
      : '<option value="">— no runs —</option>';
  }

  function renderDiff(rule) {
    const withoutRuns = (rule.runs || []).filter(r => r.cond === 'without');
    const withRuns    = (rule.runs || []).filter(r => r.cond === 'with');

    const wiIdx  = parseInt(document.getElementById('sel-without').value, 10);
    const waIdx  = parseInt(document.getElementById('sel-with').value,    10);

    const wiRun  = withoutRuns[isNaN(wiIdx) ? 0 : wiIdx];
    const waRun  = withRuns   [isNaN(waIdx) ? 0 : waIdx];

    renderOneSide('without', wiRun);
    renderOneSide('with',    waRun);
  }

  function renderOneSide(cond, run) {
    const label = document.getElementById('diff-label-' + cond);
    const pre   = document.getElementById('diff-code-'  + cond);
    const assrt = document.getElementById('assert-'     + cond);

    if (!run) {
      label.textContent = cond === 'without' ? 'Bob without rule' : 'Bob with rule';
      pre.textContent   = '(no run selected)';
      assrt.innerHTML   = '';
      return;
    }

    const icon  = run.pass ? '✅' : '❌';
    const title = cond === 'without'
      ? `Bob without rule ${icon}`
      : `Bob with rule ${icon}`;
    label.textContent = title;

    pre.textContent = addedLines(run.diff || '');

    // Assertions
    if (run.assertions && Object.keys(run.assertions).length) {
      assrt.innerHTML = Object.entries(run.assertions).map(([k, v]) =>
        `<div class="assertion-row ${v ? 'assertion-pass' : 'assertion-fail'}">${v ? '✅' : '❌'} ${esc(k)}</div>`
      ).join('');
    } else {
      assrt.innerHTML = '';
    }
  }

  /** Extract only the added (+) lines from a unified diff string. */
  function addedLines(diffStr) {
    if (!diffStr) return '(no diff)';
    const lines = diffStr.split('\n');
    const added = lines
      .filter(l => l.startsWith('+') && !l.startsWith('+++'))
      .map(l => l.slice(1));    // strip leading '+'
    return added.length ? added.join('\n') : '(no added lines)';
  }

  // ── Close panel ──────────────────────────────────────────────────
  document.getElementById('btn-close').addEventListener('click', () => {
    document.getElementById('detail-panel').hidden = true;
    const prev = document.querySelector('tbody tr.active');
    if (prev) prev.classList.remove('active');
    activeRule = null;
  });

  // ── Download rules ───────────────────────────────────────────────
  function wireDownload(rules) {
    document.getElementById('btn-download').addEventListener('click', () => {
      const kept = rules.filter(r => r.verdict === 'KEEP');
      if (!kept.length) { alert('No KEEP rules to download.'); return; }

      const lines = [
        '# RuleProof — KEEP rules',
        '# Generated by RuleProof dashboard',
        '',
      ];
      for (const r of kept) {
        const ev = r.evidence ? r.evidence.length : 0;
        lines.push(`<!-- ${r.id} | evidence: ${ev} -->`);
        lines.push(`- ${r.rule}`);
        lines.push('');
      }

      const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'ruleproof-rules.md';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const note = document.getElementById('download-note');
      note.hidden = false;
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────
  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function set(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

}());
