# GEOX B-04b1 Ingress Physical-QC Annotation V1

## 0. Status and exact base

Status: **B-line B-04b1 implementation candidate**

Exact stacked base:

```text
B-04a COMPLETE
3ceb9ec68c947624bde2d547bf5ce9f55c22f796
```

B-04b1 is a bounded subphase of B-04b. It attaches B-04a physical-QC classification to the existing device-observation ingress fact without changing current Stage-1 consumption behavior.

B-04b is **not complete** at B-04b1 exit.

---

## 1. Exact-head ingress audit

Current official telemetry path is:

```text
ingestTelemetryV1
  -> raw_telemetry_v1 fact
  -> writeObservationRunPipelineAndRefreshFieldV1
  -> writeDeviceObservationFactV1
  -> device_observation_v1 fact/index
  -> current Stage-1 pipeline
```

Two authority-loss hazards were confirmed before mutation.

### 1.1 Compatibility unit substitution

`device_observation_service_v1.ts` currently converts a missing or unrecognized incoming unit for a catalogued metric into the catalog canonical unit before writing `device_observation_v1`.

Example:

```text
source:
air_temperature = 72 °F

legacy compatibility observation:
air_temperature = 72 °C
```

B-04b1 does not remove that compatibility behavior because doing so may break existing consumers. Instead it records the source metric/value/unit and physical-QC result **before** compatibility normalization.

Therefore the future authority path can distinguish:

```text
source_unit = °F
physical_qc = UNKNOWN / UNIT_UNQUALIFIED
```

from the legacy compatibility projection that still contains `°C`.

### 1.2 Invalid numeric values currently remain consumable

A physically impossible but finite value such as:

```text
air_humidity = 102.7 %RH
```

can currently be persisted in the legacy observation index and can later enter latest-finite Stage-1 selection because Stage-1 does not yet consume B-04a physical QC.

B-04b1 records the invalidation at ingress but deliberately does not alter that consumer behavior. The consumer guard belongs to B-04c.

---

## 2. New ingress snapshot

Implementation:

```text
apps/server/src/evidence/ingress_physical_qc_snapshot_v1.ts
```

Typed snapshot:

```text
IngressPhysicalQcSnapshotV1

schema_version
source_fact_id
source_metric
source_value
source_unit
physical_qc
```

`physical_qc` is produced only by the B-04a shared classifier.

The snapshot is intentionally **not** named `EvidenceQualificationV1` because B-04b1 has not yet established temporal, source, spatial, conflict, or role authority. It records one bounded qualification dimension only: hard measurement physical QC.

---

## 3. Observation ingress integration

`writeDeviceObservationFactV1` now computes the ingress snapshot before compatibility normalization:

```text
raw source metric/value/unit
        ↓
buildIngressPhysicalQcSnapshotV1
        ↓
source-preserving physical_qc snapshot
        ↓
legacy compatibility normalization
        ↓
device_observation_v1
```

The resulting observation fact gains additive payload metadata:

```text
payload.ingress_physical_qc
```

No existing `DeviceObservationV1Schema` field is removed or retyped.
No existing observation-index column is changed.

This is intentional: B-04b1 adds authority evidence without prematurely forcing legacy consumers onto the new contract.

---

## 4. Required degraded-data behavior

### 4.1 RH 102.7%

The observation remains append-only and auditable:

```text
payload.value = 102.7
```

while the attached source-facing QC says:

```text
measurement_health = INVALID
physical_validity = FAIL
reason = PHYSICAL_QC_ABOVE_HARD_MAX
```

B-04b1 does not clamp the value and does not emit action-level `BLOCK`.

### 4.2 Unqualified source unit

For:

```text
air_temperature = 72 °F
```

legacy compatibility behavior currently remains:

```text
payload.value = 72
payload.unit = °C
```

but the new snapshot preserves:

```text
source_value = 72
source_unit = °F
physical_qc.input_unit = °F
physical_qc.canonical_unit = °C
measurement_health = UNKNOWN
physical_validity = UNKNOWN
reason = PHYSICAL_QC_UNIT_UNQUALIFIED
```

This prevents future authority code from mistaking compatibility normalization for source truth.

---

## 5. Known remaining B-04b blocker: missing/non-numeric raw retention

B-04b1 does **not** claim full ingress convergence.

Current `ingestTelemetryV1` opens one transaction, inserts `raw_telemetry_v1`, then calls `writeDeviceObservationFactV1` before COMMIT. `writeDeviceObservationFactV1` still throws `DEVICE_OBSERVATION_VALUE_NOT_NUMERIC` for null/non-numeric measurements.

Therefore a null/non-numeric source payload can still cause the transaction to roll back the raw fact.

This is incompatible with the target invariant:

```text
bad/missing evidence is retained
while authority is removed/narrowed
```

It must be repaired in a separately qualified B-04b2 step rather than hidden inside this annotation PR, because changing raw-ingest transaction durability affects failure atomicity and public ingest behavior.

B-04b1 exit status must therefore be:

```text
numeric ingress physical-QC annotation = COMPLETE candidate
B-04b overall = ACTIVE / NOT COMPLETE
```

---

## 6. Tests

New fixtures:

```text
apps/server/src/evidence/ingress_physical_qc_snapshot_v1.test.ts
apps/server/src/services/device_observation_ingress_physical_qc_v1.test.ts
```

They prove:

```text
RH 102.7 source value retained exactly
RH 102.7 classified INVALID / FAIL
source fact provenance retained
source metric/unit retained before compatibility normalization
legacy index write remains active
unqualified °F source remains visible even though compatibility payload becomes °C
missing source value remains missing in the pure ingress snapshot
no Decision Eligibility/action verdict is introduced
```

---

## 7. Explicit non-effects

B-04b1 does not:

- reject or delete finite out-of-range raw evidence;
- change `TELEMETRY_METRIC_CATALOG_V1`;
- change `DeviceObservationV1Schema`;
- add a database migration or index column;
- change current compatibility unit normalization;
- fix null/non-numeric raw transaction rollback yet;
- make Stage-1 consume physical-QC metadata;
- filter latest-finite observations;
- alter Evidence Judge or Agronomy Judge;
- alter Agronomy Agent;
- alter MCFT semantics;
- create full `EvidenceQualificationV1` runtime authority;
- create Decision Eligibility;
- alter Approval/AO-ACT/Receipt/Acceptance.

---

## 8. B-04b1 completion gate

B-04b1 may be complete only when one exact head proves:

```text
source metric/value/unit preserved before normalization     PASS
B-04a classifier reused                                    PASS
RH 102.7 retained + INVALID/FAIL                            PASS
unqualified source unit remains visible                    PASS
legacy DeviceObservation compatibility remains green       PASS
no Stage-1 consumption change                              PASS
no Decision Eligibility/action verdict                     PASS
server typecheck                                            PASS
ingress snapshot fixtures                                  PASS
observation persistence fixtures                            PASS
B-02 semantic linter                                       PASS
exact-head general CI                                      PASS
existing MCFT governance/release lanes                     PASS
```

B-04b remains ACTIVE after this gate because raw missing/non-numeric durability is unresolved.

---

## 9. Next bounded step

After B-04b1 exact-head qualification:

```text
B-04b2 — durable raw ingress for missing/non-numeric measurements
```

B-04b2 must prove that source evidence can survive a downstream observation-projection failure without fabricating a numeric observation or silently entering Stage-1.
