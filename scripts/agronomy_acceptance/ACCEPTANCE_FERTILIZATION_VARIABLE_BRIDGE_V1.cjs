const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const bridgePath = path.join(root, 'apps/server/src/services/fertilization/fertilization_bridge_v1.ts');
const routePath = path.join(root, 'apps/server/src/routes/v1/fertilization.ts');

function read(file) {
  assert.equal(fs.existsSync(file), true, `missing required file: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

function assertAll(text, required, label) {
  const missing = required.filter((x) => !text.includes(x));
  assert.deepEqual(missing, [], `${label} missing required entries: ${missing.join(', ')}`);
}

function assertNotAny(text, forbidden, label) {
  const hits = forbidden.filter((x) => text.includes(x));
  assert.deepEqual(hits, [], `${label} contains forbidden entries: ${hits.join(', ')}`);
}

function assertNoRegex(text, patterns, label) {
  const hits = patterns.filter((x) => x.test(text)).map((x) => String(x));
  assert.deepEqual(hits, [], `${label} matched forbidden patterns: ${hits.join(', ')}`);
}

(function main() {
  const bridge = read(bridgePath);
  const route = read(routePath);

  const requiredRoute = [
    'app.post("/api/v1/fertilization/prescription/:fertilization_prescription_id/to-variable-prescription"',
    'new FertilizationVariableBridgeV1(pool)',
    'bridge.createVariablePrescription',
    'requireFertilizationWriteAuth',
    'requireTenantMatchOr404',
    'requireFieldAllowedOr404V1',
    'idempotent',
    'variable_plan',
    'variable_prescription',
  ];

  const requiredBridge = [
    'export class FertilizationVariableBridgeV1',
    'fertilization_prescription_v1',
    'prescription_contract_v1',
    'recommendation_id',
    'fert_bridge_',
    'mode: "VARIABLE_BY_ZONE"',
    'operation_type: "FERTILIZATION"',
    'nutrient: "N"',
    'zone_rates',
    'planned_amount',
    'planned_n_kg_ha',
    'unit: "kgN/ha"',
    'required: true',
    'device.fertilization.dispense',
    'manual_takeover_required: true',
    'auto_execute_allowed: false',
    'status: "READY_FOR_APPROVAL"',
    'role: "agronomist_or_manager"',
    'second_confirmation_required: true',
    'VARIABLE_BY_ZONE',
    'FERTILIZATION_VARIABLE_BY_ZONE',
  ];

  const requiredFormatNeedles = [
    'mode: "VARIABLE_BY_ZONE"',
    'operation_type: "FERTILIZATION"',
    'nutrient: "N"',
    'zone_id',
    'planned_amount',
    'planned_n_kg_ha',
    'unit: "kgN/ha"',
    'required: true',
  ];

  const forbiddenCopies = [
    '/api/v1/actions/task/from-variable-prescription',
    'actions/task/from-variable-prescription',
    'from-variable-prescription',
    '/api/v1/as-executed/from-receipt',
    'as-executed/from-receipt',
    'as_applied_id:',
    'as_applied_map_id',
    'acceptance/evaluate',
    'approvePrescription',
    'approvals/approve',
    'decision: "APPROVE"',
    "decision: 'APPROVE'",
    'auto_approve',
    'autoApprove',
    'allow_auto_task_issue: true',
    'task_lifecycle_status',
    'ACKED',
    'dispatch command',
  ];

  const forbiddenRouteCopies = [
    '/api/v1/actions/task/from-variable-prescription',
    'actions/task/from-variable-prescription',
    'from-variable-prescription',
    '/api/v1/as-executed/from-receipt',
    'as-executed/from-receipt',
    'approvals/approve',
    'decision: "APPROVE"',
    "decision: 'APPROVE'",
    'auto_approve',
    'autoApprove',
  ];

  assertAll(route, requiredRoute, 'fertilization bridge route');
  assertAll(bridge, requiredBridge, 'fertilization variable bridge service');
  assertAll(bridge, requiredFormatNeedles, 'bridge variable plan format');

  assertNotAny(bridge, forbiddenCopies, 'bridge service must not copy execution/approval/as-applied chain');
  assertNotAny(route, forbiddenRouteCopies, 'bridge route must not copy execution/approval/as-applied chain');
  assertNoRegex(bridge, [
    /INSERT\s+INTO\s+facts/i,
    /INSERT\s+INTO\s+operation_state_v1/i,
    /INSERT\s+INTO\s+roi_ledger/i,
    /INSERT\s+INTO\s+field_memory/i,
    /INSERT\s+INTO\s+customer_report/i,
    /UPDATE\s+prescription_contract_v1[\s\S]{0,180}status\s*=\s*['"]APPROVED['"]/i,
  ], 'bridge service forbidden writes');

  assert.equal(/INSERT\s+INTO\s+prescription_contract_v1/i.test(bridge), true, 'bridge must create a variable prescription contract');
  assert.equal(/operation_type:\s*"FERTILIZATION"/.test(bridge), true, 'bridge must preserve FERTILIZATION operation_type');
  assert.equal(/planned_amount,/.test(bridge), true, 'bridge must map planned_n_kg_ha to planned_amount');
  assert.equal(/unit:\s*"kgN\/ha"/.test(bridge), true, 'bridge must use kgN/ha unit');
  assert.equal(/required:\s*true/.test(bridge), true, 'bridge zone rates must be required');

  console.log('PASS acceptance fertilization variable bridge v1', {
    bridgePath,
    routePath,
    requiredRoute: requiredRoute.length,
    requiredBridge: requiredBridge.length,
    forbiddenCopies: forbiddenCopies.length,
  });
})();
