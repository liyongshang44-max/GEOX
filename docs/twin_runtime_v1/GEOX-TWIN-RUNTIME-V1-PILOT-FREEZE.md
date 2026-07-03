<!-- docs/twin_runtime_v1/GEOX-TWIN-RUNTIME-V1-PILOT-FREEZE.md -->

# P49 Twin Runtime v1 Pilot Freeze Evidence Package v0

## 0. Position

`P49 = TWIN_RUNTIME_V1_PILOT_FREEZE`.

P49 is not a new runtime capability. It is not a runtime service, demo runtime, device gateway, or production rollout. P49 is a governed evidence freeze package that reads the already-governed P37-P48 chain and decides whether `GEOX Production-Governed Digital Twin Runtime v1` can be claimed.

## 1. Baseline

```text
baseline_tag = p48_end_to_end_production_twin_pilot_closure_gate_v0_closure_boundary_errata_v0
baseline_commit = 9564ee212e59f6f2700e72a4ff620bfc04d264b9
```

This baseline includes the P48 boundary errata suffix. P49 must not derive from the pre-errata P48 closure tag.

## 2. Files

```text
docs/twin_runtime_v1/GEOX-TWIN-RUNTIME-V1-PILOT-FREEZE.md
docs/twin_runtime_v1/GEOX-TWIN-RUNTIME-V1-CAPABILITY-MATRIX.json
docs/twin_runtime_v1/GEOX-TWIN-RUNTIME-V1-E2E-EVIDENCE-PACKET.json
scripts/twin_runtime_v1/TWIN_RUNTIME_V1_E2E_ACCEPTANCE.cjs
```

Forbidden surfaces:

```text
apps/server/
apps/web/
apps/server/db/migrations/
.github/
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
```

## 3. Ten runtime questions

P49 answers these ten questions by evidence packet, not by creating new runtime behavior.

```text
Q1. evidence enters runtime cycle
Q2. state estimate generation claim
Q3. forecast generated
Q4. later evidence returns to runtime
Q5. forecast residual computed
Q6. offline calibration trial executed
Q7. parameter delta and candidate created
Q8. shadow model evaluated
Q9. active model governance activation recorded
Q10. next forecast active model consumption
```

Every capability row must include readback refs, source refs, policy refs, record-set hash, determinism hash, idempotency key, append-only proof, and no-forbidden-downstream proof.

## 4. Truth gates

Q2 is a hard truth gate. If the chain only proves `active_state_estimate_ref`, P49 must not claim a first-class `state_estimate_v1` generation engine.

Q10 is a hard truth gate. If the chain only proves activation observability or not-yet-consumed readback, P49 must not claim that a specific next forecast consumed the active model.

## 5. Result semantics

Allowed capability statuses:

```text
PASS
PASS_WITH_LIMITATIONS
BLOCKED
NOT_CLAIMED
```

Full runtime freeze is allowed only when all ten capabilities are `PASS`.

Current P49 result:

```text
freeze_result = PASS_WITH_LIMITATIONS
runtime_v1_freeze_allowed = false
```

Reason:

```text
Q2 = PASS_WITH_LIMITATIONS
Q10 = PASS_WITH_LIMITATIONS
hash_ref_boundary = governed_pointer_hash_refs_only
source_derived_digest_verification = not_performed
```

This package therefore freezes the evidence posture, but it does not claim the full `GEOX Production-Governed Digital Twin Runtime v1`.

Hash/ref boundary: matrix and packet hash fields are governed evidence references and deterministic package-level checks. They are not recomputed cryptographic digests of the upstream P37-P48 source artifact contents. Full Runtime v1 freeze would require source-derived digest verification across the upstream governed record sets.

## 6. Next line

Replay-backed Production Twin Demo Runtime is a separate future line. It must not be implemented inside P49.
