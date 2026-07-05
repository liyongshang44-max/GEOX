# R1 Runtime Evidence Stream Readiness

## Phase

R1 Runtime Evidence Stream Readiness / R1 运行证据流准备度.

## Purpose

R1 defines and gates the minimum continuous evidence stream needed by the twin runtime before R2 Online State Estimation Loop.

R1 answers what evidence arrives, from which source, with what timestamp semantics, with what identity, through what replay path, with what freshness model, and with what invalid / missing / delayed / duplicate behavior.

R1 is runtime evidence contract plus readiness acceptance. R1 is not state estimation. R1 is not forecast. R1 is not control loop.

## Preconditions

F0-B Frontend Productization Freeze Declaration is complete. The frontend baseline is frozen. Runtime readiness begins here.

R1 follows F0-B and precedes R2 Online State Estimation Loop.

## Non-goals

R1 does not implement recommendation. R1 does not implement dispatch. R1 does not implement AO-ACT. R1 does not implement ROI. R1 does not implement Field Memory. R1 does not implement model update. R1 does not implement automatic state estimation. R1 does not implement forecast calibration. R1 does not start field pilot execution. R1 makes no live production claim unless a separate live stream exists and is verified.

R1 must not introduce a recommendation writer, dispatch writer, AO-ACT task creator, ROI ledger writer, Field Memory writer, model update path, or autonomous operation path.

R1 must not describe replay-backed evidence as live runtime evidence.

## Evidence Stream Contract

R1 defines the contract-level evidence stream substrate required by the twin runtime.

The contract is semantic. It does not require an immediate DB schema migration. Existing facts, raw samples, source lineage, trace readback, and replay artifacts are registered as source substrate where applicable.

The evidence stream contract must define evidence unit, evidence kinds, source identity, subject identity, timestamp semantics, replay path, freshness model, invalid evidence behavior, missing evidence behavior, delayed evidence behavior, duplicate evidence behavior, state eligibility boundary, readiness summary, Nonclaims, and R2 handoff.

## Evidence Unit

The minimum evidence unit includes:

```text
evidence_id
evidence_kind
source_ref
subject_ref
tenant_id
project_id
field_id or group_id
occurred_at
observed_at
ingested_at
payload_ref or raw_payload_ref
quality_flags
replay_ref
provenance_ref
```

R1 does not require the current DB schema to equal this shape. R1 requires the runtime readiness contract to preserve these semantics.

Evidence without stable identity or timestamp semantics may be stored or replayed, but it must not be treated as state-eligible evidence.

## Evidence Kinds

R1 accepts or registers these evidence kind categories:

```text
sensor_sample
weather_sample
operator_observation
device_event
gateway_ingestion_event
replay_sample
trace_readback_event
```

Each kind must be classified as one of:

```text
real_observed
replay_backed
derived_readback
manual_observation
gateway_event
```

`replay_sample` is not a live device sample. `trace_readback_event` is not real-time monitoring. `gateway_ingestion_event` is not proof that a production gateway is available.

Future evidence kinds may be registered, but they require source identity, subject identity, timestamp semantics, freshness semantics, and a readiness acceptance update.

## Source Identity

R1 source identity contains:

```text
source_type
source_id
source_name
source_version
source_location or source_scope
source_trust_level
source_mode
```

Recommended `source_mode` values:

```text
replay
simulated
manual
gateway_demo
live_candidate
live_verified
```

Only `live_verified` may support live runtime claims. `replay`, `simulated`, and `gateway_demo` modes may not support production-live claims.

A source that lacks stable source identity can be stored for inspection or replay, but it is not state-eligible.

## Subject Identity

R1 subject identity contains:

```text
tenant_id
project_id
field_id
group_id
sensor_id or device_id
zone_id if available
season_id if available
```

Evidence without stable subject identity cannot enter online state estimation. Evidence with incomplete subject identity may be stored or replayed, but must be marked `not_state_eligible`.

Subject identity must remain stable across replay. A replay path may add `replayed_at`, but it must not mutate subject identity.

## Timestamp Semantics

R1 distinguishes these timestamps:

```text
occurred_at
observed_at
ingested_at
available_at
replayed_at
```

`occurred_at` is the time the real-world or replayed event claims to have occurred.

`observed_at` is the time a source observed or measured the event.

`ingested_at` is the time GEOX ingested the evidence into the runtime substrate.

`available_at` is the time the evidence became available for runtime read models.

`replayed_at` is the time replay machinery emitted or reconstructed the evidence for acceptance or runtime simulation.

State estimation windows use `occurred_at` / `observed_at`. Freshness uses `ingested_at` or `available_at`. Replay equivalence must preserve `occurred_at` and source identity while allowing `replayed_at` to differ.

## Replay Path

R1 replay path is a runtime readiness validation mechanism, not a demo UI.

The replay path must define:

```text
replay_source
replay_window
replay_subject_scope
replay_ordering
replay_clock
replay_output
replay_equivalence
replay_equivalence_hash or deterministic summary
```

Replay requirements:

```text
same input window produces same evidence summary
occurred_at remains stable
source identity remains stable
subject identity remains stable
quality flags remain stable
freshness evaluation is deterministic under fixed as_of
```

Replay-backed evidence stream readiness does not prove live device deployment, production gateway availability, or continuous runtime monitoring.

## Freshness Model

R1 freshness dimensions:

```text
last_evidence_at
last_ingested_at
expected_interval_ms
allowed_lateness_ms
max_staleness_ms
coverage_window_ms
coverage_ratio
freshness_status
```

R1 freshness status values:

```text
fresh
late
stale
missing
invalid
unknown
replay_only
```

Freshness rules:

- fresh: evidence arrived within expected interval and allowed lateness.
- late: evidence arrived but exceeds allowed lateness.
- stale: last evidence is older than max_staleness.
- missing: required evidence is absent in the coverage window.
- invalid: evidence exists but fails validation.
- unknown: source metadata is insufficient.
- replay_only: evidence is replay-backed and cannot support live claim.

Freshness status cannot imply live device connected, production gateway online, runtime monitoring active, or field pilot active unless source_mode is `live_verified` and a separate live-readiness contract exists.

## Invalid Evidence Behavior

Invalid evidence includes:

```text
missing required identity
missing timestamp
timestamp impossible
duplicate without duplicate policy
payload parse failure
source not recognized
subject not recognized
out-of-window evidence
contract kind not accepted
```

Invalid evidence behavior:

```text
do not silently accept invalid evidence
do not use invalid evidence for state estimation
record invalid reason in readiness summary
preserve raw/source reference if available
do not mutate evidence into valid form
```

## Missing Evidence Behavior

Missing evidence includes:

```text
no evidence in required window
required source absent
required subject absent
required metric absent
coverage below minimum
```

Missing evidence behavior:

```text
mark freshness_status = missing
mark state_eligible = false
do not fabricate samples
do not backfill with simulated values unless marked replay/simulated
do not produce recommendation
```

## Delayed Evidence Behavior

Delayed evidence includes:

```text
evidence arrives after allowed_lateness_ms
out-of-order event arrives after current as_of
late replay packet appears after deterministic window
```

Delayed evidence behavior:

```text
mark freshness_status = late
preserve original occurred_at
record ingested_at
do not rewrite prior state unless R2 defines re-estimation policy
do not treat late evidence as live monitoring success
```

## Duplicate Evidence Behavior

Duplicate evidence behavior:

```text
same source_id + subject_ref + occurred_at + payload hash may be duplicate
duplicates should not inflate coverage
duplicates should be counted or flagged deterministically
duplicate policy must be replay-stable
```

Duplicates may be preserved for audit, but they must not inflate freshness coverage or state eligibility.

## State Eligibility Boundary

R1 defines whether evidence may enter R2 state estimation.

Recommended fields:

```text
state_eligible: true | false
state_ineligible_reason
```

Evidence may be state-eligible only if it has recognized source, stable subject identity, valid `occurred_at` / `observed_at`, accepted evidence kind, freshness not missing/invalid, payload or payload_ref available, and replay/source provenance available.

Evidence is not state-eligible when it is replay_only while R2 requires live evidence, missing identity, invalid timestamp, unrecognized source, raw debug payload, manual note without measurement semantics, or gateway demo event without measurement payload.

R1 does not estimate state. R1 provides evidence eligibility boundary for R2.

## Readiness Summary

R1 readiness summary shape:

```json
{
  "ok": true,
  "runtime_readiness": "R1_RUNTIME_EVIDENCE_STREAM_READINESS",
  "stream": {
    "mode": "replay_backed_or_contract_only",
    "live_claim": false,
    "sources": [],
    "subjects": [],
    "window": {
      "start": null,
      "end": null,
      "as_of": null
    },
    "freshness": {
      "status": "replay_only",
      "last_evidence_at": null,
      "last_ingested_at": null,
      "expected_interval_ms": null,
      "allowed_lateness_ms": null,
      "max_staleness_ms": null,
      "coverage_ratio": null
    },
    "invalid": [],
    "missing": [],
    "delayed": [],
    "duplicates": [],
    "state_eligible": false
  },
  "nonclaims": {
    "live_device_connected": false,
    "production_gateway_online": false,
    "continuous_runtime_monitoring_active": false,
    "field_pilot_started": false,
    "ao_act_dispatch_enabled": false,
    "roi_computed": false,
    "field_memory_learning": false
  }
}
```

R1 does not require a runtime endpoint. R1 defines the acceptance-checkable summary contract.

## Acceptance

```powershell
node scripts/runtime_acceptance/ACCEPTANCE_R1_RUNTIME_EVIDENCE_STREAM_READINESS_V1.cjs
pnpm run typecheck:web
pnpm run build:web
git status --short
```

R1 acceptance is static repo read-only unless a later implementation PR explicitly changes scope. It does not require frontend startup, backend startup, DB write, facts write, AO-ACT write, ROI write, Field Memory write, Docker, server startup, web startup, or backend API.

## Nonclaims

R1 has no recommendation. R1 has no dispatch. R1 has no AO-ACT. R1 has no ROI. R1 has no Field Memory. R1 has no model update. R1 has no live production claim.

R1 does not claim live device deployment. R1 does not claim production gateway online. R1 does not claim continuous runtime monitoring active. R1 does not claim field pilot started. R1 does not claim autonomous field operations. R1 does not claim online state estimation.

## R2 Handoff

R2 Online State Estimation Loop follows R1.

R1 does not estimate state. R1 provides evidence eligibility boundary for R2. R2 is responsible for state object, estimate cadence, input evidence window, confidence / uncertainty, missing data behavior, replay equivalence, state read model, and state freshness.

R1 only provides evidence substrate and eligibility boundary.
