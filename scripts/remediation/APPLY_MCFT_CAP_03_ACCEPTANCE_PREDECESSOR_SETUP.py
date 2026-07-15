# scripts/remediation/APPLY_MCFT_CAP_03_ACCEPTANCE_PREDECESSOR_SETUP.py
# Purpose: correct the CAP-03 persistence acceptance setup so the frozen CAP-02 sequence-24 handoff is seeded explicitly instead of committing a high-sequence CAP-02 continuation directly after A0.
# Boundary: acceptance-source transformation only; no production repository, Runtime, transaction, validator, persistence schema, canonical object, or capability authority change.

from pathlib import Path


PATH = Path("scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_PERSISTENCE_RECOVERY_DB.ts")


def replace_once(text: str, old: str, new: str) -> str:
    if new and new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"CAP03_ACCEPTANCE_PATCH_MARKER_COUNT:{count}:{old[:120]}")
    return text.replace(old, new, 1)


text = PATH.read_text()
text = replace_once(
    text,
    "// Purpose: prove the CAP-03 PostgreSQL A2 path atomically persists, reads back, idempotently replays, rebuilds, and uniqueness-guards one assimilated record set while preserving inherited historical CAP-02 behavior.",
    "// Purpose: prove the CAP-03 PostgreSQL A2 path atomically persists, reads back, idempotently replays, rebuilds, and uniqueness-guards one assimilated record set from an explicitly seeded frozen CAP-02 sequence-24 handoff.",
)
text = replace_once(
    text,
    '''  const a0Lineage = memberV1(fixture.a0RecordSet, "twin_runtime_lineage_v1");
  const a0State = memberV1(fixture.a0RecordSet, "twin_state_estimate_v1");
  const a0Checkpoint = memberV1(fixture.a0RecordSet, "twin_runtime_checkpoint_v1");
  const a0Forecast = memberV1(fixture.a0RecordSet, "twin_forecast_run_v1");
  const cap02Expected: ContinuationExpectedPointersV1 = {
    active_lineage_ref: a0Lineage.object_id,
    lineage_id: fixture.lock.lineage_id,
    revision_id: fixture.lock.revision_id,
    previous_checkpoint_ref: a0Checkpoint.object_id,
    previous_state_ref: a0State.object_id,
    previous_forecast_result_ref: a0Forecast.object_id,
    latest_successful_forecast_ref: null,
  };

''',
    "",
)
text = replace_once(
    text,
    '''    await repository.commitRuntimeConfig(fixture.continuationRuntimeConfig);
    const cap02Lease = await acquireLeaseV1(scope);
    const cap02Commit = await repository.commitContinuationState({
      scope,
      lease: cap02Lease,
      expected: cap02Expected,
      record_set: fixture.continuationRecordSet,
    });
    assert.equal(cap02Commit.status, "INSERTED");
    const historicalReadback = await repository.readContinuationRecordSet(
      fixture.continuationRecordSet.continuation_record_set_id,
    );
    assert.ok(historicalReadback);
    assert.equal(
      historicalReadback.continuation_record_set_determinism_hash,
      fixture.continuationRecordSet.continuation_record_set_determinism_hash,
    );
    ok("historical CAP-02 A2 commit and canonical readback remain unchanged");

    await repository.commitRuntimeConfig(fixture.assimilatedRuntimeConfig);
    await seedCap02FinalHandoffV1({''',
    '''    await repository.commitRuntimeConfig(fixture.continuationRuntimeConfig);
    await seedCap02FinalHandoffV1({''',
)
text = replace_once(
    text,
    '''    ok("canonical pointers reproduce the frozen CAP-02 sequence-24 handoff");

    const faultStages =''',
    '''    ok("frozen CAP-02 sequence-24 handoff is materialized as explicit predecessor fixture state");

    await repository.commitRuntimeConfig(fixture.assimilatedRuntimeConfig);

    const faultStages =''',
)
PATH.write_text(text)
