# GEOX MCFT CAP-09 DA9 — V2 pre-Permit safety budget / post-execution timing contract

Date: 2026-10-19. Status: **DRAFT ENGINEERING CANDIDATE; NOT QUALIFIED OR ADOPTED**.

## Problem (factual)

Frozen main `77cdeeefc8b27901f3cc44b4edc203d8b8f513a3` requires `sum(stage.timeout_ms) <= observed.measured_worst_case_ms` before the signer issues a DA9 Permit, while the actual six-stage receipts appear only **after** that Permit is durably consumed. The operator's `D:\gptdown` evidence scan (SHA256 `1bb93bc01fe08ebd0175365bf2cf224dbb3d49dfa3d9505374a9b0580ed348e9`) returned zero three-sample sets, zero Provider/Pipeline delay receipts and zero post-execution six-stage audits. The one historic Producer was `FAIL`, wrong Subject. The matching DA9 window artifact remained `DYNAMIC_ADMISSION_HOLD`.

An unverified positive integer `measured_worst_case_ms` cannot prove an empirical worst case; stage timeout ceilings and historical durations have different meanings. Do not reverse the inequality or relabel a configured cap as a measurement.

## Contract design and exact safety semantics

**Pre-Permit V2:** `geox_mcft_cap09_prepermit_safety_budget_v2` and `REVIEWED_STAGE_CEILINGS_NOT_ACTUAL_SIX_STAGE_MEASUREMENT`. A source-bound signed Observations candidate contains the six original ordered stage timeout **caps**, their exact sum, a positive safety margin, a real Provider causal deadline, the future T1 first base, scoped source file names/sha256 and the existing reviewer identity. **It does not claim any historical six-stage worst-case measurement.** Source files MUST be outside the signed Release; all four file hashes are checked again at Host preflight before its one-shot Permit is consumed. DA9 historical GFS metadata and the KBS window report are pinned to existing real Windows SHA256:
- GFS metadata `8a89e19dc06023dcc8342b68541c67c7758d0e1ef836d63d68f285a3b29d192a`
- KBS/window report `d813093f0321bd56d7e0a43c1dfa66964c4f4dfe8373d665a3139123d49dd86e`

The other two sources are an operator-reviewed, run/subject/T1-bound per-stage cap rationale and **a fresh current Provider causal witness** bound to the same fields and observed no more than five minutes earlier. These new artifacts are *not yet available*. A structurally consistent JSON witness alone does not cryptographically prove the external server's behavior; the actual raw-response manifest, genuine signed operator review and transport receipt custody must be independently confirmed under the **existing** accountable operator and Permit signing boundary. Do not ask for a new signer, review tier or Run to conceal missing evidence.

Bounds are evaluated using actual current UTC time:
```
stage_cap_sum = Σ[PRODUCER, TIMING_1, TIMING_2, TIMING_3, CONTROLLED_DELAY, AGGREGATE].timeout_ms
hard_deadline = min(T1, authenticated_provider_deadline, permit_expiry, adoption_expiry)
current_time + stage_cap_sum + positive_safety_margin < hard_deadline
```
In addition, existing Provider-response (3 real HTTPS), Pipeline promotion+readback (3+3), isolation, full historic source hashes, fresh <300s DA9 zero-state resources, signed Adoption/Retry, exact Subject and nonce ledger all remain mandatory. **This contract is only pre-execution safety feasibility**, not six full-pipeline slow cases qualification or evidence that the real Provider will finish within a cap. No pre-Permit budget can be marked `timing_budget_qualified=true`.

**Post-Execution V2:** `MCFT_CAP09_POSTEXECUTION_TIMING_ADJUDICATION_V2.cjs` reads a **previously consumed Permit** and six chained official `COMPLETED.json` receipts plus their immutable stage artifacts, checks exact predecessor SHA256 chain and real monotonic elapsed_ms for each. It reads genuine Provider and Pipeline delay aggregates. It is a **read-only verifier**, not another executor, and does not issue or consume a Permit. Existing Aggregate intentionally records:
- `timing_budget_qualified=false`
- `timing_budget_frozen=false`
- `controlled_delay_matrix_executed=false`
- `full_six_case_pipeline_delay_qualified=false`

The new read-only report likewise says `REAL_STAGE_RECEIPTS_STRUCTURALLY_VERIFIED_PENDING_INDEPENDENT_ADJUDICATION`; it never asserts full slow-pipeline or production authority. A separate *technical* decision under existing governance is needed to assess actual measured timing and provenance applicability; there is no new issuer requirement.

## Migration boundaries — extremely important

- This Draft PR changes code bytes for the DA9 signer, retry bridge and Host. It **does not** modify the current installed 8,286-file frozen Release, its signed material profile, run `da9db7129607`, existing private signing keys, registered trust roots, Postgres or MinIO. **Do not copy these files over the frozen Release or run the candidate from the old signed material.**
- If accepted after QCP, a **new exact protected main Subject and Material digest** must be qualified; existing Scope Grant / Adoption / Retry V2 subject binding cannot simply be carried over. Reuse the existing authorized signer/roles and DA9 Run, but revalidate or re-sign applicable material using normal existing tools as needed. The earlier Adoption expired 2026-10-19T01:10:08.100Z.
- No test issues live Provider requests, performs SQL, uses cloud credentials, signs or consumes a real Permit, launches stage processes or grants A0/Formal-v5/O00/O23 authority. The synthetic unit fixtures emulate real data types only to verify failure semantics.
- All real Windows dynamic Admission steps including new T1/T2/T3, source-readback freshness, Provider causality and the aggregate signed six-stage timeout sum remain HOLD until evidence exists and the current exact material is adopted.
- Formal 108-path frozen Runtime and protected `main` of the original Subject stay unchanged until a separately reviewed, qualified release. **This candidate is not permission to run DA9.**

## Remaining engineering review items before merge

1. Validate security semantics of the **current Provider live witness origin**: its raw-response manifest hash is present, but a JSON assertion by itself does not validate actual HTTPS provenance or KBS 24-hour continuity. Add original raw member/hash/final-host/decoder verification before permitting true positive live adoption. Until resolved: fail closed.
2. Run exact candidate Windows/Ubuntu synthetic CI plus all inherited applicability/QCP/Host tests. Resolve any inherited frozen-path transition appropriately; do not waive QCP.
3. Confirm the consumer in the migrated Host verifies the same externally bound evidence as the signing tool, and that the source hashes are part of the signed Observations digest. Verify each child ticket does not incorrectly re-demand a fresh parent-only budget after six hours.
4. Provenance-bound operator review of stage cap upper bounds and positive margin remains necessary; do not produce default caps from 821997 ms GFS and do not make the 220 external calls again for the old T1.

**Disposition at code submission:** `BUDGET_V2_ENGINEERING_CANDIDATE_ONLY / HOST_PRODUCTION_DISABLED / DA9_PERMIT_NOT_CONSUMED`.
