# GEOX B-04c Stage-1 Physical-QC Consumption Guard V1

## 0. Status and exact base

Status: **B-line B-04c implementation candidate**

Exact stacked base:

```text
B-04b COMPLETE
d262f912c2b60cc4bf627aac5a34f7d41d963634
```

B-04c closes the next Evidence Runtime defect:

```text
an observation can be retained for audit
without being eligible to become Stage-1 physical state
```

## 1. Exact-head defect

Before B-04c, the Stage-1 loader selected recent finite values from
`device_observation_index_v1` and excluded simulated/debug observations, but it did not inspect the B-04b ingress physical-QC snapshot.

Therefore a formally ingested row such as:

```text
air_humidity = 102.7 %RH
measurement_health = INVALID
physical_validity = FAIL
```

could remain in the append-only evidence record, which is correct, but could also still be mapped into Stage-1 sensing input merely because `value_num` was finite.

Likewise:

```text
air_temperature = 72 °F
compatibility projection = 72 °C
source physical-QC = UNKNOWN / UNIT_UNQUALIFIED
```

could remain finite in the compatibility index even though source measurement authority was not established.

B-04c separates these two concerns.

## 2. Formal Stage-1 eligibility rule

Current official ingress paths explicitly emit:

```text
formal_eligible = true
ingress_physical_qc.schema_version = ingress_physical_qc_snapshot_v1
```

For those observations, Stage-1 physical-state consumption is allowed only when:

```text
measurement_health = VALID
AND
physical_validity = PASS
```

Fail-closed cases:

```text
INVALID / FAIL    -> reject
UNKNOWN           -> reject
missing QC        -> reject
formal_eligible=false -> reject
```

The observation fact and compatibility projection remain auditable. B-04c only removes authority to enter Stage-1.

## 3. Legacy compatibility seam

The repository still contains historical/direct observation writers and acceptance fixtures that predate the explicit `formal_eligible` + ingress-QC contract.

B-04c does not silently relabel those records as physically qualified.

Instead the pure guard returns an explicit mode:

```text
LEGACY_COMPATIBILITY
```

for records where `formal_eligible` is absent.

This preserves current regression behavior while keeping the unresolved seam visible. It must not be cited as proof that legacy/unclassified records are physically qualified.

A later convergence phase may remove this compatibility seam once active legacy writers and fixtures are migrated.

## 4. Implementation

Pure authority decision:

```text
apps/server/src/evidence/stage1_physical_qc_consumption_guard_v1.ts
```

Stage-1 loader wiring:

```text
apps/server/src/services/device_observation_service_v1.ts
  loadRecentFieldObservationsForPipelineV1(...)
```

The loader now performs, in order:

```text
1. scope selection
2. simulated/debug exclusion
3. Stage-1 physical-QC eligibility
4. finite numeric compatibility check
5. Stage-1 metric mapping
```

For explicit formal observations, physical-QC is therefore checked before a finite compatibility value can become sensing input.

## 5. Tests

Pure decision fixtures prove:

```text
formal VALID/PASS              -> eligible
formal INVALID/FAIL            -> rejected
formal UNKNOWN                 -> rejected
formal missing ingress QC      -> rejected
formal_eligible=false          -> rejected
legacy unclassified            -> explicit compatibility seam
```

Service-level loader fixtures prove:

```text
formal PASS row survives
formal INVALID row is absent
formal UNKNOWN row is absent
formal missing-QC row is absent
legacy unclassified row remains only by compatibility
```

## 6. Explicit non-effects

B-04c does not:

- delete or mutate bad source evidence;
- rewrite B-04a physical bounds;
- change B-04b source-preserving snapshots;
- make UNKNOWN become INVALID;
- make INVALID evidence disappear from the ledger;
- change temporal/source/spatial/conflict qualification;
- change Evidence Judge or Agronomy Judge;
- change Agronomy Agent;
- create Decision Eligibility;
- change Approval/AO-ACT/Receipt/Acceptance authority;
- claim that legacy/unclassified observation writers are fully converged.

## 7. Completion gate

B-04c may be COMPLETE only when one exact head proves:

```text
formal VALID/PASS survives Stage-1 loader             PASS
formal INVALID/FAIL blocked before Stage-1            PASS
formal UNKNOWN blocked before Stage-1                 PASS
formal missing-QC blocked fail-closed                 PASS
bad evidence remains persisted/auditable              PASS
legacy compatibility seam explicitly tested          PASS
server typecheck                                      PASS
B-04a/B-04b regressions                               PASS
B-02 semantic linter                                  PASS
general CI                                            PASS
existing MCFT governance/release lanes                PASS
```

## 8. Next frontier

After B-04c qualification, the next decision should be based on repository audit rather than automatically expanding authority.

The known remaining seam is:

```text
legacy/unclassified direct observation writers
```

If that seam is production-relevant, the next bounded phase should migrate or quarantine it before any claim of repository-wide physical-state convergence.
