# GEOX-P0-00 · SpatialUnit & Scale Policy
Status: FROZEN (external reference, not embedded in this packet)

Apple II documents depend on GEOX-P0-00. The full normative policy text is not included here.

Mandatory implementation guardrails:
- Treat Scale Policy as an external frozen constraint. Do not redesign or extend it.
- Apple II outputs MUST be anchored to exactly one SpatialUnit via subjectRef.
- Cross-scale inference is NOT allowed in Apple II. Any detected cross-scale attempt MUST emit problem_type=SCALE_POLICY_BLOCKED.
- Current supported scale in this codebase is "group". If other scales are introduced later, they MUST be added via the frozen policy, not by inference.
