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

E. Versioned adoption must extend **official** signer and Host to V3 **together**; existing V2 remains unmodified and will continue to HOLD. This proposed read-only V3 module only performs calendar arithmetic and provenance taxonomy; it deliberately always returns `V3_ENGINEERING_CONTRACT_HOLD_NOT_ADMISSION`.

## Acceptance and next execution sequence

1. CTO/authorized operator reviews **source-time policy change**, separately from 195min caps. Reject if actual semantics are different.
2. Implement signed Observations V3 + exact Host verifier and real source-specific evidence, plus test-only positive full transport/decoder/signature/Host path, spoofed clock/source/cycle negatives, and inherited QCP/CI. No fake external deadline.
3. On new exact protected main, freeze/requalify Release/Material; obtain new signed Adoption and Retry under existing authorized signer. Reselect a **future** T1 and prove budget vs signed deadline at actual now.
4. Only then within one live window capture real Provider + PG/MinIO/ACL/Owner evidence, complete safe unsigned risk assessment, obtain one-shot Permit, official `--preflight-only`, and `--execute` if admitted.
5. Six chained actual stage receipts are the delivery. Currently **0/6**, not PASS.

For fast read-only regression: `node scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP09_DA9_SOURCE_TIME_CONTRACT_V3.cjs`. No network, signer, DB or MinIO operations.
