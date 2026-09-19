const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const TASK = 'BLINE_B5A_APPROVAL_EXECUTION_CONTEXT_V1';

async function main() {
  const repoRoot = path.resolve(__dirname, '../..');
  const builtModule = path.join(
    repoRoot,
    'apps/server/dist/apps/server/src/domain/controlplane/approval_execution_context_v1.js',
  );
  const taskServiceSource = path.join(
    repoRoot,
    'apps/server/src/domain/controlplane/task_service.ts',
  );

  assert.equal(fs.existsSync(builtModule), true, 'server build must emit approval_execution_context_v1.js');
  assert.equal(fs.existsSync(taskServiceSource), true, 'task_service.ts missing');

  const mod = await import(pathToFileURL(builtModule).href);
  const resolveApprovalExecutionContextV1 = mod.resolveApprovalExecutionContextV1;
  assert.equal(typeof resolveApprovalExecutionContextV1, 'function', 'resolver export missing');

  const exactB4Shape = resolveApprovalExecutionContextV1({
    requestPayload: {
      proposal: {
        action_type: 'IRRIGATE',
        target: { kind: 'field', ref: 'field_gap_closure' },
        meta: { device_id: 'device_gap_closure' },
      },
    },
    requestBody: {
      device_id: 'device_gap_closure',
      adapter_type: 'irrigation_simulator',
      device_type: 'IRRIGATION_CONTROLLER',
      required_capabilities: ['device.irrigation.valve.open'],
    },
  });
  assert.deepEqual(exactB4Shape, {
    device_id: 'device_gap_closure',
    adapter_type: 'irrigation_simulator',
    device_type: 'IRRIGATION_CONTROLLER',
    required_capabilities: ['device.irrigation.valve.open'],
  }, 'B4 exact decision-body execution context must survive approval preflight resolution');

  const existingPlanWins = resolveApprovalExecutionContextV1({
    operationPlanPayload: {
      device_id: 'device_plan',
      adapter_type: 'mqtt_downlink_once_v1',
      device_type: 'VALVE',
      required_capabilities: ['device.valve.open'],
    },
    requestPayload: {
      proposal: {
        action_type: 'IRRIGATE',
        meta: { device_id: 'device_proposal' },
      },
    },
    requestBody: {
      device_id: 'device_body',
      adapter_type: 'irrigation_simulator',
      device_type: 'IRRIGATION_CONTROLLER',
      required_capabilities: ['device.irrigation.valve.open'],
    },
  });
  assert.deepEqual(existingPlanWins, {
    device_id: 'device_plan',
    adapter_type: 'mqtt_downlink_once_v1',
    device_type: 'VALVE',
    required_capabilities: ['device.valve.open'],
  }, 'existing operation plan must remain the highest-precedence execution identity');

  const irrigationFallback = resolveApprovalExecutionContextV1({
    requestPayload: {
      proposal: {
        action_type: 'IRRIGATE',
        meta: { device_id: 'device_irrigation' },
      },
    },
    requestBody: {},
  });
  assert.equal(irrigationFallback.adapter_type, 'irrigation_simulator', 'existing irrigation fallback must remain preserved');

  const nonIrrigationFailClosed = resolveApprovalExecutionContextV1({
    requestPayload: {
      proposal: {
        action_type: 'SPRAY',
        meta: { device_id: 'device_spray' },
      },
    },
    requestBody: {},
  });
  assert.equal(nonIrrigationFailClosed.adapter_type, null, 'non-irrigation missing adapter must remain fail-closed');

  const source = fs.readFileSync(taskServiceSource, 'utf8');
  const callCount = (source.match(/resolveApprovalExecutionContextV1\(\{/g) || []).length;
  assert.ok(callCount >= 2, `resolver must be used by both approval preflight and operation-plan materializer; calls=${callCount}`);
  assert.ok(
    source.includes('operationPlanPayload: preDecisionPlanPayload'),
    'approval preflight must resolve against the pre-decision operation-plan payload',
  );

  process.stdout.write(JSON.stringify({
    ok: true,
    task: TASK,
    checks: {
      exact_b4_decision_body_context: 'PASS',
      existing_plan_precedence: 'PASS',
      irrigation_fallback_preserved: 'PASS',
      non_irrigation_missing_adapter_fail_closed: 'PASS',
      preflight_materializer_share_resolver: 'PASS',
    },
  }, null, 2) + '\n');
}

main().catch((error) => {
  process.stderr.write(JSON.stringify({
    ok: false,
    task: TASK,
    error: String(error?.stack ?? error?.message ?? error),
  }, null, 2) + '\n');
  process.exit(1);
});
