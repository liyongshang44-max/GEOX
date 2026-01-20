# 🍎 Apple II · Judge — Logic Rules v1
Doc ID: GEOX-AII-04
Status: FROZEN
Applies to: Apple II (Judge)

This document defines the deterministic trigger rules for each pipeline stage.
All thresholds must come from config (`config/judge/*.json`) or frozen constants.

## Stage-2: Evidence Sufficiency → INSUFFICIENT_EVIDENCE

Trigger (deterministic):
- `total_samples < sufficiency.min_total_samples`, OR
- for any `required_metrics[]`: `samples(metric).count < sufficiency.min_samples_per_required_metric`

Output constraints:
- `problem_type = INSUFFICIENT_EVIDENCE`
- `uncertainty_sources` includes:
  - `SPARSE_SAMPLING` when `total_samples` is insufficient
  - `MISSING_KEY_METRIC` when a required metric is insufficient
- `supporting_evidence_refs`: include at least one replayable ref (`qc_summary` or `ledger_slice`)

## Stage-3: Time Coverage → TIME_COVERAGE_GAPPY / WINDOW_NOT_SUPPORT

Trigger (deterministic):
- coverage gap or insufficient coverage ratio per `time_coverage.*` config, OR
- window shape is not supportable (e.g., single-point, extreme edge-only coverage)

Output constraints:
- `TIME_COVERAGE_GAPPY` emphasizes gaps/coverage ratio
- `WINDOW_NOT_SUPPORT` emphasizes window shape limitation
- `uncertainty_sources` includes `TIME_GAPS`
- `supporting_evidence_refs`: include replayable ref (`ledger_slice` or `qc_summary`)

## Stage-4: QC / Device Health → QC_CONTAMINATION / SENSOR_HEALTH_DEGRADED

Trigger (deterministic):
- `bad_pct >= qc.bad_pct_threshold` OR `suspect_pct >= qc.suspect_pct_threshold` in the window.

Output constraints:
- `problem_type` is one of `QC_CONTAMINATION` / `SENSOR_HEALTH_DEGRADED` (mapping is fixed in code)
- `uncertainty_sources` includes `QC_SUSPECT_OR_BAD` or `SENSOR_HEALTH_ISSUE`
- `supporting_evidence_refs`: include `qc_summary` (and optionally `ledger_slice`)

## Stage-5: Reference Assembly (optional)

- ReferenceViewV1 objects may be assembled for display and for Stage-6 conflict detection.
- ReferenceViewV1 must not enable cross-scale inference.

## Stage-6: Conflict Detection → EVIDENCE_CONFLICT / REFERENCE_CONFLICT

Trigger (deterministic):
- conflicts across sources/metrics within evidence, OR
- conflicts between evidence and reference view (when present)

Output constraints:
- `problem_type = EVIDENCE_CONFLICT` or `REFERENCE_CONFLICT`
- `uncertainty_sources` includes `MULTI_SOURCE_CONFLICT` (and/or `MULTI_METRIC_CONFLICT` when applicable)
- `supporting_evidence_refs`: include `ledger_slice`; include `reference_view` refs when reference conflict is involved

## Stage-7: Scale Policy → SCALE_POLICY_BLOCKED

Trigger (deterministic):
- the requested `{subjectRef, scale}` cannot be processed without cross-scale inference, OR
- scale is not supported by this judge runtime.

Output constraints:
- `problem_type = SCALE_POLICY_BLOCKED`
- `uncertainty_sources` includes `SCALE_POLICY_LIMITATION`
- `supporting_evidence_refs`: may be omitted; if reference views are included for display, they may be referenced.

## Stage-8: Exclusion Window / Marker → EXCLUSION_WINDOW_ACTIVE / MARKER_PRESENT

Trigger (deterministic):
- window contains markers/overlays whose kinds are in `marker.exclusion_kinds[]`.

Output constraints:
- `EXCLUSION_WINDOW_ACTIVE`: declares the window is degraded by exclusion policy
- `MARKER_PRESENT`: declares marker presence (non-strong)
- `uncertainty_sources` includes `EXCLUSION_WINDOW` or `MARKER_DEPENDENCY`
- `supporting_evidence_refs`: include a replayable marker/overlay slice (`ledger_slice`)
