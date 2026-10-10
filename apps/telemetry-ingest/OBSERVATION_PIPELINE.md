# Telemetry Observation Pipeline (v1)

## Pipeline contract

```text
MQTT source payload
  -> raw_telemetry_v1 (source metric/value/unit preserved)
  -> shared device_observation_service_v1
  -> ingress_physical_qc snapshot
  -> compatibility device_observation_v1
  -> sensing pipeline
```

- `raw_telemetry_v1` is the ingress evidence layer for audit/replay.
- The MQTT transport adapter must not invent a canonical unit or convert transport convenience into measurement authority.
- Metric/unit canonicalization and physical QC belong to the shared observation/evidence runtime.
- Dashboard / agronomy / business reads must not consume raw telemetry directly as qualified state.
- Heartbeats are device transport/runtime evidence and do not enter the physical measurement observation pipeline.

## Source-preserving ingress

The MQTT adapter forwards the source-supplied:

- `metric`
- `value`
- `unit`
- event time
- source fact id
- tenant/project/group/device/field scope

to `apps/server/src/services/device_observation_service_v1.ts`.

The shared writer records `payload.ingress_physical_qc` before legacy compatibility normalization. This preserves the distinction between source truth and compatibility projection.

Example:

```text
source: 72 °F
physical QC: UNKNOWN / UNIT_UNQUALIFIED
legacy compatibility projection may still expose the canonical unit
```

The source unit must remain auditable even when compatibility behavior is retained temporarily.

## Write-layer ownership

Observation ingest writes must go through:

```text
apps/server/src/services/device_observation_service_v1.ts
```

The service owns:

- append-only `device_observation_v1` facts;
- observation idempotency;
- B-04b source-preserving physical-QC annotation;
- compatibility metric/unit normalization;
- observation projection;
- official sensing pipeline/read-model refresh.

The MQTT adapter owns transport authentication, raw source capture, and forwarding of source semantics. It does not own measurement validity or Decision Eligibility.
