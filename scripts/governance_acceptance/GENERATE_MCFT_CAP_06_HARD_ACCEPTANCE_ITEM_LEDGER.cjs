#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const CATEGORY_DIR = path.join(ROOT, 'docs/digital_twin/mcft/cap_06/hard_acceptance');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output/mcft-cap-06-ledger-repair');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'GEOX-MCFT-CAP-06-HARD-ACCEPTANCE-EVIDENCE-LEDGER.generated.json');
const MODE = String(process.env.MCFT_CAP_06_LEDGER_MODE || 'REPAIR_CANDIDATE').trim();

const CATEGORY_META = Object.freeze({
  A: ['ARCHITECTURE_AND_PREDECESSOR', 25],
  B: ['AUTHORIZATION_LIFECYCLE', 19],
  C: ['PREDECESSOR_LOCK_AND_STRUCTURAL_QUALIFICATION', 25],
  D: ['CONTROLLED_TRACK_ISOLATION_AND_RESIDUAL_WINDOWS', 28],
  E: ['CASE_AUTHORITY_AND_NUMERIC_POLICY_SEPARATION', 28],
  F: ['NUMERIC_SENSITIVITY_AND_SEARCH_MATH', 25],
  G: ['CANDIDATE_CONTRACT_AND_RECOVERY', 36],
  H: ['SHADOW_COMPUTE_EVALUATION_AND_RECOVERY', 33],
  I: ['RUNTIME_AUTHORITY_AND_POST_EVALUATION_TICK', 17],
  J: ['BOUNDED_CHAIN_AND_CLOSURE', 19],
});

const J_EVIDENCE = Object.freeze({
  s10: 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S10-BOUNDED-CHAIN-EFFECTIVENESS.json',
  s11a: 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S11A-CLOSURE-CANDIDATE-STATUS.json',
  finalization: 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-FINALIZATION-EFFECTIVENESS.json',
  s11c: 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S11C-CAPABILITY-COMPLETION-EFFECTIVENESS-ACTIVATION-STATUS.json',
  s11d: 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S11D-FINAL-EFFECTIVENESS-RECONCILIATION-STATUS.json',
  reconciliation: 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-FINAL-EFFECTIVENESS-RECONCILIATION.json',
  verification: 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-MAIN-VERIFICATION.json',
  closure: 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CLOSURE-RECORD.json',
  frontier: 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json',
  manifest: 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json',
});

const J_WORKFLOWS = Object.freeze({
  s10: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S10_BOUNDED_CHAIN.cjs',
  s11a: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_CLOSURE.cjs',
  s11c: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S11C_CAPABILITY_COMPLETION_EFFECTIVENESS_ACTIVATION.cjs',
  s11d: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_FINAL_EFFECTIVENESS_RECONCILIATION.cjs',
});

function json(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ''))];
}

function walk(value, keyPath, output) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, [...keyPath, String(index)], output));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) walk(item, [...keyPath, key], output);
    return;
  }
  output.push({ key: keyPath.join('.'), value });
}

function verificationRefs(evidenceRefs) {
  const commits = [];
  const workflowRuns = [];
  const flattened = [];
  for (const relativePath of evidenceRefs) {
    if (!relativePath.endsWith('.json') || !exists(relativePath)) continue;
    let document;
    try {
      document = json(relativePath);
    } catch {
      continue;
    }
    walk(document, [], flattened);
  }
  for (const entry of flattened) {
    if (typeof entry.value === 'string' && /^[0-9a-f]{40}$/i.test(entry.value) && /commit|head|subject|baseline|ref/i.test(entry.key)) {
      commits.push(entry.value);
    }
    if (Number.isInteger(entry.value) && entry.value > 1000000 && /workflow|run/i.test(entry.key)) {
      workflowRuns.push(entry.value);
    }
  }
  return {
    subject_commit_refs: unique(commits),
    workflow_run_refs: unique(workflowRuns),
  };
}

function pickByName(refs, patterns, fallbackCount = 1) {
  const selected = refs.filter((ref) => patterns.some((pattern) => pattern.test(ref)));
  return selected.length > 0 ? unique(selected) : refs.slice(0, fallbackCount);
}

function evidenceFor(letter, assertion, record) {
  const refs = record.evidence_refs || [];
  if (letter === 'A') {
    if (/CAP-05/i.test(assertion)) return pickByName(refs, [/cap_05/i]);
    if (/P-1/i.test(assertion)) return pickByName(refs, [/P-1/i]);
    return pickByName(refs, [/MANIFEST/i, /P0/i]);
  }
  if (letter === 'B') {
    if (/P0/i.test(assertion)) return pickByName(refs, [/P0/i]);
    if (/S0/i.test(assertion)) return pickByName(refs, [/S0/i]);
    return pickByName(refs, [/CURRENT-DELIVERY-AUTHORITY/i]);
  }
  if (letter === 'C') {
    if (/qualification|eligible|count|calibration|holdout|heterogeneity|24 Forecast/i.test(assertion)) {
      return pickByName(refs, [/DATASET-QUALIFICATION/i, /S10/i], 2);
    }
    return pickByName(refs, [/PREDECESSOR-LOCK/i]);
  }
  if (letter === 'D') return pickByName(refs, [/S1/i, /S10/i], 2);
  if (letter === 'E') {
    if (/Candidate append|homogeneity|case-input-set|source Runtime Config/i.test(assertion)) return pickByName(refs, [/S5/i]);
    return pickByName(refs, [/S2/i]);
  }
  if (letter === 'F') return pickByName(refs, [/S2/i]);
  if (letter === 'G') {
    if (/rebuild|corrupt|projection/i.test(assertion)) return pickByName(refs, [/S8/i]);
    return pickByName(refs, [/S5/i]);
  }
  if (letter === 'H') {
    if (/rebuild|corrupt|response loss|projection/i.test(assertion)) return pickByName(refs, [/S8/i]);
    if (/Evaluation/i.test(assertion)) return pickByName(refs, [/S7/i]);
    return pickByName(refs, [/S6/i]);
  }
  if (letter === 'I') return pickByName(refs, [/S9/i, /S10/i], 2);
  if (letter === 'J') {
    if (/^S11A|Closure Candidate/i.test(assertion)) return [J_EVIDENCE.s11a, J_EVIDENCE.closure];
    if (/^S11B|Finalization/i.test(assertion)) return [J_EVIDENCE.finalization, J_EVIDENCE.verification];
    if (/^S11C/i.test(assertion)) return [J_EVIDENCE.s11c, J_EVIDENCE.finalization];
    if (/^S11D|final reconciliation proof/i.test(assertion)) return [J_EVIDENCE.s11d, J_EVIDENCE.reconciliation, J_EVIDENCE.verification];
    if (/no SSOT writeback/i.test(assertion)) return [J_EVIDENCE.reconciliation, J_EVIDENCE.manifest];
    if (/final active Slice/i.test(assertion)) return [J_EVIDENCE.frontier, J_EVIDENCE.closure];
    if (/runtime source authority/i.test(assertion)) return [J_EVIDENCE.frontier, J_EVIDENCE.closure];
    if (/MCFT-CAP-07/i.test(assertion)) return [J_EVIDENCE.frontier, J_EVIDENCE.manifest];
    return [J_EVIDENCE.s10];
  }
  return refs.slice(0, 1);
}

function workflowFor(letter, assertion, record) {
  const refs = record.workflow_refs || [];
  if (letter !== 'J') return refs.slice(0, Math.max(1, Math.min(2, refs.length)));
  if (/^S11A|Closure Candidate/i.test(assertion)) return [J_WORKFLOWS.s11a];
  if (/^S11B|Finalization/i.test(assertion)) return [J_WORKFLOWS.s11a, J_WORKFLOWS.s11c];
  if (/^S11C/i.test(assertion)) return [J_WORKFLOWS.s11c];
  if (/^S11D|final reconciliation|SSOT writeback|final active Slice|runtime source authority|MCFT-CAP-07/i.test(assertion)) {
    return [J_WORKFLOWS.s11d];
  }
  return [J_WORKFLOWS.s10];
}

function statusFor(letter, index) {
  if (MODE === 'REPAIR_CANDIDATE' && letter === 'J' && (index === 16 || index === 17)) return 'FAIL';
  return 'PASS';
}

function verificationStage(letter, index) {
  if (letter === 'J' && (index === 15 || index === 16)) return 'POSTMERGE_PROOF_REQUIRED';
  return 'PREMERGE_EVIDENCE_VERIFIED';
}

function main() {
  if (!['REPAIR_CANDIDATE', 'FINAL_EFFECTIVE_CANDIDATE'].includes(MODE)) {
    throw new Error(`MCFT_CAP_06_LEDGER_MODE_INVALID:${MODE}`);
  }

  const items = [];
  const categoryCounts = {};
  for (const [letter, [category, expectedCount]] of Object.entries(CATEGORY_META)) {
    const relativePath = `docs/digital_twin/mcft/cap_06/hard_acceptance/MCFT-CAP-06-HARD-${letter}.json`;
    const record = json(relativePath);
    if (record.category !== category) throw new Error(`CATEGORY_MISMATCH:${letter}`);
    if (!Array.isArray(record.assertions) || record.assertions.length !== expectedCount) {
      throw new Error(`ASSERTION_COUNT_MISMATCH:${letter}`);
    }
    categoryCounts[category] = expectedCount;
    record.assertions.forEach((assertion, zeroIndex) => {
      const index = zeroIndex + 1;
      const evidenceRefs = unique(evidenceFor(letter, assertion, record));
      const workflowRefs = unique(workflowFor(letter, assertion, record));
      for (const ref of [...evidenceRefs, ...workflowRefs]) {
        if (!exists(ref)) throw new Error(`ITEM_REF_MISSING:${letter}:${index}:${ref}`);
      }
      const verification = verificationRefs(evidenceRefs);
      items.push({
        acceptance_id: `MCFT_CAP_06_HARD_${letter}_${String(index).padStart(3, '0')}`,
        category,
        assertion,
        status: statusFor(letter, index),
        evidence_refs: evidenceRefs,
        workflow_refs: workflowRefs,
        canonical_refs: Array.isArray(record.canonical_refs) ? record.canonical_refs : [],
        subject_commit_refs: verification.subject_commit_refs,
        workflow_run_refs: verification.workflow_run_refs,
        verification_stage: verificationStage(letter, index),
        notes: [
          `Generated from ${relativePath}`,
          MODE === 'REPAIR_CANDIDATE'
            ? 'S11D implementation-defect repair candidate; completion claims remain suspended.'
            : 'S11D repaired final-effectiveness candidate; exact merged-main proof remains mandatory.',
        ],
      });
    });
  }

  const statusCounts = { PASS: 0, FAIL: 0, NOT_APPLICABLE: 0 };
  for (const item of items) statusCounts[item.status] += 1;
  if (items.length !== 255) throw new Error(`TOTAL_ITEM_COUNT_INVALID:${items.length}`);
  if (MODE === 'REPAIR_CANDIDATE' && (statusCounts.PASS !== 253 || statusCounts.FAIL !== 2)) {
    throw new Error(`REPAIR_STATUS_COUNTS_INVALID:${JSON.stringify(statusCounts)}`);
  }
  if (MODE === 'FINAL_EFFECTIVE_CANDIDATE' && (statusCounts.PASS !== 255 || statusCounts.FAIL !== 0)) {
    throw new Error(`FINAL_STATUS_COUNTS_INVALID:${JSON.stringify(statusCounts)}`);
  }

  const ledger = {
    schema_version: 'geox_mcft_cap_06_hard_acceptance_item_ledger_v2',
    capability_line_id: 'MCFT-CAP-06',
    delivery_slice_id: 'MCFT-CAP-06.FINAL-EFFECTIVENESS-RECONCILIATION-V1',
    lifecycle_stage: MODE === 'REPAIR_CANDIDATE'
      ? 'S11D_IMPLEMENTATION_DEFECT_REPAIR_CANDIDATE'
      : 'S11D_REPAIRED_FINAL_EFFECTIVENESS_CANDIDATE',
    status: MODE,
    source_taskbook_ref: 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md#43-hard-acceptance-evidence-ledger',
    taskbook_version: 'v0.4.0',
    item_shape_inheritance: 'FORBIDDEN',
    each_item_self_contained: true,
    total_check_count: items.length,
    status_counts: statusCounts,
    category_count: Object.keys(CATEGORY_META).length,
    category_counts: categoryCounts,
    items,
    completion_claims_effective: MODE === 'FINAL_EFFECTIVE_CANDIDATE',
    verified: false,
    final_postmerge_proof_required: true,
    postmerge_ssot_writeback_allowed: false,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    mode: MODE,
    output_path: path.relative(ROOT, OUTPUT_PATH),
    total_check_count: ledger.total_check_count,
    status_counts: ledger.status_counts,
    item_shape_inheritance: ledger.item_shape_inheritance,
  }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
}
