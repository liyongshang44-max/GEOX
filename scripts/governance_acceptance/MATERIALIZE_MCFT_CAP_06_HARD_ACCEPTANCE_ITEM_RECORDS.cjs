#!/usr/bin/env node
'use strict';

const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output/mcft-cap-06-ledger-repair');
const SOURCE = path.join(OUTPUT_DIR, 'GEOX-MCFT-CAP-06-HARD-ACCEPTANCE-EVIDENCE-LEDGER.generated.json');
const MODE = String(process.env.MCFT_CAP_06_LEDGER_MODE || 'REPAIR_CANDIDATE').trim();
const LETTERS = 'ABCDEFGHIJ'.split('');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function main() {
  const generated = cp.spawnSync(
    process.execPath,
    ['scripts/governance_acceptance/GENERATE_MCFT_CAP_06_HARD_ACCEPTANCE_ITEM_LEDGER.cjs'],
    {
      cwd: ROOT,
      env: { ...process.env, MCFT_CAP_06_LEDGER_MODE: MODE },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  if (generated.status !== 0) {
    process.stderr.write(generated.stdout || '');
    process.stderr.write(generated.stderr || '');
    throw new Error(`ITEM_LEDGER_GENERATOR_FAILED:${generated.status}`);
  }

  const source = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  const categoryRecords = [];
  const categoryDigests = {};
  const accumulated = { PASS: 0, FAIL: 0, NOT_APPLICABLE: 0 };

  for (const letter of LETTERS) {
    const prefix = `MCFT_CAP_06_HARD_${letter}_`;
    const items = source.items.filter((item) => item.acceptance_id.startsWith(prefix));
    if (items.length === 0) throw new Error(`CATEGORY_ITEMS_MISSING:${letter}`);
    const statusCounts = { PASS: 0, FAIL: 0, NOT_APPLICABLE: 0 };
    for (const item of items) {
      statusCounts[item.status] += 1;
      accumulated[item.status] += 1;
    }
    const record = {
      schema_version: 'geox_mcft_cap_06_hard_acceptance_item_category_v2',
      capability_line_id: 'MCFT-CAP-06',
      acceptance_category_id: `MCFT_CAP_06_HARD_CATEGORY_${letter}`,
      category: items[0].category,
      lifecycle_stage: source.lifecycle_stage,
      status: statusCounts.FAIL === 0 ? 'PASS' : 'FAIL',
      item_shape_inheritance: 'FORBIDDEN',
      each_item_self_contained: true,
      item_count: items.length,
      status_counts: statusCounts,
      items,
    };
    const serialized = `${JSON.stringify(record, null, 2)}\n`;
    const generatedName = `MCFT-CAP-06-HARD-${letter}.generated.json`;
    fs.writeFileSync(path.join(OUTPUT_DIR, generatedName), serialized, 'utf8');
    const committedPath = `docs/digital_twin/mcft/cap_06/hard_acceptance/MCFT-CAP-06-HARD-${letter}.json`;
    categoryRecords.push(committedPath);
    categoryDigests[committedPath] = `sha256:${sha256(serialized)}`;
  }

  if (JSON.stringify(accumulated) !== JSON.stringify(source.status_counts)) {
    throw new Error(`CATEGORY_STATUS_ACCUMULATION_MISMATCH:${JSON.stringify(accumulated)}`);
  }

  const manifest = {
    ...source,
    items: undefined,
    count_authority: 'THIS_MANIFEST_PLUS_REFERENCED_SELF_CONTAINED_ITEM_CATEGORY_RECORDS',
    category_records: categoryRecords,
    category_record_digests: categoryDigests,
  };
  delete manifest.items;
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'GEOX-MCFT-CAP-06-HARD-ACCEPTANCE-EVIDENCE-LEDGER.manifest.generated.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  fs.rmSync(SOURCE, { force: true });

  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    mode: MODE,
    category_record_count: categoryRecords.length,
    total_check_count: source.total_check_count,
    status_counts: source.status_counts,
  }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
}
