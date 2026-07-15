# scripts/remediation/APPLY_MCFT_CAP_05_FINAL_ACCEPTANCE_WIRING.py
# Purpose: correct the permanent CAP-05 governance Gate group count and pass the acceptance harness's explicitly configured PostgreSQL connection to the formal runner child process.
# Boundary: acceptance wiring only; no production Runtime, repository, database schema, canonical object, selector, Config, Evidence, calibration, Model Activation, or CAP-06 authority change.

from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"FINAL_ACCEPTANCE_WIRING_MARKER_COUNT:{path}:{count}:{old[:100]}")
    target.write_text(text.replace(old, new, 1))


replace_once(
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_POST_CLOSURE_RUNTIME_CONFORMANCE_REMEDIATION.cjs",
    '''assert.equal(pass, 13);
process.stdout.write(`SUMMARY ${pass} PASS / 0 FAIL\\n`);''',
    '''assert.equal(pass, 14);
process.stdout.write(`SUMMARY ${pass} PASS / 0 FAIL\\n`);''',
)

replace_once(
    "scripts/acceptance/run_acceptance.cjs",
    '''    if (suiteId === 'legacy' && step.id === 'P1_ACCEPTANCE_SMOKE') {
      if (!runtimeContext.operationPlanIdFromP1) {
        results.push({
          id: step.id,
          passed: true,
          command: step.command,
          duration_ms: 0,
          evidence: '',
          notes: 'SKIP: Missing required GEOX_OPERATION_PLAN_ID from previous P1_SMOKE output; step was not executed.'
        });
        continue;
      }
      envOverrides.GEOX_OPERATION_PLAN_ID = runtimeContext.operationPlanIdFromP1;
    }

    const result = await runStep(step, envOverrides);''',
    '''    if (suiteId === 'legacy' && step.id === 'P1_ACCEPTANCE_SMOKE') {
      if (!runtimeContext.operationPlanIdFromP1) {
        results.push({
          id: step.id,
          passed: true,
          command: step.command,
          duration_ms: 0,
          evidence: '',
          notes: 'SKIP: Missing required GEOX_OPERATION_PLAN_ID from previous P1_SMOKE output; step was not executed.'
        });
        continue;
      }
      envOverrides.GEOX_OPERATION_PLAN_ID = runtimeContext.operationPlanIdFromP1;
    }

    if (suiteId === 'legacy' && step.id === 'MCFT_CAP_05_POST_CLOSURE_POSTGRESQL_RUNNER') {
      const explicitDatabaseUrl = String(process.env.DATABASE_URL || '').trim();
      if (explicitDatabaseUrl) {
        envOverrides.DATABASE_URL = explicitDatabaseUrl;
      } else {
        const postgresUser = String(process.env.POSTGRES_USER || '').trim();
        const postgresPassword = String(process.env.POSTGRES_PASSWORD || '').trim();
        const postgresDatabase = String(process.env.POSTGRES_DB || '').trim();
        const postgresHost = String(process.env.POSTGRES_HOST || '127.0.0.1').trim();
        const postgresPort = String(process.env.POSTGRES_PORT || '5433').trim();
        if (!postgresUser || !postgresPassword || !postgresDatabase || !postgresHost || !postgresPort) {
          throw new Error('MCFT_CAP_05_POSTGRESQL_ACCEPTANCE_DATABASE_CONFIG_REQUIRED');
        }
        envOverrides.DATABASE_URL = `postgres://${encodeURIComponent(postgresUser)}:${encodeURIComponent(postgresPassword)}@${postgresHost}:${postgresPort}/${encodeURIComponent(postgresDatabase)}`;
      }
    }

    const result = await runStep(step, envOverrides);''',
)
