#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const CONTRACT = path.join(ROOT, 'scripts/qualification/contracts/MCFT_CAP09_CAUSAL_REVISION_TEMPORAL_V1.json');
const RUNNER = path.join(ROOT, 'scripts/qualification/RUN_GEOX_QUALIFICATION_V1.cjs');
const CORE = path.join(ROOT, 'scripts/qualification/qualification_core_v1.cjs');
const AUTH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EXECUTION-MIGRATION-PILOT-V1.json');

const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
const authority = JSON.parse(fs.readFileSync(AUTH, 'utf8'));
const runner = fs.readFileSync(RUNNER, 'utf8');
const core = fs.readFileSync(CORE, 'utf8');

assert.equal(contract.contract_id, 'MCFT_CAP09_CAUSAL_REVISION_TEMPORAL_V1');
assert.equal(contract.run_class, 'L2_CONTROLLED_STATEFUL');
assert.equal(contract.frozen_runtime_sha, '3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a');
assert.equal(contract.github_actions_execution, 'FORBIDDEN');
assert.equal(contract.non_effects.runtime_mutation, false);
assert.equal(contract.non_effects.production_mutation, false);
assert.equal(contract.non_effects.formal_v5_arm, false);
assert.equal(contract.non_effects.a0, false);
assert.equal(contract.non_effects.o00_o23, false);
assert.equal(authority.dual_lane.old_github_lane, 'HISTORICAL_FALLBACK_COMPARISON_ONLY');
assert.equal(authority.dual_lane.new_controlled_lane, 'SUCCESSOR_ARCHITECTURE_CANDIDATE');
assert.equal(authority.dual_lane.old_lane_supersession_requires.local_replacement_pass, true);
assert.equal(authority.dual_lane.old_lane_supersession_requires.github_verifier_pass, true);
assert.equal(authority.dual_lane.old_lane_supersession_requires.qcp_integration_pass, true);
assert.match(core, /QUALIFICATION_L2_L3_GITHUB_EXECUTION_FORBIDDEN/);
assert.match(runner, /QUALIFICATION_DIRTY_LAUNCHER_WORKTREE_FORBIDDEN/);
assert.match(runner, /git', \['worktree', 'add', '--detach'/);
assert.match(runner, /QUALIFICATION_PINNED_POSTGRES_IMAGE_REQUIRED/);
assert.match(runner, /production_mutation: false/);
assert.match(runner, /runtime_mutated: false/);
assert.doesNotMatch(runner, /GEOX_PRODUCTION_DATABASE_URL/);
assert.doesNotMatch(runner, /\.\.\.process\.env/);
assert.match(runner, /const safeExact = new Set/);

const base = authority.pilot_source_head;
const changed = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
for (const file of changed) {
  assert.ok(!file.startsWith('.github/workflows/'), `QMIG_PILOT_MUST_NOT_CHANGE_GITHUB_L2_L3_WORKFLOW:${file}`);
  assert.ok(!file.startsWith('apps/server/src/runtime/'), `QMIG_PILOT_MUST_NOT_CHANGE_RUNTIME:${file}`);
}

process.stdout.write(JSON.stringify({
  schema_version: 'geox_qualification_execution_migration_pilot_acceptance_v1',
  status: 'PASS',
  frozen_runtime_preserved: true,
  github_l2_l3_workflow_mutation: false,
  dual_lane_isolation_static_proof: true,
  changed_files: changed,
}, null, 2) + '\n');
