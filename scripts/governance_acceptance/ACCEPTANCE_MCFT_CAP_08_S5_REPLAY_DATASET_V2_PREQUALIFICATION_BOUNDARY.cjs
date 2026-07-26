#!/usr/bin/env node
// Purpose: validate the non-candidate replay-dataset v2 prequalification implementation boundary.

const fs = require('node:fs');
const crypto = require('node:crypto');
const cp = require('node:child_process');

const DEFAULT_BASE = 'a9ec53b27231ed9710bfa77aebcc7a7ddeac431a';
const base = process.env.MCFT_BASE_SHA || DEFAULT_BASE;
const expected = [
  '.github/workflows/mcft-cap-08-current-frontier-reconciliation.yml',
  '.github/workflows/mcft-cap-08-s5-architecture-deviation-adjudication.yml',
  '.github/workflows/mcft-cap-08-s5-replay-dataset-v2-exact-sha-attestation.yml',
  '.github/workflows/mcft-cap-08-s5-replay-dataset-v2-prequalification.yml',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-ARCHITECTURE-DEVIATION-STATUS-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-REPLAY-DATASET-V2-WORKFLOW-DECLARATION-V1.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S5_REPLAY_DATASET_V2_PREQUALIFICATION_BOUNDARY.cjs',
  'scripts/governance_acceptance/mcft_cap08_s5_replay_dataset_v2_artifact_finalize.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S5_REPLAY_DATASET_V2_PREQUALIFICATION_DB.ts',
  'scripts/runtime_acceptance/mcft_cap08_s5_prequalification_compute_v1.ts',
  'scripts/runtime_acceptance/mcft_cap08_s5_replay_dataset_v2_prequalification_support_v1.ts',
].sort();

const fail = (code) => { throw new Error(code); };
const stable = (v) => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v;
const digest = (value) => {
  const copy = structuredClone(value); delete copy.semantic_digest;
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(stable(copy))).digest('hex')}`;
};
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const changed = cp.execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' })
  .trim().split(/\r?\n/).filter(Boolean).sort();
if (JSON.stringify(changed) !== JSON.stringify(expected)) fail(`CAP08_S5_V2_PQ_BOUNDARY:${JSON.stringify(changed)}`);
if (changed.some((file) => file.startsWith('apps/') || file.startsWith('db/') || file.includes('migration'))) fail('CAP08_S5_V2_PQ_RUNTIME_OR_SCHEMA_SOURCE_FORBIDDEN');
if (changed.some((file) => file.includes('CANDIDATE-DECLARATION'))) fail('CAP08_S5_V2_PQ_CANDIDATE_DECLARATION_FORBIDDEN');
for (const file of [
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md',
  'docs/governance/DELIVERY-CANDIDATE-REGISTRY-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-DELIVERY-STATUS-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-DELIVERY-STATUS-V1.json',
]) if (cp.execFileSync('git', ['diff', '--name-only', `${base}...HEAD`, '--', file], { encoding: 'utf8' }).trim()) fail(`CAP08_S5_V2_PQ_FROZEN_AUTHORITY_CHANGED:${file}`);
const status = json('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-ARCHITECTURE-DEVIATION-STATUS-V1.json');
if (status.semantic_digest !== digest(status)) fail('CAP08_S5_V2_PQ_STATUS_DIGEST');
if (status.record_status !== 'PREQUALIFICATION_IMPLEMENTED_NOT_EFFECTIVE') fail('CAP08_S5_V2_PQ_STATUS');
if (status.replay_dataset_v2_prequalification_implemented !== true || status.replay_dataset_v2_prequalification_effective !== false) fail('CAP08_S5_V2_PQ_IMPLEMENTED_STATE');
if (status.s5_formal_candidate_authorized !== false || status.s6_implementation_authorized !== false) fail('CAP08_S5_V2_PQ_SUCCESSOR_AUTHORITY_FORBIDDEN');
const declaration = json('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-REPLAY-DATASET-V2-WORKFLOW-DECLARATION-V1.json');
if (declaration.semantic_digest !== digest(declaration)) fail('CAP08_S5_V2_PQ_DECLARATION_DIGEST');
if (declaration.record_status !== 'IMPLEMENTATION_WORKFLOWS_PRESENT_NOT_EFFECTIVE') fail('CAP08_S5_V2_PQ_DECLARATION_STATUS');
if (declaration.candidate_transition !== false || declaration.candidate_declaration_forbidden !== true) fail('CAP08_S5_V2_PQ_CANDIDATE_BOUNDARY');
if (declaration.candidate_or_shadow_persistence_authorized !== false || declaration.residual_persistence_authorized_in_fresh_acceptance_database !== true) fail('CAP08_S5_V2_PQ_PERSISTENCE_BOUNDARY');
const source = fs.readFileSync('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S5_REPLAY_DATASET_V2_PREQUALIFICATION_DB.ts','utf8');
for (const token of ['candidate_append_count: 0','shadow_append_count: 0','objectiveIneligibleObservationRefs: ["FVO-10"]','selected_parameter_value']) if (!source.includes(token)) fail(`CAP08_S5_V2_PQ_ACCEPTANCE_TOKEN:${token}`);
console.log(JSON.stringify({ status:'PASS', base, changed_files:changed, candidate_transition:false, s5_candidate_authorized:false, s6_authorized:false }, null, 2));
