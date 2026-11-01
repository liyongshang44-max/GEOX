# R4285 Host Admission V2 — successor engineering contract (draft)

State: IMPLEMENTATION IN PROGRESS / NO PERMIT / NO PHYSICAL EXECUTION.
Baseline protected main: 12ae85febf1f0afb8d761abb0cb83dda96d734d3. Historical V1, 180-minute Plan and the three 1000ms delay values are untouched.

## Sequencing
CTO native preauthorization intent is separate from actual execution approval and must be made before physical Resource Owner observation. Intent is a live, unedited GitHub OWNER comment bound to the exact Run, Subject, Host, Nonce, Plan, Observations, FirstBase, Material/Release and explicit PG/S3 resource scope.
A separately verified stable Native Adoption capability may be held in the same Node process with a bounded expiry; a JSON or static PASS cannot impersonate it.
After human waiting ends, an independent fresh Windows resource readback is measured, then the real signed Owner, real V1 Permit (including its 13 exact bindings), and Ed25519 final execution approval are issued. Final approval binds the exact Permit, original Owner Envelope, original raw Readback and CTO intent.
The immutable Owner observed_at must be within 120000 ms at consumption. A refreshed readback invalidates the existing Permit. CTO native comment revocation/edit/deletion/expiration must fail closed when checked live again. PG/S3, main identity, material integrity, Trust and 120s time budget must be revalidated before one-time burn.

## Actual V2 Host implementation (not yet qualified)

A callable Windows Node entrypoint now exists at `scripts/runtime_acceptance/MCFT_CAP09_R4285_WINDOWS_HOST_V2.cjs`, with three explicit modes:

```powershell
$HostV2 = 'D:\gptdown\<CURRENT-INSTALLED-RELEASE>\scripts\runtime_acceptance\MCFT_CAP09_R4285_WINDOWS_HOST_V2.cjs'
node $HostV2 --readiness-only --input 'D:\gptdown\<V2-READINESS-INPUT>.json'
# Only after separate real signatures and formal authorization:
# node $HostV2 --preflight-only --input 'D:\gptdown\<V2-SIGNED-INPUT>.json'
# --execute is forbidden by current CTO decision; do not run.
```

`--readiness-only` checks Native Adoption, exact approved Plan, delay design and live GitHub CTO intent without Permit or consumption. It is **not** the signed Preflight. The signed `--preflight-only` checks genuine Owner/Permit/Ed25519 final approval and actual read-only PG/S3, but does not consume anything. A separately authorized `--execute` path performs the same authenticated admission, an early scientific selfcheck, V2-only atomic Run/Nonce consumption and the original six-stage Scheduler using a dedicated V2 parent capability compatible with the unchanged V1 child ticket verification. There is no signer or issuer in this entrypoint.

The exact six-stage timeouts are frozen at `3600000,1800000,1800000,1800000,1200000,600000` ms; the Permit remaining-time check derives its **10800000 ms** from the actual signed Plan with original Scheduler validation, not caller-supplied budget. Provider, promotion and readback interventions must each equal 1000ms. Before irreversible V2 Permit consumption, the complete installed Material and tool identity are reverified read-only; all their latency counts against the unchanged Owner 120-second window.

### Non-negotiable unresolved gates
1. This source has **not** passed real operator Windows continuous 120-second timing. It has not issued or consumed a Permit and has executed **0/6** physical stages.
2. The current original Native Adoption consumer is specifically QCP71-bound. The successor source requires a valid, separately versioned QCP72/Subject/Material/Adoption qualification (and corresponding signed evidence) before the V2 Host can be treated as physically admissible. A current QCP72 technical PASS is not an original V1 Native Admission PASS and cannot be substituted as one.
3. The Owner-to-signer-to-Permit-to-final-approval file rendezvous, true concurrent atomic consume tests and Windows source/material-drift and GitHub revocation tests still require native proof. Do not claim positive physical readiness from source graph or synthetic CI alone.
4. No old V1 signature carries to the new Subject. Any real signing, TEST_ONLY Permit and execute require their own independent CTO grants; failure is fail-closed without automatic retry.

Do not call an intent structural inspection or a signed final approval execution authorization without real live provenance.

## Release gates
New Subject and Material qualification after merge; applicable QCP; real Windows Host, real PG/S3 read-only checks; negative tests for changed readback, expired owner, nonce reuse, modified material, GitHub deletion and competing consumes. No old signature automatically transfers.