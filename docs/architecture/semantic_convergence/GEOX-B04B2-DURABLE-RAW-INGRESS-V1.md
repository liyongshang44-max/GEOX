# GEOX B-04b2 Durable Raw Ingress V1

## 0. Status and exact base

Status: **B-line B-04b2 implementation candidate**

Exact stacked base:

```text
B-04b1 COMPLETE
32b1a635dfc4be1bb0012d7d90ac7e188868e406
```

B-04b2 repairs one bounded Evidence Runtime invariant:

```text
bad/missing source evidence must remain auditable
even when the legacy numeric observation projection cannot represent it
```

It does not authorize Stage-1 consumption changes.

---

## 1. Exact-head defect

Before B-04b2, `ingestTelemetryV1` used one transaction for:

```text
BEGIN
  raw_telemetry_v1 fact
  telemetry_index_v1
  device_status_index_v1
  device_observation_v1
  Stage-1 pipeline/read-model refresh
COMMIT
```

`writeDeviceObservationFactV1` requires a finite numeric value and throws:

```text
DEVICE_OBSERVATION_VALUE_NOT_NUMERIC
```

for null or non-numeric source payloads.

Because that exception occurred before the enclosing COMMIT, the old outer catch executed ROLLBACK. The source evidence disappeared together with the failed projection.

That behavior violates the target evidence invariant. A failed interpretation/projection must not erase the fact that the source delivered a payload.

---

## 2. B-04b2 transaction rule

B-04b2 introduces one narrow durable-raw exception.

When and only when downstream observation projection fails with:

```text
DEVICE_OBSERVATION_VALUE_NOT_NUMERIC
```

the ingest service now:

```text
1. preserves raw_telemetry_v1 exactly
2. preserves telemetry_index_v1 with value_num = null
3. preserves device receipt/status update
4. COMMITs those source-facing records
5. creates no device_observation_v1
6. enters no Stage-1 sensing pipeline
7. rethrows the original projection error
```

Caller-visible failure semantics therefore remain unchanged.

The source evidence becomes durable; the system does not pretend that a numeric observation exists.

---

## 3. Why the error is rethrown

B-04b2 does not redefine missing/non-numeric telemetry as a successful canonical observation.

Returning a normal `TelemetryIngressResultV1` would be false because that result contract requires:

```text
observation.fact_id
observation.occurred_at_iso
```

No observation exists in this case.

Therefore B-04b2 preserves the existing error:

```text
DEVICE_OBSERVATION_VALUE_NOT_NUMERIC
```

after durable source commit.

This keeps API/caller semantics conservative while separating source durability from projection eligibility.

---

## 4. Narrow failure class

B-04b2 does **not** convert every downstream error into partial commit.

For unrelated failures such as:

```text
database write failure
contract violation unrelated to non-numeric source value
pipeline failure
read-model refresh failure
unexpected runtime exception
```

the transaction keeps the historical all-or-nothing rollback behavior.

Normative rule:

```text
source-representation failure due to missing/non-numeric value
  -> durable raw commit + projection failure

all other downstream failures
  -> rollback
```

This avoids silently weakening transaction atomicity beyond the evidence-retention defect being repaired.

---

## 5. Evidence semantics

### 5.1 Missing source value

Example:

```text
metric = soil_moisture
value = null
unit = %VWC
```

Durable records:

```text
raw_telemetry_v1.payload.value = null
telemetry_index_v1.value_num = null
telemetry_index_v1.value_text = null
```

Not created:

```text
device_observation_v1
Stage-1 state
Decision Eligibility
```

### 5.2 Non-numeric source text

Example:

```text
metric = air_humidity
value = sensor_error
unit = %RH
```

Durable records:

```text
raw source value = "sensor_error"
telemetry_index_v1.value_num = null
telemetry_index_v1.value_text = "sensor_error"
```

Again, no numeric observation is fabricated.

---

## 6. Device health is still not measurement health

B-04b2 intentionally retains the device receipt/status update.

The meaning is only:

```text
a payload was received from this device at this time
```

It does **not** mean:

```text
the measurement is physically valid
the measurement is qualified
the evidence is sufficient
the field state is known
```

This preserves the B-line authority separation:

```text
Device Transport Health != Measurement Health
```

---

## 7. Tests

New fixtures:

```text
apps/server/src/services/telemetry_ingest_durable_raw_v1.test.ts
```

They prove:

```text
null telemetry -> raw commit, no rollback, no observation
non-numeric source text -> exact source retention, raw commit, no observation
original DEVICE_OBSERVATION_VALUE_NOT_NUMERIC remains caller-visible
telemetry index keeps null numeric value without fabrication
unrelated downstream failure still rolls back
```

---

## 8. Explicit non-effects

B-04b2 does not:

- change the successful telemetry ingress response contract;
- classify missing/non-numeric values as valid observations;
- create a null-valued `DeviceObservationV1`;
- alter `DeviceObservationV1Schema`;
- change B-04a physical hard bounds;
- change B-04b1 source-preserving QC annotation;
- make Stage-1 consume physical-QC metadata;
- alter latest-finite selection;
- alter Evidence Judge or Agronomy Judge;
- alter Agronomy Agent;
- alter MCFT semantics;
- create Decision Eligibility;
- alter Approval, AO-ACT, Receipt, or Acceptance authority;
- turn unrelated downstream errors into partial commits.

---

## 9. B-04b2 completion gate

B-04b2 may be COMPLETE only when one exact head proves:

```text
null source telemetry retained after projection failure       PASS
non-numeric source text retained exactly                      PASS
telemetry_index numeric value remains null                    PASS
no numeric observation fabricated                             PASS
no Stage-1 entry for rejected projection                      PASS
caller-visible projection failure preserved                   PASS
unrelated downstream failure still rolls back                 PASS
server typecheck                                               PASS
B-04b2 durability fixtures                                    PASS
B-04a physical QC fixtures                                    PASS
B-04b1 ingress fixtures                                       PASS
B-02 semantic linter                                          PASS
exact-head general CI                                         PASS
existing MCFT governance/release lanes                        PASS
```

If this gate passes, B-04b may be declared COMPLETE.

---

## 10. Next frontier

Only after B-04b2 exact-head qualification:

```text
B-04c — Stage-1 consumption guard
```

B-04c must ensure that current latest-finite selection cannot silently consume observations whose ingress physical-QC authority is `INVALID`, `UNKNOWN`, or otherwise not eligible for the requested physical-state role.
