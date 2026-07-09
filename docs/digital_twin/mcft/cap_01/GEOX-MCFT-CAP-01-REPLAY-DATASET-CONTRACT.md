<!-- docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-REPLAY-DATASET-CONTRACT.md -->
# MCFT-CAP-01 S1 Canonical Replay Dataset Contract

```text
delivery_slice_id: MCFT-CAP-01.MCFT-01.CANONICAL-REPLAY-DATASET-V1
primary_owner_work_package_id: MCFT-01
status: COMPLETE
claim: NO_RUNTIME_IMPLEMENTATION
```

The dataset covers `[2026-06-01T00:00:00.000Z, 2026-07-01T00:00:00.000Z)` as 720 UTC hourly intervals. Interval records are sharded by interval-start date. JSON objects use sorted keys, arrays preserve semantic order, text is UTF-8 without BOM, lines use LF, and every JSONL file has one trailing newline.

Each source record contains a common provenance/scope/time envelope and a role-specific `source_payload` plus `canonical_payload`. Scalar fields are required only for scalar roles. Snapshot, plan, and execution records keep structured payloads.

Role classification instants are:

```text
SOIL_MOISTURE_OBSERVATION      observed_at
RAINFALL_OBSERVATION           interval_end
HISTORICAL_ET0_INPUT           interval_end
FUTURE_WEATHER_ASSUMPTION      issued_at
FUTURE_ET0_ASSUMPTION          issued_at
APPROVED_IRRIGATION_PLAN       approved_at
IRRIGATION_EXECUTION_EVIDENCE  executed_at
```

Role availability derivation remains the exact MCFT-00 rule. In particular, an approved plan uses `MAX(approved_at, ingested_at)`; its effective window is domain payload and not availability authority. Future assumptions use `MAX(issued_at, retrieved_at, ingested_at)`.

A future assumption point's `valid_from` is a forecast horizon and does not make the containing snapshot FUTURE Evidence. Snapshot availability is independently derived from issued/retrieved/ingested times.

The deterministic generator fixes all role formulas, event schedules, ordering, quality values, and limitations. No wall clock, randomness, network, database, file mtime, checkout path, process ID, or branch name may affect bytes.

Completion evidence is recorded in `GEOX-MCFT-CAP-01-DELIVERY-SLICE-STATUS.json`. Completion establishes the governed Replay Dataset only; it does not establish Runtime execution.
