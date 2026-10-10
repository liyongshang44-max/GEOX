# Isolated qualification-only authorization — CAP-09 2026-10-10

**Scope:** Local Windows isolated scientific Provider/Producer and three timing samples, never production recovery, Formal-v5 arm, A0, O00 or historical-attempt reset.

Operator request: after protected-main adoption of PR #3686, authorize the existing **already isolated** run `72dc0304a21a`. Operator reports, external to GitHub: PostgreSQL positive/negative databases on `127.0.0.1:55432` each have the exact V13 29-table schema, zero facts, correct Evidence LOGIN with no direct `facts` INSERT, and a fenced-writer EXECUTE grant; MinIO dedicated `mcft-cap09-requal-72dc0304a21a` bucket on `127.0.0.1:59000` is up; pinned Python/Windows native ecCodes and Node scientific selftests pass. These are **operator-provided local reports, not GitHub-host-adjudicated runtime proofs**. No credentials are stored in the repository.

## Authorized artifact and limits

- Authority: `scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_ISOLATED_QUALIFICATION_ARM_20261010_V1.json`
- Ancestral adopted authority: `96984439d8587f13ba57b6b0948a1c81d55da9e5`
- Execution subject: fresh exact **adopted protected main** only, never PR SHA, local dirty branch or pinned unmerged subject.
- Run ID: `72dc0304a21a`; databases `mcft_cap09_requal_72dc0304a21a_positive` / `_negative`, separate loopback credentials; bucket `mcft-cap09-requal-72dc0304a21a`.
- First logical base: `2026-10-11T00:00:00.000Z` (at least 6h after execution preflight).
- Authority expiry: `2026-10-11T06:00:00.000Z` and must be no more than 24h after each guarded evaluation.
- Existing `MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_ARM_V1.json` stays completely **disabled** for engineering/CI and all recovery, images, Formal/A0/O00.
- No historical GFS attempt reset, production DB write, old raw-bucket reuse, Frozen Runtime changes or owner cutover.

This is a **scoped authorization to attempt isolated qualification**, not an assertion that Provider access, real acquisition, timing budget, QCP or 24T passed. Existing `controlled_delay_matrix_executed:false` remains unresolved until **executed** delay proof is adopted separately.

## Operator execution boundary

1. Confirm merged protected-main subject and clean checkout using the governed source guard, and local resources still match run ID. Do not put database or MinIO secrets into PR, logs or chat.
2. Load scoped loopback `DATABASE_URL`, `BLOCKED_DATABASE_URL`, `MCFT_CAP09_FORMAL_RAW_ENDPOINT`, `MCFT_CAP09_FORMAL_RAW_BUCKET`, `MCFT_CAP09_FORMAL_RAW_REGION`, S3 key pair, external fresh output directory, and `MCFT_QUALIFICATION_FIRST_BASE` from adopted ARM. Preserve old receipts.
3. Run `node scripts/runtime_acceptance/RUN_MCFT_CAP_09_CURRENT_BASELINE_QUALIFICATION_V1.cjs --operator-authorized --preflight-only --all` on local Windows; it must return `PREFLIGHT_ONLY_NOT_QUALIFIED`. This does **not** validate live provider health or actual database privileges.
4. Only after the guarded preflight and operator checks, use `--operator-authorized --execute --all` for immutable positive/blocked Producer samples and three measured timing samples. Stop on any first failure and preserve raw evidence. Exact stage valid window and provider source availability must be rechecked before any production attempt.
5. Adjudicate raw retention, exact-base promotion, readback and timing separately via QCP. Isolated evidence alone never authorizes production owner, Formal-v5, A0/O00 or supply deadline closure.

**Expired or main-moved authority:** STOP and obtain a fresh reviewed successor. Do not edit ARM fields or bypass exact-main. A fresh base may require rebuilding the isolated environment with a **new** run ID, and preserving historical immutable receipts.
