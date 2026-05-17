# Observation Pipeline Noise Backlog V1

## Context

In Formal Irrigation acceptance logs, repeated non-blocking errors are observed:

- `fertility_inference_v1 failed`
- `DERIVED_SENSING_STATE_PAYLOAD_CONTRACT_VIOLATION`

For the P0.6 Formal Irrigation scenario, primary decision dependencies are irrigation-relevant signals (for example water-flow / sensor-quality related evidence lanes), not fertility inference outputs.

---

## P0.6 classification

### Backlog item: non-relevant skill failure noise

`fertility_inference_v1` failure during Formal Irrigation is classified as a **non-relevant skill failure** for this scenario.

### Blocking status

- This item is **NOT blocking** for P0.6 close-out.
- No verdict logic change is required in this task.

### Acceptance boundary

- Non-relevant skill failures must **not** determine or flip Formal Irrigation acceptance verdict.
- Formal Irrigation pass/fail must continue to be governed by irrigation-chain evidence and formal acceptance criteria.

---

## Governance directions (post P0.6)

The following actions are planned as backlog governance items:

1. **Scenario relevance isolation for skills**
   - Execute/score skills by scenario relevance profile.
   - Avoid emitting hard-failure semantics for skills outside scenario dependency set.

2. **Downgrade irrelevant skill failures to warnings**
   - Non-relevant skill failures should be recorded as warning/diagnostic signals.
   - Preserve observability without polluting blocking-error channels.

3. **Fertility state schema compatibility hardening**
   - Patch `fertility_state` schema/contract compatibility path.
   - Remove known `DERIVED_SENSING_STATE_PAYLOAD_CONTRACT_VIOLATION` mismatch source.

4. **Observation pipeline relevance labeling**
   - Output should explicitly classify skill outcomes as `relevant` vs `irrelevant` per scenario.
   - Enable cleaner triage and deterministic gate behavior.

---

## Explicit non-goals in this task

- No change to Formal Irrigation acceptance verdict logic.
- No immediate fix to fertility inference business logic.
- No change to P0.6 gate pass criteria.

---

## Acceptance alignment

This backlog entry explicitly confirms:

- The issue is documented.
- It is non-blocking for P0.6.
- Governance follow-up path is defined.
- Irrelevant skill failures must not block irrigation scenario verdicts.
