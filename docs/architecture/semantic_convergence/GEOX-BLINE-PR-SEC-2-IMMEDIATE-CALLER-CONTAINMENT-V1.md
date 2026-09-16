# GEOX B-Line PR-SEC-2 Immediate Caller-Authority Containment V1

**Status:** AUTHORIZED / BATCH 1 IMPLEMENTED / PENDING EXACT-HEAD QUALIFICATION  
**Mission:** B-SEC-0 / PR-SEC-2 — Immediate fail-closed caller-authority containment  
**Frozen predecessor:** PR #3453 @ `dc1036f3fec8173cbc775d536b50ef62672651d5`  
**Predecessor exact CI:** `33632733189` — SUCCESS  
**Historical predecessor metadata representation drift:** OBSERVED / NON-BLOCKING  
**MCFT boundary:** no MCFT implementation change

PR-SEC-2 does not reopen PR-SEC-1, does not edit #3453, and does not reinterpret the frozen `35 / 109 / 7 / 3 / 16` debt baseline.

Batch 1 contains the two production-registered Operator Twin scenario-to-recommendation POST routes. The production registration wrapper now requires an authenticated AO-ACT bearer principal with the existing `recommendation.write` capability, validates the capability against the existing role matrix, exact-binds request tenant/project/group to the authenticated token scope, validates route field access, rejects a caller-declared actor mismatch, and supplies the authenticated `actor_id` as the downstream `operator_id`.

The legacy downstream handlers remain unchanged. Their route paths, request/response contract, scenario qualification logic, `decision_recommendation_v1` payload meaning, persistence target (`facts`), absence of Approval/OperationPlan/Task/Dispatch side effects, and semantic authority ceiling are not redesigned by this batch.

The existing role matrix is not widened. In particular, PR-SEC-2 does not grant `recommendation.write` to the `operator` role. Principals that are not already admitted to `recommendation.write` fail closed.

Machine qualification for this batch is defined by `ACCEPTANCE_BLINE_PR_SEC_2_IMMEDIATE_CALLER_CONTAINMENT_V1.cjs`. It preserves the frozen PR-SEC-1 inventory as historical baseline and proves the new containment overlay instead of rewriting predecessor debt rows.

Expected machine debt movement for this batch is limited to:

```text
unauthenticated mutating surfaces               35 -> 33
semantic writers without validated capability 109 -> 107
unverified declared human actors                 7 -> 7
service writers without bound principal          3 -> 3
untrusted / unbound tenant scope                 16 -> 16
```

No counter may be reduced by exclusion, blanket allowlist, or historical inventory rewrite.

After Batch 1 qualification, the authorized risk order remains Weather Forecast ingest, Legacy Twin base mutation fail-close, Admin Import, `/api/raw` plus weak `__internal__` compatibility, then high-risk GET write-under-read, subject to machine evidence and without expanding PR-SEC-2 into semantic redesign or MCFT work.
