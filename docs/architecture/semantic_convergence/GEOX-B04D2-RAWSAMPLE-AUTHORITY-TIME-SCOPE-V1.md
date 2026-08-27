# GEOX B-04d2 Raw-sample Authority / Time / Scope Convergence V1

## 0. Status and exact base

Status: **implementation candidate**

Exact stacked base:

```text
B-04d1 COMPLETE
668a685c2e1ca3bfe33fa1fa45f54d5c74fbaa73
```

B-04d2 addresses four independent authority promotions found while auditing the active `raw_samples -> Apple-II -> Stage-1` path after physical-QC convergence.

## 1. Source authority

Pre-B-04d2, raw-sample source normalization defaulted an absent or unrecognized source to:

```text
device
```

That was unsafe because the route's pre-normalization formal guards could see an absent source and skip formal-device checks, while the persisted item could later be normalized to `device` and enter the formal observation path.

B-04d2 freezes:

```text
missing/unrecognized source -> unknown
unknown != device
unknown != gateway
unknown -> not formal-source eligible
```

The raw sample remains append-only evidence.

## 2. Measurement-quality non-promotion

Pre-B-04d2, `qc_quality=unknown` was projected to observation quality flag `OK`.

B-04d2 prohibits:

```text
UNKNOWN -> OK
BAD -> formal observation
```

Mapping:

```text
ok      -> OK              -> observation pipeline eligible
suspect -> SUSPECT         -> compatibility observation pipeline eligible
bad     -> OUTLIER         -> observation pipeline ineligible
unknown -> MISSING_CONTEXT -> observation pipeline ineligible
```

Apple-II applies the same bounded quality decision before a source-formal raw sample may enter the formal evidence subset.

`SUSPECT` remains explicit and is not upgraded to `OK`. Later full EvidenceQualification convergence may narrow its role authority further.

## 3. Project / field scope authority

The Apple-II raw-sample query previously constrained tenant, optional group, field and device but did not constrain project.

B-04d2 adds project scope whenever `project_id` is supplied.

The device-health lookup is also changed from a broad tenant+device-first lookup to one scope-preserving query using the available:

```text
tenant
project
group
field
device
```

A status row from another project/group/field must not satisfy the current Stage-1 evidence request.

## 4. Runtime availability / point-in-time authority

`raw_samples.ts_ms` is event time.

`raw_samples.created_at` is repository/runtime availability evidence.

B-04d2 adds:

```text
created_at <= decision_time(now_ms)
```

to the Apple-II raw-sample query.

This prevents a sample backfilled after a historical decision time from being used to explain that earlier decision.

Device-health evidence is similarly bounded by:

```text
updated_ts_ms IS NOT NULL
updated_ts_ms <= decision_time(now_ms)
```

Because `device_status_index_v1` is a latest-state projection rather than a history table, a current row newer than the requested historical decision time is treated as unavailable. B-04d2 does not fabricate a historical device-health row.

## 5. Separation of source authority from evidence eligibility

`formal_source_eligible` remains a source-lane statement.

B-04d2 therefore distinguishes:

```text
sourceFormalSamples
qualityEligibleSamples
physicalQcEligible formalSamples
```

A physical or quality rejection does not become falsely labeled `NON_FORMAL_SAMPLE_SOURCE`.

Total sample count still preserves all returned source evidence.

## 6. Explicit non-effects

B-04d2 does not:

- modify MCFT;
- alter crop-stage/context authority;
- modify Agronomy Agent;
- rewire Evidence Judge;
- create Decision Eligibility;
- change approval/AO-ACT/receipt/acceptance authority;
- delete or rewrite historical raw samples;
- invent historical device status;
- establish full B-03 `EvidenceQualificationV1` runtime projection yet.

## 7. Completion gate

B-04d2 is COMPLETE only when one exact head proves:

```text
missing source remains unknown                         PASS
unrecognized source remains unknown                    PASS
unknown source cannot become formal raw evidence       PASS
unknown caller QC does not become OK                   PASS
bad caller QC does not enter formal observation path   PASS
Apple-II formal subset excludes unknown/bad QC         PASS
Apple-II query enforces project scope                  PASS
raw sample created_at is decision-time bounded         PASS
device-health scope is project/group/field bounded     PASS
device-health updated_ts_ms is decision-time bounded   PASS
B-04a/b/c/d1 regressions                               PASS
B-02 linter                                            PASS
general CI                                             PASS
existing MCFT governance/release lanes                 PASS
```

## 8. Next frontier

After B-04d2, B-04d should move from ad-hoc aggregate fields toward an explicit projection/consumption adapter for the B-03 evidence qualification vocabulary:

```text
physical validity
temporal eligibility
source authority
spatial authority
conflict state
role eligibility
```

The next step must not create a second qualification engine. It should project already-established dimensions into the canonical contract and make Stage-1 consume them.
