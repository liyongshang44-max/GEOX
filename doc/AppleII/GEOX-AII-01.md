# 🍎 Apple II · Judge — ProblemStateV1 Schema
Doc ID: GEOX-AII-01
Status: READY TO FREEZE
Applies to: Apple II (Judge)

Depends on:
- GEOX-P0-00 SpatialUnit & Scale Policy (FROZEN)
- GEOX-P0-01 Evidence & QC Policy (FROZEN)
- GEOX-P0-02 StateVector Schema v1 (FROZEN)
- GEOX-AII-00-APP-A Enums & Constraints (Enum normative authority)

## Constitutional Statement (FROZEN)
ProblemStateV1 is the ONLY authoritative problem anchor output of Apple II.
It declares epistemic limitation only (insufficient/conflicting/suspect/blocked), and MUST NOT express risk, permission, recommendation, or diagnosis semantics.

All LBCandidate and AO-SENSE outputs MUST be derived from ProblemState and MUST NOT backflow.

## Enum Authority Rule (FROZEN)
- Normative enum source: GEOX-AII-00-APP-A
- JSON Schemas contain validation copies.
If any discrepancy exists, APP-A is authoritative and schemas MUST be synchronized before release (enum changes bump MINOR/MAJOR).

## StateVector Optionality Rule (FROZEN)
Apple II v1 may generate ProblemState from Evidence Ledger alone if StateVectorV1 is unavailable.
If StateVector is used, state_inputs_used MUST be populated with fields_used (replayability).

## Step1 Hooks (FROZEN)
The following fields are REQUIRED and MUST NOT be null; use "unknown" if undecidable:
- state_layer_hint: atomic | derived | memory | unknown
- rate_class_hint: fast | mid | slow | unknown
- problem_scope: sensor_point | spatial_unit | reference_view | unknown

## Machine Schema & Fixtures
- Schema: packages/contracts/problem_state_v1.schema.json
- Fixtures: fixtures/appleii/psv1_demo_001.json, psv1_demo_002.json, psv1_demo_003.json
