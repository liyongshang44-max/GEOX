# GEOX B-04b4 MQTT Runtime Durability V1

## Status and base

Status: implementation candidate.

Exact stacked base:

```text
B-04b3 COMPLETE
133ef85a74a9e5f22172387803633e1b6077c0cf
```

B-04b4 closes the two production edges left by the B-04b3 audit.

## 1. Runtime packaging defect

Before B-04b4:

```text
@geox/telemetry-ingest build = no-op
commercial compose command = node apps/telemetry-ingest/dist/main.js
```

No build step created that artifact.

B-04b4 changes the package build from a no-op to a real TypeScript validation and changes the commercial runtime command to the image-local `tsx` executable against the checked source entrypoint.

The commercial image build now also builds the compile prerequisites required by the telemetry-ingest source graph.

## 2. Durable degraded MQTT payloads

The dedicated MQTT service owns its own database transaction.

Before B-04b4:

```text
raw_telemetry_v1 fact
  -> numeric observation projection
  -> DEVICE_OBSERVATION_VALUE_NOT_NUMERIC
  -> outer ROLLBACK
  -> raw source evidence lost
```

B-04b4 introduces one narrow partial-commit rule.

If and only if the shared observation writer rejects the source with:

```text
DEVICE_OBSERVATION_VALUE_NOT_NUMERIC
```

then the MQTT service:

```text
1. COMMITs the already-authenticated raw_telemetry_v1 fact
2. creates no numeric observation
3. does not refresh the agronomy snapshot
4. logs durable_raw_projection_rejected
5. reports degraded status in --once mode
6. does not execute an outer rollback after that commit
```

Any unrelated downstream failure remains rethrown to the outer transaction owner and is rolled back.

## 3. Tested transaction boundary

The helper:

```text
apps/telemetry-ingest/src/mqtt_durable_raw_v1.ts
```

owns only the narrow durable-raw exception.

Fixtures prove:

```text
non-numeric projection rejection -> COMMIT
successful projection -> no independent COMMIT
unrelated failure -> rethrow, no partial COMMIT
```

## 4. Evidence semantics

B-04b4 does not convert degraded telemetry into a valid observation.

Normative rule:

```text
source receipt truth may survive
measurement authority may still fail
```

This is required for replay and audit.

## 5. Explicit non-effects

B-04b4 does not:

- change B-04a hard physical bounds;
- widen B-04b1 measurement authority;
- change successful observation semantics;
- create null-valued DeviceObservation records;
- change Stage-1 consumption rules;
- change Evidence Judge or Agronomy Judge;
- change Agronomy Agent;
- change MCFT semantics;
- create Decision Eligibility;
- alter Approval, AO-ACT, Receipt, or Acceptance authority.

## 6. Completion gate

B-04b4 may be COMPLETE only when one exact head proves:

```text
telemetry-ingest build is not a no-op                 PASS
commercial runtime entrypoint exists in built image   PASS
telemetry-ingest typecheck                            PASS
MQTT durable-raw fixtures                             PASS
MQTT source-preserving fixtures                       PASS
B-04a/B-04b1/B-04b2 regressions                       PASS
B-02 semantic linter                                  PASS
general CI                                            PASS
existing MCFT governance/release lanes                PASS
```

If all gates pass, B-04b may be declared COMPLETE.

Only then may B-04c Stage-1 consumption guard start.
