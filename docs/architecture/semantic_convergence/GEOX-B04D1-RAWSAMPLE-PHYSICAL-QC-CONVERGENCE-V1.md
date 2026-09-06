# GEOX B-04d1 Raw-sample Physical-QC Convergence V1

## 0. Status and base

Status: **implementation candidate**

Exact stacked base:

```text
B-04c COMPLETE
fc2745df43c3641cc6ca1479fcb6c7268b01e41b
```

This phase is a correction discovered by the B-04c completion audit.

B-04b1–B-04b4 qualified the server telemetry and MQTT ingress family, but the repository also has a separate active raw-sample evidence plane:

```text
POST /api/v1/sensing/raw-samples
  -> appendRawSampleV1
  -> raw_samples
  -> buildAppleIIEvidenceSufficiencyV1
  -> field_sensing_summary_stage1_v1
  -> Stage-1 evidence gate
```

That plane was not yet consuming the shared B-04a physical-QC truth.

## 1. Defect

Before B-04d1, `appendRawSampleV1` required a finite numeric value but did not record shared physical QC.

Apple-II formal-evidence selection treated `device` and `gateway` source lanes as formal based primarily on source class.

Therefore a source sample could be:

```text
humidity = 102.7 %RH
source = device
finite numeric value = yes
```

and still contribute to:

```text
formal_sample_count
formal_coverage_ratio
formal_metric_lanes
trigger_metric_evidence
gap/freshness calculations
conflict calculations
```

even though the shared B-04a classifier would say:

```text
measurement_health = INVALID
physical_validity = FAIL
```

This is a parallel Evidence truth.

## 2. Ingress convergence

B-04d1 adds the existing shared snapshot to each new raw sample at append time:

```text
payload_json.ingress_physical_qc
facts.raw_sample_v1.payload.ingress_physical_qc
```

The snapshot is built by:

```text
buildIngressPhysicalQcSnapshotV1
  -> classifyPhysicalMeasurementV1
```

No new range table or raw-sample-specific physical truth engine is introduced.

Raw source value and unit remain unchanged.

## 3. Apple-II consumer convergence

Apple-II still applies its existing formal source policy, but source authority is no longer enough for newly classified samples.

For source-formal samples:

```text
source = device|gateway
        +
ingress physical QC = VALID/PASS
        ↓
formal Stage-1 evidence
```

If the shared physical-QC snapshot says:

```text
INVALID/FAIL
UNKNOWN
```

the sample is excluded from the formal evidence subset before Apple-II computes:

```text
formal coverage
formal sample count
formal metric lanes
trigger metric evidence
freshness/gaps
conflict state
```

Reason codes include:

```text
PHYSICAL_QC_INELIGIBLE_SAMPLE
PHYSICAL_QC_UNKNOWN_SAMPLE
```

when applicable.

## 4. Historical compatibility seam

Rows written before B-04d1 may not have `ingress_physical_qc`.

This bounded phase does not retroactively fabricate classification for them and does not rewrite historical evidence.

Such rows remain on an explicit code-level compatibility seam:

```text
LEGACY_UNCLASSIFIED
```

and retain historical Apple-II behavior until a later migration/quarantine step.

This compatibility is not evidence that those rows are canonically physically qualified.

## 5. Negative invariants

B-04d1 must preserve:

```text
raw source evidence retained
shared physical QC is the only physical classifier
invalid sample != deleted sample
invalid physical sample != formal Stage-1 evidence
unknown physical authority != qualified evidence
source=device alone != sufficient physical authority
```

No action-level Decision Eligibility verdict is created here.

## 6. Tests

Required fixtures:

```text
102.7 %RH raw sample
  -> raw sample retained
  -> ingress physical QC INVALID/FAIL

Apple-II sample set with one INVALID formal-source sample
  -> total sample_count retains source record
  -> formal_sample_count excludes invalid sample
  -> formal metric lane excludes invalid sample
  -> evidence_sufficiency NEEDS_EVIDENCE

legacy row without snapshot
  -> compatibility behavior retained explicitly
```

## 7. Non-effects

B-04d1 does not:

- modify MCFT;
- change crop/context authority;
- modify Agronomy Agent;
- rewire Evidence Judge;
- create Decision Eligibility;
- alter approval, AO-ACT, receipt or acceptance authority;
- delete historical raw_samples;
- infer temporal/source/spatial authority beyond existing Apple-II semantics;
- claim repository-wide Evidence Runtime convergence complete.

## 8. Completion gate

B-04d1 is COMPLETE only when one exact head proves:

```text
raw-sample ingress persists shared physical QC       PASS
102.7 %RH classified INVALID/FAIL                    PASS
Apple-II excludes physical INVALID samples           PASS
Apple-II excludes physical UNKNOWN samples           PASS
legacy compatibility seam tested                     PASS
B-04a/B-04b/B-04c regressions                        PASS
server typecheck                                     PASS
B-02 semantic linter                                 PASS
general CI                                           PASS
existing MCFT governance/release lanes               PASS
```

## 9. Next frontier

After B-04d1, B-04d should continue by projecting/consuming the remaining canonical qualification dimensions at the Stage-1 evidence boundary rather than introducing another aggregate truth engine.

The next audit must focus on:

```text
temporal eligibility
source authority
spatial authority
conflict state
role eligibility
```

and how Apple-II/Stage-1 map those dimensions onto the B-03 Evidence Qualification vocabulary.
