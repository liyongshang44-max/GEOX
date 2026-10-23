# MCFT CAP-09 DA9 — Provider source-time causality contract V3 candidate

Date 2026-10-22. Base protected main `5526d93f5822c2f333ba997009e9d6605b8959e2`; run `da9db7129607`. **DRAFT / NO HOST ADOPTION / NO PERMIT / NO EXECUTION AUTHORITY.**

## Evidence adjudication

- GEOX `mcft_cap09_phase7_private_candidate_capture_promotion_v1.ts` has `CAPTURE_FAMILIES=["KBS_SOIL","GFS_BUNDLE"]`; real V13 Producer captures the three exact bases before their target clocks. KBS Raw Hourly CSV is **not** its soil source.
- KBS Variate 25 source `https://lter.kbs.msu.edu/weather/variates/25` is **observed VWC**. Its canonical decoder checks age <=30min **at real retrieval**, >=24 hourly buckets, >=1430min span, maximum gap <=30min. It cannot guarantee future observations over 195min. A retrieved observation expires for freshness at its own timestamp +30min; this is **not a Provider publication deadline or uptime SLA**.
- NOAA official GFS cycles are 00/06/12/18 UTC. The current product `gfs_nomads_live_provider_v1.ts` selects the latest **complete** same-cycle 72-hour GFS bundle, checks directory availability by target and bound lead <=120. The GFS cycle is selected dynamically, not frozen by offline planning. For proposed 2026-10-22T23Z first base, 12Z cycle gives supports F011/F012/F013, forecast windows F012–F083 / F013–F084 / F014–F085, a union of 75 distinct leads F011–F085 (each member class needed). Three IDX/Range successes do not prove the 75-lead whole bundle, its original raw provenance or scientific decoding.
- Current `MCFT_CAP09_PREPERMIT_BUDGET_CONTRACT_V2.cjs` merely checks equality between `budget.provider_deadline_utc`, `observed.provider_deadline_utc` and current witness's same field. Operator-authored equal JSON fields are **not independent external Deadline authentication**. Its raw manifest's item named `KBS_SOIL` is actually `/datatables/13.csv` KBS hourly weather CSV, not Variate25 soil JSON. The CSV header check is not soil source validation.
- GFS `Last-Modified` documents past publication, not a future expiry. KBS source freshness says what a sample can support **at the time of decoding**, not how far ahead a new sample will be available. The delayed `EA5E2` T+407m/T+432m Raw Hourly profile is an entirely separate phase and no DA9 Provider deadline.

**CTO finding: neither existing external source supplies an independently authenticated future Provider Deadline sufficient to guarantee a 195min attempt. Inventing `FirstBase`, cycle+N or `latest_soil+30min` as such a deadline is forbidden.**

## Proposed versioned successor — not yet accepted

A. Signed **hard capacity deadline** becomes `now + six stage caps + positive margin < min(firstBase, signedPermitExpiry, verifiedAdoptionExpiry)`. This is a planning ceiling, **not Provider availability or success guarantee**. The removal of the self-reported `provider_deadline_utc` is a **policy change requiring explicit acceptance and real sign/verify/Host migration**.

B. **Independent source-specific live predicates:** at short-lived pre-Permit readback, verify actual HTTP/TLS origin and unmodified raw bytes, real GFS selected-cycle full-member inventory and complete 72h support; and the genuine KBS Variate25 VWC continuity decoder. At each source-consuming child, revalidate real sources and per-capture <=30min soil age. When selected GFS cycle changes between witness and Producer, verify the newly selected complete cycle or fail closed. Static arithmetic does not replace raw scientific provenance or future KBS updates.

C. KBS CSV may remain a separately declared auxiliary budget witness, but must never claim V13 Producer soil causality. EA5E2 delayed-observation planning does not alter V13 pre-base semantics.

D. Preserve signed TEST_ONLY reviewer consent, six ordered caps 180min, 15min safety margin, frozen runtime/108 paths, historical attempt1 evidence and original isolated resources. No automatic retry, fake measurements, production privileges or auto-signature. Any failure after consumption is irreversible until new formal adjudication.

E. V3 is now **wired into the existing signed DA9 Retry V2 Permit assembler, pre-Permit admission bridge and real Host** within the same unmerged PR. The read-only screening function still returns `V3_ENGINEERING_CONTRACT_HOLD_NOT_ADMISSION`, but the newly versioned `MCFT_CAP09_DA9_PREPERMIT_SOURCE_USE_BUDGET_V3.cjs` can return structural PASS with genuine externally retained DA9 history, a non-template existing-signer stage-cap review, the exact frozen scientific-source byte hashes and verified Adoption/proposed Permit windows. The signer binds the complete Observations/StagePlan/ARM in the existing Ed25519 Permit; the Host rechecks the actual signed Permit expiry and scientific source hashes, including consumed child-stage continuation. **No complete parent Windows positive admission or real Provider result has yet been observed; Draft status remains HOLD for merge.** Existing V2 behavior is not reinterpreted.

## Acceptance and next execution sequence

1. CTO/authorized operator reviews **source-time policy change**, separately from 195min caps. Reject if actual semantics are different.
2. Validate the integrated official signer/Host V3 path with genuine original historical source files, exact installed Material, a human-approved current-Subject stage-cap source and real **parent** positive/negative Admission & Preflight. Synthetic Ed25519 signed Permit/Host child cases are already included in the cross-platform Pre-Permit workflow, but they are insufficient as full parent acceptance. Source code cannot be substituted between signed Permit and any stage.
3. On new exact protected main, freeze/requalify Release/Material; obtain new signed Adoption and Retry under existing authorized signer. Reselect a **future** T1 and prove budget vs signed deadline at actual now.
4. Only then within one live window capture real Provider + PG/MinIO/ACL/Owner evidence, complete safe unsigned risk assessment, obtain one-shot Permit, official `--preflight-only`, and `--execute` if admitted.
5. Six chained actual stage receipts are the delivery. Currently **0/6**, not PASS.

For fast read-only regression: `node scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP09_DA9_SOURCE_TIME_CONTRACT_V3.cjs`. No network, signer, DB or MinIO operations.


## 2026-10-22 PR integration continuation (not yet a qualification)

- Added signed-source budget verifier `MCFT_CAP09_DA9_PREPERMIT_SOURCE_USE_BUDGET_V3.cjs`, preserved original GFS/KBS historical SHA256 anchors and source-at-use semantic pins. Validates reviewed stage caps and positive margin, exact three provenance files outside signed release, existing reviewer identity and strict budget against **FirstBase + actual/anticipated Permit expiry + valid Adoption expiry only**. Missing either expiry rejects a positive budget claim.
- Existing `da9-retry-bundle-v2.cjs` builds official signed ARM/Observations/Plan and Ed25519 Permit with V3 budget; signed-material hash rechecked during assembly. `MCFT_CAP09_ISOLATED_RETRY_ADMISSION_BRIDGE_V1.cjs` dispatches based on V3 schema without granting fake Provider-SLA status. `MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs` verifies signed source SHA on parent and each child and still requires one-time Permit consumption for execute.
- Builder `da9-budget-v3-prepare.cjs` produces only an **unsigned** source-bound candidate from original historical files, original reviewed Retry decision, actual non-template operator stage-cap source and installed source files. It never approves, signs, consumes or runs; official signer re-verifies all inputs.
- Synthetic signed Ed25519 Permit verification and Host child acceptance/negative cases are in `ACCEPTANCE_MCFT_CAP09_DA9_V3_SIGNED_HOST_BRIDGE_V1.cjs`. This does not bypass historic parent signer or prove live data availability.
- No future 195-minute Provider guarantee. Source validity occurs during real Producer/Timing use: genuine NOMADS same-cycle full 72h composer + scientific decoder; KBS Variate25 real 30-minute continuity decoder. Source failure burns the attempted stage and must not authorize replay.
- **Not approved for merge:** full CI, QCP and first-error disposition must be green; no positive full parent/Preflight with original Windows files/Adoption yet, and actual six-stage receipts remain 0/6.
