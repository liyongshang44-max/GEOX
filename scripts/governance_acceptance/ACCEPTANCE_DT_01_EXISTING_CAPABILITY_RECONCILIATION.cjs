// scripts/governance_acceptance/ACCEPTANCE_DT_01_EXISTING_CAPABILITY_RECONCILIATION.cjs
// Purpose: validate the committed DT-01 inventory, matrices, reuse decisions, nonclaims, and changed-file boundary.
// Boundary: this gate validates reconciliation evidence only and does not implement or claim Twin runtime capability.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const {
  loadArtifactFile,
  loadInventoryManifest,
  runCorruptTrailerSelfTest,
} = require('./DT01_JSON_ARTIFACT_LOADER.cjs');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = 'bce918d1eea423397bdd329148b7a2e7eb181b6c';

const FILES = {
  method: 'docs/digital_twin/GEOX-DT-01-AUDIT-METHOD.md',
  reconciliation: 'docs/digital_twin/GEOX-DT-01-EXISTING-CAPABILITY-RECONCILIATION.md',
  inventory: 'docs/digital_twin/GEOX-DT-01-CAPABILITY-INVENTORY.json',
  calls: 'docs/digital_twin/GEOX-DT-01-CALL-CHAIN-MATRIX.json',
  persistence: 'docs/digital_twin/GEOX-DT-01-PERSISTENCE-MATRIX.json',
  runtime: 'docs/digital_twin/GEOX-DT-01-RUNTIME-ENTRY-MATRIX.json',
  reuse: 'docs/digital_twin/GEOX-DT-01-REUSE-DECISION-REGISTER.md',
  dt02: 'docs/digital_twin/GEOX-DT-01-DT-02-INPUT-PACKET.md',
  matrix: 'docs/digital_twin/GEOX-DIGITAL-TWIN-CAPABILITY-MATRIX.json',
  master: 'docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE.md',
  auditScript: 'scripts/governance_acceptance/AUDIT_DT_01_REPOSITORY_CAPABILITIES.cjs',
  acceptanceScript: 'scripts/governance_acceptance/ACCEPTANCE_DT_01_EXISTING_CAPABILITY_RECONCILIATION.cjs',
  helperScript: 'scripts/governance_acceptance/DT01_JSON_ARTIFACT_LOADER.cjs',
  dt00RegressionScript: 'scripts/governance_acceptance/ACCEPTANCE_DT_00_MAINLINE_GOVERNANCE_RESET.cjs',
};

const allowedStatus = new Set(['ESTABLISHED','ESTABLISHED_WITH_LIMITATIONS','MISSING','NOT_CLAIMED']);
const allowedDecisions = new Set(['REUSE_AS_IS','REUSE_WITH_ADAPTER','EXTRACT_ALGORITHM','REFERENCE_ONLY','REPLACE','DEPRECATE']);
const allowedEvidence = new Set(['DEFINITION_ONLY','TEST_OR_ACCEPTANCE_ONLY','SCRIPT_RUNNER','DATABASE_READBACK','SERVER_ROUTE','SERVER_WRITE_PATH','SCHEDULED_RUNTIME','LIVE_INGRESS','UNKNOWN']);
const allowedPersistence = new Set(['NONE','IN_MEMORY','FIXTURE','CHECKED_IN_SNAPSHOT','ACCEPTANCE_OUTPUT_FILE','APPEND_ONLY_FACT','DATABASE_CANONICAL_APPEND','DATABASE_INDEX_INSERT','DATABASE_INDEX_UPSERT','EXTERNAL_SYSTEM','UNKNOWN']);

const failures = [];
const passes = [];
function pass(message) { passes.push(message); console.log(`PASS: ${message}`); }
function fail(message) { failures.push(message); console.error(`FAIL: ${message}`); }
function abs(relativePath) { return path.join(ROOT, relativePath); }
function read(relativePath) { return fs.readFileSync(abs(relativePath), 'utf8'); }
function parse(relativePath) { return loadArtifactFile(ROOT, relativePath).value; }
function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }

for (const relativePath of Object.values(FILES)) {
  if (!fs.existsSync(abs(relativePath))) fail(`missing file ${relativePath}`);
  else pass(`file exists ${relativePath}`);
}

if (failures.length) process.exit(1);

let loaderSelfTest;
let inventoryLoaded;
let inventory;
let calls;
let persistence;
let runtime;
let matrix;
let master;
let reconciliation;

try {
  loaderSelfTest = runCorruptTrailerSelfTest();
  pass(`artifact loader corrupt-trailer self-test: ${loaderSelfTest.mode}`);

  inventoryLoaded = loadInventoryManifest(ROOT, FILES.inventory);
  inventory = {
    ...inventoryLoaded.manifest,
    capabilities: inventoryLoaded.capabilities,
  };

  for (const part of inventory.part_files || []) {
    if (!fs.existsSync(abs(part.path))) fail(`missing inventory part ${part.path}`);
    else pass(`inventory part exists ${part.path}`);
  }

  calls = parse(FILES.calls);
  persistence = parse(FILES.persistence);
  runtime = parse(FILES.runtime);
  matrix = parse(FILES.matrix);
  master = read(FILES.master);
  reconciliation = read(FILES.reconciliation);

  const recovered = inventoryLoaded.artifact_transports.filter((item) => item.recovery !== null);
  pass(`inventory artifacts decoded and SHA-256 verified: ${inventoryLoaded.artifact_transports.length}`);
  if (recovered.length > 0) pass(`legacy gzip trailer recovery exercised: ${recovered.length}`);
} catch (error) {
  fail(`DT-01 artifact loading failed: ${error.message}`);
  console.log(`\nDT-01 acceptance summary: ${passes.length} PASS, ${failures.length} FAIL`);
  process.exit(1);
}

const requiredIds = [
  ...Array.from({ length: 5 }, (_, i) => `DT01-CAP-${String(i + 1).padStart(3, '0')}`),
  ...Array.from({ length: 6 }, (_, i) => `DT01-CAP-${String(i + 10).padStart(3, '0')}`),
  ...Array.from({ length: 7 }, (_, i) => `DT01-CAP-${String(i + 20).padStart(3, '0')}`),
  ...Array.from({ length: 6 }, (_, i) => `DT01-CAP-${String(i + 30).padStart(3, '0')}`),
  ...Array.from({ length: 7 }, (_, i) => `DT01-CAP-${String(i + 40).padStart(3, '0')}`),
  ...Array.from({ length: 10 }, (_, i) => `DT01-CAP-${String(i + 50).padStart(3, '0')}`),
  ...Array.from({ length: 4 }, (_, i) => `DT01-CAP-${String(i + 60).padStart(3, '0')}`),
  ...Array.from({ length: 10 }, (_, i) => `DT01-CAP-${String(i + 70).padStart(3, '0')}`),
];

if (inventory.baseline?.commit !== BASELINE) fail('inventory baseline mismatch');
else pass('inventory baseline matches DT-00 merge');

const capabilities = Array.isArray(inventory.capabilities) ? inventory.capabilities : [];
const ids = capabilities.map((item) => item.capability_id);
if (ids.length !== requiredIds.length || new Set(ids).size !== requiredIds.length) fail('capability IDs are not unique/complete');
else pass(`capability IDs unique: ${ids.length}`);

for (const id of requiredIds) {
  if (!ids.includes(id)) fail(`missing required capability ${id}`);
}
if (!failures.some((item) => item.startsWith('missing required capability'))) pass('all mandatory capability IDs present');

const componentKeys = new Set();
const decisionsSeen = new Set();

for (const capability of capabilities) {
  if (!allowedStatus.has(capability.capability_status)) fail(`${capability.capability_id} invalid capability_status`);
  if (!nonEmpty(capability.name) || !nonEmpty(capability.domain) || !nonEmpty(capability.dt02_owner)) fail(`${capability.capability_id} missing required metadata`);

  if (capability.capability_status === 'MISSING') {
    if ((capability.components || []).length !== 0) fail(`${capability.capability_id} MISSING capability must have no fake components`);
    const gap = capability.missing_gap || {};
    if (!nonEmpty(gap.reason) || !nonEmpty(gap.owner) || !nonEmpty(gap.removal_condition)) fail(`${capability.capability_id} incomplete missing_gap`);
    continue;
  }

  if (!Array.isArray(capability.components) || capability.components.length === 0) fail(`${capability.capability_id} has no components`);
  const localIds = new Set();

  for (const component of capability.components || []) {
    const key = `${capability.capability_id}/${component.component_id}`;
    if (!nonEmpty(component.component_id) || localIds.has(component.component_id)) fail(`${capability.capability_id} duplicate/empty component_id`);
    localIds.add(component.component_id);
    componentKeys.add(key);

    for (const field of ['definition_paths','symbols','call_sites','runtime_entries','input_sources','output_objects','persistence_modes','read_models','routes','verification_commands','evidence_levels','limitations','forbidden_claims','dt02_implications','evidence_refs']) {
      if (!Array.isArray(component[field])) fail(`${key} field ${field} must be an array`);
    }
    if (!nonEmpty(component.call_status) || !nonEmpty(component.clock_source) || !nonEmpty(component.data_mode) || !nonEmpty(component.highest_evidence_level)) fail(`${key} missing call/clock/data/evidence fields`);
    if (!allowedEvidence.has(component.highest_evidence_level) || !(component.evidence_levels || []).every((value) => allowedEvidence.has(value))) fail(`${key} invalid evidence level`);
    if (!(component.persistence_modes || []).every((value) => allowedPersistence.has(value))) fail(`${key} invalid persistence mode`);
    if (!allowedDecisions.has(component.reuse_decision)) fail(`${key} invalid reuse decision`);
    decisionsSeen.add(component.reuse_decision);
    if (component.decision_contract?.kind !== component.reuse_decision) fail(`${key} decision_contract kind mismatch`);

    if (component.reuse_decision === 'REUSE_AS_IS') {
      const pureLibrary = component.call_status.includes('PURE_LIBRARY');
      const hasCaller = !component.call_status.includes('NO_RUNTIME_CALL_SITE') && !component.call_status.includes('DEFINITION_ONLY');
      if (!pureLibrary && !hasCaller) fail(`${key} REUSE_AS_IS lacks caller or pure-library boundary`);
      if (component.persistence_modes.includes('ACCEPTANCE_OUTPUT_FILE') && component.evidence_levels.length === 1) fail(`${key} REUSE_AS_IS cannot be acceptance-output only`);
    }
    if (component.reuse_decision === 'REUSE_WITH_ADAPTER') {
      const contract = component.decision_contract?.adapters?.[0] || component.decision_contract;
      if (!contract || !nonEmpty(contract.responsibility) || !nonEmpty(contract.existing_side) || !nonEmpty(contract.new_mcft_side) || !Array.isArray(contract.must_not_do)) fail(`${key} incomplete adapter contract`);
    }
    if (component.reuse_decision === 'EXTRACT_ALGORITHM') {
      const extraction = component.decision_contract || {};
      if (!Array.isArray(extraction.formula_or_rule) || extraction.formula_or_rule.length === 0 || !nonEmpty(extraction.pure_boundary)) fail(`${key} incomplete algorithm extraction`);
    }
    if (component.reuse_decision === 'REPLACE') {
      const replacement = component.decision_contract || {};
      if (!Array.isArray(replacement.replacement_reasons) || replacement.replacement_reasons.length === 0 || !nonEmpty(replacement.replacement_owner) || !nonEmpty(replacement.danger_if_retained)) fail(`${key} incomplete replacement contract`);
    }
    if (component.reuse_decision === 'DEPRECATE') {
      const deprecation = component.decision_contract || {};
      if (!nonEmpty(deprecation.replacement_path) || !nonEmpty(deprecation.owner_phase) || !Array.isArray(deprecation.deletion_prerequisites)) fail(`${key} incomplete deprecation contract`);
    }

    const core = capability.capability_id.startsWith('DT01-CAP-02') || capability.capability_id.startsWith('DT01-CAP-07');
    if (core && [component.clock_source, component.data_mode, component.highest_evidence_level].includes('UNKNOWN')) fail(`${key} core capability retains UNKNOWN`);
  }
}

for (const decision of allowedDecisions) {
  if (!decisionsSeen.has(decision)) fail(`reuse decision class not represented: ${decision}`);
}
if (allowedDecisions.size === decisionsSeen.size) pass('all six reuse decision classes represented');

const callKeys = new Set((calls.entries || []).map((item) => `${item.capability_id}/${item.component_id}`));
for (const key of componentKeys) if (!callKeys.has(key)) fail(`call-chain matrix missing ${key}`);
if (![...componentKeys].some((key) => !callKeys.has(key))) pass('call-chain matrix covers every existing component');

const runtimeIds = new Set((runtime.entries || []).map((item) => item.capability_id));
for (const id of requiredIds) if (!runtimeIds.has(id)) fail(`runtime-entry matrix missing ${id}`);
if (!requiredIds.some((id) => !runtimeIds.has(id))) pass('runtime-entry matrix covers every capability');

const persistenceKeys = new Set((persistence.entries || []).map((item) => `${item.capability_id}/${item.component_id}`));
for (const capability of capabilities) {
  for (const component of capability.components || []) {
    const needsPersistence = !(component.persistence_modes.length === 1 && component.persistence_modes[0] === 'NONE');
    const key = `${capability.capability_id}/${component.component_id}`;
    if (needsPersistence && !persistenceKeys.has(key)) fail(`persistence matrix missing ${key}`);
  }
}
if (!failures.some((item) => item.startsWith('persistence matrix missing'))) pass('persistence matrix covers every persisted component');

function component(capabilityId, componentId) {
  return capabilities.find((item) => item.capability_id === capabilityId)?.components?.find((item) => item.component_id === componentId);
}

if (component('DT01-CAP-014','average_value_state_estimator')?.reuse_decision !== 'REPLACE') fail('P50 state estimator must be REPLACE');
if (component('DT01-CAP-014','linear_demo_forecast')?.reuse_decision !== 'REPLACE') fail('P50 forecast math must be REPLACE');
if (component('DT01-CAP-014','acceptance_output_persistence')?.persistence_modes?.includes('ACCEPTANCE_OUTPUT_FILE') !== true) fail('P50 persistence must be acceptance-output');
if (component('DT01-CAP-020','threshold_classifier')?.reuse_decision !== 'REPLACE') fail('water_state_estimate semantics must be REPLACE');
if (component('DT01-CAP-021','spatial_aggregation')?.reuse_decision !== 'EXTRACT_ALGORITHM') fail('root-zone aggregation must be EXTRACT_ALGORITHM');
if (capabilities.find((item) => item.capability_id === 'DT01-CAP-070')?.capability_status !== 'MISSING') fail('hourly tick must be MISSING');
if (capabilities.find((item) => item.capability_id === 'DT01-CAP-072')?.capability_status !== 'MISSING') fail('assimilation must be MISSING');
if (capabilities.find((item) => item.capability_id === 'DT01-CAP-076')?.capability_status !== 'MISSING') fail('checkpoint must be MISSING');

const matrixLineage = Array.isArray(matrix.governance_lineage) ? matrix.governance_lineage : [];
if (!matrixLineage.includes('DT-00') || !matrixLineage.includes('DT-01')) fail('capability matrix governance lineage must include DT-00 and DT-01');
else pass('capability matrix preserves DT-00 and DT-01 governance lineage');
const liveProduction = (matrix.capabilities || []).find((item) => item.capability_id === 'DT-MATRIX-LIVE-PRODUCTION-FIELD-TWIN');
if (liveProduction?.current_status !== 'NOT_CLAIMED') fail('live production Field Twin must remain NOT_CLAIMED');
else pass('live production Field Twin remains NOT_CLAIMED');

const forbiddenClaims = [
  'P50 = production runtime',
  'P57 = live-device runtime',
  'water_state_estimate_v1 = canonical posterior state',
  'root-zone builder = continuous state estimator',
  'acceptance-output JSONL = database persistence',
  'AO-ACT task created = action executed',
  'Field Memory = automatic learning loop',
];
const allText = [read(FILES.method), reconciliation, read(FILES.reuse), read(FILES.dt02), master].join('\n');
for (const claim of forbiddenClaims) {
  if (allText.includes(claim)) fail(`forbidden positive claim present: ${claim}`);
}
if (!failures.some((item) => item.startsWith('forbidden positive claim'))) pass('forbidden capability inflation claims absent');

if (!master.includes('DT-02 Runtime Architecture Freeze')) fail('master does not identify DT-02');
else pass('master identifies DT-02 successor');
if (!reconciliation.includes('No new Twin runtime capability')) fail('DT-01 nonclaim missing');
else pass('DT-01 nonclaim present');

try {
  cp.execFileSync(process.execPath, [FILES.auditScript, '--check'], { cwd: ROOT, stdio: 'inherit' });
  pass('DT-01 repository static audit PASS');
} catch (error) {
  fail(`DT-01 repository static audit failed: ${error.message}`);
}

try {
  cp.execFileSync(process.execPath, [FILES.dt00RegressionScript], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, DT00_ACCEPTANCE_SKIP_GIT_SCOPE: '1' },
  });
  pass('DT-00 semantic regression PASS with successor-scope skip');
} catch (error) {
  fail(`DT-00 semantic regression failed: ${error.message}`);
}

try {
  const changed = cp.execFileSync('git', ['diff','--name-only',`${BASELINE}...HEAD`], { cwd: ROOT, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
  const allowedGovernanceScripts = new Set([FILES.auditScript, FILES.acceptanceScript, FILES.helperScript, FILES.dt00RegressionScript]);
  const forbidden = changed.filter((file) => !(file.startsWith('docs/digital_twin/') || allowedGovernanceScripts.has(file)));
  if (forbidden.length) fail(`forbidden changed files: ${forbidden.join(', ')}`);
  else pass(`changed-file scope valid: ${changed.length} files`);
} catch (error) {
  fail(`git changed-file scope check failed: ${error.message}`);
}

console.log(`\nDT-01 acceptance summary: ${passes.length} PASS, ${failures.length} FAIL`);
if (failures.length) process.exit(1);
console.log('DT-01 EXISTING CAPABILITY RECONCILIATION: PASS');
