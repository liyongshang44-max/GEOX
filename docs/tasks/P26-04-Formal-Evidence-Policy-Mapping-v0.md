# docs/tasks/P26-04-Formal-Evidence-Policy-Mapping-v0.md

Defines P26 formal evidence policy mapping.

P26 requires formal evidence for formal PASS and formal FAIL. Receipt presence, operation plan terminal status, sim traces, flight-table artifacts, and dev artifacts do not count as formal evidence. P26 checks evidence metadata and formal eligibility only; it does not parse image, video, log, or binary content.

Acceptance:

- node scripts/governance_acceptance/P26_04_FORMAL_EVIDENCE_POLICY_MAPPING_ACCEPTANCE.cjs
