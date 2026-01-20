# Apple III v0 · AO-SENSE (Sprint 2 Addendum: marker_v1 evidence)

This addendum freezes the Sprint 2 evidence policy update for Apple III v0.

1) Purpose
- Upgrade Receipt.evidence_refs from placeholder fact_id to a real, replayable new evidence object.
- Keep boundaries intact: no agronomy, no value judgement, no guarantee that Judge output changes.

2) Evidence policy (Sprint 2)
- Receipt.evidence_refs MUST reference at least one new evidence item.
- Sprint 2 freezes the preferred evidence kind to: marker_v1.
- The marker MUST be an append-only fact written through the existing POST /api/marker path.
- MarkerKind allowlist is frozen by contracts (currently: device_fault | local_anomaly).

3) Acceptance requirement update
- ACCEPTANCE_APPLEIII_AOSENSE.ps1 MUST create a marker_v1 and reference it in AO_SENSE_RECEIPT.evidence_refs as:
  { kind: "marker_v1", ref_id: "<marker_fact_id>" }
- Second Judge run remains non-regression only (no requirement on problem_state reduction).