# scripts/remediation/APPLY_MCFT_CAP_05_OUTCOME_OBSERVATION_REPLAY_VIEW.py
# Purpose: include the frozen CAP-05 exact 03:00 outcome Observation in the temporary H-authoritative Replay view used by the formal PostgreSQL runner regression.
# Boundary: acceptance-source transformation only; no repository fixture mutation, production Evidence selection change, residual-policy relaxation, database access, canonical write, calibration, Model Activation, or CAP-06 authority.

from pathlib import Path


PATH = Path("scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_POST_CLOSURE_POSTGRESQL_RUNNER.ts")
OLD = '''  assert.ok(removedLegacyIrrigation >= 1, "LEGACY_IRRIGATION_EXCLUSION_NOT_PROVEN");
  assert.ok(normalizedObservation >= 1, "LEGACY_OBSERVATION_NORMALIZATION_NOT_PROVEN");
  return target;'''
NEW = '''  assert.ok(removedLegacyIrrigation >= 1, "LEGACY_IRRIGATION_EXCLUSION_NOT_PROVEN");
  assert.ok(normalizedObservation >= 1, "LEGACY_OBSERVATION_NORMALIZATION_NOT_PROVEN");

  const outcomeObservationPath = path.join(
    ROOT,
    "fixtures/mcft/water_state/feedback_v1/soil_observations.jsonl",
  );
  const outcomeRecords = fs.readFileSync(outcomeObservationPath, "utf8")
    .split(String.fromCharCode(10))
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, any>);
  assert.equal(outcomeRecords.length, 1, "CAP05_OUTCOME_OBSERVATION_CARDINALITY");
  const outcomeObservation = structuredClone(outcomeRecords[0]);
  assert.equal(outcomeObservation.record_type, "soil_moisture_observation_v1");
  assert.equal(outcomeObservation.role_time.observed_at, "2026-06-04T03:00:00.000Z");
  assert.equal(outcomeObservation.available_to_runtime_at, "2026-06-04T03:00:00.000Z");
  outcomeObservation.canonical_payload = {
    ...outcomeObservation.canonical_payload,
    quantity_kind: "VOLUMETRIC_WATER_CONTENT",
  };
  outcomeObservation.source_payload = {
    ...outcomeObservation.source_payload,
    source_version: String(outcomeObservation.source_version ?? "1"),
  };
  const outcomeSemantic = structuredClone(outcomeObservation);
  delete outcomeSemantic.source_record_hash;
  delete outcomeSemantic.materialized_file_location;
  outcomeObservation.source_record_hash = semanticHashV1(outcomeSemantic);
  const outcomeTarget = path.join(target, "soil_moisture", "2026-06-04.jsonl");
  fs.appendFileSync(outcomeTarget, `${JSON.stringify(outcomeObservation)}\\n`, "utf8");
  return target;'''

text = PATH.read_text()
if NEW in text:
    raise SystemExit(0)
if text.count(OLD) != 1:
    raise SystemExit(f"OUTCOME_OBSERVATION_REPLAY_VIEW_MARKER_COUNT:{text.count(OLD)}")
PATH.write_text(text.replace(OLD, NEW, 1))
