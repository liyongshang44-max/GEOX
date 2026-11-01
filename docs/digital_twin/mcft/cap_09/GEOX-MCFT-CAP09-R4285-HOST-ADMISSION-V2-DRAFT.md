# R4285 Host Admission V2 — successor engineering contract (draft)

State: IMPLEMENTATION IN PROGRESS / NO PERMIT / NO PHYSICAL EXECUTION.
Baseline protected main: 12ae85febf1f0afb8d761abb0cb83dda96d734d3. Historical V1, 180-minute Plan and the three 1000ms delay values are untouched.

## Sequencing
CTO native preauthorization intent is separate from actual execution approval and must be made before physical Resource Owner observation. Intent is a live, unedited GitHub OWNER comment bound to the exact Run, Subject, Host, Nonce, Plan, Observations, FirstBase, Material/Release and explicit PG/S3 resource scope.
A separately verified stable Native Adoption capability may be held in the same Node process with a bounded expiry; a JSON or static PASS cannot impersonate it.
After human waiting ends, an independent fresh Windows resource readback is measured, then the real signed Owner, real V1 Permit (including its 13 exact bindings), and Ed25519 final execution approval are issued. Final approval binds the exact Permit, original Owner Envelope, original raw Readback and CTO intent.
The immutable Owner observed_at must be within 120000 ms at consumption. A refreshed readback invalidates the existing Permit. CTO native comment revocation/edit/deletion/expiration must fail closed when checked live again. PG/S3, main identity, material integrity, Trust and 120s time budget must be revalidated before one-time burn.

## Important current implementation limit
The versioned verification primitive and contract tests are implemented, but there is deliberately NO V2 Host execution entrypoint. The operational rendezvous for signing and consumption and the stable-proof drift/remote revocation checks require further bounded work. No execution path may be wired until a real Windows non-authorized continuous timing test and code-level negative tests prove these claims.
Do not call an intent structural inspection or a signed final approval execution authorization without their live WeakSet-gated provenance.

## Release gates
New Subject and Material qualification after merge; applicable QCP; real Windows Host, real PG/S3 read-only checks; negative tests for changed readback, expired owner, nonce reuse, modified material, GitHub deletion and competing consumes. No old signature automatically transfers.