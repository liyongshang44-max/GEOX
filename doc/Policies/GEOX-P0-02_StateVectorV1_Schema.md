# GEOX-P0-02 · StateVector Schema v1
Status: FROZEN (external reference, not embedded)

Apple II may optionally consume StateVectorV1 from Apple I.
The full normative schema text may live elsewhere.

Guardrails:
1) StateVectorV1 is OPTIONAL for Apple II v1. Apple II must still operate from the Evidence Ledger alone.
2) If StateVectorV1 is used, Apple II must record which fields were used via ProblemStateV1.state_inputs_used[].
3) Apple II must not derive control/advice/risk from StateVectorV1.

If the full GEOX-P0-02 file is provided later, treat it as the single source of truth for validation and field names.
