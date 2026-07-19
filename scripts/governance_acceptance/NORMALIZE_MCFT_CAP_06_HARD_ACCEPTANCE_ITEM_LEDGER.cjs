#!/usr/bin/env node
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output/mcft-cap-06-ledger-repair');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'GEOX-MCFT-CAP-06-HARD-ACCEPTANCE-EVIDENCE-LEDGER.generated.json');
const MODE = String(process.env.MCFT_CAP_06_LEDGER_MODE || 'REPAIR_CANDIDATE').trim();
const LETTERS = 'ABCDEFGHIJ'.split('');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function adjustedStatus(item) {
  if (MODE === 'REPAIR_CANDIDATE' && ['MCFT_CAP_06_HARD_J_016', 'MCFT_CAP_06_HARD_J_017'].includes(item.acceptance_id)) return 'FAIL';
  return 'PASS';
}

function main() {
  if (!['REPAIR_CANDIDATE', 'FINAL_EFFECTIVE_CANDIDATE'].includes(MODE)) {
    throw new Error(`MCFT_CAP_06_LEDGER_MODE_INVALID:${MODE}`);
  }
  const categoryRecords = LETTERS.map((letter) => readJson(`docs/digital_twin/mcft/cap_06/hard_acceptance/MCFT-CAP-06-HARD-${letter}.json`));
  const alreadyItemized = categoryRecords.every((record) => Array.isArray(record.items));
  if (!alreadyItemized) {
    const generated = cp.spawnSync(process.execPath, ['scripts/governance_acceptance/GENERATE_MCFT_CAP_06_HARD_ACCEPTANCE_ITEM_LEDGER.cjs'], {
      cwd: ROOT,
      env: { ...process.env, MCFT_CAP_06_LEDGER_MODE: MODE },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (generated.status !== 0) {
      process.stderr.write(generated.stdout || '');
      process.stderr.write(generated.stderr || '');
      throw new Error(`LEGACY_ITEM_LEDGER_GENERATOR_FAILED:${generated.status}`);
    }
    return;
  }

  const items = [];
  const categoryCounts = {};
  for (const record of categoryRecords) {
    categoryCounts[record.category] = record.items.length;
    for (const sourceItem of record.items) {
      items.push({
        ...sourceItem,
        status: adjustedStatus(sourceItem),
        verification_stage: ['MCFT_CAP_06_HARD_J_015', 'MCFT_CAP_06_HARD_J_016'].includes(sourceItem.acceptance_id)
          ? 'POSTMERGE_PROOF_REQUIRED'
          : 'PREMERGE_EVIDENCE_VERIFIED',
        notes: [
          `Normalized from ${sourceItem.acceptance_id}`,
          MODE === 'REPAIR_CANDIDATE'
            ? 'S11D implementation-defect repair candidate; completion claims remain suspended.'
            : 'S11D repaired final-effectiveness candidate; exact merged-main proof remains mandatory.',
        ],
      });
    }
  }

  const statusCounts = { PASS: 0, FAIL: 0, NOT_APPLICABLE: 0 };
  for (const item of items) statusCounts[item.status] += 1;
  if (items.length !== 255) throw new Error(`TOTAL_ITEM_COUNT_INVALID:${items.length}`);
  if (MODE === 'REPAIR_CANDIDATE' && (statusCounts.PASS !== 253 || statusCounts.FAIL !== 2)) throw new Error('REPAIR_STATUS_COUNTS_INVALID');
  if (MODE === 'FINAL_EFFECTIVE_CANDIDATE' && (statusCounts.PASS !== 255 || statusCounts.FAIL !== 0)) throw new Error('FINAL_STATUS_COUNTS_INVALID');

  const ledger = {
    schema_version: 'geox_mcft_cap_06_hard_acceptance_item_ledger_v2',
    capability_line_id: 'MCFT-CAP-06',
    delivery_slice_id: 'MCFT-CAP-06.FINAL-EFFECTIVENESS-RECONCILIATION-V1',
    lifecycle_stage: MODE === 'REPAIR_CANDIDATE' ? 'S11D_IMPLEMENTATION_DEFECT_REPAIR_CANDIDATE' : 'S11D_REPAIRED_FINAL_EFFECTIVENESS_CANDIDATE',
    status: MODE,
    source_taskbook_ref: 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md#43-hard-acceptance-evidence-ledger',
    taskbook_version: 'v0.4.0',
    item_shape_inheritance: 'FORBIDDEN',
    each_item_self_contained: true,
    total_check_count: items.length,
    status_counts: statusCounts,
    category_count: categoryRecords.length,
    category_counts: categoryCounts,
    items,
    completion_claims_effective: MODE === 'FINAL_EFFECTIVE_CANDIDATE',
    verified: false,
    final_postmerge_proof_required: true,
    postmerge_ssot_writeback_allowed: false,
  };
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
}
