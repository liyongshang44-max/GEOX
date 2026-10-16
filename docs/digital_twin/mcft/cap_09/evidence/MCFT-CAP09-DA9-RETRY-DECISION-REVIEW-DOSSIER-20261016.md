# MCFT CAP-09 — Second TEST_ONLY Retry: decision review dossier

**Disposition: REVIEW_REQUIRED / DENIAL_STILL_EFFECTIVE. This is NOT an adjudication approval, adoption, permit, or preflight receipt.**

## Fixed request

- Run ID: `da9db7129607`; attempted ordinal: **2**; parent run: `72dc0304a21a`.
- Frozen subject: `91835fa0997730c85c5f3869dd530f4c9a3ca82d`.
- Scope requested: **one** TEST_ONLY retry only. All production, owner cutover, Formal-v5, A0 and O00–O23 effects: **false**.
- The first Producer attempt's Provider call count remains **null (unknown)**; first failure phase remains **UNKNOWN**.
- First failure: `POSTMERGE_V13_PRODUCER_CORE_FORMAL_RAW_BUCKET_REQUIRED` (bucket wrapper conflict); this is not evidence of zero Provider calls.

## Evidence basis — already verified, do not rerun

Windows operator reported 6/6 exact-raw-byte hashes PASS, attested by mapping file `D:\gptdown\MCFT-CAP09-da9db7129607-HISTORICAL-SIX-FILES-VERIFIED.json`, SHA-256 `23631acc704d9bb47ac40c9938d8e1df07dba8d123db2d425df1d3d8b64951f5`. The specific six file paths and individual pinned hashes are already recorded in `MCFT-CAP09-DA9-RETRY-FILES-REVIEW-MAPPING-20261016.json` on this PR; do not reconstruct or redefine them.

The required **seventh** input key is `retry_adjudication`: presently **not approved**. The candidate `MCFT-CAP09-DA9-RETRY-ADJUDICATION-REVIEW-CANDIDATE-20261016.json` correctly declares `review_status=REVIEW_REQUIRED`, `retry_admissible=false`, `prior_denial_explicitly_superseded=false`. A candidate is not a signed / adopted decision. A new approved decision can refer to six existing immutable inputs but must carry its own auditable digest, reviewer authorization and exact scope.

## Findings for adjudicator

1. Historical failed-receipt and STARTED / read-only audit anchors are preserved, including the unknown Provider call count.
2. Source inspection establishes a TEST_ONLY isolated Producer composition route while the production wrapper remains frozen; **source routing is not host acceptance evidence**.
3. The prior refusal has not been authenticatedly superseded. No verifiable reviewer approval, decision ID, authorization provenance, approval signature/attestation, or explicit supersession rationale has been supplied.
4. The project owner retains cryptographic private-key custody. Existing `INDEPENDENT_GOVERNANCE` registry role and key fingerprint checks **do not establish an independent human signoff**. The trust-policy mismatch cannot be concealed by presenting an owner signature as a separate principal. If the governing authority permits owner-operated adjudication for this non-production scope, that authorization/policy exception must be **explicit, attributable, reviewed and verifiable before** a decision is treated as approved. No fabricated signer or unsigned boolean flip.
5. Older signed Adoption expires at `2026-10-16T07:07:42.947Z` and must never be used as future execution authorization.

## Exact unresolved approval record

The authentic decision must specify:

- **Review principal and delegated authority:** identity, review role, approval provenance and valid trust/policy route.
- **Decision identity:** unique decision ID, UTC decision timestamp, verifiable signature or independent protected review receipt.
- **Scope:** run `da9db7129607`, parent `72dc0304a21a`, subject `91835fa0997730c85c5f3869dd530f4c9a3ca82d`, second attempt, TEST_ONLY only.
- **Basis:** six verified historical input digests plus the separately authored and verifiable adjudication artifact (the seventh required file). Distinguish proposal from final evidence.
- **Denial supersession:** identify the original denial; explain why the documented bucket conflict and available isolated Producer routing justify a strictly scoped second attempt **despite** the unknown Provider call count and without claiming the first execution was effect-free.
- **Explicit disposition:** `retry_admissible`, `prior_denial_explicitly_superseded` only become true on authentically adopted approval; if not, remain false.
- **Non-effects:** no production/owner/Formal-v5/A0/O00–O23 access; no Runtime modification, historical reset or automatic retry.

## Post-adjudication ordered gates (unchanged)

1. Obtain verifiable signed/adopted Retry Adjudication that explicitly supersedes prior denial.
2. Verify fresh signed Adoption, exact installed material, expiration and a measured six-stage end-to-end worst-case budget with safety margin.
3. In the execution window, obtain fresh loopback dedicated positive/negative PostgreSQL, ACL, zero-row identity, MinIO current objects/**versions/delete markers/multipart**, production exclusion, source, Provider causal visibility, fresh output and nonce/ledger readbacks (respect official 300-second freshness).
4. Separately issue a signed, run- and subject-scoped one-time TEST_ONLY Retry Permit after all admission conditions pass.
5. Run official governed `--preflight-only`, retaining status receipt.
6. Only on PASS, execute actual Windows Producer → Timing 1 → Timing 2 → Timing 3 → Controlled Delay → Aggregate with immutable stage receipts.

**Stop conditions:** missing authorization provenance, signature/trust mismatch, stale Adoption, stale/partial readback, Provider causal gap, budget infeasibility, occupied run output/nonce, any ACL or isolation mismatch, or official Preflight failure. No Permit issued; no run/nonce consumed. **TEST_ONLY HOLD / Production HOLD**.
