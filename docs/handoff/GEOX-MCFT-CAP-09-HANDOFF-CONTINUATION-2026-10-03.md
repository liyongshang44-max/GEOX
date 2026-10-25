### 2026-10-25 — Formal signed V2 source-successor governance admission: enforced HOLD

- **Signed #3731 immutable:** original exact source `6d8fb108655dada4b44cc7e4709a1c2ac5832b0` unchanged, operator six Ed25519 signatures and full original six CI artifact/receipt SHA binding independently verified (bundle SHA256 `a98f40c3ed017b017a8459d02655b9f206f6716d1402abcc0e579487c63901df`). PHASE3 exact new-source digest and the two-blob Frozen V13 technical successor are technically approved and in review-only QCP registry; no new Provider fetch/PG write or re-signing.
- **Critical trust authority gap:** repo `scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json` has `adopted=false`, `execution_enabled=false`. Independent registered principal `mcft_cap09_independent_retry_governance`, SPKI `ef7459a5918e35c90913532a7c8af545fbca4fec0b7dc95916797db3303fa870`, is trusted for **retry governance**; this alone does **NOT delegate independent signature authority for V2 Composer / PHASE3 / Frozen V13 source successor adoption**. No authenticated separate issuer approval, purpose-specific governance delegation or independently controlled key evidence. CTO technical decision cannot substitute for these, and original operator signature is not distinct independent approval.
- **New formal request and hard gate in Draft #3732:** exact-source request `GEOX-MCFT-CAP09-DA9-SIGNED-V2-FORMAL-GOVERNANCE-ADMISSION-REQUEST-V1.json` status `HOLD_PURPOSE_SPECIFIC_DELEGATION_AND_INDEPENDENT_APPROVAL_REQUIRED`, references six signed receipts, current PHASE3 94-path digest and Frozen exact-two runtime sha; no old digest inheritance. `VERIFY_MCFT_CAP09_DA9_V2_FORMAL_GOVERNANCE_ADMISSION_V1.cjs` checks issuer distinctness/public SPKI, no unapproved purpose promotion, source binding and no effects, **14** negative tests; `--require-approved` intentionally and provably refuses while missing independent grant+signature. QCP distinct check `DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING` owns **three exact new paths**, no old carryforward, formal admission HOLD. New workflow `40197257054=SUCCESS`: `PASS_EXPECTED_HOLD_FORMAL_V2_GOVERNANCE_NOT_ADMITTED`, negative_tests_pass=14, `PASS_FORMAL_GOVERNANCE_HOLD_FAIL_CLOSED`. This is **NOT** a successful formal approval or Permit.
- **Old Frozen zero-delta check** remains FAIL `40197257008`; do not rewrite historical frozen contract or treat two-blob successor as a retroactive PASS. Central QCP and general CI were still in progress at this entry; fetch latest exact-head result for decisions. PR #3731 and #3732 Draft/Open/Unmerged, no formally adopted V2 registry, new isolated Fenced PG and Permit still HOLD.
- **Required independent next evidence:** verified organizational purpose-specific delegation for this exact source-successor class and separate properly attested independent signatory review (not existing operator signer), explicitly bound to `6d8fb108...`, PHASE3 new digest, Frozen two-blob change, six signed proof sha. Then construct separately approved formal V2 QCP successor enrollment preserving old historical failure and rerun all full qualified gates. No substitute role simulation, no fake signoff. Exact rationale logged in https://github.com/liyongshang44-max/GEOX/pull/3732#issuecomment-6398203677 .

---

### 2026-10-25 — DA9 signed V2 CTO technical adjudication and controlled QCP technical registration

- **Signed #3731 unchanged:** Draft/Open/Unmerged subject `6d8fb108655d9ada4b44cc7e4709a1c2ac5832b0`; existing full 6/6 independent Ed25519 proof and exact-source CI `40188383138` retained, signed JSON SHA256 `a98f40c3ed017b017a8459d02655b9f206f6716d1402abcc0e579487c63901df`; no new operator signing or Provider capture.
- **CTO technical successor decisions ACCEPTED under delegated engineering review**, but **NOT independent human governance authorization**: (i) PHASE3 fresh 94-path source `sha256:8af6025cd4be03227ed06a39f8f5f7fc51cdc862f3e12319fcb318e00864f145`; historical `sha256:d5d1cf09c4cde3b0fe82e658d9af2b25fe5beccee1a582d40ba00349fab8534b` invalid for carry-forward (31 changed Git blobs; 1 missing historical path); (ii) Frozen V13 108-path runtime exact two blob deltas (`cda8c741...`→`68ad42eb...` and `a415f9e4...`→`fcd429ca...`), signed source successor runtime digest `sha256:733739cdb36b50078ce5fc7fb628d252de9b68fb6d4d5e102fbd8ff53ac39c0f`. Historical Frozen zero-drift still **FAIL**; its workflow/validator left unchanged.
- **Controlled QCP technical registration in separate Draft #3732**, current review branch HEAD `5359fdfc5e6c5ca1d3c592b5798a8b16f29d88b2`: new `GEOX-MCFT-CAP09-DA9-SIGNED-V2-QCP-TECHNICAL-ENROLLMENT-V1.json`, isolated CTO technical review-only registration, 2 determinations; `VERIFY_MCFT_CAP09_DA9_SIGNED_V2_QCP_TECHNICAL_ENROLLMENT_V1.cjs` negative-first guard; controlled existing QCP check `DA9_SIGNED_COMPOSER_V2_PHASE3_FROZEN_RUNTIME_REVIEW_ONLY` exact **5** owned paths, no wildcard, no old `carry_forward_evidence_id`; **historical evidence registry preserved**. Governance workflow `40196258357=SUCCESS`: `PASS_CTO_TECHNICAL_SUCCESSOR_QCP_REGISTRATION_ONLY`, `negative_tests_pass=10`, `technical_registered=true`, `formal_qcp_qualified=false`, `independent_governance_approved=false`, `old_frozen_gate_still_fails=true`, `permit=false`. EA5E2 `40196258257` both scientific core and dependency closure **SUCCESS**. Historical Frozen V13 `40196258338` **FAIL**, expected. Central QCP and general CI were running at latest checkpoint; check final exact HEAD before concluding.
- **Critical fence:** CTO technical adjudication in conversation has no authenticated separate independent-governance issuer signature; cannot be represented as full formal QCP/adoption admission. Independent authorized governance approval and an explicit separate successor-graduation decision are still outstanding. #3731 and #3732 stay Draft; new isolated Windows Fenced PG, MinIO/ACL/source time, Timing/Delay/Aggregate and Permit remain HOLD. No DB/S3 writes executed by this technical reviewer.
- Review refs: https://github.com/liyongshang44-max/GEOX/pull/3732#issuecomment-6398050873 ; https://github.com/liyongshang44-max/GEOX/pull/3731#issuecomment-6398065830 .

---

### 2026-10-25 — #3732 independent governance review: PHASE3 successor digest and two-blob Frozen V13 separation

- #3731 remains **Draft/Open/Unmerged**, its immutably signed exact HEAD is `6d8fb108655d9ada4b44cc7e4709a1c2ac5832b0`; GitHub run `40188383138` 7/7 native+audit SUCCESS; six actual operator Ed25519 signatures and original ZIP/receipt bytes independently VERIFIED (signed JSON SHA256 `a98f40c3ed017b017a8459d02655b9f206f6716d1402abcc0e579487c63901df`). No old-signature reuse, no Permit. Do not alter original exact SHA just to enroll governance proof.
- **Independent follow-on Draft PR #3732** https://github.com/liyongshang44-max/GEOX/pull/3732, code HEAD `beb349f6fea23cf709b6ea9d98992f33fba99776`, based on original protected main `2162f368899e9a9b5c497d332859e4196f389660`; separate from signed #3731. Its new `GEOX-MCFT-CAP09-DA9-SIGNED-V2-PHASE3-FROZEN-V13-GOVERNANCE-REVIEW-V1.json` references *public digest/metadata only*, does not publish raw operator signed bundle or PEM; `qcp_enrollment_approved=false`, independent governance approval=false, Permit/production/Provider/Fenced-PG=false.
- **Independent read-only CI `40195303139=SUCCESS`**; original identical-scope `40195048696=SUCCESS`. Exact result ZIP artifact `12599478331`, SHA256 `0475d14ee3c1646ba0b9933b3b156237b59735905bc7867175595318f6241caa`, contains `MCFT_CAP09_DA9_V2_SIGNED_GOVERNANCE_TECHNICAL_AUDIT_V1.json`. New script `REVIEW_MCFT_CAP09_DA9_SIGNED_V2_PHASE3_FROZEN_V13_V1.cjs` computes source digests from actual Git content for the **pinned #3731 signed source**, not the review branch's code, with no external DB/S3 or production effects.
- **PHASE3 historical inheritance disposition:** exact resolver scope=94 paths; signed-source V2 aggregate `sha256:8af6025cd4be03227ed06a39f8f5f7fc51cdc862f3e12319fcb318e00864f145`, exact match independently verified operator signature; historical PHASE3 subject `24cd4b592d671974f5b3a1449a6194bfca0806cb`, historic digest `sha256:d5d1cf09c4cde3b0fe82e658d9af2b25fe5beccee1a582d40ba00349fab8534b`. Exactly **31** Git blob changes (including one historic-missing path `scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_GFS_MEMBER_RETRY_RESILIENCE_V1.ts`), not a checksum formatting repair. New V2 PHASE3 is a **fresh qualified-evidence candidate**, NOT legacy carry-forward; old SHA must not be rewritten.
- **Frozen V13 historic zero-drift disposition:** resolved 108 semantic runtime paths, compare historic `3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a` to signed #3731 SHA yields **exactly two** expected changes, and both previous/new Blob SHAs match frozen DA9 successor contract: `apps/server/src/runtime/twin_runtime/external_formal_exact_base_fact_promotion_v1.ts` (`cda8c741...`→`68ad42eb...`) and `apps/server/src/persistence/external_evidence/postgres_evidence_runtime_fenced_exact_base_fact_promotion_v1.ts` (`a415f9e4...`→`fcd429ca...`). Old frozen runtime aggregate `sha256:13884b41d719ad88334e4fe757cd014fa670e363f92e96413ce4ef2fd7f7ba26`; new runtime `sha256:733739cdb36b50078ce5fc7fb628d252de9b68fb6d4d5e102fbd8ff53ac39c0f`. Both changes implement restricted `ISOLATED_QUALIFICATION_ONLY` Raw bucket authority/content address verification and its optional propagation to PG Fence, with existing formal-raw default retained. **Historical Frozen V13 zero-drift invariant is FALSE / old workflow FAIL by design; it was NOT disabled or changed**. Separate exact-two-path successor technical review now PASS; formal independent science/governance approval still pending.
- New review-only check owns exactly three file paths via `DA9_SIGNED_COMPOSER_V2_GOVERNANCE_READONLY_EXACT_PATHS`, no wildcard; first EA5E2 fail `unknown_changed_paths`, second fail `CHECK_AUTHORITY_REF_MISSING` due referencing non-adopted V2 source contract not in review branch; fixed by limiting `authority_refs` to new local review contract. Latest `40195303151` **EA5E2 dependency closure and scientific-core both SUCCESS**. Current #3732 inherited old Frozen `40195303127=FAIL` expected; general CI/QCP were still underway at this handoff checkpoint and MUST be checked separately.
- **Next:** independent *authorized* successor governance approver to accept/reject two-file Frozen semantic evolution and fresh PHASE3 V2 qualification as new source contract; do not equate `ACCOUNTABLE_SINGLE_OPERATOR` key signature with independent retry-governance issuer approval. Only after that, prepare separately gated QCP successor enrollment that references immutable #3731 proof (no old-contract tampering). Stage3 Windows fresh Fenced PG Admission, ACL, source-time causality, MinIO and lease/cursor readback remain HOLD; Permit false. #3732 remains Draft, no production changes.
- Review evidence: https://github.com/liyongshang44-max/GEOX/pull/3732#issuecomment-6397932241 ; #3731 cross reference: https://github.com/liyongshang44-max/GEOX/pull/3731#issuecomment-6397936260

---

### 2026-10-25 — #3731 six-native successor Ed25519 proof independently verified; V2 enrollment and historical governance still HOLD

**Original operator V2 bundle independently verified (2026-10-25):** User supplied actual `MCFT-CAP09-STAGE3-SIX-SIGNED-V2.json` (11,973 bytes), SHA256 independently recomputed `a98f40c3ed017b017a8459d02655b9f206f6716d1402abcc0e579487c63901df` and matched terminal. Independent Python/cryptography verification with registered operator Ed25519 PUBLIC key `spki_sha256=223c806e89c4e6df5e91a089e0b22e5cef05934d42ee7df817faaeaa67553365` succeeded **6/6 signatures**, **6/6 signature-tamper negative tests**, issuer ID `mcft_cap09_operator_mylr1`, `key_id=mcft_cap09_ed25519_223c806e`, `revoked=false` in HEAD trust file, signed UTC within issuer validity 2026-10-13 through 2026-11-13. Original six ZIP byte SHA256 and each unmodified JSON receipt byte SHA256 independently recomputed **6/6 PASS** against live GitHub artifact metadata and signed claims. Original `sha256:sha256:<hex>` wire flaw retained immutably and bound as signed `original_receipt_dependency_digest`; canonical signed `dependency_digest=sha256:<hex>` exact-relation passed 6/6. Strict source HEAD `6d8fb108655d9ada4b44cc7e4709a1c2ac5832b0`, Base `2162f368899e9a9b5c497d332859e4196f389660`, GitHub run `40188383138` attempt=1, six check IDs, issuer, zero-effect claims match. Independent audit JSON SHA256 `11b4502add2acb26ed6334216bac2f9b69a28e7380c9f1c9087129a20770b71d`; signed bundle bytes deliberately NOT committed into repository or disclosed private PEM. Live PR #3731 still Draft/Open/Unmerged on signed SHA; all GitHub runs for exact head now **31 SUCCESS / 2 FAILURE / 1 SKIPPED**; failed are Frozen V13 `40188382929` and Central QCP `40188383176`. **Evidence-level ruling:** `SIX_OPERATOR_SIGNATURES_AND_SOURCE_ARTIFACT_BINDING=INDEPENDENT_CRYPTO_PASS`, but `V2_ENROLLMENT=REVIEW_REQUIRED`, `FROZEN_V13=HOLD`, `QCP=HOLD`, `FENCED_PG=HOLD`, `PERMIT=false`, `PRODUCTION=false`. A public-key proof of the accountable operator signature is not itself an independent second human governance approval. No new production authorization and do not modify #3731 exact HEAD. PR verification comment: https://github.com/liyongshang44-max/GEOX/pull/3731#issuecomment-6397692061.



- **PR #3731** protected-main based, Draft/Open/Unmerged; new head `6d8fb108655d9ada4b44cc7e4709a1c2ac5832b0` after CI and signer tooling. This is a **new independent nonauthorizing contract**, not a patch to old signed qualification. New contract `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-STAGE3-PYTHON-COMPOSER-SIX-CHECK-SUCCESSOR-V2.json` preserves historical DA9 V1 immutable expected Composer blob `7e74b1df502e159dd49ceb21889cbfff86408e50` and expressly scopes new Python-threaded Composer blob `2d1f72d92c05093537774285bda5b7200845344d`, exactly three reviewed changes. `signed_entries=[]`, `qualified_six_checks=false`, Permit/signing authority, PG execution and production permissions all false.
- **Six original native acceptance job bodies under fresh PR-run workflow:** `.github/workflows/mcft-cap09-stage3-composer-six-native-successor-v2.yml`. Copies original acceptance *commands* and ephemeral Postgres/S3 services from six pinned workflows into new independently named jobs, with exact-head source/Dependency-Digest and immutable artifact byte-hash emission on success (`MCFT_CAP09_STAGE3_COMPOSER_SIX_NATIVE_SOURCE_RECEIPT_V2.cjs`). Seventh isolated job audits contract and **PHASE3** historic dependency digest mismatch, emits `MCFT_CAP09_STAGE3_PHASE3_HISTORICAL_DIGEST_DISPOSITION_V2.json`. Original workflows themselves unmodified. Some old predecessor-scoped EA5C1 steps were intentionally **replaced only in the new successor workflow** by separately reviewed new-base scope logic; native real PG/S3 and negative constraints were kept.
- **Actually witnessed previous six-native workflow outcomes:** run `40187324470`: 5 of six native jobs SUCCESS; EA5C1 failed at original old-Base assertion (expected fail-closed), phase3 independent audit SUCCESS. PHASE3 ZIP artifact id `12597265221`, GitHub-upload ZIP SHA256 `ad9b257be5d87c3569dd7e6413485264ad38aceb383ea5a9db6300705d63c28e`. Second run `40187619173`: same five native jobs SUCCESS; EA5C1 proceeded through real ephemeral MinIO and PostgreSQL tests but failed its final gate only because old `MCFT_CAP09_DA9_EA5C1_SEMANTIC_SUCCESSOR_SCOPE_RESULT.json` was intentionally not emitted by the new source reviewer. **Do not claim six/6**. Fixed the new successor scope receipt writer and downstream validation in commits `c115ce9a...`, `d9f331a0...`; latest immutable exact-head `6d8fb108...` workflow `40188383138` was **queued**, no final result at this checkpoint. New successor workflow now cancels obsolete PR SHA runs; prior historical runs remain queryable.
- **PHASE3 diagnosis independently executed:** `40187324470` audit returned `PASS_HISTORICAL_DIGEST_MISMATCH_CLASSIFIED_BUT_REQUALIFICATION_HOLD`. Historical source subject `24cd4b592d671974f5b3a1449a6194bfca0806cb`, old digest `sha256:d5d1cf09c4cde3b0fe82e658d9af2b25fe5beccee1a582d40ba00349fab8534b`; latest scoped digest is recomputed from actual exact-head files, and per-file old/current git blob differences materialized in public CI artifact. This is **proof that legacy PHASE3 digest cannot qualify the modified source**, not proof of new signed PHASE3 qualification; do not overwrite old digest or manipulate its QCP registration.
- **New independent operator local-only signer staged:** `scripts/governance_acceptance/SIGN_MCFT_CAP09_STAGE3_COMPOSER_SIX_OFFLINE_V2.cjs`. Requires all six real GitHub jobs `completed/success` in same final `pull_request` run and exact PR head/base, re-downloads six actual GitHub artifact ZIP bytes, checks their ZIP SHA256 and JSON receipt claims, verifies `ACCOUNTABLE_SINGLE_OPERATOR` Ed25519 private key against existing trusted public `SPKI=223c806e...`, signs six new domain-separated payloads for later *separate* human approval. Has ephemeral-only crypto selftest. Does not upload private key, issue Permit, enroll QCP, replay historical six signatures, or authorize any PG writes. **No operator signing has occurred yet**; do not claim the new six are signed until operator executes approved signer and reviewer checks real files.
- **Current code-scope owner map:** Stage3 exact resolver expanded from 33 to 37 exact paths to own new successor contract, workflow, source receipt, and local-only signer; EA5E2 still holds normal fail-closed discipline. Old DA9 frozen six V1 contract and original Frozen V13 no-drift verifier untouched. Central QCP old six evidence and Frozen V13 historical runtime drift remain independent HOLD; original Windows Raw offline Phase7 semantic replay PASS TEST_ONLY only. No new Windows-run Fenced PG, Timing, Delay, Aggregate or governed Permit admission.
- **Next actions:** (1) inspect exact-head `40188383138` seven job results; if six SUCCESS, cross-check artifact IDs and signer selftest; (2) operator locally signs using authorized private key (never upload PEM) only after six ZIP and Github metadata verification; (3) submit signed-bundle bytes for independent trusted public-key check and dedicated successor-QCP enrollment review; (4) PHASE3 new-source digest must bind new real run and signed artifact, old anchor remains immutable; (5) handle historical Frozen V13 separate proof; (6) only then consider independent fresh-isolation source-time/ACL/lease Fenced PG admission. #3731 stays Draft.

---

### 2026-10-25 — #3731 exact Python Composer delta requalification hardening (no authorization)

- `#3731` remains Draft/Open/Unmerged at latest source head `b77271702ef44788c2cdeaa80b027f977d1f9c85`, protected main base `2162f368899e9a9b5c497d332859e4196f389660`. Former exact-head `baf7e62e...` had 30 SUCCESS, 2 FAIL, 1 SKIPPED. On the new HEAD, do not inherit green checks without inspecting new workflow runs.
- Confirmed precise semantic audit on isolated Composer source: old immutable DA9 expected Git blob `7e74b1df502e159dd49ceb21889cbfff86408e50`; current reviewed source blob `2d1f72d92c05093537774285bda5b7200845344d`. **Only three edits** reconstruct exactly: optional `python_executable?: string` parameter; forward to `ProductionEvidenceWorkItemFactoryV1` for original capture; and forward to `ProductionExternalFormalCandidateRehydrationDecoderFactoryV1` for retained-Raw replay (including exact explanatory comment). No modification to production wrapper composer. All other bytes unchanged relative to old immutable Composer. Do not update old V1 contract's `expected_unchanged_isolated_composer_git_blob_sha`.
- Commit `c8c28e15f21938cadda971263f0b4a4cd43a74c2` added and `b77271702ef44788c2cdeaa80b027f977d1f9c85` corrected newline literals for deterministic exact-delta review in existing `ACCEPTANCE_MCFT_CAP09_STAGE3_NONAUTHORIZED_REAL_BODY_GATE_V1.cjs`. New positive check requires HEAD and worktree exact `2d1f72d9...`; 4 negative cases reject legacy Composer, missing Capture forwarding, replay interpreter fallback, or fraudulent production wrapper reuse. Immutable DA9 blob remains unchanged, Stage3 six-body qualification remains HOLD, no Fenced PG authorization, no Permit.
- Latest dedicated Stage3 gate Actions `40186147810` **SUCCESS**, reports `checks=13`, `reviewed_interpreter_only_blob=2d1f72...`, `original_six_signed_evidence_still_unqualified=true`, `new_fenced_pg=HOLD`, `permit_issued=false`, `permit_consumed=false`. Latest EA5E2 `40186147734` also **SUCCESS** for dependency closure and scientific core. Other new-head CI and QCP were in progress at first review; check exact workflow conclusions before release adjudication.
- This **does not repair six signed-evidence QCP blockers**. The existing `GEOX-MCFT-CAP09-DA9-SIX-CHECK-EVIDENCE-V1.json` remains anchored to historical source `0d9c24a8495d5afdd680bda16531bbd39c542350`, and reviewer `VERIFY_MCFT_CAP09_DA9_FROZEN_SEMANTIC_SUCCESSOR_V1.cjs` still correctly rejects the new Composer via old contract. Fresh exact-source six qualification workflow runs, artifact hashes, independent Ed25519 authorized reviewer signing, immutable-source bindings and PHASE3 digest review are required. Old Workflow `workflow_dispatch` is unavailable for some six check workflows, and the current ChatGPT GitHub connector has no workflow-dispatch action: do **not** fabricate new runs or replay old run IDs. Frozen V13 historic zero-drift test remains independent blocker and must not be disabled.

---

### 2026-10-25 — #3731 CI remediation, main-first ancestry and new-isolation Fenced PG scoped HOLD

- **Current PR #3731** Draft/Open/Unmerged, base protected main `2162f368899e9a9b5c497d332859e4196f389660`, head `baf7e62e23c7ada30d290a51d5d3641ddbde9cf1`. Base was retargeted from already merged #3730 stack; source tree from prior `7413e2d0...` preserved exactly. Non-force ancestry graft: intermediate candidate `aa43ab6efd86dfb3f8e3123258cd781e82b5ce49` (old HEAD parent + main parent), then final main-FIRST merge `baf7e62e...` (first parent main; second parent intermediate; equal candidate and merge trees). No historical rewrite, production mutation, Permit or Provider/PG/S3 execution.
- **CI failure #1 Fastify:** original CI `40179878585` build-test PASS, first acceptance FAIL from server Fastify onReady timeout. Rerun failed jobs on the unchanged original candidate produced build-test=SUCCESS and acceptance=SUCCESS. Transient/non-deterministic on this evidence; **do not call root cause fixed**. At final exact HEAD, **CI `40183241486=SUCCESS` (build-test=SUCCESS, acceptance=SUCCESS)**; the earlier Fastify timeout was not reproduced, but its precise startup root cause remains unproven.
- **CI failure #2 EA5E2:** exact central planner reason was 33 Stage3 new paths in `unknown_changed_paths`, not any historical digest note. Commit `c4002e213fac49c69cad3a079afb1deed2320b91` amended only `GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json` with exact path set resolver `STAGE3_20261025_NONAUTHORIZING_EXACT_PATH_SCOPE_V1` and REQUIRED fresh TEST_ONLY Stage3 requalification check (no carryforward). No wildcard/unconditional PASS. Latest final HEAD EA5E2 `40183241572=SUCCESS` (scientific-core + dependency-closure). Main-first ancestry restored CAP08, Phase6 and Formal-v5 R6 inherited governance successes.
- **Unresolved Frozen V13 blocker:** final HEAD `40183241606=FAIL` in `ACCEPTANCE_MCFT_CAP_09_FROZEN_V13_REQUALIFICATION_V1.cjs:22`, positive test fixture `resolveFreshEvidence` returned FAIL; frozen successor verifier checks unchanged historical semantic runtime. Confirmed `apps/server/src/persistence/external_evidence/postgres_evidence_runtime_fenced_exact_base_fact_promotion_v1.ts` frozen blob `a415f9e4...` differs current protected-main blob `fcd429ca...`; PR HEAD blob is identical to main. **Historical frozen-to-current-main runtime drift predates this PR**, no proof that the new Stage3 code modified protected semantic implementation. Preserve FAIL and seek separate fresh frozen V13 adjudication; do not weaken the old digest guard or treat this as a green gate. Final head **postmerge V13 `40183241589=SUCCESS`**, but **central QCP `40183241532=FAIL`** with six required-check blockers; see exact addendum below. Preserve QCP HOLD.
- **New isolated Fenced PG admission review committed:** `7413e2d078d3130f6385d49a9b86fadc5f03fb96`, Stage3 contract object `fenced_pg_admission_review_20261025`, explicit `HOLD_NEW_ISOLATED_FENCED_PG_NOT_ADMITTED`. Prior genuine operator Windows old-raw Phase7 semantic replay PASS TEST_ONLY, public receipt hash independently verified `591534ce9c58746b29e39f5727152b958526760755dc83b0b29e7e2adcb6bf7e`. **Not new Candidate identity or Fenced PG qualified:** old Candidate tied to original Subject, idempotency, old S3 raw refs and expiry; old PG facts=0, controller/target lease expired. Existing Windows new-PG Runner still invokes `captureExactBase()` with **live Provider requests up to 260** and is not an offline no-Provider Raw reimport. Do not run it for no-refetch recovery. Missing new run-scoped epoch/PG/MinIO/KBS+GFS causal freshness, immutable new Candidate manifest, legitimate target/deadline, independent Evidence/Twin positive-negative matrix, MinIO runtime least privilege, new live Controller/Claim lease, three original semantic Facts physical fenced write and readback/Cursor. Timing V2, Controlled Delay, Aggregate remain HOLD, original six-stage governed bodies unqualified, Permit false.
- **Final QCP exact blocker details (all 33 HEAD workflows terminal):** **30 SUCCESS, 2 FAILURE, 1 SKIPPED** at `baf7e62e...`. Frozen V13 fails separately `40183241606`; central QCP fails `40183241532` after non-fail-fast blockers enumeration. New Stage3 exact-path check itself was `REQUALIFY` with `DIAGNOSTIC_PASS` (no permit, six native stage bodies not yet executed). Current QCP required failures: `V13_AUTONOMOUS_FORCING_FOUNDATION`, `V13_HOLISTIC_SCHEMA`, `V13_NEXT_TICK_VIABILITY`, `EA5C1_DURABLE_RAW_RESTRICTED_INGRESS`, `PHASE3_EVIDENCE_RUNTIME_FOUNDATION`, and `PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION`. All six encounter `DA9_SEMANTIC_SUCCESSOR_COMPOSER_SCOPE_CHANGED`: frozen DA9 successor contract pinned isolation Composer Git blob `7e74b1df502e159dd49ceb21889cbfff86408e50`, whereas corrected Python factory wiring yields current Composer blob `2d1f72d92c05093537774285bda5b7200845344d`. No legacy six-signature proof is valid for new exact source; one additional PHASE3 historical digest mismatch (`dependency_digest_match=false`) is explicit. Required is independently fresh exact-code successor six-check review and evidence + PHASE3 digest reconciliation, **not** editing the old immutable Composer blob allowlist or using old signatures as new authorization. General CI and EA5E2 are **PASS**, formal merge blocked by 2 governance workflows. Exact source review: https://github.com/liyongshang44-max/GEOX/pull/3731#issuecomment-6396378793
- **Engineering handoff next:** (1) retain exact-head CI and EA5E2 PASS while resolving central QCP six-check new Composer-blob requalification and PHASE3 dependency digest, (2) handle inherited Frozen runtime semantic drift as independent historical qualification, no invented green checks, (3) build a nonauthorizing fresh-isolation retained-Raw causal freshness/identity negative-first gate; refuse source-time-incompatible targets. New DB write requires separately approved fresh isolated setup; no original lease/Permit/time bypass, no repeated 223-GET acquisition, no automatic authorization.
- Evidence and code review note: https://github.com/liyongshang44-max/GEOX/pull/3731#issuecomment-6396353015

---

### 2026-10-25 new observed physical checkpoint — preserved original Candidate Phase7 OFFLINE semantic replay PASS; original Fenced PG still HOLD

- **Actual operator Windows PowerShell5.1 -Execute result:** after isolated child environment static PASS (former inherited `DATABASE_URL` HOLD removed without disabling guards), original retained case `b06f28c950ce` and exact fixed candidate offline source `5c9c0218253b1e5e549952da1b9dde11f1ed07bd` successfully replayed authentic candidate-bound GFS/KBS retained raw. KBS was **GET-only** 200.27 KiB from prior isolated S3; existing 212.54 MiB GFS retained raw reused. Original algorithm `ExternalFormalPrivateCandidateCapturePromotionV1.rehydrateCandidate()` completed two SHA-verified local Raw reads and verified the complete three-record semantic manifest (record type, source record ID, semantic SHA256): `future_et0_assumption_v1`, `future_weather_assumption_v1`, `soil_moisture_observation_v1`. stdout: `PASS_PRESERVED_RAW_ORIGINAL_PHASE7_SEMANTIC_REPLAY_TEST_ONLY_NOT_FENCED_PG_NOT_TIMING` and `CAP09_CLEAN_CHILD_ENV_ONE_OFFLINE_REPLAY_PASS_TEST_ONLY`.
- **Result scope:** offline replay receipt status `PASS_CANDIDATE_PHASE7_SEMANTIC_REHYDRATION_LOCAL_SHA_VERIFIED_ONLY`, original Candidate SHA `acb1bb7fb10b5519168e89e56cc0bafa40f156dd45736b4e08555d82050a9c16`; `raw_reads=2`; `provider_calls=0`, `pg_writes=0`, `s3_writes=0`, `permit=false`. On-screen receipt location `D:\gptdown\CAP09-WCANDIDATE-OFFLINE-5c9c0218\public-receipt\CANDIDATE_PHASE7_OFFLINE_SEMANTIC_V1.json`, operator-reported SHA `591534ce9c58746b29e39f5727152b958526760755dc83b0b29e7e2adcb6bf7e`. **Independent uploaded-receipt verification completed:** actual operator-provided `CANDIDATE_PHASE7_OFFLINE_SEMANTIC_V1.json` parsed as valid JSON (1,505 bytes; 30 top-level fields), and its independently recomputed complete file SHA256 is **`591534ce9c58746b29e39f5727152b958526760755dc83b0b29e7e2adcb6bf7e`**, exactly matching the original Windows terminal output. Original source, run, candidate digest, three record-type names, `verified_raw_files=2`, `semantic_manifest_matched_by_original_phase7=true`, and all declared zero-effect/false-authorization fields match the previously reported receipt. **This independently proves receipt byte integrity and consistency with operator stdout, not a second independent raw scientific execution:** actual GFS/KBS bytes and individual record semantic hashes are not embedded in this public JSON; treat runtime science/semantic PASS as operator-observed, source-backed TEST_ONLY. Unexpired-at-run Phase7 original wall-clock gate `2026-10-25T17:00:00Z` remained active; do not reuse after expiration.
- **Interpretation:** the previous post-capture Windows GFS Phase7 failure is now strongly accounted for by the missing pinned Python interpreter path in the isolated rehydration factory; source-level fix and original real Raw semantic replay both PASS at their own scopes. Old Windows original Producer, Fenced PG commit, lease/cursor/facts advancement, and original Timing/Delay/Aggregate still HOLD. Original PG `facts=0`, Target PROMOTING stale, Controller/Target lease expired; never renew old token/lease, mutate old DB, refetch 223 Provider GETs, or reuse old DA9 Permit.
- **Engineering admission remaining:** #3731 Draft/Open/unmerged HEAD `bc22089265ab27b213119580aba40b229ac9dac3`; scoped CI `40179878605=SUCCESS`, required general CI `40179878585=FAILURE` (server Fastify onReady hook timeout), separate EA5E2 graph `40179878627=FAILURE` (central applicability plan dependency-closure). Diagnose required CI independently before merger. Only then review safe new isolated TEST_ONLY run/epoch/PG/S3/Controller/Claim and lawful target/source freshness; original retained Raw cannot be relabeled as newly fetched live Provider Timing. No Permit/no formal execution grant. Specific engineering record: https://github.com/liyongshang44-max/GEOX/pull/3731#issuecomment-6396099932

---

### 2026-10-25 addendum — preserved Candidate original Phase7 offline V1 inherited DATABASE_URL HOLD; FIX V2 quarantine

- Genuine operator attempted downloaded **V1 external original Phase7 Candidate replay** on retained Windows case `b06f28c950ce`, no `-Execute`. Immediate `HOLD_INHERITED_AUTHORITY_ENV_DATABASE_URL` from PS5.1 entry line 37, BEFORE any local Candidate/Raw read, docker/PG/S3 access, source clone, Python or Provider. This is deliberate inherited-production DB-env fail closed, not evidence of scientific/semantic failure and not a mutation; old original case untouched. V1 operator ZIP SHA256 `146b7c26e44b8827e166d15429f93c3ff4f88a93a7966e25044cd5ed67da0a75`.
- Inspected V1 exact external ZIP/source. Prepared **external operator kit FIX V2** `MCFT-CAP09-PRESERVED-CANDIDATE-PHASE7-OFFLINE-FIX-V2.zip`, ZIP SHA256 `95024f74b561af746a9c22f78cc92d72b21841d4ab7b411de0d299069694460b`, launcher SHA256 `ea6445ef5f3f3a6cce289de927bcaa1a1b31142c74db7641ab56b5b57e44494f`, ZIP CRC and manifest digest/static safety checks PASS. **Windows V2 run UNOBSERVED.**
- FIX V2 does **not** remove security checks. It captures current process-only `CI`/`GITHUB_ACTIONS`, `DATABASE_URL`, official Permit/Adoption, PG/libpq, Phase7 S3 and AWS credential env values in temporary script memory, clears these exact names only for a test-only subprocess phase, explicitly validates they are absent, restores all in `finally` even on failure, never logs secret values. Existing exact source/old SHA-verified Candidate and GFS tar, Node24, Python3.12, PG SELECT only, MinIO GET only, no Provider/PG writes/S3 mutation/Permit remain untouched. No spoofed CI.
- Candidate source `5c9c0218253b1e5e549952da1b9dde11f1ed07bd` preserved as exact offline replay, with #3731 active Draft branch still stacked on #3730. Original Candidate expiry **2026-10-25T17:00:00Z** is real hard gate, must never override by clock spoof/replay; V2 preflight will HOLD if expired. Next operator checks new V2 ZIP in a new folder and runs **without** `-Execute` first; only if static PASS, one explicit offline replay to NEW diagnostic folder, no old case mutation. Earlier preserved GFS real 72h scientific offline PASS stands; Phase7 Candidate semantic rehydration and Fenced PG HOLD; Controller and Target lease expired, facts zero, Cursor incomplete; DA9 third attempt prohibited, Permit false; original three Timing/Controlled Delay/Aggregate HOLD. PR #3731 record: https://github.com/liyongshang44-max/GEOX/pull/3731#issuecomment-6395966733

---

### 2026-10-25 supplement — exact #3731 scoped offline replay CI PASS; general acceptance Fastify hook timeout FAIL

- At exact #3731 HEAD **`bc22089265ab27b213119580aba40b229ac9dac3`**, independent `mcft-cap09-stage3-candidate-python-path-offline-v1` workflow **`40179878605=SUCCESS`**. It typechecks both original pinned Python graph regression and saved Candidate semantic rehydration runner; verifies initial GFS decoder and Phase7 Candidate replay decoder use identical interpreter, preserved ingestion timestamp, 0 Provider/PG/S3 requests. **Scoped code regression only**, no real Windows replay performed and no formal qualification.
- **Explicit separate repo CI failure** `40179878585=FAILURE`: `build-test=SUCCESS`; `acceptance=FAILURE` at `Start acceptance runtime dependencies`, Docker Compose reported `geox-v1-server unhealthy`, actual Fastify `FST_ERR_HOOK_TIMEOUT`/`onReady hook timed out`/`server_listen_failed`. This is a genuine failing required job: *do not claim all CI PASS or merge #3731*. Present logs do not prove the offline Candidate source caused the server startup failure. No acceptance workflow rerun or Provider scientific probe authorized by this note.
- Candidate test-only PS51 ZIP SHA256 `146b7c26e44b8827e166d15429f93c3ff4f88a93a7966e25044cd5ed67da0a75` is STATIC-VERIFIED only; do not imply Windows physical PASS before genuine operator log. Preserved old Case and old PG still read-only; future new Fenced PG only new isolated resources after Candidate semantics and causal review. Engineering comment https://github.com/liyongshang44-max/GEOX/pull/3731#issuecomment-6395880255.

---

### 2026-10-25 — #3731 pinned Candidate Python graph regression CI PASS; full preserved Phase7 semantic offline kit prepared; new Fenced PG remains HOLD

- **Gate1 fulfilled in code/CI**, not asserted as physical Windows Candidate admission: corrected isolated Composer `python_executable` forwarding from initial GFS capture to `ProductionExternalFormalCandidateRehydrationDecoderFactoryV1` (#3731 `60ae4a9c022eb545fa346732b2421668074fc060`). Exact implementation graph regression `scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_STAGE3_CANDIDATE_PYTHON_PATH_OFFLINE_V1.ts` + workflow `mcft-cap09-stage3-candidate-python-path-offline-v1`: initial corrected `40179435098 SUCCESS`, subsequent exact offline replay TypeScript compilation + graph regression `40179878605 SUCCESS`. It actually constructs source-level isolated Composer and checks Capture/Replay equal pinned executable, Candidate original ingested_at and normalize_et0; **0 DB/Provider/S3/Permit**. Initial `40179255760` failed during Linux Node24 native `better-sqlite3@9.6.0` install, not test; fixed limited constructor workflow with `pnpm install --frozen-lockfile --ignore-scripts` (no production or science bypass). New candidate source `5c9c0218253b1e5e549952da1b9dde11f1ed07bd`, workflow follow-on candidate head `bc22089265ab27b213119580aba40b229ac9dac3`; #3731 still Draft/Open and exact upstream #3730 stacked base.
- **Gate2 source created but Windows not run:** original production `ExternalFormalPrivateCandidateCapturePromotionV1.rehydrateCandidate` invoked for *offline forensic semantics* by new test-only TS entry `scripts/runtime_acceptance/MCFT_CAP09_STAGE3_PRESERVED_CANDIDATE_REHYDRATION_OFFLINE_V1.ts`, at exact source `5c9c0218...`. The operator ZIP `MCFT-CAP09-PRESERVED-CANDIDATE-PHASE7-OFFLINE-V1.zip` SHA256 **`146b7c26e44b8827e166d15429f93c3ff4f88a93a7966e25044cd5ed67da0a75`**, PS51 script SHA256 **`3041e4da6504af8b24c8543781851f410d5a21d2a92e0fb98cb7d61bbc7de2cc`**. ZIP CRC, per-file SHA manifest, source TypeScript compile PASS; PowerShell 5.1 / real Windows execution **NOT OBSERVED**. Kit delivered in chat, manifest local; original old case `b06f28c950ce` and failed PG/S3 snapshots never modified.
- **Operator path:** extract ZIP into new directory; run `RUN-CAP09-PRESERVED-CANDIDATE-PHASE7-LOCAL-PS51.ps1` without arguments for static-only proof; optionally run with `-Execute` **once** after static PASS while original Candidate unexpired. Test-only local output `D:\gptdown\CAP09-WCANDIDATE-OFFLINE-5c9c0218`, no new PG/MinIO. Reads old PG idempotency key in `BEGIN READ ONLY/COMMIT` (never state mutation); uses cached disposable `mc --pull=never` ephemeral S3 helper to GET only exact previous Candidate-bound KBS raw into new local private directory; original preserved GFS tar and Candidate JSON byte-verified with full exact digests. Runs original Phase7 Candidate private semantic rehydration on exact new code/pinned same Python 3.12 with **local digest-verified reader** and fake write ports that fail closed. Compares 3 raw-derived canonical semantic records to original Candidate Manifest. Print only public status/digests, not raw KBS/GFS/credentials. No public Provider requests or original Controller lease reuse; no S3 metadata HEAD port or real PG.
- **Candidate clock is real, never overridden.** Original `candidate_expires_at=2026-10-25T17:00:00Z`. If current UTC is >= target, script HOLD even if raw science bytes otherwise valid. Expiry is not automatically assumed passed; verification happens at actual use. No old Candidate reissue, clock manipulation or implicit source freshness claim.
- **Gate3 fenced PG remains HOLD pending Gate2 evidence:** if subsequent physical test necessary, allocate *new* disposable run namespace/PG16 database/MinIO bucket, new owner/controller/claim, valid lease and strict ACL. Reconstruct new Candidate identity/provenance from sha-verified original raw with honest original source times, recheck KBS/GFS freshness and target causality, no stale controller/claim or legacy old Candidate digest; no original DA9/Permit and never count offline replay as live Provider Timing V2. Need independent exact HEAD qualification, signed review only when original contract requires, and original Timing/Delay/Aggregate separate. No new PG job or public Provider probe launched.
- See exact PR comment: https://github.com/liyongshang44-max/GEOX/pull/3731#issuecomment-6395859914 . Handoff PR #3298 remains Draft/Open/Unmerged, previous entries intact.

---

### 2026-10-25 addendum — Windows PostgreSQL Controller/Target/Cursor actual READ ONLY state: PROMOTING stale; facts 0

- Operator ran actual Windows PostgreSQL via existing Docker PG `cap09-wfull-pg-b06f28c950ce`, isolated DB `mcft_cap09_requal_b06f28c950ce_positive`, `epoch_id=cap09-stage3-full-real-b06f28c950ce`, four read-only SELECTs under `BEGIN TRANSACTION READ ONLY; ... COMMIT;`, on-screen exit zero (no SQL exceptions).
- **Physical facts: `public.facts count=0`.** One Target: `state=PROMOTING`, `base_target_t=2026-10-25T17:00:00Z`, `fencing_token=1`, `lease_expires_at=2026-10-25T06:51:52.420Z` with `lease_valid_now=false`, `candidate_artifact_digest IS NOT NULL=false`, `formal_visible_attested_at=NULL`, `failure_class=NULL`. One Cursor: `completed=false`, `first_required_base=last_required_base=next_missing_required_base=2026-10-25T17:00:00Z`, `updated_at=2026-10-25T06:21:52.388036Z`. One Controller: `lifecycle_state=ACTIVE`, `fencing_token=1`, `lease_expires_at=2026-10-25T06:51:52.408Z` with `lease_valid_now=false`, no terminal reason/time. `ACTIVE` is **stored lifecycle state, not a currently live lease**.
- Source review on #3731 current HEAD `60ae4a9c022eb545fa346732b2421668074fc060`: original Continuity repository enforces current Controller and Target claim fencing, live lease and pre-target deadline for advancement/physical attestation. Original Candidate rehydration checks strict bound identity and pre-expiry. **No legitimate resumption with prior fence token=1 or an expired lease.** Preserved MinIO Candidate object demonstrably exists, but database Target's `candidate_artifact_digest` is NULL; do not imply Candidate commitment simply because MinIO object exists.
- **Accepted read-only statuses**: `ORIGINAL_WINDOWS_FACTS_ZERO=PASS`, `OLD_TARGET=PROMOTING_ABANDONED`, `OLD_CONTROLLER_AND_TARGET_LEASES=EXPIRED`, `CURSOR=NOT_COMPLETED`; `CANDIDATE_PHASE7_REHYDRATION=HOLD`, `ORIGINAL_FENCED_PG=HOLD`, original Stage Timing/Controlled Delay/Aggregate HOLD, historical DA9 third Permit prohibited. Old isolation assets frozen, preserved, no restart, no SQL UPDATE/DELETE, no lease takeover/renewal, no old Candidate expiry bypass.
- **Next engineering scope**: independently qualify Python-interpreter pass-through fix on new #3731 source. Separately design brand-new TEST_ONLY epoch and dedicated disposable PG/S3 namespace if retaining same GFS/KBS bytes via offline digest-verified copy. Must preserve immutable original raw source provenance and verify real data-time freshness, Candidate digest semantics, original idempotency/run scopes and new lease and causal deadline. A source-linked offline replay without NOAA GETs cannot be marketed as fresh KBS/GFS live collection or original V13 Timing V2. No new execution tool or Permit approved by this read-only receipt. #3731 engineering comment: https://github.com/liyongshang44-max/GEOX/pull/3731#issuecomment-6394769809.

---

### 2026-10-25 addendum — isolated Windows post-failure PG public.facts COUNT actual read-only 0

- Actual operator command read from existing Windows Docker `cap09-wfull-pg-b06f28c950ce`, DB `mcft_cap09_requal_b06f28c950ce_positive`, `SELECT COUNT(*) AS facts_total FROM public.facts;` returned **0 rows**. This is a live read-only observation, not a mock or a CI Fixture. No PG mutation, provider refetch, Permit or restart.
- Scope of proof is only `public.facts` in the named disposable test-only DB at query time. Does not prove zero controller/claim/cursor tables; earlier capture can still leave a PROMOTING or ACQUIRING claim or ACTIVE-but-expired Controller. Before any future isolated retained-raw recovery, query existing `public.twin_external_formal_forcing_base_target_v1`, `public.twin_external_formal_forcing_base_cursor_v1`, `public.twin_external_formal_forcing_controller_lease_v1` under exact `epoch_id=cap09-stage3-full-real-b06f28c950ce`, **strict read-only**; inspect deadlines and lease validity. No renewal/replay or clock override.
- Prev evidence remains: exact Candidate-bound 212.54MiB GFS Raw scientific offline PASS, source defect corrected on #3731 candidate `60ae4a9c022eb545fa346732b2421668074fc060` but not retroactive to original checkout `c1ed4a64b78a1a5346ac4159d98307de85ac4a6c`; original Phase7 rehydration/Fenced PG/Controller/three original timing/Controlled Delay/Aggregate HOLD; DA9 third formal attempt PROHIBITED. PR review: https://github.com/liyongshang44-max/GEOX/pull/3731#issuecomment-6394731074

---

### 2026-10-25 addendum — real Candidate-bound 212.54 MiB GFS Raw exact digest and frozen Windows 72h decoder PASS

- **Actual Windows user execution V2 offline diagnostic** on preserved run `b06f28c950ce`, original Stage3 source `c1ed4a64b78a1a5346ac4159d98307de85ac4a6c`, original exact isolated MinIO credential checks TRUE (user/password exact disposable patterns, actual secrets never logged/shared). Using **only existing preserved S3**, fetched exact SHA-addressed **private Candidate Manifest (3.26 KiB)** `sha256:acb1bb7fb10b5519168e89e56cc0bafa40f156dd45736b4e08555d82050a9c16` and the **Candidate-bound GFS retained raw tar (212.54 MiB)** `sha256:9e6b250ad698c20ac00174022865dfedfc3b8bed5caab7c3278e6b9c5cfcdc74`. Candidate-bound raw reference/byte length/SHA verified; physical GFS tar contains all 72 required lead times + 1 support lead and was successfully decoded on existing pinned Windows Python3.12 with **unchanged original GFS scientific Python product decoder**.
- Actual safe result `PASS_OFFLINE_REAL_GFS72_RAW_SCIENCE_ONLY_NOT_REHYDRATION`, `reason_code=null`, `decoder_diagnostic_tokens=[]`, **0 Provider requests**, **0 PG writes**, Permit false. Local metadata-only receipt `D:\gptdown\CAP09-WFULL-b06f28c950ce\offline-gfs-science-diagnostic-v2\OFFLINE_RETAINED_GFS_SCIENCE_RESULT_V1.json`, operator reported SHA256 **`0b1c86184fe516cbd6837d5fd83c777f127ae92c0ceee4cb97dfd2eccf1024b5`**. Private manifest, raw tar, stderr and 72h scientific decoded drafts remain on local Windows; user only shared safe stdout, not raw or receipt JSON.
- **Engineering implication:** Previous observed `PHASE7_PROMOTION_REHYDRATION_FAILED:MCFT_CAP09_GFS_SCIENTIFIC_SUBPROCESS_UNCLASSIFIED` after 223 original Provider GETs is no longer evidence of scientifically invalid GFS input. The omission of the pinned Python path in the isolated Candidate rehydration factory is a **strong source-backed root-cause hypothesis**; fix already committed on #3731 Draft at `60ae4a9c022eb545fa346732b2421668074fc060`, but old exact checkout/lease/fact receipt not retroactively modified.
- **Limits:** Offline GFS success **is NOT** original Phase7 Candidate semantic digest rehydration pass, restricted Fenced PostgreSQL 3-fact commit, Controller/Cursor advance, actual original Timing V2, Controlled Delay, Aggregate or final formal authorization. Old Candidate expiration and controller lease need independent check before any attempted replay; no stale lease bypass. Preserve `D:\gptdown\CAP09-WFULL-b06f28c950ce`, test-only PG16/MinIO containers and stored raw; **do not rerun V3 `-Execute` or refetch any NOAA/KBS**. Next take read-only postgres state/cursor snapshot and read-only Candidate semantic manifest inspection, then scope an explicit new nonauthorizing retained-raw recovery (never old Permit). Original governed stage executions **0/6**; third formal DA9 attempt PROHIBITED.
- #3731 engineering comment: https://github.com/liyongshang44-max/GEOX/pull/3731#issuecomment-6394685301

---

### 2026-10-25 addendum — offline retained GFS diagnostic V1 stopped before MinIO, FIX-V2 exact Candidate manifest reader

- **Actual Windows operator result:** V1 `RUN-MCFT-CAP09-WINDOWS-PRESERVED-GFS-OFFLINE-DIAG-PS51.ps1` on preserved `D:\gptdown\CAP09-WFULL-b06f28c950ce` stopped with `HOLD_NOT_DISPOSABLE_MINIO_CREDS` at line 44. This happened **before** its MinIO LIST/GET and before scientific offline GFS decoder invocation. It is **not** proof of invalid retained GFS science, and not an actual MinIO authentication failure (none attempted). No new Provider request, no PG write, no Permit, no original stage replay. Previous successful 223 live GET and failed rehydration physical evidence remain unchanged.
- Inspected exact V1 ZIP source: `@($json | ConvertFrom-Json)` + `Where-Object` may misinterpret Docker array-valued `.Config.Env` under Windows PS5.1, causing false user/pass-shape guard. This is a likely parser defect, **not an independently proved explanation of live credentials**; do NOT reveal real credentials to debug. Independent definite second bug: V1 expects **two objects in the whole Raw S3 prefix** though original composer retains individual GFS filtered/index/message objects (many), plus KBS and final tar. Only `CandidateManifest.raw_objects` should contain the **two final provenance objects**.
- New external `MCFT-CAP09-WINDOWS-PRESERVED-GFS-OFFLINE-DIAG-FIX-V2.zip` SHA256 **`523b1c1ff08c989415ff4fbed42263d8ce5700c5da779861cfc02b3b538d814e`**, PS51 SHA256 **`215097864dff4b1b3dd2c0dac61f9742136fa91f0bfd6ccc84e4ecc1d0330971`**, original offline Python verifier unchanged byte-for-byte SHA256 `23a354c9f20ca74f2367fa1bcb261c78a7309c4aacc7edabfdfd41072aec58d5`. ZIP CRC, file hash manifest, Python syntax and no-source-request static guard PASS; **FIX V2 Windows execution NOT observed**.
- FIX V2 is a dedicated preserved-case **read-only** diagnostic: require exact old source/subject + run receipt + named running MinIO and disposable Docker network; explicit foreach over Docker JSON env scalar strings; only display `user_exact` and `password_format` booleans plus secret length, never credentials; transient cached mc helper `--pull=never`, with MinIO endpoint secret inherited in process environment (not CLI argument) and restored in finally. Read only candidate S3 prefix, GET exact SHA-addressed private manifest, require exactly TWO raw_objects in it, choose GFS via original product decoder ID and verify raw digest/size/bucket, GET only this preexisting tar to NEW `offline-gfs-science-diagnostic-v2`. Run the unchanged frozen Python3.12 GFS product decoder offline, preserve private stderr/raw and print metadata-only receipt. Does not change any existing S3/PG/Docker service, no NOAA/KBS or Permit. Transient `mc` Docker helper is new ephemeral process/container only, not persistent resources.
- Next: operator verifies V2 ZIP sha256, unpacks into **new** directory, executes `RUN-MCFT-CAP09-WINDOWS-PRESERVED-GFS-OFFLINE-DIAG-PS51.ps1` once, reports only safe stdout metadata/receipt checksum. If still `HOLD_NOT_DISPOSABLE_MINIO_CREDS`, report the three booleans/length only—never raw MinIO environment, ROOT_USER or secret. Do not launch another V3 `-Execute`; do not delete preserved `b06f28c950ce` raw candidate or volume. Preserve #3731 source exact fix `60ae4a9c022eb545fa346732b2421668074fc060` Draft/unmerged; do not project candidate-specific interpreter fix onto unchanged old checkout. `WINDOWS_FULL_REAL_GFS_SCIENCE_TO_FENCED_PG=HOLD`, Original V13 Timing/Delay/Aggregate HOLD, third DA9 prohibited. PR #3731 forensic comment: https://github.com/liyongshang44-max/GEOX/pull/3731#issuecomment-6394634912.

---

### 2026-10-25 addendum — Windows real 223-GET GFS run Phase7 rehydration HOLD, pinned Python path fix and retained-S3 offline diagnostic

- **Actual operator Windows Node24.19.0/py312 nonauthorizing run** `D:\gptdown\CAP09-WFULL-b06f28c950ce`, exact source `c1ed4a64b78a1a5346ac4159d98307de85ac4a6c`, isolated DB `mcft_cap09_requal_b06f28c950ce_positive`, MinIO bucket `mcft-cap09-requal-b06f28c950ce`. Real environment+frozen science selftests PASS, fresh PG schema and isolated Evidence ACL: `4 tables`, `direct_facts_insert=false`, `fenced_execute=true`; MinIO private bucket created. Actual `223` source GETs and elapsed `939253 ms` (~15m39s), then **`HOLD_REAL_FULL_PROVIDER_OR_PHYSICAL_CHAIN`** at `PHASE7_PROMOTION_REHYDRATION_FAILED:MCFT_CAP09_GFS_SCIENTIFIC_SUBPROCESS_UNCLASSIFIED`. Actual local receipt `D:\gptdown\CAP09-WFULL-b06f28c950ce\physical-receipt\STAGE3_FULL_REAL_KBS_GFS_S3_PG_ONE_BASE_RESULT.json`, output exit=3; all new Docker PG/MinIO volumes preserved. Prior read-only MinIO snapshot `/data=129812 KiB`, 132MB network read / 132MB cumulative block write (not proof of all 73 science leads, no object inventory/receipt hashes yet). No final Fenced PG commit/attestation PASS and no original governed stages. Do **NOT** run any V3 `-Execute` again or destroy resource.
- **Source-level precise root-cause candidate** found in unchanged old checkout: initial real GFS capture factory honors pin `python_executable:input.python_executable`, but isolated Composer constructed **`new ProductionExternalFormalCandidateRehydrationDecoderFactoryV1()`** without the pinned path. Frozen product GFS decoder defaults to `python3` on PATH; Windows secured child has PATH restricted to `SystemRoot\System32`; a missing `python3` child creates ENOENT without stderr and normalizes to `MCFT_CAP09_GFS_SCIENTIFIC_SUBPROCESS_UNCLASSIFIED`. The observed failure location *after real capture* is consistent with this defect. It is a well-supported hypothesis, **not yet fully demonstrated from the real retained GFS tar**. No conclusion that real scientific GFS data itself failed.
- **Surgical source fix on #3731 Draft branch**, new exact HEAD `60ae4a9c022eb545fa346732b2421668074fc060`, only isolated Compose now sends `python_executable:input.python_executable` to `ProductionExternalFormalCandidateRehydrationDecoderFactoryV1`. No production scientific algorithms, standard production Composer, governed Host, Permit, Frozen upstream #3730 code or historical DA9 changed. #3731 remains Draft/Open/Unmerged, stacked base exact parent `12dcbba6750879f0349c5730f477cb04cd23b560`, after #3730 protected merge `2162f368899e9a9b5c497d332859e4196f389660` and real post-merge CI PASS.
- **External read-only offline kit** `MCFT-CAP09-WINDOWS-PRESERVED-GFS-OFFLINE-DIAG-V1.zip` SHA256 **`2a132ee930b56c8c5f495f9cb206a40da5d211979dccd70b76d4ee26e22ea8be`**, PS51 source SHA256 `e7d1d02e83528559dcb5276fcb244850c1f55329ebe5bffdfb9464c27499fa84`, Python helper SHA256 `23a354c9f20ca74f2367fa1bcb261c78a7309c4aacc7edabfdfd41072aec58d5`. ZIP CRC, file digests and Python syntax PASS in builder; **Windows live diagnostic not yet observed**. It only reads the existing test MinIO bucket with disposable locally extracted credentials (not printed), requires 2 retained formal raw objects, copies biggest GFS SHA-addressed tar into **NEW local** `offline-gfs-science-diagnostic-v1` directory, verifies SHA and 73-lead tar structure, invokes exact frozen product decoder using **pinned original case py312**, captures private stderr/decoder output and emits public metadata-only status. No public Provider, no PG, no original Host/Permit, no S3 writes, no Docker create/delete, no science algorithm modification. It will **not** re-run original Candidate reconciliation or reproduce identical semantic/available_at metadata; any scientific PASS is only offline source integrity, not Windows full-chain qualification.
- Next: run one offline GFS tar diagnostic on preserved case, inspect exact `OFFLINE_RETAINED_GFS_SCIENCE_RESULT_V1.json` and SHA; do not expose raw payload/credentials. Only after offline science proof, assess a distinct governed **non-authorizing**, expired-lease-aware, prior-candidate-safe reuse path; may require new immutable qualification subject, not a blind restart. Main tasks still: single full Windows source→Candidate→Fenced PG/PROMOTING→Controller attestation, three genuine Timing V2-equivalent samples, original Delay/Aggregate. `REAL_GFS_72H_SCIENCE=HOLD`, `WINDOWS_FENCED_PG=HOLD`, `ORIGINAL_V13_STAGE_COUNT=0/6`, `PERMIT_SIGNED=false`, `THIRD_DA9_FORMAL_ATTEMPT=PROHIBITED`. Full PR evidence at https://github.com/liyongshang44-max/GEOX/pull/3731#issuecomment-6394557187.

---

### 2026-10-25 addendum — actual Windows science-only V3 recovery PASSED, real KBS/GFS/PG still HOLD

- **Actual Windows PowerShell 5.1 operator execution** of `RUN-MCFT-CAP09-REPAIR-EXISTING-SCIENCE-ONLY-PS51.ps1 -CaseRoot D:\gptdown\CAP09-WFULL-101c17260497` produced `SCIENCE_SELFCHECK_PASS_EXISTING_VENV_NO_PROVIDER_NO_PG_S3_NO_PERMIT`. Candidate still #3731 exact `c1ed4a64b78a1a5346ac4159d98307de85ac4a6c`, #3730 upstream protected main merge `2162f368899e9a9b5c497d332859e4196f389660`.
- Python3.12 existing test-only venv installed `eccodes==2.47.0` Windows CP312 DLL, `numpy==1.26.4`, `refet==0.4.2`; `pip check` PASS; `python -m eccodes selfcheck` PASS, reports library ecCodes v2.47.0 at `...\py312-science\Lib\site-packages\eccodes\eccodes.dll`, definitions and samples mounted. Frozen `mcft_cap09_gfs_scientific_core_v1.py selftest` PASS (72 future weather, 72 ET0, 72 solar, 0 provider requests, no Twin/DB state mutations), frozen `mcft_cap09_gfs_raw_bundle_decoder_v1.py selftest` PASS (2 draft roles with 72 points each, no Twin mutation).
- Existing science-only receipt at `D:\gptdown\CAP09-WFULL-101c17260497\STAGE3_WINDOWS_SCIENCE_RECOVERY_ONLY_V1.json`, operator SHA256 **`98f4b272fa2e1de82684368fa080a46c8f64ac506f7f7c72070b829b4bf69f96`**. This receipt SHA is **operator-reported**; raw JSON not separately uploaded for independent hashing. Existing failed case preserved and not reused for live Provider.
- Decision: `WINDOWS_SCIENCE_DEPENDENCIES_AND_FROZEN_DECODER_SELFTEST=PASS`; **does not prove actual decoded NOAA GFS bundle or genuine data acquisition**. `WINDOWS_REAL_GFS_72H_S3_PG_ONE_BASE=HOLD_UNEXECUTED`, `THREE_ORIGINAL_V13_TIMING_SAMPLES=HOLD`, `CONTROLLED_DELAY_AGGREGATE=HOLD`, `SIX_GOVERNED_STAGES=HOLD_0_OF_6`, `PERMIT=false`, `THIRD_DA9_ATTEMPT=PROHIBITED`.
- Next operator sequence: V3 `RUN-MCFT-CAP09-WINDOWS-FULL-REAL-PS51.ps1` **static without `-Execute`**, then **one** explicit new disposable full live chain via `-Execute -PgPort 55480 -MinioPort 59280`, interactive literal phrase `START_NEW_WINDOWS_STAGE3_REAL_PROVIDER_TEST_ONLY`. This creates a new case and does not resume `101c17260497`; the frozen original Python scientific selftests are repeated inside the new case before Docker/network/provider. Preserve any future HOLD case, actual raw members, Docker volumes and failure diagnostics; **do not automatically re-request 224 NOAA GFS members**. No CI Provider probes. See PR #3731 comment https://github.com/liyongshang44-max/GEOX/pull/3731#issuecomment-6394308493.

---

### 2026-10-25 addendum — Windows full-real case 101c17260497 pre-resource Python wheels FAIL, isolated V3 science-only repair issued

- Actual Windows **`-Execute` test-only** from V2 launched fresh named case `D:\gptdown\CAP09-WFULL-101c17260497`, dedicated planned database `mcft_cap09_requal_101c17260497_positive` and MinIO bucket `mcft-cap09-requal-101c17260497`. Checkout exact #3731 SHA `c1ed4a64b78a1a5346ac4159d98307de85ac4a6c`, `pnpm install +392` PASS, effective inside-worktree Node v24.19.0 binary SHA `3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237` PASS. Existing case dir, source, isolated Python venv **created**, but error at **scientific pip dependency installation BEFORE Docker network/PG/MinIO/object store creation or any KBS/GFS HTTP**: `ERROR: No matching distribution found for eccodeslib==2.47.3.23`, `HOLD_PINNED_SCIENCE_DEPENDENCIES_EXIT_1`. The generic `PRESERVE_RESOURCE_CASE` marker is not evidence that Docker exists. Do not delete or blindly restart any named cases.
- Verified ECMWF official/PyPI Windows packaging: `eccodes==2.47.0` offers a CPython3.12 `win_amd64` wheel with built-in ecCodes C DLL; `eccodeslib==2.47.3.23` separate Linux/macOS binary package is not needed/available on Windows. Also **`refet==0.4.2` is source-only on PyPI**, so V2's global `--only-binary=:all:` would have rejected it. Preserve all scientific version/algorithm pins: `eccodes==2.47.0`, `numpy==1.26.4`, `refet==0.4.2`; install the first two as binary wheels, allow an isolated exact-0.4.2 `refet` source build with `--no-deps`. Run `pip check`, `eccodes selfcheck`, frozen scientific core `selftest` and raw-bundle Python decoder `selftest`; nothing waived.
- New external `MCFT-CAP09-STAGE3-WINDOWS-FULL-REAL-SCIENCE-FIX-V3.zip` SHA256 **`9d3588708356e0b99e0556e52759381c747a2c406c1a08502c5aa806d6a1aaba`**, main PS51 script SHA256 `89c5b272d9f3bf9ba05bd88549724893ae9855bffdb413d6796ff0117ea0e3c8` and **science-only recovery PS51** SHA256 `b35ef2cdbde7a90c0573237e7c0d423efde16d9519aaab345495f27c3c57b2d8`. Manifest file hashes and ZIP CRC validated; V2-to-V3 script diff limited to Windows dependency installation and environment-library-search scrub. **Windows actual FIX V3 selftest NOT YET OBSERVED**.
- First run **`RUN-MCFT-CAP09-REPAIR-EXISTING-SCIENCE-ONLY-PS51.ps1`** against the same failed `D:\gptdown\CAP09-WFULL-101c17260497`: it pins git worktree HEAD, existing Python venv, installs only pinned science packages and runs exactly frozen selftests. Creates one nonauthorizing local `STAGE3_WINDOWS_SCIENCE_RECOVERY_ONLY_V1.json` only on PASS; does **not** create or touch Docker/PG/MinIO, call NOAA/KBS, run original Host, consume Permit or resume live full chain. Do **not** run V3 `-Execute` before science selfcheck PASS. Explicit fresh V3 -Execute, when later requested, allocates **another** new disposable case rather than overwrite this frozen pre-resource HOLD case.
- #3730 protected merge/postmerge checks remain successful as previously recorded; #3731 exact candidate/stack still unchanged and Draft/Open/Unmerged. **No new CI public science retest.** `WINDOWS_FULL_KBS_GFS72_S3_PG_ONE_BASE=HOLD`, `ORIGINAL_V13_TIMING/DELAY/AGGREGATE=HOLD`, `formal governed bodies=0/6`, `historical_DA9_third_try=PROHIBITED`. PR #3731 V3 record: https://github.com/liyongshang44-max/GEOX/pull/3731#issuecomment-6394221311.

---

### 2026-10-25 addendum — Windows PS5.1 FIX V2 static pre-resource admission PASS

- **ACTUAL Windows operator log, not extrapolated from CI:** launched FIX V2 `RUN-MCFT-CAP09-WINDOWS-FULL-REAL-PS51.ps1` **without** `-Execute`. `PARENT_EXECUTION_ENV_SCRUBBED_KEYS=24`, upstream protected merge `2162f368899e9a9b5c497d332859e4196f389660`, #3731 pinned `c1ed4a64b78a1a5346ac4159d98307de85ac4a6c`, upstream source `12dcbba6750879f0349c5730f477cb04cd23b560`, Node `v24.19.0`, Node binary SHA256 `3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237`, Python base binary SHA256 `4d6f5f81a4bca11191c4c7c6b43632694d0a4ce74e068619d8fdc161d469859a`. Final marker **`STATIC_ADMISSION_PASS_NO_PROVIDER_NO_NEW_PG_S3_NO_PERMIT`**.
- Confirms V1 Python `-c` quote bug resolved by FIX V2 in Windows PS5.1; **no** new Docker/PG/MinIO/CaseRoot, GFS, KBS, official Host, Permit or scientific venv was run in this preflight. **FULL WINDOW PHYSICAL CHAIN STILL HOLD**.
- Next single explicit operator execution may use **same FIX V2 directory**, `-Execute -PgPort 55480 -MinioPort 59280`, new run-scoped isolated resources, exact interactive phrase `START_NEW_WINDOWS_STAGE3_REAL_PROVIDER_TEST_ONLY`. Script selftests Python3.12 scientific libraries and working-tree Node24 before initiating new resources/Provider. On failure preserve fresh case and raw data; do **not repeat public GFS members** before offline root-cause inspection. Only one actual Base targeted, no V13 original Timing/Delay/Aggregate authority. PR #3731 recorded log: https://github.com/liyongshang44-max/GEOX/pull/3731#issuecomment-6394140859.

---

### 2026-10-25 addendum — Windows native V1 static preflight PS5.1 Python -c quoting HOLD and FIX V2

- Operator actually executed the **static/pre-resource V1 preflight** only (no `-Execute`) on Windows PowerShell 5.1; V1 ZIP SHA256 `5365b029186d382c98846420810425e9279411833c0dc11f077386dea79b8d8d`. Output: `PARENT_EXECUTION_ENV_SCRUBBED_KEYS=24`, then Python printed `SyntaxError: print(%d.%d % sys.version_info[:2])`; PowerShell subsequently raised `InvokeMethodOnNull` from calling `.Trim()` on an empty native output pipeline. No `STATIC_ADMISSION_PASS`, no `-Execute`, no CaseRoot, no Docker resource, no public Provider request or Permit. This is **external PS5.1 argument marshalling and error-check order**, not science/PG failure.
- Exact V1 source reviewed: `print("%d.%d" % sys.version_info[:2])` in both original base Python and later venv Python `-c` expressions. Windows PS5.1 strips interior embedded quotes in certain native command invocation paths. Original code invoked `.Trim()` on pipeline output **before** checking `$LASTEXITCODE`. No script source/PR/Permit modification needed.
- Built external replacement `MCFT-CAP09-STAGE3-WINDOWS-FULL-REAL-FIX-V2.zip` actual ZIP SHA256 **`8108990bdb1b44a500b09a6416aaa9611304704495e9e9a03c3c3b35480bc011`**, revised PS51 runner SHA256 **`c852c77978cf78c35774ed505d5b848782bcaec66536bbc2a1020621fd4ad585`**. Uses quote-free `import sys;print(sys.version_info.major*100+sys.version_info.minor)`, exact output `312`, checks Python exit first, validates one nonempty output line and real absolute Python file before interpreting version; same correction for later venv. ZIP CRC + per-file hash manifest + static guard assertions PASS. **Windows V2 run unobserved**. V1 retired; unpack V2 in a new directory without overwriting old script, run **without -Execute** first and require `STATIC_ADMISSION_PASS_NO_PROVIDER_NO_NEW_PG_S3_NO_PERMIT`. Only later consider `-Execute` with fresh resources and operator consent after static pass.
- Exact engineering relation unchanged: main `2162f368899e9a9b5c497d332859e4196f389660` (#3730 protected MERGED), #3731 candidate `c1ed4a64b78a1a5346ac4159d98307de85ac4a6c` Draft/Open/Unmerged, still stacked on `12dcbba6750879f0349c5730f477cb04cd23b560`. No CI or Provider reruns ordered. No third formal DA9 try, no signed/consumed Permit; original 6 stage bodies 0/6. Full Windows real KBS/GFS 72h science/S3/PG remains **HOLD**.
- PR #3731 failure and V2 fix comment: https://github.com/liyongshang44-max/GEOX/pull/3731#issuecomment-6394115563

---

### 2026-10-25 addendum — post-merge exact main PASS; new Windows-native full Provider kit issued (NOT EXECUTED)

- Real protected main merge SHA **`2162f368899e9a9b5c497d332859e4196f389660`** verified after #3730 merged, including **POST-MERGE exact-head** `ci 40164149349=SUCCESS` (both build-test, acceptance), `EA5E2 successor 40164149354=SUCCESS`, and `Formal-v5 post-graduation 40164149357=SUCCESS`. These are post-merge code/CI results, not production owner or DA9 execution authorization.
- #3731 retains **precise stacked base `12dcbba6750879f0349c5730f477cb04cd23b560`** (now a parent of protected main merge), remains Draft/Open/Unmerged. Windows-specific test-only commit `d034b4ffdbd31354586bf59e80d9a63e13664282` adds `MCFT_CAP09_WINDOWS_STAGE3_NEW_ISOLATED_PG_BOOTSTRAP_V1.ts`, `MCFT_CAP09_WINDOWS_STAGE3_REAL_FULL_PROVIDER_ONE_BASE_V1.ts`, and optional test-only `python_executable` forwarding from the isolated Composer into the original GFS scientific decoder; unchanged frozen production Wrapper/Host/Permit. Follow-on #3731 candidate **`c1ed4a64b78a1a5346ac4159d98307de85ac4a6c`** removes automatic PR triggers on the two repeated public KBS/GFS source science probes (now manual-only), and canceled duplicate runs `40164456052`, `40164456057` through control workflow `40164575404=SUCCESS`. **No further repeated Provider scientific preflight**.
- New **external Windows native nonauthorized full single-Base** kit `MCFT-CAP09-STAGE3-WINDOWS-FULL-REAL-V1.zip` SHA256 **`5365b029186d382c98846420810425e9279411833c0dc11f077386dea79b8d8d`**, PS51 main script SHA256 **`5d753b2c51b82ca2a742d03df50a03321c1eded4e183803a1ac3027dcd154234`**; packaged ZIP CRC / manifest SHA / source static guards PASS, **Windows actual PS5.1 execution NOT OBSERVED**. Download link supplied in conversation. The kit pins exact #3731 candidate and upstream merge/main SHA; resolves absolute Node 24.19.0 real binary (Volta worktree Node20 guard) and authentic Python 3.12 local venv with pinned `eccodes==2.47.0`, `eccodeslib==2.47.3.23`, `numpy==1.26.4`, `refet==0.4.2`, scientific selfcheck before Docker/Provider. Runs one fresh exclusively named test-only Docker network, PG16, MinIO bucket/volumes, restricted Evidence login, actual KBS/GFS 72h Provider, raw retention, authoritative science, Candidate, fenced 3-fact PG transaction, Controller/Cursor and per-phase local measured durations; retains all resources on HOLD. Does **not** spoof CI/GITHUB_ACTIONS, inherit old database/ticket env, execute governed Host, use Permit, reuse previous DA9/stage2/stage3 DB/S3, or auto-retry public source. By design only ONE real Base, **not** three real Timing V2 samples, original Controlled Delay or Aggregate.
- Windows operator may first run `RUN-MCFT-CAP09-WINDOWS-FULL-REAL-PS51.ps1` without `-Execute` for **static no-IO qualification**. To start a single fresh case after inspecting manifest/kit SHA, run `& $Dir\RUN-MCFT-CAP09-WINDOWS-FULL-REAL-PS51.ps1 -Execute -PgPort 55480 -MinioPort 59280` and provide literal interactive phrase `START_NEW_WINDOWS_STAGE3_REAL_PROVIDER_TEST_ONLY`. Do not use existing ports/volumes or old Permit. Before true source acquisition, program checks exact clone+Node24+Python+binary/dependency hashes, then creates only brand-new resources. If source/decoder/PG fails, never restart fresh GFS fetch blindly: preserve named MinIO, stored Raw, Python diagnostic and PG readback, inspect locally.
- **Final HOLD unchanged:** Actual Windows full chain `UNOBSERVED`; original governed Producer/Timing/Delay/Aggregate `0/6`; actual three independent *real* Timing V2 semantic samples `MISSING`; original V13 Aggregate and Controlled Delay `NOT ADMITTED`; historical DA9 `da9db7129607` third attempt `PROHIBITED`; Permit `NOT SIGNED OR CONSUMED` on these new nonauthorized test paths. Do not convert postmerge CI or kit issue into scientific/physical PASS.

---

## 2026-10-25 — CTO revised sequence: #3730 PROTECTED-MAIN MERGED; Windows full real Provider chain remains HOLD

> This entry updates the **MCFT CAP-09 engineering branch handoff only**. Earlier DA9 production Retry/Adoption discussions and all historical evidence remain unchanged below; do not interpret this as new DA9 authorization. Reconciled against real GitHub PR/check/run state on 2026-10-25 UTC. Source of truth remains the original per-run artifacts.

### A. Exact-head protected-main outcome (upstream #3730)

- **DONE, real GitHub merge:** PR **#3730** frozen candidate `12dcbba6750879f0349c5730f477cb04cd23b560`, formerly based on main `2b63652297bb285f21c4d4c63c37d247d009142c`, marked Ready-for-Review after explicit engineering code-merge disposition, then merged through GitHub's **protected PR MERGE** action (not direct push, not squash, no ruleset bypass). Actual new protected **main merge commit `2162f368899e9a9b5c497d332859e4196f389660`**; #3730 is **CLOSED/MERGED** as of `2026-10-25T05:03:38Z`. Full source HEAD SHA preserved as a merge parent. Exact review: https://github.com/liyongshang44-max/GEOX/pull/3730#issuecomment-6393708262.
- Before merge the active `main-strict-delivery-v1` ruleset's eight mandatory check contexts had successful exact-head results: `acceptance`, `build-test`, `mcft-delivery-policy-v2-contract`, `mcft-candidate-integrity-pr-selftest`, `mcft-release-lane-pr-selftest`, `mcft-main-ruleset-readiness-v1`, `mcft-candidate-integrity-enforce-current-pr`, `mcft-release-lane-enforce-current-pr`. `QCP 40081244580` 55 checks: **50 PASS / 0 FAIL / 5 N/A**, no unknown paths; `ci 40081244655` SUCCESS; separate Frozen semantic successor `40081244456` SUCCESS, EA5C1 `40081244536` SUCCESS; independent actual **Windows Stage2** `af64cc3aa84e` source `12dcb...`, uploaded ZIP `153940c988485e074fbc8475beadec05f306faa09de38c157860d644184564be` verified. QCP reviewer Ed25519 signatures are **not Permit authority**.
- Exactly **three historical nonrequired checks remain explicitly FAIL**; do not edit/relabel/replay them: (1) old frozen `qualification-contract` `40081244691` demands a zero-diff frozen 108-file graph, necessarily fails this intentional two-runtime-file semantic change; the **separate** current Frozen successor contract passed. (2) old `exact-base-fact-promotion` `40081244515` and (3) old `fenced-fact-promotion` `40081244623` each reject the newer adopted protected-main baseline `2b636522...` at a hard-coded historical predecessor gate **before real PG cases ran**; no legacy SHA allowlist bypass. Their FAIL state remains part of review, not accepted historical functional PASS. Reviewed code delta: optional `ISOLATED_QUALIFICATION_ONLY` retention descriptor enforces 12-hex new run ID, 40-hex exact subject, run-scoped bucket and content-addressed raw key; omitted descriptor keeps the strict formal production bucket; signer and Host retain/add independent signed physical evidence checks.
- **Post-merge qualification still distinct:** at time of this handoff, on merge commit `2162f368...`, `ci 40164149349`, EA5E2 successor `40164149354`, and Formal-v5 post-graduation `40164149357` were **IN_PROGRESS**, **not yet PASS**. Read back actual completion against that exact merge commit before representing new main as fully accepted. GitHub code merge itself **does not authorize** DA9 Permit, production owner, operational database, historical Run replay or original governed six-stage execution.

### B. Downstream #3731 strict relation and Windows evidence

- #3731 remains **DRAFT/OPEN/UNMERGED**, exact subject `1ca135ef2d3fd0bcf5241593417ff798afa3af03` before any new Windows-native source update, stacked base still `12dcbba6750879f0349c5730f477cb04cd23b560` (the just-merged #3730 frozen source). Rebase/retarget/requalification onto protected merge SHA `2162f368...` must be explicit and source-bound; never infer pass via #3730 merge alone. Stage3 Windows **four TEST-ONLY physical primitive roles** existing case `c8b2ea29c9f1` Node24 PASS; actual uploaded ZIP SHA `a2152664791dab2ccbe647e6601e68ef5c18b7db0f7787c7b56be696a102e024`, CRC/101 offline checks passed. But all four declared **`original_stage_executed=false`**, zero of six governed V13 originals and zero Permit.
- SCIENCE READONLY preflight `40158796932=PASS` accepted as final repeatable preflight input; **NO repeated public Provider probing for this same aim**. True KBS Soil: 289 samples, 25 hour buckets, 5-min max gap. GFS availability: cycle `2026-10-24T18Z`, forecast leads 15–86 and support lead14. These are *not* full GFS member science and not true Windows multi-phase timing.
- Real full CI Provider source run **`40159238282=FAIL`**, not merely pending: actual **224 network GETs**, test-only 2 private MinIO retention events, full GFS bundle acquired, then fail at **`REAL_GFS_SCIENTIFIC_72H_DECODE`** with **`MCFT_CAP09_GFS_SCIENTIFIC_SUBPROCESS_UNCLASSIFIED`**. HOLD artifact `12585921552` ZIP SHA `f826b9957137c53543b03428b46f8b78910a4651e1386bf17f0be7d77fe1a9b0`; no scientific PASS, no PG fenced facts. Distinguish proven complete 224 HTTP requests and retained GFS bundle from **unproven decoder-qualified 72h**. Prior CI lacked the frozen Python3.12 scientific dependencies; **a plausible but unproven failure cause** because stderr diagnostic is masked. Frozen `.github/workflows/mcft-cap-09-v13-exact-head-timing-sample.yml` pins `eccodes==2.47.0`, `eccodeslib==2.47.3.23`, `numpy==1.26.4`, `refet==0.4.2`. **Do NOT repeat mass public GETs just to debug local Python**. Side CI `40159496303=FAIL` correctly refused PG because required full-source science PASS artifact was missing (no new PG/S3 allocation). Redundant `40159496253=CANCELLED`. Heavy GFS workflows switched to explicit manual dispatch to prevent repeated collection.
- Historical DA9 `da9db7129607` consumed Permit and frozen postfailure PG/S3 WORM evidence must remain untouched. Other existing isolated Windows cases `af64cc3aa84e` Stage2, `c8b2ea29c9f1` Stage3 and failed `971899e1c236` must be **preserved** pending independent disposition. Do not reuse old Permit, identity, DB, Bucket, or Run. Third formal attempt **PROHIBITED**.

### C. Locked execution order and evidence gates

1. **#3730 protected merge done**, but verify **exact post-merge main CI/EA5E2/Formal-v5 outcomes** and classify residual historical FAILs as above (never overwrite). Keep #3731 upstream parent relationship intact until explicit main re-anchor review.
2. Create a **native Windows PowerShell 5.1 nonauthorized launcher** for **actual Node 24.19.0**, using its **absolute binary `process.execPath` inside the cloned worktree** (GEOX Volta may otherwise pin 20.11.1), actual Python **3.12** absolute executable, exact immutable npm lock and git subject / source bytes, ECCODES/NumPy/refet dependency import/selfchecks. Ensure no `CI=true`, no `GITHUB_ACTIONS=true` spoofing: independent Windows-exclusive entry and fail-closed ProcessStartInfo inherited execution/DB/Permit env guard. Launch the actual production business/Provider modules via an isolated, test-only adapter without invoking signed Host `--execute`.
3. Before **any new full GFS member download**, allocate only brand-new **disposable** PG16/MinIO dedicated network, unique ports/bucket/role, zero-row and positive/negative ACL, scratch output and immutable local evidence. Acquire actual KBS and **same-cycle GFS 72h members once** with original provider cadence; preserve each raw member plus entire bundle and manifest on disk/MinIO BEFORE Python scientific decode. On decode failure **retain raw inputs, subprocess stderr diagnostic, dependency hashes and SHA for offline/local decoder retry** (no repeat NOAA calls). After full science PASS run Candidate→restricted PG Fenced Promotion→Controller/Cursor physical attestation; measure true per-phase local HTTP/science/S3/PG elapsed durations, keep stage-run IDs/source hashes.
4. Independently obtain 3 genuine physical Timing V2-equivalent samples. Only after that evaluate real Controlled Delay and original Aggregate **semantics** using nonauthorizing adapters; official governed stage body count remains 0/6 and does NOT inherit constructor/fixture/CI PASS. Never use CI-local pass as Windows approval. A Windows fully signed reviewer receipt and later governance are separate steps; **no one-shot Permit now**.

**Current disposition:** `#3730=MERGED_CODE_ONLY`; `#3731=OPEN_DRAFT_SOURCE_STACKED`; `CI_KBS_GFS_READONLY_PRECHECK=PASS`; `COMPLETE_REAL_GFS72_SCIENTIFIC_QUALIFICATION=HOLD`; `WINDOWS_NODE24_FULL_REAL_CHAIN=HOLD`; `CONTROLLED_DELAY_AGGREGATE_ORIGINAL_TIMING=HOLD`; `DA9_THIRD_ATTEMPT=PROHIBITED`. No assistant can execute commands on user's Windows host; require actual Windows receipt before physical PASS.

---

## 2026-10-24 — Corrected Renewal tool raw-byte vs canonical Material digest

- Actual Windows initial integrated renewal HOLD: IMMUTABLE_BYTE_SHA_MISMATCH:installed-material.json, without signing Adoption/Permit or launching stages. Original process Path/Python restored. This was an EXTERNAL HELPER defect, not a frozen Runtime material mismatch.
- Root cause: helper SHA.profile a68e32fef887e2c22525269bb7839010b9b77e43a0c843c32c93f3ee937e8150 is official canonical c.digest(material), NOT file-byte sha256. Original code incorrectly compared it with sha(fs.readFileSync(profile)). Verified official frozen contract.cjs digest(v)=sha(canonical(v)).
- Fixed external helper ZIP MCFT-CAP09-DA9-2B636522-RENEW-ADOPTION-AND-V3-REVIEW-FIXED-V2.zip, sha256 e5bddf3bcfb31fe5f1af361cefa46ea1d4b98d66175142607d2aeb69c04e9639. JS sha256 34bb19d85c54fc25f81a1a151bcd9f4c45ebddcde6cdce0faf409e89e5bea8ce. Removed profile from raw-byte SHA set only; retained official canonical profile digest assertion and genuine frozen signer/offline verification; all other signed/historical file-byte anchors remain fixed.
- Node syntax, ZIP CRC, static regression guard and dynamic proposal tests PASS locally; Windows V2 execution NOT YET OBSERVED. Existing real DB/MinIO/Closure diagnostic PASS, ACL catalogue obtained but ACL policy/Owner/prod-boundary unverified. Fresh 300s resource witness and Permit do not exist.
- New operator Windows action: download V2 ZIP; check exact ZIP SHA; extract to NEW D:\gptdown\MCFT-CAP09-DA9-RENEW-V3-FIXED-V2; run RUN-DA9-RENEW-ADOPTION-AND-V3-PS51.ps1; review and genuinely approve TEST_ONLY new Adoption+unsigned V3 reviewed plan. Preserve old prior 19Z plan; use actual new strict capacity cutoff.
- Next after signed renewed Adoption is not another isolated static diagnostic: complete genuine ACL/Owner/prod binding source evaluation, official complete V2 Observations / short lived genuine 300s witness, one shot signed Permit, official --preflight-only, explicit six-stage --execute under strict current budget. Never invent booleans or consume an expired Permit. 0/6 stages, production false.

---
## 2026-10-23 — Real 2b636522 Windows PG/MinIO/Closure READONLY diagnostic PASS, dynamic Admission still HOLD (LATEST; actual stages 0/6)

Operator actual Windows shell at approx **2026-10-23T15:37Z**, after accurate existing `qual_admin` password entered *privately* (not revealed), using the exact external 2b636522 helper completed genuine resources:
```text
DA9_2B636522_SIGNED_INPUTS=VERIFIED_TEST_ONLY_NOT_PERMIT
DA9_REAL_PG_TWO_DATABASES_29_TABLES_ZERO=PASS
DA9_POSITIVE_EVIDENCE_LOGIN=PASS_READONLY
DA9_NEGATIVE_EVIDENCE_LOGIN=PASS_READONLY
DA9_REAL_MINIO_FOUR_ZERO=PASS
DA9_2B636522_REAL_FRESH_CLOSURE_CHECK=PASS_AT_OBSERVED_TIME_NOT_PERMIT
status=REAL_PG_MINIO_CLOSURE_DIAGNOSTIC_PASS_NOT_ADMISSION
```
Diagnostic output `D:\gptdown\MCFT-CAP09-DA9-2B636522-REAL-READONLY-DIAGNOSTIC-20261023T153700794Z\da9-real-resource-gate-readonly.json`, exact SHA256 **`53bfd03a949a42c76bded3a6ef8241252a7e906daf875758c97e8ddf135b9c13`**; real child exit code **0**; original PowerShell process env restored. Tests used actual signed Adoption & Retry V2; immutable historical MinIO Closure signature bound to a new 4-zero snapshot; both DA9 dedicated PostgreSQL databases 29 tables, all zero rows and 2 routines, plus login proof for independent positive/negative low-privilege Evidence accounts. Freshness was reported `WITHIN_240_SECONDS_AT_WRITE_ONLY` at the time the report was written. This receipt is **not** a renewable 300s Admission and will be stale by the next signing attempt if more than 300s from start.

**Explicit still-HOLD:** Report truthfully states `full_dynamic_admission=false, owner_isolation_verified=false, production_bindings_verified=false, acl_matrix_verified=false, permit_signed=false, permit_consumed=false, real_stage_receipts=0/6, production_authorized=false`. These are not booleans to manually change: no full table-role privilege matrix, no independent current production owner cutover/bindings audit or Owner isolation proof, and no true signed V3 Permit/Host preflight. Previous routine/historical DB and MinIO evidence must not be erased or treated as unconditional authorization. Original first attempt Provider call count/phase UNKNOWN.

**Next investigation and new external helper prepared:** `MCFT-CAP09-DA9-2B636522-ACL-CATALOG-READONLY-V1.zip` SHA256 **`54d79d65a278ff04985660361a75a368a008c63c87d3548bbd196f753cc21cb8`** containing a self-contained PowerShell 5.1 runner and Node `DA9-2B636522-ACL-CATALOG-READONLY.cjs`, README. It uses only the *existing Windows DPAPI protected* 2 Evidence login URLs, no audit password or MinIO keys, transient stdin secret delivery, read-only catalog queries on localhost:55445. Produces exact 2-DB/29 table public ownership + effective SELECT/INSERT/UPDATE/DELETE rights *for each authenticated Evidence role*, 2 public routines, visible run-local role properties and potential PG foreign servers/foreign-table/dblink links. No DB/S3 write, Provider, Permit, output overwrites or stages. Node syntax, ZIP integrity, offline fake PG positive 29/2 + negative endpoint/DB mismatch tests PASS; **NOT yet run on genuine Windows**, no real ACL conclusion. Crucial: its status always `READONLY_PG_ACL_CATALOG_CAPTURED_REVIEW_REQUIRED_NOT_ADMISSION` and `owner_isolation_verified=false`, `production_bindings_verified=false`, `acl_matrix_verified=false` until separately reviewed role matrix, Twin ACL and owner/production provenance. Never reuse this catalog snapshot as last-300s full Admission.

**Temporal hard stop:** current 19:00Z FirstBase with 180+15min budget expires strictly **before 15:45:00Z** for official final Permit consumption; existing official Adoption expires **22:04:41.173Z**. Check current real Windows time before all further steps. If strict cutoff missed, do NOT sign/consume or use old 19Z unsigned V3 plan; new FirstBase and reviewed budget required, and likely *freshly signed Adoption* under existing valid Scope Grant because current Adoption cannot cover three later timing base hours and full cap. No new Runtime/Subject/QCP/material/Retry signing unless policy actually requires. Handoff #3298 remains Draft/Open/Unmerged; main still 2b636522.

---

## 2026-10-23 — Actual 5526 legacy JS verifier uploaded; current 2b636522 read-only diagnostic adapter built (NOT WINDOWS RUN) — stages 0/6

User uploaded actual `D:\gptdown\MCFT-CAP09-DA9-LIVE-VERIFIER-SOURCE.zip`. Local ZIP integrity **PASS**, exact ZIP SHA-256 **`6c4ad6ddf95c72c4f9f7c1054ea4b3bd9f266d8bcbe1f6efc5380de29db8d612`**, sole `verify-live-resources.cjs` (12,338 bytes) SHA-256 **`24a294d884c66b45ef4f01614515f4c9853abbe80d1feeef79eb4a794098e1c5`** exactly matches user Windows. Cross-inspected along with two earlier original 5526 `.ps1` byte-verified scripts.

**Real old JS capabilities (read source, not simply guessed from AST):** The original 5526 Node child imported verified official frozen `installed-material.verify`, `offline.load`, `da9-retry-bundle-v2.verifyReviewedDecision`, `da9-minio-readonly-inventory.snapshot` and `da9-minio-closure-v1.verifyReference`. It runs real `pg.Client` `BEGIN READ ONLY` for `qual_admin` on both actual dedicated PG port 55445 databases, counts 29 public tables and actual row counts, verifies two low-privilege Evidence identities using separate exact run-specific PostgreSQL URLs, sends MinIO SigV4 signed **GET/list only** queries for current/versions/delete markers/multipart on 59005, and rebinds immutable historic Closure to a NEW current inventory. It records actual timestamps and its own 240-second short-lived diagnostic freshness. DOES NOT prove Owner isolation, production binding absence (it explicitly writes null/UNVERIFIED), complete 29-table ACL/evidence positive-negative privilege-denial matrix, live GFS/KBS or full official V3 Admission. It hard-coded old `5526d93...` Subject/material and cannot be directly run. Original local password retrieval uses DPAPI (two Evidence-only roles, scoped MinIO inventory principal) and separate hidden qual_admin prompt. Secrets go only via transient STDIN JSON in old child. Those are **technical code-review facts**, not live findings on 2b.

**Prepared external new exact-Subject diagnostic ZIP** `MCFT-CAP09-DA9-2B636522-REAL-READONLY-DIAGNOSTIC-V1.zip` exact SHA-256 **`a64a3b936c7ac0564633da382604982c6105e8b2bdecadfc1c67fd2cc9d465db`** with:
- `DA9-2B636522-REAL-READONLY-DIAGNOSTIC.cjs` SHA-256 `5349681899f8a951ea0889d603200fb5af099ed5e0053211ba5a9d3b8b725e37` (14,995 bytes);
- `RUN-DA9-2B636522-REAL-READONLY-DIAGNOSTIC-PS51.ps1` SHA-256 `6f2515d7361f899ead5550f54b9c29e1aca451f655d1db1d492688104f94eea9` (10,614 bytes);
- README with explicit HOLD semantics. ZIP CRC PASS, `node --check` PASS, offline mock PostgreSQL positive/negative tests for exact DSNs, 29 tables/2 routines/0 rows and rejection of nonzero rows and wrong routines PASS, Linux CLI no-Windows-entry HOLD. **Neither PS 5.1 syntax nor REAL Windows DB/S3 runs have been performed in builder environment**; do not claim live PASS before actual operator log.

This is a **new external diagnostic adapter only**, not in immutable qualified Runtime or a new authority path. Signed inputs pinned: real Material 18,863 digest `a68e32fef887e2c22525269bb7839010b9b77e43a0c843c32c93f3ee937e8150`, signed Adoption file hash `5a16da53...`, signed Retry V2 `f25f89ea...`, new 19Z operator-reviewed V3 unsigned budget `f9dbcce8...`, reviewed plan `7ba49513...`, immutable existing historical Closure and DPAPI identities. Requires latest protected remote `main=2b63652297bb285f21c4d4c63c37d247d009142c` via read-only git, genuine online Pg/MinIO readback and signatures, exact executable and public frozen process env. The adapter does NOT falsify production binding absence or Owner/ACL PASS; it explicitly emits `dynamic_admission=HOLD`, `production_bindings=UNVERIFIED`, `acl=UNVERIFIED`, `owner=UNVERIFIED` even if PG+MinIO+Closure snapshot diagnostic returns `REAL_PG_MINIO_CLOSURE_DIAGNOSTIC_PASS_NOT_ADMISSION`. It performs NO Provider calls, writes to DB or MinIO, DB schema changes, MinIO delete, Permit sign/consume, stages, or production. Secrets derived locally only in memory, piped via a transient child STDIN JSON; process-only env restored on every exit. No signed secret file exported.

**Critical current 19Z time:** Hard deadline **strictly before 2026-10-23T15:45:00Z** for V3 180+15minute budget, assuming real Permit expiry also sufficiently late and original Adoption expires `2026-10-23T22:04:41.173Z`. If clock hits 15:45Z, this helper fail-closes **before any DPAPI/PG/MinIO action** rather than reusing expired 19Z plan. Do not weaken this check, pretend original first attempt Provider calls=0 (UNKNOWN), or issue a Permit on the basis of a diagnostic. A new future FirstBase is operator review + genuine signed Adoption renewal when necessary.

**Next true missing engineering evidence:** independently collect actual Owner isolation, run-specific production bindings absence, PostgreSQL Evidence/Twin table-level ACL/negative-denial readbacks, then form complete `observed` plus real <=300s `fresh_readback.started_at/completed_at` for official DA9 V2 bundle construction. Need every original historical evidence anchor plus new signed review file and Closure reference correctly bound, one-shot Permit issued by official frozen signer, official parent `--preflight-only`, explicit `--execute` only under valid final clock. Current Permit unsigned/unconsumed; real six stages 0/6. Preserve old QCP/handoff, #3298 Draft/Open/Unmerged; protected main unchanged.

---

## 2026-10-23 — Actual uploaded legacy 5526 readback PowerShell ZIP authenticated; critical verifier file absent (LATEST; no live admission, stages 0/6)

Operator actually uploaded `MCFT-CAP09-DA9-READBACK-SOURCE-20261023T151401406Z.zip` into chat; ZIP SHA-256 **`d317f90ed81a705eada41b7191671c922a92c04d81364cece5a00a8af76ac441`** exactly matched Windows output, ZIP CRC PASS. Exactly two `.ps1` source files inside, both read directly and inspected:
1. `01-real-db-minio-closure-readback.ps1`, 6,526 bytes, sha256 **`b2555a89ff32217b4def16877efd5f426cfe7516662011a67b0f09b3a4145a27`**, previously AST PASS. Fixed legacy `5526d93f5822c2f333ba997009e9d6605b8959e2` Subject, old release-session JSON, SignedRoot, `$M.files.Count -ne 18857`, so **not callable against new 2b636522/18863 material**. Reads historical Closure reference and uses `git ls-remote` (network), loopback TCP probes PG 55445 and S3 59005, obtains prompt/environment audit DB password + scoped S3 credential, strips environment to old material's allowed list, then pipes transient JSON (password, access key, secret, region, token) via stdin into `verify-live-resources.cjs`, passing Runtime, material, signed Adoption, signed Retry, Closure and output. Parent script itself has no `started_at`/`completed_at`; child source may. Never run old with patched Subject or suppress signature.
2. `02-resume-existing-credentials-readonly.ps1`, 5,365 bytes, SHA256 **`53367ad5889d146598fefbe27c61303f4685d6cd849fb50602aebebeb1e4bb8c`**. Recovers two DPAPI PG Evidence-only credential URLs via `ConvertTo-SecureString` and MinIO Inventory `Import-Clixml`, temp process env `DATABASE_URL`, `BLOCKED_DATABASE_URL`, S3 access/secret/region; asks gate for separately scoped audit password, restores the specific env vars in `finally`. Hardcoded old Subject `5526d93...`, old material digest `84a835...`, and old SignedRoot. Does not itself make DB/S3 calls or prove role ACL/true read-only; that job is in missing child JS.

**Critical missing artifact:** `verify-live-resources.cjs` required by `01-real-db-minio-closure-readback.ps1` line 35 and actually invoked via Node at line 97. This Node child was **NOT** in the uploaded ZIP. Github file/code search under GEOX and conversation/Library search did not find accessible copy. Without reading and verifying child, impossible to establish whether it actually queries both DBs, read-only enforcement, PG 29/2/0/ACL matrix, MinIO four-zero including versions/multipart, owner's bindings and `started_at`/300s semantics, the exact output schema and secret-handling; **no claim of dynamic Admission success or a secure current-Subject adapter can be made**.

**Next source request:** only the third small code-only child `D:\gptdown\MCFT-CAP09-5526-DA9-LIVE-RESOURCES-READONLY-V1\MCFT_DA9_5526_LIVE_READONLY_V1\verify-live-resources.cjs`, with its exact SHA256, after local inspection confirms no embedded secret. Neither old two PS scripts nor any DPAPI/PEM/env/credential files must be re-uploaded. Once received, inspect isolated Node readback/Secret STDIN/PG/S3/Closure signature verification; build external run-id/Subject-specific adapter with real 300s start/complete and independent script boundary; use **actual** signed Adoption/Retry and V3 budget without changing pinned 18,863-file Runtime. Current FirstBase=**2026-10-23T19:00Z**, theoretical strict capacity cutoff **15:45:00Z**; as of 15:17:34Z it had not yet elapsed, but no fake PASS and if missed renew clock and maybe Adoption before any Permit/Host. Context: run `da9db7129607`, production false, Permit unsigned/unconsumed, real stages 0/6. Original Handoff #3298 stays Draft/Open/Unmerged.

---

## 2026-10-23 — Windows legacy 5526 resource gate AST proves no live dynamic admission producer (LATEST; stages 0/6)

Actual operator Windows static source AST audit (read-only) of legacy `D:\gptdown\MCFT-CAP09-5526-DA9-LIVE-RESOURCES-READONLY-V1\MCFT_DA9_5526_LIVE_READONLY_V1\01-real-db-minio-closure-readback.ps1`: **SHA256 `b2555a89ff32217b4def16877efd5f426cfe7516662011a67b0f09b3a4145a27`**, bytes `6526`, parse PASS. Param names `NewReleaseSession,SignedRoot,ClosureReference,Repo`. Static command AST names exactly `ConvertFrom-Json,ConvertTo-Json,ForEach-Object,Get-ChildItem,Get-Content,git.exe,Join-Path,LocalSecret,MustFile,New-Item,Out-Null,Read-Host,TcpOpen,Test-Path,Write-Host`. It includes old literal frozen Subject **5526d93f5822c2f333ba997009e9d6605b8959e2**, does NOT include current frozen Subject **2b63652297bb285f21c4d4c63c37d247d009142c**; includes `NewReleaseSession`, `SignedRoot`, `qual_admin`, `Minio`, `Closure`; does NOT reference `started_at`, `completed_at`, `Postgres`. The static inspect made **NO credential decryption, Pg/S3 access, Permit, stage**.

**Meaning:** old helper cannot be used as current signed/admission readback. It may be reusable for limited tool/endpoint reachability after a real code review, but current official `bridge.admitProposedRetry`, `v2.fresh`, `closure.verifyReference`, `host.assertFreshParentReadback` require real `started_at/completed_at` within 300,000 ms of actual parent preflight/Permit consumption, two DB all-rows-zero, 29 tables/ACL policy/production-binding isolation, four-zero MinIO including current+versions+delete markers+multipart, Owner isolation and a cryptographically bound current Subject/Grant/Adoption/Retry V2. No mock `PASS` or copied old 5526 runtime files.

**Next precise missing input (never request keys/DPAPI):** source text or code-only ZIP of two local host PowerShell files: the above **6526-byte gate .ps1** and `D:\gptdown\MCFT-CAP09-5526-DA9-RESUME-EXISTING-CREDENTIALS-READONLY-V1.ps1`. Have operator verify neither code file contains plaintext secrets; do NOT include `*.dpapi`, `*.pem`, `*.env`, credential JSON/XML, signer files, database backups, or evidence snapshots. Build and verify a *new external wrapper* and genuine Pg/MinIO readback producer for `2b636522`; reuse role/connection logic only after reading actual source. Existence of DPAPI credentials 11/11 passed earlier is NOT evidence of successful decryption or live network identity. For current 19:00Z FirstBase, hard V3 upper bound: Permit issue + parent consume must begin strictly before **15:45:00Z** while sufficient margin remains; if missed, do NOT backdate or use old evidence. At 20:00Z a successor firstbase would fail current 22:04Z Adoption expiry's three timing bases+margin planning constraint; renewed valid Adoption under already-signed existing Scope Grant may be needed before creating newly reviewed V3 unsigned budget. Existing source, QCP, material 18,863, scope grant, Adoption, Retry V2, historical GFS/KBS and historical disposition remain intact.

Status **HOLD for real 300s admission**, `Permit signed=false`, consumed=false, live stages 0/6, production=false; protected main unchanged; handoff PR #3298 Draft/Open/Unmerged.

---

## 2026-10-23 — Real Windows DA9 19Z operator-reviewed V3 unsigned budget structural PASS (LATEST; stages 0/6)

Operator exact Windows console from **2026-10-23T15:03:53.137Z** renewed the previous 18:00Z proposal with actual operator confirmation `APPROVE_DA9_V3_CAPS_2B636522`. Official frozen V3 unsigned builder + evaluator returned **`DA9_V3_OPERATOR_REVIEWED_UNSIGNED_BUDGET_STRUCTURAL_PASS_NOT_ADMISSION`**, `UNSIGNED_V3_BUDGET_ENVELOPE_CREATED_NOT_ADMISSION`, `V3_PREPERMIT_SIGNED_SOURCE_USE_POLICY_STRUCTURAL_PASS_NOT_PROVIDER_SLA`. Exclusive new evidence root `D:\gptdown\MCFT-CAP09-DA9-V3-BUDGET-2b636522-20261023T150408763Z-43f6a643`; signed Adoption digest `8c39a9dd...`, Subject `2b63652297bb285f21c4d4c63c37d247d009142c`, Run `da9db7129607`.
- New canonical hour FirstBase **2026-10-23T19:00:00.000Z**, stage caps [60,30,30,30,20,10] min = **180** minutes, margin **15** minutes, signed Adoption expiry **2026-10-23T22:04:41.173Z**. The **Permit expiry `2026-10-23T21:59:41.173Z` is only hypothetical, unsigned**; official Permit must later be signed independently. Strict last theoretical parent budget check is **before 2026-10-23T15:45:00.000Z** (first base 19:00 minus 195m), or earlier if true signed Permit/Adoption expires sooner. This check is repeated right before irreversible Permit consumption, not just budget assembly.
- New reviewed stage plan: `DA9_V3_REVIEWED_STAGE_PLAN.json` SHA256 `7ba495135e3157a6fb4ff3b640af9f6f1c080444ab51ba950a7d32f0a7cb1e84` (same bytes/stage limits as old plan), operator-reviewed stage caps `DA9_V3_OPERATOR_REVIEWED_STAGE_CAPS.json` SHA256 `5f1d6943c5fd3c8572d2a9c639b98e232398ff1c733f31f0edbe19abb0f5a6d2`, official unsigned budget `DA9_V3_OFFICIAL_UNSIGNED_BUDGET.json` SHA256 **`f9dbcce889321d276e71a3fd655ae5c6a44f337782f3325ce902ef8775d1f7a3`**. Preserve prior 18:00Z artifacts unchanged as historical superseded plan, never edit.
- Scope Grant SIGNED, Formal Adoption SIGNED + independently verified, Retry V2 SIGNED + independently verified, historical GFS/KBS 2/2 hashes, 11/11 static paths present; no live Provider/PG/S3/ACL/Owner readback this round; `real_provider_calls=0`, DB connections 0, MinIO calls 0, `stage_launches=0`, Permit unsigned/unconsumed, production forbidden.

**NEW CONFIRMED GATE GAP, do not run old script blindly:** Existing old credential/readback wrapper `D:\gptdown\MCFT-CAP09-5526-DA9-RESUME-EXISTING-CREDENTIALS-READONLY-V1.ps1` is documented in original historical source code with **literal `ExpectedSubject=5526d93f5822c2f333ba997009e9d6605b8959e2`**, old material `84a835...`, old `new-release-session.json`, old `signedRoot` and old underlying `MCFT_DA9_5526_LIVE_READONLY_V1\01-real-db-minio-closure-readback.ps1`. The file's 11/11 existence is NOT compatibility with new 2b636522. It recovers DA9 positive/negative PG DPAPI identities from `%LOCALAPPDATA%\GEOX\MCFT-CAP09\da9db7129607\credentials` and MinIO inventory DPAPI but cannot be directly invoked against 2b material. On original Windows, first inspect original underlying gate's AST/parameter/subject binding and produce a non-effectful current-subject readback adapter; no rewriting old gate in place, no key disclosure or historical data mutation. The admission requires live `fresh_readback.started_at/completed_at` <=300s, real positive/negative PG, MinIO four-zero, ACL/Owner and signed historical Closure in current subject context; no falsified `PASS` object. Timing under 15:45 budget deadline is tight, choose a later future canonical FirstBase and fresh human-reviewed V3 budget if necessary.

**NEXT:** current-subject-compatible read-only resource collector and exact fresh evidence, then official isolated Retry V2 Permit input construction and single-use signing with registered operator, official parent `--preflight-only` PASS without Permit burn, final 300s/clock checks then explicit `--execute`, real stage receipts 0/6 until genuine capture. Handoff PR #3298 Draft/Open/Unmerged, main unchanged `2b636522...`.

---

## 2026-10-23 — DA9 11/11 static dynamic-admission inputs present; 18Z FirstBase deadline elapsed (LATEST; REAL stages 0/6)

Actual Windows PowerShell operator report at **2026-10-23T14:41:38.3304642Z**: every one of the **11/11** named static input file checks was `PRESENT=True`: Adoption, signed Retry V2, official unsigned V3 budget, stage plan, operator-reviewed stage caps, historical MinIO Closure, historical PG read-only audit, evidence/negative PG DPAPI files, MinIO DPAPI file, and previous readback runner. `STATIC_INPUT_FILES_COMPLETE=True`; the runner did **NOT execute**; `NO_PROVIDER_NO_DB_NO_MINIO_NO_PERMIT_NO_STAGE`. Original `FIRST_BASE=2026-10-23T18:00Z`, `ADOPTION_EXPIRY=2026-10-23T22:04:41.173Z`, strict V3 cap deadline **`2026-10-23T14:45:00Z`**; operator's earlier `FIRSTBASE_STILL_ELIGIBLE=True` applied **ONLY to its 14:41:38Z readback instant**.

At assistant's current local-time readback **2026-10-23T22:56:27+08:00 (14:56:27Z)**, 18Z deadline **already passed**, so the previously reviewed 18Z unsigned budget MUST NOT be used to sign/consume a real Permit or to claim live Host Preflight. No Permit has been issued/consumed. Keep original 18Z plan/budget and hashes intact as superseded historical planning evidence; DO NOT edit or backdate them.

**Recovery:** do NOT redo previous QCP, Release, 18,863 installed material, formal scope grant/adoption, Retry V2, historical GFS/KBS discovery, 29-table PG historical audit, or historical MinIO disposition/deletion. Re-run the *already-installed external* `D:\gptdown\MCFT-CAP09-DA9-V3-BUDGET-REVIEW-KIT-2b636522\RUN-DA9-V3-OPERATOR-BUDGET-PS51.ps1` in its new process/time context, without re-unzipping or overwriting existing evidence. Its `inspect` computes canonical-hour FirstBase from current UTC. With 14:56Z it should **propose 2026-10-23T19:00:00Z** as a new candidate, subject to actual clock, fresh adoption expiry and the three-hour timing window rule, then display 60+30+30+30+20+10=180-minute caps plus 15-minute margin and full rationale. Only a fresh explicit human `APPROVE_DA9_V3_CAPS_2B636522` can result in NEW exclusive, genuinely operator-reviewed unsigned plan/caps/budget and frozen official structural verifier PASS. Do not merely relabel the old 18Z JSON. For 19:00Z FirstBase, theoretical **strictly-before** maximum capacity deadline is **15:45:00Z** (195 minutes earlier), assuming actual signed Permit expiry and Adoption expiry are not earlier. The real signed Adoption expires 22:04:41Z, so it is possible in principle but NOT pre-admitted.

**Next after NEW reviewed structural PASS:** validate latest true UTC, old 5526 readback helper against current exact Subject (file existence does not imply compatibility), then obtain truly fresh <=300-second positive/negative PG, MinIO, ACL, Owner, live GFS cycle/complete forecast and KBS Variate25 observations, review and issue actual one-shot Permit only when all dynamic boundaries and source-at-use safety pass, official Host `--preflight-only` PASS without Permit consumption, then separately authorized `--execute` with final repeated clock/readback before consumption. Never invoke the old readback tool blindly, never mutate old historical evidence and never claim `0` first-attempt Provider calls (UNKNOWN). Run ID `da9db7129607`, real stages **0/6**, production forbidden. Handoff PR #3298 Draft/Open/Unmerged; protected main remains `2b63652297bb285f21c4d4c63c37d247d009142c`.

---

## 2026-10-23 — Real Windows DA9 V3 operator-approved unsigned budget STRUCTURAL PASS (LATEST; 0/6)

Actual Windows operator evidence, from `D:\gptdown\MCFT-CAP09-DA9-V3-BUDGET-2b636522-20261023T143412888Z-1c572c5f`: responsible human explicitly entered exactly `APPROVE_DA9_V3_CAPS_2B636522` AFTER reviewing a detailed >250-char genuine rationale; frozen official `da9-budget-v3-prepare.cjs` generated an **UNSIGNED** budget and `MCFT_CAP09_DA9_PREPERMIT_SOURCE_USE_BUDGET_V3.cjs.evaluate` returned structural PASS with a **hypothetical** unsigned Permit expiry. **Actual receipt**: `DA9_V3_OPERATOR_REVIEWED_UNSIGNED_BUDGET_STRUCTURAL_PASS_NOT_ADMISSION`, with `official_builder_status=UNSIGNED_V3_BUDGET_ENVELOPE_CREATED_NOT_ADMISSION`, `official_evaluator_status=V3_PREPERMIT_SIGNED_SOURCE_USE_POLICY_STRUCTURAL_PASS_NOT_PROVIDER_SLA`.

- Exact Subject `2b63652297bb285f21c4d4c63c37d247d009142c`, Run `da9db7129607`; when observed `CURRENT_UTC=2026-10-23T14:33:53.191Z`, operator-approved `FIRST_BASE_UTC_PROPOSED=2026-10-23T18:00:00.000Z`.
- Real signed Adoption expires **`2026-10-23T22:04:41.173Z`**, theoretical (NOT signed) Permit expiry **`2026-10-23T21:59:41.173Z`**.
- Six stage ceilings: PRODUCER 60min; TIMING_1/2/3 30min each; CONTROLLED_DELAY 20min; AGGREGATE 10min. **180min upper bounds + 15min positive margin = 195min**. The historical 220-call/821,997ms GFS run is a genuine *subset history*, NOT full six-stage measurement or current Provider guarantee; true KBS Variate25 VWC 30min freshness and exact same-cycle GFS 72h source must validate at live capture. No fictional Provider future SLA/deadline.
- Exact new files (preserve bytes):
  1. `D:\gptdown\MCFT-CAP09-DA9-V3-BUDGET-2b636522-20261023T143412888Z-1c572c5f\DA9_V3_REVIEWED_STAGE_PLAN.json` SHA256 **`7ba495135e3157a6fb4ff3b640af9f6f1c080444ab51ba950a7d32f0a7cb1e84`**.
  2. `...\DA9_V3_OPERATOR_REVIEWED_STAGE_CAPS.json` SHA256 **`2e593cb459a3bc2d9daaed52891e0686381116e06e551d31d24df442600e9c2c`**.
  3. `...\DA9_V3_OFFICIAL_UNSIGNED_BUDGET.json` SHA256 **`414b9af11e45a25a90adaec8f64fdb8bdb9186ae5c4348f2b3a275bf0463c411`**.
- Machine report explicitly states `real_provider_calls=0`, `database_connections=0`, `minio_calls=0`, `stage_launches=0`, `permit_signed=false`, `permit_consumed=false`, `execution_authorized=false`, `production_authorized=false`, `live_provider_causality_verified=false`, `fresh_resource_admission_verified=false`, `actual_six_stage_measured=false`; wrapper restored original process Path/Python.

**CRITICAL clock frontier:** V3 verifier and real Parent Host require `now + 10,800,000ms + 900,000ms < min(FirstBase, ACTUAL signed PermitExpiry, valid signed AdoptionExpiry)` both at signing and immediately **before irreversible Permit consumption**. For `FirstBase=2026-10-23T18:00Z`, last possible theoretical clock **strictly BEFORE 2026-10-23T14:45Z**. At/beyond 14:45Z, **DO NOT** reuse the reviewed 18Z budget for admission or Permit; recreate a new explicitly operator-reviewed unsigned V3 budget against a later future canonical FirstBase and re-evaluate signed Adoption window. Expiry 22:04Z likewise creates hard stop before 18:49:41Z for this 195min cap, and stages at T1/T2/T3 may require Adoption valid later. Do not backdate clocks or substitute only theoretical expires. Current Host checks fresh resource readback from `started_at` <= 300s at sign+preflight+consumption; therefore defer expensive readback until all static files and operators ready, do not consume Permit early.

**Next gated action:** Confirm exact current Windows UTC and 18Z FirstBase capacity, inventory existing historical MinIO Closure reference/PG audited artifacts/DPAPI existing low-permission credentials (never repeat prior exact-two-delete, never reinit 29 table DB), verify fresh live GFS/KBS can be fetched at actual capture, assemble real full Observations/StagePlan/ARM with fresh 300s PG+MinIO/ACL/Owner readback and signed V3 cap source, THEN and only then have the registered operator sign one-shot Permit, official parent `--preflight-only`, separate `--execute` if all hard gates still hold and actual live Provider science works. Critical: no complete parent Windows preflight observed and **six-stage real receipts remain 0/6**; Permit still UNSIGNED/UNCONSUMED. Handoff PR #3298 stays DRAFT/OPEN/UNMERGED; current protected main unchanged.

---

## 2026-10-23 — DA9 V3 historical evidence 2/2 exact SHA PASS on Windows (LATEST; unsigned V3 budgeting next)

Windows operator executed external read-only 118-JSON SHA256 search, 0 directory errors, current clock `2026-10-23T14:24:37.6585731+00:00`, immutable signed Formal Adoption expiry `2026-10-23T22:04:41.173Z`. Report `195MIN_CAPACITY_REMAINS=True` **at that instant only**. V3 requires renewed independent capacity check at actual future permit signing/Host dispatch, `now + capSum + margin < min(FirstBase, real Permit expiry, valid Adoption expiry)`.

Found **both genuine byte-matching V3 mandatory historical records**:
- **GFS 220-call historical acquisition** SHA-256 `8a89e19dc06023dcc8342b68541c67c7758d0e1ef836d63d68f285a3b29d192a` at `D:\gptdown\MCFT-CAP09-DA9-FULL-GFS-e17ed8fb3a6c4075b2851aaff5f1ed88\GFS_FULL_72H_META.json`.
- **KBS historical continuity/window record** SHA-256 `d813093f0321bd56d7e0a43c1dfa66964c4f4dfe8373d665a3139123d49dd86e` at `D:\gptdown\MCFT-CAP09-DA9-WINDOW-AUDIT-081efe5031cf42cea1f7c3840aaad2ea\DA9_PROVIDER_WINDOW_BUDGET_READONLY_RESULT.json`.

Both original files MUST be passed by absolute path directly to installed official `scripts/cap09_adoption_v1/da9-budget-v3-prepare.cjs` and retained, not copied or rewritten. Actual current KBS Variate25 freshness/continuity and GFS latest complete same-cycle source are **not proven by the historical file hash**; historical continuity source may contain an admission HOLD but is accepted by V3 as provenance only, so never treat this as live source PASS.

### 2026-10-23 prepared operator-reviewed V3 unsigned budget kit (NOT YET RUN ON WINDOWS)

External ZIP `MCFT-CAP09-DA9-V3-OPERATOR-BUDGET-REVIEW-2b636522.zip`, SHA256 **`121dd58a97d7038291b2ce027529dd4d4cc207ba028dc38890b9d475af55929a`**, size 8107 bytes, containing `RUN-DA9-V3-OPERATOR-BUDGET-PS51.ps1`, `DA9-V3-REVIEW.cjs`, README. Node syntax, synthetic canonical-hour proposal positive/negative and ZIP CRC PASS **locally**; the actual real Windows V3 budget/signatures/preflight are NOT yet run. This kit is external only and must NOT be misreported as official Windows budget PASS.

- Real fixed operator inputs: exact signed Adoption `D:\gptdown\MCFT-CAP09-DA9-ADOPTION-2b636522-20261023T140441043Z\formal-adoption-signed.json` file SHA256 `5a16da5317d01b6a2a42b39d1648dc1acb625d14f15a68ff1afa76e3d99a772e`, registered signed Retry V2 `D:\gptdown\MCFT-CAP09-DA9-RETRY-V2-REVIEW-2b636522-20261023T141704532Z\retry-review-signed.json` SHA256 `f25f89ea0f20af6185ce663ce8ef9052d57630bb88a467a9181a9de3c15f5054`, 18,863 installed Material canonical digest `a68e32fe...`, historic GFS/KBS path/SHA recorded above. The helper re-runs authentic frozen official `offline.load` and `v2.verifyReviewedDecision`, original SHA on both source files and signed inputs, and restores process-only frozen Path/Python by `try/finally`.
- Human-readable proposed stage caps, **only for responsible operator review**: PRODUCER 60m, TIMING_1/2/3 30m each, CONTROLLED_DELAY 20m, AGGREGATE 10m, total 180m; margin 15m. These are **not full-run measurements**. Proposes next canonical UTC hour strictly after current time +195min+10min; example actual 14:24Z -> FirstBase 18:00Z, subject to *fresh operator-clock reevaluation* when used. It refuses unsafe now/expiry, if 3 sample base times cannot fit before Adoption expiry, or if user does not explicitly enter exactly `APPROVE_DA9_V3_CAPS_2B636522`.
- Operator sees entire >250-char evidence-grounded risk rationale and may decline. On genuine approval it outputs new exclusive external `DA9_V3_REVIEWED_STAGE_PLAN.json`, `DA9_V3_OPERATOR_REVIEWED_STAGE_CAPS.json` with individual SHAs and calls exact **existing immutable official** `da9-budget-v3-prepare.cjs.prepare`, creating `DA9_V3_OFFICIAL_UNSIGNED_BUDGET.json`. Separate real official V3 `evaluate` rehashes all 3 source files and pinned scientific source code under **hypothetical unsigned proposed Permit expiry = AdoptionExpiry -5min** to check structural policy, not an actual signed Permit. Success can be only `DA9_V3_OPERATOR_REVIEWED_UNSIGNED_BUDGET_STRUCTURAL_PASS_NOT_ADMISSION`; evaluation has `V3_PREPERMIT_SIGNED_SOURCE_USE_POLICY_STRUCTURAL_PASS_NOT_PROVIDER_SLA` code string, where 'signed' does NOT mean Permit actually issued in this package.
- **No Provider/GFS/KBS network activity, database, MinIO, stage import/run, Permit signing or consumption**. Historic KBS file merely provenance; no live variate25 freshness from old history. If it HOLDs because FirstBase/Adoption no longer fits, renew genuine Formal Adoption under still-valid grant rather than backdate. Only after successful operator decision move to short-lived live resource/provider/ACL/Owner Admission and a separately approved one-shot Permit; do not run current 300s fresh witness early. Current official six-stage receipts **0/6**.


Next: responsible operator reviews exact six caps (suggested engineering ceilings **[60,30,30,30,20,10] minutes = 180** and **15-minute margin**, based on published synthetic contract only; not empirically measured full run), chooses a fresh future canonical-hour FirstBase that also respects `AdoptionExpiresAt` (currently 22:04:41Z), and attests non-template human explanation. Official read-only/unsigned builder expects exactly `STAGE_PLAN HIST_GFS HIST_KBS CAP_REVIEW_SIGNED_RETRY_DECISION NEW_OUTPUT`; proper order is `plan, gfs, kbs, review, decision, budget output`. The **third source is new explicitly human-approved engineering budget review**, not a fabricated Provider SLA or historical timing measurement. Conclude only `UNSIGNED_V3_BUDGET_ENVELOPE_CREATED_NOT_ADMISSION`, and optionally pass official `v3.evaluate` with **clearly hypothetical proposed** Permit expiry, never call it a genuine Permit/Admission. Do not start fresh 300s DB/MinIO/Owner readbacks until close to genuine Permit window; no six stages yet 0/6. Handoff #3298 Draft/Open/Unmerged, protected main subject `2b63652297bb285f21c4d4c63c37d247d009142c`.

---

## 2026-10-23 — Windows DA9 Retry Adjudication V2 signed + independent verification PASS (LATEST; 0/6)

**Actual operator Windows PowerShell console** with current exact protected `main=2b63652297bb285f21c4d4c63c37d247d009142c` and Run ID `da9db7129607`:
- The frozen `da9-retry-bundle-v2.cjs` loaded the genuine signed `Formal Adoption` (digest `8c39a9dd0c072a2fa5ea45209c34b7322637ea45d87e7b9629f34685c9c56f6b`, expires **2026-10-23T22:04:41.173Z**), created a genuine **unapproved** historical Retry V2 draft (SHA-256 `a92d61a5908b425e13be8770bc731e7ac02253e21b37671427ed48478fa79b00`), decision ID `da9_2b636522_retry_v2_20261023141712606`, and displayed the narrowly scoped real operator rationale. Reviewer approved with EXACT `APPROVE_DA9_RETRY_V2_2B636522`; reviewed source SHA256 `8bfd38bf3f2045d3518924c8c27b641f8e9b99b84dd2ca5380accf23dd1dad87`, unsigned reviewed JSON SHA256 `64e34182f96d444557de421668070c937a5b84c7d4f911ec8c4c6676a0dc1bf2`, reviewed at **2026-10-23T14:17:33.016Z**. Initial attempt's `first_execution_provider_calls=null/UNKNOWN`, `first_failure_phase='UNKNOWN'` and historical denial `POSTMERGE_V13_PRODUCER_CORE_FORMAL_RAW_BUCKET_REQUIRED` were explicitly preserved and only superseded for this one exact isolated TEST_ONLY second-attempt review; no historical reset.
- Official Windows signer returned **`SIGNED_RETRY_REVIEW_NOT_ADOPTION_OR_PERMIT`** with SHA256 **`f25f89ea0f20af6185ce663ce8ef9052d57630bb88a467a9181a9de3c15f5054`**; independent second Node process returned **`DA9_RETRY_V2_SECOND_PROCESS_SIGNATURE_VERIFIED_NOT_PERMIT`** with same exact SHA/run/subject. Signed file: `D:\gptdown\MCFT-CAP09-DA9-RETRY-V2-REVIEW-2b636522-20261023T141704532Z\retry-review-signed.json`. Preserve adjacent draft/reviewed-source/reviewed and signed files unchanged. No Provider, DB, MinIO, actual stage, or Permit activity in this signature operation. `ORIGINAL_PROCESS_PATH_RESTORED=True` and `ORIGINAL_PROCESS_PYTHON_RESTORED=True`.
- **Current authority status:** Source/QCP 6455/54, Installed Material 18863, formal Scope Grant SIGNED, Formal Adoption SIGNED and independently VERIFIED, **Retry Adjudication V2 SIGNED and independently VERIFIED**; **one-shot execution Permit NOT signed/consumed, official Host Preflight NOT run, real 6 stages 0/6, Production denied.** Adoption is time-limited and expires at 22:04Z; do not treat it as a timeless execution authorization.
- **NEXT (don't rebuild already qualified chain):** V3 read-only pre-Permit execution safety budget + genuine historical source files (real GFS historic acquisition SHA256 `8a89e19dc06023dcc8342b68541c67c7758d0e1ef836d63d68f285a3b29d192a`, KBS historical continuity SHA256 `d813093f0321bd56d7e0a43c1dfa66964c4f4dfe8373d665a3139123d49dd86e`), human-reviewed exact 6 ordered stage caps (180 minutes total, +15 min margin), real FirstBase and honest actual local resource viability. Official immutable source has `scripts/cap09_adoption_v1/da9-budget-v3-prepare.cjs` with exact six external argument paths: plan, hist-GFS, hist-KBS, operator-reviewed cap JSON, signed Retry V2, new unsigned output. V3 verifier enforces **`now + caps + margin < min(FirstBase, proposed PermitExpiry, AdoptionExpiry)`** without future Provider Deadline; validates real `KBS Variate25`/GFS at capture time, no offline source future SLA. Historical real DA9 MinIO Closure and DB 29-table/2-routine/0-row ACL previous audits exist and must be inherited **only for history**, with freshly renewed <=300s readbacks for one real Admission attempt. Need exact original file paths/hashes before generating any new review; if path missing, HOLD not synthetic file. Sign fresh one-shot Permit only after full actual resource/owner/DB/S3/ACL/Provider sources, reviewed V3 budget, genuine future firstbase, and official parent Preflight.
- Review code evidence independently verified from protected main `2b636522`: V3 verifier `scripts/governance_acceptance/MCFT_CAP09_DA9_PREPERMIT_SOURCE_USE_BUDGET_V3.cjs`, admission bridge, parent Host and source-bound unsigned budget builder. **Do not return to V2 fictitious Provider future deadline**; do not alter the frozen original retry history, main code or installed material.
- Handoff PR #3298 Draft/Open/Unmerged and append/precede only to this existing Active Continuation. No new PR requested or created.

---

## 2026-10-23 — Real Windows Formal Adoption signed + independent official verification PASS (LATEST; stages 0/6)

The operator actually executed the frozen `scripts/cap09_adoption_v1/signer.cjs formal-adoption` with explicit confirmation `SIGN_DA9_ADOPTION_2B636522` and the previously genuinely signed, exact-material operator Scope Grant. A second independent Windows Node process ran installed official `offline-context.cjs` verification; original frozen-process `Path` and Python binding were restored afterward.

**Actual output**
- First result: `SIGNED_ADOPTION_QUALIFICATION_V1_ISSUED_TEST_ONLY`, `qualification_id=mcft_cap09_adoption_2b63652297bb_v1`, subject `2b63652297bb285f21c4d4c63c37d247d009142c`, issuer `mcft_cap09_operator_mylr1`, key `mcft_cap09_ed25519_223c806e`.
- Adopted material digest `a68e32fef887e2c22525269bb7839010b9b77e43a0c843c32c93f3ee937e8150` (18,863 files), verified exact 6,455-file release/QCP as previously recorded. Formal Adoption digest `8c39a9dd0c072a2fa5ea45209c34b7322637ea45d87e7b9629f34685c9c56f6b`.
- Signed Adoption expiry **`2026-10-23T22:04:41.173Z` (UTC)** — do not confuse with output file creation. At actual subsequent dynamic admission, its remaining validity must exceed the entire reviewed six-stage safety budget PLUS the required safety margin; if insufficient, re-sign short-lived Adoption under still-valid verified Scope Grant and frozen process Path rather than reuse an expired request.
- Signed immutable request `D:\gptdown\MCFT-CAP09-DA9-ADOPTION-2b636522-20261023T140441043Z\formal-adoption-signed.json`; signed JSON SHA-256 **`5a16da5317d01b6a2a42b39d1648dc1acb625d14f15a68ff1afa76e3d99a772e`** (operator reported uppercase).
- Second result `FORMAL_ADOPTION_OFFICIAL_SECOND_PROCESS_VERIFIED_TEST_ONLY_NOT_PERMIT`, matching Subject / material / Adoption digest / expiry; reported `scope=TEST_ONLY`, `production_authorized=false`, `permit_signed=false`, `permit_consumed=false`, `stage_launches=0`. First signing result has `execution_authorized=true` **within signed Adoption context only**; does NOT alone grant live execution without separate signed Retry Review, V3 dynamic live readbacks, Permit and host Preflight.
- `ORIGINAL_PROCESS_PATH_RESTORED=True`, `ORIGINAL_PROCESS_PYTHON_RESTORED=True`; no new runtime/source/release material created. Previously signed Scope Grant SHA-256 `1ff5cf4b855638b2b6bd880bb562bef8c7e2bcd2c61df22186b9b64e2ee62d8b` remains immutable.

### Prepared operator-confirmed official Retry Review V2 Windows kit (not yet executed)

External kit file `MCFT-CAP09-DA9-RETRY-V2-OFFICIAL-REVIEW-2b636522.zip` SHA256 `9db6a7822f79b77bd2fe90b2b13b40cdd109d1034816b3ff23797c5ed0cec8c1` (6,855 bytes). Contains `RUN-DA9-RETRY-V2-REVIEW-PS51.ps1` (PowerShell 5.1 compatible), `DA9-RETRY-V2-REVIEW-TOOL.cjs`, README. JS syntax PASS, ZIP CRC PASS, Linux no-Windows negative path HOLD PASS, static signed-review-only guard inspection PASS. **Not yet tested on operator Windows; no real Retry Review signed by this kit as of current Handoff.**

Inputs are exact existing immutable 18,863-file Runtime and signed Adoption `D:\gptdown\MCFT-CAP09-DA9-ADOPTION-2b636522-20261023T140441043Z\formal-adoption-signed.json` with SHA256 `5a16da5317d01b6a2a42b39d1648dc1acb625d14f15a68ff1afa76e3d99a772e`; expiry `2026-10-23T22:04:41.173Z`; operator's registered private Ed25519 key remains local and never exported. Wrapper restores genuine frozen process PATH/Python via `try/finally`. It creates new exclusive evidence dir outside Runtime and runs official `v2.draft` using genuine `offline.load`, leaving a wholly `REVIEW_REQUIRED` draft. Only after a *separate* literal operator challenge `APPROVE_DA9_RETRY_V2_2B636522` does it prepare review source and signed input that explicitly preserve original error `POSTMERGE_V13_PRODUCER_CORE_FORMAL_RAW_BUCKET_REQUIRED`, original Provider calls `null/UNKNOWN`, first phase UNKNOWN, historical immutable anchors, scope `isolated TEST_ONLY`, new frozen subject and issuer. It then invokes installed official `v2 review-sign REVIEWED KEY ISSUER KEYID SIGNED ADOPTION` (NOT bundle/Permit sign) and separately verifies the genuine review signature in another Node process. Only true success is **`SIGNED_RETRY_REVIEW_NOT_ADOPTION_OR_PERMIT`** AND **`DA9_RETRY_V2_SECOND_PROCESS_SIGNATURE_VERIFIED_NOT_PERMIT`** from operator Windows + exact signed output SHA-256.

Even signed Retry V2 is **NOT** evidence that MinIO four-zero Closure, positive/negative PG, ACL, Owner, V3 provider source-at-use or any stage has passed. Must not sign Permit or call effectful official Host until independently fresh bounded Readbacks and reviewed V3 stage budget and FirstBase succeed. If signed Adoption expired, do not backdate or fake a positive result; issue a **new** valid verified TEST_ONLY Adoption under still-current signed Scope Grant before continuing, preserving all historic files. Protected main remains 2b636522, Handoff #3298 Draft/Open/Unmerged; genuine official stages 0/6.


**Next uncompleted milestone: exact-Subject signed DA9 Retry Adjudication V2, then fresh dynamic V3 Admission, then one-shot Permit.** Current installed official `scripts/cap09_adoption_v1/da9-retry-bundle-v2.cjs` explicitly provides `draft DECISION_ID ADOPTION_FILE NEW_UNSIGNED_FILE` and `review-sign REVIEWED_JSON KEY_FILE ISSUER_ID KEY_ID NEW_SIGNED_JSON ADOPTION_FILE`, and still requires genuinely approved, separately signed history-bound Retry Review (original first attempt Provider calls `null/UNKNOWN`, prior failure `POSTMERGE_V13_PRODUCER_CORE_FORMAL_RAW_BUCKET_REQUIRED`). It supports accountable single-operator review without an added independent custodian. Draft/Review signing needs authentic installed Adoption loading with frozen process Path and Python binding; do NOT forge `review_status=APPROVED` without explicit review and operator approval. Any new output must be exclusive outside Runtime; no deletion of historical MinIO/WORM evidence; no Git changes to protected main. Run ID `da9db7129607`, **real six stages 0/6**, Production denied. Handoff PR #3298 Draft/Open/Unmerged.

---

## 2026-10-23 — DA9 Windows Operator Scope Grant signed VERIFIED (LATEST; official stages 0/6)

**Actual operator Windows console:** `OFFICIAL_DIGEST_CALCULATION_PASS`; exact Subject `2b63652297bb285f21c4d4c63c37d247d009142c`, installed material canonical digest `a68e32fef887e2c22525269bb7839010b9b77e43a0c843c32c93f3ee937e8150`, registered Host `LAPTOP-STN2A2P1`, operator `mcft_cap09_operator_mylr1`, human confirmed the EXACT prompt once (`APPROVE_DA9_SCOPE_2B636522`), `SCOPE=TEST_ONLY`, proposed Grant validity 24h, production/Permit authority false. The official frozen `signer.cjs scope-grant-sign` returned **`SIGNED_OPERATOR_SCOPE_GRANT_NOT_ADOPTION_OR_PERMIT`**, `subject_sha=2b63652297bb285f21c4d4c63c37d247d009142c`, `grant_sha256=1ff5cf4b855638b2b6bd880bb562bef8c7e2bcd2c61df22186b9b64e2ee62d8b`; operator independently printed matching uppercase SHA-256.

**Signed output (immutable; keep indefinitely):** `D:\gptdown\MCFT-CAP09-DA9-SCOPE-2b636522-20261023T135632817Z\operator-scope-grant-signed.json`. Adjacent exact human-reviewed `operator-scope-reviewed-source.json` and unsigned payload `operator-scope-payload.json` must be retained. The prior duplicated approval input was safely refused and recorded below; the new single correct entry did sign. No private key material is to be uploaded. Distinguish output filename's timestamp from cryptographic grant payload `not_before/not_after`, which must be rechecked from signed JSON at each new Adoption issuance.

### Prepared bounded official Formal Adoption Windows kit (not yet run)

External helper-only ZIP `MCFT-CAP09-DA9-FORMAL-ADOPTION-OFFICIAL-2b636522.zip`, SHA-256 **`9490a101e0d1d65417514fa1d860f16f101095b2f9639857a99a1e9c0f18b3e9`**; contents `RUN-DA9-OFFICIAL-FORMAL-ADOPTION-PS51.ps1`, `VERIFY-DA9-FORMAL-ADOPTION-OFFICIAL.cjs`, README. ZIP CRC and `node --check` PASS in helper-building environment, **NOT RUN ON REAL WINDOWS**, no runtime verification result yet. Fixed inputs are new exact installed root, immutable QCP unsigned `adoption-candidate.json`, material profile, registered operator key, and actual signed Grant SHA `1ff5cf4b...`. An explicit distinct human prompt `SIGN_DA9_ADOPTION_2B636522` authorizes **formal TEST_ONLY Adoption only**, proposed TTL `480` minutes, safely bound inside remaining signed 24h Grant and policy validity. It runs installed frozen official signer `signer.cjs formal-adoption`, then a separate Node process loads installed **official `offline-context.cjs`** to reverify signature, QCP, material, subject, host and expiry. Only process `Path` / `MCFT_PYTHON_EXECUTABLE` are temporarily restored to **genuine frozen installed-profile values**, and always reset using `finally`. New exclusive signed output outside immutable runtime. No Provider/DB/S3/Permit/stage call; if signer/verifier fails, preserve raw output/failed folder, NO PASS. Success requires `SIGNED_ADOPTION_QUALIFICATION_V1_ISSUED_TEST_ONLY` and `FORMAL_ADOPTION_OFFICIAL_SECOND_PROCESS_VERIFIED_TEST_ONLY_NOT_PERMIT` and signed SHA from real operator. Tool is not a new GEOX main PR nor new issuer/approval tier.


**Next mandatory step: official TEST_ONLY Formal Adoption, NOT Permit.** Use the same verified `D:\gptdown\MCFT-CAP09-DA9-QCP-2b636522-20261023T054723422Z\adoption-candidate.json`, existing `D:\gptdown\MCFT-CAP09-DA9-2b636522-INSTALLED-20261023T072259804Z\installed-material.json`, unchanged new 18,863-file Runtime root `...\portable-runtime`, the *existing registered* operator signer private key (do not display), this new signed scope-grant file, explicit operator-reviewed short TTL and NEW exclusive output file. On Windows, restore only the immutable material profile's real frozen `Path` and `MCFT_PYTHON_EXECUTABLE` into child/current process with guaranteed `try/finally` restoration; call installed official `node scripts/cap09_adoption_v1/signer.cjs formal-adoption candidate material root key ttl output signed-grant`; check genuine `SIGNED_ADOPTION_QUALIFICATION_V1_ISSUED_TEST_ONLY`; independently reload+verify the resulting signed request via installed official `offline-context.cjs` to confirm host, material, QCP, true Ed25519 issuer signature, and current expiration. The registered operator issuer has no embedded formal scope, so the new Grant is mandatory. A signed Adoption does **not** issue or consume Permit, run a provider, authorize production, or complete Stage 1/6. If any mismatch/HOLD, preserve complete real error evidence and do not rewrite/reissue old signatures.

**Status:** QCP 54, Release 6455, Installed Material 18863, static graph 102+native witness, Adoption *unsigned* eligibility PASS and now **Scope Grant SIGNED**; **Formal Adoption NOT YET SIGNED**, Retry Review for this Subject NOT YET SIGNED, one-shot Permit NOT ISSUED/CONSUMED, DA9 official stages **0/6**. Historic first Provider call count/phase UNKNOWN. Handoff PR #3298 stays Draft/Open/Unmerged, protected main `2b63652297bb285f21c4d4c63c37d247d009142c`.

---

## 2026-10-23 — DA9 operator Scope Grant approval prompt rejected doubled confirmation (LATEST; 0/6)

Actual Windows operator console shows `OFFICIAL_DIGEST_CALCULATION_PASS` from immutable official `contract.cjs`; exact subject `2b63652297bb285f21c4d4c63c37d247d009142c`, installed-material digest `a68e32fef887e2c22525269bb7839010b9b77e43a0c843c32c93f3ee937e8150`, host `LAPTOP-STN2A2P1`, operator `mcft_cap09_operator_mylr1`, `SCOPE=TEST_ONLY`, proposed grant 24h, `PRODUCTION_AUTHORIZED=false`, `PERMIT_AUTHORIZED=false`.

The human-confirmation Read-Host received **the sentinel repeated twice concatenated with no separator**: `APPROVE_DA9_SCOPE_2B636522APPROVE_DA9_SCOPE_2B636522`. The fail-closed exact comparison deliberately returned `NO_APPROVAL_NO_SIGNATURE`. This is NOT an Ed25519 signing failure, not a cryptographic authorization receipt, and not a material or policy defect. The script creates output directory and payload **only after** the exact confirmed prompt, therefore this attempt left no grant/payload/signed output by its designed control flow.

**Next minimal step:** operator reruns the unchanged reviewed script and types/pastes exactly ONE `APPROVE_DA9_SCOPE_2B636522` at the prompt (no duplicate). Observe official `SIGNED_OPERATOR_SCOPE_GRANT_NOT_ADOPTION_OR_PERMIT` plus new exclusive signed file location/hash. If the operator does not intend to approve, STOP; no signature. No source code/Material/QCP/Path changes, no extra independent approval, no attempts to infer approval from the repeated text and bypass machine check. Only after real grant confirmation use official Formal Adoption signing and cryptographic verification under frozen process PATH. Run `da9db7129607`, original Provider calls/phase UNKNOWN, true stage count **0/6**, no Adoption/Permit/signatures as of this attempt. Keep Handoff #3298 Draft/Open/Unmerged.

---

## 2026-10-23 — Operator Scope Grant signing helper node -e PowerShell quoting HOLD (LATEST; 0/6)

User ran previously supplied **operator-interactive grant review PowerShell** but it failed **before prompting for approval** or calling any signer: Windows PowerShell argument quoting transformed `node -e` JavaScript `const fs = require("fs");` into `const fs = require(fs);`, yielding Node 24.19.0 `ReferenceError: Cannot access 'fs' before initialization`. Operator's script immediately threw `OFFICIAL_DIGEST_CALCULATION_FAILED`, prior to computing the official `contract.cjs` policy/material canonical SHA-256 digest. **No signed Scope Grant, no Formal Adoption, no Retry Review, no Permit, and no DA9 stage launch occurred.** This is an external helper quoting issue, not a defect in frozen GEOX source, installed material or signer.

Resolved method: avoid passing JavaScript source through Windows `node -e`; write a separately scoped UTF-8-without-BOM external temporary `.cjs` file that only calls frozen official `contract.cjs` exported `digest` over the real `offline-trust.json` and 18,863-file `installed-material.json`. Invoke Node on that file with absolute paths; delete the helper in `finally`. Fail closed on mismatch against known material digest `a68e32fef887e2c22525269bb7839010b9b77e43a0c843c32c93f3ee937e8150`, signed issuer policy registration, subject `2b63652297bb285f21c4d4c63c37d247d009142c`, actual Windows machine and human approval. Only AFTER explicit `APPROVE_DA9_SCOPE_2B636522` may write fresh reviewed source and payload and invoke official `signer.cjs scope-grant-sign` with operator's existing Ed25519 key, storing new evidence outside immutable Runtime. Scope Grant is **not** Adoption/Permit; independent Formal Adoption still requires frozen Path process-only recovery, official issuer verification and separate operator review/TTL.

Prior read-only eligibility remains actual **`ADOPTION_READONLY_INTEGRITY_PASS_HUMAN_SCOPE_REVIEW_REQUIRED`** with `material_files_verified=18863` and `release_files_verified=6455`; earlier CRLF/Source, loader and environment gates remain closed. Do not recreate those results. Handoff PR #3298 stays Draft/Open/Unmerged; protected main unchanged. Run `da9db7129607`; original failed Provider calls/phase UNKNOWN; real stage receipts 0/6.

---

## 2026-10-23 — DA9 exact-subject Adoption V2 pre-sign integrity PASS on Windows (LATEST; 0/6)

Windows operator supplied exact console from **2026-10-23T09:17:59Z**: temporary process-only restore of genuine **frozen installation-time Path** succeeded (`FROZEN_PROCESS_PATH_MATCH_PASS`) and existing official-backed Adoption V2 read-only checker returned **`ADOPTION_READONLY_INTEGRITY_PASS_HUMAN_SCOPE_REVIEW_REQUIRED`**, checkpoint `COMPLETE_UNSIGNED`, `reason_code=null`. The PowerShell `try/finally` then printed `ORIGINAL_PROCESS_PATH_RESTORED=True`. No host machine/user PATH changes or installed profile modifications were made.

- Exact protected subject `2b63652297bb285f21c4d4c63c37d247d009142c`. Verified in that run `material_files_verified=18863` and `release_files_verified=6455`. Prior actual static 102-file graph and external Python 140-site/34-DLL witness remain distinct, cannot be upgraded to full dynamically loaded native dependency closure.
- Profile immutable `D:\gptdown\MCFT-CAP09-DA9-2b636522-INSTALLED-20261023T072259804Z\installed-material.json`, digest `a68e32fef887e2c22525269bb7839010b9b77e43a0c843c32c93f3ee937e8150`. Runtime fixed same parent `portable-runtime`; successful V2 evidence `D:\gptdown\MCFT-CAP09-DA9-ADOPTION-ELIGIBILITY-2b636522-20261023T091759897Z\eligibility.json`. Earlier failed V1 and V2 `EXECUTION_ENVIRONMENT_DRIFT` reports retained as historical failures, NOT used as current status.
- Operator private key read-only precheck returned `operator_private_key_status=KEY_FINGERPRINT_MATCHES_REGISTERED_ISSUER`; **key was not used to sign**. Per repo offline trust, actual operator Ed25519 issuer `mcft_cap09_operator_mylr1` key ID `mcft_cap09_ed25519_223c806e`, SPKI SHA256 `223c806e89c4e6df5e91a089e0b22e5cef05934d42ee7df817faaeaa67553365`, registered host `LAPTOP-STN2A2P1`. This accountable operator issuer has **no embedded formal_adoption_scope**; a **new** operator-reviewed, cryptographically signed exact-material Scope Grant is mandatory. Old 5526 grants/adoptions cannot transfer.
- Proper next order: create **unsigned** Scope Grant review source with subject, material digest, host, issuer, scope TEST_ONLY, production prohibited, bounded validity and authoritative operator review reference. Operator checks and gives explicit approval, official `node scripts/cap09_adoption_v1/signer.cjs scope-grant-sign reviewed-payload private-key signed-output` signs real grant. Then process-only restore frozen Path, official `signer.cjs formal-adoption` exact QCP adoption-candidate/material/runtime/operator signer/TTL/new output/**signed scope grant**, independently verify on actual installed Host. Do not automatically sign or issue a one-shot Permit. Avoid mutating existing QCP/Material/Runtime or historical evidence.
- **Status after Windows V2**: exact merged QCP/Release/Material/adoption *eligibility* PASS; `scope_grant_required=true`; `adoption_signed=false`, `permit_signed=false`, `execution_authorized=false`, `production_authorized=false`. DA9 Run `da9db7129607`, first failed attempt Provider calls/phase UNKNOWN and 0/6 official real stage receipts. Handoff PR #3298 stays Draft/Open/Unmerged.

---

## 2026-10-23 — DA9 Adoption eligibility Path-only environment difference diagnosed (LATEST; action pending)

Actual Windows PowerShell operator read-only differential against fixed immutable `installed-material.json`:
```text
Variable               Match ExpectedLength ActualLength
MCFT_PYTHON_EXECUTABLE  True              65          65
PATHEXT                 True              58          58
Path                   False            1054         994
SystemRoot              True              10          10
windir                  True              10          10
ENVIRONMENT_MISMATCH_COUNT=1
ENVIRONMENT_MISMATCH_KEYS=Path
READONLY_DIAGNOSTIC_COMPLETE_NO_MATERIAL_CHANGE
```
**First actual failing gate** remains `ADOPTION_READONLY_PRECHECK_HOLD / EXECUTION_ENVIRONMENT_DRIFT`; this narrows exact discrepancy to process-level `Path` only. Difference 60 UTF-16 character positions (length, not an assumed literal substring). It does not indicate mismatched QCP, 6,455 source bytes or 18,863-file installed profile; those previously passed independently. No private paths or full PATH values printed in chat.

**Next and only action:** In a PowerShell `try/finally`, capture original `[Environment]::GetEnvironmentVariable('Path','Process')`, read captured `Path` from `D:\gptdown\MCFT-CAP09-DA9-2b636522-INSTALLED-20261023T072259804Z\installed-material.json` profile `environment.public_values`, confirm it is nonempty and length 1054 and its `MCFT_PYTHON_EXECUTABLE` equals pinned profile tools.python.path, set **process-only Path** to that legitimate captured installation-time value, run existing V2 tool `D:\gptdown\MCFT-DA9-ADOPTION-ELIGIBILITY-V2-2b636522\RUN-DA9-ADOPTION-ELIGIBILITY-PS51.ps1` and always restore previous process Path in `finally`. Existing V2 tool generates new exclusive evidence directory; never overwrite the earlier V1/V2 HOLD logs. Do NOT set machine/user PATH or edit installed-material.json or introduce a mock environment to the verifier. Do NOT claim PASS prior to actual V2 machine output; failures stay HOLD.
 
On genuine `ADOPTION_READONLY_INTEGRITY_PASS_HUMAN_SCOPE_REVIEW_REQUIRED` (only then), review the new exact-Subject/18,863-material Scope Grant and registered operator Ed25519 key fingerprint, then obtain explicit operator approval for official signing; do not auto-sign Adoption/Retry/Permit. First attempt Provider calls and phase UNKNOWN; real stage receipts **0/6**; production authority FALSE; Handoff PR #3298 Draft/Open/Unmerged.

---

## 2026-10-23 — DA9 Adoption eligibility V2 real Windows environment drift HOLD (LATEST; Run da9db7129607; real stages 0/6)

**Observed actual Windows console from operator**, distinct from earlier V1 missing-function helper bug. Exact subject `2b63652297bb285f21c4d4c63c37d247d009142c`, fixed installed material digest `a68e32fef887e2c22525269bb7839010b9b77e43a0c843c32c93f3ee937e8150`. Operator ran V2 external read-only `RUN-DA9-ADOPTION-ELIGIBILITY-PS51.ps1` from `D:\gptdown\MCFT-DA9-ADOPTION-ELIGIBILITY-V2-2b636522`. Pinned Node exactly `C:\Users\mylr1\AppData\Local\Volta\tools\image\node\24.19.0\node.exe`. V2 created exclusive evidence root `D:\gptdown\MCFT-CAP09-DA9-ADOPTION-ELIGIBILITY-2b636522-20261023T091221072Z` with `eligibility.json`.

- **Genuine official rejection**: `ADOPTION_READONLY_PRECHECK_HOLD`, `checkpoint=MATERIAL_PROFILE_AND_ENVIRONMENT`, `reason_code=EXECUTION_ENVIRONMENT_DRIFT`; `material_files_verified=0`, `release_files_verified=0`. These two counters reflect the V2 helper assigning counters only *after* full `installed-material.verify` success; they do not prove files were unverified. No signed Scope Grant, Formal Adoption, Retry, Permit or Stage launched.
- Official fixed `scripts/cap09_adoption_v1/installed-material.cjs` verifies complete 18,863-file inventory against immutable profile, tool bytes (Node/Python/PowerShell), actual Node executable identity, allowed variable names, frozen selected public environment keys (`PATH`, `PATHEXT`, `SYSTEMROOT`, `WINDIR`, `MCFT_PYTHON_EXECUTABLE`), then no injection env names. `EXECUTION_ENVIRONMENT_DRIFT` is returned **only** by a frozen public-value exact comparison; prior checks necessarily passed in that attempt. Cause is actual session/process environment drift relative to installation-time values (or case-key mismatch), **not evidence of source/material tampering**.
- V2 wrapper temporarily sets `MCFT_PYTHON_EXECUTABLE` to pinned profile Python then restores it. Do not compare this variable with an arbitrary interactive PowerShell value without simulating that wrapper choice. Likely drift relates to `PATH` / `PATHEXT` / `SYSTEMROOT` / `WINDIR`, but **the exact variable has not been observed**, so do not claim or preemptively fix any one.
- **Next action = one minimal read-only diff against `profile.environment.public_values` and live PowerShell Process env, treating MCFT_PYTHON_EXECUTABLE as bound Python used by wrapper.** Print only keys, match boolean, lengths and optional SHA-256 of values (avoid credential disclosure); preserve actual profile JSON unchanged. If differences exist, assess why host PATH/other value changed, restore genuine previously witnessed trusted process configuration in a **new short-lived child shell**, then rerun same existing V2 tool in a new exclusive output directory. Never overwrite evidence, regenerate 18,863-file material, mutate trust policy, pass simulated environment object to official verifier, or make a GitHub source code PR merely to silence this gate.
- If profile environment values cannot be genuinely reproduced without undermining execution environment, KEEP HOLD and report actual mismatch / remediation plan; do not sign anything. Previous QCP 54, Release 6455, installed material 18863, static graph 102 + external Python native 140 files/34 DLL and no-effect TSX/pg/GFS smoke results remain historical PASS; no current Adoption eligibility PASS yet.
- Stage count **0/6**, `adoption_signed=false`, `permit_signed=false`, `permit_consumed=false`, no production authority, original failed Provider calls/phase remain UNKNOWN. Handoff #3298 stays Draft/Open/Unmerged, protected main unchanged.

---

## 2026-10-23 — DA9 Adoption read-only V1 external helper API failure, V2 fixed/tested (LATEST; 0/6)

Windows operator executed external `MCFT-CAP09-DA9-ADOPTION-ELIGIBILITY-READONLY-2b636522.zip` against already qualified **exact** 2b636522 merged material. The printed result was `ADOPTION_READONLY_PRECHECK_HOLD` with reason `offline.validateStaticPolicy is not a function`, `material_files_verified=0`, `release_files_verified=0`, pinned Node `C:\Users\mylr1\AppData\Local\Volta\tools\image\node\24.19.0\node.exe`. Failed machine receipt: `D:\gptdown\MCFT-CAP09-DA9-ADOPTION-ELIGIBILITY-2b636522-20261023T085937960Z\eligibility.json`. **Root cause is an external off-Runtime probe calling an unexported private function in official `offline-context.cjs`.** It is NOT an actual QCP/Release/Material verification failure; no Adoption signer/Permit/Stage was invoked. Preserve the failed receipt and original probe tool for forensics; do not relabel or erase it.

The original helper had two additional independent defects caught during systematic review/testing, BEFORE repeating Windows: (i) expected check evidence names `^[A-Za-z...].json$` but canonical merged QCP generator writes `checks/<NN>-<ID>.json`; (ii) incorrect `assert.equal(Date.parse(policy.valid_until)>now,'POLICY_EXPIRED')`, which compares Boolean to a string and always fails. A fourth observability issue flattened Node assertions to generic `ERR_ASSERTION`. These are **external helper mistakes**, not new GEOX production-code blockers. Do not propose a source PR, mock/modify official exports, or reissue the installed material.

Corrected external-only tool: `MCFT-CAP09-DA9-ADOPTION-ELIGIBILITY-READONLY-V2-2b636522.zip`, immutable artifact SHA-256 **`c8aa33650dea475ea51351f091eb32e4427a70d4fffa5c0a497b85e969b3878f`**. It uses a strict local read-only mirror of the official *private* static policy shape gate (preserves schema, default disabled, null static subject, expiry, 54 IDs, allowed N/A and registered issuers); invokes only actually exported official `offline.validateMergedDerivation` and `offline.verifyReleaseSourceBinding`, plus official `installed-material.verify`. It accepts only `checks/[A-Za-z0-9_.-]+.json` under QCP, compares original SHA-256 evidence, fixes policy expiry assertion, and reports bounded safe reason code + checkpoint without stack/credentials. Frozen Runtime files and Git main unchanged.

**V2 local test evidence (synthetic fixture, NOT real Windows re-verification):** `node --check` PASS; positive path validates 18,863 stub inventory rows, 6,455 stub manifest rows, 54 check evidence rows under `checks/`; tampered evidence FAIL/HOLD; static `adopted=true` FAIL/HOLD; ZIP CRC PASS. Test fixtures deliberately mock material/release verifier to exercise control flow; they must never be presented as real installed-material checks. Wrapper still invokes genuine official verifiers on actual operator Windows for the real gate. No signer, Provider/DB/MinIO/Host/Stage side effects.

**Next single action:** unzip V2 to NEW tool dir `D:\gptdown\MCFT-DA9-ADOPTION-ELIGIBILITY-V2-2b636522` and run `RUN-DA9-ADOPTION-ELIGIBILITY-PS51.ps1`, preserving the V1 failed evidence. It creates a NEW exclusive eligibility evidence root and has exact fixed Runtime `D:\gptdown\MCFT-CAP09-DA9-2b636522-INSTALLED-20261023T072259804Z\portable-runtime`, profile digest `a68e32fef887e2c22525269bb7839010b9b77e43a0c843c32c93f3ee937e8150`, unsigned QCP `D:\gptdown\MCFT-CAP09-DA9-QCP-2b636522-20261023T054723422Z`. Only Windows result `ADOPTION_READONLY_INTEGRITY_PASS_HUMAN_SCOPE_REVIEW_REQUIRED` would close the pre-sign eligibility check; **it does NOT grant/sign Adoption**. Human reviewed current-material Scope Grant, actual official TEST_ONLY Formal Adoption/Retry, then live science + short-lived PG/MinIO/ACL+Permit and official Preflight remain separate. Real stages **0/6**, first Provider call count/phase from earlier failed attempt UNKNOWN. Handoff PR #3298 remains Draft/Open/Unmerged; protected main `2b63652297bb285f21c4d4c63c37d247d009142c`.

---

## 2026-10-23 — Windows transitive static graph + Python native witness PASS — latest checkpoint, execution 0/6

Actual operator Windows PowerShell output, 2026-10-23T08:50Z, exact protected main and signed-target **subject** `2b63652297bb285f21c4d4c63c37d247d009142c`, installed material digest `a68e32fef887e2c22525269bb7839010b9b77e43a0c843c32c93f3ee937e8150`. Evidence root outside runtime: `D:\gptdown\MCFT-CAP09-DA9-TRANSITIVE-WITNESS-2b636522-20261023T085003414Z`.

- V1 external test was unzipped into an EXISTING `D:\gptdown\MCFT-DA9-TRANSITIVE-REVIEW-V1-2b636522` directory despite first operator guard `目录已存在，禁止覆盖`. The result nevertheless belongs to the newly created exclusive evidence root; do not mistake reused **tool** directory for fresh checked evidence. Future scripts must stop after a guard failure instead of manually continuing; do not overwrite any historic diagnostic artifact.
- Five official stage/host source roots were resolved as *static* esbuild dependency graphs **without evaluation or stage import**: HOST 25; PRODUCER 74; TIMING 70; DELAY 26; AGGREGATE 2. Union `graph_file_count=102`, `graph_list_sha256=f9348b3c043218d84393a10ec1cd9042a8833c460a2427c445005e6ced7a83fc`. Output `DA9_TRANSITIVE_ESBUILD_STATIC_GRAPH_BOUND_NOT_FULL_EXECUTION_CLOSURE`; `no_stage_module_imports=true`, `full_dynamic_module_closure_proven=false`.
- Separate genuine Windows imported Python native witness: `DA9_PYTHON_NATIVE_HASH_WITNESS_ONLY_NOT_SIGNED_MATERIAL`; `imported_site_package_file_count=140`, `loaded_external_native_dll_count=34`, `host_site_packages_bound_to_installed_material=false`. Actual site packages and external DLL digests are *observations*, **NOT part of the existing immutable 18,863-file installed-material profile**. Never convert this result into a claim of signed native dependencies without an explicit approved contract.
- Overall operator receipt `DA9_TRANSITIVE_STATIC_GRAPH_AND_NATIVE_PROVENANCE_WITNESSED_NOT_ADOPTION`. `adoption_signed=false`, `permit_signed=false`, `execution_authorized=false`, and no production authority. Real DA9 six stages remain **0/6**, run ID `da9db7129607`.
### Prepared exact-Subject Adoption read-only eligibility check (not yet run on Windows)

- Current protected main `2b63652297bb285f21c4d4c63c37d247d009142c`, verified 6455 Release source, 18863 installed material digest `a68e32fe...`, 102 static graph and external 140 site-package/34 DLL witness. These facts qualify source/material inspections, **NOT Stage/Permit permission**.
- Official `scripts/cap09_adoption_v1/signer.cjs` binds candidate `adoption-candidate.json`, immutable `installed-material.json`, exact Runtime root, private Ed25519 key, reviewed TTL, new signed-output and (for the accountable single-operator issuer) **separately signed exact-material Operator Scope Grant**. The offline trust registry's operator issuer `mcft_cap09_operator_mylr1`, key ID `mcft_cap09_ed25519_223c806e`, registered Ed25519 SPKI SHA-256 `223c806e89c4e6df5e91a089e0b22e5cef05934d42ee7df817faaeaa67553365` has **NO embedded formal_adoption_scope**. Existing 5526 grant is NOT transferable. Independent adoption issuer is an alternative registered role but do NOT reimpose an independent third-party approval requirement on accountable operator.
- Offline-trust adoption policy valid until `2026-11-13T00:00:00.000Z`, registered host `LAPTOP-STN2A2P1`, operator `mcft_cap09_operator_mylr1`; these must be checked against actual Windows clock and host, and signer key fingerprint, not assumed.
- New external unsigned utility `MCFT-CAP09-DA9-ADOPTION-ELIGIBILITY-READONLY-2b636522.zip` ZIP SHA256 `9b48f607d4134e69aff9b15e4ed27ad18263e62f246bc009f430202253349c6d` (JS+PS5.1 wrapper+README), Node syntax PASS, ZIP CRC PASS, negative missing-runtime failure PASS; **NOT YET EXECUTED IN USER WINDOWS**. It executes immutable repository's read-only `installed-material.verify`, static policy, full QCP candidate/evidence+zero-delta derivation, bound Release inventory checks, optional local existing private key **public fingerprint comparison only**; no signatures, no Grant drafts autoapproved, no runtime mutation, no Provider/PG/MinIO/Stage calls. Must keep new external evidence root and the initial HOLD reason if environment profile differs. SUCCESS is `ADOPTION_READONLY_INTEGRITY_PASS_HUMAN_SCOPE_REVIEW_REQUIRED`; human scope review/signature is still a separate conscious act.
- Next operator step: unzip to new tools directory, run `RUN-DA9-ADOPTION-ELIGIBILITY-PS51.ps1`, inspect exclusive external `eligibility.json`. If exact-material + operator signer precheck PASS, explicitly review and sign current bound Scope Grant, then sign/verify short-lived formal TEST_ONLY Adoption using existing real Windows signer. **Do not manufacture a signature or future deadline, use old Subject signatures, or blindly sign without legitimate human review.** No code change to protected main needed.
- Genuine prior DA9 first execution Provider calls/phase UNKNOWN; current run `da9db7129607`, six-stage receipts 0/6; sign/consume of future Permit remains forbidden until real fresh resource+V3 scientific gates.

- **Next target = exact-subject Formal Adoption eligibility review rather than yet another unbounded dependency probe**. The current `scripts/cap09_adoption_v1/signer.cjs` performs verified QCP+Release+full installed-material+registered Ed25519 issuer+host/policy+signed scope grant (if operator has no embedded formal scope). Run pre-sign **read-only** inspection of `candidate/adoption`, immutable material profile/environment, issuer registration/fingerprint, host/time and genuine existing authorized operator scope; NOT sign blindly and never present an unsigned grant as authority. If the frozen signing contract formally excludes external Python site packages, flag the bounded scientific runtime risk for operator review; do not patch frozen code or claim closure from external witness alone. After independent actual operator approval, issue valid short-lived TEST_ONLY formal Adoption and verify it on this installed Host before signed Retry V2 and live dynamic admission.
- **DO NOT REBUILD** verified 6,455 Release, 18,863 Installed Runtime, redo 54-check QCP, previous CRLF/exporter fixes, static TSX/pg/GFS smoke, or regenerate existing QCP/material. Preserve existing historical Closure/WORM/provider-call UNKNOWN and one-shot ledger. Handoff PR #3298 stays **Draft/Open/Unmerged**; protected main unchanged.

---

## 2026-10-23 — DA9 TSX / pg / GFS no-effect loader smoke real Windows PASS (LATEST; execution 0/6)

Operator Windows PowerShell run confirmed **`DA9_NOEFFECT_LOADER_TSX_PG_GFS_SELFTEST_PASS_NOT_FULL_IMPORT_CLOSURE`**, against exact protected merged subject `2b63652297bb285f21c4d4c63c37d247d009142c`, immutable new Installed Material profile digest `a68e32fef887e2c22525269bb7839010b9b77e43a0c843c32c93f3ee937e8150`; actual evidence root `D:\gptdown\MCFT-CAP09-DA9-LOADER-NOEFFECT-2b636522-20261023T075103573Z-48ff14` outside installed Runtime. Report `schema=DA9_LOADER_NONSEALED_SELFTEST_V1`, `started_at=2026-10-23T07:51:03.576Z`, `completed_at=2026-10-23T07:51:06.907Z`.

- Actual `node --import tsx` TypeScript transformation via **external fixture only**: `TSX_REAL_TRANSFORM_PASS_NO_STAGE_IMPORT`.
- Actual installed `pg` package constructor import with no pool, network or DB connection: `PG_IMPORT_PASS_NO_CONNECTION`.
- Official installed Python GFS scientific core `selftest`: `GFS_SCIENTIFIC_CORE_SELFTEST_PASS_NO_PROVIDER`; 72 points as coded scientific fixture, NOT a live 72h GFS source capture.
- Machine report: `tsx_real_transformation=true`, `pg_package_import_without_connection=true`, `scientific_selftest=true`, `source_postchecks_pass=true`, `provider_calls=0`, `database_connection_attempts=0`, `s3_calls=0`, `stage_launches=0`; `execution_authorized=false`, `production_authorized=false`.
- Critical remaining gates: `full_import_closure_verified=false`, `python_site_packages_fully_bound=false`, `full_material_reverification_now=false`, `host_admission=false`, `adoption_signed=false`, `permit_signed=false`, `permit_consumed=false`. Do not promote three no-effect smoke tests to full loaded-stage closure or formal Adoption. No real run-stage receipts: **0/6**.
- **Prepared successor probe; NOT YET RUN ON WINDOWS:** `MCFT-CAP09-DA9-TRANSITIVE-GRAPH-NATIVE-V1-2b636522.zip`, SHA-256 `ecfe7c5633ebb0f292c581249172259c0a98017d0f4f490e2bc8f8ab84b05b3d` (9 KB). Windows PS 5.1/7 wrapper `RUN-DA9-TRANSITIVE-GRAPH-AND-NATIVE-PS51.ps1`. Node uses installed `tsx` nested `esbuild` with `bundle:true, metafile:true, write:false` on real Host/Producer/Timing/Controlled Delay/Aggregate sources, hashes all statically reached files against 18,863 material; does not require/execute stage code. Python uses pinned interpreter and imports only `eccodes`/`cffi`, hashes imported site-package files and enumerates/ hashes loaded non-system native DLLs, storing supplemental external witness; does **NOT** retroactively include site packages in installed material profile or prove all possible runtime dynamic imports. Synthetic helper checks and ZIP CRC passed; this is NOT the operator's live result. Output exclusive `D:\gptdown\MCFT-CAP09-DA9-TRANSITIVE-WITNESS-2b636522-<UTC>`. Any resolver/dynamic/native gap => HOLD with preserved diagnostics. If PASS, proceed to review for actual signed Adoption under existing governance path; no extra approval tier added.
- Next action: single bounded external-only read-only review of **actual transitive Stage module graph** from frozen 2b636522 Host / Producer / Timing / Delay / Aggregate entrances; confirm all touched module bytes and native dependencies match the signed installed profile, including Python `eccodes` + CFFI/native GRIB runtime binding, without executing stage entrypoints or opening Provider/PG/S3. Inspect any uncovered dynamically loaded paths and HOLD if unresolved; keep current 18,863-file material unchanged. Only after this clearance may real exact-subject Scope Grant / Formal Adoption be proposed via existing authorized Windows signers.
- Do not repeat passed QCP (54 checks), Release (6455 files), Installed Material (18863 files), static module resolution (16 entries), TSX/PG/GFS smoke. Stay TEST_ONLY, Run `da9db7129607`; old 5526/130786cb signed evidence and previous failed attempt remain archived without forgery or deletion. Handoff #3298 remains Draft/Open/Unmerged.

---

## 2026-10-23 — DA9 loader static 16 entrypoints PASS (LATEST)

Operator's Windows PowerShell console from `D:\gptdown\MCFT-CAP09-77CDEEEF-QUALIFICATION-KIT` reports **`DA9_LOADER_STATIC_PATHS_PASS_NOT_FULL_IMPORT_EXECUTION`** for exact merged subject `2b63652297bb285f21c4d4c63c37d247d009142c` and previously verified installed digest **`a68e32fef887e2c22525269bb7839010b9b77e43a0c843c32c93f3ee937e8150`**. This confirms only static module resolution and hashed bytes, NOT running the application or verifying the entire transitive import graph.

- Installed Runtime fixed: `D:\gptdown\MCFT-CAP09-DA9-2b636522-INSTALLED-20261023T072259804Z\portable-runtime`; profile `D:\gptdown\MCFT-CAP09-DA9-2b636522-INSTALLED-20261023T072259804Z\installed-material.json`.
- Read-only external probe package `MCFT-CAP09-DA9-LOADER-STATIC-READONLY-2b636522.zip` under operator's `D:\gptdown\MCFT-CAP09-DA9-LOADER-STATIC-PROBE-2b636522`, no active Stage import, Provider, PG, MinIO or Permit.
- `checked_entrypoints=16`. Verified `tsx` from Runtime cwd and Host resolves `node_modules/tsx/dist/loader.mjs`; `pg` from Producer and Timing resolves `node_modules/pg/lib/index.js`; `esbuild` from TSX's context resolves `node_modules/tsx/node_modules/esbuild/lib/main.js`. `native_binary_files_hashed=2`. Node/Python/PowerShell executable bytes checked against the installed profile. `runtime_imports_executed=false`.
- **Remains HOLD:** dynamic ESM/TSX loader and compiler actually working under the pinned Node runtime; Python GRIB/eccodes scientific selftest; native-loaded dependency closure and full application module imports; current host admission / Adoption signatures / one-shot Permit. `full_import_closure_verified=false`, `python_scientific_selftest_executed=false`, `host_admission=false`, `adoption_signed=false`, `permit_signed=false`, `permit_consumed=false`, `execution_authorized=false`, `production_authorized=false`.
- **Next exact action**: run a safe, external read-only loader fixture with original runtime's `node --import tsx` and Python `mcft_cap09_gfs_scientific_core_v1.py selftest` under bound interpreters, retaining genuine stdout/stderr and hashes. Synthetic loader success is not a complete runtime import-closure proof. Do NOT launch Provider/Producer/TIMING/stage host/official Permit in these pre-Adoption checks. If incomplete, preserve HOLD, do not regenerate 18,863 material or make new source PR.
- Current mainline execution **0/6**, Run ID `da9db7129607`, existing historical evidence/one-shot ledger preserved. Leave handoff PR #3298 **Draft/Open/Unmerged**.


### Prepared next no-effect loader / GFS selftest bundle (NOT YET RUN on Windows)

External ZIP `MCFT-CAP09-DA9-LOADER-NOEFFECT-SMOKE-2b636522.zip`, SHA-256 `391297544a1d1d0a7f7c501171ca174ef350beedf3e90afbbfebe95886515ee8`. Contains PS5.1 launcher, bounded Node probe, external TypeScript enum transform fixture, external pg constructor import-only fixture and README. Node CJS syntax / ZIP integrity checked in tool builder environment, but **operator has not run this ZIP**, so actual TSX/PG/Python result UNKNOWN.

Run in new external directory `D:\gptdown\MCFT-CAP09-DA9-NOEFFECT-LOADER-PROBE-2b636522` via `RUN-DA9-LOADER-NOEFFECT-PS51.ps1`. It pins existing `a68e32fe...` installed root and tool binary hashes. Checks real `node --import tsx` on external enum fixture, `pg` constructor export import using Producer resolution context WITHOUT Pool construction or DB connection, and frozen GFS scientific Python `selftest` using installed Python `-B`. Outputs exclusive external-only JSON receipts. No real stage import, no Provider/S3/DB/Permit actions. PASS only closes these smoke gates, NOT full transitive stage import closure or native Python site-package binding. All errors preserve HOLD and no adoption authority.


---

## 2026-10-23 — Windows exact 18,863-file Installed Material VERIFIED (LATEST)

**Operator Windows PowerShell results; not a local reread of JSON bytes by ChatGPT.** Run `da9db7129607`; protected merged main still `2b63652297bb285f21c4d4c63c37d247d009142c`. Do not rebuild source/QCP or copy a 5526 signed material. Mainline actual official six-stage execution **0/6**, Permit **NOT SIGNED / NOT CONSUMED**, production prohibited.

Latest completed:
- Prerequisite exact Git Blob Release source `D:\gptdown\MCFT-CAP09-DA9-2b636522-EXACT-RELEASE-SOURCE-V2`, 6,455 SHA-checked source files, trusted Binding SHA-256 `800a3fcf042a3fa4e1dec382de4110d07868ab9ae3a3626b5389c8126de5d7e4`, original official result `RELEASE_SOURCE_BYTES_MATCH_EXECUTE_HOLD`.
- Separate new Windows Runtime: `D:\gptdown\MCFT-CAP09-DA9-2b636522-INSTALLED-20261023T072259804Z\portable-runtime`. Material file: `D:\gptdown\MCFT-CAP09-DA9-2b636522-INSTALLED-20261023T072259804Z\installed-material.json`. Assembly report: same parent `assembly-report.json`.
- Real builder output `PREBUILD_VERIFIED`: donor 18,857 files; 6,455 current-scoped source files; 12,408 hashed inherited dependency files; 0 ignored non-scoped old files; recomposed material **18,863** files. Importing old version's immutable *file bytes* was allowed for dependency reuse only after hashing; this does NOT inherit old Adoption or scientific qualification. New exact Host entrypoint separately matched trusted release bytes; official `material_binding.py` returned 6455 PASS plus loaded Host entrypoint PASS.
- Real official `installed-material.cjs` collection result `INSTALLED_MATERIAL_COLLECTED_AND_SELF_VERIFIED`, then independent **`INSTALLED_MATERIAL_REVERIFIED`** with complete 18,863 inventory and digest **`a68e32fef887e2c22525269bb7839010b9b77e43a0c843c32c93f3ee937e8150`**. Windows host collection bound tools `C:\Users\mylr1\AppData\Local\Programs\Python\Python312\python.exe` and `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`, as well as executing Node program/tool digest and collector environment (not included verbatim in handoff).
- Remaining explicit negative flags **`loaded_import_closure_verified=false`, `host_admission=false`, `adoption_signed=false`, `permit_signed=false`, `execution_authorized=false`, `production_authorized=false`**. No official Windows Host Preflight, fresh resource witness, signed Retry V3 Permit or six-stage stage receipts were supplied.

Next only:
1) Preserve installed Runtime, release source, QCP and all old evidence read-only; **do not rerun builder or regenerate installed-material.json** (environment/tool path and digest would shift). Verify current node/tsx/native/Python dependency resolution at this *same installed root*, fail closed on changes or imports leaving the trusted payload, with read-only/external evidence. Do not run Producer/Provider/DB/MinIO or Permit consumption in this static check.
2) Once loaded dependency closure and local authority invariants are fully evidenced, use **actual existing Windows signing path** for exact-subject Operator Scope Grant / Formal Adoption / signed Retry Review, while independently checking issuer fingerprint and validity. Older 5526/130786cb signatures cannot apply.
3) Only then coordinate future FirstBase, actual operator-reviewed six-stage V3 caps+15-minute margin, current GFS/KBS source-at-use scientific validity, short-lived two-PG/MinIO-four-zero/ACL/Owner readbacks, signed Permit and official parent Preflight before any authorized isolated TEST_ONLY execution. Never invent Provider future availability deadline or silently backdate. Stage success only based on true receipts 1/6...6/6.

**Current state:** QCP PASS; Release 6455 PASS; new Installed Material 18863 PASS; **loader/native/environment execution closure still HOLD**; Adoption/Permit NOT SIGNED; official stages **0/6**. Leave Handoff PR #3298 Draft/Open/Unmerged.

---

## 2026-10-23 — DA9 2b636522 Release exact 6455 Git blobs VERIFIED on Windows (LATEST)

Operator's 2026-10-23 Windows PowerShell output confirms the external exporter V2 now **PASS**, superseding the earlier V1 `BATCH_GIT_BLOB_TRUNCATED` HOLD below. Preserve that failed attempt and partial V1 output as immutable diagnostics, **do not retry V1 or change Git/worktree line endings**.

- Current exact protected main, unchanged: `2b63652297bb285f21c4d4c63c37d247d009142c`.
- The V2 exporter detected known `CRLF_CHECKOUT_CONVERSION` in five PowerShell checkout files and bypassed the checkout, exported **6,455 exact Git Blob files** in read_exact() batches with progress at 1000/2000/3000/4000/5000/6000; official `material_binding.py` emitted `RELEASE_SOURCE_BYTES_MATCH_EXECUTE_HOLD`.
- Original trusted release manifest digest `800a3fcf042a3fa4e1dec382de4110d07868ab9ae3a3626b5389c8126de5d7e4`; `files_verified=6455`, `RELEASE_SCOPED_TOTAL_BYTES=48562088`; `loaded_paths_verified=[]`. New exact source directory `D:\gptdown\MCFT-CAP09-DA9-2b636522-EXACT-RELEASE-SOURCE-V2`. Existing successful unsigned QCP directory remains `D:\gptdown\MCFT-CAP09-DA9-QCP-2b636522-20261023T054723422Z`. Keep both stable, no overwrites.
- **The Release source-byte gate is now CLOSED/PASS**, not the Installed Runtime gate. Official machine fields still say `installed_dependencies_verified=false`, `host_configuration_verified=false`, `execution_authorized=false`, `production_authorized=false`, `ADOPTION_SIGNED=false`, `PERMIT_SIGNED=false`, `PERMIT_CONSUMED=false`. Do not report a full Runtime PASS or TEST_ONLY execution from source-only success.
- Next engineering stage: build a **new, distinct Windows portable Runtime** by taking exact new Release source bytes + individually verified old dependency files; independently collect/verify the COMPLETE installed material including Node/Python/PowerShell binaries and actual host environment. Three earlier runtimes have different Host bytes; never transfer old material digest/signature/Adoption, never edit the old directories or use original checkout-converted `.ps1` bytes as trusted sources. Resolve any extra executable/generated artifact by evidence, rather than silently reusing untracked old code. No GitHub source PR required for an external material builder.
- After full Installed Material & loaded dependency closure: fresh exact-subject signed Scope Grant / Formal Adoption / signed Retry Review (actual signer on Windows, no synthetic keys); human reviewed stage-cap/FirstBase V3 budget; dynamic PG+MinIO+ACL+Owner+GFS/KBS; official Host `--preflight-only`; separately authorized one-shot Permit and actual stages. Preserve Run ID `da9db7129607`, first failed attempt evidence (Provider calls/phase UNKNOWN), historical Closure/WORM/nonce ledger.
- **Actual six-stage real receipts remain 0/6**. Handoff PR #3298 remains Draft/Open/Unmerged (DO NOT MERGE).

---

## 2026-10-23 — DA9 2b636522 post-merge Windows QCP / Release pipeline checkpoint (LATEST; execution 0/6)

**This is the current exact frontier, superseding earlier 5526 V2 Provider-deadline and PR-unmerged instructions below. Historic entries remain immutable.** The user requested this entry specifically to prevent fresh engineers from repeating completed QCP, reusing obsolete Runtime, or mistaking the source exporter bug for invalid Git evidence. Evidence comprises GitHub main/PR and the operator's original Windows PowerShell console; no unshown Windows files have been inspected by the handoff writer.

### Merged code / immutable identities

- PR [#3729](https://github.com/liyongshang44-max/GEOX/pull/3729) **MERGED** as `2b63652297bb285f21c4d4c63c37d247d009142c` (protected main). Two parents: original main `5526d93f5822c2f333ba997009e9d6605b8959e2` and PR HEAD `828410cbce1b43b5eeee31b75f901fddfad2b231`. Exact Git Tree `b79615e193b9e9793236462c392d6ed21dca0ef5` is identical for merge and PR head (zero-delta).
- V3 contract is **source-at-use safety budgeting**, NOT a fictitious future Provider SLA. Three hours stage caps + fifteen minutes margin = 195-minute theoretical envelope; at actual authorization, require future FirstBase, valid Adoption and signed Permit expiry, human-reviewed current-subject stage caps, and live scientific GFS/KBS validation at each consuming stage. No fake source deadline. V2 historical contract remains regression-only. Cross-platform synthetic V3 parent + negative tests (21 checks), signature/replay/time boundary, V2 historical regression, full candidate QCP and main CI/Acceptance passed. **Synthetic parent tests do not mean official Windows Preflight passed**.
- Merge-head GitHub CI push run `39904666092` PASS (build and acceptance); EA5E2 successor run `39904666078` PASS; Formal-v5 post-graduation run `39904666200` PASS. This is source qualification, not execution authority.

### Windows QCP: SUCCESSFULLY COMPLETED — NEVER RERUN unless source/subject changed

- Genuine existing Git clone / exact merge worktree: `D:\gptdown\GEOX-DA9-2b636522-READONLY-SOURCE` (previous confusion: `D:\gptdown\MCFT-CAP09-77CDEEEF-QUALIFICATION-KIT` is **not** a Git repository; many 27 old clones exist, do not assume CWD or blindly pick one).
- Retained unsigned QCP evidence output: `D:\gptdown\MCFT-CAP09-DA9-QCP-2b636522-20261023T054723422Z`; summary `summary.json`; Release binding `release-material-binding.json`. Windows stdout confirms `FINAL_QCP_ADOPTION_PACKAGE_PREPARED_UNSIGNED` / `FINAL_QCP_UNSIGNED_PASS=2b63652297bb285f21c4d4c63c37d247d009142c`, `formal_checks=54`, frozen paths `108`, `engineering_check=PASS`, and five explicit N/A (`END_TO_END_EVIDENCE_SUPPLY_DEADLINE`, `EXACT_ONE_PRODUCTION_OWNER`, `FORMAL_V5_ACTIVATION`, `V13_PRODUCER_DRIVEN_QUALIFICATION`, `V13_RUNTIME_HARNESS_RESOLVER_MIGRATION`).
- Original unmodified PR QCP ZIP SHA-256 `9e8b0e8bafc4d8a1c52fc77240621ac375ccc0867e43cc26f9a9530a895d0997`; unsigned candidate SHA-256 `86246805107d4a18db76681c4a9a8a05d6edaabeb96eaabc64698f5c7f9d9179`; Release binding SHA-256 `800a3fcf042a3fa4e1dec382de4110d07868ab9ae3a3626b5389c8126de5d7e4`; merge derivation SHA-256 `02a357779581695cd0d22dc82db429240a188812ee7e00f7b9bbd7b2721b04a4`. Mode `ZERO_DELTA_MERGE_DERIVATION`, executed QCP subject is PR head `828410cb...`, NOT merge SHA; `raw_reports_rewritten=false`, `qcp_executed_at_subject=false`.
- **No formal Adoption signed for 2b636522**, no signed Retry review, no Permit, no real Host Preflight or six-stage execute. Any earlier signed 5526/136b/etc qualification is invalid for this new material. The existing historical Closure, WORM, read-only PG/MinIO 4-zero evidence remain retained (useful historical records, not fresh 300s authorization).

### Windows Release bytes: ORIGINAL CHECKOUT FAIL and exporter V1 PIPE BUG (do not misdiagnose Git corruption)

1. Running official `scripts/cap09_adoption_v1/material_binding.py` on the full Git **worktree** with trusted binding `800a3fc...` returned `RELEASE_BINDING_FAIL_EXECUTE_HOLD: CONTENT_DRIFT`, because Windows checkout conversion changes source bytes. After that exception, manual `Write-Host "RELEASE_SOURCE_BINDING_PASS"` printed but **is NOT verification**.
2. Operator's exact release exporter V1 (`D:\gptdown\MCFT-DA9-RELEASE-FIX-2b636522\RUN-DA9-RELEASE-SOURCE-EXACT-PS51.ps1`) identified five earliest original `.ps1` mismatches as `CRLF_CHECKOUT_CONVERSION`: `apps/web/smoke_test.ps1`, `scripts/ACCEPTANCE_AO_ACT_AUDIT_V0.ps1`, `scripts/ACCEPTANCE_AO_ACT_EXECUTOR_V0.ps1`, `scripts/ACCEPTANCE_PROBLEMSTATE_LIFECYCLE_V1.ps1`, `scripts/legacy/delivery/ACCEPTANCE_DELIVERY_ENVELOPE_V0.ps1`.
3. V1 proceeded with **6455 manifest-scoped original Git blobs**, created exclusive output `D:\gptdown\MCFT-CAP09-DA9-2b636522-EXACT-RELEASE-SOURCE`, then failed `BATCH_GIT_BLOB_TRUNCATED:apps/executor/src/run_dispatch_once.ts`. This is a defect of the external *helper exporter*: it used one unbuffered `process.stdout.read(length)` for `git cat-file --batch` and treated a legal short-read as Git corruption. There is no evidence of wrong Git object bytes; this partial output is **NOT qualified and MUST REMAIN untouched for forensics**.
4. **External tool-only V2 fix prepared, not yet run by Windows operator**: `MCFT-CAP09-DA9-EXACT-GIT-RELEASE-FIX-V2-2b636522.zip` (zip SHA-256 `b4c231dd9010b0944093dd9f568dba5025add3e1e82ee480dbdd9d7701fddf5c`). Script `EXPORT-DA9-RELEASE-SOURCE-EXACT-V2.py` uses a bounded repeated `read_exact()` to read each blob until declared size, still rejects *actual* EOF, Git Blob SHA-1 mismatches, binding SHA-256/size/tree mismatches, and then runs the unmodified official `material_binding.py`. Local synthetic forced-short-read positive / early EOF negative / Python compile tests passed, **not a Windows original 6455-blob verification yet**. Wrapper `RUN-DA9-RELEASE-SOURCE-EXACT-V2-PS51.ps1` writes **new exclusive** `D:\gptdown\MCFT-CAP09-DA9-2b636522-EXACT-RELEASE-SOURCE-V2`. Never rerun V1 or reuse previous partially written directory. Do not disable hashes, change Git core.autocrlf, alter main code, or delete prior evidence.

### NEXT TOOL PREPARED — separate Windows Installed Material builder (NOT RUN ON OPERATOR HOST)

Prepared external, non-GitHub-source material helper `MCFT-CAP09-DA9-INSTALLED-MATERIAL-BUILDER-2b636522.zip`, ZIP SHA-256 `b9688f16bccc0daf4159af01b91597ff1eb63473840acb761294f0cd8f69ef51`; has Windows PowerShell 5.1/7 wrapper `RUN-DA9-BUILD-INSTALLED-MATERIAL-PS51.ps1`, standalone Node builder and read-only official material re-verifier. **Prepared/tested with isolated 6,455-source + 1-dependency synthetic fixture; NOT yet executed against the actual Windows 18,857-file donor or deployed new Runtime.** This is not an authorized real deployment.

Source exact directory `D:\gptdown\MCFT-CAP09-DA9-2b636522-EXACT-RELEASE-SOURCE-V2`, trusted QCP `D:\gptdown\MCFT-CAP09-DA9-QCP-2b636522-20261023T054723422Z\release-material-binding.json` SHA-256 `800a3fcf...`, proposed sole donor `D:\gptdown\MCFT-CAP09-5526-DA9-QUALIFIED-CANDIDATE-20261021T174308628Z\portable-runtime` and historical material `installed-material.json` digest `84a835c7c3946fda12ddb7bf464e9953ccebde88b2b8fb162892ead390980c61`. Builder verifies ALL donor file hashes and source SHA, refuses any changed package lock/declaration and unknown stale executable, imports only verified `node_modules` file bytes, creates exclusive `D:\gptdown\MCFT-CAP09-DA9-2b636522-INSTALLED-<new UTC>\portable-runtime`, then runs official source/material-binding and installed-material collector and verifier with actual Node24/Python/PowerShell paths/env. If unavailable, HOLD and preserve partial output; never patch donor, overwrite release, reuse old signed proof, or amend fixed scope.

Even after a material inventory PASS, `loaded_import_closure_verified=false` until independently checked, `host_admission=false`, no Adoption signed or real Preflight. DA9 stage receipts 0/6. This helper is not part of the signed future Runtime; never treat helper mock test as host execution authority.

### Installed Material and immediate next handoff action

- Three known OLD Windows portable runtimes do **not** match new merged Host bytes: `D:\gptdown\MCFT-CAP09-130786CB-0d30804b468a40408d6fc356192080ba\portable-runtime`, `D:\gptdown\MCFT-CAP09-5526-DA9-QUALIFIED-CANDIDATE-20261021T174308628Z\portable-runtime`, `D:\gptdown\MCFT-CAP09-CA79F846-20261021T153029672Z\portable-runtime`; Windows verified `HostBytesMatchNewMain=False` for each. **Do not reuse, patch in place, resign old Runtime, or reexecute effectful MinIO/PG setup**.
- Next operator action: unzip V2 external fix into new directory `D:\gptdown\MCFT-DA9-RELEASE-FIX-V2-2b636522`, then run `RUN-DA9-RELEASE-SOURCE-EXACT-V2-PS51.ps1`. Require actual official `RELEASE_SOURCE_BYTES_MATCH_EXECUTE_HOLD` AND `RELEASE_SCOPED_FILE_COUNT=6455` with exact final subject and trusted binding. If V2 fails, capture **first exact machine error** and HOLD, do not invent PASS.
- ONLY after real Release source bytes PASS: build **fresh separate immutable installed Windows Runtime** for 2b636522 (including validated Node/Python/PowerShell binaries, dependencies and loader profile); use official `scripts/cap09_adoption_v1/installed-material.cjs` collection with real host environment, then independently verify profile/material digest before proposing scope grant, formal Adoption and signed Retry review. Do not confuse source-only 6455-file inventory with former 18,857-file portable installed material or full execution readiness. Subsequently use a genuinely **future** FirstBase + human-approved six-stage V3 cap/source review and renewed short-lived DB/MinIO/ACL/Owner & actual GFS/KBS scientific capture, issue single-use signed Permit only after all real gate evidence, official `--preflight-only` then separately authorized `--execute`. No automatic retries/production/Formal/A0/O00.
- **Execution checkpoint:** DA9 0/6; `execution_authorized=false`, `production_authorized=false`, Adopt `NOT_SIGNED`, Permit `NOT_SIGNED/NOT_CONSUMED`. No handoff update itself is an execution permit. Handoff PR #3298 must remain **Draft/Open/Unmerged**, and only this existing Active Continuation file should be prepended.

---

## 2026-10-22 — DA9 CTO dependency-order correction and cold review kit V2

Execution priority: reviewed six-stage plan then future-base source-specific feasibility, only afterward short-lived Provider/resource/Adoption/Permit/official Host evidence. No more five-source diagnostics while fatal cold contract gates exist. No source-code change without proven DA9 real execute blocker. Real official stages 0/6.

Code-level source adjudication: Frozen DA9 V13 Producer capture uses KBS_SOIL Variate25 VWC (latest <=30min at actual retrieval) plus GFS_BUNDLE same-cycle 72h. Its capture families do NOT include KBS_RAW_HOURLY. Separately, DA9 PREPERMIT_BUDGET_CONTRACT_V2 raw response manifest calls its second source KBS_SOIL but actually demands /datatables/13.csv hourly weather CSV. EA5E2 23Z target projected from ~05:30Z next-day daily batch is planning-only and is not authenticated DA9 pre-T1 Provider deadline. Do not conflate these data semantics or invent deadline.

Prepared standalone no-network, no-signer cold review utility: MCFT-CAP09-5526-DA9-COLD-REVIEW-AND-FUTURE-FEASIBILITY-V2.zip. It validates six-stage 180min reference caps +15min margin, target FirstBase 2026-10-22T23:00Z (Beijing Oct23 07:00) with F011/12/13 from 2026-10-22 12Z GFS cycle, strict theoretical budget-start before 19:45Z, and blocks official Admission because current 5526 cap review not approved, Adoption expired, provider independent deadline unproven, Permit unsigned. Optional operator approval requires local real Windows operator, explicit typed approval, human-written >=250-char risk basis, original historical GFS/KBS SHA verification, and actual installed stage plan validator. It creates official-schema but UNSIGNED operator-review-source and never claims permit issuance, full scientific or live eligibility. Only officially signed Observations/Permit may bind that human-reviewed source. No Windows operator review result has yet been received; no actual cold gate has been passed.

Next: original operator reviews or rejects 60/30/30/30/20/10min caps; source contract owner must identify independent authenticated provider causal deadline and its relation to variate25 VWC and CSV. Neither is resolved by new HTTP pulls. If evidence lacking, hold; do not reissue expired Adoption or fetch 300s resource witness prematurely. Original MinIO/PG/Closure static evidence remains fully preserved.

---

## 2026-10-22 17:56 +08 — DA9 5/5 Windows provider diagnostic PASS; contract NO-GO

接续下方 2026-10-22 +08 5526 主线 handoff。操作员已运行原 ONE-SHOT 工具，本条为真实 Windows console 原始结论，不是推测；不删除和改写以前记录。当前六阶段执行进度仍为 0/6。

### 新鲜的 Windows 一次性实机证据（五源）

- 执行：MCFT-CAP09-5526-DA9-NEXT-WINDOW-ONE-SHOT-V1 / MCFT_DA9_5526_NEXT_WINDOW_ONE_SHOT_V1 / 00-run-one-shot-readonly.ps1，目标 FirstBase=2026-10-22T04:00:00.000Z（北京时间 10/22 12:00）；T2=05Z / T3=06Z。
- 执行回执：D:\gptdown\MCFT-CAP09-DA9-NEXT-WINDOW-AUDIT-20261022T095621157Z.json，SHA-256=2e5c6bb5f85bffce2a0425141f63df7b9e6f50943832f927e84f98402a5c9438；文件名 UTC 09:56:21 = 北京 17:56:21。当前只有 operator console 摘要，ChatGPT 尚未读取完整 JSON。不要杜撰原始 KBS latest 或 GRIB 206 明细。
- 五个真实只读 CHECK 均输出 PASS_DIAGNOSTIC_ONLY：kbs_weather_csv、kbs_soil_variate25_json、GFS_TARGET_1/F016、GFS_TARGET_2/F017、GFS_TARGET_3/F018。早前 KBS 小时天气 14.9h、6h 限制失败在此次诊断不再报 FAIL，但仍不可把诊断级 PASS 冒充正式 Provider 因果 Admission、Producer/72h 科学解码。两种 KBS 原始物理源（weather datatables/13.csv 与 soil variates/25 JSON）必须分别保留。
- 只读结果 AUDIT_RESULT=NO_GO_NO_PERMIT、PHYSICAL_AND_CONTRACT_CAUSES=2：两个主要阻塞均为合同约束。
  1) CONTRACT_REVIEWED_STAGE_CAPS=5526_REVIEWED_SIX_STAGE_PLAN_NOT_PROVIDED，缺失属于 5526+选定 FirstBase 的真实 operator reviewed six-stage upper caps 与 reviewer 授权来源。
  2) CONTRACT_SAFETY_BUDGET=FIRST_BASE_NOT_FUTURE：目标 12:00 北京，audit 17:56 北京，已经过去约 5h56m。
- ADDITIONAL_FAILURE 原样记录：5526_ADOPTION_EXPIRED（到期 2026-10-22T06:09:32.419Z=北京 14:09:32）；KNOWN_195MIN_BUDGET_OVERLAPS_FIRSTBASE_OR_ADOPTION；REVIEWED_5526_STAGE_CAPS_NOT_VERIFIED；STAGE_CAP_REVIEW_ISSUER_AUTHORITY_NOT_VERIFIED；INDEPENDENT_PROVIDER_CAUSAL_DEADLINE_UNPROVEN；PERMIT_EXPIRY_AND_SIGNATURE_ABSENT。工具进程退出 0 仅代表报告正常完成，不代表 DA9 执行放行。
- Permit SIGNED=false / CONSUMED=false；无数据库写、MinIO 写、签名器、Host、Producer 或六阶段执行。本轮真正成果仅为五源 PHYSICAL DIAGNOSTIC PASS；CONTRACT NO-GO。无证据说明需改 GEOX 源码。

### 接手从这里继续，不允许回到起点

1. 保留本次完整 JSON/SHA，并读取 JSON 中的非敏感 KBS 时间与科学连续性、GFS 每个 IDX/Range 的真实回执；不可把摘要代替详细证据，更不可上传 KBS 受限原始数值。
2. 当前实际 UTC/北京时间核对后，只能选新的真正未来 FirstBase，重新验证三个新的相邻目标小时与两个 KBS 源；已逾时的 04Z 不能手改/重跑冒充未来窗口。
3. 已签 5526 Adoption 已过期；如有可行新窗口，仅使用既有官方 operator 授权与真实签名路径获得新的有效 TEST_ONLY Adoption，原始文件保留不覆盖。现成 Retry Review 要核对其时效与精确 subject，不得臆断可继承。
4. 由授权者真实审查并签署 5526 新窗口六阶段工程上限（180min 六阶段上限 + 15min margin=195min 仅为既有候选预算，不得未经审核直接转化当前 5526 权威）；独立 Provider causal deadline 必须有可验证的事实来源，不能从 HTTP 200 或 FirstBase 推定；Permit 期限/签名在真正签发前不应写成存在。严格满足 now+195min < min(future FirstBase, provider deadline, permit expiry, valid adoption expiry)。
5. 只有全部合同条件真正满足，才在同一窗口获取新的 DB/MinIO/ACL/Provider 短时效回读、官方 preflight、明示一次性 Permit/实际消费，进入真实 6 stage。否则维持 NO-GO + 不改源码；无需重新做 18,857-file release/QCP、历史 Closure 签名继承、旧两库和 MinIO 403 修复。

---
## 2026-10-22 +08 — DA9 next T1=04Z dual-KBS triple-GFS budget（已裁决约束，待 Windows one-shot 实采）

**接续下方真实 Windows 5526 readback 和 Provider NO-GO 记录。本条尚未取得下一候选的 Windows 实机五源 GET 结果；禁止把工具单测、旧时间戳或本 Handoff 本身当成实际 Provider PASS。用户要求主线以真实 stage receipts 0/6 为唯一执行进度指标，任何改码先证实真正的安全执行阻塞。**

- **已拒绝的前一窗口** 2026-10-22T03:00Z = 北京 11:00：此前 KBS hourly CSV latest 2026-10-21T04:00Z、真实 age=14.902603h、冻结 6h 新鲜度 FAIL，且独立 Provider deadline 未证明；GFS 12Z f015 只对应 03Z。
- **下一候选（未获准）** FirstBase 2026-10-22T04:00:00.000Z = 北京 12:00；T1/T2/T3=04Z/05Z/06Z（北京12:00/13:00/14:00）。选择 2026-10-21 12Z 的 GFS f016/f017/f018 三个 SFLUX IDX，各需实际 HTTP 200、匹配 DSWRF forecast hour、Last-Modified 时间合法，并通过真实对应 GRIB Range 206 字节回读。三次 index/Range 只证明目标成员可达，不是 Producer 72h 科学解码。
- **绝不能混淆两个不同 KBS 原始物理源：** 
  A. 原始每小时天气与 ET0 CSV：https://lter.kbs.msu.edu/datatables/13.csv；冻结 latest age<=6h、最新 24h 时刻连续、近 36h 至少 24 个有效降雨小时与 24 个完整 ET0 小时。旧实测 latest=10/21T04Z（14.902603h old）, 24h contiguous=true，当前状态 PHYSICAL_KBS_WEATHER_6H_FRESHNESS_FAILED，必须复取一次新数据看是否真实刷新。
  B. 独立 variate25 土壤湿度 VWC JSON：https://lter.kbs.msu.edu/weather/variates/25；冻结 age<=30min，24h 内至少 24 个 distinct hour buckets，连续窗口 span>=1430min，相邻有效点 max gap<=30min，值 0..1、重复时间不得冲突。尚无用户 Windows 实测结果，状态 UNKNOWN_NOT_TESTED，不能猜测 PASS/FAIL。
  **Budget V2 的 raw manifest 字段 KBS_SOIL 实际强制读取上述 /datatables/13.csv CSV；不可用 variate25 JSON 替换。** 上面两个源必须分别判定。
- **GFS 3 实际目标** NOAA GFS 2026-10-21 12Z f016/f017/f018，valid times 10/22 04Z/05Z/06Z；此前仅有 f015 原始捕获，三项目前均 UNTESTED。任何 HTTP 非200、DSWRF 缺失、Last-Modified 时序不对、GRIB Range 无法取得，分别落盘 PHYSICAL 错误，不准制造“可用”。
- **完整预算合同**：先前旧 130786cb 候选提出过 6 stage upper caps：PRODUCER=3600000ms，TIMING_1/2/3 各 1800000ms，CONTROLLED_DELAY=1200000ms，AGGREGATE=600000ms，总 10800000ms=180min；margin=900000ms=15min，合计 195min。旧候选 stage cap intent **不能转授新 5526**，必须有 5526+当前 FirstBase 绑定的真实 operator reviewed stage plan/review provenance。V2 严格要求 now+195min 早于 FirstBase、独立 Provider deadline、Permit expiry、Adoption expiry 中最早者。04Z 第一时基倒推理论最迟开始 **10/22T00:45Z=北京时间08:45之前**，绝非授权启动时间。5526 Adoption expiry **2026-10-22T06:09:32.419Z=北京14:09:32**。**Provider independent causal deadline UNPROVEN；Permit expiry ABSENT；5526 review currently NOT VERIFIED。任何一个合同事实不成立 => CONTRACT_NO_GO，即使 HTTP 200。** 不允许自行把 Provider deadline 等同 FirstBase。
- 历史预算原文件应保留：GFS acquisition SHA 8a89e19dc06023dcc8342b68541c67c7758d0e1ef836d63d68f285a3b29d192a；KBS historic SHA d813093f0321bd56d7e0a43c1dfa66964c4f4dfe8373d665a3139123d49dd86e。真实性必须与本机文件 SHA 再核对，历史来源不自动证明未来源新鲜。
- **一次性 Windows 只读取证工具（新包不是源代码 PR）**：MCFT-CAP09-5526-DA9-NEXT-WINDOW-ONE-SHOT-V1.zip，解压 D:\gptdown 同名目录，运行 MCFT_DA9_5526_NEXT_WINDOW_ONE_SHOT_V1\00-run-one-shot-readonly.ps1；默认 T1=04Z、GFS cycle=21日12Z。2 KBS HTTPS GET +3 GFS IDX GET+最多3 DSWRF GRIB Range GET，不把 KBS 原始值写入证据报告；生成全新 D:\gptdown\MCFT-CAP09-DA9-NEXT-WINDOW-AUDIT-<UTC>.json，逐项按 PHYSICAL/CONTRACT 错误码保存详细 NO_GO 原因及来源/哈希/UTC 时钟。已通过辅助环境的合成正负单元检查，但 **Windows 实机下一候选检查尚未运行**。它始终 fail-closed 标注 NO_GO：只读取证不能授权 Provider deadline、真实 stage review 与一次性 Permit。
- 下一操作者**只需运行该包一次并拿真实输出**，将全部物理与合同失败码写回同一 Handoff；不再重装 5526、改历史 closure、重签未过期 Adoption、重做 PG/MinIO 静态验收。正式 Permit 前短时效资源回读必须重新取，但这不构成原验证失败。六阶段 0/6，Permit UNISSUED/UNCONSUMED，生产权限 FALSE。

---

## 2026-10-22 +08 — DA9 Windows real-resource PASS / Provider temporal HOLD（接续 Execution-First 纪律）

**承接下方 2026-10-22「DA9 EXECUTION-FIRST DISCIPLINE」——此记录仅更新该纪律下的实机增量事实，避免重复重签、重装、重验历史 Closure。** 接手时以下新记录优先于下方较早的 136b Subject / #3728 尚未合并 / 静态阻塞 8 项等历史快照；历史原文不可删改。2026-10-22 02:54 北京时间左右最新操作者只读测试已完成；当前执行计数仍 **DA9 real stages 0/6**，Permit **NOT_ISSUED / NOT_CONSUMED**。禁止以本段的 READONLY PASS 冒充官方六阶段成功。

### 1. 已正式实证关闭的前置（只读资格 / TEST_ONLY，不计入 0/6）

- 受保护 main 经 GitHub refs/heads/main 实查为 **5526d93f5822c2f333ba997009e9d6605b8959e2**；PR #3728 **MERGED**。这只是已冻结的执行 Subject，后续不得重复改码/提 PR 来推动进度。
- Windows 新安装由原 CA79 18,857 文件完整校验后，只替换受保护 main **exactly five source paths** 的 Git blob，并验证 SHA、QCP 原始 artifact 3728（SHA-256 **d898e606208d3bda01192d91e869ef306f15660af155887fb5011c423e71af6e**）及合并衍生关系。输出 **5526_QCP_AND_MATERIAL_SELF_VERIFY_PASS_UNSIGNED**：18,857 files、QCP 55、Adoption 54、blockers 0。新材料摘要 **84a835c7c3946fda12ddb7bf464e9953ccebde88b2b8fb162892ead390980c61**；QCP 真实执行的 PR-head 为 125f461698c4fcef92b730df33664fecbcaf2fce，merged main 以原始 artifact 与 zero-delta-merge derivation 复核，不得误称 QCP 原始工作流直接执行于 merged main。
- **可直接复用，禁止重复安装/重新执行 00**：
  - Runtime: D:\gptdown\MCFT-CAP09-5526-DA9-QUALIFIED-CANDIDATE-20261021T174308628Z\portable-runtime
  - Material: D:\gptdown\MCFT-CAP09-5526-DA9-QUALIFIED-CANDIDATE-20261021T174308628Z\installed-material.json
  - Session: D:\gptdown\MCFT-CAP09-5526-DA9-QUALIFIED-CANDIDATE-20261021T174308628Z\new-release-session.json
  - 原包/脚本（仅备查）: D:\gptdown\MCFT-CAP09-5526-DA9-EXECUTION-GATE-V1.zip
- 新 Subject 明示授权后，Windows **TEST_ONLY Scope Grant + Formal Adoption + Retry Review** 均已本机签发且验签通过，未签发 Permit：Adoption digest **b2245e017d8f45935741b1d6bb4e10edbcebef72150b53966dde30839f8357ff**，expiry **2026-10-22T06:09:32.419Z / 北京 14:09:32**（临时、使用前核对实际 UTC）；Retry Review SHA-256 **46f11e9424f7c8a744eef80ed2c7cb5c92b49f43b1fa5c2ab634503349eade4f**。失败首次调用数和阶段继续为 **UNKNOWN**，签发仅限原 Run=da9db7129607 的 TEST_ONLY second attempt。现成签名目录：**D:\gptdown\MCFT-CAP09-5526-DA9-ADOPTION-20261021T180614667Z**，两个入口 formal-adoption-signed.json / retry-review-signed.json。**过期才按照官方已有路径重新资格签发，不可编辑 JSON/替换 Subject**。
- 原始历史 MinIO Closure Subject **77cdeeefc8b27901f3cc44b4edc203d8b8f513a3** 签名 SHA/来源经真实旧签名验证；新 5526 **DA9_HISTORICAL_CLOSURE_INHERITANCE=PASS_SIGNATURE_AND_SUBJECT_NOT_CURRENT_FOUR_ZERO**。历史 evidence / signed original / WORM / exact-two-delete 记录未变；不要再做删除/闭环/覆盖。此项在实机已经解决，**不得再报 CLOSURE_WRONG_SUBJECT 或重做 #3728 修复**。

### 2. Windows 真实 PostgreSQL / MinIO / 低权限身份 / fresh Closure：全部 PASS at observed time

- 实机 PostgreSQL **127.0.0.1:55445**，真实正负库 mcft_cap09_requal_da9db7129607_positive / _negative，双库 **29 public tables / zero rows**；Positive、Negative 各自 Evidence 低权限登录 **PASS_READONLY**。MinIO **http://127.0.0.1:59005**，bucket mcft-cap09-requal-da9db7129607，Inventory 真实三个 S3 SigV4 GET HTTP **200**，全分页读取 **current=0, versions=0, delete_markers=0, multipart=0**；原始四零 inventory SHA-256 **206d73418b91684519b6b6d4b91114d3245647b13cbc40ab168e19433d46989c**。
- 官方 5526 联合只读实机输出（最重要可复核回执）：**D:\gptdown\MCFT-CAP09-5526-DA9-REAL-RESOURCE-READONLY-20261021T183831497Z\da9-real-resource-gate-readonly.json**。字段：status=**RESOURCE_READBACK_PASS_NOT_PROVIDER_OR_PERMIT**；pg=PASS_REAL_TWO_DATABASES_29_TABLES_ZERO；positive_login=PASS；negative_login=PASS；minio=PASS_REAL_FOUR_ZERO；closure=PASS_CURRENT_REAL_FOUR_ZERO_AND_IMMUTABLE_HISTORIC_SIGNATURE；short_lived_window=**WITHIN_240_SECONDS_AT_WRITE_ONLY**；real_stage_receipts=0/6；permit_signed=false；permit_consumed=false；production_authorized=false。**新鲜回读只对 2026-10-21T18:38Z 附近观察时刻有效，正式 Permit 前须重新采集 <=300 s，不是永久 Admission。**
- **切勿重复 MinIO 403/ACL 工单**：初次三个 GET 403 的实际 S3 错误为 SignatureDoesNotMatch，系当时使用错误/旧凭据；用**现有 inventory DPAPI 凭据**恢复后 3×HTTP 200 + full four-zero，未修代码、未改 IAM、未删除桶。正确凭据文件：**D:\gptdown\MCFT-CAP09-DA9-IAM-INVENTORY-bc0d9077fb0b4e4aab3f05070fb746e1\da9-inventory-credential.dpapi.xml**，身份 cap09-da9db7129607-inventory。数据库正负 Evidence 本机 DPAPI 在当前 Windows 用户的 **%LOCALAPPDATA%\GEOX\MCFT-CAP09\da9db7129607\credentials**，文件名 cap09_da9db7129607_p_evidence.dpapi / cap09_da9db7129607_n_evidence.dpapi。**不要上传密钥或管理员口令；不把 MinIO root 当 run-scoped inventory 账户。**
- 复验辅助脚本（本机曾成功）D:\gptdown\MCFT-CAP09-5526-DA9-RESUME-EXISTING-CREDENTIALS-READONLY-V1.ps1，从 DPAPI 临时加载凭据，调用已安装 DA9 readback 脚本，最后还原 Process env。只有在**真正新的 Permit 预检短时效窗口**才重复这一动态 readback，不要反复跑 18,857-file 资格。

### 3. 真实 Provider HTTPS 已捕获，**当前科学/因果仍 HOLD**

- 2026-10-21T18:44Z 左右 Windows 两个外部 HTTPS GET **HTTP 200**，NOAA GFS SFLUX .grib2.idx **7,049 bytes**；KBS LTER 原始小时气象 CSV **19,662,926 bytes**。原始字节与 SHA 保留于 **D:\gptdown\MCFT-CAP09-5526-DA9-PROVIDER-RAW-READONLY-20261021T184400560Z**，入口 **raw-provider-diagnostic.json**。这是 **RAW_BYTES_CAPTURED_SHAPE_CHECKED_NOT_CAUSAL_ADMISSION**，而非 GFS/KBS 正式因果资格或 6-stage receipt。
- 本机离线解析实测：GFS selected cycle **2026-10-21T12:00:00Z**，F015 forecast valid **2026-10-22T03:00:00Z**，初选 **FirstBase 2026-10-21T23:00:00Z** 与所捕捉 F015 不匹配；GFS Last-Modified 早于 capture 为 TRUE，并不独立证明合法 deadline。时序证据 **D:\gptdown\MCFT-CAP09-5526-DA9-PROVIDER-TEMPORAL-DIAG-20261021T184955284Z.json**。
- 同一离线检查：KBS latest observed **2026-10-21T04:00:00.000Z**，在 18:44Z 捕获时数据龄 **14.736 h**；最近 36h 降雨有效 distinct=36h、ET0 完整输入 distinct=37h，覆盖不是阻塞，**新鲜度是真阻塞**。
- 随后真实 Windows 官方 KBS metadata-only probe（从已安装 5526 runtime 调用 OBSERVE_MCFT_CAP_09_KBS_CURRENT_FRESHNESS_METADATA.py）输出 **latest_raw_hourly_timestamp=2026-10-21T04:00:00.000Z，latest_age_hours=14.902603，within_frozen_6h_authority=False，latest_24h_contiguous=True**。官方冻结 6h 门槛未过，不得扩大到 24h 工程允许年龄或修改代码/伪造 Provider freshness；KBS 尚未刷新，第二次实际检查排除了短时瞬态读取误判。
- 已安装只读 metadata checker：D:\gptdown\MCFT-CAP09-5526-DA9-QUALIFIED-CANDIDATE-20261021T174308628Z\portable-runtime\scripts\runtime_acceptance\OBSERVE_MCFT_CAP_09_KBS_CURRENT_FRESHNESS_METADATA.py。使用 installed-material.json 所记录的 tools.python.path 运行，无须新装运行时。**不要高频反复下载 KBS 19.7MB**；仅当 KBS 发布状态有更新迹象时复核。
- 预算 V2 source: scripts/governance_acceptance/MCFT_CAP09_PREPERMIT_BUDGET_CONTRACT_V2.cjs。正式合同要求四类不伪造真实文件：历史 GFS 220-call acquisition（SHA **8a89e19dc06023dcc8342b68541c67c7758d0e1ef836d63d68f285a3b29d192a**）、历史 KBS continuity（SHA **d813093f0321bd56d7e0a43c1dfa66964c4f4dfe8373d665a3139123d49dd86e**）、**当前独立 GFS+KBS 实际来源与原始字节 manifest/causal witness**、具明确依据的 **operator-reviewed six stage caps**。六阶段 timeout 总上限 **180min + 15min margin=195min**；须严格满足 now + sum caps + margin **早于** FirstBase / independent Provider deadline / Permit expiry / Adoption expiry 中**最早**者。历史 GFS 220 calls / 821,997 ms 不是实际六阶段测量，也不能推得当下 Provider 截止。**目前 Provider causal_deadline=UNPROVEN_NO_PERMIT**。
- 原诊断的理论 FirstBase 23:00Z 只是候选，03:00Z 次候选与本次 GFS f015 预测有效时刻相符但仍需独立证实三时基数据、合法当前 Provider 时窗/KBS 连续新鲜度及真实截止。两者都**未批准**。不能只因 Adoption 的 195min 时间算术容量为 True 就签发 Permit。

### 4. 接手者最短动作，禁止重走已完成事项

1. **以本段真实 evidence 为基线，只维护执行主线**。前置 5526 本机 material / QCP / valid Adoption + Retry / historical Closure inheritance / PG 29-table zero / positive-negative login / MinIO four-zero 已逐项确认；**不得重复重新安装、重新签 Scope Grant、重开 403/Closure/代码修复**。只有短时效自然过期需要在最终窗口重新**只读复采**，不是失败。
2. 当前**首个实际未解决阻塞**：KBS 官方最新一小时仍停于 **2026-10-21T04Z**，14.902603h 老、6h threshold False；另外 **GFS FirstBase/forecast causal binding 和 independent Provider deadline 未证明**。先等待/取得可核验的 KBS 新发布事实与科学连续性，再确认合法的 future FirstBase + GFS raw-index cycle/time match；不能为了跑而改冻结科学资格。若原始真实源仍滞后，维持 **PROVIDER_HOLD**，不是代码待修。
3. 若 Provider 真实证据条件满足，**检查当前 Adoption UTC 时效**，生成与当前 Run/Subject/FirstBase 精确绑定的 raw bytes manifest、causal witness、operator engineering stage-cap review，按 V2 的 195min + real provider deadline 验证未来窗口；**同窗口**重取 fresh DB/MinIO/ACL/Provider、官方 Host Preflight，明示签一次性 Permit，再消费并逐步执行官方六阶段；每阶段依实际 sealed receipts 报告 1/6…6/6。任一证据不足 ⇒ **HOLD，不进执行**。若 Adoption 过期，才用**现有真实授权签发**新有效资格，保存所有旧文件；禁止伪造/手改时间。
4. 始终 **TEST_ONLY**：不做生产 Owner / Formal-v5 / A0 / O00–O23、没有自动重试、没有历史数据清理或权限扩张。执行前台纪律：**任何新代码修改先提交实际阻断安全执行的原始错误与不可替代论证**，否则 OUT_OF_DA9_MAINLINE。
   
**状态机简述**：exact-main 5526 / material 18857 PASS → Adoption/Retry SIGNED VERIFIED → immutable historical Closure PASS → REAL DB/ACL/MinIO fresh PASS AT TIME → **KBS FRESHNESS HOLD + GFS/Provider CAUSAL DEADLINE UNPROVEN** → Permit NOT_ISSUED / NOT_CONSUMED → actual six-stage **0/6**。所有历史阶段原封不动保留。

---

## 2026-10-22 +08 — DA9 EXECUTION-FIRST DISCIPLINE（最高优先级的主线进度与改码准入纪律）

**用户正式裁决 / 当前及后续接手者必须遵守（取代“合并了几个 PR / CI 过了多少项就是进度”的汇报方式）：**

> 停止以代码合并作为进度，转为以真实执行结果作为进度。
>
> 任何新的代码修改，都必须先证明它阻断了 DA9 的真实安全执行；否则不进入当前主线。

### A. 唯一主线目标与进度计量（Execution-First, evidence-only）

**唯一当前前线：** 在 Windows 实机使用原 DA9 Run `da9db7129607`，完成已经独立签署的第二次、隔离的 `TEST_ONLY` 官方受控六阶段执行（PRODUCER → TIMING_1 → TIMING_2 → TIMING_3 → CONTROLLED_DELAY → AGGREGATE），取得真实的 stage receipts / outputs、链式时序与结算结果；保留首次失败 Provider calls / phase 为 `UNKNOWN`。任何生产执行、Owner/Formal-v5/A0/O00–O23 副作用仍禁止。

**唯一可计入“DA9 真实执行进度”的证据：**
1. Windows **真实** Post-Merge Host / installed material / Adoption / Retry Review 的签名验真、Subject 和时效检查，属于“准入资格已取得”，**不等于**实际阶段执行。
2. 同一实际隔离资源的新鲜 PostgreSQL 两库零行与权限回读、MinIO 四零（current/versions/delete markers/multipart）回读、当前实际 GFS/KBS Provider 原始响应与因果时窗证据、未来 FirstBase/独立截止时间；属于“动态准入事实”，不能由旧/合成 PASS 代替。
3. 官方 Preflight 的真实 Host 结论，以及签发、**消费**的一次性 Permit；签发与消费分开计量，任何失败都如实记录。
4. 官方六阶段**每一阶段**的实际启动、成功输出、串接签名/摘要回执及 Aggregate/post-execution 裁决。以 `0/6` 到 `6/6` 的**真实验证回执**报告已完成阶段，缺失即未完成；任何模拟、synthetic、CI 通过不记作运行成果。
5. 不以工作时长、PR 合并数、代码行数、QCP/CI 成功数替代上述实机结果。合并、验收、工具与签名只是手段或准入前置条件。

**对外固定报告格式：** 当前真实执行阶段（未启动/Permit 已消费/阶段 N/6/完成）；已验证且附可追溯来源的实际回执；当前第一个阻断真实安全执行的 FAIL/CODE；最短的解除动作；未证实之处标记 HOLD/UNKNOWN。只有在执行回执发生实质变化时才上调“DA9 执行进度”。不要把新的 PR、CI 全绿或一份签名文件表述为“DA9 已推进到运行完成”。

### B. 任何新代码修改必须先取得准入证明（No-Change-Without-Proven-Blocker）

**先证明、再改码。** 每一项拟议的源代码/测试/工作流修改，在进入当前 DA9 主线之前，都必须同时明确：
- **真实阻塞证据：** 哪个现行受保护 Subject + Windows 安装材料 + DA9 实际安全执行前置（或官方 Preflight/Host）被阻断；附原始结果、错误码、相关运行参数/签名绑定与可复核复现路径。若仅是推测、旧环境配置缺失、CI 未触发、文档不完备、工具体验、性能优化、未来兼容或一般技术债，**不准启动修改**。
- **必要性与替代方案：** 先检查是否可由正确的数据库/MinIO 凭证与 ACL、运行环境、已有合格证据、时窗、现成工具或合法的新鲜回读直接解除；解释为何不修改已冻结源代码就**不可能安全继续**。
- **影响与安全边界：** 最小改动、对现有已签署 Subject/installed digest/Adoption/Retry Review 的失效成本、一次性 Permit/历史 Ledger 保留、旧版兼容与禁止的生产副作用；必须有针对实际错误的正/负回归与官方 gate，而不是先提 PR 再找用例。
- **门禁裁决：** 不满足上述证据和必要性证明 ⇒ `OUT_OF_DA9_MAINLINE / NO_CODE_CHANGE`。若确属硬阻塞，才做最小化修复并经原有 CI/QCP 等验收；验收通过仍仅代表阻塞修复候选，不是 DA9 运行进度。
- **执行复测闭环：** 修复必须最终回到 Windows 实际 Host / Preflight 并证明原阻塞消失、无新阻塞；不准以 PR merged 结束工作。任何新 Subject 重新签署的成本与风险，必须在改码前考虑。严禁借“持续改代码”代替跑一次真实隔离链。

**特别禁止：** 为了让新 Subject 接受旧证据而篡改 Closure、Disposition、WORM、删除日志、Provider 原始字节、首次失败 `UNKNOWN`；重新执行历史两对象删除、重置 one-shot Ledger、伪造 fresh four-zero 或 Provider 时窗、缩短必要安全窗口、跳过签名/ACL/主体校验。历史事实要不可变，真正的安全阻塞要保留 fail-closed。

### C. 此次交接时已经具备的资格（不计入六阶段执行进度）

- 当前已核对受保护 main `136b9401b8d49dfecdf8609055a8402c62e23e3d`。Windows 已实采 18,857 文件 installed-material SHA-256 `d7f864c0a9b8c46b51b64642949f54cc84fb39d198f681c55d8e35d6dcdda377`；完整 QCP `55` checks、`0` blockers，Adoption 检查 `54` 项通过。
- 该 Subject 的 Windows `TEST_ONLY` Formal Adoption **SIGNED/VERIFIED**，有效期截至 `2026-10-22T04:35:00.376Z`（属于时间敏感证据，**使用前重新检查 UTC 是否过期**）；新 Retry Review **SIGNED/VERIFIED**，SHA-256 `2efefc91a4fa874884e686b1d53422453eac317e2fa6cd8d44617396de10c23f`，24h 签署时效同样必须复核。
- Windows 静态检查 `STATIC_ADMISSION=HOLD_RESOLVE_STATIC_BEFORE_300S_WITNESS`，8 项：正向 `DATABASE_URL` 指向错误、`BLOCKED_DATABASE_URL` 缺失、正式 MinIO endpoint/bucket/region/access/secret 五项缺失、Closure 尚未被接纳。`MCFT_CAP09_ADOPTION_REQUEST` 尚未设置（profile allowed=true），运行前也必需。正确的两库是 `mcft_cap09_requal_da9db7129607_positive/negative`，127.0.0.1:55445；MinIO `http://127.0.0.1:59005`，桶 `mcft-cap09-requal-da9db7129607`。当前没有新的资源/Provider 实时回读结论。
- 原始签署 Closure 位于旧 Subject `77cdeeefc8b27901f3cc44b4edc203d8b8f513a3`，签署于 `2026-10-18T14:12:35.567Z`，Windows 已验证原始文件 SHA-256 与 ref 匹配；官方当前校验的 `CLOSURE_WRONG_SUBJECT` 是确定性阻塞（不是历史删除失败）。需不改写历史证据、并保留新主体签名约束来解决。
- **在途候选** PR [#3728](https://github.com/liyongshang44-max/GEOX/pull/3728) 尝试在真实验证过的 successor Formal Adoption 下，继承原始 77c Closure；CI 与 Windows/Ubuntu synthetic 已 PASS，完整 QCP 在本交接核查时仍在运行，PR **Open/Unmerged**。这项变更有实测 Subject mismatch 依据，但**绝非已解除实机阻塞**；不得将 PR 作为进度事件。若合并产生新的 Subject，必须重新资格绑定与签名，且仍需实机 Preflight 复核。
- `DA9_SINGLE_USE_PERMIT=NOT_ISSUED / NOT_CONSUMED`；没有本次正式第二尝试的真实六阶段 stage receipts，**已确认实际完成阶段 `0/6`**。此前任何 CI、签名、合成测试或静态检查都不能代替这六份真实回执。

### D. 下一位执行者只按以下最短主线工作

先冻结/核对受保护 main 与官方已验证安装材料；**先不增加新代码**。在无 Provider 调用、无 Permit 消耗的只读检查中，逐一核实当前最早的真阻塞：历史 Closure Subject 的合规继承路径，以及正负两库运行身份、MinIO ACL 与环境缺失。对 PR #3728 只在其证明是解除 DA9 实际执行硬阻塞、且安全回归通过时继续；不要顺势拓展科学 Runtime/平台治理范围。静态阻塞消除后，再一次性安排真正的未来 FirstBase + 独立 Provider deadline 与完整 `180 min` 六阶段 caps + `15 min` margin，执行**短时效**真实 DB/MinIO/Provider 回读、官方 Preflight、经单操作员明示授权签发/消费一次性 Permit，最终六阶段运行并保留完整证据。时效不够即 HOLD，不用更改代码制造虚假的 PASS。

**交接记录与“记忆”的职责划分：** 本条是可核验、可跨会话读取的 GitHub Handoff 工程纪律。接手者必须优先按本条执行，不得被文件内较早“合并即里程碑”的历史描述覆盖。账户 Memory 的异步汇总是否已更新不能通过 GitHub 提交来推定。

---

## 2026-10-19 23:07 +08 — PR #3724 merge-head CI closure PASS (supplement to merged V2 handoff below)

**Verified independently after the earlier merge note:** protected main `130786cb95439e60255e45dfec3e150f901aea9a`; PR #3724 `MERGED` at `2026-10-19T13:44:14Z` (21:44:14 +08) from candidate `92275c23797ac79914c02ed84c3f1c5eded0548f`. Three **push-event** GitHub Actions workflows at the **exact merged main SHA** all completed **SUCCESS**, zero failures/pending: **CI** run `39262700061` (finished 13:54:44Z), **EA5E2 successor-runner qualification** `39262700144`, **Formal-v5 Post-Graduation Readiness** `39262699881`. This closes the pending main-CI acceptance noted in the prior merge checkpoint; do not repeat this check merely because that historical note recorded `running`.

**Execution boundary unchanged:** these are code merge/CI checks, not DA9 dynamic Admission. Original 77cdeeef-signed Release / expired Adoption are NOT transferable to new main `130786cb`; new exact-main material verification/valid Adoption/Permit and real Provider causal and staged safety-budget evidence still required, via **existing** signer and **same** DA9 Run `da9db7129607`. DA9 one-time Permit remains **unissued/unconsumed**; no DB/MinIO/Provider mutation performed by this status check. `DA9_EXECUTE_HOLD`, no independent new Run/signer/approval tier.

---

## 2026-10-19 +08 — Budget Contract V2 merged, main 130786cb, DA9 still EXECUTE_HOLD (LATEST)

**Engineering disposition (factual, post-merge):** PR [#3724](https://github.com/liyongshang44-max/GEOX/pull/3724) **MERGED**, merge SHA `130786cb95439e60255e45dfec3e150f901aea9a`. Exact protected `main` readback **matches 130786cb**; first parent `77cdeeefc8b27901f3cc44b4edc203d8b8f513a3`, second parent vetted PR head `92275c23797ac79914c02ed84c3f1c5eded0548f`. Normal GitHub protected merge: initial attempt returned HTTP 405 **2 of 8 required checks in progress**; when required checks completed, normal merge succeeded with expected head guard, no override. Before merge: **31 successful GitHub Actions workflows, one conditional SKIPPED, zero failed, 53 check-runs complete, PR clean**. Signed old Release and its adoption deliberately NOT overwritten. This is **code integration, not formal Execution Admission**.

### Precisely what was merged
- Fix two CTO-confirmed design defects: DA9 V2 no longer permits unsourced `measured_worst_case_ms` to bootstrap its own single-use Permit or compares six planned stage timeout ceilings with unproven actual measurement. New `MCFT_CAP09_PREPERMIT_BUDGET_CONTRACT_V2.cjs` tests **reviewed engineering safety upper caps** + positive deadline margin against signed/observed Provider causal deadline, future T1, Permit and Adoption expiry; checks exact existing Run/Subject, original GFS/KBS evidence file SHA-256 and current bounded raw Provider witness source files. A successful structural check **does not claim empirically qualified six stages, nor does it issue a Permit**.
- Real Product Provider facts: KBS is `https://lter.kbs.msu.edu/datatables/13.csv` **CSV**, not a JSON array; NOAA SFLUX IDX expected HTTPS host/path/DSWRF, raw source byte digests, response timing and GFS Last-Modified before logical cutoff are checked. Nevertheless, a user-authored JSON source manifest with matching file hashes **alone cannot cryptographically attest real HTTPS origin**; product scientific KBS full continuity, approved operator cap rationale and real Provider causal visibility for a **new future base** still must be captured and verified in live Host for any formal admission. Do not fabricate `PASS` claims.
- Post-execution `MCFT_CAP09_POSTEXECUTION_TIMING_ADJUDICATION_V2.cjs` is read-only; official Host emits its `POSTEXECUTION_TIMING_REVIEW_V2.json` in the existing DA9 ledger **only after** actual six stages have been launched with genuinely consumed Permit and the scheduler has sealed six linked stage receipts; no added Run, new signer, new review tier or stage. Postexec report explicitly still `timing_budget_qualified=false`, `full_six_case_pipeline_delay_qualified=false`, `production_authorized=false`. Controlled scratch delays do not prove six full slow-pipeline cases.
- Corrected QCP `unknown_changed_paths` failure by registering six new exact V2 budget/receipt code, doc and workflow paths under **existing** `LOCAL_CUTOVER_EXACT_SCOPE_20261011_V1` and `A44_ADOPTION_QUALIFICATION_LOCAL_EXECUTION_ADMISSION_V1` dependency resolvers. No resolver bypass; all inherited pre-merge QCP, EA5E2, main CI and Windows/Ubuntu synthetic tests subsequently passed.

### Post-merge check snapshot
- `main=130786cb95439e60255e45dfec3e150f901aea9a` confirmed from Git ref and merge commit parents.
- Merge-head **EA5E2 successor-runner qualification PASS**, workflow `39262700144`.
- Merge-head **Formal-v5 Post-Graduation Readiness PASS**, workflow `39262699881` (readiness check does **not** activate Formal-v5).
- Merge-head **CI workflow `39262700061`**: build-test PASS; acceptance **running when this note was prepared**. Check the latest result independently; do not promote pending to PASS by assumption.
- The 8,286-file old installed Release `D:\gptdown\MCFT-CAP09-77CDEEEF-FINAL-1f31766754dd4719bf7eeb6020ed70e7\release` still belongs ONLY to old `77cdeeef…`. Its signed material digest `fd75bd6664b1bdc825e8475d2d0e9fe8d704447553704c412a911bd519b6c8f7` and Scope Grant/Retry/old Adoption **cannot authorize changed 130786cb code**. Original Adoption expired at `2026-10-19T01:10:08.100Z`.

### Exact next mainline; no premature Host
1. Close merge-head CI acceptance and exact-main QCP/EA5E2 preflight with real immutable run identifiers. Verify successor material inventory and immutable hashes, re-issue/requalify new Subject's applicable Scope Grant/Review/Adoption **using existing** authorized operator/roles, not an invented additional approver/Run; keep DA9 `da9db7129607` exactly.
2. Fix or obtain the authentic **current Provider source provenance** and three future causal bases; existing 220-call GFS historical acquisition is valid historical source/performance evidence, not automatic admissible Provider for new T1 and not permission to refetch the same old raw bundle. Do not fill fabricated measured budget; planned caps require reviewed actual engineering basis and total safety feasibility.
3. Only after valid signatures, proper Host-bound source provenance, fresh <=300s **from started_at** positive/negative PG/MinIO/ACL/Owner zero-state, two real delay plans and Provider/Adoption/Permit overlap, may official Host Preflight and independent single-use DA9 Permit issuance be considered. **Permit remains UNISSUED/UNCONSUMED; six real stages NOT EXECUTED.** No DB write, MinIO delete, historical reset or A0/Formal-v5/O00-O23 authority from PR merge.
4. Avoid recreating withdrawn Issue #3723 independent Measurement Run, unnecessary independent signer hierarchy, cargo-cult timestamp adjustments or hidden bypass of signed material.

### Operator handoff disposition
`BUDGET_CONTRACT_CODE=MERGED`; `PROTECTED_MAIN=130786cb95439e60255e45dfec3e150f901aea9a`; `DA9_RUN=da9db7129607`; `SIX_STAGE_REAL_MEASUREMENT=NOT_ESTABLISHED`; `DYNAMIC_ADMISSION=HOLD`; `PERMIT_CONSUMPTION=FORBIDDEN`; `PRODUCTION_AUTHORITY=FALSE`.

---

## 2026-10-19 +08 — DA9 77cdeeef full-GFS qualification / Host TSX resolution blocker (LATEST)

**Scope / owner instruction:** Continue sole MCFT CAP-09 DA9 second-attempt `TEST_ONLY` mainline. As operator last verified, protected main **77cdeeefc8b27901f3cc44b4edc203d8b8f513a3**; do not modify signed 8,286-file Release or advance Subject to work around local packaging. This is a factual handoff, **NOT six-stage execution/admission success**. Same second Active Continuation handoff, PR #3298 remains Draft/Open/Unmerged; pure-prepend; do not create a third handoff and do not repeat historical disposition.

### Closed gates and immutable operator evidence (new since 10/17)
- DA9 original real MinIO IAM probe disposition has already been executed **exactly once**, signed Closure verified, fresh independent **four-zero** readback PASS; retain original six historical attempt files and WORM custody. WORM `mcft-cap09-da9-evidence-worm-v1` key `MCFT-CAP09-DA9-PROBE-EVIDENCE-20261016T170707Z.zip`, VersionId `f7dda227-652e-4dc7-ab97-c9d70874731d`, Object Lock COMPLIANCE to 2027-10-16. Historical Closure hash `92932b785ff13089d77e92a2e60ad1184393abbd18c5d6e9d0699e3f07eb34a7`. Dynamic Closure fresh-readback status `DA9_DYNAMIC_CLOSURE_FRESH_READBACK_PASS`; reference `D:\gptdown\MCFT-CAP09-77CDEEEF-DA9-DYNAMIC-CLOSURE-0c3eb029eeb2479aac8025bc0a331113\DA9_MINIO_CLOSURE_REFERENCE.json`. **Do not delete probes again, clear buckets, or reinitialize either database.**
- Real Windows DA9 PostgreSQL READ ONLY audit PASS on both `mcft_cap09_requal_da9db7129607_positive` and `_negative` via local port 55445. Each **29 tables, 2 routines, 0 rows, 58 ACL records**, `NO_DB_WRITE_NO_PERMIT_NO_STAGE=TRUE`. Immutable report `D:\gptdown\MCFT-CAP09-DA9-PG-RESULT-0b054108e832402a847f4af7b15bcc77\PG_READONLY_AUDIT.json`, SHA256 `add202a626d7d82a68c64c6a66721ce087e97950952e502178a3e45caf760f5e`. This is historical read-only evidence **not** a final <=300s resource readback.
- Final-Subject post-merge CI PASS; signed Scope Grant independently verified SHA256 `f5767a8986bc18d5813c5fa08630a590d6adad4c8f3e15f5fdc99443ea94f1e0`. Initial Formal Adoption failed `UNDECLARED_ENVIRONMENT_VARIABLE` due to `MCFT_CAP09_DA9_MINIO_ACCESS_KEY` and `MCFT_CAP09_DA9_MINIO_SECRET_KEY` left in process environment; profile-bound exact environment passed and reused the existing signed Scope (do not re-sign). **TEST_ONLY Formal Adoption signed and verified**, SHA256 `355bd0c0f82ae5973cb6294b7e5ef2fb02ecd27b13a4acf15cb915c6ab1c27d1`, digest `cae60b73f7364c8f346f91073ff3d4822635aff10edbaa1d678523cf66f79d07`, material digest `fd75bd6664b1bdc825e8475d2d0e9fe8d704447553704c412a911bd519b6c8f7`, **expires 2026-10-19T01:10:08.100Z**. Retry V2 Review signed/verified SHA256 `07314b3554695d835e47770cbce56a2ac399959ba2f36540cda2a55dacacb9d0`, decision id `da9_retry_77cdeeef_ea3a15f22b58`, with `review_verification=REVIEW_SIGNATURE_VERIFIED_NOT_POLICY_ADOPTION`; no Permit. Signed directory `D:\gptdown\MCFT-CAP09-77CDEEEF-SIGNED-573444fd32aa4953a74b725ed44fe1a4`. Never treat signed Adoption/Review as consumption/activation of execution Permit.
- Real GFS Windows probes: candidate 2026-10-18T20:00:00Z initial listing 18Z HTTP 403 0/300; 12Z HTTP 200 60/300 at that observation; 06Z HTTP 200 300/300. Strict 06Z metadata 300/300, missing/duplicate/zero_size/not_available_by_base **all zero**, newest availability upper bound 2026-10-18T09:54:59.999Z, exact DSWRF SFLUX index 200. Strict report SHA256 `c3f4089f579ab25248fdeab14a0bc0af1dffdc227f702e617fef00237edf8feb`. Three real 06Z SFLUX GRIB2 Range 206 F015/F016/F017 decoded with frozen GEOX science PASS; report SHA256 `718b013d25e4d215108498703b9679604fa8c712f2475d34c732f4f3aeb34046`.
- **Full product-level 72-hour GFS acquisition and frozen Python scientific decode PASS** on Windows. Actual provider selected **2026-10-18T12:00:00Z** (later than earlier 06Z metadata probe; preserve distinct observation instants). **220 Provider calls, 220 retained original members** (73 PGRB2 +73 SFLUX index +73 exact GRIB messages + one directory), two weather/ET0 drafts. Real acquisition **821,997 ms**; real decode **18,570 ms**. Evidence folder `D:\gptdown\MCFT-CAP09-DA9-FULL-GFS-e17ed8fb3a6c4075b2851aaff5f1ed88`. Raw tar SHA256 `d2f9750b4a994e90cc4b68a5df699331ad5c8d34bdbf51e190a2b2d10e6b08c4`; metadata `8a89e19dc06023dcc8342b68541c67c7758d0e1ef836d63d68f285a3b29d192a`; decoded drafts `00a5a4219c930143a658036937afd3cd0df98e6ad27fff9e39570b3b7e8edd0a`. This is **real external-provider acquisition evidence**, but NOT three-base Producer/DB/MinIO performance, not measured full six-stage budget, not 24T, and not proof of Provider causal availability at the target cutoffs.

### Active blocker / next action
- Frozen Release `D:\gptdown\MCFT-CAP09-77CDEEEF-FINAL-1f31766754dd4719bf7eeb6020ed70e7\release` has checked exact source hashes; external `tsx@4.21.0` CLI on Node v24.19.0 worked at `D:\gptdown\GEOX-cap09-diagnostic-main-20261010\node_modules\tsx`. However **`OFFICIAL_HOST_TSX_RESOLUTION=ABSENT`** when `require.resolve('tsx')` runs from frozen Release. Host `scripts/runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs` requires this under **`--execute` before Permit consumption**, but not under `--preflight-only`; thus a later Preflight PASS alone is insufficient. Release source and signed installed-material inventory must remain byte-identical; no `NODE_PATH`/`NODE_OPTIONS` loader injection, no junction into Release, no alternate Host executable.
- Investigate **external, bounded and verifiably pinned runtime dependencies** (Node resolver can search ancestor `node_modules` outside the signed `release` tree); independently verify `tsx@4.21.0`, `pg` and imported workspace dependencies, check no signature/material drift. Confirm actual official Host executable resolves required deps without injecting vars, and the deployment's trust model accepts dependency provenance. Do not claim executed stages from a successful read-only dependency check. If ancestor installation cannot satisfy signed provenance, HOLD rather than bypass.
- Timing/Admission order: actual Provider causal visibility + observed deadline and measured worst-case full six-stage stage timeout budget (sum of six timeouts, plus safety margin) **before** <=300,000 ms final dynamic database/MinIO/ACL/Owner readback. Freshness clock starts at **`fresh_readback.started_at`**, not completed_at. Both exact signed `real_provider_response_delay_plan` and `real_pipeline_delay_plan` must bind DA9 Run/Subject/three distinct future bases and Producer timeout; do not call scratch delays or 821,997-ms GFS probe an actual 6-stage measurement. Require combined Provider/Permit/Adoption window, valid independently reviewed Retry, signed one-shot Permit and official Host Preflight before one irreversible `--execute`. Adoption above is short-lived; if expired, renew only with official authentic tool, preserving failed/prior signatures, and do not extend by JSON edits.
- Mainline remains **TEST_ONLY**: `NO_DB_WRITE_NO_MINIO_DELETE_NO_PERMIT_NO_STAGE` for all recent Provider/PG tools. Zero production authority, no Formal-v5/A0/O00–O23, no owner cutover. DO NOT delete or reset any historic DA9 evidence. Next checkpoint should record real Host dependency qualification results and strictly separated six-stage budget/Provider deadline, not another broad feature refactor.

---

## 2026-10-17 22:43 +08 — DA9 final-subject Disposition Closure Windows execution handoff (LATEST)

**Disposition / owner directive (2026-10-17):** Sole engineering mainline is to complete a real DA9 second-attempt isolated TEST_ONLY execution: final protected-main qualification and authentic signatures -> evidence-preserving exact two-probe disposition -> independently verified four-zero Closure -> fresh dynamic Host Admission / one-shot Permit / official Preflight -> six real stages with immutable receipts. STOP introducing new governance/Runtime features. Do not touch production. This is a PRE-EXECUTION handoff, not a claim that MinIO deletion or TEST_ONLY happened. PR #3298 is still the **same second Active Continuation Handoff**, Draft/Open/Unmerged, DO NOT MERGE. Pure prepend only; all previous notes remain historical. This single checkpoint consolidates already posted PR comments and the subsequent 10/17 Windows IAM/tool investigation rather than duplicating the long 10/15–10/16 history.

### Final code subject / actual GitHub closure

- As inspected at handoff: protected main SHA **582ee6220624fb9fc30e767f14e0ec5143647ae4**. #3719 merged at **0db44d5f205cc9482e882f5b7e18c00a50905068**; #3720 merged at **582ee6220624fb9fc30e767f14e0ec5143647ae4**. Owner supplied final CI evidence for #3720: **31 PASS / 1 SKIPPED / 0 FAIL**, merged-main CI PASS, EA5E2 PASS, Formal-v5 Post-Graduation PASS. Do not infer any Windows runtime action from CI. No further Subject advancement desired; recheck main before signing.
- Exact source implementation in final main: scripts/cap09_adoption_v1/da9-minio-disposition-v1.cjs (signer/verifier, historical Capture/WORM/bucket/Key/hash binding, 300,000 ms freshness); da9-minio-exact-delete-v1.cjs (only two pinned objects, per-operation once-only ledger STARTED/DELETE_n/LOG; no silent replay); da9-minio-closure-v1.cjs (historical delete-log validation, post-delete four-zero and signed Closure, freshness); da9-minio-readonly-inventory.cjs (read-only enumeration); da9-retry-bundle-v2.cjs and scripts/runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs integrate Closure into dynamic Admission. #3720 changed seven files. Frozen V13 science/production Runtime semantics are not an authorized edit target.
- Contracts require unversioned source bucket and the *literal string* VersionId **"null"** for each exact source, NOT an invented version UUID and NOT an implicit unversioned delete claim. The fresh pre-delete inventory/approval/executor and post-delete Closure are time-bound (signer MAX_FRESH_MS=300000; Closure has 300000-ms historical windows and <=300000-ms freshness). Pre-emptive signing, manual JSON patching or split-by-chat deletion is unsafe. Preserve any STARTED ledger on partial failure, forbid automatic second attempt or cleanup.
- **Observed operational status:** final 582ee622 subject has no verified Windows installed Release/Material, no authentic final-subject signed Adoption/Retry/Disposition, no actual two-object deletion, no post-delete four-zero receipt, no signed Closure, no dynamic Admission consumption, no issued/consumed Permit, and no six-stage TEST_ONLY receipt shown to this conversation. Every such gate remains **HOLD / NOT EVIDENCED**. Never turn “code merged” into “live closure passed.”

### Retained real evidence and explicit distinction from new-subject authorization

- Historical DA9 source bucket mcft-cap09-requal-da9db7129607 (localhost MinIO **127.0.0.1:59005**, container mcftcap09-da9db7129607-minio-1; separately PostgreSQL 127.0.0.1:55445, container mcftcap09-da9db7129607-postgres-1). Earlier fully read-only inventory showed **current=2, versions=2, delete_markers=0, multipart=0**, BUCKET_NOT_EMPTY_HOLD; *not* an empty bucket and *not* a fresh final pre-delete inventory. Two exact 27-byte IAM probes: positive/qualification/iam-probe-da9db7129607-v1.txt (SHA256 **96b91f40a611b726561cff9e81a7ea60bb8cbc363f75f9e60aad6598ac53a7d8**) and negative/qualification/iam-probe-da9db7129607-v1.txt (SHA256 **9644be2c235939884b2d12dace3c455ea26f6e4ab78fb8f9316da33bf3671a95**); historical VersionId string "null" for both. Windows source recheck receipt SHA256 **0441f9211ef02fc4276fe07b9e3e098646a07b666ae04bb3a10be951c19732d0** at D:\gptdown\MCFT-CAP09-DA9-SOURCE-RECHECK-57abdbb579f34482aaa5b21986b9cdc0\source-readonly-recheck.json. Before any deletion, require new inventory and exact current object contents/version/ETag match; do not extrapolate current count from 10/17 historical output.
- Probe preservation ZIP MCFT-CAP09-DA9-PROBE-EVIDENCE-20261016T170707Z.zip SHA256 **6dbb1ffe417174dfc45450e695d0fd28cd2eacce0b85523a7a6c71d5f44ee62e**; ZIP has four entries: inventory-original.txt, positive-probe.bin, negative-probe.bin, preservation-manifest.json. Remote WORM: bucket **mcft-cap09-da9-evidence-worm-v1**, key **MCFT-CAP09-DA9-PROBE-EVIDENCE-20261016T170707Z.zip** (NO custody/ prefix), VersionId **f7dda227-652e-4dc7-ab97-c9d70874731d**, Object Lock **COMPLIANCE** until **2027-10-16T17:29:54.041Z**, remote readback SHA256 equal ZIP. Independent Windows read-only recheck receipt D:\gptdown\MCFT-CAP09-DA9-WORM-READONLY-RECHECK-47e648ddd8be4ad688aacfe9f73307d1\independent-readonly-recheck.json, SHA256 **6a26a91fe10d0a67bcbdf0509261101dfeae3c7bbef22292f6d3f43b85694d81**. Distinguish this fresh independent recheck from the **missing historical original upload receipt**; no need to re-upload ZIP. WORM evidence does NOT itself authorize deletion.
- Historic real Windows DA9 database read-only audit: positive and negative each **29 public tables / exact zero rows** (all 29 scanned under READ ONLY), two public routines recorded separately, four run-specific logins and exact Evidence/Twin ACL documented in prior 10/16 checkpoint. This is an historical baseline, not fresh dynamic Admission. First failed execution original Provider call count **null = UNKNOWN, never 0**, original failure code **POSTMERGE_V13_PRODUCER_CORE_FORMAL_RAW_BUCKET_REQUIRED**, historical six files **6/6 preserved**, cannot reset or reinterpret.
- The earlier signed operator-only Formal Adoption and Retry V2 review were **real** for OLD subject **49235c4098fe3d7e1a86ebde474eb637cc53663f**, not for 582ee622. Old Windows Release passed source binding 6,441/6,441 and installed-material 8,282-file self-verify; old canonical material digest **6425e2b06f9063985298f855aeccd4bc15ca92ceb588ab01435b6660105306e3**; signed owner Scope Grant and Formal Adoption; renewed Adoption digest **6024df2457e3c4de1cce894a5ce6c7eafe655787f7253d139e3c66e9f6929352**, expiry **2026-10-17T12:32:41.080Z** (**now expired**); signed old-subject Retry V2 decision SHA256 **de5404615c9b10f9611149c76c86bc1ba49e5684cb9cfcd9e87aed8fbf17b154**, decision id cap09_da9_second_attempt_49235c40, original Provider count UNKNOWN, permit not issued. Preserve historical files at D:\gptdown\MCFT-CAP09-ADOPTION-RENEWAL-150af18a74444a17b544d7ca3cb035a7\renewed-signed-adoption.json and D:\gptdown\MCFT-CAP09-DA9-REVIEW-SIGNED-d982f9a593404761b3b2ebb0678a3870\signed-retry-review-v2.json; neither signature transfers to 582ee622 or authorizes live MinIO deletion. Single accountable operator approval does NOT imply independent second reviewer identity.

### Windows infra/IAM/client fact recovery; avoid duplicate provisioning

- Docker read-only inspect: exact DA9 compose working_dir D:\gptdown\MCFT-CAP09-INFRA-da9db7129607, config docker-compose.yml, existing .env with **only MINIO_ROOT_USER and MINIO_ROOT_PASSWORD**. Root credentials are admin setup, **not** a low-privilege audit identity. Verified Docker port 59005 reachable. Separate new run 73b04afb4249 on 59006 is NOT DA9; don't mix resources.
- MinIO admin IAM audit actually succeeded via pinned mc client: enabled accounts **cap09-da9db7129607-positive** / **cap09-da9db7129607-negative** with policies cap09-da9db7129607-positive-v1 / cap09-da9db7129607-negative-v1. Each limited to own positive/* or negative/* prefix (GetBucketLocation, conditioned ListBucket, GetObject **and PutObject**). Neither allows full-bucket ListBucketVersions/Multipart enumeration and neither qualifies as an independent read-only inventory identity; do not upgrade or reuse their write-capable credentials as audit authority. A proposed new least-privilege IAM auditor was **NOT shown successfully created**. No MinIO mutation or fresh inventory receipt after that proposal is evidenced.
- Official former dl.min.io/client/mc/release/windows-amd64/mc.exe URL returned **410 Gone** after open-source distribution archive; stop retrying. User installed pinned original GitHub release mc.windows-amd64.RELEASE.2025-08-13T08-35-41Z.exe as D:\gptdown\MCFT-CAP09-TOOLS\mc.exe; SHA256 **c8db13ebeda31497f354c0e950809db0ae9b2a2a69b8afee68c128c37300c157** verified, CLI version commit 7394ce0dd2a80935aded936b09fa12cbb3cb8096. mc initially wrote config/share into C:\Users\mylr1\mc automatically: avoid permanent/root credential aliases, use explicit --config-dir under temporary protected location; verify and clean up, but do not delete unrelated preexisting user config. Never log/export credentials, never assume an env variable containing root credentials is acceptable for a scoped run.
- Two earlier wrong credential attempts produced PostgreSQL password auth failed for qual_admin and postgres; missing psql PATH on one shell and missing PowerShell [Convert]::ToHexString on Windows PowerShell 5.1 are *operator tooling* errors, not evidence that isolated databases are invalid. Use known host psql path D:\pdsl\bin\psql.exe if independently confirmed, or authentic pg client with explicitly identified role. Do not print secrets.
- Windows stdout can report a stale variable after a throw: previous script printed PROFILE_FILE_SHA256=c20e... after [Convert]::ToHexString failed; authentic Get-FileHash recheck showed old profile-file SHA256 **4ef4da4b3741f3020e7aeb2bac7bed7bc4c0fb4a4a418451b83e9a36824bc833**. Do not label a check PASS after a prior exception. Node -e quoting with inline JS in PowerShell also stripped quotes and caused ReferenceError; use saved .cjs or safe args instead. Do not conflate file-byte SHA256 and canonical object digest.
- CRITICAL Windows Release failure encountered on old 49235c40: git archive/unzip yielded **42 .ps1 files with CRLF byte drift**; actual Git blobs matched frozen manifest. Recovery from exact pinned Git blob restored 42 files, 6,441 matched. Final 582ee622 Release must be checked byte-for-byte; do not trust a checkout, line endings, or dirty worktree merely because the commit name matches.
- This chat's optional diagnostic PowerShell script **MCFT-CAP09-582ee622-DA9-PREFLIGHT.ps1** was regenerated after a broken download link and its file existence checked in the assistant workspace, but **no Windows execution result was supplied**. It is only a bounded local read-only diagnostic, not an official QCP, signed Admission, or license to delete. The user reported the first download failed; do not claim a local PASS or instruct blindly from an unverified file path.

### Next operator sequence / NON-NEGOTIABLE HOLD gates

1. **NO CODE CHANGES unless a proven security defect demands a separately reviewed fix.** Reconfirm protected main exactly 582ee622... and official merged-QCP/CI provenance (owner reports PR #3720 31 PASS/1 SKIP, postmerge main/EA5E2/Formal-v5 PASS). On Windows, produce a clean immutable final-subject Release and official byte-binding/installed material proof; use original Git blobs to avoid CRLF drift. Preserve old subjects and all existing receipt bytes.
2. Validate the **existing** Capture Manifest, two 27B Probe SHA-256 values, latest usable WORM independent receipt and ZIP bytes, and old historical 6-file evidence. Identify trustworthy DA9 full-bucket inventory capability with *only* scoped read/list access or precisely controlled admin audit as governed by the approved execution contract; there is NO permission to invent empty bucket. Record final disposition reviewer authority and exact two-key, two-literal-null-VersionId allowlist. Do not create additional MinIO users, modify policies, or delete evidence just to pass an inventory gate.
3. Obtain final-582ee622 authentic unexpired signed **TEST_ONLY** Adoption and independently valid run-bound Retry approval as required by verifier (old 49235 signatures are historical). Check host/operator/fingerprint/material/run/time; do not edit static adopted=false or substitute bare booleans. No independent second account is mandated by the owner; honor actual ACCOUNTABLE_SINGLE_OPERATOR governance without misrepresenting it as a distinct independently controlled signer.
4. **One continuous Windows execution window, no chat pauses:** refresh current full-bucket inventory + exact two objects and source hashes/versioning, verify WORM COMPLIANCE/version/readback SHA, construct and explicitly review exact signed Disposition; verify signer and fresh <=300s inputs; use governed da9-minio-exact-delete-v1 only (never raw mc rm/recursive rm); preserve STARTED/each DELETE/LOG, reject new or extra objects, any changed version, mismatch or expiration. Failed/partial execution = HOLD with ledger preserved and **NO automatic retry**.
5. Perform independent post-delete four-zero (current=0, versions=0, delete_markers=0, multipart=0); use authentic signed Closure verifier and preserve all raw receipts; Closure alone does not grant execution. Dynamic Host Admission must genuinely consume signed Closure plus still-fresh signed Adoption/Retry, exact scoped PostgreSQL/ACL/MinIO/Provider/real six-stage budget observations; only then issue/consume ONE-SHOT Permit + official Preflight and execute authentic six-stage TEST_ONLY with immutable evidence. Do not mistake TEST_ONLY for production graduation.
6. Persist the *actual* resulting Windows evidence paths and SHA256 into the existing PR #3298 Handoff only AFTER outputs exist. Stop and report precise failed gate; no speculative PASS, no repeated non-idempotent setup, no cleanup of WORM/old receipts. End state today: **DISPOSITION_HOLD; ADMISSION_HOLD; PERMIT_NOT_ISSUED; SIX_STAGE_NOT_EXECUTED; PRODUCTION_HOLD**.

---

## 2026-10-16 — CAP-09 DA9 no-Permit Windows Host signed Adoption audit candidate (LATEST)

PR #3710 code `4c635b54969501bed385fd2394dc108d03a1c751`: adds `audit-host-adoption` CLI to the existing `scripts/cap09_adoption_v1/da9-retry-bundle.cjs` entry. It is Windows-local-only and is designed to take the actual immutable Runtime root and **authentic signed Adoption JSON**. It checks exact Host/verifier bytes, signed and bound installed material, and full candidate/retained verifier proof, with strict subject `91835fa0997730c85c5f3869dd530f4c9a3ca82d`, `scope=TEST_ONLY`, and `production_authorized=false`. Output is a read-only diagnostic: `ADOPTION_DUAL_VERIFIED_READONLY_NOT_EXECUTION_AUTHORITY`. It neither takes the private key nor signs/issues/consumes a Permit, issues a nonce, touches PG/MinIO, or launches any child. The frozen 91835fa0 route only accepts an honestly authorized independent Adoption issuer; it does **not** turn operator custody into an independent signer. The operator-only Formal Adoption successor still needs newly adopted versioned material.

The CI fixture enforces rejection outside the Windows operator context. This local audit cannot show PASS until a genuine signed Adoption and the actual Windows installed Runtime are available; synthetic tests do not establish Host eligibility. Latest exact-head CI should be independently read before release. No new formal approval was recorded, MinIO retained objects have not been moved/deleted, original Provider calls remain `null` (UNKNOWN), and original six historical files remain 6/6 PASS. **Retry Adjudication HOLD / TEST_ONLY HOLD / Production HOLD.**

---

## 2026-10-16 — DA9 frozen-Host dual-verifier compatibility engineering closure (LATEST)

**This is NOT a Retry approval or execution receipt.** Scope: run `da9db7129607`, failed parent `72dc0304a21a`, attempt 2, frozen subject `91835fa0997730c85c5f3869dd530f4c9a3ca82d`; six historical source files retain 6/6 PASS; original Provider calls remain `null`. PR #3710 remains Draft/Open/Unmerged; no signature, permit, nonce or Windows live stage was issued/consumed.

**New technical finding and implementation:** The old 91835fa0 Host source and the current engineering candidate's Host entry are the **same Git blob** `8f0e0734d8048f827555edef3190c16f17160eca`. The old and candidate `offline-trust.json` are also the **same Git blob** `d4ef5470ea689dd65298036359a2af20471af149`. Only the formal adoption verifier differs: retained 91835fa0 blob `b2fb3022546f61db32615087fac95d5c9e0e7938` requires the independently registered Adoption issuer; the candidate blob `476b50b9880994991ff81499aaf69b1ddeea91de` adds scoped single-operator eligibility. PR #3710 now implements a bounded **frozen legacy independent-issuer** candidate in `scripts/cap09_adoption_v1/da9-retry-bundle.cjs`: before permit signing, check installed Host bytes against the vetted Host, require old verifier's pinned historical Git blob, require exact fixed adoption trust registry and an independently registered `INDEPENDENT_GOVERNANCE` issuer, then run full Ed25519 Adoption/material verification with both candidate and **installed frozen** verifiers; assert both return the same signed proof/material digests. This never transfers a private WeakSet context across processes or patches old Runtime. Child Host repeats its own independent verifier checks. This is a real compatibility engineering improvement, but **not proof of independent key custody or a live signed proof**.

**Non-effect:** Owner-operated `ACCOUNTABLE_SINGLE_OPERATOR` formal Adoption remains **rejected by the frozen 91835fa0 verifier**, even though the newer candidate supports a strict scoped role. Single-operator real execution requires reviewed/adopted **new-subject versioned execution material** (and appropriate fresh run-specific binding), not a mislabeled independent identity. The legacy path may be used only with a genuinely authorized independently controlled Adoption signer already accepted by old static trust. Do not change frozen bytes, trust role labels or registered issuer custody assertions to force a pass.

**Verification:** Windows/Ubuntu synthetic acceptance runs include one bounded local `git show` of the exact retained verifier blob (no historical replay), positive registered independent-role precheck and explicit operator-role, missing adoption input, old verifier mutation and trust override rejection. The synthetic unit precheck is **NOT** actual signed Windows Host Admission; both-verifier real material verification still needs authentic Windows input and real signed Adoption. Latest commit to PR #3710: `7b133c57b22cb54b2d775ea0a7ed43604df8a665`. Latest checks to be verified on same exact HEAD before any merge/authority.

**Remaining live blockers:** authenticated prior-denial superseding Retry Adjudication; actual authorized signer control; original DA9 MinIO target bucket has retained probe objects, requiring complete Windows read-only object/version/delete-marker/multipart inventory and approved evidence-preserving disposition; fresh PostgreSQL/ACL/Provider causal evidence, six-stage budget, official Preflight and one-shot permit. `Retry Adjudication=HOLD`, `TEST_ONLY=HOLD`, `Production=HOLD`. No outputs or production resources changed.

---

## 2026-10-16 — DA9 Retry Adjudication signed-input closure; execution remains HOLD (LATEST)

**Current mainline scope:** Run `da9db7129607`, frozen science/runtime subject `91835fa0997730c85c5f3869dd530f4c9a3ca82d`, parent failed run `72dc0304a21a`, attempt 2; historical six files **6/6 PASS (preserved, do not rerun)**; original Provider calls `null` (**UNKNOWN**, never 0). PR #3710 candidate latest code commit `1c567b772dbc4ecb0c5d0c856dac7a22dd07ac9a` (Draft/Open/Unmerged), no approved activation. No production modifications, permit signing, nonce consumption or Windows stages executed.

**Real engineering closure in #3710:** The DA9 bundle generator now **requires a separate Ed25519-signed reviewer decision before constructing any Retry Permit**. Manually setting `review_status=APPROVED`, `retry_admissible=true`, or `prior_denial_explicitly_superseded=true` does NOT suffice. `verifyReviewedDecision` binds registered issuer role/key fingerprint, fixed retry trust registry digest, distinct adjudication-signature domain, run/subject/parent/attempt 2, six pinned historic file digests, original failed-receipt SHA, exact `POSTMERGE_V13_PRODUCER_CORE_FORMAL_RAW_BUCKET_REQUIRED` code, `first_failure_phase=UNKNOWN`, Provider calls `null`, explicit rationale, reviewer authority provenance, scope `TEST_ONLY`, and review timestamp. The explicit Windows-only `review-sign` mode signs an already-human-reviewed input to a new exclusive output file; it never changes approval booleans or issues Adoption/Permit. `signReviewPayload` is shared between CLI and regression tests. Cryptographic proof is **not** automatic policy adoption; actual reviewer authorization and custody remain separately required.

**Source/material blocker remains structural:** Frozen `91835fa0` offline verifier does NOT implement new operator-scoped Formal Adoption, whereas the PR candidate does. Exact deployed Host/private verified-context identity cannot be bypassed, monkey-patched, or replaced. The signer checks the installed Host and offline verifier bytes before creating any permit. To use the new policy, a **new independently qualified/adopted versioned execution material** or a legitimately independent signer accepted by the old verifier is required; do not mislabel owner-controlled keys as independent human custody. No frozen V13 production Runtime change is authorized.

**MinIO evidence gate:** New read-only exact-bucket SigV4 GET collector lists all current objects, versions, delete markers and multipart uploads. Its result stays `BUCKET_NOT_EMPTY_HOLD` on any retained entries and `EMPTY_READBACK_CANDIDATE_ONLY` if empty; even empty does NOT authorize admission. Pure list/pagination/403 tests: 17 PASS; DA9 signing and review synthetic/negative tests in the latest Windows CI entry: **34 PASS**. The linked adoption synthetic job on Windows is PASS, and both Windows release-material jobs are PASS; Ubuntu status must be checked against the final exact head before any merge/adoption. **No live MinIO inventory has been collected by this tool**; preserve the two retained probe objects and all historical versions, never clear evidence to bypass admission.

**Sequence unchanged:** authenticated independent/scope-authorized Retry Adjudication → fresh signed Adoption and measured real six-stage budget → real in-window PostgreSQL/MinIO/ACL/Provider causal readbacks → one-use signed Permit → official Preflight → actual Windows six-stage TEST_ONLY receipts. Pending material/authority/host proof, all remain `RETRY_ADJUDICATION=HOLD`, `TEST_ONLY=HOLD`, `PRODUCTION=HOLD`. This note is evidence of engineering implementation, not the missing approval or Host Admission.

---

## 2026-10-16 — da9db7129607 live MinIO bucket-root/outside-bucket boundary PASS

Operator-run live S3 SigV4 validation on the isolated MinIO localhost endpoint: created and preserved dedicated EMPTY deny-control bucket `mcft-cap09-deny-control-da9db7129607` (only new sidecar resource; original business bucket, IAM and PostgreSQL unchanged). Positive and Negative principals each received **HTTP 403 AccessDenied** for unprefixed root list of `mcft-cap09-requal-da9db7129607` and list of the deny-control bucket; HEAD of deny-control bucket returned **HTTP 403** for both. Terminal marker **MINIO_BUCKET_BOUNDARY_AUDIT=PASS**. Evidence `D:\\gptdown\\MCFT-CAP09-da9db7129607-INFRA-AUDIT-V1\\minio-bucket-boundary-result-v1.txt` SHA256 **1A69A6E7CAA983301CD122E9D5E2DD3392DFB3721A61876F0761356536A20B7A**; auditor SHA256 **C62B1F9331DFE905D0B3783EC52C89789EAF99DF6915DFF01997B65E4BB789F5**. This closes tested root-list and outside-bucket list/HEAD denial; **outside-bucket PUT denial remains untested**. Preserve control bucket; do not rerun non-idempotent setup or clear resources.

Follow-on exact path: verify outside-bucket PutObject negative with a never-used target key and confirm absent as admin; capture new receipt addendum (never overwrite original), independently archive/sign evidence manifest; recheck fresh Adoption/QCP and signer custody, then only authorized run-scoped one-time TEST_ONLY admission. The existing local receipt is hash-verifiable but not immutable. **TEST_ONLY HOLD; Production HOLD**.

---

## 2026-10-16 — MinIO exact policy qualification PASS

Run **da9db7129607**: the host-side machine comparison of the captured MinIO policy JSON against the frozen minimum-permission contract passed for both sides. Results: **EXACT_POLICY=PASS:positive**, **EXACT_POLICY=PASS:negative**, **MINIO_EXACT_POLICY_QUALIFICATION=PASS**. The audit also verified the previously captured readback SHA256 **BE871F3AFD3DE54F48F2EDC1D500C2C8F676780C3F8F14B10BF8B9BDD2486A94** before parsing. This closes the static policy-content gate only; it does not upgrade the un-versioned bucket to immutable storage and does not replace live outside-bucket/root denial evidence.

Current frontier remains: (1) complete non-mutating live S3 denial evidence for bucket root and another bucket/outside target while preserving raw HTTP/S3 status; (2) independently tamper-evident archive/signature of the database/IAM/S3 evidence and receipt hashes; (3) verify latest protected-main adoption/runtime binding and independent signer custody with an unexpired credential; (4) issue and consume a run-scoped one-time TEST_ONLY Admission permit; only then execute isolated Producer/Timing. **Production HOLD; TEST_ONLY HOLD until those gates pass.**

---

## 2026-10-16 — da9db7129607 isolated infrastructure qualified by host evidence; TEST_ONLY ADMISSION HOLD

Scope / evidence classification: Windows operator-provided terminal receipts only; not an independent rerun by GitHub or production. Run ID **da9db7129607**; frozen subject **91835fa0997730c85c5f3869dd530f4c9a3ca82d**; isolated Postgres container `mcftcap09-da9db7129607-postgres-1` at loopback port 55445, MinIO `mcftcap09-da9db7129607-minio-1` at loopback port 59005. Preserve all earlier run IDs, immutable runtime, historical handoff and existing proofs. Local V13 failures and remediation below are historical, not current operational failures.

PostgreSQL: created `mcft_cap09_requal_da9db7129607_positive` and `mcft_cap09_requal_da9db7129607_negative` using non-overwrite checks; each read-only DB identity audit PASS. 11 frozen SQL files matched Git subject; 10 also matched installed Runtime byte-for-byte, canonical `docker/postgres/init/001_schema.sql` absent from slim Runtime but available as subject-matched repository blob. Only the canonical facts opening DDL + eight ordered migrations applied; both DBs have **29 public tables, zero rows**; after ACL recovery each has **2 SEC­URITY DEFINER writer functions**, exact Evidence/Twin ACL and correct function ownership. Evidence privilege role NOLOGIN INHERIT; Twin privilege role NOLOGIN NOINHERIT. Original dual-ACL V1 positive committed then negative failed due to cluster-global writer-owner role re-creation; V2 negative-only recovery PASS and final read-only ACL both sides PASS, with owner SET memberships revoked. No database rebuild or cleaning.

Four DB LOGIN roles (run-scoped) `cap09_da9db7129607_{p,n}_{evidence,twin}`: each isolated secret stored DPAPI under `%LOCALAPPDATA%\\GEOX\\MCFT-CAP09\\da9db7129607\\credentials`. Failed initial V1.3 due nonexistent SQL `has_role()` (correct `pg_catalog.pg_has_role()`) caused transaction rollback: audit 0 roles, two DB datacl NULL. Aborted credentials preserved at `credentials-aborted-v13-20261016T091548`. Corrected V1.4 **FOUR_ROLES_AND_CONNECT_GRANTS=COMMITTED** and **FOUR_LOGIN_PROVISIONING=PASS**; positive and negative effective ACL passes; Windows host psql 18.6 from `D:\\pdsl\\bin\\psql.exe` real TCP matrix **4 allowed / 4 cross-db denied**. Existing qualification data untouched.

MinIO: isolated bucket `mcft-cap09-requal-da9db7129607`, anonymous disabled, us-east-1, **Un-versioned**. Created EXACT two policies `cap09-da9db7129607-positive-v1`, `cap09-da9db7129607-negative-v1`: GetBucketLocation on exact bucket, ListBucket only respective `positive/*` or `negative/*` prefix, GetObject and PutObject only respective object ARN prefix. Separate enabled users `cap09-da9db7129607-positive`, `cap09-da9db7129607-negative` bound to exact corresponding policy, no groups. Secrets DPAPI at `%LOCALAPPDATA%\\GEOX\\MCFT-CAP09\\da9db7129607\\minio-credentials`; never publish secrets. Two qualification probe objects, 27 B each, total **54 B**. Direct SigV4 S3 script V2 (SHA256 **B2B9AF0CE16CDF2FA56D1929B2CCBBFCF249ADB85FF108EE8E6408EA76C5A917**) reported own GET 200/200, cross-prefix GET **403 AccessDenied** both directions, cross-prefix PUT **403 AccessDenied** both directions; before/after missing targets 404; **MINIO_S3_DIRECT_AUDIT=PASS**. Earlier mc error classifier failed due missing grep and ambiguous stat behavior; Node V1 interrupted by socket hang up; not IAM evidence failures. MinIO administrative readback file `D:\\gptdown\\MCFT-CAP09-da9db7129607-INFRA-AUDIT-V1\\minio-admin-readback.txt` SHA256 **BE871F3AFD3DE54F48F2EDC1D500C2C8F676780C3F8F14B10BF8B9BDD2486A94**; captures exact JSON policies, IAM bindings, bucket and 2-object inventory.

Local qualification receipt created at `D:\\gptdown\\MCFT-CAP09-da9db7129607-INFRA-AUDIT-V1\\infrastructure-qualification-v1.json`, SHA256 **308140A79005CF92418C20EF972D6D9B0A8F3C5604B15BDCDFF2691AF8D808E4**. IMPORTANT: receipt is local hash-checkable operator-reported evidence, **NOT** independently signed / immutable; MinIO bucket has no versioning/Object Lock. IAM strict policy JSON inspected, but direct bucket-root/outside-bucket denial and separate independent evidence archival still outstanding.

**Open / strict gates:** (1) read-only exact-policy machine comparison and non-mutating outside-bucket + bucket-root denied access verification, including preserving raw S3 error/status evidence; (2) independent tamper-evident storage or external governance-signed manifest for operator receipts and hashes, without retroactively claiming existing bucket immutable; (3) recheck latest protected main/head QCP and fresh **unexpired** adoption signature (prior adoption expires 2026-10-15T17:57:17.171Z), signer identity/custody independent of operator, immutable runtime binding; (4) run-scoped one-time TEST_ONLY permit with host/resource identity, stage permission, no replay; (5) only then authorized provider/producer/timing/controlled-delay stage. Production **HOLD** throughout; TEST_ONLY **HOLD** now. Do not restart database/ACL, reissue existing IAM identities, reuse signed old permit, or merge handoff PR #3298.

---

## 2026-10-15 — Formal zero-delta QCP derivation PASS; independent signer custody verification HOLD

Evidence as reported by Windows host (do not turn reports into stronger claims): PR #3707 merged; PR #3708 merged to protected main f71e6f4d9e2c3e8b1f804e2c68c01e03f5d52fc3, 6/6 head CI PASS. PR #3708 GitHub review record had COMMENTED by PR author, no independently recorded APPROVED; merger confirmed in GitHub. Subject remains 91835fa0997730c85c5f3869dd530f4c9a3ca82d, original QCP head a08282ff3976f46b1a9e433a735144d6a0b24c9a. Original artifact 11963382976 ZIP SHA256 face64aa49265ad53c99ade81b684900a1825020c2056a4dec942aad66b06092. Original source first-parent hops 92, derived 93; provenance-based zero-tree-delta merge qualification, **not** a new QCP run at 91835fa.

Windows: git fetch origin main refreshed origin/main from cfaf55f to f71e6f4d (ORIGIN_MAIN_REFRESHED=PASS). V1 QCP runner failed OFFICIAL_BUILDER_MISSING because checkout still old; V2 exported official immutable Git sources (OFFICIAL_TOOLING_EXPORTED=PASS). **DERIVED_QCP_UNSIGNED_PREPARED=PASS**, output D:\\gptdown\\MCFT-CAP09-91835fa0-FORMAL-DERIVED-QCP-V1, engineering_check PASS, 54 formal checks, 108 frozen paths, 5 not-applicable, candidate SHA256 263bfd2950823109e41d14b37fa3ed932606ce343fca458f5e2735951b9fad4a, release binding SHA256 ccbdc69a050c4dd872819be0baf33fcd9576e3f363154dab21046bdef4a61fcc, merge-derivation SHA256 c07dd68c0964e726ac7f3df792938aaa66d3d5948d8b914715ac36b90ae5958a, summary SHA256 6474597a453a73077c89f144e0104abc0ff2e7d042715e438e0c950ada8d59d9. Raw original QCP reports NOT rewritten. Adoption signed=false, execution_authorized=false, production_authorized=false.

Separate Git tooling extraction from f71e6f4d: source bytes of signer.cjs, offline-context.cjs, contract.cjs, installed-material.cjs, verifier.cjs, offline-trust.json all SOURCE_OK. Windows **TOOLING_BYTE_MANIFEST_PASS**, D:\\gptdown\\MCFT-CAP09-SIGNING-TOOLS-F71E6F4D-V1\\tooling-manifest.json SHA256 ad10d55e57a6e0d37943e058abe38f03280044088041314ac4136acd39c8bc4a. Existing 20,890-file Runtime D:\\gptdown\\MCFT-CAP09-RUNTIME-91835fa0 and canonical installed material profile digest 5756c44c49dd919a117bc4ba4cd1e168c6667a5571b36d7e3322a1f07850f96a must remain unchanged; never embed new tooling in Runtime.

Trust file has non-revoked independent governance issuer mcft_cap09_independent_adoption_governance, ADOPTION purpose, INDEPENDENT_GOVERNANCE role, registered SPKI SHA256 80e7897b28faf31da8973badad04a9d2e9b69f3f4cc82683dc67f0b4f3f48479. Public-key REGISTERED=PASS is NOT independent private-key custody proof. Windows search reported two candidate local secret paths D:\\gptdown\\MCFT-CAP09-ADOPTION-KEY-20261015\\adoption-private.pem and D:\\gptdown\\MCFT-CAP09-PRIVATE-SIGNER\\signer-private.pem. Get-Acl found both owned by BUILTIN\\Administrators (truncated output BUILTIN\\Admin...); does NOT prove separation or that either key matches registered SPKI. Latest Node -e fingerprint check failed at PowerShell quote stripping (SyntaxError: expected comma, got colon), no fingerprint calculated and no signing performed. Never print, attach, or commit private-key bytes. Fix verification using a script file or PowerShell here-string piped to node, returning only fingerprint and match status; request custodian evidence separately. If the current operator has custody or access, do NOT treat as independent signer.

Next: read-only confirmation of candidate-key fingerprints vs registered SPKI, independent human issuer/custody proof, guarded Windows **formal-adoption** invocation by issuer, separate offline verifier positive and negative integrity tests. Until verifiable independent signing and offline validation: ADOPTION_SIGNED=false, Local Execution Admission/TEST_ONLY for Run ID da9db7129607 HOLD, no DB/MinIO provisioning or production execution. Avoid rerunning QCP, changing the frozen Runtime, or redoing already PASS material checks. Only prepend this checkpoint; preserve entire historical continuation.

---

## 2026-10-15 — 91835fa incremental Runtime preparation; exact-SHA formal QCP admission gate

Produced reviewed Windows tooling bundle `MCFT-CAP09-MAIN-91835fa0-INCREMENTAL-TOOLS-V2.zip` SHA256 c49fae1e91da7d72930e4f463453b7e9ddb164fe99d1087c24cfe6c1666afdfa. Contains Python byte-precise materializer and Windows wrapper 01 (old physically installed 674fca57 tree preserved; checks protected main 91835fa0997730c85c5f3869dd530f4c9a3ca82d, candidate a08282ff3976f46b1a9e433a735144d6a0b24c9a, Git Tree 536fa5c710fb7bf917fc056a36694d5cc692b4ff, exact eight changed blobs, identity receipt SHA, old tracked source, link-free copy and free disk), then separate physical Runtime `MCFT-CAP09-RUNTIME-91835fa0`, official installed-material.cjs canonical profile collection. Wrapper 02 calls NEW main generator build_evidence.py and requires subject-exact eight-member formal QCP artifact `D:\gptdown\MCFT-CAP09-QCP-91835fa0.zip`. Official finalize_qcp_adoption enforces per-artifact cp2/plan/blockers head_sha==91835fa, and checks 55 statuses 50 PASS/5 N-A with blocker_count=0; old a08282ff and 674fca57 evidence CANNOT be renamed or silently inherited. Current prior V5 main identity receipt PASS: SHA256 62ae2119..., tree equality true, 8 changed paths. Bundle creation in assistant environment is NOT a Windows run; no new Windows Runtime/profile, no official merged-main QCP artifact, no independent signed adoption or offline verification yet. User can run 01 once if Git objects and disk available; 02 only after new formal artifact is obtained. GitHub prior PR-head QCP 27 success one skipped, but no subject-exact merged-main QCP artifact verified. Independent human signer authorization and review still unresolved. No DB, MinIO, permit or host execution. EXECUTE_HOLD and PROD HOLD.

---

## 2026-10-15 — Windows protected main Git Tree identity PASS

Operator executed read-only V5 Git Tree check and supplied receipt `D:\gptdown\MCFT-CAP09-PROTECTED-MAIN-TREE-91835fa0-V1.json` raw SHA256 `62ae21192361e955152a6987cbd11cb37c6d0ffa55d0e5f89650a3d4b62dc8d5`. Status PASS: protected main commit 91835fa0997730c85c5f3869dd530f4c9a3ca82d, candidate a08282ff3976f46b1a9e433a735144d6a0b24c9a, Git Tree for BOTH = 536fa5c710fb7bf917fc056a36694d5cc692b4ff, exactly eight changed tracked paths vs old 674fca57b973164fc0ec1dc5f2ceb3afe9ba58d1, parents [cfaf55f10f2ce7e995ffeb95fe4d5675f1a893a4,a08282ff3976f46b1a9e433a735144d6a0b24c9a]. Database mutations 0, object store mutations 0. This **closes Git Tree identity only**; old qualification and signature NOT reusable and new formal main 91835fa adoption/QCP evidence plus fresh installed profile, independent Ed25519 signature and offline verify still required. The 674fca57 installed physical runtime remains immutable; incremental eight-file COPY into a NEW physical runtime only. No TEST_ONLY or production authority.

---

## 2026-10-15 — PR #3704 merged; protected main now new SHA, signed Runtime is stale

Live GitHub `get_pr_info` reports PR #3704 CLOSED/MERGED, source head a08282ff3976f46b1a9e433a735144d6a0b24c9a and merge_commit_sha 91835fa0997730c85c5f3869dd530f4c9a3ca82d. Live compare 91835fa... to `main` returns IDENTICAL, ahead=0 behind=0 files=0. PR-head associated workflow results 27 SUCCESS, one known SKIPPED Producer Live. Review entries only COMMENTED by same account; no independent APPROVED reviewer verified, a procedural gap despite actual merge. Git Tree OID not returned by available GitHub commit connector; require `git rev-parse 91835fa^{tree}` vs `a08282ff^{tree}` on Windows, do not assume. Signed 674fca57 proof, canonical installed digest f90f3366..., adoption digest 5744967e..., are historic and cannot authorize merged main 91835fa. Source material updated by eight files on a08282ff, but final merge SHA must be bound in evidence and new independent signature; must obtain official new SHA QCP result rather than relabeling prior evidence. Strict Run ID da9db7129607 PG 55445 S3 59005 adapter currently hardcodes a082? Earlier adapter binds 674fca57; must regenerate for final main, maintain negative tests. No DB/schema/login/MinIO mutations and no permit issuance authorized by current evidence; TEST_ONLY and PROD HOLD.

---

## 2026-10-15 — Incremental review a08282ff; two engineering review issues resolved, new-head gates pending

Exact #3704 HEAD a08282ff3976f46b1a9e433a735144d6a0b24c9a. Git comparison with 674fca57 shows only 8 changed paths; review of exact commit delta verifies signed Adoption release inventory requires thirteen stage/control files and installed hash match, parent/child use shared formally registered offline context gate before authority consumption, and signed Adoption remains insufficient without Retry Permit. Historical Phase2 recognition now pinned and explicitly returns current_candidate_qualified=false; targeted negative applicability cases reject unknown changed paths and trigger requalification for changed controller. Engineer reports local 66+19 tests PASS; this alone is not independently verified GitHub full CI. Review COMMENT id 5531491581 submitted at exact new HEAD: two code issues addressed, NOT approval. At readback most GitHub workflows SUCCESS but exact HEAD QCP (38718067284), adoption synthetic (38718067278), CI (38718067333) and several others IN_PROGRESS; do not say green. PR remains Ready/Open/Unmerged. Old 674fca57 20889-file signed Runtime and Adoption signature are HISTORICAL and cannot authorize a08282ff; new source adoption must be rebuilt if main adoption approved. Human independent review approval remains separate. Fresh run da9db7129607 PG/MinIO alive, new DB/ACL/bucket not provisioned; TEST_ONLY and PRODUCTION HOLD.

---

## 2026-10-15 — PR #3704 engineering review submitted; APPROVAL NOT GRANTED

Reviewed all 41 PR changed-file patches at exact head 674fca57b973164fc0ec1dc5f2ceb3afe9ba58d1, formal CI/QCP prior PASS. Submitted GitHub PR review action COMMENT id 5531327198, NOT APPROVE. Two review closure items: (1) governed retry Host signedActivation skips former four adopted capability booleans in parent and child; need equivalence proof for real six-stage signed plan/permit/material semantics, not synthetic-only acceptance. (2) QCP workflow weakened `boundary.adopted_main_sha===base` to `git merge-base --is-ancestor base boundary.adopted_main_sha`; need independent negative test that a descendant with unadopted paths cannot qualify. Independent signer key registration != actual independent human governance control or authorized CODEOWNER reviewer. Positive findings: disabled-by-default trust, scoped Run ID endpoints/negative tests, preserved isolated historical proof and separate one-time permit. Protected main not merged; no permission for DB/MinIO irreversible bootstrap yet under current sequence; production and TEST_ONLY HOLD. Do not represent this COMMENT as independent APPROVED review.

---

## 2026-10-15 — PR #3704 promoted from Draft to Ready for Review (not merged)

After verifying all available candidate CI/QCP and separate signed Adoption, GitHub `mark_pull_request_ready_for_review` returned PR 3704 OPEN, draft=false, head 674fca57b973164fc0ec1dc5f2ceb3afe9ba58d1, main cfaf55f10f2ce7e995ffeb95fe4d5675f1a893a4. No approved review observed as of preceding readback. This is review-state progression ONLY, not branch protection bypass, independent reviewer approval, merge or active Host authority. Database/bucket zero-state creation remains pending exact protected main adoption and resource receipt gates; production and TEST_ONLY remain HOLD.

---

## 2026-10-15 — Formal adoption decision for #3704: HOLD pending review

Live GitHub: PR #3704 Draft/Open/Unmerged, mergeable=true, exact HEAD 674fca57b973164fc0ec1dc5f2ceb3afe9ba58d1, protected main cfaf55f10f2ce7e995ffeb95fe4d5675f1a893a4, ahead 52 behind 0, merge base main. PR reviews=[] and review threads=[]. All previously checked 674fca57 CI and formal QCP SUCCESS, separately Windows installed 20889-file Runtime and signed Adoption verified. PR description explicitly forbids merge absent reviewer approval. Engineering qualification is not protected-main adoption; no authorized merge occurred, no database or S3 create attempted. New run da9db7129607 protected-main exact SHA guard remains blocking. Need independent reviewer approval and normal Ready-for-review transition/merge through branch protection; then verify protected main authoritative SHA (merge commit may differ from candidate and require reviewed requalification of newly adopted source), not bypass exact main check. Only after adopted exact SHA is reconciled with run-bound resource/installer contracts should run-scoped PG DB/bucket provisioning and immutable fresh zero-state receipts proceed. TEST_ONLY and PRODUCTION HOLD.

---

## 2026-10-15 — da9db7129607 isolated Schema/Login adapter candidate and synthetic checks

Full operator-source ZIP 4b22351e24b7140364561a927c7a103a0f2f3ab4509fdaed1f3566f8b78f6f5a reviewed (four original historical CJS files). Created new separate candidate ZIP MCFT-CAP09-DA9DB7129607-ADAPTER-V1.zip SHA256 aa7a05e419ca12ad87d4242e0fd701ebefe6470b9cd021e3942c172f0515d0a6; original files not changed. Adapted run c1f7dcc6d04d -> da9db7129607; old source 3857b91b... -> 674fca57b973164fc0ec1dc5f2ceb3afe9ba58d1; PG local 55432 -> 55445; MinIO local 59000 -> 59005. Kept exact remote protected main and worktree-clean gates, one-shot markers, receipt SHA chain and negative guards. Node --check for all four PASS; schema selftest 27 PASS, schema synthetic acceptance 13 scenarios PASS; login selftest 25 PASS, login synthetic acceptance 15 scenarios PASS. Tests are synthetic only; zero actual PostgreSQL / S3 mutations. **BLOCKER** PR #3704 is Draft/Unmerged, installer expects remote protected main equal 674fca57. Do NOT relax guard or execute one-time mutation. Fresh positive/negative databases/bucket, resource creation STARTED/CREATED + empty baseline evidence, independent ACL readback, login credentials remain unprovisioned. Need qualified main-version adoption policy/merge decision, fresh resource bootstrap receipts, then preflight, then explicitly authorized one-shot. Signed Adoption context validity finite. EXECUTE_HOLD and PRODUCTION_HOLD.

---

# 2026-10-15 — Exact 674fca57 independent signed Adoption and real offline Host readback PASS

Operator Windows stdout: `SIGNED_ADOPTION_OFFLINE_VERIFIED`, subject_sha `674fca57b973164fc0ec1dc5f2ceb3afe9ba58d1`, issuer_id `mcft_cap09_independent_adoption_governance`, material_digest `f90f3366c6b580dbb4133efe68207499f6fba7a32eddfc89d1242e5ee825e8b4`, adoption_digest `5744967ee8a45e3163b4bba530e4ebce4ac5607a83f3555af541ed0c753092fd`, expires_at `2026-10-15T10:42:47.600Z`, TEST_ONLY scope, adoption_context_eligible=true; source request at `D:\gptdown\MCFT-CAP09-SIGNED-RUNTIME-ADOPTION-674fca57-V1.json`. Formal offline-context `verify` and `load` passed on the independently copied installed Windows Runtime (`20889` physical files, 6428 source matched). This grants signed Adoption context eligibility only, NOT Local Execution Admission, independent Retry Permit, or production. `retry_permit_issued=false`, `host_execution_started=false`, `production_authorized=false`. Signing key contents not disclosed. Institutional confirmation of independent signer custody still outstanding. Next: safely identify exact approved independent 29-table schema + ACL materialization and scoped MinIO identity for fresh isolated run `da9db7129607`, PG 127.0.0.1:55445, MinIO 127.0.0.1:59005; refrain from invoking old AM19 remote-parent script, production Formal V5 bootstrap, or touching existing live Evidence/Twin containers. When actual host admission happens, re-sign proof if expired; no time manipulation. EXECUTE_HOLD/PRODUCTION_HOLD.

---

# 2026-10-15 — 674fca57 physical Runtime and Installed Material proof PASS

Operator Windows output confirms source-manifest subset VERIFIED for 6428 source files at subject 674fca57b973164fc0ec1dc5f2ceb3afe9ba58d1, with no execution authority. Physical independent Windows Runtime path `D:\gptdown\MCFT-CAP09-RUNTIME-674fca57` holds 20889 files, installed material `scripts/cap09_adoption_v1/installed-material.cjs` self-verified `INSTALLED_MATERIAL_COLLECTED_AND_SELF_VERIFIED`. Canonical profile digest `f90f3366c6b580dbb4133efe68207499f6fba7a32eddfc89d1242e5ee825e8b4`; profile JSON raw-byte SHA256 `44f59e73d5077900ee1c8a8f25850bfb56f8e67c4b6408adc8f2245fc53c6c0c`. Profile file `D:\gptdown\MCFT-CAP09-RUNTIME-MATERIAL-674fca57-V1.json`; release binding SHA256 2ffb4bd9d484c26c08fd3512d4789bf47dfd2d06b27c2e2d07caedff7c366b29. Correct interpretation: installed Runtime extra build artifacts such as `packages/contracts/dist/index.d.ts` are valid and must be covered by installed-material profile; `material_binding.py.verify` has exclusive source-tree semantics and must NOT be used against installed Runtime root. Git source subset and installed material independently passed. Next: fresh independent ADOPTION Ed25519 signature over exact policy/candidate/proof/installed profile, offline-context full verification with finite validity; key must remain confidential, independent human control pending institutional confirmation. Then isolated `da9db7129607` DB Schema/ACL and scoped MinIO; no host permit or stages yet. EXECUTE_HOLD and PRODUCTION_HOLD.

---

# 2026-10-15 — 674fca57 official QCP ZIP verified and final unsigned Adoption Candidate PASS on Windows

Operator exact stdout: official GitHub Artifact ID 11952743245 ZIP `MCFT-CAP09-QCP-674fca57.zip` SHA256 f6a1d0c44cba04959d07b80fe26ae220c49aa5cb28dc4d837ebe01e4dda837d5 PASS. New clean detached Windows worktree D:\gptdown\GEOX-cap09-adoption-674fca57 at 674fca57b973164fc0ec1dc5f2ceb3afe9ba58d1; `SOURCE_HEAD_AND_CLEAN=PASS`. Formal QCP `scripts/cap09_adoption_v1/build_evidence.py --formal-qcp-artifact` created D:\gptdown\MCFT-CAP09-ADOPTION-CANDIDATE-674fca57-V1 and reported FINAL_QCP_ADOPTION_PACKAGE_PREPARED_UNSIGNED: 54 formal checks, 108 frozen paths, engineering PASS, 5 explicitly not applicable; `candidate_sha256=fd36a859678bedf702948f58f9d6d3d950a76ba2d92c3b99cf6c31ca2f34d4e3`, `release_binding_sha256=2ffb4bd9d484c26c08fd3512d4789bf47dfd2d06b27c2e2d07caedff7c366b29`. execution_authorized=false, production_authorized=false. Next exact source delta physically separate 20888-file Runtime at NEW release path, patched 5 changed blobs after no hardlink/junction copy, verified against bound 674fca57 source manifest + installed-material profile, then independent fresh Adoption signature and offline verification before any Host Admission. Previous dabb8a24 signed installed Runtime and profile immutable and not valid for changed HEAD. Fresh infra da9db7129607 healthy PG 55445 and MinIO 59005, Schema/ACL not provisioned, EXECUTE_HOLD / PRODUCTION_HOLD.

---

# 2026-10-15 — PR 3704 fresh da9db7129607 endpoint-compatibility successor CI/QCP workflows SUCCESS (artifact awaiting exact readback)

New PR #3704 exact HEAD 674fca57b973164fc0ec1dc5f2ceb3afe9ba58d1 (Draft/Open/Unmerged). GitHub comparison from dabb8a247484d5cc3fe3b5e21f9f56080ebbc0d2: ahead 1, behind 0, only 5 changed files: .github/workflows/mcft-cap09-local-cutover-candidate-v1.yml; governance acceptance DEDICATED_PG_ENDPOINT test; governance acceptance ISOLATED_RETRY_ADMISSION_BRIDGE test; governance runtime MCFT_CAP09_DEDICATED_PG_ENDPOINT_V1.cjs; MCFT_CAP09_ISOLATED_RETRY_ADMISSION_BRIDGE_V1.cjs. User independently reports local tests endpoint 49 PASS, Bridge 49 PASS, real host rejects 19 PASS, applicability plan PASS. GitHub workflow fetch at checkpoint: 28 completed: 27 success, 1 skipped (producer-driven live qualification, NOT a real producer run), 0 failing. Exact QCP workflow id 38691874559 SUCCESS, formal raw evidence artifact id 11952743245 name mcft-cap09-qualification-control-plane-674fca57b973164fc0ec1dc5f2ceb3afe9ba58d1 size 277836 bytes, not expired; evidence ZIP itself NOT yet downloaded/hash-reverified and final PLAN contents NOT yet independently read back. Local Cutover Candidate workflow 38691874777 SUCCESS with Windows job 116279403683 and Ubuntu job 116279404020 SUCCESS. Existing dabb8a24 20888-file installed Runtime and independently signed Admission proof remain immutable historical artifacts, MUST NOT be reused to authorize changed 674fca57 sources. Next download official exact-head QCP artifact on Windows, hash and run formal adoption candidate builder for new SHA in new independent directory; then create separate physical incremental Runtime and installed material profile; independent fresh adoption Ed25519 signature and independent offline verification. Preserve da9db7129607 PG 55445 and MinIO 59005 ready containers/volumes, zero qualification databases, no schema/ACL yet. Existing static trust disabled, no permit, six TEST_ONLY and production remain HOLD. Handoff existing second PR #3298 only, no third.

---

# 2026-10-15 — CRITICAL new-run Local Admission static contract incompatibility: HOLD before Schema/ACL

Read-only review of exact dabb8a247484d5cc3fe3b5e21f9f56080ebbc0d2 source and operator AM19 report found blockers: (1) AM19 provisioning wrapper enforces remote named parent DB, strict container/PG-tool version identity, not applicable to fresh local Docker Compose instance. (2) `scripts/governance_acceptance/MCFT_CAP09_ISOLATED_RETRY_ADMISSION_BRIDGE_V1.cjs` forces, for any run ID except 800c023cf337, `resources.database_port===55432`, `resources.bucket_endpoint==='http://127.0.0.1:59000'`, audit user `qual_admin`. Fresh run da9db7129607 currently has PG 127.0.0.1:55445 and MinIO 127.0.0.1:59005; structural admission would reject them. (3) `scripts/runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs` unconditionally invokes `assertDedicatedPgUrl(valid.arm.run_id, env[key], name)` for positive and negative DBs, but `MCFT_CAP09_DEDICATED_PG_ENDPOINT_V1.cjs` only accepts run=800c023cf337 and port=55434. Thus merely reverting ports to 55432/59000 does NOT solve the actual Host URL contract for a fresh run. Need narrow source regression + exact new-head CI/QCP and new Adoption proof or independently authorized reviewed compatibility successor before any run-specific permit; do not patch frozen already-signed Runtime in place. (4) Existing Formal V5 schema runner targets named non-Run-ID production identity and AM19 wrapper targets remote parent; cannot invoke blindly. Pause schema materialization until compatible reviewed schema/ACL executor and host resource contract ready. Operator pasted AM19 read-only inspection PASS and no database mutation. MinIO host curl HTTP 200, PG pg_isready PASS; infrastructure exists but is not execution-admissible. EXECUTE_HOLD/PRODUCTION_HOLD. Preserve already verified dabb8a24 proof as historical immutable evidence, but it cannot sign post-change source. Keep original PR #3298 second handoff pure-prepend.

---

# 2026-10-15 — da9db7129607 MinIO loopback HTTP health PASS; host infra connectivity recovered

Operator Windows dual-side diagnostic: MinIO container RUNNING=true, STATUS=running, RESTARTS=0. `Test-NetConnection 127.0.0.1 -Port 59005` TCP_CONNECTED=True. `curl.exe --noproxy '*' --http1.1 http://127.0.0.1:59005/minio/health/live` returned HTTP_STATUS=200, HOST_CURL_EXIT=0, remote_ip=127.0.0.1. Earlier PowerShell Invoke-WebRequest premature close no longer blocks MinIO host access. In-container wget probe returned `wget: command not found`; status is TOOL_UNAVAILABLE, not a MinIO health failure. PostgreSQL 127.0.0.1:55445 port published and pg_isready PASS; qualification DB count zero prior to schema. Fixed new Compose with separate network `mcftcap09-da9db7129607_isolation`, now internal=false, dedicated PG/MinIO data volumes untouched by down/up; external egress boundary not proven and must be audited before provider execution. Next: fresh positive/negative DB creation and exact 29-table Schema+ACL, MinIO bucket + scoped identity, all readback evidence, no reliance on old c1f7dcc6d04d credentials or run identity. No TEST_ONLY permit, no stages, PRODUCTION_HOLD and EXECUTE_HOLD.

---

# 2026-10-15 — new run da9db7129607 isolated infrastructure containers STARTED

Operator Windows stdout: COMPOSE_CONFIG=PASS; Docker Compose created network mcftcap09-da9db7129607_isolation, dedicated volumes mcftcap09-da9db7129607_minio_data and mcftcap09-da9db7129607_postgres_data; containers mcftcap09-da9db7129607-minio-1 and mcftcap09-da9db7129607-postgres-1 both STARTED. NEW_INFRA_CONTAINERS=2, NEW_PROJECT=mcftcap09-da9db7129607; config directory D:\\gptdown\\MCFT-CAP09-INFRA-da9db7129607; loopback PostgreSQL 127.0.0.1:55445; loopback MinIO 127.0.0.1:59005. Generated compose was separate, with distinct bridge and volumes, not the historical fixed-port old compose. No evidence yet that PG/MinIO have passed live readiness, zero-state, two-database 29-table Schema/ACL, runtime-role credential verification, bucket isolation or MinIO scoped identity. No permit issued, no stage run. Local Execution Admission=HOLD, PRODUCTION=HOLD. Preserve production Evidence/Twin containers and historical records; do not copy old credentials or falsely report full acceptance. Next verify new containers ready and fresh database baseline, then choose exact existing schema/ACL runner by inspection before modifying databases. Original second active Handoff only, pure prepend.

---

# 2026-10-15 — Local Execution Admission resource discovery and legacy infra package inventory (new run candidate da9db7129607)

Operator Windows output: exact source HEAD dabb8a247484d5cc3fe3b5e21f9f56080ebbc0d2; Docker Engine 29.1.2; host LAPTOP-STN2A2P1; free D: 61.24 GB; proposed fresh run ID da9db7129607 has no existing Docker container/volume name collision; discovery PASS, resource_provisioned=false, EXECUTE_HOLD=true, PRODUCTION_HOLD=true. Production Evidence/Twin containers were RUNNING; preserve untouched. Old dedicated PostgreSQL/MinIO qualification containers exited, and isolation networks were still present. Do not restart old containers or share production network, volumes, database or credentials. 

Exact Windows legacy package discovery: D:\\gptdown\\MCFT-CAP09-ISOLATED-INFRA-20261010 contains docker-compose.yml, START-MCFT-CAP09-ISOLATED-INFRA.ps1, INSPECT-MCFT-CAP09-ISOLATED-INFRA-V2-20261010.ps1, legacy infra reports, ACL materialization/check evidence, and past c1f7dcc6d04d TEST_ONLY Producer evidence, as well as prior 72dc0304a21a attempt STARTED/result. D:\\gptdown\\MCFT-CAP09-TESTONLY-SCHEMA-ACL-c1f7dcc6d04d-V1 and D:\\gptdown\\MCFT-CAP09-TESTONLY-LOGIN-c1f7dcc6d04d-V1 exist, but read-only discovery found NO .ps1/.json/.yaml/.yml/.sql files under either (may contain other extensions; inspect safely before relying on them). Old package configuration is OLD-RUN-BOUND; reuse implementation pattern, not old credentials, data, output, network or run-scoped authority. Repo includes scripts/qualification/PROVISION_MCFT_CAP09_AM19_RUN_SCOPED_DATABASES_V1.cjs and governed retry host; do not assume historical provision wrapper applies to fresh run without checking its exact guards.

Time/authority: Adoption proof dabb8a24 independently offline PASS, expiry 2026-10-15T06:47:51.549Z; 3351s remaining at Host check, must recheck live before each admission, re-sign unmodified profile after expiry rather than rebuilding. Independent Retry issuer registered & valid; retry trust stays adopted=false, execution_enabled=false and execution capabilities disabled. Signed Adoption may activate TEST_ONLY but only under new run-bound independent permit, fresh readback <=300s, exact plan, real controlled delay evidence, fresh resource ACL positive/negative probes and Host preflight. Nothing executed or provisioned for da9db7129607. Independent human signer control confirmation pending. Six TEST_ONLY stages and production HOLD. PR #3298 remains existing second Handoff, pure prepend; do not create third Handoff.

---

# 2026-10-15 — dabb8a24 formal TEST_ONLY Adoption independently OFFLINE VERIFIED PASS; Local Admission next

Operator Windows readback: `OFFLINE_ADOPTION_VERIFIED` and `INDEPENDENT_OFFLINE_VERIFICATION=PASS` against exact subject `dabb8a247484d5cc3fe3b5e21f9f56080ebbc0d2`. Qualification `mcft_cap09_adoption_dabb8a247484_v1`; independently signed Adoption digest `e66a553cf10ae256fe60432347163a15fd84e08f90330f3cdd6e0f331382f8fe`; installed Runtime canonical material digest `8ee294e454cddd43a1b9d1195854ea2ca47dcf73822c4e5c4583a200e1807488`; expiry `2026-10-15T06:47:51.549Z` (Beijing 14:47:51). Signed proof `D:\\gptdown\\MCFT-CAP09-SIGNED-RUNTIME-ADOPTION-dabb8a24-V1.json`, installed physical runtime `D:\\gptdown\\MCFT-CAP09-RUNTIME-dabb8a24` with 20888 regular independent files, formal profile `D:\\gptdown\\MCFT-CAP09-RUNTIME-MATERIAL-FINAL-dabb8a24.json`. Formal unsigned source candidate V2 `D:\\gptdown\\MCFT-CAP09-ADOPTION-CANDIDATE-dabb8a24-V2`, candidate SHA256 `4e3521e924b709bd530ffdcaf456451b8cb036c6e996ca07c99c1db69f6925ba`, exact-subject 6428-file release binding SHA256 `91875ab268d4230c762dfe3f34ae5258017a8c0c4152eeda5b938b48741fd03e`, QCP artifact SHA256 `884141d0a0ed3cd0f9a85b6fe8aa48a17b9d2073c8a5a060f7b222bcb8a6267e`. Installed profile file SHA256 `e4cffd1a80ab75f7dec24945418dc53df8853b594c808cf925dc3cdf50fce9af`. Operator confirmed formal signed TEST_ONLY `execution_authorized=true`, `production_authorized=false`. These are reported operator stdout, not a direct Host action by connector.

**Adoption CLOSED for exact immutable unchanged dabb8a24 until proof expiry; DO NOT repeat** QCP, builds, 12 Junction / 11944 hardlink conversions, old cb773984 Runtime materialization, V2 candidate generation, 20888-file inventory or proof issuance merely because of handoff. **Next independent gate Local Execution Admission**: verify proof still unexpired; if expired re-sign against same unchanged material with new write-once receipt and independently offline-verify; acquire accountable independent retry signer control confirmation; fresh noncolliding Run ID and dedicated PG positive/negative + scoped MinIO; actual least-privilege readbacks and environment/host timing; new run-specific one-time permit; Host --preflight-only; then gated six ordered TEST_ONLY stages. Do not reuse previous c1f7dcc6d04d run resources as fresh, do not share private PEM or copy ledger/DPAPI secrets across hosts. Current `EXECUTE_HOLD` (no one-shot permit, no current host readback) and `PRODUCTION_HOLD` remain. #3704 still draft/unmerged and #3298 must stay DRAFT/OPEN/UNMERGED.

---

# 2026-10-15 — dabb8a24 Windows incremental Runtime physical materialization PASS

Operator Windows stdout: PRECHECK=PASS; OLD_PHYSICAL_FILES=20884; GIT_REPLACEMENTS_VERIFIED=8; SOURCE_RELEASE_FILES_VERIFIED=6428; INSTALLED_FILES=20888; NEW_RUNTIME=D:\\gptdown\\MCFT-CAP09-RUNTIME-dabb8a24; INCREMENTAL_RUNTIME_MATERIALIZATION=PASS; EXECUTION_AUTHORIZED=false; PRODUCTION_AUTHORIZED=false; WINDOWS_INCREMENTAL_RUNTIME=PASS. New directory built as independent physical file copy of verified cb773984 runtime; eight changed tracked Git blobs replaced from exact dabb8a24; all 6428 bound source files match release SHA256; links/multi-linked files rejected by staging script. Old runtime left untouched by procedure. **No formal installed-material.cjs full profile, tool/env attestation, fresh adoption signing or offline verification yet.** Next: first read-only inspect old profile's tools and available new runtime entry, then run repository installed-material collector with Windows tool paths, independent output outside Runtime, verify 20888 files and hashes; keep trust disabled / EXECUTE_HOLD / PRODUCTION_HOLD. No redeploy/clean/reinstall/rebuild without documented drift. Source of claim is actual operator stdout, not connector execution.

---

# 2026-10-15 — Windows dabb8a24 exact worktree established CLEAN (operator readback)

Operator executed `git -C $Repo worktree add --detach $New $Target` on Windows, checked `rev-parse HEAD` and `git status --porcelain`. Observed `EXACT_HEAD_WORKTREE=PASS`, `SUBJECT_SHA=dabb8a247484d5cc3fe3b5e21f9f56080ebbc0d2`, `WORKTREE=D:\\gptdown\\GEOX-cap09-adoption-dabb8a24`, checkout 8,266 paths, detached HEAD, clean Git status. Source is now present; **DO NOT fetch or recreate worktree again**. Old `D:\\gptdown\\MCFT-CAP09-RUNTIME-cb773984` is preserved by operator procedure, not independently reinspected during this command. This closes local exact source checkout only; no new release-material binding / unsigned 54-check candidate / physical runtime / installed-material profile / fresh signature has been observed. Next perform read-only eight-path Git blob diff and inspect actual official materializer commands before creating write-once versioned artifacts. No installers, DB, MinIO, permit, Producer or stage actions. EXECUTE_HOLD / PRODUCTION_HOLD.

---

# 2026-10-15 — cb773984 -> dabb8a24 exact incremental delta audited (8 commits / 8 paths)

GitHub compare exact immutable commits `cb77398404edfbc223350d1c74a46323efe9fd3e...dabb8a247484d5cc3fe3b5e21f9f56080ebbc0d2` returned **ahead 8, behind 0, changed files 8**; the entire returned diff inventory: `.github/workflows/mcft-cap09-adoption-local-synthetic-v1.yml` (modified), `.github/workflows/mcft-cap09-independent-retry-issuer-v1.yml` (added), `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json` (modified), `scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP09_DEDICATED_PG_ENDPOINT_V1.cjs` (modified), `scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP09_INDEPENDENT_RETRY_ISSUER_PROVISION_V1.cjs` (added), `scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP09_RETRY_PERMIT_V1.cjs` (modified), `scripts/runtime_acceptance/MCFT_CAP09_INDEPENDENT_RETRY_ISSUER_PROVISION_V1.cjs` (added), `scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json` (modified). No modified package manager lockfile or production scientific/runtime source files in the exact comparison.

**Incremental construction decision:** reuse previous verified cb773984 physical file content only after comparing true Git blob or freshly computed per-file SHA256 and ensuring independent file identities; copy to separate candidate staging root, do not modify old root, do not preserve hardlinks/reparse points. Apply only exact dabb8a24 new/modified Git blob bytes, then recalculate and verify full complete source/release inventory and changed dependency references. The fresh installed-material profile **must inventory every byte in the new installed Runtime**, not merely the eight changed source paths. Old 20,884 count and digest are reference only, not accepted values for this SHA. The changed governance program and trust config themselves must be contained in new material and fully bound by the new signed qualification. QCP dabb8a24 PASS artifact is valid input, while prior historical a44b294f release binding is NOT. All live Windows actions and real unsigned candidate generation still pending: do not claim signed Adoption, run-scoped authorization, or six stages. A future new commit restarts exact-subject qualification/digest checks. EXECUTE_HOLD/PRODUCTION_HOLD.

**Avoid repeat failures:** no generic git checkout byte-normalization for formal release evidence (previous `apps/web/smoke_test.ps1` mismatch); verify exact Git blob bytes, use V3-like robust binary-safe materialization, not V2 delimiter parsing. Do not introduce environment variables outside collected allowlist during offline verification, do not transfer private keys, do not rerun legacy full pnpm installs unless real new-stage dependency audit proves needed. Handoff is deployment runbook with exact files/evidence, not a substitute for Windows host readback.

---

# 2026-10-15 — dabb8a24 downloaded-artifact readback: QCP is exact HEAD, Windows candidate-release artifact is HISTORICAL (NOT signable)

**Evidence downloaded and inspected rather than inferred from green CI:** GitHub Actions QCP run 38682700497 artifact 11948833364 (ZIP SHA256 `884141d0a0ed3cd0f9a85b6fe8aa48a17b9d2073c8a5a060f7b222bcb8a6267e`, 8 files) and Windows candidate-material run 38682700467 artifact 11948194709 (evidence + payload + release binding). QCP authoritative `MCFT_CAP_09_CHECK_APPLICABILITY_V1_PLAN.json`: `status=PASS`, `head_sha=dabb8a247484d5cc3fe3b5e21f9f56080ebbc0d2`, `unknown_changed_paths=[]`, 23 REQUIRED / 27 REQUALIFY / 5 NOT_APPLICABLE / 0 blockers; `MCFT_CAP_09_ALL_BLOCKERS_PREFLIGHT_V1_RESULT.json`: `status=PASS`, zero blockers. Note `CP2_CURRENT_PLAN_DEBUG.json` is a *deliberately negative* historical/debug scenario `status=FAIL` using base `3bbf096e` with unknown non-MCFT paths; do not confuse it with authoritative PASS plan based on `cfaf55f`.

**Critical mismatch confirmed from actual Windows CI artifact:** `release-material-binding.json.subject_commit_sha=a44b294f684027c0d1dd7a28c3735442fca736a4`, inventory files=6,414; `adoption-evidence-manifest.json.subject_commit_sha=a44b294f684027c0d1dd7a28c3735442fca736a4`, `status=ADOPTION_INCOMPLETE`, `overall_pass_issuance_allowed=false`, `adoption_blockers=5`. These are intentionally historical/candidate release-material fixture outputs from the CI job, **NOT** dabb8a24 exact-current signed-runtime release binding. Never rename/relabel this archive or manually replace its subject SHA to claim new adoption. It is valid evidence of the source material-boundary test only. This corrects possible overinterpretation of a green release-material-binding CI job.

**Next exact bounded actions:** obtain/generate fresh dabb8a24 release-material-binding and formal 54-check unsigned candidate with official repo scripts against authentic QCP PASS artifact; hash the released evidence bytes and reconcile all checked source/dependency files. On Windows use separate physical new-version Runtime root; compute new actual installed-material inventory and tool/env hashes; sign only after verifier accepts the actual exact dabb8a24 candidate with independent ADOPTION key and live policy, then separately offline-verify. Neither new release binding, new 54-check candidate, installed material, nor new independent signature observed from this evidence. Retain old cb773984 PASS as reference only, no 20,884-file copy/signature reuse. Host and signer private key remain outside current GitHub connector. TEST_ONLY EXECUTE_HOLD; PRODUCTION_HOLD. No source PR #3704 mutation was done in this readback, handoff alone is pure-prepend.

---

# 2026-10-15 — #3704 exact dabb8a24 CI/QCP GREEN; incremental Adoption Windows handoff (NOT YET SIGNED)

**Authoritative candidate:** PR #3704 DRAFT/OPEN/UNMERGED, branch `fix/mcft-cap09-disabled-retry-historical-inheritance-20261013`, exact HEAD `dabb8a247484d5cc3fe3b5e21f9f56080ebbc0d2`. Freeze as **candidate only**, not protected-main adoption. Re-check branch HEAD before any evidence/package operation; a new commit invalidates SHA-specific candidate and signatures.

**Observed real GitHub Actions at this exact SHA (2026-10-15):** QCP `38682700497` SUCCESS, post-merge-v13 `38682700284` SUCCESS, global ci `38682700448` SUCCESS, independent retry issuer Windows/Ubuntu `38682700463` SUCCESS, adoption/offline admission synthetic Windows/Ubuntu `38682700467` SUCCESS, EA5E2 dependency graph `38682700352` SUCCESS, local cutover candidate `38682700486` SUCCESS, Formal-v5 post-graduation `38682700400` SUCCESS. QCP archive `mcft-cap09-qualification-control-plane-dabb8a247484d5cc3fe3b5e21f9f56080ebbc0d2`, artifact ID `11948833364` from https://github.com/liyongshang44-max/GEOX/actions/runs/38682700497. Windows candidate material `candidate-material-windows-2022-dabb8a247484d5cc3fe3b5e21f9f56080ebbc0d2`, artifact ID `11948194709`; Ubuntu candidate equivalent artifact ID `11948359265` from https://github.com/liyongshang44-max/GEOX/actions/runs/38682700467. **These are CI artifacts, not installed Windows Runtime evidence, nor signed real Adoption.** Synthetic log says `SYNTHETIC_CLOSURE_PASS` 54 checks, `real_adoption_qualified=false`, `execution_authorized=false`; offline synthetic 38 PASS `windows_host_attested=false`. Current QCP CP2 unknown paths were addressed at exact HEAD; do not mislabel earlier failing CI or generic workflow text as present failures.

**Preserve, do not redo:** Previous `cb77398404edfbc223350d1c74a46323efe9fd3e` Windows built Runtime `D:\\gptdown\\MCFT-CAP09-RUNTIME-cb773984` independently inventoried **20,884** files, material digest `e30462f98a6538b136cd8697493df3a390f84befcc35c015857a3dab9123adeb`, signed Adoption and offline check PASS *only for that earlier version*; prior signature expired at `2026-10-15T06:02:41.933Z`. Do **NOT** rerun old installs, three workspace builds, 12-Junction conversion, 11,944 hardlink copies, or old QCP. Do **NOT** reuse old signed proof/profile/20,884-file digest for new SHA. The previous Runtime must remain unchanged as reference; any new runtime must live in a separate write-once/version-specific root.

**Next exact work sequence (incremental adoption):** (1) On candidate dabb8a24, retrieve exact QCP and release-material-binding GitHub artifacts and validate artifact origin, SHA, proof check dispositions, 54-check manifest, first-parent ancestry, 108 frozen paths, package bytes and hash; do not substitute synthetic fixture for real QCP. (2) Prepare NEW version-bound unsigned Adoption candidate and release binding from those **real** proofs and full dependency/manifest inventory, using existing repository official adoption tooling/contracts without bypassing QCP; record precise evidence file hashes. This has **not yet been completed** in this checkpoint. (3) Stage the new candidate as a separate `D:\\gptdown\\MCFT-CAP09-RUNTIME-dabb8a24` Windows root; build/migrate only necessary new-version artifacts as required by *actual* entry dependencies; use verified previous material as read-only input only when bytes exactly match and file identity is independent; do not copy old signatures. No automatic assumption that 20,884 file count repeats. (4) On actual Windows host, ensure physical files only (no Junction/symlink/multi-link), build outputs, declared host tools, Python/Powershell/Node hashes and allowed environment. Run authoritative `scripts/cap09_adoption_v1/installed-material.cjs --root <new-root> --python <full-python-exe> --powershell <full-powershell-exe> --output <new-nonexistent-outside-root-json>`; must yield `INSTALLED_MATERIAL_COLLECTED_AND_SELF_VERIFIED` and newly computed digest/count. These are *host commands*, not performed by GitHub connector. (5) Independently controlled Windows-only Adoption private key, **distinct from retry-permit key**, and pre-registered unrevoked ADOPTION issuer required. Run `node scripts/cap09_adoption_v1/signer.cjs formal-adoption <new-adoption-candidate.json> <new-installed-material.json> <new-runtime-root> <adoption-private.pem> <fresh-ttl-minutes> <new-write-once-proof.json>`; check true issuer/key/policy validity at signing, exact SHA and QCP proof hash, then separately run official `offline-context.cjs.load` read-only verification with exact signed environment. Passing signature must bind NEW installed root/digest and exact subject; do not add transient verification environment variable names (earlier `UNDECLARED_ENVIRONMENT_VARIABLE` failure), pass paths via argv. Capture stdout, IDs, hashes, expiration, path, Windows host identity, and distinct independent signer authorization as receipts. Keep private keys off repo and out of handoff.

**Actual blockers / permissions:** GitHub CI is GREEN. No Windows new-version Runtime installation/profile, real incremental Adoption candidate, independent fresh signature or offline readback has been observed. GitHub connector cannot invoke Windows host tools or possess its private signer keys. Independent key *custody/organizational control* requires accountable authorization, not just differing key IDs. Two issuers in static trust do not enable execution: `adopted=false`, `execution_enabled=false`. **EXECUTE_HOLD + PRODUCTION_HOLD**; no fresh Run ID DB/MinIO, permit signing/consumption, Host execute, Provider/Producer/Timing or six-stage operations until separate Local Execution Admission after signed version qualification. PR #3298 must remain DRAFT/OPEN/UNMERGED. No third handoff file.

**New environment deployment discipline:** Separate immutable Git source/CI proof, Windows staged runtime/toolchain, independent signer/trust, and per-run isolated PostgreSQL + scoped MinIO + ACL receipt. Validate each boundary by actual hashes and low-privilege readbacks. Require independent run-specific permit, replay-resistant ledger, time windows and Host preflight before six ordered TEST_ONLY stages. For new machines, use fresh machine/tool hashes and new installed-material/adoption signature; NEVER transfer old host-specific permit, ledger, profile or passwords. Failure is fail-closed; preserve first-failure log and do not cleanup/overwrite effectful previous Run IDs. Canonical replay sequence: source exact-HEAD -> QCP and scoped release proof -> unsigned candidate -> physical Windows runtime -> installed-material inventory -> independent signature -> offline verification -> fresh run scope/ACL -> one-shot permit -> Host preflight -> six stages. Production remains separately gated.

---

# 2026-10-15 — #3704 CI systematic first-failure triage; independent issuer PASS, dedicated PG regression fixed, QCP unknown path GOVERNANCE HOLD

Actual #3704 HEAD `3ef3a63e71488314605c8c43aee3db0643a6c2ea`: independent issuer dedicated workflow `38681604071` **SUCCESS**. Failing QCP `38681604287`, post-merge-v13 `38681604277`, EA5E2 dependency `38681604165`, Formal-v5 readiness `38681604155`, local cutover `38681604241`; generic CI was in progress. Examined actual job logs. QCP generator explicitly returned `CP2_SUCCESSOR_CHAIN_CANDIDATE_UNKNOWN_PATH` and `CP2_SUCCESSOR_CHAIN_UNKNOWN_OUTSIDE_ACCEPTED_ANCHOR` on these three NEW paths: `.github/workflows/mcft-cap09-independent-retry-issuer-v1.yml`, `scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP09_INDEPENDENT_RETRY_ISSUER_PROVISION_V1.cjs`, `scripts/runtime_acceptance/MCFT_CAP09_INDEPENDENT_RETRY_ISSUER_PROVISION_V1.cjs`. These are substantive new governance surfaces NOT present in accepted chain; cannot resolve by masking unknown paths, falsifying proof, or silently declaring N/A. Need reviewed successor applicability/acceptance of changed scope and renewed exact-HEAD qualification; this is a REAL gate blocking adoption.

Local cutover exact run log: `ACCEPTANCE_MCFT_CAP09_DEDICATED_PG_ENDPOINT_V1.cjs:38` expected trust issuers count 1 but now valid registry has 2; committed precise update `348e31a86b5fcbb488c3afb59210dedd6fb28a8b` preserving disabled trust and adding independent issuer role/identity/fingerprint. No evidence new HEAD CI has passed after that commit.

No runtime or frozen cb773984 changes, no re-running old QCP, no production start, no new run-scoped resources, permit or six-stage. EXECUTE_HOLD. Next: establish governed adoption/applicability path for exactly three new files rather than weakening CP2; check new CI and remaining failures and proceed incrementally.

---

# 2026-10-15 — #3704 new HEAD CI investigated: independent issuer test failure fixed; incremental qualification pending

User ordered CI + incremental qualification for new public trust registration before new immutable signed Runtime. Checked PR #3704 `da9ddf0ea413795e89179c405ce49a5a30553d95`: dedicated `MCFT CAP-09 independent retry issuer v1` workflow run `38681322999` FAILED on both Windows and Ubuntu; exact logs showed NEW independent issuer negative suite **PASS 12**, but preexisting `ACCEPTANCE_MCFT_CAP09_RETRY_PERMIT_V1.cjs` asserted `disabled.issuers.length===1` at line 65, now legitimately 2 after public registration. Existing post-merge-v13-control-plane, local-cutover-candidate and EA5E2 dependency graph were also failed, and general `ci` / QCP still in progress on that HEAD; DO NOT claim PR globally green.

Minimal isolated regression fix committed #3704 `3ef3a63e71488314605c8c43aee3db0643a6c2ea`: update old retry permit synthetic acceptance from one issuer to two and verify registered independent issuer ID/key/role/nonrevocation/independent operator and SPKI SHA256, while preserving original operator assertions, `adopted=false`, `execution_enabled=false`, other production controls. New HEAD CI results not yet known. Do not modify baseline trust to bypass tests. New code SHA changes adoption subject; old cb773984 full installed 20,884-file PASS evidence retained only as previous version; new incremental qualification + new immutable Runtime material/signature pending.

No independent retry private key shared, no real permit signed/consumed, no run-specific DB/MinIO created and no Producer/Timing/production action. EXECUTE_HOLD/PRODUCTION_HOLD. Next inspect newly launched dedicated CI and true first failures of remaining checks; don't start source requalification or Windows mutation before precise accepted commit and governance verdict.

---

# 2026-10-15 — #3704 PUBLIC independent retry issuer registered; trust remains disabled; CI pending

Actual Windows offline independent retry issuer provisioning operator stdout: `INDEPENDENT_RETRY_ISSUER_PROVISION=PASS`, public registration `D:\gptdown\MCFT-CAP09-INDEPENDENT-RETRY-KEY-20261015\retry-public-registration.json`, private key `retry-private.pem` retained on Windows (private bytes NEVER received, shared, or committed); `issuer_id=mcft_cap09_independent_retry_governance`, `key_id=cap09_retry_ed25519_20261015`, `not_before=2026-10-15T04:17:21.950Z`, `not_after=2026-11-14T04:22:22.010Z`, Ed25519 public SPKI SHA256 `ef7459a5918e35c90913532a7c8af545fbca4fec0b7dc95916797db3303fa870`. Public PEM base64 DER independently SHA256-confirmed.

Committed to PR #3704 on branch `fix/mcft-cap09-disabled-retry-historical-inheritance-20261013`: commit `65a1b1a505b8641af30d11e235610129c547dafd` added real public registration to `scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json`, preserving `adopted=false`, `execution_enabled=false`, old operator registration, now 2 issuers/1 independent. Commit `da9ddf0ea413795e89179c405ce49a5a30553d95` added static-disabled-trust/independent public fingerprint and id negative assertions to synthetic acceptance. Earlier dedicated workflow at `dbfcfd612` was completed/success; **new HEAD CI has NOT yet been observed PASS**, no incremental/new-version Adoption, no one-shot signed permit or local admission.

**Non-bypass gate:** a separate key ID/private file does not prove independent human/organizational custody; independently accountable owner approval remains necessary. Do not claim real TEST_ONLY execution authorized, do not inject trust mutations into already signed `cb773984` Runtime or reuse its 20884-file Adoption proof for new HEAD. Next: inspect new HEAD workflow and any failing checks, confirm/establish independent key custody, then incremental qualification + exact new immutable material/signature, new run-scoped PG/MinIO evidence, one-shot permit, Host preflight, six-stage TEST_ONLY. Keep EXECUTE_HOLD/PRODUCTION_HOLD.

---

# 2026-10-15 — #3704 independent retry issuer Windows+Ubuntu CI SUCCESS; real issuer ceremony now required

Checked #3704 HEAD `dbfcfd61258b0d05e0c54c1435b51b616972f9f4`: dedicated workflow `MCFT CAP-09 independent retry issuer v1`, GitHub Actions run `38680613064`, `completed/success`. This covers new offline Windows issuer provisioning candidate code, signature/expiry/run/host/digest synthetic negative tests and existing retry permit acceptance under workflow. NOT live independent issuer registration or real one-shot permit. At same exact SHA `mcft-cap-09-post-merge-v13-control-plane-v1` is `completed/failure` and various workflows still running; whole PR NOT green.

Next action is independent Windows signer-controlled ceremony using **new exact HEAD worktree** (do not modify qualified cb773984 Runtime), external fresh folder and write-once `retry-private.pem`, `retry-public-registration.json`; only PUBLIC JSON/registration fingerprint may be shared. Strict new signing key separate from Adoption; independent role must reflect real control, not merely different key ID. Before writing new static public trust entry, compare public fingerprint/schema/dates against actual registration, preserve `adopted=false`, `execution_enabled=false`, run scoped negative checks and PR CI. This produces new immutable version requiring incremental adoption. No database/minio/permit/producer/Timing operations, EXECUTE_HOLD.

---

# 2026-10-15 — #3704 independent retry issuer implementation moved to CI; real public issuer pending

At owner instruction "continue", checked #3704 branch `fix/mcft-cap09-disabled-retry-historical-inheritance-20261013`: prior new provisioning candidate commit `28fd4399`, negative tests `f0d87ed2`, and new Windows+Ubuntu matrix workflow `.github/workflows/mcft-cap09-independent-retry-issuer-v1.yml` commit `dbfcfd61258b0d05e0c54c1435b51b616972f9f4`. Workflow now explicitly invokes Node syntax checks, new independent issuer synthetic negative acceptance, and existing permit acceptance. At last check workflow for newest commit was not yet returned; tests NOT YET observed PASS. Earlier CI on predecessor f0d87ed2 had mixed success/in-progress and one post-merge-v13-control-plane failure. This is NOT an approved new immutable Runtime or independent signed permit.

Critical blocker: real independent permit issuer public registration is NOT YET collected from Windows key ceremony; no independent private key created/received by assistant, and existing `MCFT_CAP09_RETRY_TRUST_V1.json` still only lists operator issuer; `adopted=false`, `execution_enabled=false` frozen. Next obtain valid Windows-generated public registration (only public key + fingerprint and window) from separately controlled signer; review change to static public trust; CI & incremental qualification on new exact HEAD; do not touch 20884-file cb773984 runtime, QCP or existing Adoption signature. Separate private key must never be shared. No fresh run-scoped DB/MinIO provision, no one-shot permit, no six stages. EXECUTE_HOLD/PRODUCTION_HOLD.

---

# 2026-10-15 — #3704 incremental independent retry permit issuer provisioning candidate committed (UNQUALIFIED)

User approved pursuing real Local Execution Admission in this exact order: independent public retry issuer registration while static trust adopted=false/execution_enabled=false; private signing key Windows-only and separate from Adoption; negative issuer/permit tests; incremental change qualification/new immutable version; new run-scoped DB/MinIO with low-privilege ACL; signed one-shot permit and Host --preflight-only; six-stage TEST_ONLY only after all gates.

On #3704 code branch `fix/mcft-cap09-disabled-retry-historical-inheritance-20261013` two new files committed: `scripts/runtime_acceptance/MCFT_CAP09_INDEPENDENT_RETRY_ISSUER_PROVISION_V1.cjs` (commit `28fd4399b1b23c6cfc8e1ea0a30ca8af56b0d6db`), offline Windows-only Ed25519 keypair provisioning with fail-closed guardrails; writes private PKCS8 to user-selected Windows path only and public registration JSON outside repo, no permit signature, no execution activation; and `scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP09_INDEPENDENT_RETRY_ISSUER_PROVISION_V1.cjs` (commit `f0d87ed27f9801d2a7a786a73c521983b5e577d5`) synthetic negative tests for issuer/operator, expiry, repository output, replay of output, wrong run/host/digest, signature. No static trust file changes; no real independent public registration available yet, no live private key generated by assistant, test suite and CI not yet reported PASS. User must provision **genuinely independently controlled** private key off-repo/on Windows and provide only the PUBLIC registration JSON fields to permit reviewed code registration. Do not confuse locally distinct key with independent organizational governance. Mutating #3704 source moves HEAD and invalidates old cb773984 Adoption runtime as the adopted version; carry forward previous cb773984 PASS evidence but demand incremental qualification and new material signature. Current EXECUTE_HOLD/PRODUCTION_HOLD, no local permit/DB/MinIO writes or stages.

---

# 2026-10-15 — CAP-09 moves from verified Adoption to Local Execution Admission (no reruns)

Owner instructed direct move to actual Local Execution Admission, without redoing pnpm, 12 Junction removals, 11,944 hardlink materialization, Workspace builds or QCP. Full `cb77398404edfbc223350d1c74a46323efe9fd3e` built Windows Runtime `D:\gptdown\MCFT-CAP09-RUNTIME-cb773984`, 20,884-file installed profile digest `e30462f98a6538b136cd8697493df3a390f84befcc35c015857a3dab9123adeb`, independent signed Adoption digest `480e6df39faceac35486b7e5a8fba9301140477d3f7919506cfc80b6cfdf1ff9` and offline verify `INDEPENDENT_OFFLINE_VERIFICATION=PASS`. Adoption expires `2026-10-15T06:02:41.933Z`; if expired, **only** re-sign fresh short-lived TEST_ONLY proof for unchanged material and verify. No new Runtime rebuild or QCP.

Actual source `scripts/runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs` requires separate run-specific signed `--retry-bundle`, signer issuer from `scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json`, 5-minute fresh readback, DB binding and run-scoped MinIO, approved adjudication, 6-stage plan, no reused ledger/output, and signed Adoption request via `MCFT_CAP09_ADOPTION_REQUEST`; baseline trust file has `adopted:false`, `execution_enabled:false` and operator issuer but no independent retry issuer. Signed Adoption activation is independent of one-shot permit; never mislabel a mere Adoption signature as execution admission. No permit signed/consumed, run-scoped resources created or stages executed in this checkpoint. Next: read-only live Windows admission-source/trust/resource inventory, generate fresh Run ID only after verifying non-collision, determine independent permit issuance lane without weakening code or frozen authority boundaries, provision new isolated resources and get exact fresh readback, signed one-shot permit, host preflight-only, then gated TEST_ONLY --execute. Preserve PRODUCTION_HOLD.

---

# 2026-10-15 — cb773984 full Windows Runtime independent offline Adoption verified PASS

Actual Windows PowerShell verification stdout: `status=OFFLINE_ADOPTION_VERIFIED`, `subject_sha=cb77398404edfbc223350d1c74a46323efe9fd3e`, `material_digest=e30462f98a6538b136cd8697493df3a390f84befcc35c015857a3dab9123adeb`, `expires_at=2026-10-15T06:02:41.933Z` (Beijing 14:02:41.933), `execution_authorized=true`, `production_authorized=false`, `INDEPENDENT_OFFLINE_VERIFICATION=PASS`. Verification used corrected no-extra-environment-variable invocation. This closes independent formal TEST_ONLY Adoption for fully materialized built 20884-file Runtime.

**Next mainline gate:** Local Execution Admission only: a fresh Run ID, fresh run-scoped isolated databases and MinIO permissions, independent one-use permit signer and Windows host exact material/identity/timing readback, then six-stage TEST_ONLY under existing frozen contracts and fail-closed authorization. Signed Adoption is NOT a permit or production approval. Qual expires at stated timestamp; if expired, re-sign the same unchanged material with independently held Windows key and fresh write-once output/TTL; do not rerun QCP/installs or extend old proof. Historical DB checks/old Run IDs cannot substitute new scoped admission. Keep EXECUTE_HOLD / PRODUCTION_HOLD until every live condition actually verified.

---

# 2026-10-15 — Windows independent offline verification rejected UNDECLARED_ENVIRONMENT_VARIABLE: diagnostic invocation error

Operator reran independently signed full Runtime adoption verification on Windows Node v24.19.0; `offline-context.cjs.load(...)` raised `UNDECLARED_ENVIRONMENT_VARIABLE` from `installed-material.cjs:30`. Previous assistant verification snippet mistakenly added transient process env vars `MCFT_VERIFY_MODULE`, `MCFT_VERIFY_PROOF`, `MCFT_VERIFY_ROOT` not in signed material's environment.allowed_names. THIS IS A CALLER-SIDE VERIFICATION COMMAND DEFECT, NOT EVIDENCE OF INVALID ED25519 SIGNATURE OR SOURCE FILES. `INDEPENDENT_OFFLINE_VERIFICATION_FAILED` as of this checkpoint; DO NOT CLAIM independent PASS.

Corrected verification: remove only those three transient Env entries; compare existing environment variable names against signed allowed_names before running; send offline module/proof/root as `node - "$Module" "$Proof" "$Runtime"` argv with JS stdin; no newly introduced env names. If time-window expires, perform legitimate fresh sign with existing external private key and new write-once output file; never alter TTL timestamps or skip material verifier. Formal signed TEST_ONLY Adoption still NOT equivalent to fresh Run ID/one-shot Local Admission; EXECUTE_HOLD / production HOLD.

---

# 2026-10-15 — cb773984 FULL Runtime TEST_ONLY Adoption signed; separate offline verification still pending

Actual Windows signer stdout: `SIGNED_ADOPTION_QUALIFICATION_V1_ISSUED_TEST_ONLY`, `RUNTIME_ADOPTION_SIGNING=PASS`, `qualification_id=mcft_cap09_adoption_cb77398404ed_v1`, `subject_sha=cb77398404edfbc223350d1c74a46323efe9fd3e`, independent issuer `mcft_cap09_independent_adoption_governance`, key id `cap09_adoption_ed25519_20261015`; `expires_at=2026-10-15T06:02:41.933Z` (Beijing 14:02:41.933); `adoption_digest=480e6df39faceac35486b7e5a8fba9301140477d3f7919506cfc80b6cfdf1ff9`; `material_digest=e30462f98a6538b136cd8697493df3a390f84befcc35c015857a3dab9123adeb`; signed proof `D:\gptdown\MCFT-CAP09-SIGNED-RUNTIME-ADOPTION-cb773984.json`; signer `execution_authorized=true`, `production_authorized=false`.

Critical qualifier: proof issuance succeeded with built 20,884-file Windows Runtime, but independent `offline-context.cjs.load(proof, Runtime)` as a separate execution is NOT YET observed. This signature is TEST_ONLY Adoption only, not run-scoped Local Execution Admission, one-shot permit, fresh DB/MinIO ACL readback, actual Provider/Producer/Timing, or production authorization. Verify offline signature under same environment and while unexpired before attempting Local Admission. Keep EXECUTE_HOLD until all subsequent gates are satisfied. Never upload private PEM or reuse original 6426-file profile.

---

# 2026-10-15 — cb773984 complete Windows installed Runtime material profile officially PASS

Operator actual Windows PowerShell stdout from formal `scripts/cap09_adoption_v1/installed-material.cjs` on independent Runtime `D:\gptdown\MCFT-CAP09-RUNTIME-cb773984`: `status=INSTALLED_MATERIAL_COLLECTED_AND_SELF_VERIFIED`, `profile_sha256=e30462f98a6538b136cd8697493df3a390f84befcc35c015857a3dab9123adeb`, `file_count=20884`, material profile `D:\gptdown\MCFT-CAP09-RUNTIME-MATERIAL-FINAL-cb773984.json`, `FORMAL_RUNTIME_MATERIAL=PASS`. Verifier explicitly reports `execution_authorized=false`, `production_authorized=false`. This closes filesystem/material-profile blocker: 12 Junctions and 11,944 hardlinked files had been materialized in the independent Runtime only, not signed source-only Release.

**Next immediate mainline action:** Issue a **new** independent signer `signer.cjs formal-adoption` TEST_ONLY proof with existing candidate `D:\gptdown\MCFT-CAP09-ADOPTION-CANDIDATE-cb773984\adoption-candidate.json`, THIS exact new profile and Runtime root, independent private PEM remaining solely Windows `D:\gptdown\MCFT-CAP09-ADOPTION-KEY-20261015\adoption-private.pem`, short permitted TTL and a NEW write-once output path. Before signing, ensure key/trust/policy not expired; signer validates exact source hashes, QCP evidence, tools/environment and material via `offline.verifyFormal`. Follow with `offline-context.cjs.load(proof, Runtime)` independent Windows offline verification. Never reuse original 6426-file material signature (it cannot cover built 20884-file Runtime). Only after this, plan fresh run-scoped resources, independent one-shot Local Execution Admission and six-stage TEST_ONLY. No live stage, producer, DB/MinIO write, Timing or production event yet; EXECUTE_HOLD.

---

# 2026-10-15 — Windows cb773984 Runtime hardlink materialization PASS; formal material collection next

Actual operator output on independent `D:\gptdown\MCFT-CAP09-RUNTIME-cb773984`: `FILES_TO_MATERIALIZE=11944`, `REQUIRED_COPY_BYTES=145264807`, `AVAILABLE_DISK_BYTES=66462355456`, 11k+ intermediate progress, `FINAL_FILE_COUNT=20884`, `MATERIALIZED_FILES=11944`, `REMAINING_SPECIAL_OR_MULTILINK_FILES=0`, `HARDLINK_MATERIALIZATION=PASS`. All changed files were individually copied to distinct temporary filesystem identities, SHA256 checked, then replaced in this candidate Runtime; original exact source Release and pnpm cache were not intentionally modified. Previously all 12 Workspace Junctions materialized; no remaining known links. This establishes candidate local file identity PASS, **not formal installed-material profile acceptance**.

**Immediate next:** run repository formal `scripts/cap09_adoption_v1/installed-material.cjs` from independent Runtime root with Windows Python3.12 `MCFT_PYTHON_EXECUTABLE` and PowerShell executable, output a fresh write-once material profile outside Runtime, check `INSTALLED_MATERIAL_COLLECTED_AND_SELF_VERIFIED` and actual file count/hash; DO NOT assume expected count exactly 20884 (directory scanning may include other generated files). On PASS, issue fresh time-limited independent signed TEST_ONLY Adoption for the *new installed Runtime*, independent offline verify, then independent one-shot Local Execution Admission & fresh isolated Run ID; no Producer/Timing/production attempt yet. Do not rescan old DB or rerun QCP absent change. Preserve `EXECUTE_HOLD` until actual signed admission.

---

# 2026-10-15 — cb773984 Runtime installed-material refusal narrowed to 11,944 NTFS hardlink files

Operator-reported Windows read-only Python 3.12 lstat audit on independent runtime `D:\gptdown\MCFT-CAP09-RUNTIME-cb773984`: `TOTAL_FILES=20884`, `MULTIPLE_LINK_FILES=11944`, `SPECIAL_FILES=0`, `SPECIAL_DIRECTORIES=0`, `TOTAL_FAILURES=11944`; examples in `apps/server/node_modules/nanoid/*` and `node_modules/@babel/*`, nlink values from 7 to 213. Formal `installed-material.cjs` returned `INSTALLED_MATERIAL_COLLECTION_REJECTED: MATERIAL_SPECIAL_FILE`, as its policy explicitly enforces `s.isFile() && s.nlink===1`. Prior 12 workspace Junctions were fully materialized and none remain.

**Current task:** On isolated mutable runtime ONLY, transform those 11,944 hardlinked file paths to independent physical copies while preserving file contents. Use same-directory temporary file, shutil.copy2, SHA256 before/after copy and after os.replace, verify nlink=1, disk capacity, and final full-tree counts; fail closed. No evidence yet of operator running this transformation, and no new formal material PASS. A source-only signed Adoption proof does NOT cover installed runtime. Next collect installed-material from exact Runtime, fresh sign and offline verify, then fresh Run ID / permit / six-stage TEST_ONLY. No production authority or database writes. Avoid QCP re-run and modifying original exact Release.

---

# 2026-10-15 — cb773984 Windows Runtime link-free Workspace materialization PASS; installed-material admission still pending

Operator-reported actual Windows PowerShell completion in independent, mutable TEST_ONLY candidate `D:\gptdown\MCFT-CAP09-RUNTIME-cb773984`: `PRECHECK_PASS=12`, `STAGING_PASS=12`, `REMAINING_LINKS=0`, `MATERIALIZED_WORKSPACE_PACKAGES=12`, `WORKSPACE_MATERIALIZATION=PASS`. Each of 12 internal @geox pnpm Junctions was staged as a physical workspace package directory (nested node_modules excluded) and replaced; original signed source-only `D:\gptdown\MCFT-CAP09-RELEASE-cb773984` unchanged. Preceding builds @geox/contracts, @geox/control-kernel, @geox/device-skills succeeded, three expected dist entries exist.

**Meaning:** The specific 12-Junction `MATERIAL_LINK_FORBIDDEN` blocker is addressed at the filesystem scan level. This does NOT yet constitute formal installed-material acceptance: `scripts/cap09_adoption_v1/installed-material.cjs` must now collect and self-verify all files, reject remaining hardlinks (`nlink !== 1`) / special files, tool/environment drift. Previous original Release signature and profile are NOT valid for the expanded and built Runtime. Do not reuse old qualification, don't claim one-shot permit or real stage success.

**Immediate next:** Set `MCFT_PYTHON_EXECUTABLE` to signed Windows CPython path, run formal installed-material collector against independent Runtime with NEW output path outside Runtime, capture actual exit/status/hash/file count. On PASS, issue fresh independent TEST_ONLY adoption signing for this exact material and root, then offline verify, then fresh run-scoped infra/one-shot Local Admission, six-stage ordered TEST_ONLY. On failure preserve first failure and fix only demonstrated blocker. `EXECUTE_HOLD`, `PRODUCTION_HOLD`; no QCP re-run, no DB/MinIO mutation, no main merge.

---

# 2026-10-15 — cb773984 isolated Runtime: all 3 required Workspace builds PASS; 12 internal Junctions verified

Windows-host reported test-only runtime at `D:\gptdown\MCFT-CAP09-RUNTIME-cb773984` (NOT original signed Release): 12/12 reparse Junction links found, all realpath targets within Runtime, all 12 targets have package.json; read-only audit `JUNCTION_AUDIT_EXIT_CODE=0`. Root CommonJS `require.resolve` had package export restrictions and unbuilt dist entrypoints; these were NOT evidence of dependency corruption.

Operator then ran `pnpm --filter @geox/contracts run build`, `pnpm --filter @geox/control-kernel run build`, `pnpm --filter @geox/device-skills run build` from independent Runtime. ALL THREE returned exit code 0, and paths `packages/contracts/dist/index.js`, `packages/control-kernel/dist/index.js`, `packages/device-skills/dist/packages/device-skills/src/index.js` all exist. Workspace `packages/skill-registry/src/index.ts` exists. Code source Release `D:\gptdown\MCFT-CAP09-RELEASE-cb773984` remains untouched; only independent Runtime has generated dist outputs.

Remaining admission block: `installed-material.cjs` rejects any symlink/Junction (`MATERIAL_LINK_FORBIDDEN`) and multi-linked files (`MATERIAL_SPECIAL_FILE`); **DO NOT** remove Junctions blindly or change adopted contract. Next: link-free materialization of exactly 12 runtime-internal @geox Workspace links into independent physical package directories (exclude nested node_modules to avoid cycles), validate exports/entrypoints and full file/symlink/hardlink inventory, then fresh material collection, independent fresh Adoption signature and offline verification under new time bounds. Signed old source-only Release profile/signature cannot be reused for mutated runtime. No Run ID resources, permit, six-stage, Producer or production action yet. Keep EXECUTE_HOLD, no QCP rerun.

---

# 2026-10-15 — CAP-09 cb773984 signed Adoption verified; Windows local admission dependency/Junction HOLD

**Status / source:** Operator-reported actual Windows PowerShell outputs, plus signed Adoption envelope uploaded to the engineering conversation and separately inspected; not a completed live six-stage run. PR #3704 subject `cb77398404edfbc223350d1c74a46323efe9fd3e`; THIS #3298 HANDOFF REMAINS DRAFT/OPEN/UNMERGED. No production authority, merge, formal-v5 ARM, Provider execution, PostgreSQL or MinIO write, Timing run, or one-shot permit use is established.

**Completed, preserve and DO NOT rerun absent material change:**
- Exact Git worktree `D:\gptdown\GEOX-cap09-adoption-cb773984` created at cb773984; original `D:\gptdown\GEOX-cap09-iso-execution-72dc0304a21a` unchanged except preexisting untracked Python __pycache__.
- Formal QCP artifact SHA256 `275c04eb507ffb7fe01625f7de78f2108c0b7bdf7b0b09b2f57073f5a95736d0`; unsigned candidate generated `FINAL_QCP_ADOPTION_PACKAGE_PREPARED_UNSIGNED`, 54 formal checks, 108 frozen paths, engineering PASS, five NOT_APPLICABLE; candidate `D:\gptdown\MCFT-CAP09-ADOPTION-CANDIDATE-cb773984`; release binding digest `1ff3afe7ab666fce25e0af390d16ae9ed6fcd113d1a1b56137f5f39b37874a6b`.
- V1 materializer rejected `SOURCE_RELEASE_HASH_MISMATCH: apps/web/smoke_test.ps1` due to Windows checkout byte normalization vs raw Git object; V2 script failed with Git tree delimiter parsing error; V3 read exact Git blob bytes, verified 6426/6426 before and after materializing `D:\gptdown\MCFT-CAP09-RELEASE-cb773984`, `RELEASE_EXACT_GIT_BLOB_FILES=PASS`.
- Installed material collected/self-verified for immutable source Release, 6426 files; digest `0c97fe3293d10a8c47bbcb756d94875a3dca52c251b5ce0d69a4e2f317ad17a0`; profile `D:\gptdown\MCFT-CAP09-INSTALLED-MATERIAL-cb773984.json`.
- Independent Windows signer key `cap09_adoption_ed25519_20261015`, public SPKI SHA256 `80e7897b28faf31da8973badad04a9d2e9b69f3f4cc82683dc67f0b4f3f48479`; `adopted=false` static trust and `revoked=false`. Private PEM remains Windows-only, MUST NEVER upload.
- Formal signer returned `SIGNED_ADOPTION_QUALIFICATION_V1_ISSUED_TEST_ONLY`, `SIGN_EXIT_CODE=0`, qualification ID `mcft_cap09_adoption_cb77398404ed_v1`, subject cb773984, Adoption digest `145c7f279edf0d1ae8b613f28592d727ce7d20ed1ba20b62d29bcdda61cc20b3`; signed JSON `D:\gptdown\MCFT-CAP09-SIGNED-ADOPTION-cb773984.json`. Windows independent `offline-context.cjs` verification returned `OFFLINE_ADOPTION_VERIFIED`, `OFFLINE_VERIFY_EXIT_CODE=0`. Qualification expires `2026-10-15T05:16:26.905Z` (Beijing 13:16:26.905); never extend manually, re-sign new installed material and respect expiry before Local Admission. `execution_authorized=true` on signed qualification does NOT grant one-shot Local Execution Admission; `production_authorized=false`.
- Release initially lacks node_modules/tsx/pg. Old isolated repo resolves `tsx@4.21.0` and `pg@8.18.0` through pnpm symlinks, 393 directories under .pnpm. Real development repo `C:\Users\mylr1\GEOX` HEAD `3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a`, different from qualified cb773984, but exact same pnpm lock SHA256.
- Separate candidate runtime `D:\gptdown\MCFT-CAP09-RUNTIME-cb773984` copied from exact source Release; offline `pnpm install --offline --frozen-lockfile --config.node-linker=hoisted --ignore-scripts` succeeded for 16 workspaces (405 packages, 392 reused, zero downloaded), `tsx` and `pg` Node resolution PASS. `--ignore-scripts` means native dependency functionality NOT proven. Formal installed-material scan rejected `MATERIAL_LINK_FORBIDDEN`, expected because it disallows ANY Windows symlinks/Junctions. Read-only link audit found exactly 12 Junctions, all local `@geox/*` workspace links under apps/packages node_modules; none other reported.
- A subsequent exploratory `node -e` Workspace resolution check FAILED due to PowerShell quote mangling (`require(fs)` instead of `require("fs")`), NOT evidence of runtime package defect. Use Node stdin script via PowerShell here-string piped to `node -`, not `node -e @'... '@`. Do not infer workspace resolution status from the failed command.

**Current sole blocker / next action:** Complete read-only target/realpath and module resolution audit for the twelve internal workspace Junctions with correctly piped Node stdin. Do not just delete these Junctions: Node module resolution may break. Determine safe standalone link-free installation/materialization design that preserves exact source, package resolution, frozen security policies, and new runtime material digest. Any Runtime change MUST be fully re-collected, independently re-signed with a fresh TTL, and independently offline-verified; never reuse original 6426-file material signature. Then check runtime dependencies and fresh isolated Run ID, independent signed one-shot permit, fresh ≤5-minute readback, Local Admission and sequential six-stage TEST_ONLY execution. No rerun of already-PASS QCP, existing DB/ACL inspections or historic tests absent concrete reason. Keep fail-closed `PRODUCTION HOLD`.

---

# 2026-10-14 — Windows A44 isolated offline selftest 7/7 PASS; candidate qualification evidence checkpoint; real Adoption/Admission HOLD

**Evidence scope / authority:** This is a Windows-host-reported, non-signed **candidate qualification evidence** checkpoint. The host-provided result is not independently fetched from that host in GitHub; neither this handoff nor the receipt SHA alone is a signed attestation. NO new release adoption, real signer, TEST_ONLY permit, Producer/Timing/Formal execution, merge, deploy, runtime/DB/ACL changes are authorized by this result.

**Immutable subject and source material**
- A44 subject commit: `a44b294f684027c0d1dd7a28c3735442fca736a4`.
- Source ZIP: `D:\gptdown\MCFT-CAP09-A44-ADOPTION-AND-RELEASE-V1.zip`; SHA-256 `3560EE033A6A75962675CB7A10035145AA71DEDB6EA281B1BFE4C64A20A2AE82`.
- Release source file binding `6414/6414` exact bytes PASS; dedicated untouched exact root `D:\gptdown\MCFT-CAP09-A44-EXACT-CANDIDATE-V1` previously `6414/6414` PASS.
- Release `pnpm-lock.yaml` SHA-256 `8DCC125AFAB654403A5C0BDA38221649F09374A123EFF5A4725E09ED929346EB` (a real pnpm lock exists; absence of npm `package-lock.json` does NOT mean no dependency lock).
- Actual Windows Volta Node executable: `C:\Users\mylr1\AppData\Local\Volta\tools\image\node\20.11.1\node.exe`, Node v20.11.1, SHA-256 `BC585910690318AAEBE3C57669CB83CA9D1E5791EFD63195E238F54686E6C2EC`. Volta default may differ; do not mistake `C:\Program Files\Volta\node.exe` shim for real runtime.
- Prior dependency inventory manifest V1: `D:\gptdown\MCFT-CAP09-A44-DEPENDENCY-MATERIAL-MANIFEST-CANDIDATE-V1.json`, prior inventory A44 12045 files / isolated 12038; 955 links on each side, 940 per side internal node_modules + 15 per side workspace `apps/`/`packages/`. Link *classification* alone is not installed-byte provenance. Manifest V2: `D:\gptdown\MCFT-CAP09-A44-DEPENDENCY-MATERIAL-MANIFEST-V2.json`, SHA-256 `EDEE30D05681FED254777B41AACE1D0C4BDD166663B931E048E671FC82EAA390`; source ZIP and exact candidate 6414/6414 PASS, 4 workspace file deviation records. Entry Closure V3: `D:\gptdown\MCFT-CAP09-A44-ENTRY-CLOSURE-READONLY-V3.json`, SHA-256 `C19A8642C1C126C4255B824CC6F8A688AC991A906D194381BB5935A345FA8C57`; 69 limited statically reachable sources, 10 execution/dynamic ambiguities, 0 unresolved under narrow parser, NOT a complete entry dependency graph. Root `better-sqlite3@9.6.0` exists in Judge code and lockfile; old A44 holds `better_sqlite3.node` while older isolated install lacks it; applicability to seven CAP-09 entries still UNDETERMINED.
- Old workspace deviations documented: `apps/web/smoke_test.ps1` in both old roots is CRLF-only relative to exact source; older isolated `mcft_cap09_gfs_scientific_core_v1.py` differs in bytes; older isolated `mcft_cap09_offline_retained_gfs_regression_v1.py` read failed. **Do not copy either old workspace as trusted exact source.**

**NEW isolated actual host test, 2026-10-14**
- Read-only/selftest orchestrator `D:\gptdown\MCFT-CAP09-A44-ISOLATED-SELFTEST-V1.py` was invoked with exact-root `D:\gptdown\MCFT-CAP09-A44-EXACT-CANDIDATE-V1`, independent new stage `D:\gptdown\MCFT-CAP09-A44-SELFTEST-STAGE-V1`, source ZIP above, and the real Volta Node binary. Exact candidate source check `6414/6414`, `exact_match=True`; staged source check `6414` files. Staging/installation was deliberately separated from unchanged original exact candidate; installation was local pnpm `--offline --frozen-lockfile --ignore-scripts` under a standalone test, not production admission.
- Machine receipt `D:\gptdown\MCFT-CAP09-A44-ISOLATED-SELFTEST-RESULT-V1.json`; host-computed SHA-256 **`87F19E9F276EE98AED46BFB28DC13BFBEEFF8C3D4BD6ACF808418BE8371CF667`**. This receipt is **local to Windows**; the complete bytes are not in this GitHub commit. Preserve the receipt and independent content-addressed copy before treating it as a fully materialized qualification evidence artifact.
- Seven test steps, all host-reported PASS with individual exit_code=0: `pnpm_version`, `offline_install`, `node_module_load`, `tsx_import`, `typescript_typecheck`, `gfs_scientific`, `kbs_scientific`. Summary `passed=7 failed=0 scientific_pass=true dependency_load_pass=true typecheck_pass=true verdict=AUDIT_ONLY_HOLD`. Orchestrator's intentional overall exit code **2** means audit-only/non-authorizing, NOT seven-step failure. This supplies successful isolated executable-environment and GFS/KBS selftest evidence, NOT seven real business-entry loads or no-side-effect proof for those entries.
- Fixed candidate evidence identity: `A44_WINDOWS_ISOLATED_SELFTEST_20261014_V1`; evidence locator `D:\gptdown\MCFT-CAP09-A44-ISOLATED-SELFTEST-RESULT-V1.json`; content SHA above; `subject=a44b294f...`; class `ENGINEERING_ISOLATED_NON_AUTHORIZING`; result `7/7_PASS_AUDIT_ONLY`; `trusted_host_attestation=false`, `qualified_adoption=false`, `local_admission=false`, `signable_now=false`. No claim that the output stage's complete material byte tree has been independently recaptured/pinned after pnpm installation: only the host-reported 6414 source-file stage count and listed hashes are presently shown. Need a content-bound post-install staged node_modules inventory, symlink/native closure, package integrity, and trusted collection of full receipt for any authoritative material qualification.

**Engineering state and next mandatory order**
1. Seven-entry dynamic execution boundary review (static AST plus PowerShell/child process/tsx, conditional/dynamic modules; no Producer/Timing/Formal entry execution without permits). Judge/`better-sqlite3` native applicability remains `UNDETERMINED`; any `NOT_APPLICABLE` must carry negative proof for all seven entries and branches. Complete stage-installed dependency material hashes and attest loaded module paths with isolated no-side-effect probes; do not weaken byte comparison.
2. A44 original **54/54 Adoption required checks remain BLOCKED** until original raw immutable evidence bytes, subject-scope equivalence, historic chain and each applicability verdict have independent proof. Candidate QCP run `38545964031` PASS under different subject `96810f9948856c1a2665d67f18902e24a09bbb6f` is NOT A44 adoption PASS; synthetic workflows do not authorize real use. Review by independent signer/trust authority is conditional on complete proof, not automatically authorized now. Do not rerun historic QCP every Windows task.
3. **Only after independently signed A44 Qualification**: host principal and exact binary/source/material load binding; live effective PG/MinIO ACL readback, isolated resource identity, permit scope/expiry/replay protection, and actual TEST_ONLY Admission. Non-replayable authorization is separately issued; production requires its own distinct gates.

**Hold states:** `A44_RELEASE_EXACT_BYTES=PASS`; `ISOLATED_SELFTEST=7/7_PASS_AUDIT_ONLY`; `SEVEN_ENTRY_EXECUTION_CLOSURE=UNPROVEN`; `BETTER_SQLITE3_APPLICABILITY=UNDETERMINED`; `A44_ADOPTION_54_CHECKS=BLOCKED`; `INDEPENDENT_SIGNING=NOT_ISSUED`; `LOCAL_ADMISSION=HOLD`; `TEST_ONLY=HOLD`; `PRODUCTION=HOLD`. No merge, deploy, permission or schema change performed.

---

# 2026-10-14 — A44 historical registry receipts counted and Windows read-only collector built; no claimed execution PASS

Independently re-opened exact A44 source bundle and extracted all 54 embedded check rows. Counted 133 original registry evidence references distributed across 20/54 checks (34 have none); zero entries report `original_artifact_bytes_verified=true`. Those references are registry pointers and hashes of evidence records, **not authenticated original workflow artifact payload bytes**. No original A44 check establishes legal carry-forward to same subject independently; all 54 remain BLOCKED. Read-only detailed local report `MCFT-CAP09-A44-EVIDENCE-RECHECK-V2.json` records each check and status; no endorsement of QCP candidate result as A44.

Built standalone pure-read-only Windows collector `MCFT-CAP09-A44-WINDOWS-MATERIAL-READONLY-V1.py`: accept exact A44 ZIP + already-existing clean Windows release root + new output path; compare all 6414 on-disk source files SHA-256 and size against release-material-binding.json; record selected installed dependency manifests, optional hash of pre-existing external load trace, no source mutation, no process startup, no network, no credentials. Tested on empty fixture: correctly emits 6414 MISSING and HOLD. Does **not** assert actual Node/Python binaries, OS principal, process load identity, runtime ACL or MinIO group authorization; these remain independent required proof. Not yet run on Windows; output and host material attestation PENDING. Tool and report delivered via conversation downloadable files, not merged/deployed or signed.

Strict gates preserved: `A44_ADOPTION_INCOMPLETE`, `LOCAL_ADMISSION_ELIGIBLE=false`, `TEST_ONLY_HOLD=true`, `PRODUCTION_HOLD=true`; no signer, permit, old QCP rerun, runtime or DB changes.

---

# 2026-10-14 — Independent read-only A44 54-check historical and 6414-byte release adjudication (NO ADOPTION PASS)

Recomputed direct sources locally using A44 archive `MCFT-CAP09-A44-ADOPTION-AND-RELEASE-V1(1).zip` SHA-256 `3560ee033a6a75962675cb7a10035145aa71dedb6ea281b1bfe4c64a20a2ae82`, the fourth success QCP Actions artifact ZIP `11885016966` SHA-256 `c972ae653469047365ab7135dd48a6b763399557170a2d47738cac514ad4e00a`, and original 19-item Windows evidence index for Run `800c023cf337`. Independently read A44 original embedded `adoption-evidence-manifest.json` and `release-material-binding.json`, and QCP immutable `MCFT_CAP_09_ALL_BLOCKERS_PREFLIGHT_V1_RESULT.json`.

- Historical mapping: **54/54 A44 check IDs** aligned to QCP candidate, with candidate 49 PASS / 5 NOT_APPLICABLE, while original A44 per-check `actual_conclusion=BLOCKED` for all 54. A44 historical 52 mapping is present in original archive, but its equivalence is not a signed/adopted disposition; cannot carry QCP PASS across different candidate subject SHA by inference.
- Release: independently opened every one of the exact **6414 payload files**, recomputed SHA-256 and byte length against authoritative `release-material-binding.json`: `6414/6414 VERIFIED, 0 missing, 0 mismatches`. This proves source archive byte integrity, NOT installed dependencies or true Windows loaded content.
- Original release inventory independently lists 6 unbound material classes: installed node_modules bytes, Node binary/native libraries, Python/GRIB toolchain, effective host config, host ACL/resource identity and actual module load trace. Windows evidence index has 19 mixed historical/host-reported receipts; not a substitute for contemporaneous trusted host byte collector. MinIO group effective permissions still PENDING. Existing historic evidence need not be rerun unless specified freshness, version or scope requirements.
- Independent detailed **non-signed** local JSON report saved as `MCFT-CAP09-A44-INDEPENDENT-ADJUDICATION-V1.json` (linked in the originating conversation), containing all 54 decisions/evidence locators, exact Release recompute and host gap. Not uploaded as signed authoritative proof.
- Verdict: `A44_ADOPTION_INCOMPLETE`, 54 legal carry-forward BLOCKED; `RELEASE_SOURCE_BYTES_PASS`; `INSTALLED_DEPENDENCIES_NOT_VERIFIED`; `WINDOWS_LOADED_BYTES_NOT_VERIFIED`; `LOCAL_ADMISSION_ELIGIBLE=false`, `TEST_ONLY_HOLD=true`, `PRODUCTION_HOLD=true`. No signing, permit, execution, merger, legacy QCP change or deployment.

Next actions: obtain actual independently trustworthy A44 original per-check raw receipts and exact-scope equivalence verdicts, bind installed binary/runtime dependencies and collected Windows actual-loaded byte inventory to A44 release under host/principal attestation, then independent signer review. Never claim QCP candidate success alone supplies A44 signature or Local Admission.

---

# 2026-10-14 — Actual machine-artifact-backed 54/54 A44 adoption check alignment, separate subjects, fail-closed

Downloaded actual GitHub Actions artifact ZIP `11885016966` for successful candidate QCP run `38545964031` / job `115791966308`; verified archive digest `sha256:c972ae653469047365ab7135dd48a6b763399557170a2d47738cac514ad4e00a`. The artifact has 8 raw machine members, including `MCFT_CAP_09_ALL_BLOCKERS_PREFLIGHT_V1_RESULT.json`, CP2 dependency result, current/future planners, immutable evidence resolution, First-Parent chain. From raw machine `ALL_BLOCKERS`: **55 total / 50 PASS / 5 NOT_APPLICABLE / 0 FAIL / 0 blockers** for governance candidate `96810f9948856c1a2665d67f18902e24a09bbb6f`. First-Parent result PASS with 92 hops; immutable evidence refs PASS. These are NOT per-check A44 adoption qualification for different subject `a44b294f684027c0d1dd7a28c3735442fca736a4`.

Fetched exact A44 original control-plane JSON at subject A44, blob `fbcbf8694829f4e1558bcd91def5500474e2da6c` showing **54 original checks**. On independent branch `qualification/mcft-cap09-a44-adoption-mapping-isolated-20261014`, updated `GEOX-MCFT-CAP09-A44-ADOPTION-CHECK-MAPPING-CANDIDATE-20261014-V1.json` commit `090617d22b5a26d25a99b454ddb842f2f7893172`. It binds the original **54 IDs and source definitions** to 54 machine-result locator entries: **49 candidate-QCP PASS, 5 candidate-QCP NOT_APPLICABLE**, with the additional 55th engineering candidate-only check outside the original A44 scope. Exact ID/count and dispositions static readback PASS. Machine evidence locator is artifact 11885016966, member `MCFT_CAP_09_ALL_BLOCKERS_PREFLIGHT_V1_RESULT.json`, check_id; do not treat locator as row-level cryptographic digest. Original A44 row-level raw evidence hash/equivalence NOT PROVEN; all 54 A44 adoption dispositions BLOCKED; `ADOPTION_INCOMPLETE`, pass issuance forbidden.

Created detailed locally downloadable `MCFT-CAP09-A44-ADOPTION-EVIDENCE-MANIFEST-V1.json` by independently parsing real ZIP member JSON. Contains per-check original ordinal, candidate adjudication/reason/dependency digest, CP2 decisions, immutable requalification-run refs, ZIP entry checksums, 92-hop proof metadata, scope distinctions. This local artifact is NOT itself on GitHub (only compact mapping is), is not independently signed, and does not convert QCP candidate success into A44 adoption PASS.

Do not modify original QCP workflow or trigger repeat CI. Next security-critical tasks: independently adjudicate historical equivalence/subject/revision and source raw evidence per required check, A44 exact release/dependency load binding, host identity and MinIO effective permissions; only then separate real signer authority/trust roots and Windows offline admission. `TEST_ONLY_HOLD=true`, `PRODUCTION_HOLD=true`; no issuance, merge, deploy, runtime/DB change, Producer or host start.

---

# 2026-10-14 — Fourth original QCP SUCCESS and A44 adoption mapping provenance bound, not signed

Read completed original QCP run `38545964031`, job `115791966308`: GitHub status completed, conclusion **success** on independent governance candidate `96810f9948856c1a2665d67f18902e24a09bbb6f`. Original uploaded artifact ID `11885016966`, digest `sha256:c972ae653469047365ab7135dd48a6b763399557170a2d47738cac514ad4e00a`; machine log indicates CP2 `failures=[]`. Synthetic/offline workflow run `38545964247` completed success. These prove governing candidate pipeline passes; they do **not** prove immutable A44 subject `a44b294f684027c0d1dd7a28c3735442fca736a4` qualified or signed.

Updated independent A44 55-check mapping branch `qualification/mcft-cap09-a44-adoption-mapping-isolated-20261014` with exact QCP run/job/artifact hash, explicit subject mismatch and role. Commit `d586c7fc34aa54558c1d630a92cf0e4562bb169f`. All 55 required-check entries remain `BLOCKED` until per-check real evidence provenance and applicability are independently adjudicated. No edit to old QCP workflow, no new PR, no merge, signing/trust root, permit, deployment, host execution, schema or resources. Existing `verifier.cjs` accepts `SYNTHETIC_ONLY` only; cannot be promoted to real TEST_ONLY. Windows current-host ACL/group, material and permit prerequisite remain open.

Next exact delivery: translate candidate QCP artifact check-by-check to immutable A44 historic 54-item snapshot, attach original evidence digests with scope/subject matching and separate 55th engineering check; preserve 52 historical/65 entry/108 frozen path constraints. Then independently review and authorize signer/trust management and host read-only admission without replaying history each run. `A44_ADOPTION=BLOCKED; LOCAL_ADMISSION_ELIGIBLE=false; TEST_ONLY_HOLD=true; PRODUCTION_HOLD=true`.

---

# 2026-10-14 — Stop legacy QCP edits; independent A44 check mapping materialized

User confirms architecture sequence: freeze old QCP workflow editing; read fourth run 38545964031 and preserve its evidence; map legacy checks to A44 adoption qualification separately from Windows offline Local Admission; no real signer/permit until evidence-backed adoption and host authorization.

As of most recent GitHub readback, fourth original QCP run `38545964031` still IN_PROGRESS; fourth adoption/offline synthetic workflow `38545964247` COMPLETED/SUCCESS. No claim of original QCP overall PASS. Created separate standalone branch `qualification/mcft-cap09-a44-adoption-mapping-isolated-20261014` at commit `96810f9948856c1a2665d67f18902e24a09bbb6f`, with **no PR and no native QCP trigger**. Materialized file `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-A44-ADOPTION-CHECK-MAPPING-CANDIDATE-20261014-V1.json`, commit `edef55831f5e5c1f5cbf9bb45939391b86ab722b`. It enumerates the then-current candidate control plane's **55** full check IDs with owner, generation, applicability, authority_refs, resolver_ids, carry-forward policy, diagnostics, ordered provenance and source Git blob `347609bb8220e9128c1de06811f27888d017de70`. Note the **original A44 snapshot listed 54 QCP checks**, so the additional engineering check is candidate-only and cannot be claimed as A44 historic check success. All 55 entries have `BLOCKED` and no invented raw evidence digest; `ADOPTION_INCOMPLETE`, `overall_pass_issuance_allowed=false`; this is an evidence mapping candidate, NOT proof or signable adoption.

Read original `scripts/cap09_adoption_v1/verifier.cjs` and signer; their existing qualification format restricts `valid_for` to `SYNTHETIC_ONLY`, so success of synthetic workflow does not authorize a real trust root, adoption signature or TEST_ONLY. Real Windows host collector, ACL/MinIO group closure, frozen package material binding and separately authorized permit workflow are still prerequisites; no live verification result is claimed. No signing keys, trust registry, nonce, permissions, deployment, live host, schema, Producer or runtime touched.

New scope: do not edit legacy QCP workflow again; next review fourth-run machine outcome and individually attach original immutable evidence and applicability decisions to each check, including 52 historical/65 entry/108 frozen path boundaries. Keep `A44_ADOPTION_BLOCKED; LOCAL_ADMISSION_ELIGIBLE=false; TEST_ONLY_HOLD=true; PRODUCTION_HOLD=true`.

---

# 2026-10-14 — third QCP fails from undefined child_process variable; fourth exact-scope fix submitted

Third original QCP run `38545411629`, job `115790111649` COMPLETED/FAILURE. The final CP2 `failures=[]` remains positive evidence of 15-path registration, but immutable Phase2 validation crashed with `ReferenceError: cp is not defined` at generated workflow Node script line 113; previous ancestry check patch accidentally referenced an out-of-scope alias `cp`. Thus third run **DID NOT adjudicate Phase2 ancestry semantics**.

On the same independent Draft PR #3706 branch changed the unique ancestry check call to `require('node:child_process').spawnSync(...)` with otherwise unchanged guard, path resolver and historic evidence IDs. Commit `96810f9948856c1a2665d67f18902e24a09bbb6f`; single exact edit verified. New original QCP run `38545964031` and synthetic/material run `38545964247` both initially IN_PROGRESS. Machine outcomes pending. No merge, proof signing, TEST_ONLY permit, Producer, MinIO or PG changes. `A44_ADOPTION_BLOCKED / LOCAL_ADMISSION_ELIGIBLE=false / TEST_ONLY_HOLD=true / PRODUCTION_HOLD=true`.

---

# 2026-10-14 — Phase2 exact-run historical proof candidate, original QCP third run

On independent Draft PR #3706 only (not main), applied single narrow QCP workflow condition change in commit `67dee038e5b473bf05ebc51f586fe39c7deef43e`. Existing guard for immutable run `38281449457`, historical subject `9e4e8132628f2581cbac025f81f7342027660631`, workflow path and historical base `adfaf9fdbd2c75923fb298e26b5d5d106a0fc61a` remains unchanged. Original guard `boundary.adopted_main_sha === base` conflated current adopted main SHA with the historical run base; replaced only that clause with exact 40-char current adopted main SHA and `git merge-base --is-ancestor base boundary.adopted_main_sha` check. Historical run base exact equality and runtime evidence integrity checks remain. This patch is a candidate, not yet demonstrated PASS or reviewed negative-case proof.

New native existing QCP workflow triggered as run `38545411629`, initially QUEUED; existing synthetic workflow run `38545410332` initially QUEUED. Prior second-run CP2 final `failures=[]` but immutable evidence resolution failed with `PHASE2_CURRENT_MAIN_EXACT_RUN_PROOF_INVALID`; signed A44 adoption still BLOCKED. Do not merge, issue signer/permit, deploy, launch or modify runtime/DB. Local IAM group authorization remains pending. Holds: `LOCAL_ADMISSION_ELIGIBLE=false / TEST_ONLY_HOLD=true / PRODUCTION_HOLD=true`.

---

# 2026-10-14 — PR3706 second original QCP fails AFTER CP2 unknown paths close; Phase2 historical exact-run proof

Second PR #3706 candidate commit `a0903f9fd290b85ca69ed6e445677f1a4f7d5818`. Original governance QCP run `38540800723` job `115774765687` completed **FAILURE**. The machine's final CP2 section now has `failures: []` (all 15 exact candidate paths are known under current resolver). However, a later immutable-evidence resolution step exited 1 at `2026-10-14T09:16:14Z` with `Error: PHASE2_CURRENT_MAIN_EXACT_RUN_PROOF_INVALID`. Thus **CP2 path block removed**, **whole QCP not PASS**, do not sign/adopt.

Read exact workflow `.github/workflows/mcft-cap-09-qualification-control-plane-v1.yml` Phase2 evidence logic: for ID `PHASE2_EVIDENCE_PROVIDER_MODULES_REQUAL_9E4E8132_DEDICATED_PG_V1`, checks run ID `38281449457`, exact workflow path, subject `9e4e8132628f2581cbac025f81f7342027660631`, historical base `adfaf9fdbd2c75923fb298e26b5d5d106a0fc61a`, and `boundary=verifyAdoptedLocalCutoverScopeDiagnostic()` from `REPLAY_MCFT_CAP09_ADOPTED_MAIN_HISTORY_FOR_CUTOVER_V1.cjs`. Conditional insists `boundary.adopted_main_sha===adfaf9...`, while diagnostic actually supplies live `git rev-parse origin/main` from caller checkout. This is potentially a mismatch between a later current-main and a specific historical run's base, even if the historical base and subject are unchanged; exact offending condition was not individually emitted, so treat as investigated hypothesis, not proven sole cause. DO NOT change evidence ID/run/subject or suppress the guard. Correct narrow remedy requires immutable anchored proof that historic `adfaf...` is the exact run associated base and a verified ancestor of the current adopted main, then test the new proof bound with explicit negative cases (wrong run, subject, base, non-ancestor). Only if confirmed modify frozen-current-main comparison in a *separate reviewed candidate*; fail closed otherwise.

Synthetic/offline workflow run `38540800755` COMPLETED SUCCESS. No signer/permit/producer/deploy/merge, original adoption remains blocked. `TEST_ONLY_HOLD=true / PRODUCTION_HOLD=true`.

---

# 2026-10-14 — PR3706 original QCP first run FAIL on six additional A44 paths; narrow follow-up committed

Native original QCP run 38539946631 / job 115771939106 on candidate 4d1f47479edb139ec1546a2de2c59825feceff81 COMPLETED/FAILURE. Actual logged CP2 failure arrays now include exactly six not-yet-registered new files: `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-ADOPTION-MATERIAL-CHECKPOINT-A44-V1.json`, `scripts/cap09_adoption_v1/MATERIAL-BINDING.md`, `scripts/cap09_adoption_v1/build_evidence.py`, `scripts/cap09_adoption_v1/evidence_review.py`, `scripts/cap09_adoption_v1/material_binding.py`, `scripts/cap09_adoption_v1/test_material_binding.py`. Both `CP2_SUCCESSOR_CHAIN_CANDIDATE_UNKNOWN_PATH` and `CP2_SUCCESSOR_CHAIN_UNKNOWN_OUTSIDE_ACCEPTED_ANCHOR` show these same six. Initial nine paths disappeared from unknown list, confirming scoped progress. The source job produced QCP artifact 11882230724 (ZIP SHA256 from log 042e690ddd94e7075883e12a71230ae030b28a8bf1191c37d7510fb027472514).

Original Adoption/offline synthetic run 38539946388 COMPLETED/SUCCESS, not an A44 real admission or adoption PASS.

Appended six exact files to original single A44 engineering-only resolver on PR3706 branch; now **15 exact paths**, unchanged check count 55, commit `a0903f9fd290b85ca69ed6e445677f1a4f7d5818`. Native pull_request update queued original QCP run `38540800723` and synthetic run `38540800755`. Outcomes not yet claimed. Did not disable/waive CP2 checks; original 54 checks retained; no merge or real execution. `A44_ADOPTION_BLOCKED; LOCAL_ADMISSION_ELIGIBLE=false; TEST_ONLY_HOLD=true; PRODUCTION_HOLD=true`.

---

# 2026-10-14 — PR #3706 original governance and synthetic Actions execution: interim job readback

GitHub PR #3706 candidate SHA 4d1f47479edb139ec1546a2de2c59825feceff81 triggered original QCP run 38539946631 (job 115771939106, applicability-and-blocker-inventory) and synthetic/materal binding run 38539946388. Actual GitHub jobs readback: synthetic-closure (ubuntu-24.04) job 115771937755 COMPLETED/SUCCESS; synthetic-closure (windows-2022) job 115771938335 COMPLETED/SUCCESS; release-material-binding (ubuntu-24.04) job 115771938261 COMPLETED/SUCCESS; release-material-binding (windows-2022) job 115771938217 IN_PROGRESS; original QCP job 115771939106 IN_PROGRESS. These are genuinely returned job states, not forecast or completed QCP. DO NOT call A44 adoption PASS; original CP2 machine verdict and ALL_BLOCKERS still unavailable. No signer, permit, merge, deployment, runtime, resource or execution actions performed. Hold unchanged.

---

# 2026-10-14 — Actual original CP2/QCP execution triggered against independent governance candidate

Opened independent **Draft PR #3706**, `qualification/mcft-cap09-cp2-a44-path-registration-20261014` into `main`; exact candidate `4d1f47479edb139ec1546a2de2c59825feceff81` (one exact-scope control-plane addition atop #3704 candidate, with 9 A44 unknown paths). Native GitHub pull_request trigger enqueued the **existing, unmodified original CP2/QCP** workflow run `38539946631` and **existing synthetic admission workflow** run `38539946388`. Both were `queued` as of readback; machine verdict NOT YET AVAILABLE. Native provider-driven live qualification workflow was `skipped`. No manual rerun of historical passed tests, no custom replacement assertions, no signing, permit, merge, deploy, Provider or Producer.

This run must NOT be promoted to adoption/admission PASS until completed job logs and machine artifacts are checked for original CP2 successor-chain, updated applicability (new 55th check), 52/65 inherited checks, 108 frozen path assertions, historical equivalence and no new first-failure. Draft PR #3706 intentionally stays open/unmerged. `A44_ADOPTION_BLOCKED / LOCAL_ADMISSION_ELIGIBLE=false / TEST_ONLY_HOLD=true / PRODUCTION_HOLD=true`.

---

# 2026-10-14 — Independent A44 CP2 governance repair candidate committed and static-reviewed; original QCP NOT RUN

Created independent branch `qualification/mcft-cap09-cp2-a44-path-registration-20261014` based on existing PR #3704 draft branch, without modifying #3704/main. Commit `4d1f47479edb139ec1546a2de2c59825feceff81` only edits `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json`. Registers exact 9 A44 paths extracted from immutable failed QCP job 115452167618 under resolver `A44_ADOPTION_LOCAL_SYNTHETIC_BOUNDARY_20261014_V1`, an `EXACT_PATH_SET` with linked required engineering-only check `A44_ADOPTION_LOCAL_SYNTHETIC_BOUNDARY_20261014_V1_ENGINEERING_ONLY`. Check stage `SUCCESSOR_SUBJECT_PRE_MERGE`; workflow `.github/workflows/mcft-cap09-adoption-local-synthetic-v1.yml`; `SYNTHETIC_ONLY_NO_EXECUTION_AUTHORIZATION`; fail-closed for unknown paths/required evidence, no historical carry forward.

**Independent static comparison PASS** against original branch: 9 unique registered paths; original 54 checks all preserved bit-for-bit at parsed JSON structure; 54 prior resolvers unchanged; all other control-plane keys unchanged; now 55 checks. All non-effects remain false: runtime mutation, production workflow activation, formal DB mutation, provider request, graduation, completion. New branch config file blob SHA `b282499ceb2f126dde27284eeb79c227f355788d`.

IMPORTANT: no QCP, original CP2, applicability, Windows CI or end-to-end validation executed; `ORIGINAL_CP2=NOT_RUN`, `ADOPTION_QUALIFICATION=BLOCKED`. This candidate may expose further failure such as check digest, applicability or historical replay. Do not sign, merge or authorize TEST_ONLY. Next: run original governing assertions on an isolated exact candidate, collect detailed machine verdict and iterate fail-closed without weakening requirements. Preserve prior A44 host validations, no unnecessary S3/PG reruns. `LOCAL_ADMISSION_ELIGIBLE=false; TEST_ONLY_HOLD=true; PRODUCTION_HOLD=true`.

---

# 2026-10-14 — CP2 exact unknown-path evidence retrieved from immutable A44 failed CI

Fetched actual job 115452167618 logs (run 38442436228, artifact 11836147376, October 13 17:56Z). Both failures `CP2_SUCCESSOR_CHAIN_CANDIDATE_UNKNOWN_PATH` and `CP2_SUCCESSOR_CHAIN_UNKNOWN_OUTSIDE_ACCEPTED_ANCHOR` contain the **same 9 paths**, not an unknown or unspecified list:

- `.github/workflows/mcft-cap09-adoption-local-synthetic-v1.yml`
- `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-ADR-ADOPTION-QUALIFICATION-LOCAL-EXECUTION-ADMISSION-V1.md`
- `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-ADOPTION-MIGRATION-INVENTORY-V1.json`
- `scripts/cap09_adoption_v1/README.md`
- `scripts/cap09_adoption_v1/acceptance.cjs`
- `scripts/cap09_adoption_v1/contract.cjs`
- `scripts/cap09_adoption_v1/signer.cjs`
- `scripts/cap09_adoption_v1/synthetic-launcher.cjs`
- `scripts/cap09_adoption_v1/verifier.cjs`

The job environment declares `MCFT_CAP09_SUCCESSOR_CHAIN_BASE_ADMITTED=true`, `MCFT_CAP09_ADMITTED_PR_BASE_SHA=cfaf55f10f2ce7e995ffeb95fe4d5675f1a893a4`, `CURRENT_MAIN_REANCHOR_PROOF_BOUND_SHA=b689938f6161d01dec06a1ce4ce6f24420c4b3a0`, stage `SUCCESSOR_SUBJECT_PRE_MERGE`. The current QCP workflow compares unknown_changed_paths with candidate `git diff chainBase...head` and excludes only properly anchored/registered paths. These 9 arise from the newly introduced adoption/offline-admission candidate; they lack corresponding accepted exact-path/dependency resolver registration for the candidate. Evidence source CI log is specific and immutable; 5 files from QCP job were uploaded to artifact 11836147376. Audit did not rerun checks.

Resolution MUST NOT change/falsify CP2 verdict. Next engineering candidate: explicitly register new nine exact paths in a scoped control-plane dependency resolver, annotate check applicability and source material, and keep immutable inheritance with #3691 historical assertion. Validate original QCP on isolated candidate BEFORE merge; if merely registering 9 paths still creates unknown control-plane paths or replays historical failures, preserve HOLD and adjudicate. A44 adoption manifest still `qcp_adoption_blocked=54` at original snapshot; later Windows release/TS/PG/MinIO checks do not override this. `TEST_ONLY_HOLD=true / PRODUCTION_HOLD=true`. Group IAM metadata still pending separate proof.

---

# 2026-10-14 — A44 adoption CP2 first concrete fail, no tests replayed

Inspected current GitHub PR #3704 draft/open/unmerged and its immutable A44 material checkpoint `GEOX-MCFT-CAP09-ADOPTION-MATERIAL-CHECKPOINT-A44-V1.json` on candidate branch. It identifies exact A44 subject `a44b294f684027c0d1dd7a28c3735442fca736a4`, release files 6414, frozen unchanged 108/108, entry checks 65, historical checks 52, but `qcp_checks=54`, `qcp_adoption_blocked=54`, `overall_pass_issuance_allowed=false`; CI run 38442436228 job 115452167618 failure codes `CP2_SUCCESSOR_CHAIN_CANDIDATE_UNKNOWN_PATH` and `CP2_SUCCESSOR_CHAIN_UNKNOWN_OUTSIDE_ACCEPTED_ANCHOR`. Checkpoint is not post-host requalification; do not equate later file/TS/minio/PG successes with adopted QCP.

Inspected current main workflow `.github/workflows/mcft-cap-09-qualification-control-plane-v1.yml`: in `MCFT_CAP09_SUCCESSOR_CHAIN_BASE_ADMITTED=true` branch, uses pinned `MCFT_CAP09_ADMITTED_PR_BASE_SHA` and `CURRENT_MAIN_REANCHOR_PROOF_BOUND_SHA`; computes `unknownChangedPaths=current.unknown_changed_paths`, intersects with `git diff --name-only chainBase...head` for candidateUnknownPaths (must empty); second error occurs when unknownChangedPaths contains anything outside accepted anchor or chainBase segment. Repair requires **actual changed path inventory and accepted-anchor proof**; never suppress assertion, set env bypass or declare unknown paths accepted without proof. Next step is extract current CI failure's exact list and which path(s) fall in candidate vs outside, check frozen applicability registry and PR provenance, then make a separately reviewed candidate if needed. No changes to CI/runtime, merge, deploy or DB were authorized.

Live MinIO V2 direct policy semantics PASS; group metadata service returns status-only object, so effective inherited/group grants PENDING. No need further S3 repeats. A44 real Adoption Qualification BLOCKED, Local Admission blocked, TEST_ONLY/PRODUCTION HOLD.

---

# 2026-10-14 — MinIO group list V2 response is status-only; no group conclusion yet

Host read-only V2 for Run 800c023cf337 observed 2026-10-14T08:53:33.018704Z: exact container ID PASS and direct policy name PASS, no S3 probes or mutation. `group_list_shape` was JSON object with sole key `status` (str), `reason_code=GROUP_LIST_SHAPE_UNRECOGNIZED`, `result=LIVE_GROUP_AUTHORIZATION_PENDING`. This DOES NOT substantiate group existence, absence or effective inherited policies. Earlier V1 and V2 tooling incorrectly assumed all successful group-list output included a `groups` array; MinIO mc JSON output can be status-only for an empty result or have differing format, requiring explicit exit/status and independent metadata confirmation. Official MinIO `mc admin group ls` and `mc admin group info` are read-only administrative queries; `mc admin user info --json` may include `memberOf` but missing field in this version is ambiguous. Next do a single minimal read-only group-list check that records success status and exact sanitized record count and, if group entries exist, membership checks without exposing users/groups. No IAM changes and do not assert zero groups from shape alone. Direct policy semantic equivalence remains PASS (2/2 statements, zero additions/deletions). A44 real Adoption Qualification remains BLOCKED; local admission and execution remain HOLD.

---

# 2026-10-14 — Live MinIO group-list scanner V1 cannot parse actual response; IAM attestation still pending

Windows actual V1 read-only admin group metadata result observed `2026-10-14T08:50:38.864892Z`, Run 800c023cf337: `container_exact_id_match=true`, `direct_policy_name_match=true`, `reason_code=GROUP_LIST_SHAPE_UNRECOGNIZED`, `failure_class=ValueError`, `result=LIVE_GROUP_AUTHORIZATION_PENDING`. This is a parser/response-shape failure, NOT evidence of no groups or extra authorization. No S3 probes, no IAM changes, `writes_or_s3_probes=false`.

Reviewed V1 script: `group_names()` recognizes only strings, arrays of strings, or specific `{status:'success',groups:[...]}` / `{groups:[...]}` / `{groupNames:[...]}` shapes; different valid MinIO CLI output may cause failure. Prepared new `MCFT-CAP09-800c-GROUP-AUTHORITY-READONLY-V2.py` for a single narrowly scoped read-only rerun which outputs only group-response structure (object key names, value types and counts; NO group names, other user IDs, access keys, credentials, or secrets), keeps fail-closed on unrecognized shape. Python compile check PASS; **Windows execution pending**. Group membership attestation NOT_VERIFIED; A44 actual adoption BLOCKED; admission and producer gates HOLD. No prior S3, PG, release, or TS validation should be rerun.

---

# 2026-10-14 — V2 live MinIO IAM semantic comparison PASS; remaining groups/adoption HOLD

Operator-host read-only evidence observed 2026-10-14T08:45:50.750636Z for Run 800c023cf337 and app principal mcft800c023cf337app. Correct running container ID matched. Live directly attached policy name mcft800c023cf337bucketonly matched; user status success. Live policy Version matched historical; normalized statements 2 versus historical 2 with zero added and zero removed, policy_semantic_match=true. Prior raw JSON object equality returned false, but normalized permission comparison succeeds. Historic policy snapshot SHA256 47b07f9e6dfbe6377fe628eb972f388c3f7cece28757afe86cc36e75530728b6. This is a PASS for the directly attached policy semantic equivalence, not proof of all effective IAM rights.

Live group-membership field absent in the management response (FIELD_ABSENT). Group memberships, other policy attachments and derived effective rights remain NOT_VERIFIED. Keep LIVE_IAM_ATTESTATION_PENDING and do not claim full IAM closure or modify IAM. Prior S3 scope checks, 13/13 historic JSON parses, and A44 artifact/release checks remain valid; no repeat needed. A44 formal Adoption Qualification is separately BLOCKED; PR 3704 is a distinct unmerged draft historical verifier candidate. No real permit, no execution authority: LOCAL_ADMISSION_ELIGIBLE=false; TEST_ONLY_HOLD=true; PRODUCTION_HOLD=true.

Next: obtain trusted read-only group membership and additional authorization evidence for exact principal, then independently adjudicate real A44 Adoption Qualification against source evidence. Do not run old S3 tests or change production.

---

# 2026-10-14 — Actual scoped 800c live IAM admin metadata read: direct attachment PASS, policy direct-object mismatch, groups absent

Operator ran V1 read-only live MinIO IAM inspector on running pinned container (observed `2026-10-14T08:43:52.379497Z`): `container_exact_id_match=true`; `live_direct_policy_exact_match=true`, `live_direct_policy_present=true`, `live_user_status=success`; `live_policy_document_available=true` but `live_policy_document_exact_match=false`; `live_group_membership=FIELD_ABSENT`, `result=LIVE_IAM_ATTESTATION_PENDING`, `writes_or_s3_probes=false`. This proves live direct policy name attachment but DOES NOT prove equivalent policy semantics or absence of extra group authorization. Old historical policy snapshot SHA256 `47b07f9e6dfbe6377fe628eb972f388c3f7cece28757afe86cc36e75530728b6`. `FIELD_ABSENT` is not equivalent to explicitly empty groups.

V1 code inspected: document comparator is raw Python `document == historic`, which is order-sensitive for lists; mismatched documents require **semantic normalized comparison** of Effect/Action/Resource/Condition before asserting policy drift. A new conversation deliverable `MCFT-CAP09-800c-LIVE-IAM-READONLY-V2.py` was generated with syntactic verification, reuses same admin metadata-only calls and reports removed/added statements; not yet executed on Windows. Never infer V2 PASS. No policy changes or S3 probes. Local admission/adoption blocked; `LOCAL_ADMISSION_ELIGIBLE=false / TEST_ONLY_HOLD=true / PRODUCTION_HOLD=true`.

---

# 2026-10-14 — live IAM and A44 adoption prioritized, no repeat S3/QCP

GitHub current `PR #3704` verified `OPEN / DRAFT / UNMERGED` at HEAD `unknown`, PR description says Windows historical first-parent verifier and main ALL_BLOCKERS remain mandatory, explicitly no QCP PASS and execute/production HOLD. PR #3704 is a historical inheritance repair, NOT a signed A44 Adoption Qualification. No new authoritative A44 adoption PASS was identified in this review; historic A44 manifest still `ADOPTION_INCOMPLETE`.

A narrow **read-only** operator-side current MinIO IAM inspector was generated and syntax-checked in this conversation: `MCFT-CAP09-800c-LIVE-IAM-READONLY-V1.py`. It uses the existing running MinIO container's environment only for metadata reads (`mc admin user info` and `mc admin policy info`), pins the expected container ID and exact 800c app user/policy, checks full current policy JSON against the old immutable snapshot, checks user direct binding and explicitly declared group membership, outputs only redacted metadata/verdict. It does not use admin as the application identity, does not print secret, does not rerun S3, does not mutate policy or groups. If group field is absent, result stays PENDING. This script has NOT been run on the operator's Windows host, and no live MinIO attestation is claimed.

Keep 19-entry A44 evidence index as assembled only; do not conflate host PASS checks or synthetic 54/54 with actual adoption. `LIVE_IAM_ATTESTATION_PENDING`; `A44_REAL_ADOPTION_BLOCKED`; `LOCAL_ADMISSION_ELIGIBLE=false`; `TEST_ONLY_HOLD=true`; `PRODUCTION_HOLD=true`.

---

# 2026-10-14 — A44 Local Admission consolidated evidence index ASSEMBLED / admission still BLOCKED

Created standalone read-only deliverables in the conversation filesystem: `MCFT-CAP09-A44-LOCAL-ADMISSION-EVIDENCE-INDEX-V1.json` (19 entries, SHA256 `79828de6d831c6785dbca9dfc391c70d10ab670e0f5d8dd7ed8cf9ef414fe03b`), `MCFT-CAP09-A44-LOCAL-ADMISSION-DECISION-V1.md` (SHA256 `8c23e76f2b468481eefd08a6cdbb5ec8a553b789b50444f7bac0ac93e3cf6ea1`). Raw source files were mounted in this conversation: `MCFT-CAP09-A44-ADOPTION-AND-RELEASE-V1(1).zip`, `qualification-closure-v2_1-20261012T150717-80ca8deb(1).zip`, `MCFT-CAP09-800c023cf337-READONLY-AUDIT-RESULT.json`, `MCFT-CAP09-800c023cf337-QUALIFICATION-READONLY-RESULT.json`, `MCFT-CAP09-RETRY-TRUST-REVIEW.json`. The index includes content SHA256 for these supplied exact bytes and archive members; no hashes were guessed for Windows-only files.

Original A44 manifest (directly inspected inside ZIP) records subject `a44b294f684027c0d1dd7a28c3735442fca736a4`, `status=ADOPTION_INCOMPLETE`, `overall_pass_issuance_allowed=false`; blockers include `REQUIRED_CHECK_ADJUDICATION_INCOMPLETE`, `HISTORICAL_EQUIVALENCE_NOT_ADOPTED`, `ORIGINAL_ARTIFACT_BYTES_NOT_FULLY_COLLECTED`, `INSTALLED_DEPENDENCY_CONTENT_NOT_BOUND`, `WINDOWS_HOST_READBACK_PENDING`. These reflect the original manifest, NOT a newly rerun post-host adjudication. Host-reported subsequent proofs are indexed separately and not promoted to manifest closure: original release 6414/6414 bytes and 7/7 entry byte match, TypeScript 68/68 with 0 unresolved and external pg types, runtime pg module 33 files, run-scoped PostgreSQL ACL, IAM historical policy and user binding, MinIO target access/old-run denial and filtered ListBuckets. For actual Windows paths evidence SHA256 stays null until matching raw receipts supplied.

**No re-execution, MinIO/PG changes, privileged IAM actions, or permit signed.** Hard blockers: `LIVE_IAM_ATTESTATION_PENDING`; `A44_REAL_ADOPTION_QUALIFICATION_BLOCKED`; `SIGNED_ONE_TIME_PERMIT_NOT_ISSUED`. `LOCAL_ADMISSION_ELIGIBLE=false / TEST_ONLY_HOLD=true / PRODUCTION_HOLD=true`. Release index assembly is not a qualification PASS. Follow-up should bind the operator's exact host receipts and obtain independently trusted effective IAM view; do not repeat completed historic tests.

---

# 2026-10-14 — 800c MinIO JSON evidence scanner corrected: 13/13 PASS, live IAM remains pending

Actual Windows host operator readback of fixed scanner (avoiding reserved PowerShell automatic variable `$Matches` and separating parsing from field inspection) returned `JSON_PARSE_PASS=13`, `JSON_PARSE_FAIL=0`. All 13 historical JSON evidence files parsed: top-level MinIO identity ACL V3, identity commit intent, old shared audit, supplemental baseline/supplement, two closure v2 receipts, and closure v2_1 receipts/policy/user. Key fields found: `minio-identity-acl-receipt-v3.json` policy_name/principal/status; `minio-identity-commit-intent-v1.json` policy/status; `minio-user.json` policyName/status/userStatus; `minio-policy.json` policy/policyInfo; supplemental receipt inheritance/minio_identity/other_identity_probe/status. This **reverses previous 13x JSON_READ=FAILED** as a **PowerShell scanner bug**, not corrupt files. No credential contents displayed, no IAM mutation. Search did not establish current attached/group/inherited policies; absence of field matches in limited-depth inspection does not mean effective authorization lacks such policies. Preserve historical scoped S3 read PASS and old Run denial PASS, filtered ListBuckets only target. `LIVE_IAM_ATTESTATION_PENDING=true`; `LOCAL_ADMISSION_ELIGIBLE=false`; `TEST_ONLY_HOLD=true`; `PRODUCTION_HOLD=true`. Avoid repeating historic scanner / S3 tests; use independently scoped read-only effective-policy attestation only.

---

# 2026-10-14 — Windows IAM receipt scanner corrected; 13/13 JSON parse PASS

Operator on actual Windows host reran corrected read-only scanner using a safe local field-list variable instead of PowerShell automatic variable Matches. Result: JSON_PARSE_PASS=13, JSON_PARSE_FAIL=0. All historic MinIO identity, commit-intent, supplemental and qualification closure JSONs parsed successfully. Prior 13 JSON_READ=FAILED outputs were a SCANNER FALSE POSITIVE, not file corruption; do not repeat provisioning or invalidate historic evidence.

Field inventory: base minio-identity-acl-receipt-v3.json exposes policy_name,principal,status; minio-identity-commit-intent-v1.json exposes policy,status; old-shared-identity-readonly-audit-v1.json exposes status; minio-supplement baseline-receipt.json has postgres_evidence_inheritance,status; supplement-receipt.json has inheritance,minio_identity,other_identity_probe,status; two qualification-closure-v2 copies of minio-identity-acl-receipt-v3.json have policy_name,principal,status and qualification-receipt.json has status; qualification-closure-v2_1 copy of minio-identity-acl-receipt-v3.json has policy_name,principal,status; minio-policy.json has policy,policyInfo; minio-user.json has policyName,status,userStatus; qualification-receipt.json has postgres_evidence_inheritance,status. This is field-name inventory only; it does NOT establish groups or extra policy absence. Historic policy binding and digest verification remain PASS. S3 read scope: target allowed, old run denied, ListBuckets filtered only target. Current actual effective IAM attachments/group authorization remain NOT_VERIFIED.

Decision: HISTORICAL_JSON_PARSE_13_OF_13_PASS; HISTORICAL_IAM_BINDING_PASS; MINIO_SCOPED_ACCESS_PASS; LIVE_IAM_ATTESTATION_PENDING; LOCAL_ADMISSION_ELIGIBLE=FALSE; TEST_ONLY_HOLD=TRUE; PRODUCTION_HOLD=TRUE. Next inspect non-secret content/shape in existing supplement-receipt (inheritance, minio_identity, other_identity_probe) and original receipt for usable **current** attestation; no repeated S3 tests, root/admin substitution or IAM writes.

---

# 2026-10-14 — Run 800c historic IAM user-policy binding and digest verification PASS; live attestation still HOLD

Operator returned Windows-host evidence for Run `800c023cf337`: historic `minio-identity-acl-receipt-v3.json` `run_id=800c023cf337`, `status=PASS`; `minio-policy.json` identified `mcft800c023cf337bucketonly`, 2 statements, resources exactly target bucket and target object prefix (`RESOURCE_SCOPE_MATCH=True`), `s3:ListAllMyBuckets` absent (`GLOBAL_LIST_ACTION=False`); `minio-user.json` provision record `status=success`, `policyName=mcft800c023cf337bucketonly`. Original evidence digests independently checked on Windows: policy `47b07f9e6dfbe6377fe628eb972f388c3f7cece28757afe86cc36e75530728b6`; user `e38096a43a6b61c1e9de7f0a6ce0dcd583458054b2c9534413ed082e47d819a3`; ACL receipt `fa44b022e86a09b8f2558ded948f9337b7b18102e0a9ef082974636e842d1f5b`. `HISTORICAL_POLICY_REVIEW=COMPLETE` and historical binding consistent.

Actual scoped S3 on Windows from earlier: target ListObjectsV2 ALLOWED; old run ListObjectsV2 DENIED; ListBuckets success shows only target bucket (`RETURNED_BUCKET_COUNT=1`, `TARGET_VISIBLE=True`, `OLD_RUN_VISIBLE=False`, `OTHER_BUCKET_COUNT=0`). Native subprocess regression 6/6 PASS. Do **not** rerun these valid checks.

**Caveat/gate:** historical policyInfo and user provisioning record do NOT assert present-day effective IAM policy (or exclusion of group/other attached authorization); latest operator output `LIVE_EFFECTIVE_POLICY=NOT_VERIFIED`. Record as `HISTORIC_IAM_BINDING_PASS / LIVE_IAM_ATTESTATION_PENDING`, not drift closed. Live effective policy requires read-only trusted identity/policy view for exact scoped principal and service/version. No Root/Admin substitution, no IAM writes, no privileged credential requests, no S3 PUT/DELETE probes. After attestation, evaluate frozen contract and integrate A44 Local Admission evidence without conflating fixture 54 PASS with real signed admission. `LOCAL_ADMISSION_ELIGIBLE=FALSE`; `TEST_ONLY_HOLD=TRUE`; `PRODUCTION_HOLD=TRUE`.

---

# 2026-10-14 — Live ListBuckets response is filtered to 800c target only (HOST VERIFIED)

**Operator-host actual readback:** scoped 800c MinIO account invoked `ListBuckets` at `http://127.0.0.1:59000` using Python `subprocess.run(shell=False)`; `LIST_BUCKETS_EXIT=0`, `LIST_BUCKETS=ALLOWED`, `RETURNED_BUCKET_COUNT=1`, `TARGET_VISIBLE=True`, `OLD_RUN_VISIBLE=False`, `OTHER_BUCKET_COUNT=0`. Only `mcft-cap09-requal-800c023cf337` was exposed by this API response. This corrects the old harness's assumption that ANY successful ListBuckets must mean global bucket enumeration exposure. It establishes **observed filtered result**, not effective IAM attestation. Previous true `ListObjectsV2` checks: target ALLOWED (exit 0); old-run bucket DENIED (exit 254). All tested read/enum cross-run scope conditions PASS. Do not repeat these tests unless identity, policy, or container changes.

**Remains unverified:** effective IAM attachments/group/default policy under exact non-root principal, policy drift vs historic `mcft800c023cf337bucketonly` snapshot, any other S3 actions or writes/deletes (MUST NOT be tested via effects), signed real A44 Local Admission and Adoption Qualification. Do not call `MINIO_IAM_FULL_PASS` or authorize execution. Required next step is read-only review of existing identity/policy binding receipts or scoped management view with no secrets or IAM mutations. Hard gates `LOCAL_ADMISSION_ELIGIBLE=false / TEST_ONLY_HOLD=true / PRODUCTION_HOLD=true`.

**Handoff practice:** this observed correction is prepended immediately to the same second Handoff; earlier failed-harness history preserved, not erased.

---

# 2026-10-14 — Windows PowerShell Python -c quote-loss incident; ListBuckets result scope still pending

Host attempted inline here-string `python -c $Py` for S3 ListBuckets response-scope readback; Python emitted `SyntaxError: invalid decimal literal` at `run = 800c023cf337`, indicating quote characters were lost passing the Python source through Windows PowerShell argument marshalling. This is a **tooling invocation failure, NOT MinIO authorization evidence**. Avoid `python -c $Py` with quoted Python source in Windows PowerShell; write a temporary UTF-8 `.py` script with a single-quoted PowerShell here-string, execute `python $Script`, finally delete temporary script; do not write credential values to the script or log.

Previous Windows 6/6 synthetic subprocess regression PASS and live `TARGET ALLOWED`/`OLD_RUN DENIED` remain; `ListBuckets` exit 0 was seen but response visibility (target/old/other bucket counts) has NOT been collected. Scoped IAM policy snapshot does NOT list `s3:ListAllMyBuckets`; effective authorization still unresolved. No IAM change. `LOCAL_ADMISSION_ELIGIBLE=false / TEST_ONLY_HOLD=true / PRODUCTION_HOLD=true`.

---

# 2026-10-14 — MinIO ListBuckets result-scope adjudication; no IAM mutation

User requested read-only verification of exact scoped identity/attached policies and whether MinIO S3 ListBuckets returns only permitted buckets. Latest actual host: target ListObjectsV2 ALLOWED, prior Run bucket ListObjectsV2 DENIED, ListBuckets HTTP success; the specific policy snapshot `mcft800c023cf337bucketonly` allows ListBucket/GetBucketLocation/ListBucketMultipartUploads on target bucket and Get/Put/Delete/AbortMultipartUpload/ListMultipartUploadParts on its objects, **does not explicitly allow s3:ListAllMyBuckets**. Policy snapshot alone does not prove all effective user policies/groups nor the meaning of successful ListBuckets API. No admin identity used. Next diagnostic **read-only**: parse ListBuckets response under the same 800c scoped app credentials (in-memory subprocess only), report whether only target bucket, previous bucket, or other buckets are enumerated, suppress bucket names outside known expected targets; compare the original `minio-user.json`, `minio-policy.json`, receipt v3 and actual principal, avoiding secret output. No evidence of user policy attachment live drift is yet collected; do not claim full effective IAM PASS and do not modify policies/roles.

Audit gate remains `GLOBAL_LIST_SCOPE_PENDING`; `LOCAL_ADMISSION_ELIGIBLE=FALSE`; `TEST_ONLY_HOLD=TRUE`; `PRODUCTION_HOLD=TRUE`. If other buckets visible, raise least privilege finding but require binding to exact policy authority before proposing change. If only target visible, previous `GLOBAL_LIST=ALLOWED` may reflect filtered S3-compatible response; still require effective policy and issuer/bundle verification.

---

# 2026-10-14 — MinIO scoped policy document inspected; global ListBuckets discrepancy still HOLD

Read-only operator-provided `minio-policy.json` policyInfo: policy `mcft800c023cf337bucketonly`, Version `2012-10-17`, CreateDate/UpdateDate `2026-10-12T11:21:06.911Z`. First Allow statement: `s3:ListBucket`, `s3:ListBucketMultipartUploads`, `s3:GetBucketLocation` on exact `arn:aws:s3:::mcft-cap09-requal-800c023cf337`. Second Allow: `s3:AbortMultipartUpload`, `s3:DeleteObject`, `s3:GetObject`, `s3:ListMultipartUploadParts`, `s3:PutObject` on `arn:aws:s3:::mcft-cap09-requal-800c023cf337/*`. **No `s3:ListAllMyBuckets` statement and no global `*` resource in this specific policy.** Policy authorizes target-bucket WRITE/DELETE (not read-only identity); this is a policy review, NOT a write test.

Host results remain `TARGET=ALLOWED/PASS`, `OLD_RUN=DENIED/PASS`, `GLOBAL_LIST=ALLOWED/FAIL_CLOSED`. Therefore the observed global ListBuckets success is not explained by the scoped policy document alone. Check LIVE effective user identity, policy attachments/group/inherited authorization and MinIO's actual ListBuckets response semantics and server configuration using READ ONLY inspection, no access key/root secret display; do not assume historical policyInfo is current effective policy. Other old/shared audit was `READ_ONLY_EVIDENCE_COLLECTED_NOT_QUALIFIED`. Do not modify IAM without explicit approval. `LOCAL_ADMISSION_ELIGIBLE=FALSE`, `TEST_ONLY_HOLD=TRUE`, `PRODUCTION_HOLD=TRUE`.

---

# 2026-10-14 — Windows MinIO subprocess regression PASS; live GLOBAL_LIST ALLOWED (FAIL_CLOSED)

**Immediately observed on actual Windows host (Run `800c023cf337`):** `D:\gptdown\MCFT-CAP09-MINIO-NEGATIVE-REGRESSION-V1\run-windows.ps1` standalone regression all **6/6 PASS**, including exit 0, AccessDenied, InternalError, NoSuchBucket, bare HTTP 403 and timeout. `NO_POWERSHELL_NATIVE_COMMAND_ERROR`. Subsequently `run-windows.ps1 -Live` again regression 6/6 PASS; live `TARGET=ALLOWED; VERDICT=PASS; EXIT=0`, `OLD_RUN=DENIED; VERDICT=PASS; EXIT=254`, but `GLOBAL_LIST=ALLOWED; VERDICT=FAIL_CLOSED; EXIT=0`. Overall `MINIO_LIVE=FAIL_CLOSED`, `LOCAL_ADMISSION_ELIGIBLE=FALSE`; TEST_ONLY/PRODUCTION HOLD remain. Evidence at `D:\gptdown\MCFT-CAP09-800c-MINIO-READONLY-20261014T061228347Z.json`.

**Interpretation:** old Run bucket's ListObjectsV2 is explicitly denied, establishing that tested negative action; target bucket list allowed. ListBuckets success alone does not establish ability to read other bucket contents; determine whether it is an actual policy violation. Current harness presumes GLOBAL_LIST must deny, yet frozen policy applicability for ListBuckets not independently confirmed. Treat as `GLOBAL_BUCKET_ENUMERATION_POLICY_ADJUDICATION_PENDING` and **fail closed**. No IAM modification or credential rotation/provisioning without reviewed authority. Need inspect the already captured non-secret effective scoped policy and any attached/group/default policies, specifically `s3:ListAllMyBuckets`, resource `*`, identity/policy binding and whether S3-compatible server permits global list under this identity. No repeat of passed host tests; read existing JSON/policy receipt first.

Historic scoped MinIO PASS receipt SHA256 `fa44b022e86a09b8f2558ded948f9337b7b18102e0a9ef082974636e842d1f5b`, policy name `mcft800c023cf337bucketonly`, container ID `952016cb6e18295242b6ea895004ae2541470be460708147ba001521bf907c70` matched current container. Do not print secrets. This is not Adoption qualification or real signed A44 Local Admission.

**Deployment-handoff rule:** immediately prepend actual new result and discovered new blocker into the same second active Handoff (PR #3298), retaining history; freeze corrective action until policy evidence reviewed.

---

# 2026-10-14 — MinIO native subprocess negative-path regression prepared; host live check HOLD

- Preceding checkpoint records the PowerShell `NativeCommandError` defect in both negative-test attempts. New recovery package: `MCFT-CAP09-MINIO-NEGATIVE-REGRESSION-V1.zip` (conversation attachment; copy into Windows `D:\gptdown\MCFT-CAP09-MINIO-NEGATIVE-REGRESSION-V1\`; not yet checked in as executable source). `runner.py` uses Python `subprocess.run(shell=False)` with captured stdout/stderr, timeout and explicit exit code, avoiding PowerShell native stderr exceptions.
- **Actually executed in separate Linux/container development environment:** synthetic child-program regression `6/6 PASS`: exit 0 ALLOWED; nonzero AccessDenied DENIED; InternalError NOT_VERIFIED; NoSuchBucket NOT_VERIFIED; bare 403 NOT_VERIFIED; timeout NOT_VERIFIED. Python compilation PASS. This is NOT a Windows-host result and does NOT establish a live old-bucket denial.
- Windows operator runbook: first `& "D:\gptdown\MCFT-CAP09-MINIO-NEGATIVE-REGRESSION-V1\run-windows.ps1"` (only selftest). Run live `...\run-windows.ps1 -Live` **only if** selftest passes and isolated 800c scoped identity is independently confirmed. Live mode performs only ListObjectsV2(target), ListObjectsV2(old bucket), ListBuckets; records no sensitive stdout/stderr or secrets, uses ephemeral subprocess AWS env and verifies historical receipt SHA256. Do not run other permissions or root credentials. Critically, `GLOBAL_LIST=DENIED` is a probe expectation requiring comparison to adopted policy, not a guaranteed frozen requirement. Evidence output is fresh `D:\gptdown\MCFT-CAP09-800c-MINIO-READONLY-*.json`. Failure means HOLD, no changes to IAM.
- Exact references: Run=800c023cf337, endpoint=http://127.0.0.1:59000, bucket=mcft-cap09-requal-800c023cf337, old bucket=mcft-cap09-requal-72dc0304a21a, scoped IAM policy name=mcft800c023cf337bucketonly, observed MinIO container ID=952016cb6e18295242b6ea895004ae2541470be460708147ba001521bf907c70, historical receipt SHA256=fa44b022e86a09b8f2558ded948f9337b7b18102e0a9ef082974636e842d1f5b.
- **Unclosed**: Windows-host regression, actual old-bucket explicit AccessDenied, policy/identity live binding, global list policy applicability, writes/deletes via read-only policy inspection; real A44 admission signed bundle and Adoption Qualification. Preserve `LOCAL_ADMISSION_ELIGIBLE=false / TEST_ONLY_HOLD=true / PRODUCTION_HOLD=true`.
- Mandatory handoff policy: prepend every completed work item, defect/lesson and gate status change promptly to this SAME active handoff, not a third document. Never convert synthetic test success to live qualified claim.

---

# 2026-10-14 — URGENT incremental handoff: MinIO negative-test PowerShell NativeCommandError (READ FIRST)

**Append/prepend discipline:** This checkpoint is prepended to the SAME second Active Continuation Handoff on PR #3298; preserve all historical content. Never infer a PASS from a failed harness. PR Draft/Open/Unmerged. No main merge, no runtime/schema/IAM changes, no producer or permit. **TEST_ONLY_HOLD=TRUE; PRODUCTION_HOLD=TRUE; LOCAL_ADMISSION_ELIGIBLE=FALSE.**

## Observed exact host facts (Run 800c023cf337)
- A44 subject `a44b294f684027c0d1dd7a28c3735442fca736a4`; immutable extracted release `6414/6414` source byte PASS, entrypoints `7/7` PASS, static TS `68` source byte PASS / unresolved `0`; `pg@8.18.0` actually loaded `33` files; `tsx@4.21.0`, `@types/pg@8.16.0`; synthetic Admission suite `54` PASS **fixtures only**, not actual signed A44 Run admission.
- Dedicated PostgreSQL container `mcft-cap09-800c023cf337-pg-dedicated` listens `127.0.0.1:55434` (NOT old Run `55432`); positive and negative databases accessible by `qual_dedicated_admin` only with CORRECT 800c admin password. Old shell inherited `PGPORT=55432`, `PGUSER=mcftcap09requal72dc0304a21a`, `PGDATABASE=postgres` and old `PGPASSWORD`, causing a genuine `password authentication failed` on new port. Do NOT reset DB password; provisioned credential is run-scoped. Both DBs: 29 public tables; admin is SUPERUSER and must NOT be used as evidence/twin runtime identity. 800c positive/negative Evidence and Twin LOGIN roles are non-superuser, no DB/schema CREATE, no BYPASSRLS; correct DB CONNECT true, opposite DB CONNECT false; PUBLIC CONNECT false in both. Table-level Evidence 4 SELECT/3 INSERT/3 UPDATE/0 DELETE vs Twin 20/19/19/5 in both DBs; nonmatching roles may show table privilege in opposite DB but lack CONNECT. Membership to corresponding geox Evidence/Twin runtime NOLOGIN role (inherit/set true, admin false). Static ACL reviewed, not substitute for actual least-privilege login/negative attempts or byte-exact frozen ACL.
- **MinIO is SHARED SERVICE, run-scoped BUCKET**: Current `mcftcap09requal72dc0304a21a-minio-1` at `http://127.0.0.1:59000`, container ID `952016cb6e18295242b6ea895004ae2541470be460708147ba001521bf907c70`, RUNNING, ID matches historic 800c scoped-MinIO PASS receipt; do not assume container name determines authorized bucket. New bucket `mcft-cap09-requal-800c023cf337`, old bucket `mcft-cap09-requal-72dc0304a21a`, scoped policy `mcft800c023cf337bucketonly`. Historic receipt `D:\gptdown\MCFT-CAP09-NEW-ISOLATION-EVIDENCE\800c023cf337\minio-identity-acl-receipt-v3.json` SHA256 `fa44b022e86a09b8f2558ded948f9337b7b18102e0a9ef082974636e842d1f5b`, reported `status=PASS`, `execution_authorized=false`, `production_authorized=false`; policy snapshot SHA256 `47b07f9e6dfbe6377fe628eb972f388c3f7cece28757afe86cc36e75530728b6`; user snapshot SHA256 `e38096a43a6b61c1e9de7f0a6ce0dcd583458054b2c9534413ed082e47d819a3`, historic `status=success`. These are HISTORICAL claims, not a live full IAM policy PASS.
- Credential JSON `D:\gptdown\MCFT-CAP09-NEW-ISOLATION-EVIDENCE\800c023cf337\private-credentials\minio-v1\minio-app-v1.json` exists and has keys `access_key,created_at_utc,principal,run_id,secret_key`. **DO NOT print, commit, upload, or persist its contents**. No AWS CLI profiles (`aws configure list-profiles` returned none) and no `.aws/config` or `.aws/credentials` files; do not require or create profile; inject scoped credentials only transiently for test and restore environment. Windows has `aws` CLI and Docker; `mc` unavailable on host but available inside old MinIO container at `/usr/bin/mc`; no installation required.
- **Live MinIO read:** using 800c private JSON with correct `run_id` in isolated PowerShell scope: `CREDENTIAL_RUN_BINDING=PASS`, `TARGET_BUCKET=ALLOWED; VERDICT=PASS` for `ListObjectsV2` against 800c target bucket. **Old bucket and global-list negative tests not yet adjudicated.** Two successive attempts using `& aws ... 2>&1 | Out-String`, then `& aws ... 1> temp 2> temp`, BOTH stopped with PowerShell `NativeCommandError` on a native CLI **expected nonzero error path** under `$ErrorActionPreference='Stop'`. Second attempt failed at `& aws @($Test.Args)`; redirection did NOT prevent conversion of stderr into a terminating error. We did NOT capture status/response, so DO NOT label old-bucket AccessDenied PASS. This is an **acceptance-harness bug**, NOT evidence of service failure or IAM failure. Do not repeat the failed scripts or change IAM to placate harness.

## Required engineering correction (before more host tests)
1. Pretest the full negative-test runner locally with a deterministic fake native executable that writes to stdout/stderr, returns 0 / 403 / 500 and nonzero exit codes while caller uses `$ErrorActionPreference='Stop'`. Verify ALL cases produce structured `ALLOWED`, `DENIED`, `NOT_VERIFIED` without a terminating `NativeCommandError`; fail closed for 500, network errors, or missing bucket (NoSuchBucket is NOT AccessDenied). In Windows PowerShell 5.1, prefer `System.Diagnostics.ProcessStartInfo` with `UseShellExecute=false`, separate redirected stdout/stderr, process exit code, bounded timeout, and NO shell redirection/pipeline. The runner must not display sensitive stderr indiscriminately; classify exact S3 error codes, and protect credentials in a child process scope. Avoid echoing stdout/object keys.
2. Verify resource/caller authority before probes: exact 800c run ID; current MinIO container ID and endpoint; verify scoped principal against non-secret recorded identity / IAM policy and exclude root/admin. Do not assume bucket list denial is required unless exact frozen policy says so; check target ListObjectsV2 allowed, old bucket **explicit AccessDenied** not NoSuchBucket/transport failure; inspect policy for prefix and write/delete permissions **without PUT/DELETE**. Report policy drift separately.
3. Record host evidence with hashes, per-test request metadata/exit/normalized S3 error status, run ID/subject/container identity, and precise PASS/HOLD decision. Keep historical receipt and failed-run history. Existing historical PostgreSQL early `ROLE_PRIVILEGE_READBACK_MISMATCH` / `PARTIAL_OR_FAILED_STOP_NO_ROLLBACK` record is retained and must not be erased.
4. Only then integrate existing release, runtime, DB, and MinIO evidence into a **synthetic** Local Admission linkage; fixture 54 PASS is not signed real admission. Adoption Qualification still BLOCKED, TEST_ONLY and PRODUCTION HOLD.

## Permanent deployment runbook rule
**Read THIS checkpoint and resource-evidence index before writing a tool or provisioning any account.** Never repeat previously verified 6414-byte/7-entry/68-TS/33-PG setup unless exact material drift is proven. Use run-scoped secrets, never inherited legacy PG variables; freeze release source LF bytes independent of Git checkout `.gitattributes eol=crlf`; reject wrong Run resource/credential even if port open; use a single pretested Windows runner with real native nonzero negative-path regression; return original evidence path and status at each stage. Updating this Handoff is a **mandatory step at each completed work item, newly discovered defect, changed blocker, or important deployment lesson**, with prepend-only, no historical rewrite, and only verifiable statuses. Do not claim GitHub commit until returned commit SHA is verified.

---

# 2026-10-14 — A44 Windows isolated release deployment, PG/runtime closure and Run 800c DB/MinIO handoff (READ FIRST)

**Status / authority:** This checkpoint is a HOST-OBSERVED evidence handoff, not an adopted qualification, formal execution credential, or production restoration. PR #3298 remains Draft/Open/Unmerged. Do not merge, deploy, change DB schema/roles, reset credentials, run Producer/Timing, consume a real permit, or alter protected main as part of this record. **TEST_ONLY EXECUTE_HOLD / PRODUCTION HOLD** remain enforced. Current Run = `800c023cf337`. Subject = `a44b294f684027c0d1dd7a28c3735442fca736a4` (candidate release source; NOT a claim of adopted main).

## 1. What's proven and where evidence lives (Windows host, 2026-10-14)

| Layer | Host evidence / conclusion | Remaining gate |
|---|---|---|
| A44 immutable release payload | Original archive deployed independently of Git checkout to `D:\gptdown\MCFT-CAP09-A44-RELEASE-PAYLOAD-20261014T050817050Z`; `RELEASE_SOURCE_BYTES_PASS`, `6414/6414` file hashes, `7/7` entrypoints. `D:\gptdown\MCFT-CAP09-A44-DEPLOY-EVIDENCE-20261014T050817050Z\DEPLOY_VERIFY.json` | Trusted release manifest identity must be retained/verified per future deployment |
| TypeScript graph | Same evidence directory `TYPESCRIPT_RESOLUTION.json`: `STATIC_TS_RESOLUTION_PASS_ONLY`; 68 source files byte-checked; 0 unresolved; no truncation. Ten external reference records all point to `pg` type declaration `@types/pg@8.16.0/index.d.ts`, SHA256 `3fa6aece30a44b769633651b07e0a0859e8194dfbbcfe0d7cda561bc521a5d7c`; **ten import sites, not ten packages**. | TS type resolution is not runtime supply-chain attestation |
| Node PG bounded load | `PG_LOAD=PASS`, 33 loaded CJS files, `pg@8.18.0`, `tsx@4.21.0`, `@types/pg@8.16.0`; `D:\gptdown\MCFT-CAP09-PG-CLOSURE-20261014T052643927Z\MCFT_CAP09_PG_RUNTIME_CLOSURE_V1.json`. No Producer imported and no DB connection in this test. | Whole dynamic closure and signed installed-dependency integrity not established |
| Local passive binding | `D:\gptdown\MCFT-CAP09-LOCAL-BINDING-20261014T051957243Z`: module readback found three installed probe packages `tsx`, `pg`, `better-sqlite3`; native `better_sqlite3.node` SHA256 `ee3b257a2a48d9838c2d1595148fc3ae47462fef8a2c1740a81c6aa333b59725`. | `better-sqlite3` is only a probe, NOT proven mandatory for CAP-09; `@aws-sdk/client-s3` and `minio` were incorrectly hard-coded probes and unresolved; do NOT install them solely on that basis |
| Synthetic local admission | Existing `scripts/cap09_adoption_v1/acceptance.cjs`, 54 synthetic checks `PASS` with fixture only; `D:\gptdown\MCFT-CAP09-RESOURCE-ADMISSION-20261014T053357706Z\SYNTHETIC_ADMISSION.json` | `fixture_real_resource_binding=false`, real A44 signed bundle admission NOT_TESTED; adoption qualification remains invalid/blocked |
| Two dedicated PG DBs | `127.0.0.1:55434` points to Docker `mcft-cap09-800c023cf337-pg-dedicated` (`postgres:16.4-alpine`); positive `mcft_cap09_requal_800c023cf337_positive`, negative `mcft_cap09_requal_800c023cf337_negative`. Both successfully authenticated as dedicated admin and ran `BEGIN READ ONLY; SELECT current_database(), current_user, current_setting('transaction_read_only'); COMMIT;` | Dedicated admin is NOT a runtime principal; independent runtime login denial tests and detailed ACL contract proof remain |
| PG roles / isolation | `qual_dedicated_admin` is a **superuser** (all superuser/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS true), with write privileges on all 29 public tables. Four run-scoped LOGIN roles `mcft_cap09_800c023cf337_{p,n}_{evidence,twin}` are non-superusers with no CREATEDB/CREATEROLE/BYPASSRLS; matching database CONNECT allowed, opposite database denied, PUBLIC CONNECT denied both DBs; public schema CREATE denied all runtime roles. Four inherited memberships map evidence→`geox_mcft_cap09_evidence_runtime_v1`, twin→`geox_mcft_cap09_twin_runtime_v1` (`inherit_option=true`, `set_option=true`, `admin_option=false`). | 29-table permission counts per DB: Evidence SELECT4 INSERT3 UPDATE3 DELETE0; Twin SELECT20 INSERT19 UPDATE19 DELETE5. Both p/n roles have these *table* privileges in both DBs, despite opposite DB CONNECT denial—do not misclassify table-grant presence as a successful cross-DB login. Check actual login denial, routine/sequence ACL and per-table frozen contract before full PG ACL PASS |
| MinIO | Existing service `mcftcap09requal72dc0304a21a-minio-1` runs at `127.0.0.1:59000->9000/tcp`, `/data` volume; host `mc` absent, host `aws` present, and `/usr/bin/mc` exists inside MinIO container. `docker ps --filter name=mcftcap09` previously missed dedicated 800c PG because name contains `mcft-cap09`. | The MinIO container name is OLD Run `72dc0304a21a`, not proof that new Run bucket/principal/prefix are bound. New Run bucket and principal/policy must be discovered from authoritative provisioning; perform only restricted-identity stat/list and out-of-scope AccessDenied, **never root/admin or write/delete** |

## 2. Root causes — do not repeat these on next deployment

1. **Git Windows checkout changes bytes.** On A44, `scripts/runtime_acceptance/MCFT_CAP09_WINDOWS_LOCAL_QUALIFICATION_ENTRY_V1.ps1` has Git `text=set eol=crlf`; `core.autocrlf=true`. Worktree SHA256 `3c2a0f510efa3ae410f4fef5d26557cf980a41048232b50fd1e80a8189c477c9` differs from canonical LF / Release Manifest SHA256 `3b1288a000657f06ed6f90626b9e95d3cf354898c128ea318aae9f7d6f3586ae`. Git Blob `fe0332a0804f300af34e8f21ac6be94b623d27c8`. Do NOT weaken hash checks, normalize post-hoc and claim byte equality, or run execution from mutable checkout. Extract original ZIP payload bytes to clean independent directory; verify all 6414 and seven entries.
2. **Wrong source/ref.** A `--single-branch main` clone did not include A44 until explicit fetch of PR #3704 branch `fix/mcft-cap09-disabled-retry-historical-inheritance-20261013` and exact detached checkout; do not assume branch HEAD is the pinned material. `pnpm install --frozen-lockfile` was successful on separate A44 candidate checkout; do NOT run it inside immutable Release Payload.
3. **Wrong dependency inference.** Regex-based scanner emitted false unresolved paths; TS-aware pass later found 68 source files, 0 unresolved. `external_dependency_files=10` represents ten references to the SAME `pg` type declaration, not ten external modules. Two artificial probes `@aws-sdk/client-s3` and `minio` returned MODULE_NOT_FOUND because V1 tool guessed them; this does NOT justify `pnpm add`, and absent import proof they are not blockers. `require.resolve`, TS type resolution and bounded actual module load are three different evidence levels.
4. **Inherited old Run credentials.** The shell had `PGHOST=127.0.0.1`, `PGPORT=55432`, `PGUSER=mcftcap09requal72dc0304a21a`, `PGDATABASE=postgres`, and populated `PGPASSWORD` from OLD Run. Attempting `-h 127.0.0.1 -p 55434 -U qual_dedicated_admin` with inherited `PGPASSWORD` produced `FATAL: password authentication failed` despite healthy dedicated DB. Only remove the old env password **temporarily**, use the dedicated Run's already-provisioned credentials via interactive protected prompt (never post secrets), and restore shell state. Do not reset DB role passwords/recreate instances.
5. **Bad diagnostics / tool assumptions.** Old PowerShell JSON reader queried nonexistent `external_dependencies` and `external_modules` instead of `external_dependency_files`. JSON `visited_source` is not necessarily an array (`@(...).Count=1` is NOT evidence contradicting `source_bytes_pass=68`). `docker inspect --format '{{.State.Health.Status}}'` failed because dedicated PG container has no `Health` field; this is not proof of unhealthy PostgreSQL. V1 resource script collapsed underlying `PSQL_READBACK_EXCEPTION`, obscuring credential cause. Host `mc` missing despite container `/usr/bin/mc` and host `aws` available.
6. **Production/isolated contract mismatch.** Older Run `72dc0304a21a` has PG `55432`, old MinIO `59000`; older executor hard-coded `55432` and older producer enforced production raw bucket `geox-mcft-cap09-formal-raw-v1` vs isolated bucket. Do not copy old executor or switch buckets to bypass isolation. `800c` has dedicated PG `55434`; MinIO scope STILL pending.
7. **Governance separation.** Historic QCP / successor proof cannot be silently counted as a new signed adoption qualification. ADR proposes `Adoption Qualification -> signed immutable proof -> offline Local Execution Admission`; PR #3704 synthetic 54 checks PASS, but CP2 successor-chain blockers and actual adoption authority remain unresolved. Do not rerun/fix legacy QCP endlessly or reclassify a Fixture as real admission.

## 3. Repeatable READ-ONLY takeover runbook (no secrets printed, no permit used)

1. Inspect the existing checkpoint and verify the exact subject `a44b294f684027c0d1dd7a28c3735442fca736a4`, release original ZIP and trusted manifest hashes; reuse `D:\gptdown\MCFT-CAP09-A44-RELEASE-DEPLOY-V1` verified method to extract canonical raw bytes into a new separate, immutable payload directory; enforce `FILES_VERIFIED=6414/6414`, `ENTRIES_MATCH=7/7`. Reject stale or changed source and do NOT use an auto-CRLF checkout as release.
2. Run the verified TypeScript resolution tool only to establish static closure; check `source_bytes_pass=68`, `unresolved=[]`, `scanning_truncated=false`; check `external_dependency_files`, not nonexistent fields. Reuse `D:\gptdown\MCFT-CAP09-PG-RUNTIME-CLOSURE-V1` bounded test: `PG_LOAD=PASS`, `PG_LOADED_FILES=33`, `pg=8.18.0`, `tsx=4.21.0`, `@types/pg=8.16.0`. Do not import Producer, open a DB connection in load test, or guess other packages. Capture hashes/paths and fail closed if changed.
3. Inventory dedicated PG via `docker ps --format "{{.Names}}|{{.Image}}|{{.Ports}}"` (not the old name filter). Expect `mcft-cap09-800c023cf337-pg-dedicated` at `127.0.0.1:55434`. **Preflight environment scoped to Run:** if `PGPORT=55432` / old-run `PGUSER`, stop before `psql`. Use correct previously provisioned `qual_dedicated_admin` credentials securely in interactive `psql -X -h 127.0.0.1 -p 55434 -U qual_dedicated_admin -d mcft_cap09_requal_800c023cf337_positive` (and negative). Ensure old inherited `PGPASSWORD` is unset for login and subsequently restored as appropriate. SQL only inside `BEGIN READ ONLY; ... COMMIT;`.
4. Query `pg_roles`, `pg_auth_members`, `has_database_privilege(...,'CONNECT')`, `has_schema_privilege(...,'CREATE')`, per-table `has_table_privilege` and `has_database_privilege('public',oid,'CONNECT')` in BOTH DBs; verify runtime-login role separation and negative cross-DB login under actual low-privileged principals. Admin superuser readback alone is not final runtime identity PASS. Do not GRANT/REVOKE/ALTER or schema writes.
5. For MinIO begin with existing old-run service `docker inspect mcftcap09requal72dc0304a21a-minio-1` and native container client presence `docker exec mcftcap09requal72dc0304a21a-minio-1 sh -c 'command -v mc || true'`. Host `aws` is available. **DO NOT use MinIO root/admin**: first locate exact NEW Run bucket, prefix, restricted access key and policy from provisioning record; confirm distinct scope from Run `72dc0304a21a`; with that existing restricted identity do only bucket `stat/list` + unauthorized scope `list` and preserve `AccessDenied`. `NoSuchBucket`/timeout is not an ACL denial. To evaluate PUT/DELETE prohibition, read IAM policy instead of making writes.
6. Run the existing `scripts/cap09_adoption_v1/acceptance.cjs` 54-check fixture suite in non-effect mode, never as true Run credential. Bind fresh Release/Runtime/PG/MinIO readback digests in candidate evidence, require separately signed qualified A44 release and local signed/one-shot Run admission for real execution; absent authorization stay on HOLD.

### Next operational tasks / known incomplete proof

- **FIRST PRIORITY: MinIO** — resolve new Run bucket/prefix and restricted identity from original 800c provisioning without printing credentials; audit restrictive policy; prove in-scope read succeeds and out-of-scope access is explicit AccessDenied. Old container's `59000` is an endpoint lead only. Host `mc` not required if host `aws` supports the operation or container `mc` can safely use supplied NON-ADMIN principal. Do not run `mc admin` with root.
- **PG remainder** — validate actual low-privileged logins/denials and fully compare function/sequence/individual-table ACL to frozen spec; static PG CONNECT + table counts already collected and not to be repeated unnecessarily.
- **Local Admission remainder** — real signed adoption qualification is absent (`adoption_qualification_valid=false`), actual A44 signed bundle admission `NOT_TESTED`; do not turn the 54 synthetic test fixture or copied hashes into an authority.
- **Deployment productization** — replace successive disposable ZIP/manual feedback loops with one versioned Windows deploy/preflight/rollback-proof runbook and regression-tested runner: exact-commit artifact fetch, canonical byte verification, frozen package integrity, Run-scoped env/credential checks, isolated resource identity, restricted ACL readbacks, synthetic negative cases, fail-closed admission. Cache/reuse unchanged evidence. All failures must record stage, root cause, remedy, regression guard and immutable result path. No next deployment should take two days of chat-guided trial-and-error.

**Safety:** No resource writes, container restarts, database modifications, S3 PUT/DELETE, secret printing, permit issuance/consumption, real Producer, timing execution, or production cutover authorized by this checkpoint.

---

# 2026-10-13 — Run 800c scoped PG access and MinIO empty-bucket administrative readback

Windows PostgreSQL direct role evidence shows four p/n evidence/twin LOGIN principals are non-superusers, granted the matching NOLOGIN runtime roles without admin_option, and effective CONNECT allowed only on own positive/negative database; public schema CREATE denied. Administrator qual_dedicated_admin remains superuser; neither role names nor administrative readbacks prove independent restricted-user login tests. MinIO root-based readback for mcft-cap09-requal-800c023cf337 succeeded: bucket exists, Usage objectsCount=0, versionsCount=0, deleteMarkersCount=0, size=0; recursive current object/version and incomplete multipart listings emitted no items and returned success. Native S3 truncation metadata and scoped Run-specific negative-access evidence remain outstanding. Verdict PG_EFFECTIVE_CONNECT_ACL_PASS; MINIO_ADMIN_EMPTY_BUCKET_READBACK_PASS; full resource requalification PENDING. No grant edits, no permit consumed, TEST_ONLY EXECUTE_HOLD and production HOLD.

---

# 2026-10-13 — Run 800c PostgreSQL dual-schema, exact zero-row proof; admin is superuser

Windows operator returned authenticated SQL via Docker Secret / POSTGRES_USER=qual_dedicated_admin. Both isolated databases mcft_cap09_requal_800c023cf337_positive and _negative each have 29 public base tables, 2 public routines and all 29 exact table COUNT(*) results zero. Existing role-table grant inventory shows separated evidence/twin runtime grants. Critically qual_dedicated_admin is PostgreSQL superuser (rolsuper/rolcreatedb/rolcreaterole/rolreplication/rolbypassrls all true), and has all major table privileges; this is a dedicated instance administrator, not least-privilege audit principal. Do not conflate with runtime least-privilege roles. Further review must verify actual runtime role flags/connect grants and MinIO bucket versions, delete markers, multipart and scoped identity. No DB writes, no permit consumed. This is PG_DUAL_DB_SCHEMA_ZERO_ROWS_PASS, not full resource qualification; TEST_ONLY EXECUTE_HOLD and production HOLD.

---

# 2026-10-13 — Windows post-merge exact-main, permit, signer, ledger readback PASSED

Operator-provided 220-line Windows transcript: fetched protected main cfaf55f10f2ce7e995ffeb95fe4d5675f1a893a4; clean detached worktree D:\gptdown\GEOX-cap09-authority-main-cfaf55f verified. Local synthetic permit test PASS tests=38, four concurrent consumers only one winner, execute_authorized=false. Dedicated PostgreSQL endpoint regression PASS checks=29 port=55434. Isolated admission bridge PASS negative_and_boundary_test_count=35, execute_authorized=false, authority_adopted=false, production_runtime_unchanged=true. Node.js fresh challenge verified local private key against registered public key in main; fingerprint matched 223c806e89c4e6df5e91a089e0b22e5cef05934d42ee7df817faaeaa67553365, host LAPTOP-STN2A2P1, operator mcft_cap09_operator_mylr1; trust adopted=false, execution_enabled=false. Private key effective ACL and ledger icacls only SYSTEM/current operator; official ledger confirmed empty, no live permit consumed. Judgments: WINDOWS_POST_MERGE_REGRESSION_PASS, WINDOWS_SIGNER_TRUST_CONSISTENCY_PASS, WINDOWS_LEDGER_STATIC_PASS. The static ledger check and prior scratch persistence test do not prove live ledger consumption/power-loss recovery. Next: separately adjudicate fresh Run 800c resources and controlled execution authorization. Five-minute readback only when immediate execution intended. TEST_ONLY EXECUTE_HOLD; production HOLD.

---

# 2026-10-13 — PR 3703 adopted public identity registration, execution remains disabled

User authorized merge of PR #3703. Candidate head d0918644f0961129dea342ae68fffc1ab679036f had eight workflow conclusions SUCCESS. GitHub temporarily rejected standard merge for two in-progress required checks; subsequent standard merge was accepted, result cfaf55f10f2ce7e995ffeb95fe4d5675f1a893a4. Comparison confirms protected main identical to merge SHA. Main trust registry now has one accountable single-operator Ed25519 public issuer with SPKI SHA256 223c806e89c4e6df5e91a089e0b22e5cef05934d42ee7df817faaeaa67553365, host LAPTOP-STN2A2P1, operator mcft_cap09_operator_mylr1 and fixed Windows ledger path. adopted=false, execution_enabled=false; all four stage/delay adoption flags false. Public registry adopted as code only; no live permit, no nonce/run consumption, no Producer or production activation. Future operations must re-check exact main and Windows evidence; fresh five-minute readback only immediately before permit issuance. TEST_ONLY EXECUTE_HOLD and production HOLD.

---

# 2026-10-13 — Disabled Windows signer registration candidate, PR #3703

Uploaded public trust JSON independently decoded; Ed25519 SPKI digest matches 223c806e89c4e6df5e91a089e0b22e5cef05934d42ee7df817faaeaa67553365. A Draft PR #3703 registers Windows hostname/operator and fixed ledger path with adopted=false, execution_enabled=false and all capability flags false. It also updates permit and dedicated endpoint registry assertions. Head d0918644f0961129dea342ae68fffc1ab679036f. All eight workflows are currently queued/in progress, not yet PASS. No private key committed; no merge or execution authorization. TEST_ONLY EXECUTE_HOLD and production HOLD.

---

# 2026-10-13 — Windows scratch-ledger persistence and replay test PASS

Operator's Windows local transcript confirms isolated scratch test directory writing a synthetic nonce receipt (LEDGER_WRITE_PASS), reopening it from a separate Node.js process (LEDGER_PERSISTENCE_PASS), rejecting repeat nonce directory mkdir with EEXIST (LEDGER_REPLAY_REJECTED_PASS), and checking official ledger D:\gptdown\MCFT-CAP09-AUTHORITY-LEDGER remained empty (REAL_LEDGER_UNTOUCHED_PASS). Prior Windows synthetic signed-permit regression 38 tests PASS with exactly one concurrent winner and only fake identities; real Ed25519 public-key fingerprint independently read as 223c806e89c4e6df5e91a089e0b22e5cef05934d42ee7df817faaeaa67553365. Windows key-file effective ACL readback shows only SYSTEM and current operator via inheritance from protected parent. This validates scratch persistence and EEXIST, not real consumption, power-loss recovery, identity trust adoption, or unauthorized Windows user attack. Next stage: prepare public-only issuer/trust candidate with accurate identity and bounded validity; retain adopted=false, execution_enabled=false; do not sign or consume live permit. Five-minute live resource readback only immediately before execution. TEST_ONLY EXECUTE_HOLD; production HOLD.

---

# 2026-10-13 — Windows exact-main and synthetic permit regression PASS (Run 800c)

Operator Windows PowerShell readback: origin/main and clean detached worktree D:\gptdown\GEOX-cap09-authority-main-28ebb997 both exactly 28ebb9971a95903ae13a33243847723cf03828d0. Earlier original isolated worktree remains at 3857b91b with untracked Python __pycache__; preserved, not cleaned or reset. On clean main, node ACCEPTANCE_MCFT_CAP09_RETRY_PERMIT_V1.cjs completed status PASS tests=38, concurrent_consumers=4, successful_consumers=1, synthetic_only=true, execute_authorized=false. Real ledger D:\gptdown\MCFT-CAP09-AUTHORITY-LEDGER still empty; earlier icacls showed only SYSTEM and current operator full control with inheritance removed. No live permit consumed. Classify WINDOWS_EXACT_MAIN_AND_SYNTHETIC_PERMIT_REGRESSION_PASS; do NOT classify real ledger persistence/replay/ACL operational qualification PASS until separately exercised safely. Real operator signing key registration, host trust enrollment, ledger operational witness and fresh pre-execution resource readback remain open. TEST_ONLY EXECUTE_HOLD and production HOLD maintained.

---

# 2026-10-13 — PR #3702 merged after required-check gate released; main exact readback

Following project owner's explicit approval to merge PR #3702, initial merge attempt was refused as 2 of 8 required checks in progress. Rechecked 8 known PR-head GitHub Actions workflows: all completed SUCCESS. Retried standard merge without bypass; GitHub accepted merge commit 28ebb9971a95903ae13a33243847723cf03828d0. Subsequent compare of this SHA with protected main reports identical, ahead=0, behind=0. The main permit source includes ACCOUNTABLE_SINGLE_OPERATOR. Exact independent names and individual terminal state of the previously blocked two required contexts were not returned by available status API; successful protected branch merge confirms rule acceptance, not their detailed logs. Main trust registry remains adopted=false, execution_enabled=false, issuers=[], host_id/operator_id/ledger_root=null, all four capability flags false. No permit, host ledger operation, MinIO/DB write, producer start or production activation. TEST_ONLY EXECUTE_HOLD and production HOLD continue. Next: authenticated Windows host/operator registration, protected key and fixed ledger, non-consuming ledger test, then fresh resource readback immediately prior to signing/operational authorization.

---

# 2026-10-13 — PR 3702 adoption-path audit: legacy six-hour policy not in live host execution

Reviewed actual candidate branch call sites. MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs imports and invokes admitProposedRetry from MCFT_CAP09_ISOLATED_RETRY_ADMISSION_BRIDGE_V1.cjs and cryptographic permit/consumption API. The bridge calls evidence-driven assessIsolatedReadiness, without fixed six-hour lead. Legacy MCFT_CAP_09_ISOLATED_RETRY_AUTHORITY_POLICY_V1.cjs assessActivationProposal still asserts STRICT_SIX_HOUR_LEAD_REQUIRED but is called only by its synthetic acceptance tests in tracked GitHub search; bridge imports merely ANCHORS from that module. Thus legacy six-hour condition is NOT a live host gate in reviewed code. No need to change fixed time as prerequisite to PR3702 review. Keep legacy historic policy candidate separate, do not conflate with current host execution. All PR3702 workflows SUCCESS; exact Windows/Ubuntu signed synthetic nonce and staged denial tests PASS. Candidate remains unmerged and trust registry disabled. Operational issuer public key/fingerprint/validity, host/operator identity and ledger, run-scoped fresh resources/ARM/plan need distinct review and adoption. TEST_ONLY_EXECUTE_HOLD, production HOLD.

---

# 2026-10-13 — PR 3702 CI execution logs and security contract review

Read actual GitHub Actions logs for PR candidate head 498ac5b33f22c6b3df1080f6903ce030e632ab0a. Both Ubuntu and Windows permit-and-process jobs executed ACCEPTANCE_MCFT_CAP09_RETRY_PERMIT_V1.cjs; tests=38 PASS, 4 concurrent consumers, exactly 1 winner, synthetic_only true. Ubuntu isolated-clock-candidate job executed ACCEPTANCE_MCFT_CAP09_ISOLATED_RETRY_ADMISSION_BRIDGE_V1.cjs, 35 boundary tests PASS, and dedicated PostgreSQL exact endpoint regression 25 checks PASS with port 55434. CI actual runner/child guard PASS; retry stages and signed permit tests report no Provider calls, non-replay, fail-stop and immutable receipt checks. Existing non-dedicated synthetic Run contract continued to pass. Main CI and all 8 PR-head workflows completed SUCCESS. Read-only review caveat: historical authority policy still contains strict >6 hour lead, not modified by this PR, and 5-minute resource freshness and actual Windows operator permit issuance/ledger have not been qualified. Synthetic CI PASS is not production or live TEST_ONLY authority. Draft PR #3702 remains unmerged, trust flags disabled, no adopted issuer, TEST_ONLY EXECUTE_HOLD.

---

# 2026-10-13 — PR 3702 exact-head CI 8/8 SUCCESS; adoption review pending

GitHub Actions readback for candidate head 498ac5b33f22c6b3df1080f6903ce030e632ab0a confirmed eight workflows completed with conclusion success: ci, CAP09 current baseline entry engineering, local cutover candidate checks, main ruleset readiness, candidate declaration selftest, EA5E2 dependency graph, release lane, delivery policy. Candidate test files inspected on its branch contain single-operator and dedicated-run negative-case additions. This is CI success, not independent operational adoption or evidence that every newly added test was invoked by CI; detailed job-step and regression coverage adjudication remains open. PR #3702 stays draft/unmerged; runtime trust unchanged and TEST_ONLY EXECUTE_HOLD and production HOLD remain.

---

# 2026-10-13 — Single-operator governance implementation candidate under CI (not adopted)

Draft PR #3702 created from protected main, branch fix/mcft-cap09-single-operator-dedicated-audit-20261013, head 498ac5b33f22c6b3df1080f6903ce030e632ab0a. Candidate revises cryptographic permit issuer role check to accept explicitly enrolled ACCOUNTABLE_SINGLE_OPERATOR in addition to the original independent role; independent-role same-person rejection retained. Adds signed synthetic same-operator and invalid-role tests. Updates both admission bridge and historical activation-proposal policy to strictly bind Run 800c023cf337 to 127.0.0.1:55434 and qual_dedicated_admin, retaining prior contract for other run IDs. Adds dedicated audit username, port, wrong positive database and bucket denial tests. Trust registry, operational issuer enrollment and actual executable authorization not touched. Initial PR-head workflows are queued/in_progress, not passed; full CI and security review pending. No merge, deploy, host permit consumption, Producer or database writes. TEST_ONLY_EXECUTE_HOLD; production HOLD.

---

# 2026-10-13 — Governance direction: do not require a second human signer for isolated TEST_ONLY

Project owner explicitly rejects the proposed independent second-person approval role as unnecessary for the present small-team R&D workflow. Recommended governance redesign: single accountable operator plus independently enforced programmatic gates and one-use signed execution capability, with exact protected-main/run/host/plan/ARM binding; authentication, resource isolation, fresh readback, strict nonce/run consumption, evidence receipts, no implicit retries and no production permissions. This is a governance change request, **not adopted authorization**. Current code requires independent issuer identity and repository trust is disabled, so do not misrepresent same actor as independent, bypass signature verification or modify trust switches by hand. Review targeted contract/security changes and regression tests, including dedicated PostgreSQL audit user qual_dedicated_admin vs legacy qual_admin conflict, before separately adopting any new design. TEST_ONLY_EXECUTE_HOLD and production HOLD remain.

---

# 2026-10-13 — Retry execution admission remains HOLD; dedicated audit identity mismatch confirmed

Reviewed protected-main bridge, policy and trust registry against Run 800c dedicated PostgreSQL evidence. The read-only admission bridge validates dedicated PostgreSQL endpoint for run 800c but separately requires audit_user=qual_admin. The historical activation proposal policy also hard-codes port 55432 and audit_user=qual_admin; these conflict with dedicated endpoint 55434 and actual audit principal qual_dedicated_admin. Corrective engineering must be a reviewed, run-specific contract with strict authenticated account binding and negative regression tests; never falsify the audit principal or loosen the general old-run contract. Current trust registry adopted=false, execution_enabled=false, issuers empty, host/operator/ledger null, four capabilities disabled. Signed one-use permit is not issued; offline synthetic tests do not establish independent Windows signing or ledger authority. An independent signer (not the Windows execution operator or Producer) must be explicitly appointed and own a separately protected Ed25519 key; identity and public key not yet supplied, so no trust enrollment is claimed. TEST_ONLY_EXECUTE_HOLD and production HOLD remain. No authority changes, merge, deployment, or local side effects.

---

# 2026-10-13 — 800c Positive writer-owner full table ACL matrix

Operator read-only Positive DB check and COMMIT: two owner roles x 29 public tables = 58 table-owner combinations, with SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER effective privilege checks compared to protected-main Twin/Forcing writer ACL grants. checked=58, mismatches=0, WRITER_OWNER_TABLE_ACL_PASS. POSITIVE_WRITER_OWNER_TABLE_ACL_PASS for tested table privileges. Negative counterpart not yet run. Does not qualify sequences, other object categories, routine source parity or TEST_ONLY authorization. TEST_ONLY EXECUTE_HOLD.

---

# 2026-10-13 — Run 800c Positive writer-owner base role and facts ACL readback

Actual operator READ ONLY Positive DB transaction committed. Both geox_mcft_cap09_forcing_writer_owner_v1 and geox_mcft_cap09_twin_writer_owner_v1: NOLOGIN, NOINHERIT, NOSUPERUSER, NOCREATEROLE, NOCREATEDB, NOBYPASSRLS; public schema USAGE yes/CREATE no; facts SELECT/INSERT yes and UPDATE/DELETE no. POSITIVE_WRITER_OWNER_BASE_PRIVILEGE_PASS only. Remaining complete 29-table owner grant matrix, sequences, role members and Negative symmetry pending. TEST_ONLY EXECUTE_HOLD.

---

# 2026-10-13 — Protected-main writer DDL source inspection

Read protected-main Formal V5 materializer and the Twin (2026_08_27) and Evidence (2026_08_28) writer ACL SQL migrations. The materializer binds a different formal target database and Formal ARM and is **not** a read-only auditor suitable for isolated Run 800c. Twin writer owner is intended NOLOGIN/NOINHERIT and to receive facts SELECT+INSERT and runtime lease SELECT+UPDATE; Evidence forcing writer owner is intended NOLOGIN/NOINHERIT with facts SELECT+INSERT and forcing controller/target SELECT+UPDATE. Both define SECURITY DEFINER functions with constrained search_path and runtime-scoped EXECUTE, not PUBLIC. Prior 800c observations match named table set, dual matrix, routine owners, and security metadata, but do not prove frozen source-body exact equality or writer-owner full grant closure. Next: read-only owner-role capabilities, precise effective owner table/sequence privileges, absence of inappropriate schema CREATE and role-membership escalation, then independent frozen-DDL provenance. TEST_ONLY EXECUTE_HOLD.

---

# 2026-10-13 — 800c positive and negative default ACL/RLS parity

Positive operator read-only inspection committed: pg_default_acl count 0, public pg_policies count 0, public tables relrowsecurity count 0 and relforcerowsecurity count 0. Both empty-set fingerprints d41d8cd98f00b204e9800998ecf8427e. Negative checks previously returned identical values and committed. CROSS_DATABASE_DEFAULT_ACL_RLS_PARITY_PASS for these read-only catalog measures. No custom default ACL rows does not imply absence of PostgreSQL built-in defaults. Protected-main canonical DDL equivalence and MinIO write-side authorization remain pending. TEST_ONLY EXECUTE_HOLD.

---

# 2026-10-13 — 800c Negative default ACL and RLS catalog readback

Operator READ ONLY PostgreSQL transaction committed in Negative DB. pg_default_acl records=0; public pg_policies records=0; public table RLS enabled=0 and forced=0. Both zero-row aggregates reported d41d8cd98f00b204e9800998ecf8427e. NEGATIVE_DEFAULT_ACL_RLS_CHECK_PASS for these scoped checks. No custom default ACL entries does not imply absence of built-in PostgreSQL defaults. Positive symmetric readback pending. TEST_ONLY EXECUTE_HOLD.

---

# 2026-10-13 — 800c paired PostgreSQL structure comparison

Positive and Negative read-only catalog checks produced identical results, both committed.

COLUMN: count 424; MD5 f3518f6f67e11755e6a0bbc372017b5a
CONSTRAINT: count 78; MD5 51b1ecd1717d014fcadd6341ae99b8ac
INDEX: count 61; MD5 e74691e95b7642dee9b55efb894c2596

Verdict: CROSS_DATABASE_SCHEMA_STRUCTURE_FINGERPRINT_PASS for the enumerated metadata only. Frozen-main DDL equivalence, default privileges, row security and complete object authority not yet demonstrated. Maintain TEST_ONLY EXECUTE_HOLD.

---

# 2026-10-13 — Run 800c Positive frozen object set PASS; both DBs confirmed

Actual operator read-only PostgreSQL `positive` session compared 29 explicitly frozen names against public ordinary/partitioned table catalog: expected=29, actual=29, missing=0, extra=0, TABLE_SET_PASS. Two frozen public routine names: actual=2, missing=0, extra=0, ROUTINE_SET_PASS. Read-only transaction committed. Independent previously recorded Negative results identical; hence `CROSS_DATABASE_FROZEN_SCHEMA_OBJECT_SET_PASS` for table/routine names and cardinalities, **not column, indexes, constraints, default ACL, or full DDL equivalence**.

Preserve `TEST_ONLY_EXECUTE_HOLD`, production hold, no write-side MinIO verify, no identity-apply replay, no DB mutation. Next read-only structural/column/constraint/index checks and separate main-frozen contract comparison.

---

# 2026-10-13 — Run 800c Negative exact frozen table and routine name-set PASS

Actual operator read-only SQL against `mcft_cap09_requal_800c023cf337_negative`, with `BEGIN TRANSACTION READ ONLY` and `COMMIT`, checked the explicitly enumerated 29 frozen public table names from protected-main `scripts/runtime_acceptance/RUN_MCFT_CAP_09_FORMAL_V5_SCHEMA_ACL_MATERIALIZATION_V1.ts` versus catalog public ordinary/partitioned tables. Result: expected_tables=29, actual_tables=29, missing_tables=0, extra_tables=0, `TABLE_SET_PASS`. Separately compared public routine names against the expected two append routines: actual_routines=2, missing_routines=0, extra_routines=0, `ROUTINE_SET_PASS`. Adjudication: `NEGATIVE_FROZEN_SCHEMA_OBJECT_SET_PASS` for object names and counts, not full structural equivalence. Positive identical frozen-set check still PENDING. No schema writes.

Existing PostgreSQL dual role ACL parity (62/62), two function-body fingerprint parity, dual login escalation-boundary PASS, actual 8/8 credential-authentication PASS; MinIO read-only scoped evidence recorded. Full constraints/indexes/column-level ACL/default privileges and future TEST_ONLY authorization unqualified. `TEST_ONLY_EXECUTE_HOLD`.

---

# 2026-10-13 — 800c two-database LOGIN escalation-boundary check PASS

Actual operator read-only PostgreSQL catalog checks for Positive and Negative databases completed and committed. Each side's Evidence and Twin LOGIN: public schema USAGE=true, CREATE=false, no effective privilege on any public sequence, no SET or USAGE capability on any of three named writer-owner roles. Direct `pg_auth_members` results per side show exactly two rows: run-specific Evidence LOGIN -> `geox_mcft_cap09_evidence_runtime_v1`, run-specific Twin LOGIN -> `geox_mcft_cap09_twin_runtime_v1`; both admin_option=false, inherit_option=true, set_option=true. SET relates to own runtime role, not a writer owner. `CROSS_DATABASE_LOGIN_PRIVILEGE_BOUNDARY_PASS` for tested roles and permissions.

This is not equivalent to full transitive grants of all roles, column-level ACLs, canonical schema hashes, or full runtime admission. Previously verified 62/62 per-object ACL parity, 2/2 function definition parity, 8/8 LOGIN authentication, 58/58 empty tables, MinIO old-bucket AccessDenied and zero inventory stand. Continue exact frozen schema/ACL matching and separate MinIO receipt authorization. `TEST_ONLY_EXECUTE_HOLD` remains; no merge/deploy/provision/write.

---

# 2026-10-13 — Run 800c Positive/Negative Routine definition parity PASS

Operator actual Positive PostgreSQL read-only query and COMMIT yielded the same two complete function identities and `md5(pg_get_functiondef(oid))` as prior Negative readback:
- `mcft_cap09_twin_runtime_append_fact_v1` (11 parameters): `802776085138a24868e6e67b6d2df849`.
- `mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1` (15 parameters): `6158c1d58f12e51135c29c8680cc8511`.
Both DBs returned exactly two routine rows, matching signatures and MD5. Verdict: `CROSS_DATABASE_ROUTINE_DEFINITION_PARITY_PASS` (PostgreSQL-rendered definition parity, not protected-main frozen source provenance). Previously observed security-definer/owners/search_path/PUBLIC EXECUTE parity and 62/62 table/function permission parity stand. Frozen-main full schema/ACL adjudication and MinIO effectful receipt remain pending; `TEST_ONLY_EXECUTE_HOLD`.

---

# 2026-10-13 — 800c Negative Routine function definition fingerprint captured

Operator successfully executed read-only PostgreSQL catalog inspection in `mcft_cap09_requal_800c023cf337_negative`, transaction committed. `md5(pg_get_functiondef(p.oid))` with `pg_get_function_identity_arguments` returned:
- `mcft_cap09_twin_runtime_append_fact_v1`: eleven identity parameters; MD5 `802776085138a24868e6e67b6d2df849`.
- `mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1`: fifteen identity parameters; MD5 `6158c1d58f12e51135c29c8680cc8511`.

These are deterministic comparison fingerprints of PostgreSQL-rendered function definitions, not cryptographic source provenance. `NEGATIVE_ROUTINE_DEFINITION_FINGERPRINT_CAPTURED`; **Positive counterparts not yet captured; cross-DB body equality not adjudicated**. Next run same read-only query against Positive, compare names, full signatures and hashes; protected-main canonical definition matching remains separate. Existing TEST_ONLY/production execution HOLD remains.

---

# 2026-10-13 — Run 800c Negative Routine SECURITY DEFINER and owner readback PASS

Actual operator read-only transaction against `mcft_cap09_requal_800c023cf337_negative` successfully committed. Exactly 2 public routines:
- `mcft_cap09_twin_runtime_append_fact_v1`: SECURITY DEFINER=true, owner=`geox_mcft_cap09_twin_writer_owner_v1`, function_settings=`{"search_path=pg_catalog, public"}`, PUBLIC EXECUTE=false.
- `mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1`: SECURITY DEFINER=true, owner=`geox_mcft_cap09_forcing_writer_owner_v1`, same search_path, PUBLIC EXECUTE=false.

All reported fields exactly match the previously observed Positive database readback. `POSITIVE_NEGATIVE_ROUTINE_SECURITY_ATTRIBUTE_PARITY_PASS`. Function-body identity, full schema/ACL contract and additional effective/column/sequence grants are NOT established by this result. Prior PostgreSQL 8/8 actual authentication and 62/62 ACL matrix parity, MinIO actual old-bucket AccessDenied, MinIO empty object/version/multipart inventory remain as scoped evidence. MinIO receipt and effectful access verification not completed. `TEST_ONLY_EXECUTE_HOLD`, no production authority, no replay of MinIO apply.

---

# 2026-10-13 — 800c Positive PostgreSQL function owner and PUBLIC ACL readback

Actual operator successful container-local PostgreSQL 16.4 `qual_dedicated_admin` login to positive DB, with `BEGIN TRANSACTION READ ONLY` and `COMMIT`, observed exactly two public functions:
- `mcft_cap09_twin_runtime_append_fact_v1`: `prosecdef=true`, owner `geox_mcft_cap09_twin_writer_owner_v1`, `proconfig={"search_path=pg_catalog, public"}`, PUBLIC EXECUTE false, by `aclexplode(coalesce(proacl,acldefault('f',proowner)))` grantee=0.
- `mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1`: `prosecdef=true`, owner `geox_mcft_cap09_forcing_writer_owner_v1`, same search_path, PUBLIC EXECUTE false.

Earlier repeated Windows-host `psql` `qual_dedicated_admin` authentication attempts failed before SQL; container-local connection succeeded. Do not categorize auth retry errors as ACL failures or reset credentials. Negative counterpart and exact frozen function definition check pending. Previous PostgreSQL 62/62 effective ACL parity PASS and MinIO direct prior-run AccessDenied PASS remain, but TEST_ONLY execution HOLD.

---

# 2026-10-13 — Run 800c direct old-bucket denial probe inconclusive: JSON error code empty

Operator actual low-privilege app-credential `mc --json ls app/mcft-cap09-requal-c1f7dcc6d04d/` probe produced:
```text
DIRECT_OLD_BUCKET_EXIT=1
S3_ERROR_CODES=
MINIO_DIRECT_CROSS_BUCKET_DENIAL_NOT_PROVEN
MINIO_CROSS_BUCKET_ACL_HOLD
```
The request failed, but the client parser did not retrieve an explicit S3 `AccessDenied` code. **Not proof of authorization denial**; cannot rule out NoSuchBucket, auth/transport errors, or JSON error nesting/stderr variance. Previous root `mc --json ls app/` returned only current 800c bucket; remote admin readback shows own-bucket-only policy, but direct out-of-scope denial remains unqualified. Next use read-only classified and redacted client output from BOTH stdout/stderr, require specific response code without exposing secrets; if unavailable, maintain HOLD. Do not replay `apply`, run effectful `verify`, modify accounts/buckets, or sign TEST_ONLY. Keep `TEST_ONLY_EXECUTE_HOLD` and all existing evidence.

---

# 2026-10-13 — Run 800c MinIO global-list anomaly narrowed: only own bucket visible

Actual Windows operator application-credential `mc --json ls app/` root listing readback: `GLOBAL_LIST_EXIT=0`; `GLOBAL_LIST_ENTRIES=1`; `GLOBAL_LIST_BUCKETS=1`; `OWN_BUCKET_VISIBLE=True`; `OLD_BUCKET_VISIBLE=False`; `JSON_ERROR_ENTRIES=0`.

Interpretation: the earlier `GLOBAL_LIST_UNEXPECTED` from a harness treating any successful root listing as forbidden was too strict for the observed server/client listing semantics. The application principal's global list returned exactly one permitted run-scoped bucket and did not display the prior run bucket. **No observed cross-run disclosure in this result**. This alone is NOT positive independent proof of direct old-bucket AccessDenied, nor of object read/write denial, nor canonical policy equivalence. Do not mark comprehensive scoped ACL PASS solely from filtered listing. Earlier `OWN_BUCKET_LIST_PASS`, `OLD_BUCKET_LIST_DENIED` shell outputs stand, but the negative check had suppressed errors and needs specific AccessDenied classification.

Next: correct the test/receipt contract to accept successful filtered root listing only if all returned bucket identities are within the exact 800c allowlist, no unexpected names and no JSON errors; distinguish explicit 403 AccessDenied from 404/missing bucket, transport or authentication failure on direct out-of-scope call. Keep local one-shot intent and private credentials; no `apply` replay, no effectful `verify`, no policy/account change. No Handoff assertion that source file was modified: this is adjudication only.

`MINIO_FILTERED_GLOBAL_LIST_SCOPE_OBSERVED_PASS`; `DIRECT_CROSS_BUCKET_DENIAL_CLASSIFICATION_PENDING`; `TEST_ONLY_EXECUTE_HOLD` and no production authority. PostgreSQL 8/8 actual auth, 62/62 parity PASS; canonical frozen ACL still pending.

---

# 2026-10-13 — Run 800c MinIO app-principal read-only scope probe FAILED (global list unexpected)

Actual Windows operator executed a read-only app-credential `mc ls` scope script against local MinIO for run `800c023cf337`, obtaining:
```text
OWN_BUCKET_LIST_PASS
OLD_BUCKET_LIST_DENIED
GLOBAL_LIST_UNEXPECTED
MINIO_READONLY_APP_SCOPE_FAILED
MINIO_APP_SCOPE_NOT_QUALIFIED
```
- Own-bucket list succeeded; previous run's bucket list returned nonzero (test classified as denial, but original stderr was suppressed); `mc ls app/` exited **0**, contrary to script's expected denial. The script stopped; no `MINIO_READONLY_APP_SCOPE_3_OF_3_PASS`; no full ACL qualification. This is a real behavioral discrepancy, NOT proof yet that all bucket names were visible, nor proof of MinIO cross-bucket object access.
- MinIO policy as separately admin-read back contains only `mcft-cap09-requal-800c023cf337` resources, with no `s3:ListAllMyBuckets` grant in its document. Whether `mc ls app/` exit=0 signifies bucket enumeration (possibly filtered/empty) vs client semantics or unintended privilege remains under investigation.
- **STOP:** Do not change policy, remove accounts, re-run apply, run effectful verify, or sign TEST_ONLY execution. Preserve original stdout/stderr (do not print secrets). Next: read-only `mc --json ls app/` and assess returned bucket identities/status, plus if necessary direct authenticated root S3 ListBuckets HTTP status, and independent server effective policy checks; redact names/secrets in public report. Avoid using nonzero alone as proof of AccessDenied.
- Prior actual admin bucket/principal/policy readback and versions/delete markers/MPU zero inventory stand as separate passes. `MINIO_APP_ACL=FAIL_PENDING_ROOT_CAUSE`, `TEST_ONLY_EXECUTE_HOLD`; PostgreSQL 8/8 auth, 62/62 cross-DB ACL parity PASS, canonical frozen ACL still unconfirmed.

---

# 2026-10-13 — Run 800c MinIO actual historical-version, delete-marker and MPU zero inventory readback

Actual Windows host operator executed read-only Docker-shell MinIO admin commands against `mcft-cap09-requal-800c023cf337`:
```text
=== OBJECT_VERSIONS_AND_DELETE_MARKERS ===
=== INCOMPLETE_MULTIPART_UPLOADS ===
MINIO_OBJECT_INVENTORY_READBACK_COMPLETE
MINIO_INVENTORY_READBACK_EXIT=0
```
The enumerations `mc ls --recursive --versions g/mcft-cap09-requal-800c023cf337/` and `mc ls --recursive --incomplete g/mcft-cap09-requal-800c023cf337/` returned zero entries, both commands completed with shell exit=0. Together with preceding `mc stat` size=0B, objects=0, versions=0, this independently supports **`MINIO_VISIBLE_OBJECT_VERSION_MARKER_AND_INCOMPLETE_MPU_ZERO_PASS` as observed at readback**, not a timeless absence guarantee.

Already observed: remote run bucket exists, admin policy and run-scoped user exist, attached policy names only 800c bucket; local one-shot intent and credentials exist, receipt absent. Do NOT rerun `apply` or effectful `verify`. Next: independently check existing app principal's own-list ALLOW, old-bucket list DENY, global-list DENY via read-only authenticated commands, with no secret exposure; then match canonical policy and write-probe authorization governance. `MINIO_APP_EFFECTIVE_ACL_PENDING`; `TEST_ONLY_EXECUTE_HOLD`, no production authority. Preserve all resources and history. PostgreSQL exact parity 62/62 PASS; canonical frozen ACL congruence pending.

---

# 2026-10-13 — Run 800c MinIO actual remote identity, policy and bucket readback PASS (no application-scope probe)

Operator host actual local intent metadata readback: run=800c023cf337; status=ONE_SHOT_MUTATION_INTENT; bucket=mcft-cap09-requal-800c023cf337; policy=mcft800c023cf337bucketonly; created_at_utc=2026-10-12T11:21:06.682962+00:00; execution_authorized=false; intent container ID exactly matches currently inspected `mcftcap09requal72dc0304a21a-minio-1`.

Operator actual `docker exec -i ... sh -s` admin read-only results (exit code 0):
- `mc stat g/mcft-cap09-requal-800c023cf337`: bucket exists, unversioned, us-east-1, Anonymous Disabled, ILM Disabled; current size=0 B, Objects count=0, Versions count=0.
- `mc admin user info g mcft800c023cf337app`: AccessKey matches expected, Status enabled, PolicyName `mcft800c023cf337bucketonly`, MemberOf empty.
- `mc admin policy info g mcft800c023cf337bucketonly`: document has Allow bucket-level `s3:GetBucketLocation`, `s3:ListBucket`, `s3:ListBucketMultipartUploads` on `arn:aws:s3:::mcft-cap09-requal-800c023cf337`, and object-level `s3:PutObject`, `s3:AbortMultipartUpload`, `s3:DeleteObject`, `s3:GetObject`, `s3:ListMultipartUploadParts` on bucket `/*`. Policy CreateDate and UpdateDate both `2026-10-12T11:21:06.911Z`.
- Local intent=true, private credentials=true, validation receipt=false. Remote admin readback establishes policy/user creation and attachment happened even though local receipt missing; never replay `apply` or overwrite/repair state automatically.
- **Adjudication:** `MINIO_IDENTITY_AND_POLICY_ADMIN_READBACK_PASS`; this is NOT low-privilege application identity actual deny/allow enforcement proof; no independent multipart/delete-marker list, no app probe, no receipt, no canonical policy contract or exact authoritative subject freshness adjudication. Existing `mc stat` counters do not exhaustively demonstrate absence of pending uploads. App `verify` is effectful and remains disallowed absent explicit gated next-phase authorization.
- Next safe phase: read-only remote `mc ls --versions` and `mc ls --incomplete` on bucket and app-scoped **read-only** positive/negative access checks using existing local credential, without printing secrets or doing `mc cp`, `mc rm`, credential export, `apply`, or `verify`; check canonical ACL and permit gate separately.
- PostgreSQL 58/58 zero rows, actual 8/8 authentication, exact Positive/Negative effective ACL parity 62/62 are PASS, but frozen canonical ACL unresolved; `TEST_ONLY_EXECUTE_HOLD`, `execution_authorized=false`, `production_authorized=false`, no merge/deploy/runtime/schema/Provider/Producer/Timing/Formal A0.

---

# 2026-10-13 — Run 800c MinIO existing one-shot intent/credential, missing receipt (operator filesystem readback)

Actual Windows operator readback of local file presence at `D:\gptdown\MCFT-CAP09-NEW-ISOLATION-EVIDENCE\800c023cf337`:
```text
minio-identity-commit-intent-v1.json             True
minio-identity-acl-receipt-v1.json              False
private-credentials\minio-v1\minio-app-v1.json True
preflight.json                                   True
MINIO_EXISTING_STATE_REQUIRES_READBACK
```
Meaning: local one-shot mutation intent and private credential file already exist, while validated post-apply receipt is absent. **Remote policy/user/attachment state and scope NOT yet determined.** This combination is consistent with an interrupted/partially finished apply OR completed remote changes without verify, among other possibilities; do not infer success or failure. V2 script `apply` is non-replayable and `verify` executes object put/stat/delete.
Mandatory next step: inspect only non-secret intent metadata, then admin read-only `mc admin user info`, `mc admin policy info`, bucket stat, full object versions/delete markers/multipart inventory, and scope attachments; do not rerun apply, verify, or clean resources. Preserve credentials/intent; no secret output. `MINIO_IDENTITY_RECEIPT_PENDING`; `TEST_ONLY_EXECUTE_HOLD`, execution and production not authorized. PostgreSQL 8/8 auth, 58/58 zero state, 62/62 precise parity remain recorded; frozen canonical ACL still pending.

---

# 2026-10-13 — Run 800c MinIO ACL V2 source-only safety review (NOT runtime-qualified)

Operator supplied complete text listing of three entries from `MCFT-CAP09-800c023cf337-MINIO-ACL-V2.zip`: `README.txt` (387 bytes), `minio_iso_800c_v2.py` (8576 bytes), `test_minio_iso_800c_v2.py` (1532 bytes). Reviewed the pasted contents; **no package script was run and no MinIO host result was obtained**. This is a SOURCE REVIEW only, not PASS evidence.

- Fixed constants: run `800c023cf337`, bucket `mcft-cap09-requal-800c023cf337`, container `mcftcap09requal72dc0304a21a-minio-1`, user `mcft800c023cf337app`, policy `mcft800c023cf337bucketonly`, old bucket `mcft-cap09-requal-c1f7dcc6d04d`, preflight subject pinned `adfaf9fdbd2c75923fb298e26b5d5d106a0fc61a`.
- CLI modes: `plan` calls preflight/container checks + admin `mc stat`, `mc du`, account/policy absence checks; no intentional mutations. `apply` creates NTFS private credential dir, secrets JSON, irrevocable one-shot intent, then uses `mc admin policy create`, `mc admin user add`, `mc admin policy attach`. `verify` invokes real in-bucket `mc cp /etc/hostname`, `mc stat`, `mc rm`, and writes local receipt. **Do not treat verify as read-only**.
- `bucket_zero()` examines ordinary object byte/count `mc du --json` only: no exhaustive bucket object version/delete marker/multipart upload inventory; no verified lifecycle cleanup invariant for the write/delete probe.
- `apply` persists one-shot intent before remote changes and fails closed if any intent/credential/receipt exists. A partial remote failure must NOT be retried or cleaned up blindly; preserve all evidence and perform forensic readback.
- Tests focus on syntax, pinned run/bucket, LF input encoding, redaction, no replay marker, absence of `psql`, narrow policy-resource names. They do not independently prove bucket versions/markers/MPU, actual cross-scope principal denials, actual policy document readback, or verify side-effect-free behavior.
- Policy grants run-bucket `ListBucket`, `GetBucketLocation`, `ListBucketMultipartUploads`, and object-level `GetObject`, `PutObject`, `DeleteObject`, `AbortMultipartUpload`, `ListMultipartUploadParts`; requires canonical frozen ACL comparison. Shell heredoc for JSON policy merits on-host exact-file syntax verification before any apply; pasted console rendering is insufficient to certify it.
- Next: run only side-effect-free plan once after checking no existing intent; independently read MinIO scope and versions/delete markers/MPU with admin read-only commands; compare intended policy to frozen canonical policy; authorize any actual write probe only in separate explicit phase. No attempt to mark identity/ACL as PASS on source review alone.
- PostgreSQL run 800c: actual 8/8 password + cross-db denial PASS; zero-row 58/58 PASS; exact parity 62/62 PASS, protected-main frozen ACL comparison still pending. `TEST_ONLY_EXECUTE_HOLD`; `execution_authorized=false`; `production_authorized=false`. No merge/deploy/schema/Runtime or provider/producer/timing/A0 actions.

---

# 2026-10-13 — Run 800c exact Positive/Negative effective ACL parity 62/62 PASS

**Actual operator-host verification**, full standalone Windows PowerShell plus host PostgreSQL `psql` 18.6 using `127.0.0.1:55434`; dedicated DBs `mcft_cap09_requal_800c023cf337_positive` and `mcft_cap09_requal_800c023cf337_negative`. `PGOPTIONS="-c default_transaction_read_only=on"`; no DB writes, migrations, login secret disclosure or container/runtime mutation.

Actual terminal output:
```text
AUDITING=mcft_cap09_requal_800c023cf337_positive
ACL_ROWS=62
AUDITING=mcft_cap09_requal_800c023cf337_negative
ACL_ROWS=62
CROSS_DATABASE_EXACT_ACL_MATRIX_PASS
MATCHED_ROWS=62
TABLE_PERMISSION_ROWS=58
ROUTINE_PERMISSION_ROWS=4
```

- 62 object-role privilege records compared by exact row strings, with uniqueness assertion and zero differences: 2 logical domains x 29 public tables across SELECT/INSERT/UPDATE/DELETE/TRUNCATE; 2 logical domains x 2 public routine identities using `pg_get_function_identity_arguments` and EXECUTE.
- These results prove **exact positive/negative parity for the specified effective privileges and objects**. This does NOT alone prove frozen protected-main schema/ACL allowlist congruence, column-level/sequence/schema grants, routine definitions/owners/search_path, default privileges, RLS, or actual SQL write enforcement. Canonical comparison remains PENDING.
- Prior 8/8 actual password-login+cross-database denial checks PASS; 58/58 tables empty PASS; Positive 58+4 records and Negative aggregate+4 function records already recorded.
- Previous failed comparison attempts were test-harness defects (`psql -w:false` invalid argument; stale/out-of-scope `$SQL` variable causing zero matched rows), not database/ACL FAIL and not qualification evidence.
- **Next:** independently match against frozen exact ACL/schema contract; inspect existing MinIO V2 package before any execution and gather read-only scoped principal/policy/bucket/object inventory. `TEST_ONLY_EXECUTE_HOLD` and `production_authorized=false` remain. No merge/deploy/schema/Runtime/Provider/Producer/Timing/Formal A0/Product write.

---

# 2026-10-13 — Run 800c Negative effective ACL aggregate and function separation readback

Actual Windows operator PostgreSQL 16.4 interactive `qual_dedicated_admin` session against `mcft_cap09_requal_800c023cf337_negative`; transaction `BEGIN TRANSACTION READ ONLY` completed `COMMIT`. Effective access checked via `has_table_privilege` over 29 public tables and `has_function_privilege` over the two public routines for `mcft_cap09_800c023cf337_n_evidence` and `mcft_cap09_800c023cf337_n_twin`.

- Negative Evidence: tables_checked=29; SELECT=4; INSERT=3; UPDATE=3; DELETE=0; TRUNCATE=0.
- Negative Twin: tables_checked=29; SELECT=20; INSERT=19; UPDATE=19; DELETE=5; TRUNCATE=0.
- Routine EXECUTE: Negative Evidence -> `mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1` true / Twin append false; Negative Twin -> `mcft_cap09_twin_runtime_append_fact_v1` true / Evidence append false. All four expected function-domain decisions observed.
- These aggregate totals exactly match previously observed Positive database figures; **aggregation equality does not certify equality of the per-table ACL assignments**, nor exact frozen canonical schema/ACL, function body/owner/search_path, role default privileges, or actual low-privilege SQL write denial. Status: `NEGATIVE_ACL_AGGREGATE_AND_ROUTINE_DOMAIN_SEPARATION_PASS`, `FULL_SCHEMA_ACL_QUALIFICATION_PENDING`.
- Previously verified actual host `psql` password-authenticated eight-case database CONNECT matrix = 8/8 PASS; real zero-row inventory = 58/58 tables PASS. Password valid-until of four run-scoped logins = NULL; expiry/revocation decision pending.
- Next: obtain per-table per-action Negative privilege details and compare to exact Positive inventory and frozen schema/ACL contract; then inspect existing 800c MinIO V2 package **without running its effectful setup commands**, and obtain scoped identity and zero-state independent readback. Keep `TEST_ONLY_EXECUTE_HOLD`, `execution_authorized=false`, `production_authorized=false`. No Provider, Producer, three Timing, Formal A0, Product publish, merge, deploy, runtime change or DB modification. Historical evidence and all prior text retained.

---

# 2026-10-13 — Run 800c actual 8/8 PostgreSQL LOGIN authentication and positive effective ACL readback

> ACTUAL operator console evidence; PURE PREPEND to the same second Active Continuation Handoff. No inherited qualifications promoted. Preserve all material below unchanged.

## Actual password-authenticated connection tests — 8/8 PASS

- Run `800c023cf337`; Windows-host `psql 18.6` (`D:\pdsl\bin\psql.exe`) connected to dedicated container PostgreSQL 16.4 through `127.0.0.1:55434`, using credentials from the local-only candidate `D:\gptdown\MCFT-CAP09-NEW-ISOLATION-EVIDENCE\800c023cf337\dedicated-pg-private\credentials.json`. No password value, hash, or connection-secret contents were submitted.
- **Allowed positive connections confirmed:** `p_evidence -> positive`, `p_twin -> positive`, `n_evidence -> negative`, `n_twin -> negative`.
- **Expected cross-database CONNECT rejection confirmed by test script's stderr classification:** `p_evidence -> negative`, `p_twin -> negative`, `n_evidence -> positive`, `n_twin -> positive`; script counted only explicit `permission denied for database` for denial PASS, not generic errors or wrong passwords.
- Operator reported eight PASS rows, `AUTH_MATRIX_PASS_COUNT=8`, `AUTH_MATRIX_8_OF_8_PASS`. Earlier container Python implementation did NOT execute (container lacks python3); an isolated manually printed `AUTH_MATRIX_8_OF_8_PASS` from that earlier attempt is INVALID and must not be cited. The new 8/8 was executed via host psql, not the missing container Python.
- This qualifies real password authentication and database CONNECT isolation only. It does not prove all effective schema/table/function ACLs or production readiness.

## Positive database effective ACL (actual read-only PostgreSQL catalog)

- Actual `qual_dedicated_admin` query against `mcft_cap09_requal_800c023cf337_positive` inside `BEGIN TRANSACTION READ ONLY`, with `COMMIT`, returned **58 table-role rows** (2 runtime LOGIN roles x 29 public tables) and **4 routine-role rows** (2 x 2).
- `p_evidence`: SELECT on `facts` and three `twin_external_formal_forcing_{base_cursor_v1,base_target_v1,controller_lease_v1}` tables (4 total); INSERT and UPDATE on the three forcing tables; no table DELETE or TRUNCATE in the enumerated 29 tables. Other Twin projections unreadable/unwritable by these table checks.
- `p_twin`: SELECT on `facts` and 19 Twin runtime projection/index tables (20 total); INSERT/UPDATE on 19, DELETE on 5, TRUNCATE on none; no table privileges over Evidence forcing cursor/target/controller lease. The 5 DELETE grants are observed, not yet adjudicated against exact canonical allowlist.
- EXECUTE matrix: `p_evidence` can invoke only `mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1` (not `mcft_cap09_twin_runtime_append_fact_v1`); `p_twin` can invoke only `mcft_cap09_twin_runtime_append_fact_v1` (not Evidence append). Both are previously observed SECURITY DEFINER. Functional authorization separation is OBSERVED PASS, but exact frozen function definition, owner, search_path, PUBLIC grants/default privileges and effective role/column privileges are not yet wholly adjudicated.
- **Do not mark complete ACL qualification** from these raw effective privileges or from counts: compare exact protected-main frozen Schema/ACL expectations, then run matching Negative DB effective table/routine privilege readback (n_evidence/n_twin) and side-by-side differential.
- All four role passwords existed with `rolvaliduntil IS NULL` at previous checkpoint; expiry/revocation remains unproven.

## Next safe frontier / hold

1. Read-only Negative DB 58 table-role + 4 function-role effective privilege matrix; compare against the Positive matrix and exact frozen accepted ACL definition; perform further scoped-negative tests only if dictated by acceptance.
2. Run 800c MinIO independent identity/bucket/policy/object-version/delete-marker/multipart inventory readbacks, without effectful initialization or changing objects.
3. Exact main/host freshness, QCP/Formal checks, TEST_ONLY admission policy and single-use permit must be separately satisfied. `TEST_ONLY=HOLD`; `execution_authorized=false`; `production_authorized=false`; no Provider/Producer/Timing/Formal A0/Product publishing.
4. Preserve historical first-run evidence, isolation containers/volumes, credentials and prior snapshots. No merge, deploy, Runtime or schema mutation.

---

# 2026-10-13 — ACTUAL operator-host Run 800c database zero-state / role-isolation checkpoint and credential-location correction (NONPRODUCTION; EXECUTE_HOLD)

> This is a PURE PREPEND to the **same second Active Continuation Handoff** in Draft PR #3298. The complete historical body below is retained verbatim. This record is based on operator-supplied actual PowerShell/psql output; no new independent runtime qualification or permit is claimed.

## Exact subject and work undertaken

- Run ID: `800c023cf337`; post-merge protected-main reference: `8563fc7025fc6e2aa6fd8b8e217f168c9caa59ed` (#3700, dedicated-PG port restriction). Re-read exact main before any future admission; this checkpoint does not itself certify current GitHub/host SHA continuity.
- Existing container `mcft-cap09-800c023cf337-pg-dedicated` returned Docker `STATUS=running`, with `docker port ... 5432/tcp` returning `127.0.0.1:55434`. Successful interactive admin connections occurred **inside** the container via `127.0.0.1:5432` using `qual_dedicated_admin` and hidden password input. An earlier Windows-host `127.0.0.1:55434` connection attempt failed password authentication: do not misconstrue as schema failure or assert equivalent password-authentication success on the host route.
- Database names: `mcft_cap09_requal_800c023cf337_positive` and `mcft_cap09_requal_800c023cf337_negative`. Both returned `current_user=qual_dedicated_admin` and `transaction_read_only=on` under **explicit BEGIN TRANSACTION READ ONLY**. This flag is not evidence that the superuser lacks write privileges.
- Positive: exact public table-name listing showed **29 tables**; actual `SELECT count(*)` across **each of 29 public tables** under read-only transaction returned **zero on each table**, `DO` and `COMMIT` succeeded. Two public SECURITY DEFINER routines and signature arguments read back:
  - `mcft_cap09_twin_runtime_append_fact_v1`
  - `mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1`
  Both `prosecdef=true`. This is identity/shape evidence, not yet an exact canonical schema/hash comparison.
- Negative: independent read-only `COUNT(*)` over all public tables completed with `NOTICE: ZERO_ROW_PASS: tables=29, nonzero=0`, routine_count=2, security_definer_count=2, `COMMIT`. Thus **58/58 observed public tables have actual zero rows**. The negative table-name/routine-signature full exact-set comparison is still outstanding.
- PostgreSQL roles: `mcft_cap09_800c023cf337_{p,n}_{evidence,twin}` all exist with LOGIN=true; all four have superuser=false, CREATEDB=false, CREATEROLE=false, BYPASSRLS=false. Each inherits only its matching `geox_mcft_cap09_{evidence,twin}_runtime_v1` role in the displayed direct membership rows; `inherit_option=t`, `set_option=t`, `admin_option=f`. The runtime authority roles themselves are NOLOGIN.
- Database privilege **catalog** matrix: in Positive, `p_evidence` and `p_twin` CONNECT=true while both `n_*` CONNECT=false; in Negative, both `n_*` CONNECT=true and both `p_*` CONNECT=false. All four reported `public.USAGE=true` and `public.CREATE=false` in both database-context queries. Both SQL matrix queries completed successfully with `COMMIT`. This proves catalog-based database CONNECT boundaries, **not** actual cross-DB password-authenticated denials.
- Positive `information_schema.role_table_grants` returned frozen role-level grant counts (not the exact allowlist comparison); both routines had explicit EXECUTE ACLs to their relevant runtime roles without an observed PUBLIC execute entry. Do not infer complete table, routine, ownership, default-privilege or role-escalation isolation from these summaries alone.
- `pg_authid` inspected in a read-only transaction with **boolean password presence only, never password hash**. All four LOGIN roles returned `can_login=t`, `has_password=t`, `password_status=NO_EXPIRY` / `rolvaliduntil IS NULL`. A finite expiry/revocation policy for this new run is **not demonstrated**; do not confuse with former run `c1f7dcc6d04d` expiry `2026-10-25T17:55:56.650Z`.
- These operations produced no user-reported schema or ACL mutation, Producer start, Provider call, Formal-v5 arm, or production execution. Existing container/resources and historical evidence remain preserved.

## Credential discovery: CORRECTED conclusion

- First shallow search in `D:\gptdown` found no filename matching both `800c023cf337` and `SECRET|CREDENTIAL|DPAPI|LOGIN`. **It searched root-level files only, not the evidence subtree; this was never proof of missing credentials.**
- Operator then performed recursive **filename-only** search and supplied 105 candidate paths. One exact, run-scoped credential-path candidate was found: `D:\gptdown\MCFT-CAP09-NEW-ISOLATION-EVIDENCE\800c023cf337\dedicated-pg-private\credentials.json`. Related candidate: `...\dedicated-pg-private\admin-password.txt` in earlier handoff. Only their *filenames* are in evidence here: neither file contents, secret format, identity coverage, DPAPI protection, nor suitability for use has been inspected/verified.
- Old DPAPI ciphertext `D:\gptdown\MCFT-CAP09-LOGIN-DPAPI-SECRETS-c1f7dcc6d04d.json` belongs to a **different** Run ID; prohibit reuse or cross-run credential substitution.
- **Next safe step:** locally verify file existence/metadata and inspect the credential **schema/keys only** with a secret-redacted procedure approved for the actual file format; determine whether four individual runtime credential entries exist. Do not print plaintext, hashes, connection strings or encrypted material into chat, logs or GitHub. Do not run provisioning, reset credentials, or mutate roles. Only subsequently attempt four positive password-authenticated read-only local logins and four negative cross-DB denials, with refusal classification distinguishing CONNECT denial from authentication failure.

## Remaining gates / strict hold

1. Compare exact 29-table/2-routine schema, columns/constraints/owners/ACL/default privileges against the frozen accepted source for **both** DBs; validate low-privilege Evidence/Twin effective table/function privileges and real 4+4 authenticated positive/negative access matrix.
2. Recheck the Run 800c MinIO identity, bucket, object/version/delete/multipart zero-state and scope-bound policy through non-mutating, positively/negatively adjudicated evidence (existing ZIP filenames are not execution evidence).
3. Verify host exact main, QCP/Formal readiness, freshness/expiry, test-only admission design, reviewer/issuer and signed non-replayable permit independently. The existence of an owner-approved test purpose is NOT proof the current guarded runner can execute.
4. `TEST_ONLY=HOLD`; `execution_authorized=false`; `production_authorized=false`; no Provider, Producer, three Timing, controlled delay, Formal-v5 A0/O00–O23, Product publication, merge or deploy under this checkpoint.
5. Preserve previous one-shot records and runs `72dc0304a21a` and `c1f7dcc6d04d`; no cleanup, replay, database rebuild, privilege elevation, Runtime changes, or historical rewrites.

---

# 2026-10-13 — Run 800c two-database SQL readback checkpoint

Windows operator read both isolated Run `800c023cf337` databases, positive and negative, using `qual_dedicated_admin` with an explicit read-only transaction. Both connections returned correct database identity, `current_user=qual_dedicated_admin`, `transaction_read_only=on`, `public_tables=29`, `public_routines=2`, and completed `COMMIT`. `RUN_800C_BOTH_DB_AUTH_AND_CATALOG_COUNTS_PASS`. No data changed. Counts do not prove exact table/routine names or zero rows; explicit transaction read-only does not prove the admin role lacks write privilege. Remaining: canonical exact sets and all-row-zero scans, low-privilege evidence/twin ACL denial, MinIO bucket/principal ACL, QCP and Formal Readiness on post-merge main, independent issuer and TEST_ONLY signing. Remain `FAIL_CLOSED_EXECUTE_HOLD`; no permit or production execution. Existing historical container, volumes, working directories and evidence retained.

---

# 2026-10-13 — Run 800c dedicated PostgreSQL interactive admin login PASS (positive DB only)

The operator has now successfully completed the previously blocked Windows-host interactive PostgreSQL authentication and read-only identity test using the **existing** dedicated Run 800c PostgreSQL admin credential (no password disclosed). Exact command:
`docker exec -it mcft-cap09-800c023cf337-pg-dedicated psql -X -h 127.0.0.1 -p 5432 -U qual_dedicated_admin -d mcft_cap09_requal_800c023cf337_positive -W -v ON_ERROR_STOP=1 -c "BEGIN READ ONLY; SELECT current_database(), current_user, current_setting('transaction_read_only'); COMMIT;"`.
Actual operator terminal result:
```text
Password:
BEGIN
            current_database             |     current_user     | current_setting
-----------------------------------------+----------------------+-----------------
 mcft_cap09_requal_800c023cf337_positive | qual_dedicated_admin | on
(1 row)
COMMIT
```
Verdict: `POSTGRES_800C_POSITIVE_ADMIN_AUTH_AND_READONLY_IDENTITY_PASS`. The `on` is the **explicit BEGIN READ ONLY transaction flag**, NOT independent proof the login role defaults to read-only or lacks write grants. The earlier attempt with user `qual_admin` was denied (`password authentication failed`); avoid retrying other account passwords or falsely marking schema/ACL failure. This step did not query tables, routines, actual row counts, roles, privileges, the **negative DB**, or MinIO policies. The success proves one dedicated admin login and positive DB SELECT, not full schema/ACL qualification, not an evidence/twin low-privilege login qualification and not TEST_ONLY authorization.

Next: with the **same existing local-only credential** and no password published, run a read-only `qual_dedicated_admin` identity and public table/routine inventory against both exact run-specific DBs (positive and negative); then independently prove all 29 expected table *names*, two expected public routines, every table's exact zero row counts, Evidence/Twin/blocked role ACL and negative-denial semantics using the appropriate provisioned *low-privilege* users. Independently reverify run-specific MinIO bucket/object/version/list/action policies without mutations. Obtain actual postmerge main QCP / Formal readiness evidence; distinct operator/issuer and signed one-shot permission remain unadopted. Preserve the already proven V2 host identity, protected-main SHA `8563fc7025fc6e2aa6fd8b8e217f168c9caa59ed`, old worktrees, MinIO/PG volumes and historical receipts. No production change, no direct TEST_ONLY signing. Fail-closed `execution_authorized=false, production_authorized=false`.

---

# 2026-10-13 — Follow-up 800c PostgreSQL interactive credential failure, not an ACL verdict

- Operator ran `docker exec -it mcft-cap09-800c023cf337-pg-dedicated psql -X -h 127.0.0.1 -p 5432 -U qual_admin -d mcft_cap09_requal_800c023cf337_positive -W -v ON_ERROR_STOP=1 -c "BEGIN READ ONLY; SELECT current_database(), current_user, current_setting('transaction_read_only'); COMMIT;"`. Prompt displayed `Password:` followed by `FATAL: password authentication failed for user "qual_admin"`. Operator said password did not paste. PostgreSQL masks password input completely (no echo) and this error means password authentication did not succeed, **not proof that paste failed**. The query was NOT executed; do not mark DB schema or ACL FAILED. No retry brute force or reset.
- Operator showed old plaintext config labeled `QUAL RUN ID=72dc0304a21a`; **do not use old Run credentials on isolated 800c database**. Prior handoff recovery path to VERIFY LOCALLY (not GitHub): `D:\gptdown\MCFT-CAP09-NEW-ISOLATION-EVIDENCE\800c023cf337\dedicated-pg-private\admin-password.txt`; associated expected dedicated admin login is `qual_dedicated_admin`, **distinct** from `qual_admin`, and credentials/account must be independently checked. Avoid falsely claiming file was verified to exist.
- Suggested **local-only** interactive, read-only SQL identity probe for actual `qual_dedicated_admin` against `mcft_cap09_requal_800c023cf337_positive`; use native terminal paste (Windows Terminal Ctrl+Shift+V or classic PowerShell right-click / Shift+Insert), password is hidden even on successful paste. No credential contents or secrets in logs/handoff/chat, never pass in command args. This admin identity probe does **not** replace distinct low-privilege `qual_admin` / evidence/twin ACL positive-negative proofs; these remain pending.
- Continue from host V2 Docker identity PASS on main `8563fc7025fc6e2aa6fd8b8e217f168c9caa59ed`; require fresh actual database schema/ACL and MinIO ACL readbacks, exact main QCP / Formal Readiness, issuer and independent TEST_ONLY permit adjudication. `FAIL_CLOSED_EXECUTE_HOLD`, `execution_authorized=false`, `production_authorized=false`. Existing second Active Continuation Handoff only; no third copy and no production changes.

---

# 2026-10-13 — Run 800c Windows post-merge V2 readback PASS; PostgreSQL authentication probe requires existing credential (NO SCHEMA/ACL VERDICT)

## Precise inherited state and evidence (do not redo work)

- **Actual adopted protected main:** PR #3700 independently APPROVED by `victse999`, then merged; exact protected `main` SHA = `8563fc7025fc6e2aa6fd8b8e217f168c9caa59ed`. PR premerge HEAD checks 28 SUCCESS / 1 expected Producer-live SKIPPED; do not confuse these with postmerge checks. No new code merge, database mutation or production authority in this checkpoint.
- **Windows worktree:** `D:\gptdown\GEOX-cap09-postmerge-8563fc70`, detached HEAD `8563fc7025fc6e2aa6fd8b8e217f168c9caa59ed`, clean; `origin/main` same SHA. Created separately from `D:\gptdown\GEOX-cap09-requal-current-main` (still historical `adfaf9fdbd2c75923fb298e26b5d5d106a0fc61a`) and `D:\gptdown\GEOX-cap09-iso-execution-72dc0304a21a`; **do not reset or remove old worktrees/evidence**.
- **Worktree troubleshooting resolved:** first `git worktree add` attempted to fetch missing promisor object `bf75cee08c4af415bf7c56a52f87245a9dfe1a76` and failed with Windows schannel handshake; next invocation using `git -c http.version=HTTP/1.1 worktree add --detach ...` fetched missing objects, checked out all 8239 files, verified exact new SHA and clean worktree. Earlier misleading `POSTMERGE_MAIN_PASS=adfaf9...` came from stale shell variable after error and must be discarded.
- **V1 read-only receipt:** `C:\Users\mylr1\AppData\Local\Temp\MCFT-CAP09-800c-POSTMERGE-READONLY-20261013T030757686.json` had exact-head/clean/trust PASS but `HOST_PREFLIGHT_INCOMPLETE_OR_FAILED` because grouped Docker inspection aborted; not authoritative resource failure. Replaced by V2 per-check Docker diagnostic, not a resource rebuild.
- **V2 operator-host JSON:** `C:\Users\mylr1\AppData\Local\Temp\MCFT-CAP09-800c-POSTMERGE-READONLY-V2-20261013T031434731.json`, `observed_at_utc=2026-10-13T03:14:34.7339130Z`; schema `mcft_cap09_800c_postmerge_host_readonly_v2`; `checks` ALL PASS (exact SHA, clean, local origin main same SHA, fail-closed trust, Docker CLI/daemon `29.1.2`, container parses/identity, dedicated loopback port/network/data volume and disjoint Docker network); `issues=[]`, `resource_identity_observed=true`, `schema_acl_live_validated=false`, `minio_acl_live_validated=false`, `test_only_authorized=false`, `execution_authorized=false`, `production_authorized=false`. This is a real local Docker inspection, not DB SQL/ACL validation.
- **Docker actual identity (V2):** context `desktop-linux`; dedicated PG `/mcft-cap09-800c023cf337-pg-dedicated`, instance ID `363114b7ca6cab22c5406779dcfe8e183e96d9efca2bf33ac81719ef1c87d104`, RUNNING, host `127.0.0.1:55434 -> 5432/tcp`, only dedicated network `mcft-cap09-800c023cf337-pg-isolated`, volume `mcft-cap09-800c023cf337-pgdata`; historical shared PG `/mcftcap09requal72dc0304a21a-postgres-1`, ID `12414c279fb4069b07687469b5aa78b8b49da054bb4730ca6f0b06a8d1b68a01`, RUNNING, `127.0.0.1:55432`, different network `mcftcap09requal72dc0304a21a_isolation`; historical MinIO `/mcftcap09requal72dc0304a21a-minio-1`, ID `952016cb6e18295242b6ea895004ae2541470be460708147ba001521bf907c70`, RUNNING, `127.0.0.1:59000`, same historical network. Do NOT mistake legacy MinIO instance presence for Run 800c tenant/bucket/ACL proof.
- **Next operator SQL probe FAILED ONLY AT AUTHENTICATION, NOT SCHEMA:** previous proposed `docker exec -u postgres mcft-cap09-800c023cf337-pg-dedicated psql -X -w -U postgres -d postgres ...` returned `psql: error: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: fe_sendauth: no password supplied`. The flag `-w` deliberately disables prompting; running inside container as OS `postgres` does NOT bypass PostgreSQL `pg_hba.conf` password authentication. Therefore no SQL inventory executed, no SQL mutation and no DB failure shown. Classify `POSTGRES_AUTHENTICATION_EVIDENCE_MISSING`; **NOT** `SCHEMA_ACL_FAILED` and NOT an instruction to reset passwords, weaken `pg_hba.conf`, re-provision DBs or change ownership. Prior proposed command was unsuitable without existing credential: do not repeat it.
- **Credential-safe recovery:** use already provisioned `qual_admin` audit/readonly credential or approved scoped read-only account and an **interactive password prompt**, not `-w`, not credentials printed to terminal/chat/CI/logs. First do a SELECT-only identity probe on the run-specific positive DB (then negative); no need to connect to admin `postgres` DB or demand superuser. Example operator-local interactive command (requires operator to know existing password; no auto issuer or secret recovery): `docker exec -it mcft-cap09-800c023cf337-pg-dedicated psql -X -h 127.0.0.1 -p 5432 -U qual_admin -d mcft_cap09_requal_800c023cf337_positive -W -v ON_ERROR_STOP=1 -c "BEGIN READ ONLY; SELECT current_database(), current_user, current_setting('transaction_read_only'); COMMIT;"`. In-container port is 5432; host binding 55434 is checked by Docker. Avoid outputting password, secret env, `docker inspect .Config.Env`, or manipulating PG role. If no confirmed existing password, stop and request operator credential-provisioning proof; don't guess.
- **Still missing BEFORE any TEST_ONLY:** fresh both-DB identities, counts/29 tables/2 routines/zero rows per governed contract, independent positive/negative low-privilege ACL denial/readback with actual approved roles, MinIO run-scoped bucket/key prefix identity and least-privilege negative tests without writes, immutable anchor digests and replay, main postmerge governance checks, clock/headroom and independent issuer/operator/nonce/permit signing authority. Main registry `scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json` is `adopted=false`, `execution_enabled=false`, `issuers=[]`, `host_id/operator_id/ledger_root=null`; retain `FAIL_CLOSED_EXECUTE_HOLD`, never silently issue TEST_ONLY permit.
- **GitHub workflow lookup interpretation correction:** connector `fetch_commit_workflow_runs` *only returns pull-request-triggered runs* by its contract; `[]` for merge SHA **does not prove there are zero main push or workflow_dispatch runs**. Use `gh run list --repo liyongshang44-max/GEOX --commit 8563fc7025fc6e2aa6fd8b8e217f168c9caa59ed` / Actions UI to locate postmerge push/manual Formal readiness. QCP workflow is `pull_request`-only and has no push/dispatch path as checked in main, so exact-main QCP requires separate governed read-only evidence; do not invent PASS.
- **Handoff continuity:** only modify this second Active Continuation document on Draft/Open/Unmerged PR #3298, pure prepend, preserve all earlier text. Issue #3698 tracks TEST_ONLY qualification. No third handoff.

## Next owner actions, order and safeguards

1. Inspect V2 JSON above; accept Docker identity PASS only. Preserve all existing containers, DBs, MinIO, volumes, evidence, original auth configuration, and frozen runtime.
2. Resolve authentication strictly via *existing* approved low-privilege login and interactive prompt. Record sanitized SQL readonly PASS/FAIL separately per positive and negative DB; never share secrets.
3. Obtain fresh Schema/ACL and MinIO positive/negative read-only evidence, existing scoped S3 credential readbacks, exact-main workflow conclusions.
4. Independently review issuer/ledger/clock evidence; until then `TEST_ONLY=HOLD, execution_authorized=false, production_authorized=false`.

---

# 2026-10-13 — PR #3700 formally approved and merged to protected main; post-merge run proof not yet produced

Independent reviewer `victse999` submitted GitHub `APPROVED` at `2026-10-13T02:05:53Z` for PR #3700 (other review `COMMENTED` only). All latest PR HEAD `5387f74de6541565aa8db022726aa0341a862bb8` checks: 28 SUCCESS, 1 expected Producer-live SKIPPED, none failed. Governance merge successfully executed using expected HEAD and merge_method=merge; PR #3700 CLOSED/MERGED at `2026-10-13T02:06:54Z`; merge SHA and independently fetched `main` SHA are exactly `8563fc7025fc6e2aa6fd8b8e217f168c9caa59ed`. This is source adoption only, NOT TEST_ONLY or production authorization.

Post-merge GitHub Actions lookup at exact main SHA returned ZERO workflows; no post-merge QCP or Formal Readiness success can be claimed. QCP workflow `.github/workflows/mcft-cap-09-qualification-control-plane-v1.yml` is `pull_request`-triggered with no `workflow_dispatch` nor `push` event. Formal Readiness `.github/workflows/mcft-cap-09-formal-v5-post-graduation-readiness.yml` DOES support manual `workflow_dispatch` on main. Main's static QCP/evidence files are present but exact-main execution proofs remain outstanding. The main trust file `scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json` has `adopted=false`, `execution_enabled=false`, `host_id=null`, `operator_id=null`, `ledger_root=null`, `issuers=[]`, all real delay and stage capability adoption false. Legacy isolated six-hour policy still explicitly checks strict >6h. Exact Run ID `800c023cf337` dedicated endpoint is `127.0.0.1:55434`, but actual operator-host PostgreSQL/MinIO, two DBs, schema/ACL readbacks and credentials, evidence digests, owner/issuer/permit and fresh headroom have NOT been revalidated in this merge checkpoint. No TEST_ONLY signing. Stage state `FAIL_CLOSED_EXECUTE_HOLD`, execute_authorized=false, production_authorized=false. Do not infer successful operator-host qualifications or main QCP from premerge green CI. Next: get live Formal Readiness dispatch on main; arrange QCP exact-main read-only revalidation (workflow currently lacks manual dispatch, do not bypass); collect actual 800c host binding/ACL/issuer evidence before independent TEST_ONLY authorization adjudication. Handoff PR #3298 is the one existing continuation and remains separate/unmerged.

---

# 2026-10-13 — formal PR #3700 review discovered missed dedicated PG regression

On prior head c8b11c1eed6fa9f6ce8d9ae0c49867fedcf16fb5 all 28 completed applicable GitHub checks succeeded (Producer live skipped), but independent code review inspection of the PR diff caught a previously UNEXECUTED negative regression: `ACCEPTANCE_MCFT_CAP09_DEDICATED_PG_ENDPOINT_V1.cjs` asserted bridge never contained `database_port===55432`, yet bridge preserves exactly that legacy synthetic branch for non-800c run IDs. Green CI was insufficient because new test was not wired. Review #5494150417 documents issue. GitHub rejected the author's REQUEST_CHANGES review (`Review Can not request changes on your own pull request`), and COMMENT was recorded; no independent APPROVED review exists.

Targeted fix to contradictory test commit 9530f7e53cff46988ecc458680f18d129eac0e34 now asserts exact 800c dedicated guard AND inherited synthetic branch, still requiring host URL guard on dedicated port. Workflow commit 5387f74de6541565aa8db022726aa0341a862bb8 wires test into Local Cutover checks; this is latest PR head. New workflow runs #38285379348 Local Cutover, #38285379228 QCP, #38285379161 EA5E2, #38285379534 CI were QUEUED at checkpoint, no PASS claim. Main not changed; PR #3700 Open Ready for Review Unmerged, reviewer approval pending. Therefore main post-merge QCP/Formal Readiness NOT YET checked, TEST_ONLY issuer registry not enabled and no permit issued. `FAIL_CLOSED_EXECUTE_HOLD`, execution_authorized=false, production_authorized=false.

---

# 2026-10-13 — current-main exact Phase2 evidence qualification candidate, NOT YET adopted

In Draft PR #3700, fixed target `800c023cf337` and exact protected-main predecessor `adfaf9fdbd2c75923fb298e26b5d5d106a0fc61a`. Fresh Phase2 Actions run `38281449457`, workflow number `546`, job `114919428739`, at source subject `9e4e8132628f2581cbac025f81f7342027660631` completed SUCCESS (original qualification logs PASS, governed base `adfaf9...`); original ZIP artifact ID `11761517036` is separately reported and *not* promoted to a claimed artifact digest. Phase2 EXACT_PATH_SET has 23 members and current dependency digest `sha256:d53545afb8deac0c0f232774c82f4f0ce4269ee26a7f3f7286e50e39d4e9ff5d`; old Phase2 evidence has different dependency digests and is not rewritten or automatically inherited.

The engineering candidate appended immutable `IMMUTABLE_WORKFLOW_RUN` entry `PHASE2_EVIDENCE_PROVIDER_MODULES_REQUAL_9E4E8132_DEDICATED_PG_V1` with explicit run, subject, workflow path, current digest, stage and binding sha256 `d25ea51f28018727a4083859a824a592c803ccafd4fff84e1c512223635a0a76`; corresponding durable snapshot records run_number 546, exact base/subject/workflow/event, without inventing unknown created/updated timestamps. Registry append commit `3a6a3c0d4eb49e923814dbd650caae1825a9ad85`. Exact Preflight conditional for this one evidence+run+subject+workflow+base and historical #3692 replay (not a global predecessor addition) commit `44daa38d77742e3dea6e861f0b9f7f56c3072017`. QCP exact metadata checks for the same run plus `verifyAdoptedLocalCutoverScopeDiagnostic()` protected main, no divergent REST PR bases, commit `c8b11c1eed6fa9f6ce8d9ae0c49867fedcf16fb5` (current PR head). The inherited #3692 science-specific condition remains. No global SHA allowlist expanded, historical entries not mutated, scientific core unchanged, no execution flag changed.

CI for current head was queued/pending at checkpoint, NOT CONFIRMED PASS; run `38283663822` QCP, `38283663943` EA5E2, `38283663352` CI and `38283663383` local cutover. Do not merge until all checks and actual fresh immutable evidence vetting PASS. Separate handoff PR #3298 remains Draft/unmerged. `FAIL_CLOSED_EXECUTE_HOLD`, execution_authorized=false, production_authorized=false; no Producer/Timing/infra writes.

---

# 2026-10-13 — Phase 2 exact closure and candidate fresh run evidence

Read-only adjudication of Draft PR #3700 at head `9e4e8132628f2581cbac025f81f7342027660631`: `PHASE2_EVIDENCE_PROVIDER_MODULES` is EXACT_PATH_SET (23 owned files); frozen policy `FRESH_REQUALIFICATION_REQUIRED_NO_CARRY_FORWARD`. The actual dependency change relative to current protected base is solely `scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4_BINDING.cjs`; QCP current digest `sha256:d53545afb8deac0c0f232774c82f4f0ce4269ee26a7f3f7286e50e39d4e9ff5d`. All six previously registered Phase2 workflow proofs have mismatching dependency_digest and must not be promoted or rewritten. The exact-head live Phase2 GitHub workflow `38281449457` (job `114919428739`) completed SUCCESS, produced qualification PASS, original event base `adfaf9fdbd2c75923fb298e26b5d5d106a0fc61a`, exact subject `9e4e813...`, artifact id 11761517036; no production entitlement is implied. New run is a viable candidate but is NOT YET accepted in durable register: QCP's `governed_successor_predecessors` does not contain that current protected main `adfaf9...`, and immutable run snapshot/dep digest/binding and exact proof-bound base eligibility must be verified before registration. Do not add broad SHA allowlist, modify old immutable rows, or equate workflow PASS with governance qualification. Existing PR #3700 remains Draft/Open/Unmerged; `FAIL_CLOSED_EXECUTE_HOLD`, execution_authorized=false, production_authorized=false.

---

# 2026-10-13 — historical Actions PR-association empty array confirmed and narrow verifier fix

Operator queried original GitHub REST workflow run `38192933253`: event=pull_request, head_sha=4911558874297afc81d10bf3051ff4f1a8f6fabd, pull_requests=[]. This resolves the earlier unknown: the REST association is genuinely empty, not one base. Original job log captured event PR base 3857b91b8ab2b4eddff9e7b1b0b30f9bc37d7358 and governed_base_sha matching; durable requalification snapshots for exact run IDs 38192933253 (Phase2) and 38192933309 (Phase3) record the same base and exact workflow/head. PR #3692 merge equals the frozen base. Historical verifier previously demanded exactly one REST association and rejected this valid empty result.

Dedicated engineering Draft PR #3700 commit `9e4e8132628f2581cbac025f81f7342027660631` modifies only its QCP workflow's narrowly constrained historical science admission: expected evidence IDs must match exact workflow paths and exact run IDs, snapshot and live run exact head plus snapshot base must equal the adopted #3692 merge, historical replay proof must PASS, and REST associated bases may be either empty or exactly one matching adopted base; any mismatched/multiple bases still denied. Does NOT change shared global allowlist, historical immutable evidence, science kernel, accepted graph digest, or actual production/auth flags. CI/QCP were running after commit, no PASS claim without actual completion. Run 800c023cf337 remains `FAIL_CLOSED_EXECUTE_HOLD`, execution_authorized=false, production_authorized=false. Main unchanged; #3700 Draft/Unmerged, second Handoff #3298 Draft/Unmerged.

---

# 2026-10-13 — EA5E2 graph rebind passed; original science run event-base verified; REST association remains unknown

In Draft PR #3700, changed only generated EA5E2 digest carrier from sha256:554bf1270b9a81ff056a1bfac73375a988ed169b16c262c53bdbeb59fc747154 to exact expected digest sha256:209abfbd63f5d7ea9ca6666742bd30c3f9ea061b964c6f3055dd9c47cda11f70, as computed and recorded by previous live GitHub Actions graph run. Commit a23a350ff72158ec675d3dc312868ca3a912c939. Recheck run 38281047578 EA5E2 runtime-dependency-graph completed SUCCESS. No science-core changes, no graph checks removed.

Read-only original historical run 38192933253 logs (job 114629376298) explicitly show GitHub pull_request event base_sha 3857b91b8ab2b4eddff9e7b1b0b30f9bc37d7358 and governed_base_sha same, checked-out subject 4911558874297afc81d10bf3051ff4f1a8f6fabd and qualification PASS. GitHub PR #3692 merged commit 3857b91b8ab2b4eddff9e7b1b0b30f9bc37d7358; PR #3697 base matches. However, the separate REST run.pull_requests array, on which immutable evidence verifier requires exactly one matching PR base, was not returned by available read-only connector actions. Its actual cardinality and contents remain UNVERIFIED. Do not relax, invent or override list identity; no edit to immutable evidence verification gate pending the exact run metadata. Qualification control-plane workflow run 38281047701 was in progress at last check. Technical and owner proof not a signing permit. FAIL_CLOSED_EXECUTE_HOLD; execution_authorized=false; production_authorized=false. Keep PRs #3700 and #3298 Draft/Unmerged; no host resources touched.

---

# 2026-10-13 — scoped registry and EA5E2 scientific-trigger correction candidate on PR #3700

Following original PR failures, inspected frozen `GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json`, central `PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs`, and `.github/workflows/mcft-cap-09-ea5e2-runtime-dependency-graph.yml` together. Planner FAIL was specifically `unknown_changed_paths` for the newly created `MCFT_CAP09_DEDICATED_PG_ENDPOINT_V1.cjs` and `ACCEPTANCE_MCFT_CAP09_DEDICATED_PG_ENDPOINT_V1.cjs`, while resolver errors/authority errors were empty. The existing LOCAL_CUTOVER_EXACT_SCOPE_20261011_V1 governed path set already includes the changed retry bridge/host; the two new paths now explicitly join that set, rather than suppressing unknown-path failures.

Separate `scientific-core-requalification` job always asserted PR must modify the GFS scientific core regardless of changed paths; corrected it to ALWAYS retain complete EA5E2 dependency graph/retirement assertions AND compare current scientific-core bytes against git base: if science listed as changed, bytes must differ; otherwise bytes must remain identical. No scientific-core change, forced NOT_APPLICABLE, deleted job, or relaxation of independent scientific graph evidence. Before branch push, in-memory JSON/ownership and workflow assertion checks passed. PR #3700 correction commits: registry `d81e7150bebc669389ecab6966356a272a7110df`, EA5E2 workflow `e1137ab82524409e3533c45fa310052758bdcd90` (current head). GitHub workflows were queued/pending at checkpoint, therefore CI PASS NOT CLAIMED and adoption FORBIDDEN until verified green. Enlarged workflow trigger set due registry/workflow changes is expected; review all applicable checks. Handoff is independent PR #3298, no main merge, no host/PG/MinIO/Provider changes. `FAIL_CLOSED_EXECUTE_HOLD`, `execution_authorized=false`, `production_authorized=false`.

---

# 2026-10-13 — PR #3700 failures classified; one targeted inheritance fix

CI diagnosis for Draft PR #3700 original head fc1df7da: Local cutover isolated-clock job failed DEDICATED_PG_RUN_ID_REQUIRED because inherited synthetic admission fixture uses run abc123def456 and prior new code erroneously required live run 800c023cf337 for *every* invocation. A single targeted correction on PR branch commit 368e1cac3eb1d791b5a55db31578b533011df9a6 restores the original synthetic/other-run structural condition (loopback 55432), while run 800c023cf337 remains pinned to dedicated 55434, including live host URL check. A local isolated six-case logic reconstruction PASS was run before correction; original local-cutover candidate workflow now reports SUCCESS on corrected head. Do not imply synthetic 55432 is an actual permitted live endpoint.

Separate EA5E2 runtime-dependency-graph failures are unrelated inherited workflow applicability: scientific-core-requalification job asserts changed GFS scientific Python core, which PR #3700 properly does not change; dependency closure path also exits 1. These must be reviewed as governance applicability; modifying science core merely to turn the check green is prohibited. Full CI and baseline engineering checks were pending at last observation. PR #3700 remains Draft/Open/Unmerged, main not changed. No permit, no resource changes, execution_authorized=false, production_authorized=false; FAIL_CLOSED_EXECUTE_HOLD.

---

# 2026-10-13 — isolated PostgreSQL 55434 binding engineering candidate

Created dedicated engineering branch `fix/mcft-cap09-800c-dedicated-pg-port-gate-v1` from protected main `adfaf9fdbd2c75923fb298e26b5d5d106a0fc61a`, Draft PR #3700 (OPEN, UNMERGED), head `fc1df7da7ae2a225e2612c18535f930aa9197d21`. Source change: new exact-run PG binding helper, admission bridge and governed retry host both require run `800c023cf337` on dedicated loopback `127.0.0.1:55434`; shared historical `55432` must fail. New regression test covers positive/negative DB URLs, wrong ports/hosts, old/replaced run IDs, wrong DBs, URL parameters, and unchanged disabled trust registry. Total PR change is four files, no Docker/database/environment mutation. Tests were COMMITTED, NOT YET EXECUTED/CI VERIFIED. PR status at creation reported mergeable=false, not interpreted as final review verdict. Protected-main merge, QCP and Windows validation still required. The existing frozen audit_user=qual_admin requirement and cryptographic permit/clock conditions remain separately unresolved; no grant implied. Continue FAIL_CLOSED_EXECUTE_HOLD, execution_authorized=false, production_authorized=false. Keep this Handoff as separate existing Draft PR #3298, OPEN/UNMERGED; do not merge it to advance code.

---

# 2026-10-13 — final adoption and TEST_ONLY permit review against executable frozen gates

Decision: NOT_ADOPTED / NO_PERMIT / FAIL_CLOSED_EXECUTE_HOLD. Owner acceptance of historical cross-evidence is recorded and only resolves that evidence-admissibility question; does not grant independent retry issuance or execution.

Inspected protected-main code: scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json has adopted=false, execution_enabled=false, host_id/operator_id/ledger_root null, issuers=[] and all four delay/stage adoption gates false. scripts/runtime_acceptance/MCFT_CAP09_RETRY_PERMIT_V1.cjs requires independent INDEPENDENT_RETRY_GOVERNANCE issuer, valid enrolled Ed25519 signature and fingerprint, exact host/main/clean state, digest-bound ARM/observations/plan, max 24-hour issuer-window-valid lifetime, one-time nonce and run ledger reservation; verifying or consuming alone does not authorize execute. Governed retry host also requires activated trust, explicit armed/execute/retry grants, fresh readback <= 5 minutes, output non-reuse, six-stage bounded plan, matching resource endpoints and deadlines.

Concrete blocker: existing dedicated isolated PG qualification used 127.0.0.1:55434, system ID 7695721255092854818. Current MCFT_CAP09_ISOLATED_RETRY_ADMISSION_BRIDGE_V1.cjs and MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs strictly assert 127.0.0.1:55432, historic shared PG endpoint, while run-scoped Positive/Negative DB names and MinIO target endpoint 127.0.0.1:59000 are required. Do not remap dedicated PG into shared endpoint, patch frozen code, enable registry booleans or sign a synthetic permit. Needs separately reviewed engineering successor to accept and attest exact dedicated PG endpoint with no relaxation of isolation boundaries, followed by independent protected-main adoption and host exact-head requalification.

Run ID 800c023cf337 remains fixed; subject observed at prior review adfaf9fdbd2c75923fb298e26b5d5d106a0fc61a but must revalidate HEAD == protected main at issuance and launch. No current adopted issuer/key, host trust binding, signed nonce permit, time window, fresh <=300-second host resource readback, final deadline budget, or qualifying permission event. Technical PG 48/48 and MinIO scoped/independent evidence remain valid historical inputs, not fresh admission. No execution, production or infrastructure mutations. execution_authorized=false; production_authorized=false. Second Handoff on draft PR #3298 kept unmerged.

---

# 2026-10-13 — Owner decision: accept corroborating historical evidence

Owner explicitly accepts a cross-evidence standard for historical shared-instance attribution in fixed run `800c023cf337`: original V2 PowerShell direct invocation, matching original Preflight, and original failed provisioning receipt may be considered together. The original direct V2 command (PSReadLine line 209496, SHA256 `f9a1d27c596806794c94301e52910c12893c918b6f353410c5da19d1dc5f8a31`) had no named arguments or splatting; script default is shared container `mcftcap09requal72dc0304a21a-postgres-1`. Preflight identifies same container/network; failed receipt SHA256 `047661125d271447905ef7984d6acdd0f4f1b8417d688c1f81624853fcb682de` records matching run/roles/databases and `ROLE_PRIVILEGE_READBACK_MISMATCH`. Accept association as `OWNER_ACCEPTED_CROSS_EVIDENCE_HISTORICAL_ATTRIBUTION`; no fabricated execution-time container ID or assertion of one-to-one invocation/receipt cryptographic proof. Old failed instance remains separate from new qualified dedicated PG (system identifiers 7694946540638810151 vs 7695721255092854818).

The prior historical-evidence *owner acceptance decision* is now recorded and does not require additional old-instance probing. Formal frozen-rule/governance applicability check and any independent acceptance remain separate if mandatory; this decision is not a technical retest, final qualification PASS, TEST_ONLY permit, or production authority. Dedicated PostgreSQL 48/48 and MinIO scoped checks and independent artifact review retain their previously verified ranges. No Producer/Timing/Formal deployment or mutations. Current gate `FAIL_CLOSED_EXECUTE_HOLD`, `execution_authorized=false`, `production_authorized=false`, pending separate authorized adoption / single-use permit.

---

# 2026-10-13 — final evidence applicability matrix and closure decision, run 800c023cf337

DECISION: EVIDENCE_RECONCILED_AUTHORITY_NOT_GRANTED / FAIL_CLOSED_EXECUTE_HOLD. Historical shared-PG failure is valid **negative/historical preservation evidence**, NOT positive qualification for the dedicated PG. Its association with old shared container is HIGH_CONFIDENCE_COMMAND_HISTORY_CORROBORATED: original V2 defaults to old container, original preflight identifies same resource, PSReadLine line 209496 is a direct V2 call without named args or splatting, and original receipt has matching run ID/error. However, no execution-time container ID/system identifier in original failure receipt; exact emitting command/time cannot be verified retrospectively. Do not state HISTORICAL_INSTANCE_BINDING_PASS.

Independent technical evidence eligible for dedicated positive qualification: new PG system ID 7695721255092854818 (old shared PG 7694946540638810151); PG receipt 0dadd9b79e7b6bb6318bccc30de6eebff6df6ee7a354b1e374c45d7e39562a6e with 48/48 native Windows TCP probes across four app roles, 29 tables and two routines per DB, zero rows and role/ACL separation. Schema receipt f9a7bbb2bbf0103fcf56625b48cbf77f7d47304dbc375069fd0b98e10ebef63a. MinIO app scoped target bucket and valid unrelated principal negative access, 403 AccessDenied on tested cross-scope calls and zero objects, versions, markers, multipart; signed ListAllMyBuckets 200 scoped to target (not 403). MinIO v3 receipt fa44b022e86a09b8f2558ded948f9337b7b18102e0a9ef082974636e842d1f5b. Independent review reports 25/25 evidence references and 10 XML responses, no new PG host probe. External review ZIP cf b? Do not promote wrapper proof to new host evidence.

Applicability finding: historical failure is scoped to shared failed instance and cannot be used to invalidate independently evidenced dedicated instance or supply missing execution-time linkage. Defect in retrospective old-instance binding remains DISCLOSED_UNRESOLVED pending decision against frozen requirements by an empowered independent governance authority; no implicit exception is adopted. Technical evidence consolidation is CLOSED_AS_TO_LISTED_CHECKS, governance/permit closure NOT SATISFIED. Any future permit must be a separately adopted scoped/time-bound/single-use TEST_ONLY authorization with full resource bindings. No Producer, Timing, Formal or production actions, no rewrites of receipts, no credential or environment changes. execution_authorized=false; production_authorized=false. Keep second Handoff draft #3298 open and unmerged.

---

# 2026-10-13 independent qualification adjudication — run 800c023cf337

Verdict: FAIL_CLOSED_EXECUTE_HOLD, execution_authorized=false, production_authorized=false. Do not infer a TEST_ONLY permit from subsystem PASS.

Verified inherited technical evidence: dedicated PostgreSQL distinct cluster system ID 7695721255092854818, independent container/volume/network, 29 tables and 2 routines per positive/negative DB, zero rows; four isolated Evidence/Twin login principals, role and database ACL checks and 48/48 Windows-host TCP authentication/privilege probes PASS. MinIO target bucket mcft-cap09-requal-800c023cf337, dedicated app principal and bucket-only policy, scoped operations/denials, unrelated non-admin principal own-bucket success vs target LIST/GET denied, and current objects/versions/delete-markers/multipart all zero. Signed global ListAllMyBuckets is HTTP 200 with only the target bucket, not HTTP denial. Independent reviewer reports 25/25 attachment references and 10 S3 XML parses validated; host probes were not rerun by that review.

Historical old-shared failure: original failure receipt SHA256 047661125d271447905ef7984d6acdd0f4f1b8417d688c1f81624853fcb682de, matching original V2 script/preflight/default old container. PSReadLine line 209496 checksum unchanged, direct V2 call, no named parameters or splatting. This provides high confidence but does not independently prove the exact command generated the original receipt or give contemporaneous Docker container-ID binding. Keep provenance limit explicit; no invented retrospective proof.

Blocking authority conditions: an independent final governance decision must determine whether corroborated historical isolation meets the frozen requirement or requires a formally recorded exception; reconcile the final qualification record and its evidence references with that decision; only a separately adopted, time-scoped, single-use TEST_ONLY permit may enable execution. No permit is present. Further database reprovision, resetting identities, MinIO rewrites, Producer, Timing, Formal or production execution is prohibited under current hold. Maintain protected main unchanged and second Handoff PR #3298 Draft/Open/Unmerged.

---

# 2026-10-13 — original V2 invocation structure verified

Operator read-only check on PSReadLine history line 209496 returned DIRECT_V2_CALL=True, SPLATTING_PRESENT=False, ARGUMENT_KEYS=[] and COMMAND_STRUCTURE_CHECK_COMPLETE. The line's prior SHA256 f9a1d27c596806794c94301e52910c12893c918b6f353410c5da19d1dc5f8a31 was independently confirmed unchanged. This supports a direct V2 invocation with no explicit named command arguments and no splatted parameters; the frozen V2 script defaults Pg to historical shared container mcftcap09requal72dc0304a21a-postgres-1. Original preflight names the same shared container and historical failure receipt records ROLE_PRIVILEGE_READBACK_MISMATCH. Historical attribution is HIGH_CONFIDENCE_COMMAND_HISTORY_CORROBORATED, not execution-time container-ID proof: PSReadLine lacks verified timestamps/exit status and does not alone prove this exact invocation emitted the receipt. Earlier full-file SHA256 b1a44983ebfaee92fde0094bead9d4c48d626b6f13c4b018ec99ac30a9a7239f (210193 lines). No further database operation is warranted. Preserve original failed resources and evidence. FAIL_CLOSED_EXECUTE_HOLD; execution_authorized=false; production_authorized=false. Remain on second Active Continuation Handoff, PR #3298 Draft/Open/Unmerged.

---

# 2026-10-13 — verified PowerShell history target line

Read-only operator scan of PSReadLine ConsoleHost_history.txt: latest whole-file SHA256 b1a44983ebfaee92fde0094bead9d4c48d626b6f13c4b018ec99ac30a9a7239f; 210193 lines. Earlier full-file hash changed as additional history accrued, but line 209496 retained its original SHA256 f9a1d27c596806794c94301e52910c12893c918b6f353410c5da19d1dc5f8a31 (ORIGINAL_COMMAND_UNCHANGED_PASS). This line contains V2 provisioning script mention, is classified as an invocation, has no literal -Pg argument under the scan regex, and does not end with backtick continuation. Neighbouring lines 209495 and 209498 classify as invocations but contents have not been examined. The scan does not exclude splatting or indirect arguments, and the actual invocation target cannot yet be conclusively confirmed. Historical attribution remains strongly corroborated but not definitively proven.

Historical supporting evidence: V2 default shared PG container mcftcap09requal72dc0304a21a-postgres-1, preflight same container, historical original failure ROLE_PRIVILEGE_READBACK_MISMATCH, old PG system identifier 7694946540638810151 distinct from dedicated 7695721255092854818. Retain FAIL_CLOSED_EXECUTE_HOLD, execution_authorized=false, production_authorized=false. No resource mutations; this is a continuation of the same second Handoff, draft PR #3298.

---

# 2026-10-13 — PowerShell launch-command provenance review, preservation-first

- Owner requested inspection of contemporaneous PowerShell command history and terminal transcript for actual invocation of `MCFT-CAP09-800c023cf337-PG-PROVISION-V2.ps1` and possible `-Pg` override. Review of *available uploaded evidence* and repository Handoff found source/default-container concordance, **but no contemporaneous full PowerShell invocation or transcript proving whether `-Pg` was overridden**. The user's local PSReadLine history and terminal scrollback are not accessible via GitHub/ChatGPT and have not yet been examined; **do not mark history check PASS**.
- Original V2 script SHA256 `4fb0ea0b4511d1904f6f437c9c9f48c298e0516adbdd6c699f6b95411cca6734`, default `mcftcap09requal72dc0304a21a-postgres-1`; original preflight `da2b7fdc02d6a5144ed1f6f377ba5369c7d19ecb55d27fd66f8ac710420a769f` names shared container and network; original failure receipt SHA256 `047661125d271447905ef7984d6acdd0f4f1b8417d688c1f81624853fcb682de` records `ROLE_PRIVILEGE_READBACK_MISMATCH`. These establish `STRONGLY_CORROBORATED_INVOCATION_OVERRIDE_UNVERIFIED`, not cryptographic proof of launch target.
- Old shared instance still independently observed: container `12414c279fb4069b07687469b5aa78b8b49da054bb4730ca6f0b06a8d1b68a01`, PG system identifier `7694946540638810151`, distinct dedicated PG system identifier `7695721255092854818`; startup logs show `01-create-identities.sh` created six roles/two databases on 2026-10-10. The script's named identities are the six GEOX runtime roles, not `800c` application login roles; don't mistake initialization for later failed provisioning.
- The original PSReadLine history should be inspected *read-only*, with sensitive command arguments redacted, plus PowerShell transcript files only if present. Prove both invocation date/source and any actual `-Pg` override, not merely absence in incomplete history. If no contemporaneous witness is recoverable, retain `UNPROVEN` for definitive attribution.
- Next operator-local task is a read-only history scan; no PostgreSQL/Docker/server mutation, no bootstrap rerun, no Producer. `execution_authorized=false`, `production_authorized=false`, `FAIL_CLOSED_EXECUTE_HOLD`.
- Second Active Continuation Handoff only; keep PR #3298 Draft/Open/Unmerged, preserve prior entries.

---

# 2026-10-13 — historical failed-resource provenance: script/preflight concordance

- Offline review of original local artifacts for run `800c023cf337`: `MCFT-CAP09-800c023cf337-PG-PROVISION-V2.ps1` SHA256 `4fb0ea0b4511d1904f6f437c9c9f48c298e0516adbdd6c699f6b95411cca6734`; `preflight.json` SHA256 `da2b7fdc02d6a5144ed1f6f377ba5369c7d19ecb55d27fd66f8ac710420a769f`.
- The script defaults `$Pg` to historical shared Docker container `mcftcap09requal72dc0304a21a-postgres-1`, runs database commands through `docker exec -i $Pg psql -U qual_admin`, defines four run-scoped login roles and two DBs, explicitly throws `ROLE_PRIVILEGE_READBACK_MISMATCH`, and writes catch output to `postgres-provision-failure-v1.json`.
- Existing raw historical failure receipt at that name (SHA256 `047661125d271447905ef7984d6acdd0f4f1b8417d688c1f81624853fcb682de`) identifies exact run/roles/DBs/error; earlier preflight explicitly identifies same historical shared container and network. Current old PG system ID is `7694946540638810151`, and dedicated PG system ID is `7695721255092854818`.
- This establishes strong source/preflight/error/receipt concordance. It is not a verified contemporaneous launch-command trace: script parameter `-Pg` can override default. Attribution status `STRONGLY_CORROBORATED_INVOCATION_OVERRIDE_UNVERIFIED`; no claim of cryptographically definitive old-resource binding. Only remaining historical discriminator is a contemporaneous command/terminal transcript or runtime container-id witness confirming no override. Do not infer retroactive proof from today's Docker inventory.
- `FAIL_CLOSED_EXECUTE_HOLD`; execution_authorized=false; production_authorized=false. No mutations or Producer execution.

---

# 2026-10-12 old shared instance pg_controldata identity witness

Operator executed Docker read-only pg_controldata under postgres OS user on historical shared container mcftcap09requal72dc0304a21a-postgres-1. Exit code 0; Database system identifier = 7694946540638810151. Dedicated instance previous system identifier = 7695721255092854818. Thus current PostgreSQL cluster identities differ; the old data directory is readable. Historic receipt ROLE_PRIVILEGE_READBACK_MISMATCH lacks contemporaneous container/system-ID linkage; historical failure attribution remains UNPROVEN. No authority: execution_authorized=false; production_authorized=false. Next locate original execution path and dated logs/receipts without mutation.

---

# 2026-10-12 FINAL INDEPENDENT REVIEW — historical FAIL provenance remains unbound; EXECUTE HOLD

- Fixed isolation run: `800c023cf337`; preserve the failed old shared instance and the qualified dedicated instance separately. No new provisioning, no Producer, no authorization. `execution_authorized=false`, `production_authorized=false`.
- User-supplied denial/history evidence review: 8 of 8 outer and 17 of 17 nested attachment lengths and SHA256 hashes matched their evidence manifests; 3 original S3 XML responses parsed and corroborated. Valid unrelated non-admin application principal was shown to access its own bucket (HTTP 200) and denied target-bucket LIST and target-object GET (HTTP 403 AccessDenied). Policy/user/group inventory was recorded. These results support scoped checks and are not proof that every possible external principal is denied.
- Historical `historical-original-001.json` bytes: 654 bytes; SHA256 `047661125d271447905ef7984d6acdd0f4f1b8417d688c1f81624853fcb682de`; recorded `PARTIAL_OR_FAILED_STOP_NO_ROLLBACK` and `ROLE_PRIVILEGE_READBACK_MISMATCH` for four `800c023cf337` roles and two DBs. This historical receipt does **not** contain old PG container ID, PG system identifier, named volume, network or TCP endpoint. It therefore cannot on its own establish that those failed resources resided in the old shared PostgreSQL container. It is prohibited to retrospectively invent an original identity witness.
- Latest independent adjudication: **`FAIL_CLOSED_EXECUTE_HOLD`**, not a TEST_ONLY permit. User-supplied machine-readable verdict SHA256 `abc04887f0ee28cff5bec83a0f4a410a8d5b4ad0e488a99277e3d6ee4865db5a` (verdict file is not itself a fresh host witness). Current dedicated PG 48/48 actual TCP probes and MinIO empty-state/denials stand; do not repeat successful qualification steps.
- Next: perform **strictly read-only** Windows Docker identity and preservation audit of historical container `mcftcap09requal72dc0304a21a-postgres-1`: full container ID/image/inspect, mounts/volume IDs and labels, networks, host binds, PG `pg_control_system()` system identifier, database/role existence and role/database metadata with no secrets. Also inventory preserved original failure receipts and hash raw bytes, then correlate by admissible contemporaneous witness if available. A fresh current-state witness proves today's state, **not retroactive historical attribution**. If the link remains unproved, record `UNPROVEN` and defer to formal governance/exception decision.
- Existing Handoff is the SECOND Active Continuation Handoff in Draft #3298; maintain prepend-only historical continuity, unmerged. Do not change protected main.

---

# 2026-10-12 23:14 +08:00 ACTIVE CHECKPOINT — independent review, two remaining evidence groups

- Fixed run **800c023cf337**. Latest issue authority checkpoint: [#3698](https://github.com/liyongshang44-max/GEOX/issues/3698) (updated 23:07 +08:00). **No new DB/container/volume/network/login/MinIO principal provisioning and no Producer.** `execution_authorized=false`, `production_authorized=false`.
- Operator-provided `MCFT-CAP09-800c023cf337-INDEPENDENT-REVIEW-V1(1).zip` was inspected. Current uploaded ZIP SHA256 **`cfb66d7a9425d559c1ccd1d519fd36f4fd4ce5dac2da3d548ffb40ce9afe5404`**; contains only `independent-review.json` and `review.txt`, not all 25 original raw evidence attachments. The JSON references earlier upstream ZIP SHA256 `bbfd300b477a8985d929bf285198f8c3de5e1024d346b8e6148152b4af1363bc` and final receipt SHA256 `e430cf6eafb75665ee48f01e231d5623f185b79e854e85ecc858787acc379ceb`; do **not** confuse current wrapper ZIP hash with upstream artifact hash.
- Independent review status `VERIFIED_SUBSYSTEM_EVIDENCE_WITH_OPEN_BOUNDARIES_EXECUTE_HOLD`. Report says 25/25 referenced artifact hashes and 10 S3 XML response parses agree, collector and bridge hashes matched delivered sources; reviewer did NOT repeat live PG probes. Four-role **48/48 actual host TCP probes**, 29 tables and 0 postprobe rows in each DB are inherited from SHA-bound PG receipt `0dadd9b79e7b6bb6318bccc30de6eebff6df6ee7a354b1e374c45d7e39562a6e` observed at `2026-10-12T14:09:09.378798+00:00`; individual PG probe raw files are not part of this uploaded two-file ZIP.
- MinIO target-only policy `mcft800c023cf337bucketonly`, policy SHA256 `47b07f9e6dfbe6377fe628eb972f388c3f7cece28757afe86cc36e75530728b6`, direct attachment to `mcft800c023cf337app`; target LIST permitted, anonymous target LIST/object GET and app LIST on three out-of-scope buckets returned actual 403. Object, versions, delete markers, and multipart listings all zero and untruncated. **ListAllMyBuckets HTTP 200** with only the target bucket returned, NOT an API denial.
- Exactly two outstanding groups: **(1)** historical shared-instance FAIL raw receipt bytes/SHA256 plus resource identities/preservation provenance, separately represented as `shared_instance_failed_resources`; **(2)** full relevant MinIO users/groups/policies/attachments inventory and an actual target LIST/object denial with a valid unrelated *non-admin* app principal. Missing group metadata cannot be interpreted as proof no inherited grants. No stored root secret or any user credentials should be shared.
- Prior local closure `FAIL_CLOSED_EXECUTE_HOLD` remains historic evidence, not superseded by automatic qualification. Review is **subsystem evidence**, not a one-shot TEST_ONLY authority or permission to write Formal/production.
- Next action: collect ONLY missing two groups as read-only or denial probes; preserve existing credentials, failure scene, raw files and SHA-bound records. Do not replay prior effectful provisioning, rewrite old receipt or re-run already satisfied TCP tests. After evidence aggregation perform independent governance/adjudication; until then EXECUTE_HOLD.

---

# 2026-10-12 22:02 +08:00 ACTIVE CHECKPOINT — dedicated run 800c023cf337, closure FAIL-CLOSED (not authorized)

**This is the existing SECOND Active Continuation Handoff in Draft PR #3298; prepend-only update, never merge as project authority. Earlier provisioning statements are historical snapshots.** Current protected-main execution subject: `adfaf9fdbd2c75923fb298e26b5d5d106a0fc61a`; main postmerge CI reported successful. Governance: [#3698](https://github.com/liyongshang44-max/GEOX/issues/3698), with updated status `EVIDENCE_CONSOLIDATION_PENDING / EXECUTE_HOLD`.

## Fixed run & immutable boundary
- **Only run `800c023cf337`**; discard never-provisioned proposal `879279919ca5`. Older `72dc0304a21a` shared-instance failure and `c1f7dcc6d04d` burned evidence must be preserved untouched and **never combined with new PASS evidence**.
- Dedicated PostgreSQL 16.4-alpine container ID `363114b7ca6cab22c5406779dcfe8e183e96d9efca2bf33ac81719ef1c87d104`; system identifier `7695721255092854818`; network `mcft-cap09-800c023cf337-pg-isolated` (ID `d8057182e67865dccc350ce7cc8bb72d194d7723c3c05aafacc6af8e5032b3bf`); volume `mcft-cap09-800c023cf337-pgdata`; host port `127.0.0.1:55434`. All dedicated identities must be freshly verified against current Docker, not inferred from this note. Separate Positive/Negative DBs `mcft_cap09_requal_800c023cf337_positive` and `_negative`; four Evidence/Twin run-specific LOGINs. SCRAM host-based auth; dedicated `postgres` default PUBLIC CONNECT initially failed, then narrowly revoked; effective CONNECT 12/12 matrix PASS, **not interchangeable with TCP password-level evidence**.
- Frozen 8 migrations + `facts` bootstrap + 2 fenced-routine ACL migrations applied to both DBs; schema verifier V2 reports **29 tables, 2 routines and zero rows per DB**, table/function grants separated. Uploaded `schema-acl-pass-v2.json`: 54,541 bytes, raw SHA256 `f9a7bbb2bbf0103fcf56625b48cbf77f7d47304dbc375069fd0b98e10ebef63a`; machine receipt identifies exact main SHA/container/system ID, contains 11 migration-source hash declarations and four run-role ACL matrices. The first V1 apply created schema in both DBs but its verifier crashed on `query()` arity; NEVER rerun V1 apply or overwrite the original commit intent.
- MinIO reused existing separate container ID `952016cb6e18295242b6ea895004ae2541470be460708147ba001521bf907c70`, bucket `mcft-cap09-requal-800c023cf337`, dedicated principal `mcft800c023cf337app`, policy `mcft800c023cf337bucketonly`. V1 failed shell CRLF preprocessing on Windows; V2 created identity but verification falsely required `mc ls root` to fail; V3 success `MINIO_TARGET_BUCKET_ONLY_ACL_PASS_ROOT_LIST_FILTERED`, tests exact target write/read/stat/delete/cleanup and historical bucket denial. Uploaded `minio-identity-acl-receipt-v3.json`: 904 bytes, raw SHA256 `fa44b022e86a09b8f2558ded948f9337b7b18102e0a9ef082974636e842d1f5b`. **MinIO global ListAllMyBuckets API explicit denial is unproven** (filtered root list != API denial); other identities/anonymous/version/delete markers/incomplete multipart require separate evidence review. No root S3 keys as app runtime credentials.

## LATEST host result received at 22:02 +08:00
- Operator ran `python -m unittest discover -s $Pkg -p test_closure.py -v`: **14/14 tests PASS** (including rollback sequence, no-secret error, exact identity, wrong-password code, privilege success regarded as failure, network failures not mislabeled as denial, XML S3 response tests, volume/port/network checks).
- Then ran **actual local** `python "$Pkg\closure.py"`, which returned:
  `{"status":"FAIL_CLOSED_EXECUTE_HOLD","report":"D:\\gptdown\\MCFT-CAP09-NEW-ISOLATION-EVIDENCE\\800c023cf337\\qualification-closure-v2-20261012T140200-4201582e\\qualification-receipt.json","sha256":"d3f80c38e8e559ee22dcff2732422093116eb34e1052668e4c1414cd5bb1a9c6","execution_authorized":false}`.
- **Important:** selftests PASS but qualification closure **FAIL_CLOSED**. We have operator stdout, **not the raw qualification-receipt.json**, so failure reason and exact individual TCP/S3 checks cannot yet be independently determined; do not relabel this as PASS or assume the test suite covers successful live host behavior. Preserve that exact closure receipt and SHA; request/review its redacted machine JSON and hash before any further operations.
- Earlier evidence-consolidation V1 bundle was delivered for host audit but its successful live execution is NOT established by this checkpoint. No Producer / Formal / Product writes authorized.

## Next safe work (no new resources)
1. Read and independently hash actual local `qualification-closure-v2-20261012T140200-4201582e/qualification-receipt.json`; locate exact failed or unproven assertion and classify authentication/network error separately from permission denial.
2. Finish identity bindings (PG dedicated container/network/volume/loopback/system identifier, MinIO container/bucket/principal) and attach SHA-256 of **raw evidence files**, not only verifier status. Preserve historical shared FAIL as a physically separate evidence group.
3. Verify real 4-login TCP positive, wrong-password, cross-database/cross-role/superuser-rejection probes and safe rolled-back writes with detailed machine witness. Distinguish catalog ACL 12/12 from TCP proof.
4. Audit MinIO policy attachment, anonymous/unrelated-user access, versions/delete markers/uncompleted multipart list, root-only and filtered-list semantic scope. Do not falsely claim global ListAllMyBuckets explicit denial.
5. Prepare final two-collection qualification receipt, with outstanding edge cases enumerated. Only then a **separate** governed one-shot TEST_ONLY authority review. Keep `execution_authorized=false`, `production_authorized=false` throughout.

## Operator pitfalls to avoid
- Do not ask operator to rerun one-shot bootstrap/namespace/schema/MinIO identity `apply`, nor any historical scripts; existing intents/burned resources preserved. Do not trust untested PowerShell vN fixes: PS 5.1 scalar `.Count`, Docker Go-template quoting, CRLF piping to `/bin/sh`, prompts for SCRAM password without admin credential, and boolean `t/f` vs `true/false` caused false failures.
- ZIP extraction into occupied directories fails on duplicate README; extract to distinct directory rather than `-Force`. Client `mc ls` success with filtered folder is not necessarily S3 universal bucket-list permission. Do not confuse offline selftest success with real qualification PASS. Never print secrets, clear failure receipts, or repeat effectful verifiers after failure.

---

# 2026-10-12 ACTIVE CHECKPOINT — TEST_ONLY PRODUCER MOVED OUT-OF-TREE; HOST PREPARE PACKAGE READY

- **Repository engineering decision:** Draft PR #3696 proved the separate TEST_ONLY binding/Producer implementation with the dedicated no-effect workflow **PASS** at source head `af8266c1549f4a4cb12471aba1e92dd5ba07e80d`, including fail-closed run/DB/S3/main/frozen-runtime checks, TypeScript transpile, production-role fallback isolation and the corrected immutable output-path guard. The remaining EA5E2/local-cutover red was not a Producer bug: central planning reported the six additive TEST_ONLY paths as unregistered / unknown changed paths. Rather than expand QCP/history solely to host a nonproduction operator tool, **#3696 was intentionally CLOSED / UNMERGED**. Protected `main` remains unchanged at `3857b91b8ab2b4eddff9e7b1b0b30f9bc37d7358`; production trust/ARM and the 108 frozen Runtime paths were not modified.
- **Execution architecture now frozen:** TEST_ONLY is an **external Windows host package**, not an in-repository Runtime/QCP member. It requires exact protected main `3857b91...`, a fully clean checkout, and temporarily injects exactly three hash-pinned untracked files from `af8266c...`: binding blob `c3649c12b6ad985ce927697efbfa3bd4b5ffd5ae`, runner blob `95f5581ead1ea5b7122ee601753b045234228f6f`, Producer blob `985d2bb4cc4be14822c10e59ca6638f08b598fe5`. Tracked source stays byte-identical; injected files are removed only if hashes still match and the checkout must return clean.
- **Operator package prepared:** `MCFT-CAP09-TESTONLY-PRODUCER-C1F7DCC6D04D-V1.zip`, SHA256 `fbe2841936e70b6594811b9229c001f0f518fbe75b3bdd8fc6f8974e6b56dd28`. Package is external/local evidence tooling, not GitHub authority. Default run performs: exact-main/clean checks; fresh read-only DPAPI PostgreSQL login re-verification; MinIO run-scoped principal `mcftc1f7dcc6d04d` create-or-reverify using bucket-only policy with explicit Delete deny and no outside-bucket list; root readback proving current/version/delete-marker/multipart remain zero; scientific selftest; hash-pinned temporary TEST_ONLY injection; Producer **preflight only**; cleanup. Default mode performs **0 Provider calls, 0 DB writes, 0 S3 object writes**; MinIO IAM user/policy creation is the only possible setup mutation.
- **Real execution boundary:** only explicit `-ExecuteOnce` proceeds beyond preflight. It chooses a canonical first base >8h ahead (binding requires >6h and <=24h), burns an immutable run ledger **before** Provider/DB/S3 effects, invokes the isolated Producer composition with the run-scoped Evidence LOGIN and MinIO principal, exercises three sequential bases, private raw retention, fenced Evidence writer, post-commit physical readback and the blocked negative DB. Any failure burns the attempt; **no automatic retry / no output reset**. Success must additionally prove S3 physical retention non-empty and emit `MCFT-CAP09-TESTONLY-PRODUCER-HOST-RESULT-c1f7dcc6d04d.json`.
- **Still NOT started:** actual Provider/Producer execution, Timing-1/2/3, controlled delay, Aggregate, Formal-v5, A0, O00, production owner activation and Product publication. Timing/delay are deliberately split into a successor milestone only after the first real Provider→Producer→Evidence persistence PASS.
- **Immediate next operator action:** run the external package **without** `-ExecuteOnce`. Required terminal success markers are `LOGIN_READONLY_REVERIFY_PASS`, `MINIO_SCOPED_IDENTITY_PASS`, `TEST_ONLY_PRODUCER_PREFLIGHT_PASS`, and `PREPARE_COMPLETE_NO_PROVIDER_NO_DB_WRITE_NO_S3_OBJECT_WRITE`. Preserve the generated reverify/MinIO reports. If any check stops, do not repair state ad hoc; preserve outputs and adjudicate the first-red. Only after all four markers PASS should the same exact package be invoked once with `-ExecuteOnce`.
- Existing login authority remains valid through `2026-10-25T17:55:56.650Z`; do not rerun login provisioning and never use `qual_admin` or MinIO root credentials as Producer runtime identities. Historical failed run `72dc0304a21a` remains immutable. Keep this SAME second Handoff PR #3298 DRAFT / OPEN / UNMERGED.

---

# 2026-10-12 ACTIVE CHECKPOINT — REAL TEST-ONLY LOGIN PROVISION PASS; MINIO SCOPED CREDENTIAL AND PRODUCER TEST GATE PENDING

- Operator Windows: 25 local selftests PASS, synthetic acceptance 15/15 PASS; **real** `TESTONLY_LOGIN_PREFLIGHT_PASS_NO_CHANGES` on PostgreSQL 16.4 (`160004`); actual **once-only** `TESTONLY_LOGIN_PROVISION_PASS_PRODUCER_HOLD`, two new per-run LOGIN roles `mcft_cap09_c1f7dcc6d04d_evidence_login` and `mcft_cap09_c1f7dcc6d04d_twin_login`, four real authenticated cross-database permission checks passed. Encrypted DPAPI secret file `D:\gptdown\MCFT-CAP09-LOGIN-DPAPI-SECRETS-c1f7dcc6d04d.json`; result `D:\gptdown\MCFT-CAP09-LOGIN-PROVISION-RESULT-c1f7dcc6d04d.json`; expiration `2026-10-25T17:55:56.650Z`. **DO NOT RUN `--execute-login-once` AGAIN; never export plaintext secrets or use bootstrap `qual_admin` for Producer.** Current output still `producer_authorized=false`.
- Next non-mutating action: operator `--verify-login-only c1f7dcc6d04d` in the SAME Windows account (DPAPI + real password sessions) and preserve returned report. The installer already proved four logins on first execution; separate repeated readback still needed.
- **Source-verified next blocker:** existing `RUN_MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2.ts` hardcodes `EVIDENCE_LOGIN_ROLE = geox_mcft_cap09_evidence_runtime_login_v1` which conflicts with this run's newly proven scoped `mcft_cap09_c1f7dcc6d04d_evidence_login`. The signed governed six-stage host `MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs` also still requires independently signed permit and unadopted registry flags. Design/test a **separate isolated TEST_ONLY runner** binding run-scoped PG login, S3 scoped credentials and real delay gates, without changing frozen production semantics or forging signature/trust flags. Existing isolated Producer composition seam already solves run-scoped bucket without modifying frozen production wrapper.
- MinIO presently only tested via bootstrap/root admin; create a new run-only user/policy for bucket `mcft-cap09-requal-c1f7dcc6d04d` with **no delete and no outside-bucket access**, then independently prove allow/deny before Provider. Root credentials must never be passed to Provider/Producer.
- Historical `72dc0304a21a` preserved. Main last verified `3857b91b8ab2b4eddff9e7b1b0b30f9bc37d7358`; Formal-v5 and Product HOLD; no actual Provider/Producer/Timing/delay. GitHub #3685 comment 6111988041. Keep existing second Handoff #3298 DRAFT / OPEN / UNMERGED.

---

# 2026-10-12 ACTIVE CHECKPOINT — INDEPENDENT TWO-DB ACL AUDIT PASS; SCOPED LOGIN PROVISION PREPARED BUT NOT RUN

- Actual operator Windows independent postinstall readback `POSTINSTALL_READONLY_ACL_PASS_LOGIN_NOT_YET_PROVISIONED`. Two new DBs each **exact 29 canonical tables + 2 SECURITY DEFINER routines**, each of the 58 tables zero rows, per-role Evidence/Twin ACL separation PASS, four scoped NOLOGIN cluster roles **0 LOGIN and 0 memberships**, S3 current/version/delete/multipart all zero. Report `D:\gptdown\MCFT-CAP09-POSTINSTALL-READONLY-ACL-c1f7dcc6d04d-20261011174208644.json`, startup hash `9429e12b4410f81749348ee6f7e1036da801c91568d87ba61ea9e3b4182b985d`, installation result hash `80b7400b86ccd1b5a0d58bc69282d633a3728200c174a685a03a9f319b0fb6e7`, 2 canonical SQL hashes intact. Operator selftest 19 PASS and mock acceptance 12/12 PASS. `producer_authorized=false`. **Never rerun completed schema installer.**
- Prepared NOT EXECUTED new `MCFT-CAP09-TESTONLY-LOGIN-20261012-V1.zip` (SHA256 `4d3a659000cd1eba338227ea936836710497c0170f34e981bfc8a300ffeb9979`). Two NEW per-run LOGIN roles for Evidence/Twin, NOT historic shared production logins; 14-day random credentials encrypted only using current Windows user DPAPI, no plaintext files or process CLI argument; one transactional PG16 role creation, scoped privilege inheritance with SET denied and CONNECT only to the two new DBs; actual four login-by-password readbacks are required for a success receipt. Starts are nonretryable; no automatic recovery if PostgreSQL commit or subsequent ACL readback fails. Local Node selftest 25 PASS, 15 injected-host mock scenarios PASS. **No actual new logins, PG privilege mutations, S3 writes, Provider or Producer calls yet.**
- Execute next: Windows syntax/selftest + synthetic acceptance + real `--preflight-only` using completed postinstall report; only on all PASS one `--execute-login-once`, then explicit `--verify-login-only` on the same Windows account. Preserve encrypted secrets and one-time marker. The verification entrypoint shares implementation and does not replace later independent audit. After real login evidence, review scoped S3 credentials, fresh real Provider availability, TEST_ONLY six-stage admission with negative tests, then actual Provider/Producer/Timing/delays. Original failure `72dc0304a21a`, protected main `3857b91b8ab2b4eddff9e7b1b0b30f9bc37d7358`, production/Formal-v5 unchanged; no forged independent issuer or production trust. Issue #3685 comment 6111935551. Keep this SAME second Handoff, #3298 DRAFT/OPEN/UNMERGED.

---

# 2026-10-12 ACTIVE CHECKPOINT — REAL TEST_ONLY SCHEMA INSTALLED BOTH DBS; INDEPENDENT POSTCOMMIT ACL READBACK PENDING

- Windows operator V1.1 selftest 27 PASS; actual-entrypoint synthetic acceptance 13/13 PASS; **real** preflight `SCHEMA_ACL_TESTONLY_PREFLIGHT_PASS_NO_CHANGES` with 4 unused scoped NOLOGIN role IDs, canonical migration hashes and zero effects.
- Windows operator subsequently ran the ONE-TIME `--execute-schema-once c1f7dcc6d04d` successfully: `SCHEMA_ACL_TESTONLY_MATERIALIZED_PENDING_INDEPENDENT_LOGIN_READBACK`. Both new positive/negative PG DBs now report **29 public tables / 2 routines**, four scoped NOLOGIN cluster roles installed. Receipt `D:\gptdown\MCFT-CAP09-SCHEMA-INSTALL-RESULT-c1f7dcc6d04d.json`; started marker `D:\gptdown\MCFT-CAP09-SCHEMA-INSTALL-STARTED-c1f7dcc6d04d.json`. Installer exit code zero; **never rerun this one-shot command** or clean its marker. Original failed attempt `72dc0304a21a` unchanged.
- This real installation is not yet independent proof of actual **zero row counts / exact 29 named relations / scoped ACL matrix / SECURITY DEFINER function owners / bucket state / runtime LOGIN principal**. Accordingly `producer_authorized=false`; no Provider or Timing started.
- Independent **read-only** postcommit audit ZIP now prepared: `MCFT-CAP09-POSTINSTALL-READONLY-ACL-20261012-V1.zip`, SHA256 `99faf46282b441c7cded405ab807ada82608cff5affbab4ad57c1a6be4851755`; Node syntax and 19 selftest checks PASS; full synthetic audit acceptance 12 scenarios (1 expected PASS, 11 expected FAIL_CLOSED) PASS on native temporary fixture paths, 0 real network/mutations. Checks source and SQL proof chain, all 29 actual row counts x both DBs, four role/DB/schema/table/routine ACLs, exact two SECURITY DEFINER definitions, S3 current/history/deletes/multipart. **NOT RUN ON OPERATOR WINDOWS YET**. A PASS writes only a fresh local evidence JSON; PostgreSQL/S3 are read-only. See issue #3685, comment 6111813982.
- Next exact order: Windows real postinstall audit; only on actual PASS create NEW per-run non-superuser LOGIN principals with scoped CONNECT/inheritance and independent permission-denial proofs; refresh real Provider readiness and budget; implement TEST_ONLY isolation admission with negative tests; then attempt real Provider/Producer/Timing/controlled-delay/aggregate. No independent signer is required as a separate HUMAN approval for isolated testing per owner decision, but existing production-signed runtime guard must not be bypassed or misrepresented. Protected main unchanged at `3857b91b8ab2b4eddff9e7b1b0b30f9bc37d7358`. Product release and Formal-v5 production ARM remain HOLD; #3298 stays DRAFT/OPEN/UNMERGED.

---

# 2026-10-12 SCHEMA INSTALLER TEST-HARNESS CORRECTION — REAL WINDOWS PREFLIGHT PASS / INSTALL NOT EXECUTED

- Actual operator V1 synthetic acceptance failed on first positive mock: `CREATION_AND_EMPTY_BASELINE_REQUIRED`. Root cause was **mock filesystem POSIX `/safe/...` paths under a real Windows Node `node:path` resolver**; a cross-OS test harness flaw. The **real Windows read-only installer preflight nevertheless PASSED**: `SCHEMA_ACL_TESTONLY_PREFLIGHT_PASS_NO_CHANGES`, run `c1f7dcc6d04d`, 2 databases empty, 4 proposed scoped roles unused, 11 migration hashes, zero mutations and `producer_authorized=false`. **No schema installed.**
- A local V1.1 ZIP (`MCFT-CAP09-TESTONLY-SCHEMA-ACL-20261012-V1_1.zip`, SHA256 `048e75a002d5d2be8a465a31eea49a46e7cdeb98aacf49c9d6ad68a3768b904a`) changes **only synthetic acceptance fixtures** to explicit Windows absolute paths / `path.win32`. The installer bytes are unchanged: SHA256 `fc99459219626868c1e16add375484de330cf5e32c16e9dbb7c8ae9389bbf21b`. Local 27 selftest checks PASS + 13 scenario mock acceptance PASS, plus PostgreSQL session read/write boundary assertions; no actual database/S3 changes. See issue #3685 comment 6111724858.
- Next actual step: unpack V1.1 into fresh Windows folder; require selftest, synthetic 13-case acceptance and **fresh real read-only preflight all PASS** before single, nonretryable schema installation in two freshly created DBs. On failure of the one-time install preserve the STARTED marker and all receipts, **never rerun or reset**. Then independent 29-table / 2-SECURITY-DEFINER routine / zero-row / ACL role validation, scoped LOGIN provisioning, live Provider gate and separate TEST_ONLY six-stage runner. Production/Formal-v5, original failure resources and frozen V13 Runtime unchanged.

---

# 2026-10-12 ACTIVE CHECKPOINT — SECOND TEST RESOURCES CREATED AND EMPTY BASELINE PASS; SCOPED SCHEMA INSTALLER PREPARED, NOT RUN

- Actual Windows operator creation result: `CREATED_UNVERIFIED_NOT_SIGNED`, run `c1f7dcc6d04d`, 2 new PostgreSQL DBs on `127.0.0.1:55432` plus new bucket `mcft-cap09-requal-c1f7dcc6d04d` at `127.0.0.1:59000`, audit creation report `D:\gptdown\MCFT-CAP09-RESOURCE-SCAFFOLD-c1f7dcc6d04d.json`. This report does NOT authorize Provider execution.
- Actual Windows read-only baseline is **PASS**: `POST_CREATE_EMPTY_BASELINE_PASS_SCHEMA_ACL_NOT_INSTALLED`, both DBs `0 tables/0 routines`, bucket `0 current/0 versions/0 delete_markers/0 multipart`; exact report `D:\gptdown\MCFT-CAP09-EMPTY-BASELINE-c1f7dcc6d04d-1791738610901.json`. Past `72dc0304a21a` data has NOT been cleaned or reset.
- GitHub main reverified identical to `3857b91b8ab2b4eddff9e7b1b0b30f9bc37d7358`. Newest issue #3685 checkpoint is comment `6111659557`.
- **Architecture constraint:** existing ARM-bound Formal-v5 materializer cannot be run against these nonproduction DBs; the shared bootstrap role `qual_admin` is a verified SUPERUSER. Existing canonical four role names are global and must NOT be overwritten/reused in this isolated test because cross-attempt privileges could leak. Do not demote `qual_admin` or substitute the product schema initializer.
- **Candidate artifact prepared but not host-run**: `MCFT-CAP09-TESTONLY-SCHEMA-ACL-20261012-V1.zip`, SHA256 `ec3fe9fb3dfe876d6db3336499a20b3f7f9d3cd0e660f0c594dac55b9439b63f`. Reads only canonical facts block + 8 frozen schema migrations + 2 canonical SECURITY DEFINER ACL migrations, replaces exactly 4 role identifiers with fresh run-ID-specific NOLOGIN names, targets only two new test DBs, per-DB transaction, 29/2/0 precommit and ACL/owner checks, original resources forbidden, start receipt prevents retry. Local syntax/selftests PASS (27 selftest assertions, 13 synthetic entrypoint cases), **no real Windows schema mutation or valid runtime login provisioned yet**.
- Next: operator REAL `--preflight-only`; after PASS, one-shot scoped Schema/ACL installation and independent PG/S3 readbacks. Then create isolated non-superuser test LOGIN accounts and verify membership/schema/CONNECT boundaries, live Provider causality and TEST_ONLY six-stage runner. No self-signing of old governance permit; old frozen V13 Runtime and production owner/Formal-v5 remain HOLD. Keep #3298 DRAFT/OPEN/UNMERGED, update SAME second active continuation only.

---

# 2026-10-11 ACTIVE TEST-POLICY UPDATE — OWNER APPROVED NONPRODUCTION RESOURCE SETUP; INDEPENDENT HUMAN SIGNER WAIVED FOR TESTS ONLY

Owner decision explicitly recorded in conversation: **“这个执行许可多余了，现在是测试。你直接批准过了。”** This supersedes earlier instructions that nonproduction *testing* must await a distinct human governance signer. No AI signature impersonation or production authorization is asserted. See GitHub issue #3685, latest owner-test comment 6110484665.

- Test run allocation for **resource setup only**: `c1f7dcc6d04d`, attempt ordinal 2, main at decision `3857b91b8ab2b4eddff9e7b1b0b30f9bc37d7358`. Identity is OWNER_ALLOCATED_FOR_NONPRODUCTION_TEST_SETUP_NOT_CONSUMED. The original failed `72dc0304a21a` receipts, databases and bucket must remain untouched; discarded diagnostic ID `4cdb3db5d3b5` not reused.
- Project-owner-approved **effects**: create exactly two NEW nonproduction PostgreSQL databases under `127.0.0.1:55432` and one NEW MinIO bucket under `http://127.0.0.1:59000`, after clean-exact-main and absence checks, using operator-supplied local-only admin credentials. No destruction, automatic rollback, repeated attempt, production connection, owner cutover, Formal-v5/A0 or Product publication.
- Operator package: `MCFT-CAP09-OWNER-APPROVED-TEST-SETUP-20261011-V3.zip`, SHA256 `a79a3783aeee4b9b9967362add0be9ca7b8d2da80fc5c6c6cd2a6e284da5efa7`. Local syntax/selftests PASS: scaffold 6 / changes 0; read-only audit 4 / no external connections; 5 negative no-command admission checks; ZIP integrity PASS. **No actual Windows resource provisioning or PG/S3 access performed by ChatGPT.**
- After resource creation, a separately reviewed qualification-specific schema/ACL installer must install exactly the canonical 29 tables and two fenced SECURITY DEFINER routines on **new DB names only**; then independently read real DB/ACL/zero-row and S3 current/version/delete-marker/multipart state, plus real Provider causal observations and deadline.
- **Existing merged six-stage runtime remains unchanged and technically EXECUTE_HOLD**: it hard-requires independently signed Ed25519 permit, issuer enrolment and adopted trust flags. The owner's test-policy decision does NOT make an unsupported claim that these existing validations passed. To actually run without independent human signing, implement a **separate, explicit TEST_ONLY** admission successor with negative tests and exact-main/nonproduction/immutable-evidence/no-retry/deadline guards. Never merely edit trust JSON, impersonate signer or repurpose production authority.
- This document is the SAME second active continuation Handoff, prepended only; earlier 2026-10-11 and 2026-10-10 checkpoints are historical and their independent-signing directions are now **superseded for nonproduction testing**, but not for production release. #3298 remains DRAFT / OPEN / UNMERGED.

---

# 2026-10-11 ACTIVE CHECKPOINT — #3692 ENGINEERING MERGED; REAL RETRY STILL EXECUTE_HOLD

Evidence cut: 2026-10-11, after GitHub protected-main merge of #3692. **This checkpoint is PREPENDED TO THE SAME SECOND ACTIVE CONTINUATION HANDOFF ONLY**; all older text below remains intact. Do not create a third handoff or mutate the historical canonical handoff. #3298 is DRAFT / OPEN / UNMERGED and must stay that way.

## Executive decision and real status

- **Engineering release #3692 is MERGED** normally into protected main, merge commit `3857b91b8ab2b4eddff9e7b1b0b30f9bc37d7358`; exact 55-path candidate head `127920119284778455424922dc9ef735b0cbeaec` on prior base `5945e459edb212da39b9fe107f87cc07782dd93c`. GitHub compare confirmed that protected `main` equals the merge commit immediately after merge. The PR is CLOSED / MERGED / not Draft.
- On that **premerge candidate head**, all 26 GitHub workflows ended: **25 SUCCESS and 1 SKIPPED** (the real Producer-driven live qualification was deliberately skipped). CAP-09 QCP, CI build and acceptance, EA5E2, CAP-08, Windows Server 2022 and Ubuntu synthetic subprocess/latency tests were SUCCESS. These are exact-SHA **engineering results, not real Windows operator-host evidence**. Independent merged-main push checks are **NOT verified** by the available pull-request-run query and must be separately read before activation.
- Actual code now includes one-shot six-stage parent/child chain (Producer, Timing-1/2/3, Controlled Delay, Aggregate), parent-only Ed25519 stage signing, child atomic ticket burns, fail-stop stage receipts, stdout/stderr/timeout/artifact/claim hashes; three actual HTTPS response waits; three isolated fenced promotion queue waits; three isolated post-commit physical-readback waits; plus six monotonic filesystem scratch cases. The latter are **not** six independent real full-pipeline worst-case injections. Both real Provider/DB/S3 host calls and 24T production execution are **still unperformed**.
- **Authoritative verdict remains `EXECUTE_HOLD`**. Merged trust registry has `adopted=false`, `execution_enabled=false`, null host/operator/ledger, empty independent issuer list, and all four specific stage/transport/pipeline flags disabled. No new run ID, independently signed retry decision, signed Observations/ARM/plan bundle, issuer enrolment or one-use permit has been adopted. Merely setting flags or declaring CI green is NOT sufficient. Formal-v5 ARM, A0, O00–O23 and Product production publication stay prohibited.
- The original run `72dc0304a21a` is a failed first attempt with **Provider call count UNKNOWN**, immutably retained V2/V4/V5/started evidence, no retry permission. Its old ARM / six-hour lead / expiry cannot be recycled; its DBs, bucket, ledger and output cannot be cleared as a fixture or impersonated as a fresh retry.

## Strict next actions — do not rework green CI

1. **Post-merge protected-main readback:** reconfirm exact `main=3857b91...`, 108 frozen runtime paths, historical immutable V2/V4/V5 evidence hashes, QCP/applicability on merged main, and required push-check status (separate from PR head runs). Any new main commit before signing forces refreshed subject binding. Keep the merged engineering candidate and the future activation **separate**.
2. **Independent reviewer governance successor:** obtain independent retry adjudication of failed first attempt and new one-attempt run identity; establish genuine signer/operator distinct identities (Ed25519 public key SPKI SHA256, issuer lifecycle, host binding, immutable local ledger ACL), without storing or publishing private key; adopt a new reviewed ARM and exact signed Observations including Provider-response and promotion/readback delay plans. Record three new future canonical target bases, fresh Provider causal availability and deadline reserve from real host evidence; no fixed six-hour universal isolation lead.
3. **Fresh Windows host resources:** use a **new** positive/negative DB pair and run-scoped S3 bucket, with complete schema/ACL/zero-row and current/version/delete-marker/multipart empty readbacks, and prove no production bindings; preserve old resources. Fresh readbacks must be within the verifier's 300-second window when validating or Execute will correctly stop. Check clean exact protected-main source, local tsx/Python/pg dependencies and scientific selftest.
4. **Authorised one-shot host attempt, not GitHub Actions:** only after the separate signer/adoption and explicit operator approval, consume nonce/run exactly once; execute real isolated Producer, three Timing, real transport+promotion+readback delay evidence, and Aggregate; emit and hash all immutable stage receipts. Failure burns the attempt and requires another independently governed decision—no reset or automatic retry.
5. **Scientific and production adjudication:** validate that genuine Provider responses, fenced physical writes and post-commit readbacks occurred on the Windows operator host; distinguish measured three-base delay events from the unqualified six-case full-pipeline stress matrix. Only a separate adoption may admit a qualified Posterior State, followed by Product signed publication/API projection. Formal-v5 owner, A0 and O00–O23 have distinct clocks and approvals.

## Pitfalls and separation

Do NOT assume GitHub Actions ran the real Provider; do NOT mark real six-case pipeline qualification PASS from synthetic callbacks or filesystem waits. Do NOT reuse `72dc0304a21a`, its now-invalid ARM, prior output, old databases or old bucket. Do NOT mutate original V3 clean-gate FAIL / V4 archive provenance. Avoid repeated Git branch/current-main drift, Windows PowerShell scalar-vs-char output, nested Git history replay without deadline, destructive cleanup fixtures, missing `tsx`/Python env, or updating a new successor without checking the historical QCP applicability registry. Main merge is only an engineering adoption; independent signer activation remains a separately reviewable and initially disabled successor.

Product track: the first signed Posterior State must come from genuine, independently qualified MCFT evidence before Product API C01/C02/C03 can publish it. Frontend connectivity and green engineering CI are not source validity.

---

# 2026-10-10 ACTIVE CHECKPOINT — ISOLATED QUALIFICATION ARM ADOPTED / WINDOWS PREFLIGHT PASS / REAL PRODUCER + TIMING PENDING / POST-MERGE MAIN CI RED

Timestamp: **2026-10-10 18:00 Beijing / 10:00Z**. This is an evidence-based takeover snapshot; do not treat a status recorded here as a live proof after this time. **PREPENDED TO THE SECOND EXISTING HANDOFF ONLY; all 2026-10-09 and earlier text is preserved below verbatim.**

**EXECUTIVE STATE:** CAP-09 is NOT recovered in production, Formal ARM/A0/O00–O23 are NOT authorized/executed, and no qualified Posterior State has been shown on Site. However, the independent Windows isolated qualification environment is provisioned, Schema/ACL and scientific selftests PASS, protected-main qualification-only ARM is adopted, and **governed Windows Preflight now PASS**. The NEXT OPERATION is one real isolated Producer + three Timing evidence run, after exact-main, expiry, output-directory and dependency checks. No result from that Execute run has been supplied as of this checkpoint. CRITICAL NEW GOVERNANCE ISSUE: **the adopted protected main has multiple failing post-merge CI checks**; do not equate PR green checks with an all-green main.

## 0. HANDOFF GOVERNANCE, REQUIRED READING AND ROLE

There remain **exactly two** CAP-09 handoff documents, no third handoff:
1. Historical immutable reference: docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-27.md
2. Current continuation, this same file: docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-CONTINUATION-2026-10-03.md

Preserve full old checkpoints beneath this top prepend. The dedicated handoff PR #3298 must remain **DRAFT / OPEN / UNMERGED**, branch docs/mcft-cap09-handoff-2026-08-26-phase2-evidence-module-frontier, and may advance only with documentation checkpoints. Do not merge it into protected main. New takeover order: first read Digital Twin master task, MCFT/CAP-09 task and frozen qualification contract, then historical handoff, then THIS continuation newest first, then inspect live GitHub/main/QCP, Windows host, isolated infrastructure, and Neon; never act from stale SHA or historical ARM.

**Two coordinated workstreams remain:** MCFT must qualify and start a genuinely sourced, governed field state and finish actual 24T. Product group must deliver source-verified, signed, scoped MCFT-to-Product read-only publication and C01/C02/C03 Site projection. The joint milestone is first legally persisted, independently verified Posterior State; Product work must not wait for O23 if a qualified publication already exists, but must not claim CAP-09 closure early.

## 1. AUTHORITATIVE GIT HISTORY THROUGH 2026-10-10

Verified via GitHub:
- #3684 MERGED -> 96984439d8587f13ba57b6b0948a1c81d55da9e5: 2026-10-10 04Z real crop-stage authority adopted; source/registry and historical requalification approved on its own merged base.
- #3683 MERGED -> 9625680d4bec137956d79960e0f9feaad4ebf6ab: current-baseline recovery, Provider/Producer and Timing engineering entrypoints adopted **default disabled**, without production recovery execution or historical attempt reset.
- #3686 MERGED -> 6c6f2d77301a852dbb2f52538df89e3098b5aee5: Windows bounded clean-source checks (staged/unstaged/nonignored untracked), read-only V13 108-file IMPORT_CLOSURE path resolution, independent historical predecessor Git-clone replay and protected-main successor governance. Windows sourceContext smoke measured ~0.2950023 s on tested source file; NOT proof that GitHub HTTPS is reliable.
- #3687 MERGED -> current protected main **2e4c3e7ac0b0e300b15b26b2f6111e7d39de328b**: isolated-only governed ARM for run 72dc0304a21a. GitHub verified protected-main ref, two-parent zero-delta merge, dedicated arm on main, previous arm still DISABLED, new QCP check appended. PR #3687 premerge CI: 34 SUCCESS / 11 SKIPPED / zero failures as observed at merge; this is **not** proof of merged-main CI PASS.
- Legacy Frozen Runtime anchor: 3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a; historical 108-file import closure unchanged by these engineering/authorization PRs. The exact new protected main must always be rechecked; never reuse this SHA after another main advancement without successor qualification.

**NEW MAIN CI FIRST-RED, NOT RESOLVED:** GitHub check-runs on 2e4c3e7… returned multiple red jobs, including post-merge-v13-control-plane, applicability-and-blocker-inventory, rolling-stage resolver qualification, identity/containment/static and several unrelated workflow gates. At the last API read there were **at least 19 failed check runs** plus a running runtime-only-live-provider-soak; the API reported 183 total check runs and some pages were not included in the first page. Treat this as provisional until fetching the complete check list. Two inspected first errors: (a) MCFT_CAP09_SUCCESSOR_CHAIN_REQUIRES_MAIN_BASE_REF:qual/bline-pmain-matrix-base-26c1383 during blocker inventory (run 38041003105); (b) ROLLING_STAGE_RESOLVER_SEAM_NOT_PASS:current_exact_delta_preservation,current_successor_semantic_preservation (run 38041003182). The post-merge-v13-control-plane run 38041003175 exited 1 with missing expected acceptance-output artifacts. **Do not attribute all failures to #3687 without independent classification**; isolate upstream/external reference issues vs actual successor checker defects and re-run exact-head QCP. Absolutely do not dilute R6/G12/G13 frozen hashes, semantic predicates, historical predecessor proof, or accepted authority whitelist to make CI green.

## 2. ISOLATED LIVE-QUALIFICATION INFRA — MACHINE EVIDENCE FROM WINDOWS

Fixed Run ID: **72dc0304a21a**. Keep this run ID and its immutable local receipts; never replace its existing volumes, DBs or bucket as a shortcut.
- Local infrastructure folder: D:\gptdown\MCFT-CAP09-ISOLATED-INFRA-20261010
- Docker project: mcftcap09requal72dc0304a21a
- PostgreSQL: 127.0.0.1:55432; distinct DBs mcft_cap09_requal_72dc0304a21a_positive and mcft_cap09_requal_72dc0304a21a_negative
- Local MinIO: 127.0.0.1:59000; dedicated bucket mcft-cap09-requal-72dc0304a21a. Local .env contains credentials: **NEVER paste into chat, logs, PR or handoff.**
- Isolated infra Inspect: INFRA_READY_SCHEMA_UNMATERIALIZED before migration; then isolated 29-table installer --mode=check PASS (0/0); --mode=materialize PASS (29/29), canonical SQL SHA256 sha256:055f9cb60153a71fb8f75ecfed23267704003e0485c340472fa3d07556512fc2. Schema report: schema-acl-materialize-v1.json. Two fenced SECURITY DEFINER writer routines and ACL audited by installer. Both DBs initially had zero facts; no producer writes as of later resource readback.
- Qualification resource readiness V2: RESOURCE_PRECHECK_COMPLETE_AUTHORITY_BLOCKED prior to adoption, but real readback of Evidence LOGIN to *both* DBs PASS: 29 tables each, facts=0, fenced writer EXECUTE allowed, direct facts INSERT denied; MinIO /health live, run scope valid, pg/tsx installed. The status's ARM blocker is a historical pre-adoption observation.
- Windows scientific result: WINDOWS_SCIENTIFIC_SELFTEST_PASS_NON_AUTHORIZING; ecCodes native, GFS Scientific Core and Raw Bundle Decoder functional selftests PASS; eccodes/numpy/refet pinned. Python eccodeslib separately missing on Windows is **NOT** by itself a failure: Windows eccodes bundled library was selftested; do not force-install Linux/macOS eccodeslib wheel.
- Reports: qualification-resource-readiness-v2.json, scientific-selftest-windows-v1.json; original V1 reports should remain immutable. Local credentials are not in these reports. No production DB, production S3 or Provider calls occurred during provisioning and read-only selftests.
- Repo used for diagnostic exact-main checkout: D:\gptdown\GEOX-cap09-diagnostic-main-20261010 (user fast-forwarded to 2e4c3e7…). To satisfy clean worktree, separate detached execution worktree: D:\gptdown\GEOX-cap09-iso-execution-72dc0304a21a (PowerShell variable $Clean). A correct HEAD is not alone sufficient for cleanliness; untracked/generated files in the diagnostic checkout caused CURRENT_EXECUTION_CLEAN_SOURCE_REQUIRED on the first attempt.

## 3. ISOLATED AUTHORIZATION VS FORMAL/PRODUCTION START

Adopted separate ARM (exact path): scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_ISOLATED_QUALIFICATION_ARM_20261010_V1.json
- armed=true; mode=ISOLATED_QUALIFICATION; subject binding=EXACT_ADOPTED_PROTECTED_MAIN; run_id=72dc0304a21a; original adopted base 96984439…
- qualification_first_base = **2026-10-11T00:00:00.000Z = Beijing 2026-10-11 08:00**
- expires_at = **2026-10-11T06:00:00.000Z = Beijing 2026-10-11 14:00**
- qualification_execution_authorized=true within scope; production_recovery_authorized=false; new_image_build_and_two_role_cutover_authorized=false; formal_v5_arm_authorized=false; a0_authorized=false; o00_authorized=false; historical_attempt_reset_authorized=false.
- **Original** scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_ARM_V1.json remains armed=false, mode=DISABLED. Product publication is NOT authorized by this ARM. No production recovery, Formal ARM, production A0/O00/O23 or 24T completion has occurred.

TIME MIXUP TO PREVENT: Prior fresh stage authority as-of 2026-10-10T04Z is valid until **2026-10-11T10Z / Beijing 18:00**. Its former *theoretical* latest production A0 to cover O23 is **2026-10-10T10Z / Beijing 18:00**, now missed; it was never a production appointment or live authorization. The **Oct 11 08:00 isolated first logical base** is NOT a rescheduled Formal A0 and does not authorize 24T. The “first logical base >=6h in the future” is an entry qualification constraint, not a command to wait six hours before launching the program. A new production A0 needs fresh stage window and independently governed full pre-A0 chain. Do not backdate or rewrite dates to exploit expired coverage.

## 4. LAST WINDOWS QUALIFICATION ACTION / CURRENT FRONTIER

The operator script exists locally: D:\gptdown\MCFT-CAP09-ISOLATED-QUALIFICATION-AUTHORIZED-OPERATOR-20261010.ps1. It uses isolated local .env secrets without printing them; initial Preflight attempts showed transient GitHub HTTPS failures:
- A first run in dirty diagnostic checkout: CURRENT_EXECUTION_CLEAN_SOURCE_REQUIRED -> STOP, no write. Switched to clean worktree.
- Clean worktree Preflight: git ls-remote origin refs/heads/main intermittently failed “Recv failure: Connection was reset” / PROTECTED_MAIN_READ_FAILED, although manual ls-remote between attempts returned exact main. HTTP/1.1 alone did NOT make it reliable. Never replace live protected main with cached origin/main solely to bypass this check.
- Read-only wrapper D:\gptdown\MCFT-CAP09-PREFLIGHT-GITHUB-RETRY-20261010.ps1 was added locally: up to 8 bounded full PRE-FLIGHT retries with transport tweaks and backoff; no Execute functionality, no authority bypass.
- **Most recent operator report: attempt 2/8 PASS**. Exact output:
  status=PREFLIGHT_ONLY_NOT_QUALIFIED; subject_sha=2e4c3e7ac0b0e300b15b26b2f6111e7d39de328b; isolation_targets_valid=true; provider_requests=0; production_writes=0; GOV-ERNED_PREFLIGHT_PASS_NO_PROVIDER_REQUESTS.
- This proves initial scoped **Preflight PASS**, NOT any Provider capture, raw PUT, promotion, readback, timing result, delayed execution or QCP live qualification PASS.
- The *next* proposed local check (not yet reported as run): dependencies in clean execution worktree (node --import tsx and require('pg')), install with pnpm --frozen-lockfile --ignore-scripts only if missing; ensure git clean again and output directory absent.
- User has **NOT YET** returned an Execute terminal receipt. Do NOT mark Producer or Timing success. Proposed one-shot command: invoke same authorized operator PS1 with -Mode Execute -Repo $Clean -Infra $Infra -IUnderstandThisRunsRealProvider, ONLY when exact current main, short-lived ARM, clean worktree, local resources, first-base lead and output safety all pass. Output planned: D:\gptdown\MCFT-CAP09-ISOLATED-INFRA-20261010\qualification-evidence-72dc0304a21a-20261011T00Z. Check existing output BEFORE Execute; no blind repeat after partial data writes.
- After execution, inspect real output files, immutable digests, exact positive and blocked DB attempts, Provider actual request/raw object retention, factual parsing/decoding, promotion/readback, three timing samples and controlled-delay actual cases. The expected “ISOLATED_LOCAL_EXECUTION_COMPLETED_REQUIRES_EVIDENCE_ADJUDICATION” means receipt produced, NOT completed acceptance or production admission.

**KNOWN INTERFACE HAZARD:** Frozen production Producer composition may enforce production raw bucket geox-mcft-cap09-formal-raw-v1 while isolated qualification requires mcft-cap09-requal-72dc0304a21a. If a real isolated Producer construction fails on this mismatch, preserve error and STOP; qualify a bounded successor adapter/test seam, never point isolated DB/MinIO credentials at production bucket or weaken frozen runtime contract. This is a risk to verify at Execute, not evidence of a successful Producer run here.

## 5. PRODUCTION EVIDENCE, OWNER AND GFS MUST NOT BE CONFUSED WITH ISOLATED SUCCESS

Old AM22 Windows bootstrap on 2026-10-09 (main 3b46be1d…) failed in phase GFS_PAIR_WAIT, terminal “Query read timeout”; owner_verified=true but production_owners_may_have_changed=true and operator_reconciliation_required=true. Its failed.json remains at C:\Users\mylr1\AppData\Local\Temp\geox-am22-bootstrap-output-043493c3edf24b19898d958ed3ddd005\failed.json. At that time image b2eed3f3845ce4ba45627da028ecc7a04947dd03223698d65cebacf10c659456 and host fae5f756-ef25-40d5-9777-5b2c3d4837a1; Evidence restart=1, Twin restart=9, last matched local image; historical Fenced T1/T2 owner proof PASS. These historical observations are NOT valid current host proofs.

Older Evidence internal log showed KBS blocked attempts, fatal Neon DNS ENOTFOUND and transient ECONNRESET; subsequent DNS/TCP success from host alone is not application recovery. Do not claim a Windows sleep event caused an incident from temporal correlation only. No automatic compose down, lease deletion, DB clear or forced restart; preserve three historical production attempts, evidence log and failed receipts. A fresh production owner proof requires current T1/T2 fenced lease renewal, exact-one role owners, same container/image/host and appropriate health, after separate recovery authorization. The 2026-10-09 planning selected A0 for measurement only; it did not arm Formal-v5.

PRE-PRODUCTION GATE remains: fresh valid stage authority/25 contexts -> independent real Provider and GFS/ET0 pair availability -> exact-main freeze/image/host qualification -> live owners/cutover and full six-phase measured durations -> real Formal raw write/retain/redecode/promote/readback evidence -> controlled-delay cutoff proof -> eligible future A0 with 24T coverage -> new H5 -> separate Formal ARM -> schema/ACL verification -> actual A0/O00–O23. Frozen Runtime semantics 3d5fd13… and temporal “latest visible revision <= replay T” remain immutable; any semantic drift requires STOP and adjudication.

## 6. PRODUCT TRACK IS PARALLEL, NOT IMPLIED BY MCFT PRE-FLIGHT

Last independently checked Product publication PR **#3676 remains Draft/Open/Unmerged**, head c32a051edfe5681d20bf37e6a9b1d29b9139648e. Its signed publication ledger mechanism was isolated-CI-qualified but not deployed or populated by a real canonical MCFT Posterior State. #3671 capability map and #3674 optional direct-DB prototype are design/experimental tracks, not deployed evidence. Do not silently switch to direct dual-DB reads or create a third physical DB.

Product group next: canonical six-key tenant/project/group/field/season/zone + source/ref/evidence/lineage/posterior/time/hash readback; independent signer and purpose-separated key; append-only ledger in existing Product operational DB; scope-authenticated public read-only adapter; actual C01 overview / C02 fields / C03 field page smoke with root-zone soil moisture, valid time and source; expansion later Evidence, 72h Forecast, History, Crop Stage, Data Health. Product integration may publish the first legitimate independently verified posterior before O23, but must show qualification-pending status and must not synthesize a result just to populate UI. Check Product PR and deployment/Neon live again; do not rely on 10/09 values as current.

## 7. NEXT TAKEOVER WORK ORDER — DO NOT SKIP

1. **READ ONLY CURRENT STATUS.** Re-fetch protected main HEAD and full relevant check-run pages; verify #3686/#3687 merge records and QCP 49th successor. First tackle **main post-merge CI reds** above, preserving exact original historical governance and frozen path/hash assertions. Classify upstream reference/missing Git ref vs real successor applicability errors. If main moves, any qualifications bound to 2e4c3e7… must STOP and rebind; do not fake a cached SHA.
2. **Preserve isolated infra; validate candidate execution.** Check ARM still within 2026-10-11 14:00 Beijing and >=6h first-base lead at launch, exact current protected main, fresh source cleanliness and no existing output dir, Node pg/tsx modules in the actual clean execution worktree and Python scientific libs, actual isolated DB/MinIO loopback credentials. No credential disclosure.
3. **Perform ONCE real authorized isolated Producer/Timing acquisition**, only when gate allows. Do not automatically retry Execute on network errors; first collect partial receipts and DB/object effects and only then adjudicate a safe governed resume/new run. No manual result.json, six-phase-input.json or success assertion.
4. **Reconcile Producer, Timing and controlled-delay evidence** as three separate qualification outcomes; verify both blocked and positive paths, actual raw storage retention/promotion/readback, fence/ACL/identity, three timing samples and cutoff delays. If production hard-coded bucket conflicts with isolated storage, STOP and implement a narrowly reviewed adapter/qualification successor, no mutation to frozen production semantic code.
5. **Independent exact-head QCP and post-merge governance**, including main CI first-red resolution; receive qualifying execution receipt only after independent proof, not merely because Preflight and CI pass.
6. **Recompute a NEW production A0 crop authority/window**; Oct 10 18:00 theoretical old A0 is missed. Separate production restoration/cutover/Formal proof from local ISO qualification. Complete ARM -> schema/ACL -> A0 -> O00–O23 only under separate effective signed authority. Never reset old production attempts.
7. **Run Product work in parallel** using first legitimately verified posterior as join point; coordinate canonical source and target scope with Product signed ledger/API, preserve read-only enforcement and produce C01/C02/C03 real smoke.
8. **Update this SAME handoff** by prepending the next checkpoint only; update PR #3298 description/head, keep draft/open/unmerged; record exact main and real execution/evidence digests only after observed.

## 8. FAILURE MODES / LEARNED RULES

- **DO NOT confuse clocks**: Beijing 10/10 18:00 past theoretical A0 cutoff vs Beijing 10/11 08:00 ISO qualification logical first base vs 10/11 14:00 ISO ARM expiry vs 10/11 18:00 stage authority expiry. None is an automatic future production start.
- **DO NOT equate statuses**: isolated INFRA READY != schema materialized != scientific selftest != preflight != Provider real writes != Producer qualification != Timing/delay proof != QCP acceptance != Formal-v5 A0 != 24T == NOT equivalent.
- **GitHub availability is intermittent**: repeated git ls-remote HTTPS “Recv failure: Connection was reset” sometimes succeeded manually. Retry only full read-only Preflight within bounds, not real write effects. HTTP/1.1 is not a guaranteed fix; source checker must never substitute cached origin/main for fresh protected main.
- **Worktree must be truly clean**: git fast-forward can succeed while nonignored untracked/generated files still violate guard. Use separate clean exact-main worktree, do not run destructive git clean or reset against diagnostic checkout.
- **Windows requires actual source dependencies** in exact execution worktree; installing pnpm dependencies under the diagnostic repo does not install them in a new worktree. After install prove clean again.
- **Do not re-run initialize/materialize** on existing positive/negative 29-table DB; maintain immutable receipt hashes. Original infra Inspect DB-name mismatch was a false negative despite both DB identities correct, diagnosed by direct readback; do not recreate resources to fix inspector bugs.
- **Prevent Windows science false failures**: missing eccodeslib wheel on Windows does not invalidate native ecCodes selftest.
- **Never widen static white lists to bypass QCP**; successor governance is independent old-history replay + narrow exact delta, with pre-merge and post-merge proof; when main advances rebind proofs instead of bypassing predecessor SHA.
- **Real GFS unknown != success**; “Planner not due”, Provider not published, read timeout, database pair missing, KBS missed window and source/fence semantic failure are distinct statuses. Do not infer Provider available solely from preflight or simulated science selftest.
- **No production-state shortcuts**: no manual database zero, no past-arm replay, no fabricated raw/state, no bare SHA, no unreviewed “production-looking” local qualification privileges.
- **Product integrity**: a signed record without verified canonical upstream source/scope/evidence is NOT legitimate field state; Site must not invent values while real MCFT state is blocked.

---

# 2026-10-09 ACTIVE CHECKPOINT — AM22 SIX-PHASE ADOPTED / MCFT START + VERIFIED PRODUCT PUBLICATION

Timestamp: **2026-10-09 11:36 Beijing / 03:36Z** (repository checkpoint, not a claim of host state at future execution).

**Status:** #3677 SIX-PHASE ENGINEERING MERGED; REAL WINDOWS HOST SIX-PHASE MEASUREMENT NOT YET CAPTURED; COMPLETE PRODUCTION PRE-A0 ENVELOPE NOT QUALIFIED; AM22 PREQUALIFICATION_ONLY_NOT_EFFECTIVE; NEW FORMAL ARM/A0 NOT AUTHORIZED; PRODUCT #3676 SIGNED PUBLICATION ISOLATED CI PASS BUT DRAFT; ACTUAL PRODUCT/SITE REAL DATA NOT ESTABLISHED; CAP-09 24T NOT COMPLETE.

This is a PREPEND to the existing active continuation. The old 2026-10-07/10-04/10-03 and previous checkpoints remain verbatim below. Old pinned heads, ARMs and epochs are historical, not authorization to execute today.

## 0. EXACTLY TWO CURRENT HANDOFFS — DO NOT MAKE A THIRD

Every takeover must first read the MCFT/Digital Twin master task, CAP-09 task and qualification contract, then these **two** handoffs in order:

1. Historical canonical handoff (read-only history):
   docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-27.md
2. Current active continuation (THIS file, read newest checkpoint first):
   docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-CONTINUATION-2026-10-03.md

Handoff PR **#3298** remains **Draft/Open/Unmerged**, on branch docs/mcft-cap09-handoff-2026-08-26-phase2-evidence-module-frontier. Never create a third file, merge the handoff PR, or overwrite old checkpoints.

## 1. DUAL-TRACK MISSION — DO NOT FORCE PRODUCT TO WAIT FOR O23

**Joint objective:** legally start MCFT at the earliest viable actual UTC time; continuously collect real evidence and persist verifiable Posterior State; complete O00–O23 actual 24T independently; show the FIRST real, correctly scoped, independently verified field-state in Product API and GEOX Site when the publication controls pass. Do not wait for G12/G13 merely to publish a qualified non-authoritative read, but never claim final CAP-09 closure early.

**LANE A / MCFT start and 24T:** fresh 25-context R6/DT02/A18 effective stage authority and exact single registry append → protected-main adoption → real Windows six-phase durations → independent production owner cutover and Formal raw PUT/redecode/retention/promotion measurement → fully qualified pre-A0 envelope → effective AM22 start authority → exact-main H5/owner/new arm/schema/ACL → future actual-UTC A0 and durable O00 → complete O23 and final G12/G13. Keep Evidence/Twin exact-one owner, fencing, unchanged frozen Runtime semantics and no synthetic data.

**LANE B / Product publication to Site:** exact six-key plus canonical source/lineage/posterior/evidence and causal-visibility verified readback → independently governed, purpose-separated signed publication → append-only customer-safe ledger in a new schema of existing Product operational DB (NO third physical DB, NO Formal 29-table mutation) → scope-authenticated Product API adapter → real C01/C02/C03 Site smoke showing root-zone water/time/provenance and qualification-pending status. Next: Evidence, 72h Forecast, History, Crop Stage, Data Health. Replay Scenarios and ADR/B-Line decision/approval/receipt/Outcome need their own authority.

**Join point:** the first legally persisted and independently read-back MCFT Posterior State. Work on the Product publication adapter and authorization proceeds in parallel NOW.

## 2. PROTECTED MAIN / AUTHORITY RE-READ (2026-10-09)

- Protected main **84afa1f2fd14618860780275809a6a473761beca**, independently checked after #3677 merge.
- PR **#3677 MERGED at 2026-10-09 11:14 Beijing**: CAP-09 AM22 six-phase host collection + isolated A0 prewrite acceptance; 10 changed files including workflow, QCP, runtime acceptance, runbook. Main runbook:
  docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-SIX-PHASE-HOST-MEASUREMENT-V2.md
  Entrypoints: scripts/runtime_acceptance/MCFT_CAP_09_AM22_HOST_MEASUREMENT_V2.cjs and RUN_MCFT_CAP_09_AM22_HOST_MEASUREMENT_V2.ts.
- Previous **#3672 MERGED** introduced inactive AM22 start-chain V2 engineering ports, not permission to start. The #3677 collector executes, on real authorized Windows/Docker host: exact head/image/owner T1/T2 checks; adopted 25-context stage and physically visible GFS/KBS raw; preparation manifest; formal 29-table/2-routine schema/ACL readback + isolated schema; isolated fencing/lease; real-input isolated A0 prewrite (NOT commit). It deliberately does **NOT** stop production owners, perform Formal raw PUT, commit Formal A0, qualify full production-equivalence, issue a certificate or authorize ARM.
- On current main, docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-EFFECTIVE-START-AUTHORITY-V2.json says: status **PREQUALIFICATION_ONLY_NOT_EFFECTIVE**; complete_pre_a0_measurement_qualified=false; new_handoff_arm_a0_chain_qualified=false; isolated_postgres_v2_a0_o00_qualified=false; production_start_authorized=false; formal_v5_arm_authorized=false; a0_authorized=false; mcft_cap09_completed=false. It includes historical retired-arm identity/receipt, which is NOT a successor live ARM.
- On the same main, the effective current-crop registry has **15 entries**, latest as-of **2026-10-08T04:00:00.000Z**, valid-until **2026-10-09T10:00:00.000Z**. The **2026-10-09 04Z / Beijing 12:00** rolling candidate cannot be called effective before actual workflow run SUCCESS, independent R6/lifecycle and all 25 contexts, effective materialization, registry exact one append, protected-main graduation/readback.
- If new 04Z authority is adopted with 30h validity to 2026-10-10 10Z, latest theoretical full-24h-covered A0 is **2026-10-09 10Z / Beijing 18:00**. That is a CONDITIONAL coverage bound, NOT an approved appointment. If host measurements or governance miss it, change to next lawful future epoch; never backdate.
- The 2026-10-07 handoff old 10/09 A0 and historical ARM/image belong to an older exact main. No old ARM reuse, no 36h timer shortcut, no manual A0 to make Site display values.

## 3. WHAT PRODUCT GROUP DELIVERED (ENGINEERING VS PRODUCTION)

- **PR #3671 Draft/Open/Unmerged:** 84-capability data authority catalog, 10 site/operator views and 10 gated workstreams:
  docs/product_projection/GEOX-MCFT-DATA-CAPABILITY-TO-PRODUCT-SITE-MAPPING-V1-2026-10-08.md
  It is the backlog/map, not proof the modules are connected.
- **PR #3674 Draft/Open/Unmerged:** earlier opt-in, default-OFF direct dual-Neon-DB read experiment with exact KBS scope and Product read-only ACL checks. It found insufficient CAP-07 physical graph visibility/ACL; do not merge it blindly alongside #3676. Decide explicit supersession/retirement.
- **PR #3676 Draft/Open/Unmerged, head c32a051edfe5681d20bf37e6a9b1d29b9139648e:** independently signed MCFT→Product publication contract, strict six-key/source/runtime/lineage/posterior/time/ref/hash, pinned exact-graph receipt + verifier-contract digest, purpose-separated Ed25519 key, append-only/idempotent Product database ledger and re-verification at read, conflicting revisions fail-closed. Separate publication schema only in existing operational database geox_mcft_cap09_production_runtime_v1, NOT new third DB and NOT Formal-v5 modification.
- Exact #3676 checks recorded **14 SUCCESS / 0 FAILURE** (remaining checks may be skipped/neutral). Isolated PostgreSQL16 real DB tests cover signatures, replay/idempotency, insert/read and denied update/delete, and synthetic negative cases. This proves mechanism, not that an actual MCFT graph/state was published.
- Cross-lane acceptance comments, already posted:
  #3677 — https://github.com/liyongshang44-max/GEOX/pull/3677#issuecomment-6073713196
  #3676 — https://github.com/liyongshang44-max/GEOX/pull/3676#issuecomment-6073712535
- Last independent Neon readback (2026-10-09 **02:57Z**, historical snapshot, NOT a future/live guarantee): formal + operational DB active lineage/state history/latest state all **0**; new publication schema absent; Formal 29-table store unchanged. Earlier CAP-07 fact-visibility index/epoch physically missing, Product read credentials did not cover a complete canonical graph. A separately qualified canonical-source verifier is a hard blocker; signer signature alone cannot invent source truth.
- Current Product API has three customer GETs: /api/product/v1/overview, /api/product/v1/fields, /api/product/v1/fields/:fieldRef. Signed publication **is not yet connected** to a Product read adapter, authenticated customer token, C01/C02/C03 real Site smoke; no live attestor/key, no deployed publication schema or genuine receipt. Railway Product API observed SLEEPING earlier; deployment, /ready and Site data must be proven independently.

## 4. PRESENT BLOCKER LEDGER / REQUIRED EVIDENCE

| ID | Owner | Current | Closure evidence |
| --- | --- | --- | --- |
| MCFT-1 | Fresh authority | BLOCKED | New 04Z source-supported DT02/A18/R6/25 context, independent persistent lifecycle, effective materialization, registry exact-one append and main adoption |
| MCFT-2 | Windows host | BLOCKED | #3677 real six-phase run on current image/owner, actual timings and immutable output readback |
| MCFT-3 | Owner + Formal raw | BLOCKED | Independently measured real production cutover + Formal raw PUT/redecode/retention/promotion. Six-phase trace alone is INCOMPLETE envelope |
| MCFT-4 | Governance | BLOCKED | Effective AM22 V2 + exact-main H5/fencing/new arm/schema/ACL and actual future A0 GO; current PREQUALIFICATION_ONLY not effective |
| MCFT-5 | Runtime/24T | NOT STARTED | Real durable A0→O00 then O00–O23 physical ticks and separate G12/G13/CAP-09 closure |
| PUB-1 | MCFT read authority | BLOCKED | Authentic scope/lineage/posterior/source fact refs/hashes, cutoff, visible_at and independently pinned exact graph verifier + per-state receipt |
| PUB-2 | Security/DB | BLOCKED | Trusted separate publisher signing key/custody, authorization of additive OPERATIONAL DB schema and publisher/reader least-privilege ACL; Formal DB unchanged |
| PUB-3 | Product API | BLOCKED | Implement versioned signed-publication read adapter respecting customer token and exact six-key; time/qualification state honest |
| PUB-4 | Site | BLOCKED | C01/C02/C03 verified live water+time+source after first real O00 state; other fields inaccessible, no synthetic claim |

Neither MCFT 24T nor Product data are currently DONE. Maintain separate judgments for code/CI, real host timings, start authority, persisted A0/O00, authenticated Site and G12/G13 final.

## 5. ORDER FOR NEXT ENGINEER (RUN BOTH LANES CONCURRENTLY)

**MCFT first actions:** at/after 04Z obtain actual rolling candidate workflow run ID, actual exact-main/CI, required stage authority/25 contexts and visibility; adopt effective authority with an exact-one registry entry; recheck current protected main. Run #3677 Windows command-complete six-phase host measurement with real existing owners, qualifying image and retained source, in a newly isolated local DB without Formal effect. Separately time actual owner cutover and Formal raw PUT/redecode/retention/promotion. Only after complete envelope and effective AM22 start authorization do fresh exact-main owner/H5/arm/schema ACL and real A0→O00, then 24T/closure. If the window expires, move to a later actual-UTC window.

**Product first actions:** keep #3676 Draft and its operational SQL out of production; qualify a real source exact-graph attestor, temporal visibility and immutable per-state receipt/verifier binding WITHOUT changing Formal 29 tables or using xmin. Authorize key custody, roles and separately governed additive operational DB schema. Implement PublishedFieldStateReadAdapterV1 under existing customer auth with accurate scope/availability; preserve C01/C02/C03 design. After actual posterior is independently read back, publish signed non-authoritative state and perform Product+Site auth/CORS/refresh smoke. Then add Evidence→Forecast→History→Crop Stage→Data Health; govern Scenario and ADR/B-Line separately. #3674 direct bridge should be explicitly retired or superseded, not silently deployed with #3676.

**Exact exchange contract:** tenant, project, group, field, season, zone; protected main/runtime SHA; active lineage ref/hash; posterior ref/hash; source fact ref; per-state complete graph receipt; pinned verifier contract digest; logical UTC/visible_at/readback_as_of/certified_at; signed publisher identity. No future source leakage.

## 6. HISTORICAL TRAPS AND ABSOLUTE NO-GO RULES

1. Candidate != effective authority. Dispatch is not adoption; gh run list may contain multiple runs. Check real run ID, source evidence, registry digest, protected main.
2. Six-phase measurement != production-envelope certificate. Missing production cutover and Formal raw PUT/redecode/retention/promotion are independently measured. Local prewrite != real A0.
3. 30h expiry means A0+24h must fit; 18:00 Beijing bound is conditional. 05:17Z cron can miss an earlier A0; use actual UTC and DB clock after image build.
4. Previous ARM/H5/image pinned to an older protected main. AM22 remains PREQUALIFICATION_ONLY_NOT_EFFECTIVE. Never recycle old ARM or clock or manually bootstrap.
5. Formal-v5 store is frozen 29 tables/2 routines. No ad hoc mutation, DB schema rewrite, fake A0 or direct Site/MCFT writer credentials. Source visibility tables absent ≠ license to bypass CAP-07 graph.
6. #3676 publisher under apps/server/src/product_projection/** tripped Wave-01 read-only contract; SQL under apps/server/db/migrations/** triggered unintended qualification DB migration. Host-only publisher lives in scripts/product_publication/ and optional SQL in scripts/product_publication/sql/.
7. CI fixture Ed25519/isolated Postgres ≠ real signed MCFT truth or live Site. Purpose-specific trusted signer plus independently qualified graph and legitimate customer role are all needed. Do not claim G12/G13 PASS from a signed receipt.
8. Old environmental failures: Git fetch OOM, qualification remote ref confusion, Docker Desktop/WSL engine half-alive, selecting stale production containers, PowerShell scalar .Count, untracked acceptance-output, psql at D:\pdsl\bin\psql.exe, Neon pooler PGOPTIONS, lost process env, missing tsx. Preserve T1/T2, image digest and secrets. Keep raw credentials out of GitHub logs.
9. Scripts in runtime_acceptance/** may trigger unintended EA5E2. Do not mix Product+Runtime PRs; main drift requires fresh subject binding. Never weaken R6/G12/G13, QCP or continuity guards just to merge.
10. KBS is DAILY ~24 hourly batch observations with publication/revision visibility; modelled root-zone water is not the 100mm point sensor. GFS same-cycle forcing and causal latest-visible revision matter. Confidence/stress/approval/dispatch cannot be fabricated by Site.
11. No third handoff, no overwriting history, no merge/deploy of #3676/#3674/#3671/#3668/#3660 during unresolved start authority.

## 7. SUCCESSOR TAKEOVER INSTRUCTION

**Start by reading the two exact paths in section 0, then revalidate #3298, current main, #3677, #3676, #3674, #3671, AM22 authority JSON and registry, actual Windows six-phase host trace, owner/cutover/raw timings, current Neon publication/lineage tables and authenticated Product/Site.** Report each stage as repository CI vs host timing vs real Formal authority vs durable A0/O00 vs customer Site vs final 24T. Never mark any unmeasured/unpublished stage PASS. The active next step is to converge Lane A authority/timing while Lane B implements verified source→publication→Product adapter concurrently.


---

# 2026-10-07 ACTIVE CHECKPOINT — FORMAL-v5 ARMED / POST-ARM REVALIDATED / FINAL REAL-CLOCK WINDOW PREP

Status: **T0 CLOSED / EXACT-MAIN OWNER CUTOVER PASS / FORMAL-v5 ARMED / POST-ARM SCHEMA+ACL PASS / ROLLING CANDIDATE REHEARSAL PASS / A0 NOT EXECUTED / FINAL WINDOW PENDING**

Timestamp: **2026-10-07 13:33 +08:00**

Repository: `liyongshang44-max/GEOX`

This checkpoint is a pure prepend to the existing active continuation. Historical content below remains preserved and authoritative for its own time. Where older checkpoints conflict with this section, this checkpoint is the current takeover frontier.

## 0. EXACTLY TWO CURRENT HANDOFFS — DO NOT CREATE A THIRD

There are **exactly two current MCFT CAP-09 handoff documents**. Every successor engineer / conversation must read both before changing MCFT code, governance, evidence, Formal state, production state, or qualification state.

1. Historical canonical archive — frozen / do not rewrite:

`docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-27.md`

2. Current active continuation — this file:

`docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-CONTINUATION-2026-10-03.md`

Do **not** create a third current handoff. Older continuation files remain historical provenance only.

Mandatory takeover order:

```text
MCFT / Digital Twin master task
→ MCFT CAP-09 task / acceptance / governance / qualification documents
→ historical canonical handoff (2026-08-27)
→ active continuation (2026-10-03, newest checkpoint first)
→ current protected-main / QCP / Formal / production evidence
```

## 1. CURRENT TASK — WHAT WE ARE DOING NOW

MCFT-9 is no longer in Runtime feature development and no longer in T0 blocker convergence.

The active task is now:

**finish CAP-09 by executing the already-qualified Formal-v5 real-clock evidence epoch on the exact armed subject, without changing Runtime semantics, without reopening T0, and without allowing unrelated main changes to invalidate the arm.**

The remaining execution chain is:

```text
fresh 2026-10-09 04:00Z DT02/A18 current-crop authority
    ↓
effective authority materialization
    ↓
registry exact single append
    ↓
protected-main adoption of authority surface only
    ↓
post-arm authority continuity verification
    ↓
A0 at 2026-10-09 05:00Z
    ↓
O00 at 2026-10-09 06:00Z
    ↓
O00–O23 actual 24h
    ↓
final adjudication
    ↓
CAP-09 closure
```

No new MCFT capability should be added unless a new machine-proven blocker requires a separately adjudicated change.

## 2. CURRENT EXACT IDENTITIES / FROZEN EXECUTION PINS

Protected main, independently re-read on 2026-10-07:

`0e4cd036fdbebfe8118d6b7c1978572859d5a652`

Exact tree:

`74cb1cac306061b41520370e65dc326f3de98d3a`

Current main commit is PR #3656 merge:

`docs(mcft-cap09): append Oct 06 current-crop authority`

Authorized exact-main production Runtime image id:

`sha256:52b82bd8237511bf3e0e8ba20b90b6a91c83d719f6926252951938ebbf42f222`

Formal-v5 database:

`geox_mcft_cap09_s6_formal_t4r1_24h_v5`

Current Formal-v5 epoch:

```text
A0  = 2026-10-09T05:00:00.000Z
O00 = 2026-10-09T06:00:00.000Z
O23 = 2026-10-10T05:00:00.000Z
```

Current arm subject:

`0e4cd036fdbebfe8118d6b7c1978572859d5a652`

Current arm identity hash observed after re-arm:

`sha256:cadbe9c5e228f95621625e26b82117f6ca9edb799221667ce5ce192069d1f9e5`

Current effective current-crop authority already on main:

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-10-06T04Z-V1.json`

Digest:

`sha256:38dea2ee39f00d17782ce7578909bc0838649341abf0f25fa388ac77b7d7c2de`

Its authority window:

```text
authority_as_of       = 2026-10-06T04:00:00.000Z
authority_valid_until = 2026-10-07T10:00:00.000Z
```

This Oct-06 authority was sufficient for owner cutover / preformal operation, but it is **not** valid for the final A0/O00–O23 epoch. A fresh successor authority at the 2026-10-09 04:00Z boundary is still required.

Frozen Runtime historical qualification authority remains:

`3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a`

Do not mutate it.

## 3. WHAT HAS BEEN COMPLETED — CURRENT MACHINE-PROVEN STATE

### 3.1 T0 blocker convergence remains ZERO / CLOSED

The 2026-10-04 checkpoint remains authoritative:

- Phase5 closure: PASS
- AM19 closure: PASS by final read-only adjudication
- final adjudicated blocker count: 0
- remaining blockers: 0
- do not rerun historical 24T merely to recreate superseded premises

No later work in this checkpoint reopens T0.

### 3.2 Oct-06 current-crop authority was materialized and adopted

The Oct-06 rolling candidate was converted into a governed effective authority and registry append.

PR #3656 was merged to protected main, producing current main:

`0e4cd036fdbebfe8118d6b7c1978572859d5a652`

The registry entry count advanced from 13 to 14, with an exact single-authority append and no production effect during materialization.

### 3.3 Exact-main Runtime image build and owner cutover are PASS

Exact-main runtime image build passed, including network-none content checks for Node / Python / ecCodes.

Production owner cutover subsequently passed on exact subject `0e4cd036...`.

Observed owner-cutover facts:

- Evidence runtime process started and became effective owner
- Twin runtime process started and became effective owner
- Twin remained in `PRE_FORMAL_OWNER_STANDBY`
- exact-one owner per runtime role was later independently re-read from production
- owner heartbeats continued to advance
- A0 remained false
- O00 remained false

The prior stale production containers on old image `0c71e558...` were explicitly stopped before the exact-main cutover.

### 3.4 Formal-v5 arm is PASS

Formal-v5 was explicitly armed for the current exact-main subject.

The selected epoch is:

```text
A0  = 2026-10-09 05:00Z
O00 = 2026-10-09 06:00Z
O23 = 2026-10-10 05:00Z
```

Arm did not execute A0 or O00.

### 3.5 Post-arm schema/ACL revalidation is PASS and CLOSED

Official runner:

`scripts/runtime_acceptance/RUN_MCFT_CAP_09_FORMAL_V5_SCHEMA_ACL_MATERIALIZATION_V1.ts`

Final result:

```text
status                           = PASS_ALREADY_MATERIALIZED_IDEMPOTENT
subject_sha                      = 0e4cd036fdbebfe8118d6b7c1978572859d5a652
database_name                    = geox_mcft_cap09_s6_formal_t4r1_24h_v5
public_table_count               = 29
public_routine_count             = 2
all_table_rows_zero              = true
schema_materialization_performed = false
acl_materialization_performed    = false
formal_v5_arm                    = true
a0_bootstrap                     = false
o00_started                      = false
provider_request_count           = 0
```

Runtime routines were still split correctly:

- `mcft_cap09_twin_runtime_append_fact_v1` → Twin exec true / Evidence exec false
- `mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1` → Evidence exec true / Twin exec false

This gate is closed. Do not rerun it merely for reassurance unless a new governed change invalidates it.

### 3.6 Independent remote readback after post-arm revalidation remained clean

After the official local revalidation:

- protected main still `0e4cd036...`
- Formal-v5 still exactly 29 public base tables
- Formal-v5 still exactly 2 public routines
- Formal-v5 total rows still 0
- Evidence live owner count = exact one
- Twin live owner count = exact one
- production current T4R1 active-lineage row count = 0
- production current T4R1 latest-state row count = 0

That zero product/state condition is expected before A0.

### 3.7 Final-window rolling candidate rehearsal is PASS

Latest manual rehearsal:

- workflow: `.github/workflows/mcft-cap-09-t4r1-rolling-current-crop-candidate-v1.yml`
- GitHub run id: `37576322963`
- event: `workflow_dispatch`
- exact head: `0e4cd036fdbebfe8118d6b7c1978572859d5a652`
- conclusion: **SUCCESS**
- candidate job id: `112645926788`
- duration: about 1m8s

All candidate steps passed, including:

- exact qualification subject checkout
- deterministic rolling snapshot contract
- protected-main effectiveness adjudicator syntax
- rolling snapshot overlay
- thermal scientific probe
- lifecycle qualification dependencies
- protected-main successor-chain effectiveness
- fresh persistent lifecycle qualification
- admitted-main lifecycle binding
- ephemeral fresh current-crop candidate composition
- candidate-only authority ceiling
- evidence artifact upload

This rehearsal proves that the final-window candidate path currently runs end-to-end on the exact armed main.

**Important:** this 2026-10-07 rehearsal candidate is not the final 2026-10-09 effective authority and must never be promoted as a substitute for the required fresh 04:00Z authority.

GitHub runner annotations about Node.js 20 deprecation / forced Node 24 and future Ubuntu image migration were warnings only; they did not fail the run.

## 4. CURRENT BLOCKER / WHY A0 CANNOT START YET

There is no current engineering blocker in Runtime, schema, ACL, owner cutover, or candidate generation.

The remaining gate is a **real-clock authority boundary**.

The final epoch requires a fresh DT02/A18 stage authority generated at the eligible local-day boundary:

`2026-10-09T04:00:00.000Z`

The arm requires future stage-authority coverage from A0 through O23 inclusive. The older Oct-06 authority expires before the epoch and cannot be reused.

Therefore:

- do not start A0 early
- do not reinterpret the 2026-10-07 rehearsal artifact as the final authority
- do not shift A0 merely to avoid the authority boundary without a new formal adjudication

### Critical scheduler fact

The ordinary rolling current-crop cron is approximately `05:17Z`.

That is too late for:

`A0 = 05:00Z`

Therefore the final 2026-10-09 stage refresh **must use manual `workflow_dispatch` immediately after the 04:00Z boundary**. Do not wait for the daily cron.

## 5. FINAL-WINDOW EXECUTION PLAN — NEXT OPERATOR MUST FOLLOW THIS ORDER

### 5.1 Before 2026-10-09 04:00Z

Do not make new Runtime changes.

Keep protected main frozen at the armed subject except for the separately governed current-crop authority/registry advancement that will be required at the fresh boundary.

Confirm immediately before the window:

- protected main exact SHA
- #3658 remains unmerged
- production Evidence/Twin exact-one live owner
- Formal-v5 29 tables / 2 routines / 0 rows
- Formal-v5 arm artifact still binds the intended epoch
- local Git worktree clean
- `gh`, Node, pnpm, tsx, Docker, and psql availability

### 5.2 At / immediately after 2026-10-09 04:00Z

1. Resolve protected main exactly.
2. Manually dispatch:
   `mcft-cap-09-t4r1-rolling-current-crop-candidate-v1.yml`
3. Capture the exact returned run id; do not select an arbitrary latest run.
4. Verify run `head_sha == protected main`.
5. Wait for candidate SUCCESS.
6. Download the immutable candidate artifact and compute / retain its SHA-256.
7. Build the governed current-crop refresh request for the fresh 04:00Z authority.
8. Materialize the new effective current-crop authority using the existing builder.
9. Require the materialization to prove:
   - fresh authority subject exact-match
   - stage authority as-of = the eligible 04:00Z boundary
   - validity covers the final epoch through O23
   - candidate artifact remains candidate-only until materialized
   - no production effect
10. Require exact current-crop diff scope:
    - one new immutable effective-current-crop authority JSON
    - one append to `GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json`
11. Run registry-preservation acceptance in single-authority-append mode.
12. Commit/push only that governed authority surface on a qualification branch.
13. Any protected-main adoption / PR merge is a separate authorization gate.
14. After adoption, rebind local exact-main to the new protected main.
15. Run post-arm authority continuity verification.
16. Re-read:
    - Formal arm still valid
    - Formal store still 29 / 2 / 0
    - Evidence/Twin exact-one owners
    - no unintended production effect before A0

Do **not** allow unrelated code, Product, ADR, B-Line, workflow, or governance changes into protected main during this arm-continuity window.

### 5.3 At 2026-10-09 05:00Z — A0

A0 still requires an explicit production execution authorization.

Only after:

- fresh effective authority is on protected main
- registry append is accepted
- post-arm continuity PASS
- exact-one owners PASS
- Formal-v5 store / schema / ACL readback PASS

may A0 be executed.

A0 must not be inferred from arm or from candidate success.

### 5.4 At 2026-10-09 06:00Z — O00

O00/O00–O23 execution remains a distinct gate.

After A0 succeeds and the governed runtime is ready, begin O00 and continue through O23.

Do not restart historical qualification or substitute accelerated evidence for the required final actual 24h.

### 5.5 After O23 at 2026-10-10 05:00Z

Run the final actual-24h adjudication.

CAP-09 completion may only be claimed after the final adjudicator proves the required evidence and closure conditions.

## 6. PRODUCT / PORTAL SIDE WORK IS PAUSED DURING MCFT FINAL WINDOW

A separate Product dual-read PR exists:

PR #3658

Latest qualified Product branch head observed during this conversation:

`63abeaa591708d0ddc6c54b7c2c6b60f6ae5c0b7`

It is intentionally:

`Draft / Open / Unmerged`

Its Product CI passed, and Formal-v5 Product readonly ACL grants were separately installed and independently verified.

Those Product grants are eight direct non-grantable SELECT privileges:

Two existing Product principals × four tables:

- `facts`
- `twin_active_lineage_index_v1`
- `twin_state_latest_index_v1`
- `twin_state_history_projection_v1`

The official MCFT post-arm schema/ACL revalidation passed **after** these Product SELECT grants existed; do not revoke them as an MCFT “fix” absent new machine evidence.

Product deployment was not completed because an isolated Railway acceptance project hit a platform resource-provision limit.

**Do not merge or deploy #3658 during the armed MCFT final window.**

The Product line is not the current MCFT frontier.

## 7. PITFALLS ALREADY HIT — DO NOT REPEAT THEM

### 7.1 Do not use broad `gh run list` output as if it were a single run

An earlier dispatcher captured multiple historical run ids / SHAs and then falsely reported a subject mismatch.

Rule:

- capture the exact run id created by `gh workflow run`, or
- retrieve one exact run and assert cardinality,
- then verify its `headSha` explicitly.

The successful rehearsal run is a good reference pattern:
`37576322963`.

### 7.2 Local `git fetch` can exhaust memory

A previous fetch failed with:

`fatal: Out of memory, malloc failed (tried to allocate 524288000 bytes)`

When only protected-main identity is needed, prefer a remote API / `gh api` lookup or a minimal targeted fetch instead of a broad repository refresh.

Still require an exact subject check before any governed local operation.

### 7.3 Explicit branch refspec may be required

A normal fetch of a precreated qualification branch did not create the expected remote-tracking ref.

Working pattern:

```text
git fetch origin +refs/heads/<branch>:refs/remotes/origin/<branch>
```

Do not assume `origin/<branch>` exists merely because FETCH_HEAD succeeded.

### 7.4 `git switch --track` can fail on a manually materialized remote ref

The safe fallback used successfully was:

```text
git switch -c <branch> refs/remotes/origin/<branch>
```

then verify exact HEAD and clean worktree.

### 7.5 Do not delete the checkout directory while PowerShell is inside it

A prior `Remove-Item -Recurse -Force` failed because the working directory itself was in use.

Move to another directory first, or reuse the existing exact-clean proof checkout.

### 7.6 Docker Desktop can appear alive while the Linux engine pipe is dead

Observed symptoms included:

- `docker version` hanging
- stale `docker.exe` clients
- `dockerDesktopLinuxEngine` named pipe timeout
- WSL `0x8007274c`
- production containers trapped in restart loops

Recovery used:

- kill stale docker CLI clients
- confirm named-pipe failure
- restart Docker Desktop when explicitly authorized
- verify client/server version before proceeding

Do not confuse Docker Desktop GUI presence with a healthy Linux engine.

### 7.7 Old production containers must be fenced and stopped before exact-main cutover

The old `0c71e558...` containers were still restart-looping after Docker restart.

They were explicitly identity-validated and stopped before the new image / owner cutover.

Do not leave an old owner candidate running during a new exact-main cutover.

### 7.8 PowerShell strict-mode array `.Count` pitfalls

An empty scalar/null result caused:

`property Count not found`

Always force potentially empty command output into an array:

```powershell
$Ids = @( ... ) | Where-Object { $_ }
```

before reading `.Count`.

### 7.9 `git restore` does not remove an untracked generated directory

An untracked `acceptance-output/` made the worktree dirty; `git restore acceptance-output` failed because the path was not tracked.

Classify first. If generated/untracked-only:

- archive if needed
- remove the untracked generated files explicitly
- re-check `git status --porcelain`

Never delete unknown dirty state blindly.

### 7.10 `psql` is installed but not on the default PATH

On this operator host:

`D:\pdsl\bin\psql.exe`

Use:

```powershell
$env:Path = "D:\pdsl\bin;$env:Path"
```

before relying on `psql`.

### 7.11 Neon pooler rejects some `PGOPTIONS` startup parameters

The Neon pooler rejected:

`statement_timeout` inside startup `options`.

Do not use that `PGOPTIONS` combination against the pooler.

Use the governed direct/unpooled binding where required, or remove unsupported startup options.

Do not print credentials into logs or handoff text.

### 7.12 Environment bindings are process-local and can disappear between PowerShell sessions

Formal DB URL and Runtime DB/S3 bindings were repeatedly found missing in a new shell.

Before every production-sensitive command:

- verify required env names are SET
- recover from governed local evidence / stopped container inspection only when allowed
- never infer localhost fallback is correct
- never print secret values

### 7.13 `tsx` may be absent in a clean proof checkout

Post-arm schema/ACL initially failed because `tsx` was not installed.

Working recovery:

```text
pnpm install --frozen-lockfile --prod=false
node_modules\.bin\tsx.cmd
```

Then ensure tracked worktree remains clean.

Do not globally install an arbitrary tsx version to bypass the repository lockfile.

### 7.14 Non-MCFT scripts under `scripts/runtime_acceptance/**` can falsely trigger MCFT applicability

Product ACL scripts were initially placed under `scripts/runtime_acceptance/**`, which caused EA5E2 / central applicability to see Product-only paths as unknown MCFT changed paths.

They were moved to:

`scripts/product_acceptance/**`

Do not put unrelated Product tooling under MCFT runtime-acceptance path ownership.

### 7.15 The current daily rolling cron is too late for this epoch

Normal cron around `05:17Z` is later than A0 `05:00Z`.

For this final epoch, manual dispatch after `04:00Z` is mandatory.

### 7.16 Candidate is not authority

A successful rolling candidate artifact has:

- no production effect
- no Formal-v5 authorization
- no A0 authorization
- no O00 authorization

It only becomes consumable current-crop authority after governed materialization + registry append + protected-main adoption + continuity checks.

### 7.17 Do not reopen Phase5 / AM19 historical closure

Historical raw FAIL records remain for provenance.

They are not present blockers after the governed supersession / verified-delivery closure.

Do not rerun historical 24T merely because an old raw artifact still says FAIL.

## 8. WHAT THE NEXT OPERATOR MUST NOT DO

Do not:

- create a third current handoff
- modify frozen Runtime
- add new MCFT capability to “speed up” the final epoch
- rerun old 24T as a substitute for the final actual 24h
- merge Product PR #3658 during the armed window
- allow unrelated protected-main changes before final continuity
- treat rehearsal run `37576322963` as the final authority
- wait for the 05:17Z cron on 2026-10-09
- start A0 without the fresh 04:00Z authority
- infer A0 authorization from Formal-v5 arm
- infer O00 authorization from A0
- claim CAP-09 completion before final O23 adjudication

## 9. TAKEOVER SNAPSHOT

```text
T0 blocker convergence                  CLOSED / ZERO
protected main                          0e4cd036fdbebfe8118d6b7c1978572859d5a652
exact runtime image                     sha256:52b82bd8237511bf3e0e8ba20b90b6a91c83d719f6926252951938ebbf42f222
production Evidence owner               PASS / exact-one
production Twin owner                   PASS / exact-one
Formal-v5 arm                           PASS
post-arm schema/ACL revalidation        PASS_ALREADY_MATERIALIZED_IDEMPOTENT
Formal-v5 store                         29 tables / 2 routines / 0 rows
A0                                      NOT EXECUTED
O00                                     NOT EXECUTED
current final-window rehearsal          PASS
rehearsal run                           37576322963
rehearsal exact head                    0e4cd036fdbebfe8118d6b7c1978572859d5a652
next hard boundary                      2026-10-09T04:00:00Z
next required action                    fresh candidate → effective authority → registry single append → continuity
CAP-09 completed                        false
```

The next engineer should treat the system as **ready for the final real-clock authority window, not ready for early A0**.

---

# 2026-10-04 REMOTE CLOSURE PUSH CONFIRMATION — EXACTLY TWO CURRENT HANDOFFS

Status: **REMOTE ENGINEERING CLOSURE HEAD CONFIRMED / TWO-HANDOFF MODEL FROZEN**

This checkpoint supersedes any older handoff text that says the final engineering closure subject is local-only or not readable from GitHub.

## 0. Exactly two current MCFT CAP-09 handoffs

There are **exactly two current handoff documents** for MCFT CAP-09 takeover:

1. Historical canonical archive — frozen / do not rewrite:

`docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-27.md`

2. Current active continuation — this file:

`docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-CONTINUATION-2026-10-03.md`

No third current continuation is authorized.

Other handoff-looking files that remain under `docs/handoff/` are historical or retired artifacts. They are preserved for provenance only and are **not** current takeover entry points. A new engineer or conversation must not select them as a third/current handoff merely because they remain present in repository history.

The current takeover sequence is therefore always:

```text
MCFT / Digital Twin master task
→ CAP-09 task / acceptance / governance documents
→ historical canonical handoff (2026-08-27)
→ active continuation (2026-10-03, with current checkpoints prepended)
→ current GitHub / QCP / evidence state
```

## 1. Engineering closure subject is now remote-confirmed

Remote branch:

`qualification/mcft-cap09-am19-historical-logical-successor-v1`

Remote exact head, independently confirmed after push:

`18fa562804124f69f5a64f0fa549bdf69c656ea3`

This is the machine-proven CAP-09 T0 qualification closure subject.

Do not substitute a later documentation/handoff commit SHA for this engineering closure subject.

The previous warning that `18fa562...` was local-only is now retired.

## 2. T0 closure remains final

At exact head `18fa562804124f69f5a64f0fa549bdf69c656ea3`:

- QCP applicability base: `4ee4989fc4f40cc52a3819be282c1d192b58a9b2`
- stage: `SUCCESSOR_SUBJECT_PRE_MERGE`
- frozen Runtime: `3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a`
- `PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS`: **PASS / CLOSED**
- `LEGACY_AM19_PERSISTENT_24T`: **PASS / CLOSED by final read-only closure adjudication**
- final adjudicated blocker count: **0**
- remaining blockers: **0**
- CAP-09 T0 blocker convergence: **ZERO / CLOSED**

Do not rerun historical 24T and do not reopen AM19 or Phase5 merely because older raw evidence or older handoff checkpoints contain FAIL/frontier state.

A closed blocker may only be reopened by a new governed invalidation of the applicable dependency/evidence contract.

## 3. Phase5 durable supersession anchor remains frozen

- causal qualification subject: `dc9ea15a26c718594807fd0ac7158742518981b4`
- durable package anchor: `e74f4348cc0318bb1fd3b3345bce7fe6c9c9dba6`
- dependency digest: `sha256:058d42929efedbbc7f55bf6ca4c2380260731e1c652f27226e86e3f832518965`
- frozen Runtime: `3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a`

The historical 24T result was not reinterpreted as proving the replacement causal-revision semantics.

## 4. Final acceptance-output artifact status

The final machine artifacts remain:

- `acceptance-output/MCFT_CAP_09_ALL_BLOCKERS_18FA562_EXACT_V1.json`
- `acceptance-output/MCFT_CAP_09_AM19_FINAL_ZERO_CLOSURE_18FA562_V1.json`

These exact JSON files are still local artifacts until separately exported as immutable repository evidence. Their current local-only file status does **not** invalidate the remote-confirmed engineering closure subject or reopen T0 blockers.

If exported later, bind the exact original JSON bytes and compute their file-level SHA-256; do not fabricate or reconstruct substitute digests.

## 5. HOLD boundary remains unchanged

T0 zero blockers does not authorize the next execution gate:

- Formal-v5 arm: **HOLD / false**
- A0: **HOLD / false**
- O00-O23: **HOLD / false**
- production database mutation: unauthorized
- production owner activation caused by this closure: unauthorized
- provider request caused by this closure: none
- CAP-09 completion claim: **false**

No operator, automation, CI job, or future conversation may infer Formal-v5/A0/O00-O23 authorization from T0 closure.

---

# 2026-10-04 FINAL T0 CLOSURE CHECKPOINT — ZERO BLOCKERS / DO NOT REOPEN

Status: **CAP-09 T0 BLOCKER CONVERGENCE CLOSED / ADJUDICATED ZERO**

This checkpoint is a pure-prepend current-state record. Historical handoff content below remains authoritative for its own time and must not be rewritten. This checkpoint supersedes older blocker/frontier statements where they conflict.

## 0. Canonical closure identity

- T0 closure exact head: `18fa562804124f69f5a64f0fa549bdf69c656ea3`
- qualification branch at closure: `qualification/mcft-cap09-am19-historical-logical-successor-v1`
- QCP applicability base: `4ee4989fc4f40cc52a3819be282c1d192b58a9b2`
- QCP stage: `SUCCESSOR_SUBJECT_PRE_MERGE`
- frozen Runtime: `3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a`
- final adjudicated blocker count: **0**
- remaining blockers: **0**
- T0 blocker convergence: **ZERO / CLOSED**

Important: `18fa562...` is the machine-proven local qualification closure subject. At the time this handoff checkpoint is written, that engineering commit is not readable from the remote GitHub repository. The handoff commit created below is documentation only and must never be substituted for the qualification closure subject.

## 1. Final authoritative raw ledger

Local artifact:

`acceptance-output/MCFT_CAP_09_ALL_BLOCKERS_18FA562_EXACT_V1.json`

Machine-verified identity:

- head: `18fa562804124f69f5a64f0fa549bdf69c656ea3`
- base: `4ee4989fc4f40cc52a3819be282c1d192b58a9b2`
- planner: `PASS`
- total checks: `33`
- PASS: `27`
- FAIL: `1`
- NOT_APPLICABLE: `5`
- authority errors: `0`
- unknown changed paths: `0`
- raw blocker count: `1`
- sole raw blocker: `LEGACY_AM19_PERSISTENT_24T`

The raw ledger intentionally retains the historical AM19 raw FAIL. It is not an open T0 blocker after the closure adjudication in section 3.

### Raw-ledger file digest binding

- requested digest type: SHA-256 of the exact local JSON bytes
- status at this remote handoff write: **LOCAL-ONLY ARTIFACT / HASH NOT RECOVERABLE BY REMOTE WRITER**
- reason: the artifact was generated in the operator's local `acceptance-output` directory and was not uploaded/committed before the previous handoff script terminated
- rule: **do not invent, substitute, or derive a different hash and label it as the file digest**
- reopening rule: absence of the remote file hash alone does **not** reopen a machine-completed blocker; any future evidence export must bind the original local JSON bytes before claiming a file-level digest

## 2. Phase5 closure — formally PASS

`PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS` is closed.

Final authoritative result:

- applicability: `REQUIRED`
- execution: `PHASE5_CAUSAL_TEMPORAL_SUPERSESSION_CONTRACT_ADMISSION`
- status: `PASS`
- reason: `PHASE5_CAUSAL_TEMPORAL_SUPERSESSION_CONTRACT_VALID`
- evidence id: `MCFT_CAP09_PHASE5_CAUSAL_TEMPORAL_SUPERSESSION_DC9EA15_V1`
- causal qualification subject: `dc9ea15a26c718594807fd0ac7158742518981b4`
- supersession durable package anchor: `e74f4348cc0318bb1fd3b3345bce7fe6c9c9dba6`
- Phase5 dependency digest: `sha256:058d42929efedbbc7f55bf6ca4c2380260731e1c652f27226e86e3f832518965`
- frozen Runtime remains: `3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a`

The causal temporal supersession package proved the replacement semantics using real PostgreSQL and exact-subject binding. The old `PROTECTED_TEMPORAL_SEMANTIC_CORE_UNCHANGED` premise was superseded; the historical 24T result was **not** reinterpreted as proving the new causal-revision semantics.

Do not rerun historical Phase5 24T merely to recreate the superseded premise. Do not mutate frozen Runtime to reopen or re-close Phase5.

## 3. Final AM19 zero-closure adjudication

Local artifact:

`acceptance-output/MCFT_CAP_09_AM19_FINAL_ZERO_CLOSURE_18FA562_V1.json`

Final adjudication:

- status: `PASS`
- check: `LEGACY_AM19_PERSISTENT_24T`
- reason: `CURRENT_SUCCESSOR_VERIFIED_DELIVERY_AND_DEPENDENCY_DIGEST_VALID`
- raw blocker count: `1`
- AM19 blocker admitted/closed: `1`
- adjudicated blocker count: `0`
- remaining blockers: `[]`
- QCP central ownership registered: `true`
- control-plane path count at final adjudication: `90`
- legacy registry boundary preserved: `true`
- requalification evidence append-only: `true`
- current successor inserted into legacy registry: `false`

Verified successor evidence retained:

- qualification subject: `4ee4989fc4f40cc52a3819be282c1d192b58a9b2`
- Runtime subject: `3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a`
- evidence package digest: `sha256:99ddad64a525f7bd22c55be5a9d994bd09118e77ae7e86d383056ca4f492e40f`
- manifest digest: `sha256:970cfbf743d44f9c1c84e9fd20e297f90a41e611b3466d55f97985d9534ecaec`
- delivery package digest: `sha256:c1f9987f7fd5776a1683b85f95941bd454aac1ea1410a1921809f5c9c4404a1a`

### Final-adjudication file digest binding

- requested digest type: SHA-256 of the exact local JSON bytes
- status at this remote handoff write: **LOCAL-ONLY ARTIFACT / HASH NOT RECOVERABLE BY REMOTE WRITER**
- reason: same local-only `acceptance-output` boundary as the raw ledger
- rule: **do not fabricate a file SHA-256**
- the adjudication semantics above are machine-proven from the operator output; future artifact export may add the exact file hash without changing or reopening the closure decision

## 4. Final T0 interpretation

The authoritative sequence is:

```text
raw authoritative ledger:
  LEGACY_AM19_PERSISTENT_24T = FAIL
  PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS = PASS

AM19 closure adjudication:
  LEGACY_AM19_PERSISTENT_24T = SATISFIED

final adjudicated state:
  blocker_count = 0
  remaining_blockers = []
```

Therefore:

**CAP-09 T0 blocker convergence = ZERO / CLOSED.**

The raw ledger is not to be rewritten to pretend the historical AM19 failure never existed. Conversely, the presence of that historical raw failure is not a reason to reopen AM19 after the verified-delivery closure adjudication.

A closed blocker may only be reopened by a new governed invalidation of its applicable dependency/evidence contract. Stale raw status, a new conversation, a new operator, or missing remote copies of local acceptance-output files are not invalidation events.

## 5. HOLD boundary — separate authorization remains mandatory

The following remain explicitly unauthorized:

- `Formal-v5 arm = HOLD / false`
- `A0 = HOLD / false`
- `O00-O23 = HOLD / false`
- production database mutation = unauthorized
- production owner activation caused by this closure = unauthorized
- provider request caused by this closure = none
- graduation effect caused by this closure = none
- `MCFT CAP-09 completed` claim = **false**

Zero T0 blockers does **not** imply Formal-v5 arm authorization, A0 authorization, O00-O23 authorization, production activation, successor graduation, merge authorization, or CAP-09 completion.

## 6. Mandatory next-operator rules

1. Read the historical canonical handoff and this active continuation before touching CAP-09.
2. Treat `18fa562804124f69f5a64f0fa549bdf69c656ea3` as the completed T0 closure subject.
3. Do not rerun historical 24T to reopen AM19 or Phase5.
4. Do not reopen `LEGACY_AM19_PERSISTENT_24T` or `PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS` without a new governed invalidation event.
5. Preserve frozen Runtime `3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a`.
6. Preserve the Phase5 supersession package anchor `e74f4348cc0318bb1fd3b3345bce7fe6c9c9dba6`.
7. Do not invent the two unavailable local acceptance-output file hashes; bind the original bytes if those artifacts are later exported.
8. Keep Formal-v5 arm, A0, and O00-O23 on HOLD until separately and explicitly authorized.
9. Do not claim CAP-09 completion from T0 convergence alone.

---

# GEOX MCFT CAP-09 HANDOFF CONTINUATION — 2026-10-03

Status: **ACTIVE CONVERSATION HANDOFF / CURRENT FRONTIER — NOT MASTER-TASK AUTHORITY**

Timestamp: **2026-10-03 18:41 +08:00**

Repository: `liyongshang44-max/GEOX`

This file is the active current-state handoff for MCFT CAP-09 as of 2026-10-03. It does not replace the MCFT / Digital Twin master task, CAP-09 taskbook, frozen Runtime authority, QCP authority, Formal authority, or accepted historical evidence.

The previous active continuation through 2026-10-02 was:

`docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-CONTINUATION-2026-09-26.md`

That continuation is retired from the current two-file handoff model at this checkpoint. Its full history remains preserved in Git / PR #3298, including exact snapshot commit:

`e27442041008652fb21bbd256a41d9b32f7c36e8`

Do not reconstruct current state from the retired continuation alone. The exact frontier below supersedes stale blocker/SHA facts where they conflict.

---

## 0. MANDATORY TAKEOVER READING — EXACTLY TWO CURRENT HANDOFFS

The next engineer / conversation must read **both** of these before changing MCFT CAP-09 code, governance, evidence, QCP, Formal, or production state:

1. Historical canonical handoff — frozen historical archive:

`docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-27.md`

2. Current active continuation — this file:

`docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-CONTINUATION-2026-10-03.md`

Also read before engineering changes:

- MCFT / Digital Twin master task document;
- MCFT CAP-09 task / acceptance / governance / qualification documents;
- current Qualification Control Plane and evidence registry;
- current Formal Store Authority V3;
- historical-logical successor contract / profile / reconciliation bindings when touching AM19 successor evidence.

Interpretation rule:

```text
canonical handoff = historical engineering and authority context
2026-10-03 handoff = current exact frontier and machine-state transfer
```

Do not use either file in isolation.

---

## 1. CURRENT TASK IN ONE SENTENCE

**Finish MCFT CAP-09 T0 blocker convergence by closing the remaining exact-head QCP evidence / invocation-context blockers on the current successor line, without reopening frozen Runtime semantics and without starting Formal-v5 / A0 / O00–O23.**

This is no longer general Runtime feature development.

The active work is now:

```text
current exact applicability plan
    ↓
all-blockers authoritative ledger
    ↓
select valid durable successor evidence first
    ↓
close invocation-context diagnostics
    ↓
AM19 current-head closure rebind
    ↓
Phase5 independent adjudication
    ↓
QCP = zero blockers
```

Post-CAP-09 MCFT → ADR → B-Line integration remains deferred until CAP-09 closure.

---

## 2. HARD AUTHORITY / NON-EFFECT BOUNDARIES

Frozen Runtime remains:

`3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a`

Current applicability base used by the local authoritative blocker plan:

`4ee4989fc4f40cc52a3819be282c1d192b58a9b2`

Current stage:

`SUCCESSOR_SUBJECT_PRE_MERGE`

Current 2026 crop-window adjudication remains:

`CLOSED_NO_RETRY_NO_RECAPTURE_NO_BYPASS`

Unless separately authorized:

```text
protected-main mutation       FORBIDDEN
Runtime semantic mutation     FORBIDDEN
production DB mutation        FORBIDDEN
Formal-store mutation         FORBIDDEN
Formal-v5 arm                 HOLD
A0                            HOLD
O00–O23                       HOLD
Stage 1B closure claim        FORBIDDEN
MCFT CAP-09 completion claim  FORBIDDEN
post-CAP09 T1–T6 start        HOLD
```

Do not solve QCP/evidence problems by reopening Runtime, provider semantics, Authority semantics, AM19 production semantics, or Closure semantics.

---

## 3. CURRENT REPOSITORY IDENTITIES — LOCAL AND REMOTE ARE NOT THE SAME

Active engineering branch:

`qualification/mcft-cap09-am19-historical-logical-successor-v1`

### 3.1 Current remote branch head

As re-read from GitHub at handoff time:

`fb601e460c2baf1c4ce591f8fff0be10847c3f90`

Commit message:

`governance(mcft-cap09): bind da09 exact requalification evidence`

This is the current **remote** branch head.

### 3.2 Current local authoritative worktree head

The user's current local authoritative ledger was generated after a local-only routing fix at:

`31ab0a0ce6bef2b53273b8a1974a5438dbf80282`

Commit:

`fix(mcft-cap09): prefer valid durable evidence before historical diagnostics`

That local commit changed only:

`scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs`

Machine checks around that commit proved:

```text
exact local HEAD / clean tracked worktree  PASS
planner status                             PASS
unknown_changed_paths                      0
authority_errors                           0
resolver_errors                            0
```

**Critical:** `31ab0a0c...` has not been confirmed on the remote branch at this handoff. Do not assume remote == local. Re-read both before any write, cherry-pick, push, or evidence import.

Do not force-push the remote branch merely to reconcile this difference.

---

## 4. WHAT HAS BEEN COMPLETED — DO NOT REOPEN WITHOUT NEW MACHINE EVIDENCE

### 4.1 Migration Design Reconciliation is closed

The Historical-Logical Successor migration design was statically reconciled across:

```text
Profile
epoch / retained raw
contract
runner
provisioner / Formal Store Authority V3
immutable package generator
Verifier 1
Closure Delivery builder
Verifier 2
QCP
Qualification Evidence Registry
Closure evidence-input boundary
```

Machine result reached:

```text
status                         PASS
blocker_count                  0
package_binding                PASS
verifier_1_binding             PASS
verifier_2_binding             PASS
qcp_binding                    PASS
closure_binding                PASS
static_reconciliation_complete true
```

Legacy controlled-capture was removed from the current Historical-Logical Successor admission dependency and retained only as historical / fallback / comparison material.

Do not restore fresh controlled capture as the current successor admission path.

### 4.2 Fresh Historical-Logical Successor 13/13 is PASS

Qualification subject:

`4ee4989fc4f40cc52a3819be282c1d192b58a9b2`

Frozen Runtime subject:

`3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a`

Successful run:

`mcft_cap09_am19_persistent_24t_historical_logical_v1-20261002t122627462z-4ee4989fc4f4-dd17a3a4`

Immutable evidence-package digest:

`sha256:99ddad64a525f7bd22c55be5a9d994bd09118e77ae7e86d383056ca4f492e40f`

Closure semantic subject:

`da09a68fc7ed39a0bc702a0c6cf8ef9e334dd8c9`

The run completed with a clean worktree and without production mutation.

**Do not rerun AM19 24T merely because current-head registry dependency digests later changed.** The proof exists; the current remaining AM19 work is governance / current-head closure rebind, not proof recreation.

### 4.3 Manifest, Verifier 1, Closure Delivery, Verifier 2 are all PASS

Qualification manifest digest:

`sha256:970cfbf743d44f9c1c84e9fd20e297f90a41e611b3466d55f97985d9534ecaec`

Verifier 1:

`PASS`

Immutable Closure Delivery id:

`mcft_cap09_am19_persistent_24t_historical_logical_v1-20261002t122627462z-4ee4989fc4f4-dd17a3a4-970cfbf743d4`

Closure Delivery package digest:

`sha256:c1f9987f7fd5776a1683b85f95941bd454aac1ea1410a1921809f5c9c4404a1a`

Verifier 2:

`PASS`

Verified non-effects included:

```text
runtime_mutated             false
production_mutation         false
qcp_semantics_modified      false
closure_subject_mutated     false
supersedes_github_lane      false
latest_run_fallback_used    false
```

Do not rebuild or replace this package unless its immutable verification itself is invalidated by new machine evidence.

### 4.4 QCP registration / Closure adjudication path has been materially advanced

Remote branch work after `4ee4989f...` has already landed the following governance steps:

```text
6ffe31b3  register AM19 verified delivery in QCP
fa285b44  retire one-time AM19 QCP registrar
94b2a0cd  adjudicate AM19 successor delivery
fb601e46  bind da09 exact requalification evidence
```

Important governance rule preserved by that work:

- do not rewrite the old legacy AM19 registry entry to pretend the successor is the old workflow evidence;
- keep historical generation history intact;
- current successor evidence is bound through governed current-successor / Closure registration and adjudication, not by falsifying old subject/digest fields.

### 4.5 Durable-first routing fix at local head `31ab...` is successful

The latest local preflight change intentionally prefers valid durable requalification evidence before falling back to historical diagnostics.

The full run proved:

```text
Phase2 diagnostic path                 PASS
H6 diagnostic path                     PASS
five biological/stage checks           durable-first route / PASS
planner                                PASS
unknown_changed_paths                  0
authority_errors                       0
resolver_errors                        0
```

This routing fix did **not** introduce a new logical misclassification in the completed checks.

Do not revert durable-first routing merely because the remaining ledger is non-zero.

---

## 5. CURRENT AUTHORITATIVE LEDGER — 7 BLOCKERS

At local authoritative head:

`31ab0a0ce6bef2b53273b8a1974a5438dbf80282`

current blocker count:

`7`

Classification:

```text
5 × UNRESOLVED_REQUIRED_CHECK
2 × DIAGNOSTIC_FAILURE
```

The seven are:

### 5.1 `LEGACY_AM19_PERSISTENT_24T`

Current nature:

- old evidence candidates are otherwise structurally strong;
- repeated decisive failure is `dependency_digest_match=false`;
- this is not authorization to rerun 24T.

Correct route:

**use the already-completed Historical-Logical Successor Closure adjudication / current-head rebind path.**

Do not hard-edit the legacy AM19 entry to make the digest current.

### 5.2 `PHASE3_EVIDENCE_RUNTIME_FOUNDATION`

Current authoritative dependency digest:

`sha256:1f7db1f41c0ad8e72855cf71256e738d2d8a05815301246b26a915fb447df4ac`

Current nature:

`NO_VALID_REQUALIFICATION_EVIDENCE`

There is already exact successful DA09 workflow evidence. It should be validated and selectively imported; do not rerun the qualification by default.

### 5.3 `PHASE4_TWIN_RUNTIME_FOUNDATION`

Current authoritative dependency digest:

`sha256:ce5d2e9754f1ecc7814f3ab6a1328063c2af5784cc29316c6779023c007efdd5`

Current nature:

`NO_VALID_REQUALIFICATION_EVIDENCE`

There is already exact successful DA09 workflow evidence. Validate + selectively import.

### 5.4 `PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS`

Current authoritative dependency digest:

`sha256:058d42929efedbbc7f55bf6ca4c2380260731e1c652f27226e86e3f832518965`

Current nature:

all currently known Phase5 candidates fail current dependency-digest matching.

This remains a **real standalone qualification blocker**.

Do not close it with routing tricks, stale evidence, or edited dependency digests. It requires its own adjudication after the easier evidence/import blockers are removed.

### 5.5 `PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION`

Current authoritative dependency digest:

`sha256:6d09054147c7ebf292cc50050f5e9187651af42195c623d3409928390f5e8161`

Current nature:

`NO_VALID_REQUALIFICATION_EVIDENCE`

There is already exact successful DA09 workflow evidence. Validate + selectively import.

### 5.6 `PRODUCTION_TWIN_PROCESS_V2_ROUTING`

Current authoritative dependency digest:

`sha256:6bebff54fef4bbd53cd804b65ecc5dbcff9bae6efd98fb091d2c3ddcc5bf9a24`

Current diagnostic first-red:

```text
EXACT_BASE_REQUIRED
expected = f605f7e22...
actual   = undefined
```

There is also exact successful DA09 workflow evidence. Prefer validating the durable evidence path before changing diagnostic semantics.

### 5.7 `T4R1_CURRENT_CROP_ROLLING_REFRESH`

Current diagnostic first-red:

`CURRENT_CROP_PRESERVATION_BASE_SHA_REQUIRED`

Current nature:

**invocation-context failure**, not yet evidence of a crop-authority semantic defect.

Handle this with a focused workflow-context / preservation-base test after the four available exact-evidence checks are processed.

---

## 6. FOUR EXISTING DA09 EXACT EVIDENCE RUNS — READ-ONLY VERIFICATION COMPLETED

The following four existing successful runs were independently re-read from GitHub. They all bind to:

```text
head subject = da09a68fc7ed39a0bc702a0c6cf8ef9e334dd8c9
PR base      = 8f63c498bd48978e2dd525ad57b6b8fdb7ada560
event        = pull_request
conclusion   = success
```

`8f63c498...` is already an allowed governed-successor predecessor in the registry rules.

### Phase3

```text
check     PHASE3_EVIDENCE_RUNTIME_FOUNDATION
run       36665643987
workflow  .github/workflows/mcft-cap-09-phase3-evidence-runtime-persistence.yml
binding   ab63a5704d5826bfbddabb833da5f8c9434ba96e7611c9ae5d430707fead5cac
```

A non-expired artifact also exists as additional evidence, but the current requalification resolver consumes run-level durable evidence.

### Phase4

```text
check     PHASE4_TWIN_RUNTIME_FOUNDATION
run       36665643844
workflow  .github/workflows/mcft-cap-09-phase4-twin-runtime-persistence.yml
binding   2082f4411cb3a1ff62d95582a7add014cb3ba4adbf29b5cd0b050a161c27cb32
```

A non-expired artifact also exists as additional evidence; admission resolver remains run-level.

### Phase7

```text
check     PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION
run       36665644144
workflow  .github/workflows/mcft-cap-09-phase7-candidate-promotion-composition.yml
binding   b91ce877604260a0866c3bc6229d4ffb81b36d74d0267c303fca39a352ae6f8b
```

A non-expired artifact also exists as additional evidence; admission resolver remains run-level.

### Production Twin V2 Routing

```text
check     PRODUCTION_TWIN_PROCESS_V2_ROUTING
run       36665643915
workflow  .github/workflows/mcft-cap-09-production-twin-process-v2-routing.yml
binding   21a784e1c0465b08f75ab52ae98448a2efc671263faf372129c751127e726749
```

This run has no artifact. The registry supports run-level requalification evidence with an explicit absence reason.

### Resolver format decision already established

The current all-blockers requalification resolver accepts:

`IMMUTABLE_WORKFLOW_RUN`

for this path and requires:

```text
run-level subject/base/workflow binding
current dependency digest
successful conclusion
governed predecessor
subject ancestry
durable anchor
18-field immutable binding
artifact_id = null
artifact_digest = null
artifact_absence_reason = RUN_LEVEL_REQUALIFICATION_EVIDENCE_ONLY
```

Therefore do not import Phase3/4/7 as artifact-class evidence merely because artifacts exist. The artifacts remain supporting evidence; the current resolver's admitted class is run-level.

---

## 7. EXACT STOPPING POINT AT HANDOFF

A fail-closed selective-import helper was prepared in the ending conversation for the four DA09 runs above, but **it has NOT been executed, committed, or pushed** at this checkpoint.

Do not claim the four checks are closed yet.

Current official ledger remains:

`7 blockers`

The planned importer was designed to require:

```text
source local head           31ab0a0ce6bef2b53273b8a1974a5438dbf80282
tracked worktree            clean
registry pre-import blob    728726680a530f8891b47b7081ecc778b568becc
current exact plan          PASS / exact 31ab head
mutation scope              registry file only
new evidence entries        exactly 4
new durable anchors         exactly 4
commit                      local only first
push                         HOLD until new ledger reviewed
```

The transient helper files created in the ChatGPT sandbox are not repository authority and should not be assumed to exist for the next conversation. Reconstruct the importer from the requirements in this handoff or retrieve it from the ending conversation if still available.

Expected blocker reduction (`7 → 3`) is only a hypothesis until a new exact-head all-blockers run proves it.

---

## 8. NEXT PLAN — EXECUTE IN THIS ORDER

### Step 1 — reconcile local / remote identity before writing

Re-read:

```text
local HEAD
remote qualification/mcft-cap09-am19-historical-logical-successor-v1
tracked worktree status
registry blob
```

Current known state at handoff:

```text
remote head  fb601e460c2baf1c4ce591f8fff0be10847c3f90
local head   31ab0a0ce6bef2b53273b8a1974a5438dbf80282
```

Do not overwrite one with the other and do not force-push.

### Step 2 — selective import the four validated DA09 run-level evidence entries

Import only:

```text
PHASE3_EVIDENCE_RUNTIME_FOUNDATION
PHASE4_TWIN_RUNTIME_FOUNDATION
PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION
PRODUCTION_TWIN_PROCESS_V2_ROUTING
```

For each entry:

- use the exact run id above;
- use `da09a68f...` as subject/dependency subject;
- use exact current dependency digest from the current plan;
- use `8f63c498...` durable-anchor base;
- use exact workflow path/name from the run;
- class = `IMMUTABLE_WORKFLOW_RUN`;
- no hand-edited digest substitutions;
- generate exact 18-field immutable binding;
- add matching durable anchor.

Mutation scope should be only:

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json`

### Step 3 — commit locally, rebind plan to the NEW head

After the registry commit:

1. require tracked worktree clean;
2. regenerate `PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1` using base `4ee4989f...`, new head, generation `v13`, stage `SUCCESSOR_SUBJECT_PRE_MERGE`;
3. require planner `PASS`;
4. require `unknown_changed_paths=0`;
5. require `authority_errors=0`;
6. require `resolver_errors=0`.

Do not reuse the `31ab...` plan after the registry commit; exact-head plans are SHA-bound.

### Step 4 — run ONE authoritative all-blockers preflight on the new exact head

Inspect the four imported checks individually.

Do not trust an expected count. The resulting machine ledger is authority.

If all four close, only then proceed as if the ledger has materially reduced.

### Step 5 — close Rolling Refresh invocation context

Focus only on:

`T4R1_CURRENT_CROP_ROLLING_REFRESH`

Current first-red:

`CURRENT_CROP_PRESERVATION_BASE_SHA_REQUIRED`

Use the correct governed preservation-base / workflow-context invocation. Do not change crop-authority semantics merely because the bare diagnostic lacks an environment variable.

### Step 6 — AM19 current-head closure rebind

For:

`LEGACY_AM19_PERSISTENT_24T`

use the already-proven Historical-Logical Successor package and Closure adjudication path.

Do not rerun the 24T proof and do not edit old evidence subject/digest fields to masquerade as current evidence.

### Step 7 — adjudicate Phase5 independently

For:

`PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS`

current digest is:

`sha256:058d42929efedbbc7f55bf6ca4c2380260731e1c652f27226e86e3f832518965`

Existing candidates are currently stale on dependency digest.

Treat this as the remaining genuine qualification blocker unless new exact evidence proves otherwise.

### Step 8 — drive exact-head QCP to zero blockers

After each material head movement:

```text
regenerate plan
→ rerun exact all-blockers
→ take machine first-red
```

Do not graduate multiple assumptions against a moving head.

### Step 9 — only after QCP=zero blockers

Then perform the separately governed successor graduation / merge adjudication.

Still do **not** arm Formal-v5 or start A0/O00–O23 without separate explicit authorization.

---

## 9. PITFALLS / MISTAKES ALREADY ENCOUNTERED — DO NOT REPEAT

### 9.1 Do not confuse local and remote heads

The current local `31ab...` routing commit is ahead of the remote `fb601...` branch. Always re-read both before writes.

Do not build a remote patch on `fb601...` and assume it automatically contains the local `31ab...` routing fix.

Do not force-push to erase either line.

### 9.2 Do not rerun qualifications that already have exact successful evidence

Phase3 / Phase4 / Phase7 / Production Twin Routing already have DA09 successful runs.

First validate and consume durable evidence. Re-execution is not the default answer to a registry gap.

### 9.3 Do not rerun AM19 persistent 24T

Historical-Logical Successor 13/13, Manifest, Verifier 1, Closure Delivery and Verifier 2 have all passed.

The remaining AM19 red is current-head governance binding, not lack of a proof run.

### 9.4 Do not fabricate evidence or rewrite old evidence fields

Forbidden shortcuts include:

- copy an old entry and replace only subject SHA;
- manually edit dependency digest to equal current;
- reuse an artifact under a different workflow/run identity;
- manufacture durable anchors;
- weaken `dependency_digest_match`;
- weaken ancestor/base checks.

Use real runs and exact immutable bindings only.

### 9.5 Do not choose evidence class by intuition

For the current requalification resolver, the admitted class is `IMMUTABLE_WORKFLOW_RUN`.

Phase3/4/7 having artifacts does not mean artifact-class is accepted by this resolver.

### 9.6 Exact-head plans and evidence are SHA-bound

Every commit changes the head. After a registry or routing commit, regenerate the plan.

Do not reuse the old plan or blocker JSON after HEAD advances.

### 9.7 Do not treat a bare diagnostic invocation-context failure as a semantic defect

Examples:

```text
PRODUCTION_TWIN_PROCESS_V2_ROUTING
→ missing exact base env

T4R1_CURRENT_CROP_ROLLING_REFRESH
→ missing preservation base env
```

First restore the required governed invocation context.

### 9.8 The earlier T4R1 exact-seven-file failure was an execution-lineage/context failure

A previous attempt ran the thermal biological-stage gate from a long mixed branch against base `17eb06c4...` and failed:

`MCFT_CAP09_T4R1_THERMAL_STAGE_EXACT_SEVEN_FILE_BOUNDARY_REQUIRED`

That failure did **not** prove biological-stage semantics were wrong. It proved the gate was invoked from the wrong exact topology.

Do not weaken the seven-file gate and do not call a later cosmetic `PASS` banner proof.

### 9.9 Never trust stale PowerShell objects / trailing PASS banners

A failed `Get-Content` can leave an older `$R` object in the session. Later lines may print `$R.status = PASS` even though the current result file was never generated.

Authority is:

```text
actual process exit
actual newly generated result file
exact subject/base binding
```

not a trailing `Write-Host "PASS"`.

### 9.10 Phase5 must remain a real blocker until independently proven

Do not route around it merely because the other evidence blockers can be closed by durable evidence.

### 9.11 Do not reopen closed crop-window / provider / Runtime semantics

Still forbidden:

```text
current-season recapture
current crop bypass
historical provider refetch to replace retained raw
floating image tags
Runtime semantic edits to satisfy QCP
authority semantic weakening
production mutation
Formal-store mutation
```

### 9.12 Keep handoff work documentation-only

PR #3298 is the handoff branch. Do not place engineering fixes there.

---

## 10. COMPACT TAKEOVER STATE — 2026-10-03

```text
MANDATORY READ — EXACTLY TWO CURRENT HANDOFFS
1. docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-27.md
2. docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-CONTINUATION-2026-10-03.md

ACTIVE TASK
CAP-09 T0 blocker convergence
exact-head durable evidence + invocation-context closure

FROZEN RUNTIME
3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a

APPLICABILITY BASE
4ee4989fc4f40cc52a3819be282c1d192b58a9b2

STAGE
SUCCESSOR_SUBJECT_PRE_MERGE

ENGINEERING BRANCH
qualification/mcft-cap09-am19-historical-logical-successor-v1

REMOTE HEAD AT HANDOFF
fb601e460c2baf1c4ce591f8fff0be10847c3f90

LOCAL AUTHORITATIVE HEAD
31ab0a0ce6bef2b53273b8a1974a5438dbf80282
NOT CONFIRMED PUSHED

COMPLETED
Migration Design Reconciliation             PASS / 0 blockers
Historical-Logical Successor fresh 13/13     PASS
immutable evidence package                   PASS
Manifest                                     PASS
Verifier 1                                   PASS
Closure Delivery                             PASS
Verifier 2                                   PASS
QCP verified-delivery registration           LANDED
Closure adjudication path                    LANDED
DA09 exact requalification evidence work     LANDED REMOTELY THROUGH fb601
31ab durable-first routing                    MACHINE-VERIFIED LOCALLY

CURRENT LEDGER
7 blockers
5 unresolved required checks
2 diagnostic failures

BLOCKERS
LEGACY_AM19_PERSISTENT_24T
PHASE3_EVIDENCE_RUNTIME_FOUNDATION
PHASE4_TWIN_RUNTIME_FOUNDATION
PHASE5_PRODUCTION_EQUIVALENT_CONTAINERS
PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION
PRODUCTION_TWIN_PROCESS_V2_ROUTING
T4R1_CURRENT_CROP_ROLLING_REFRESH

FOUR EXACT DA09 RUNS READY FOR SELECTIVE IMPORT
Phase3   36665643987
Phase4   36665643844
Phase7   36665644144
TwinV2   36665643915

SELECTIVE IMPORT
read-only validation complete
import helper prepared in ending conversation
NOT EXECUTED
NOT COMMITTED
NOT PUSHED
7→3 is NOT YET an authoritative result

NEXT
reconcile local/remote heads
→ selective-import 4 run-level entries + 4 durable anchors
→ registry-only local commit
→ regenerate exact plan on new head
→ one all-blockers run
→ focused Rolling Refresh preservation-base context
→ AM19 successor closure current-head rebind
→ Phase5 standalone adjudication
→ QCP zero blockers
→ successor graduation/merge adjudication

HOLD
Formal-v5
A0
O00–O23
post-CAP09 T1–T6

DO NOT
rerun AM19 24T
rerun existing DA09 checks by default
fabricate evidence
edit dependency digests by hand
weaken immutable/base/ancestry checks
trust stale PowerShell PASS output
force-push local/remote divergence
reopen frozen Runtime/provider/Authority semantics
```

---

## 11. FINAL TAKEOVER INSTRUCTION

The next conversation should start by stating that it has read both mandatory handoffs and the MCFT/CAP-09 task authority, then immediately re-read the live repository state before acting.

The first engineering question is **not** "what should we build next?" It is:

```text
Does local 31ab... still exist cleanly,
what is the current remote branch head,
and can the four already-verified DA09 run-level evidence entries
be imported into the exact current ledger without changing anything else?
```

Only after that machine result should the blocker count be updated.
