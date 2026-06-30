// scripts/governance_acceptance/P9_01_TWIN_KERNEL_LINE_AUTHORITY_CONTRACT_ACCEPTANCE.cjs
// Purpose: verify P9-01 Twin Kernel line authority contract and forbidden import crossings.
// Boundary: read-only file-system governance verification; no runtime, DB, fact, Field Memory, model, AO-ACT, dispatch, receipt, or frontend surface is changed.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const ACCEPTANCE = 'P9_01_TWIN_KERNEL_LINE_AUTHORITY_CONTRACT_ACCEPTANCE';

const CONTRACT = 'docs/twin_kernel/TWIN_KERNEL_LINE_AUTHORITY_CONTRACT_V0.md';
const TWIN_README = 'docs/twin_kernel/README.md';
const README_MIGRATION = 'README_MIGRATION.md';

const assertions = [];

function abs(file) {
  return path.resolve(ROOT, file);
}

function exists(file) {
  return fs.existsSync(abs(file));
}

function read(file) {
  return fs.readFileSync(abs(file), 'utf8');
}

function assert(name, condition, details = {}) {
  assertions.push({ name, passed: condition === true, details });
  if (condition !== true) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
}

function containsAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

function walkFiles(dir) {
  const root = abs(dir);
  if (!fs.existsSync(root)) {
    return [];
  }

  const result = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const full = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build') {
          continue;
        }
        stack.push(full);
        continue;
      }

      const ext = path.extname(entry.name);
      if (['.ts', '.tsx', '.js', '.cjs', '.mjs'].includes(ext)) {
        result.push(full);
      }
    }
  }

  return result;
}

function scanForbidden(rootDir, patterns) {
  const hits = [];
  const files = walkFiles(rootDir);

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const relative = path.relative(ROOT, file).replace(/\\/g, '/');

    for (const pattern of patterns) {
      if (text.includes(pattern)) {
        hits.push({ file: relative, pattern });
      }
    }
  }

  return hits;
}

function summary() {
  const failed = assertions.filter((item) => !item.passed);
  return {
    assertion_count: assertions.length,
    failed_assertion_count: failed.length,
    failed_assertions: failed.map((item) => item.name),
  };
}

function verifyRequiredFiles() {
  for (const file of [CONTRACT, TWIN_README, README_MIGRATION]) {
    assert('required_file_exists:' + file, exists(file), { file });
  }
}

function verifyContract(contract) {
  assert(
    'contract_declares_two_line_authority',
    containsAll(contract, [
      'line_id = server_persisted_twin_kernel',
      'authority_class = production_persisted_runtime',
      'line_id = offline_real_evidence_replay_kernel',
      'authority_class = offline_validation_replay',
      'P8 artifacts are not persisted Twin Kernel objects.',
      'No silent crossing between the two Twin Kernel lines is allowed.',
    ]),
    {}
  );

  assert(
    'contract_declares_reconciliation_requirements',
    containsAll(contract, [
      'source_data_contract',
      'artifact_mapping',
      'model_version_mapping',
      'case_manifest',
      'persistence_policy',
      'read_only_vs_write_boundary',
      'acceptance_entrypoint',
    ]),
    {}
  );

  assert(
    'contract_declares_p9_01_non_creation_boundary',
    containsAll(contract, [
      'P9-01 does not create a replay registry, replay case manifest, model version manifest, or artifact mapping contract.',
      'no_runtime_code_change',
      'no_server_route_change',
      'no_database_migration',
      'no_replay_algorithm_change',
      'no_model_update',
      'no_ao_act_task',
    ]),
    {}
  );
}

function verifyTwinReadme(twinReadme) {
  assert(
    'twin_readme_links_p9_01_contract',
    containsAll(twinReadme, [
      'P9-01 Twin Kernel Line Authority Contract v0',
      'docs/twin_kernel/TWIN_KERNEL_LINE_AUTHORITY_CONTRACT_V0.md',
      'server_persisted_twin_kernel remains the production persisted runtime line.',
      'offline_real_evidence_replay_kernel remains the offline validation replay line.',
      'P8 artifacts are not persisted Twin Kernel objects.',
    ]),
    {}
  );
}

function verifyReadmeMigration(readmeMigration) {
  assert(
    'readme_migration_contains_p9_00_backfill_anchor',
    containsAll(readmeMigration, [
      'P9-00 Twin Kernel Dual-Line Freeze Backfill Snapshot',
      'server_persisted_twin_kernel = product runtime line',
      'offline_real_evidence_replay_kernel = offline replay / validation line',
      'post_p8_historical_task_doc_apply_bundle_main_merge',
    ]),
    {}
  );
}

function verifyForbiddenImportCrossing() {
  const serverHits = scanForbidden('apps/server/src', [
    'scripts/twin_kernel',
    'scripts\\twin_kernel',
    'P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW',
    'P8_09_PRODUCT_REPLAY_DEMO',
    'P8_08_REAL_CALIBRATION_CANDIDATE_REPORT',
    'P8_07_REAL_BACKTEST_ERROR_REPORT',
    'P8_06_REAL_ACTUAL_OBSERVATION_WINDOW',
    'P8_05_REAL_SOIL_MOISTURE_PREDICTION_RUN',
    'P8_04_REAL_SOIL_MOISTURE_STATE_ESTIMATE',
    'P8_02_REAL_EVIDENCE_WINDOW_EXTRACTOR',
  ]);

  const replayHits = scanForbidden('scripts/twin_kernel', [
    'apps/server/src/routes',
    'apps/server/src/modules',
    'apps/server/src/bootstrap',
    'apps/server/src/app',
    'registerTwinKernelModule',
  ]);

  assert('server_runtime_does_not_import_offline_replay_scripts', serverHits.length === 0, { hits: serverHits });
  assert('offline_replay_does_not_import_server_runtime_modules', replayHits.length === 0, { hits: replayHits });
}

try {
  verifyRequiredFiles();

  const contract = read(CONTRACT);
  const twinReadme = read(TWIN_README);
  const readmeMigration = read(README_MIGRATION);

  verifyContract(contract);
  verifyTwinReadme(twinReadme);
  verifyReadmeMigration(readmeMigration);
  verifyForbiddenImportCrossing();

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    contract_present: true,
    twin_readme_contract_link_present: true,
    readme_migration_p9_00_anchor_present: true,
    server_runtime_imports_offline_replay: false,
    offline_replay_imports_server_runtime: false,
    runtime_surface_changed: false,
    next_step: 'P9-02 Replay Registry v0',
    ...summary(),
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: ACCEPTANCE,
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}
