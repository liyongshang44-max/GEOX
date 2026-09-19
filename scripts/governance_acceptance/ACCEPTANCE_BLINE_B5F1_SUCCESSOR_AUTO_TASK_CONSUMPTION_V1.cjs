const fs = require('node:fs');
const path = require('node:path');

const TASK = 'BLINE_B5F1_SUCCESSOR_AUTO_TASK_CONSUMPTION_V1';
const target = path.join(
  process.cwd(),
  'scripts/agronomy_acceptance/ACCEPTANCE_SKILL_CONTRACT_GAP_CLOSURE_V1.cjs',
);

function pass(v) {
  return v ? 'PASS' : 'FAIL';
}

function main() {
  const source = fs.readFileSync(target, 'utf8');

  const decideAnchor = "const decide = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(ids.approval_id)}/decide`";
  const decideAt = source.indexOf(decideAnchor);
  if (decideAt < 0) throw new Error('DECIDE_ANCHOR_MISSING');

  const tail = source.slice(decideAt);
  const actionTaskCallsTotal = (source.match(/fetchJson\(`\$\{base\}\/api\/v1\/actions\/task`/g) || []).length;
  const actionTaskCallsAfterDecide = (tail.match(/fetchJson\(`\$\{base\}\/api\/v1\/actions\/task`/g) || []).length;

  const checks = {
    decide_result_captured_once: pass(
      source.includes("const decideJson = requireOk(decide, 'decide approval');")
      && (source.match(/const decideJson = requireOk\(decide, 'decide approval'\);/g) || []).length === 1,
    ),
    operation_plan_consumed_from_decide: pass(
      source.includes("const operation_plan_id = String(decideJson.operation_plan_id ?? '').trim();"),
    ),
    task_consumed_from_decide: pass(
      source.includes("ids.task_id = String(decideJson.act_task_id ?? '').trim();"),
    ),
    successor_task_id_required: pass(
      source.includes("if (!ids.task_id) throw new Error(JSON.stringify({ reason: 'AUTO_TASK_ID_MISSING_AFTER_APPROVAL'"),
    ),
    no_second_task_create_after_decide: pass(actionTaskCallsAfterDecide === 0),
    mismatch_negative_task_create_preserved: pass(
      source.includes('const mismatchTaskResp = await fetchJson(`${base}/api/v1/actions/task`')
      && source.includes("action_type: 'SPRAY'"),
    ),
    exactly_one_explicit_task_create_remains: pass(actionTaskCallsTotal === 1),
    b5e_duplicate_error_not_normalized_away: pass(
      !source.includes('OPERATION_PLAN_TASK_ALREADY_CREATED')
      && !source.includes('idempotent duplicate task'),
    ),
  };

  const ok = Object.values(checks).every((x) => x === 'PASS');
  process.stdout.write(`${JSON.stringify({ ok, task: TASK, checks }, null, 2)}\n`);
  if (!ok) process.exit(1);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    ok: false,
    task: TASK,
    error: String(error?.stack ?? error?.message ?? error),
  }, null, 2)}\n`);
  process.exit(1);
}
