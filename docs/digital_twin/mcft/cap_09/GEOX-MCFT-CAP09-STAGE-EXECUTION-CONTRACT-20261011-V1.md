# MCFT CAP-09 — Single-use stage execution contract (engineering candidate)
Date: 2026-10-11
Scope: PR #3692, pre-merge engineering. This document is not a runtime authorization.

## Execution state machine
1. Independently adopted trust and a freshly signed, exact-main Ed25519 permit are required. Current repository trust remains `adopted=false`, `execution_enabled=false`. The default is EXECUTE_HOLD.
2. The parent validates source, isolation, historical bytes, review and timing. Before any child or Provider side effect, it must atomically consume the permit nonce and new run ID; consumption is irreversible even after an error.
3. The parent generates an ephemeral Ed25519 signing key after consuming the independent permit. Only the public key is persisted; the signing key remains in parent memory. A stage ticket binds stage ID, parent PID, original permit digest, run/nonce, script SHA-256, previous receipt SHA-256 and expiry. Only one ticket of each stage ID may exist.
4. The child validates its exact parent, ticket Ed25519 signature, script digest, predecessor success and receipt hash. It atomically burns `SPENT_<STAGE>` and writes an immutable claim BEFORE any qualifications, database connections or Provider effects.
5. The parent supervisor records exit code, termination signal, timeout/tree-kill outcome, stdout/stderr SHA-256, expected artifact SHA-256, and child claim SHA-256. An exit code of zero with no valid child claim or missing expected artifact is FAIL.
6. Before issuing each successor ticket, the parent verifies the immediate predecessor has a COMPLETE, hash-matching PASS receipt. A FAIL, interrupted process or existing stage reservation cannot resume automatically.

## Current boundaries and deliberate holds
* Signed permit and stage authority primitives have engineering-only synthetic tests on GitHub-hosted Windows and Linux runners; these tests do not authorize a live run.
* The existing `GOVERNED_RETRY_HOST` stage plan covers Producer, Timing 1/2/3 and aggregation. The stage-capability primitive also reserves a controlled-delay ID. These are NOT yet a fully unified adopted six-stage schedule. The host still blocks live Execute before launching Producer because the real controlled-delay controller has not been adopted.
* The legacy aggregator constructs a delay matrix but explicitly reports `controlled_delay_matrix_executed=false`. This is NOT real controlled-delay evidence. No retained qualification database may be used as a destructive test fixture.
* No independent production/governance signer has been enrolled. No real run, Producer requests, Timing samples, controlled-delay measurements, or formal-v5 activation are authorized by this candidate.
* The immutable first failed run and frozen 108-path runtime boundary cannot be rewritten.
* Separate governance activation, Windows operator-host preflight, exact-main post-merge readback, fresh isolated resources and real non-destructive delay verification are required before Execute.

## Candidate acceptance matrix
| Scenario | Expected |
| --- | --- |
| Wrong run, nonce, stage, source SHA, parent PID or ticket Ed25519 signature | FAIL before child effects |
| Concurrent children presenting the same stage ticket | Exactly one atomic claim, others FAIL |
| Parent attempts stage issuance after predecessor FAIL | FAIL before creating a successor ticket |
| Child exits zero and creates output without consuming ticket | FAIL, immutable stage receipt with `claim_valid=false` |
| Child consumes ticket but omits required output | FAIL and halt |
| Interrupted/expired attempt | Permanent burn, no retry, new independent adjudication required |
| Complete signed authorization and live safety conditions | Still EXECUTE_HOLD until controlled-delay and independent activation successors |

## Inherited governance
Historical QCP checks must replay against the adopted protected main, while current candidate checks use the exact path inventory. A pass in this engineering subset is not a live retry ARM, a Product projection authorization or a Formal-v5 cutover.
