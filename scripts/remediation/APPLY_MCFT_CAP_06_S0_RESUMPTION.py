# scripts/remediation/APPLY_MCFT_CAP_06_S0_RESUMPTION.py
# Purpose: resume the governance-only CAP-06 S0 predecessor qualification from the exact effective CAP-05 main baseline, align its temporary Replay input with the proven H-authoritative contract, and expire the inherited isolated-database lease before fenced owner takeover.
# Boundary: acceptance/governance source transformation only; no production Runtime, lease semantics, database schema, migration, route, scheduler, Model Activation, calibration, canonical Candidate/Evaluation write, or CAP-07 authority.

from pathlib import Path

EFFECTIVE_MAIN = "1e66ea7efc842b8e547bccc40521d520b4370e69"
HISTORICAL_P0 = "a7bb8d9499560b0ef0244a1a6daeaee1eeb408bf"
PREFLIGHT = Path("scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_PREDECESSOR_PREFLIGHT.ts")
GATE = Path("scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_AUTHORIZATION.cjs")


def replace_once(text: str, old: str, new: str, code: str) -> str:
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{code}:MARKER_COUNT:{count}")
    return text.replace(old, new, 1)


preflight = PREFLIGHT.read_text()
preflight = replace_once(
    preflight,
    f'const BASELINE_MAIN = "{HISTORICAL_P0}";',
    f'const BASELINE_MAIN = "{EFFECTIVE_MAIN}";',
    "S0_EFFECTIVE_BASELINE_PATCH",
)
preflight = replace_once(
    preflight,
    "const P0_MERGE_COMMIT = BASELINE_MAIN;",
    f'const P0_MERGE_COMMIT = "{HISTORICAL_P0}";',
    "S0_HISTORICAL_P0_PATCH",
)
preflight = replace_once(
    preflight,
    'import fs from "node:fs";\nimport path from "node:path";',
    'import fs from "node:fs";\nimport os from "node:os";\nimport path from "node:path";',
    "S0_OS_IMPORT_PATCH",
)
preflight = replace_once(
    preflight,
    'import { Cap05ApprovalPlanBindingServiceV1 } from "../../apps/server/src/runtime/twin_runtime/approval_plan_binding_service_v1.js";',
    'import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";\nimport { Cap05ApprovalPlanBindingServiceV1 } from "../../apps/server/src/runtime/twin_runtime/approval_plan_binding_service_v1.js";',
    "S0_SEMANTIC_HASH_IMPORT_PATCH",
)

helper = '''function walkReplayFilesV1(directory: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkReplayFilesV1(absolutePath));
    else files.push(absolutePath);
  }
  return files;
}

function buildS0HAuthoritativeReplayViewV1(): string {
  const source = absolute("fixtures/mcft/water_state/replay_v1");
  const target = path.join(os.tmpdir(), "mcft_cap06_s0_h_authoritative_replay_v1");
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });

  let removedLegacyIrrigation = 0;
  let normalizedObservation = 0;
  for (const file of walkReplayFilesV1(target).filter((candidate) => candidate.endsWith(".jsonl"))) {
    const records = fs.readFileSync(file, "utf8")
      .split("\\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, any>);
    const output: string[] = [];
    for (const record of records) {
      if (record.record_type === "irrigation_execution_evidence_v1") {
        removedLegacyIrrigation += 1;
        continue;
      }
      if (record.record_type === "soil_moisture_observation_v1") {
        record.canonical_payload = { ...record.canonical_payload };
        record.source_payload = { ...record.source_payload };
        if (record.canonical_payload.quantity_kind === undefined) {
          assert.equal(typeof record.quantity_kind, "string", "S0_TEMP_REPLAY_QUANTITY_KIND_REQUIRED");
          record.canonical_payload.quantity_kind = record.quantity_kind;
          normalizedObservation += 1;
        }
        if (record.source_payload.source_version === undefined) {
          assert.equal(typeof record.source_version, "string", "S0_TEMP_REPLAY_SOURCE_VERSION_REQUIRED");
          record.source_payload.source_version = record.source_version;
        }
        const semantic = structuredClone(record);
        delete semantic.source_record_hash;
        delete semantic.materialized_file_location;
        record.source_record_hash = semanticHashV1(semantic);
      }
      output.push(JSON.stringify(record));
    }
    fs.writeFileSync(file, `${output.join("\\n")}\\n`, "utf8");
  }
  assert.ok(removedLegacyIrrigation >= 1, "S0_LEGACY_IRRIGATION_EXCLUSION_NOT_PROVEN");
  assert.ok(normalizedObservation >= 1, "S0_LEGACY_OBSERVATION_NORMALIZATION_NOT_PROVEN");

  const outcomePath = absolute("fixtures/mcft/water_state/feedback_v1/soil_observations.jsonl");
  const outcomeRecords = fs.readFileSync(outcomePath, "utf8")
    .split(String.fromCharCode(10))
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, any>);
  assert.equal(outcomeRecords.length, 1, "S0_OUTCOME_OBSERVATION_CARDINALITY");
  const outcome = structuredClone(outcomeRecords[0]);
  assert.equal(outcome.record_type, "soil_moisture_observation_v1");
  assert.equal(outcome.role_time.observed_at, "2026-06-04T03:00:00.000Z");
  outcome.canonical_payload = {
    ...outcome.canonical_payload,
    quantity_kind: "VOLUMETRIC_WATER_CONTENT",
  };
  outcome.source_payload = {
    ...outcome.source_payload,
    source_version: String(outcome.source_version ?? "1"),
  };
  const semantic = structuredClone(outcome);
  delete semantic.source_record_hash;
  delete semantic.materialized_file_location;
  outcome.source_record_hash = semanticHashV1(semantic);
  fs.appendFileSync(
    path.join(target, "soil_moisture", "2026-06-04.jsonl"),
    `${JSON.stringify(outcome)}\\n`,
    "utf8",
  );
  return target;
}

'''
marker = "async function executeCap05TerminalChain(databaseUrl: string): Promise<void> {"
if helper not in preflight:
    if marker not in preflight:
        raise SystemExit("S0_REPLAY_HELPER_INSERTION_MARKER_MISSING")
    preflight = preflight.replace(marker, helper + marker, 1)

preflight = replace_once(
    preflight,
    '''  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await establishStandardFeedbackPath(pool);
  } finally {
    await pool.end();
  }

  fs.mkdirSync(absolute("acceptance-output"), { recursive: true });''',
    '''  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await establishStandardFeedbackPath(pool);
    const expiredPredecessorLease = await pool.query(
      `UPDATE twin_runtime_lease_v1
          SET expires_at=transaction_timestamp()-interval '1 second'
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
          AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      scopeValues(),
    );
    assert.equal(expiredPredecessorLease.rowCount, 1, "S0_PREDECESSOR_LEASE_CARDINALITY");
    ok("expired inherited predecessor lease permits fenced S0 owner takeover without weakening mutual exclusion");
  } finally {
    await pool.end();
  }

  const replayRoot = buildS0HAuthoritativeReplayViewV1();
  fs.mkdirSync(absolute("acceptance-output"), { recursive: true });''',
    "S0_LEASE_HANDOFF_AND_REPLAY_ROOT_PATCH",
)
preflight = replace_once(
    preflight,
    '    replay_root: "fixtures/mcft/water_state/replay_v1",',
    "    replay_root: replayRoot,",
    "S0_REPLAY_ROOT_PATCH",
)
preflight = replace_once(
    preflight,
    '    authorized_future_forcing_binding_ids: ["binding_weather", "binding_et0"],',
    '    authorized_future_forcing_binding_ids: ["weather_assumption_c8_replay_v1", "et0_future_assumption_c8_v1"],',
    "S0_FORCING_BINDING_PATCH",
)
preflight = replace_once(
    preflight,
    '''  fs.rmSync(absolute(TEMP_RUNNER_INPUT_PATH), { force: true });
  ok("completed MCFT-CAP-05 bounded eight-tick terminal chain is reproduced in isolated PostgreSQL");''',
    '''  fs.rmSync(absolute(TEMP_RUNNER_INPUT_PATH), { force: true });
  fs.rmSync(replayRoot, { recursive: true, force: true });
  ok("completed MCFT-CAP-05 bounded eight-tick terminal chain is reproduced in isolated PostgreSQL");''',
    "S0_REPLAY_CLEANUP_PATCH",
)

for required in [
    f'const BASELINE_MAIN = "{EFFECTIVE_MAIN}";',
    f'const P0_MERGE_COMMIT = "{HISTORICAL_P0}";',
    'import os from "node:os";',
    'import { semanticHashV1 }',
    "function buildS0HAuthoritativeReplayViewV1",
    "S0_PREDECESSOR_LEASE_CARDINALITY",
    "replay_root: replayRoot",
    '"weather_assumption_c8_replay_v1", "et0_future_assumption_c8_v1"',
]:
    if required not in preflight:
        raise SystemExit(f"S0_PREFLIGHT_REQUIRED_PATCH_MISSING:{required}")
PREFLIGHT.write_text(preflight)

gate = GATE.read_text()
gate = replace_once(
    gate,
    f'const baseline = "{HISTORICAL_P0}";',
    f'const baseline = "{EFFECTIVE_MAIN}";\nconst p0MergeCommit = "{HISTORICAL_P0}";',
    "S0_GATE_EFFECTIVE_BASELINE_PATCH",
)
gate = replace_once(
    gate,
    "p0.effectiveness.merge_commit === baseline",
    "p0.effectiveness.merge_commit === p0MergeCommit",
    "S0_GATE_P0_HISTORY_PATCH",
)
for required in [
    f'const baseline = "{EFFECTIVE_MAIN}";',
    f'const p0MergeCommit = "{HISTORICAL_P0}";',
    "p0.effectiveness.merge_commit === p0MergeCommit",
]:
    if required not in gate:
        raise SystemExit(f"S0_GATE_REQUIRED_PATCH_MISSING:{required}")
GATE.write_text(gate)
