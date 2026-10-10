# Current-baseline execution entrypoints

These entrypoints are disabled engineering deliverables, not current production or qualification authority. The checked-in ARM is false. CI performs boundary tests without credentials, provider calls or production execution. Existing 47 QCP checks and historical proofs remain unchanged; the added check covers engineering only.

After the 2026-10-10 current-crop authority adoption, this successor is governed as an exact 18-path scope. The seventeenth path is the adopted-stage successor verifier itself, modified only to delegate descendant-PR validation to this stricter current-baseline verifier while preserving the adopted-main and historical replay checks.

## Recovery

`RUN_MCFT_CAP_09_AM22_POST_CUTOVER_RECOVERY_V2.cjs` supports a separately authorized **new-window canonical rebootstrap**, not same-image resumption. It archives the failed receipt and complete Evidence log before invoking the existing governed bootstrap. It verifies append-only preservation afterward. It neither clears historical attempts nor authorizes Formal V5, A0 or O00.

Future execution requires an adopted protected-main subject, unchanged frozen Runtime, an unexpired recovery ARM, explicit authorization for a new image build and **both-role** cutover, the hash-bound prior failed receipt, a newly adopted real stage, 25-context coverage and an external output directory. The canonical bootstrap must attest the new image and verify live owner fencing/renewal and acquisition. Docker `running` or old health records do not qualify an owner. No such execution is authorized by this PR.

## Producer and supply timing

`RUN_MCFT_CAP_09_CURRENT_BASELINE_QUALIFICATION_V1.cjs` invokes the V2 Producer harness, three V2 timing samples and the V2 aggregator. Original V1 scripts, workflows and ARMs are preserved. V2 retains their scientific, raw retention, promotion, readback and timing assertions, adding current-main and isolated-target guards.

Future execution is local Windows only, not GitHub Actions. It requires a separately adopted unexpired qualification ARM and provisioned loopback PostgreSQL databases `mcft_cap09_requal_<12-hex-run-id>_positive` and `_negative`, with the appropriate schema and restricted LOGIN role ACLs. Use a loopback S3-compatible endpoint and dedicated bucket `mcft-cap09-requal-<run-id>`. Neither old production databases nor the historical formal bucket are accepted. Install the pinned repository dependencies and scientific Python dependencies first; the driver runs a dependency self-test before provider access.

The first logical qualification base must be more than six hours ahead of invocation. This is a target-time qualification constraint, not a six-hour wait before program startup. Output must be outside the source checkout and must not overwrite existing receipts. Local sample provenance is marked local, never a fabricated GitHub run.

Use `--operator-authorized --preflight-only --all` for the guarded qualification preflight, or `--operator-authorized --execute --all` only under separately adopted authority. Environment names are validated by `MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs`. Recovery likewise requires one of `--preflight-only` and `--execute` and `--failed=<immutable-receipt-path>`.

Successful isolated execution still requires governed evidence adjudication and adoption. It does not automatically close Producer, supply-deadline or unique-production-owner blockers. The timing measurement is local-scope evidence; it does not silently replace the old GitHub-scope budget. A production owner requires an independent live T1/T2 fenced-lease proof. No production tests should run merely because wall-clock time reaches 12:00.

The eighteenth path is the AM22 fresh-authority acceptance fixture. It replays the immutable `bb0f4f351d13436a451ac085fc30eaed539dd91a` registry snapshot for the 2026-10-09 single-append negative tests, so later adopted authorities do not corrupt that historical fixture; the production verifier remains unchanged.
