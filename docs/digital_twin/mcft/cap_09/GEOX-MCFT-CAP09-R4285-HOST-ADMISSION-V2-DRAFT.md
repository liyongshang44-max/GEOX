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

## Native V4 and independent Owner — real same-process rendezvous

The supported new modes are `--session-preflight-only` and `--session-execute` in `MCFT_CAP09_R4285_WINDOWS_HOST_V2.cjs`. The old direct `--execute` command now fails closed. `--readiness-only` still has a different result type and never transports an authorization capability to another process.

Session input: all original V2 full signed Host fields plus `nonce` and `resource_scope_sha256` (two exact 64-character lowercase SHA256-style values). Inputs include the preexisting Native Adoption input, signed CTO intent file/comment ID, Plan, Observations and future paths for raw Resource Owner Readback, signed Owner Envelope, actual signed V2 Permit, and final V2 Ed25519 execution approval. All paths absolute. All four future Owner/Permit/final files MUST NOT exist when the session begins; they are never overwritten or removed.

After successful REAL Windows Native V4/QCP72/complete Material qualification, a valid live GitHub CTO preauthorization intent and exact Plan/Observations check, the Host retains the non-serializable Native and stable-proof capabilities in the SAME Node process. It emits `WAIT_REAL_WINDOWS_OWNER_PRODUCER_NOT_PREFLIGHT` with the physical Owner-not-before instant, and waits. The real external independent Owner Producer must then publish its original readback. Real signers separately publish the signed Owner Envelope, V2 Permit, and V2 final approval. The Host does NOT fabricate or run the Producer, create signatures, or issue a Permit. File presence alone is not authorization; all raw bytes and Ed25519 bindings are verified afterward.

The Owner `observed_at` MUST be at or after the in-process Native+CTO readiness gate, must be unmodified, and may not be older than 120000ms at any dynamic check or atomic consumption. Stale/replaced Owner, mismatched Subject/Nonce/scope, drifted pre-Owner signed input, expired stable proof/CTO comment, or missing signatures fails closed with no retry. The signed Host admission uses the same Native WeakSet proof instead of redoing the serial Native Material scan AFTER Owner. It still does full concurrent SHA256 for all 24673 material files and all tool hashes, actual PG/S3 read-only probes, live CTO refetch and final Permit/Owner validity checks before irreversible burn.

Operator command only AFTER a new legal signed V4 installed release is available (not authorized at present):

```powershell
node 'D:\<QUALIFIED_V2_RELEASE>\scripts\runtime_acceptance\MCFT_CAP09_R4285_WINDOWS_HOST_V2.cjs' --session-preflight-only --input 'D:\<SESSION_INPUT>.json'
```

`--session-execute` is a separate future explicitly authorized action and is FORBIDDEN under current CTO disposition. The existing independent Owner Producer and signers are external dependencies and are not reconstructed in this PR. No historical V1 subject, signature or Permit is upgraded. Windows owner-observed-to-consumption continuous timing is still HOLD; this source integration is not a physical admission PASS.
## Release gates
New Subject and Material qualification after merge; applicable QCP; real Windows Host, real PG/S3 read-only checks; negative tests for changed readback, expired owner, nonce reuse, modified material, GitHub deletion and competing consumes. No old signature automatically transfers.