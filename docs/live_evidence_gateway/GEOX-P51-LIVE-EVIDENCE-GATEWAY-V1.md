# GEOX P51 Live Evidence Gateway v1

P51 is a controlled gateway-path proof derived from `p50_replay_backed_production_twin_demo_runtime_v0_closure`.

It proves that simulated device-source packets can move through a standards-aligned gateway evidence contract and become GEOX-compatible evidence envelopes without touching production ingest surfaces.

## Position

P51 is a live-gateway-path proof. It is not a real-live-device proof.

The device source is simulated. The gateway path is treated as live-like because the runner resolves device packets, timestamps, metric/unit normalization, gateway evidence IDs, and downstream-compatible envelopes through deterministic controlled execution.

## Scope

Allowed:

- SenML packet fixture parsing.
- SensorThings-style observation projection.
- SOSA-style semantic mapping.
- GEOX `RawSampleFactEnvelopeV1` compatibility envelope generation.
- GEOX `DeviceObservationV1` compatibility envelope generation.
- Viewer-ready gateway snapshot generation.
- Real negative fixture files for malformed input, unsupported units, unresolved relative time, and boundary leaks.

Disallowed:

- Production MQTT ingest changes.
- Server route changes.
- Database migration changes.
- Web/frontend changes.
- Runtime Health v1.
- Field Pilot.
- AO-ACT.
- ROI.
- Field Memory.

## Boundary

P51 must not call the existing production telemetry app or `/api/v1/sensing/raw-samples` route. Current production surfaces can write facts and refresh read models, so P51 uses a controlled runner instead.

P51 sensor health envelope is device evidence health only. It is not Runtime Health v1 and must not produce fleet health, operator alerts, or reliability scores.

## Acceptance

Run:

```powershell
node scripts\live_evidence_gateway\P51_LIVE_EVIDENCE_GATEWAY_ACCEPTANCE.cjs
```

Expected result:

```text
ok = true
failed_assertion_count = 0
```
