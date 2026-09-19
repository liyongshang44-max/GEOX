const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const fail = (code) => { throw new Error(code); };
const hasAll = (src, items) => items.every((item) => src.includes(item));
const lacksAll = (src, items) => items.every((item) => !src.includes(item));

const files = {
  app: 'apps/web/src/app/App.tsx',
  operatorLayout: 'apps/web/src/layouts/OperatorLayout.tsx',
  fieldRoutes: 'apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx',
  pfe14: 'docs/frontend-productization/PFE-14-ROUTE-OWNERSHIP.json',
  wave01: 'docs/product_projection/GEOX-FOUI-PROJECTION-CONTRACT-WAVE-01-V1.md',
  registry: 'apps/server/src/product_projection/contracts/product_projection_source_binding_registry_v1.ts',
  reconciliation: 'docs/frontend-productization/FOUI-0-CURRENT-MAIN-FRONTEND-RECONCILIATION.md',
  surfaceMatrix: 'docs/frontend-productization/FOUI-0-FIELD-OPERATIONS-PRODUCT-SURFACE-MATRIX.md',
  gapRegister: 'docs/product_projection/FOUI-0-PROJECTION-API-GAP-REGISTER.md',
  reuseRegister: 'docs/frontend-productization/FOUI-0-CAPABILITY-REUSE-REGISTER.md',
  preWave02Handoff: 'docs/product_projection/FOUI-0-PRE-WAVE02-CONSTRUCTION-HANDOFF.md',
  freezeManifest: 'docs/frontend-productization/FOUI-0-FREEZE-MANIFEST.json',
};

for (const [key, rel] of Object.entries(files)) {
  if (!fs.existsSync(path.join(ROOT, rel))) fail('FOUI0_FILE_MISSING:' + key + ':' + rel);
}

const app = read(files.app);
const operatorLayout = read(files.operatorLayout);
const fieldRoutes = read(files.fieldRoutes);
const pfe14 = read(files.pfe14);
const wave01 = read(files.wave01);
const registry = read(files.registry);
const reconciliation = read(files.reconciliation);
const surfaceMatrix = read(files.surfaceMatrix);
const gapRegister = read(files.gapRegister);
const reuseRegister = read(files.reuseRegister);
const preWave02Handoff = read(files.preWave02Handoff);
const freezeManifest = JSON.parse(read(files.freezeManifest));

if (!app.includes('<Route path="/operator/*" element={<OperatorShell />} />')) fail('FOUI0_OPERATOR_SHELL_NOT_CANONICAL');

if (!hasAll(fieldRoutes, [
  'path=":fieldId"',
  'path=":fieldId/state"',
  'path=":fieldId/forecast"',
  'path=":fieldId/scenario"',
  'path=":fieldId/action-lifecycle"',
  'path=":fieldId/residual"',
  'path=":fieldId/calibration"',
  'path=":fieldId/evidence-trace"',
  'path=":fieldId/health"',
])) fail('FOUI0_CANONICAL_FIELD_RUNTIME_ROUTE_SET_INCOMPLETE');

if (!hasAll(operatorLayout, [
  'key: "overview"',
  'to: "/operator/twin"',
  'key: "fields"',
  'to: "/operator/fields"',
])) fail('FOUI0_OPERATOR_FORMAL_NAV_BASELINE_MISMATCH');

if (!lacksAll(operatorLayout, [
  'to: "/operator/approvals"',
  'to: "/operator/dispatch"',
  'to: "/operator/evidence"',
  'to: "/operator/roi-ledger"',
  'to: "/operator/field-memory"',
])) fail('FOUI0_LEGACY_OPERATOR_ROUTE_PROMOTED_IN_FORMAL_NAV');

if (!hasAll(pfe14, [
  'CANONICAL_GET_ONLY_NO_LEGACY_TRUTH_FALLBACK',
  'apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx',
  'McftCanonicalFieldRuntimeRoutePage.tsx',
  'LEGACY_VISIBLE_BY_URL_ONLY',
])) fail('FOUI0_PFE14_ROUTE_OWNERSHIP_BOUNDARY_MISSING');

if (!hasAll(wave01, [
  'ProductProjectionEnvelopeV1',
  'GovernedActionCaseProjectionV1',
  'CapabilityAvailabilityProjectionV1',
  'AttentionQueueProjectionV1',
  'NON_AUTHORITATIVE_PRODUCT_PROJECTION_ONLY',
  'current_state_substitution_forbidden = true',
])) fail('FOUI0_WAVE01_CONTRACT_BASELINE_MISSING');

if (!hasAll(registry, [
  'MCFT_RUNTIME_POSTERIOR_STATE_V1',
  'ADR_DECISION_RESULT_V1',
  'BLINE_APPROVAL_REQUEST_V1',
  'BLINE_APPROVAL_DECISION_V1',
  'BLINE_OPERATION_PLAN_V1',
  'BLINE_AO_ACT_TASK_V0',
  'BLINE_AO_ACT_DISPATCH_V1',
  'BLINE_AO_ACT_RECEIPT_V1',
  'BLINE_AS_EXECUTED_RECORD_V1',
  'BLINE_EVIDENCE_ARTIFACT_V1',
  'BLINE_ACCEPTANCE_RESULT_V1',
])) fail('FOUI0_SOURCE_BINDING_CHAIN_INCOMPLETE');

if (!hasAll(reconciliation, [
  'REUSE',
  'REFACTOR',
  'LEGACY',
  'REMOVE-LATER',
  'NEW-REQUIRED',
  'HOLD',
  'Home',
  'Fields',
  'Decisions',
  'Operations',
  'Evidence',
  'Outcomes',
  'Reports',
  'Administration',
])) fail('FOUI0_RECONCILIATION_CLASSIFICATION_INCOMPLETE');

if (!hasAll(surfaceMatrix, [
  'Field State',
  'Decision',
  'Approval',
  'Execution',
  'Receipt',
  'Evidence',
  'Outcome',
  'WHY',
  'BASIS',
  'AUTHORITY',
  'PROOF',
])) fail('FOUI0_SURFACE_RESPONSIBILITY_MATRIX_INCOMPLETE');

if (!hasAll(gapRegister, [
  'CONTRACT_PRESENT_RUNTIME_MISSING',
  'SOURCE_PRESENT_PROJECTION_MISSING',
  'FRONTEND_ADAPTER_MISSING',
  'HOLD_BY_AUTHORITY',
  'route visibility != capability availability',
  'current MCFT state != decision-time state',
])) fail('FOUI0_GAP_REGISTER_INCOMPLETE');

if (!hasAll(reuseRegister, [
  'priorityText',
  'AttentionQueueProjectionV1',
  'submitOperatorApprovalAction',
  'EvidenceArtifact authority chain',
  'acceptance_result_v1 PASS',
  'ROI row != Outcome authority',
])) fail('FOUI0_CAPABILITY_REUSE_REGISTER_INCOMPLETE');

if (!hasAll(preWave02Handoff, [
  'NOT IMPLEMENTATION AUTHORIZATION',
  'W2-1 GovernedActionCaseProjection builder',
  'W2-2 CapabilityAvailabilityProjection builder',
  'W2-3 AttentionQueueProjection builder',
  'GET',
  'HEAD',
  'POST',
  'current_state_substitution_forbidden = true',
])) fail('FOUI0_PRE_WAVE02_HANDOFF_INCOMPLETE');

if (freezeManifest.schema_version !== 'geox_foui0_frontend_reconciliation_freeze_v1') fail('FOUI0_FREEZE_MANIFEST_SCHEMA_INVALID');
if (freezeManifest.audit_base_main_sha !== 'd054b334b3e74f3356b5d02498da9ba845eccdfb') fail('FOUI0_FREEZE_MANIFEST_BASE_MISMATCH');
if (freezeManifest.merge_authorization !== 'NONE_DURING_MCFT_FORMAL_V5_FREEZE') fail('FOUI0_FREEZE_MANIFEST_MERGE_BOUNDARY_INVALID');
if (freezeManifest.wave02_implementation_authorization !== 'NONE') fail('FOUI0_FREEZE_MANIFEST_WAVE02_AUTHORIZATION_INVALID');
if (freezeManifest.high_fidelity_authorization !== 'NONE') fail('FOUI0_FREEZE_MANIFEST_HIGH_FIDELITY_INVALID');
if (freezeManifest.outcome_promotion !== 'HOLD') fail('FOUI0_FREEZE_MANIFEST_OUTCOME_INVALID');
if (freezeManifest.projection_runtime?.governed_action_case_builder !== 'NOT_CONSTRUCTED') fail('FOUI0_FREEZE_MANIFEST_ACTION_BUILDER_INVALID');
if (freezeManifest.projection_runtime?.capability_availability_builder !== 'NOT_CONSTRUCTED') fail('FOUI0_FREEZE_MANIFEST_CAPABILITY_BUILDER_INVALID');
if (freezeManifest.projection_runtime?.attention_queue_builder !== 'NOT_CONSTRUCTED') fail('FOUI0_FREEZE_MANIFEST_ATTENTION_BUILDER_INVALID');

const projectionRoot = path.join(ROOT, 'apps/server/src/product_projection');
const projectionFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs);
    else projectionFiles.push(path.relative(ROOT, abs).replace(/\\/g, '/'));
  }
}
walk(projectionRoot);

const unexpectedRuntimeFiles = projectionFiles.filter((p) => /(?:builder|reader|route|adapter)/i.test(path.basename(p)));
if (unexpectedRuntimeFiles.length) fail('FOUI0_PROJECTION_RUNTIME_ALREADY_PRESENT:' + unexpectedRuntimeFiles.join(','));

console.log(JSON.stringify({
  status: 'PASS',
  gate: 'FOUI-0-CURRENT-MAIN-FRONTEND-RECONCILIATION',
  base_main_sha: 'd054b334b3e74f3356b5d02498da9ba845eccdfb',
  canonical_field_runtime: '/operator/fields/*',
  wave01_contract: 'PRESENT',
  source_binding_registry: 'PRESENT',
  projection_runtime: 'NOT_CONSTRUCTED',
  capability_reuse_register: 'PRESENT',
  pre_wave02_handoff: 'PRESENT_NOT_AUTHORIZED',
  freeze_manifest: freezeManifest.schema_version,
  high_fidelity_authorization: 'NONE',
  backend_authority_change: 'NONE',
  main_merge_authorization: 'NONE_DURING_MCFT_FREEZE',
  projection_files: projectionFiles,
}, null, 2));