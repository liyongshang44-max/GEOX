# GEOX B-04a Metric Catalog + Shared Physical QC V1

## 0. Status and exact base

Status: **B-line B-04a implementation candidate**

Stacked base:

```text
B-03 exact COMPLETE head
7174d143803ed3db8b956a2b076d3b747ee25a85
```

B-04a is the first bounded step of Evidence Runtime convergence. It introduces a shared physical-QC classifier but does not wire that classifier into ingress or consumers yet.

Repository-level SSOT remains `docs/SSOT.md`.
Sprint / Tag / Freeze authority remains `README_MIGRATION.md`.

---

## 1. Exact-head audit finding

The repository already has a telemetry metric catalog:

```text
packages/contracts/src/schema/telemetry_metric_catalog_v1.ts
```

It already defines canonical telemetry metrics, canonical/accepted units, and inclusive hard numeric bounds. B-04a therefore does **not** create a second set of metric bounds.

The shared classifier consumes that existing catalog as its metric/unit/hard-bound source.

The audit also found two important current-path facts:

1. `run_sensing_inference_pipeline_v1.ts` selects the latest finite numeric value from observation aliases but does not apply catalog physical-range qualification before derived sensing inference.
2. `device_observation_service_v1.ts` currently normalizes missing or invalid units to the catalog canonical unit before persisting `device_observation_v1`, while `DeviceObservationV1Schema` itself only requires a finite numeric value and a non-empty unit; it does not independently enforce catalog range/unit semantics.

These are B-04 convergence targets, not B-04a mutation targets.

B-04a records and tests the correct shared classifier semantics first. Ingress/consumer migration belongs to B-04b/B-04c.

---

## 2. Canonical hard-bound source

B-04a reuses:

```text
TELEMETRY_METRIC_CATALOG_V1
isTelemetryMetricNameV1
isValidTelemetryUnitV1
toCanonicalTelemetryMetricNameV1
```

No new hard ranges are invented in the classifier.

Examples already present in the catalog include:

```text
air_humidity      0..100 %RH
soil_moisture     0..100 %VWC
soil_ec           0..20 dS/m
soil_ph           0..14 pH
water_flow_rate   0..10000 L/min
water_pressure    0..1600 kPa
```

These are contract hard envelopes, not agronomic target ranges, stress thresholds, or crop-specific preferred ranges.

---

## 3. Shared physical-QC classifier

Implementation:

```text
apps/server/src/evidence/physical_qc_v1.ts
```

Primary function:

```text
classifyPhysicalMeasurementV1({ metric, value, unit })
```

Output contains only measurement-level classification:

```text
input_metric
canonical_metric | null
catalog_status
input_value
numeric_value | null
input_unit | null
canonical_unit | null
hard_min | null
hard_max | null
measurement_health
physical_validity
reason_codes
```

Normative distinction:

```text
Physical QC != Evidence Qualification != Decision Eligibility
```

The classifier never emits `PASS/BLOCK` action eligibility, approval, plan, task, or execution semantics.

---

## 4. Fail-closed epistemic behavior

### 4.1 Out-of-hard-range value

Example:

```text
metric = air_humidity
value = 102.7
unit = %RH
```

Result:

```text
measurement_health = INVALID
physical_validity = FAIL
reason = PHYSICAL_QC_ABOVE_HARD_MAX
```

The raw value remains the raw value. B-04a does not clamp `102.7` to `100` and does not delete it.

### 4.2 Missing value

```text
value = null
```

Result:

```text
numeric_value = null
measurement_health = UNKNOWN
physical_validity = UNKNOWN
reason = PHYSICAL_QC_MISSING_VALUE
```

No default number is fabricated.

### 4.3 Missing or unqualified unit

B-04a does not silently assume a canonical unit.

```text
missing unit
-> UNKNOWN / PHYSICAL_QC_UNIT_REQUIRED

unrecognized unit
-> UNKNOWN / PHYSICAL_QC_UNIT_UNQUALIFIED
```

No unit conversion is guessed.

### 4.4 Unsupported metric

An unregistered metric receives no invented physical envelope:

```text
catalog_status = UNSUPPORTED_METRIC
physical_validity = NOT_APPLICABLE
```

Adding a new metric requires an explicit catalog change rather than an ad-hoc local rule.

---

## 5. Why the classifier does not reuse current DeviceObservation normalization behavior

Current `device_observation_service_v1.ts` contains compatibility normalization that can replace a missing or invalid incoming unit with the catalog canonical unit.

That behavior may be historically required for compatibility, but it is not suitable as future Evidence authority because it erases the distinction between:

```text
source actually supplied a qualified unit
```

and

```text
runtime filled in a convenient unit
```

B-04a therefore preserves the supplied unit and returns `UNKNOWN` when unit authority is insufficient.

B-04b will determine how this classifier is introduced at ingress while preserving existing compatibility acceptance where required.

---

## 6. Fixtures

Tests:

```text
apps/server/src/evidence/physical_qc_v1.test.ts
```

Fixtures cover:

```text
RH 102.7% -> INVALID / FAIL
RH 100% inclusive boundary -> VALID / PASS
soil moisture 100.1 %VWC -> INVALID / FAIL
missing value -> UNKNOWN, no fallback
Infinity -> INVALID / FAIL
missing unit -> UNKNOWN, no canonical-unit fabrication
unqualified Fahrenheit input for Celsius metric -> UNKNOWN, no guessed conversion
unsupported metric -> NOT_APPLICABLE, no invented bounds
negative flow -> INVALID / FAIL under the existing catalog envelope
```

---

## 7. Explicit non-effects

B-04a does not:

- modify `TELEMETRY_METRIC_CATALOG_V1` ranges or aliases;
- alter raw telemetry ingestion;
- alter `device_observation_service_v1.ts` compatibility normalization;
- alter database schemas or persisted facts;
- filter or delete observations;
- alter Stage-1 latest-finite selection;
- alter derived sensing state computation;
- alter Stage-1 formal gates;
- alter Evidence Judge or Agronomy Judge;
- alter Agronomy Agent;
- alter MCFT Evidence/State/Forecast/Scenario semantics;
- activate ADR or an LLM;
- create Decision Eligibility;
- create Approval, AO-ACT, Receipt, or Acceptance authority.

---

## 8. B-04a completion gate

B-04a may be COMPLETE only when one exact head proves:

```text
existing telemetry catalog reused               PASS
no duplicate physical hard-bound catalog        PASS
shared pure physical-QC classifier               PASS
RH 102.7 invalid fixture                         PASS
impossible soil-moisture fixture                 PASS
missing value non-fabrication                    PASS
missing/unqualified unit remains unknown         PASS
unsupported metric remains unclassified          PASS
no action-level verdict emitted                  PASS
server typecheck                                 PASS
B-04a fixtures                                   PASS
B-02 semantic linter                             PASS
exact-head general CI                            PASS
existing MCFT governance/release lanes           PASS
runtime ingress rewiring                         NONE
Stage-1/Judge rewiring                           NONE
MCFT semantic mutation                           NONE
```

---

## 9. Next frontier after B-04a

Only after exact-head completion:

```text
B-04b — ingress qualification integration
```

B-04b must preserve raw evidence while attaching physical-QC authority and must not silently convert invalid measurements into clean sensing/state truth.

B-04c remains the later consumer guard that prevents `OUTLIER / INELIGIBLE / MISSING` observations from silently passing through current latest-finite selection.
