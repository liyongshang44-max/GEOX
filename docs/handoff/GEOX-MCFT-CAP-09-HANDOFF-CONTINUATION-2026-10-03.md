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
