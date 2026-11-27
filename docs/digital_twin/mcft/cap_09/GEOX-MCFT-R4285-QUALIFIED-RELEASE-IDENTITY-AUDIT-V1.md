# R4285 qualified release identity successor — audit checkpoint

Status: **DRAFT / NO EXECUTION AUTHORITY / CLOSURE OPEN**. CTO decision: ACCEPT_MAIN_DRIFT_BLOCKER / AUTHORIZE_BOUNDED_RELEASE_IDENTITY_SUCCESSOR / NO_UNSAFE_MAIN_BYPASS / PRESERVE_PHYSICAL_BOUNDARIES.

## Observed source state

- Historical accepted C6D: c6d666b4addaf71610bf3135c9380bb2b6ee5069, PR #3781. Original QCP74 and CI remain historical, not relabelled.
- Protected main readback: 8facaba79eaf42d9b9c854c091ae3a7319d455f8, 23 ahead, zero behind. Complete non-truncated Git tree comparisons read back 8526 and 8558 leaves, 34 changed paths, matching the later compare result; earlier reports said 33. No QCP74 breach is attributed to ordinary product merges.
- Existing QCP74 resolver subset V13_/CAP09_R4285_ contains 15 unique literal import roots and 149 exact/additional paths. Neither set intersects the observed 34 paths. **This is not the transitive or external-effect closure.**
- Product migration SQL creates a separate schema but references public.facts and public.field_index_v1 and grants REFERENCES; manager handlers can write shared facts. Product API read-only pool and route composition also touch shared read models. These require resource isolation and database/security contract review, not a path-prefix exemption.

## Actual identity call chain

| Surface | Current gate / required successor treatment |
| --- | --- |
| Trust V2 succession | verifyEffective: native ruleset, Owner approval and exact merge proof; remote main equality at entry and exit. Retain historical registration proof; current trust/revocation and ancestry must be live. |
| Native Adoption V4 | gitExactMain and verifyGitHubNativeProof; preserve exact PR source/base/merge tree, QCP74 raw ZIP/CI and fresh signatures; isolate historical merge identity from current ref. |
| Signed Evidence Gate | verifyExactMain/review; retain source worktree and signed predecessor, fullchain and inventory checks. |
| Prepare Live V3 | calls native adoption and lineage.verifyExactMain; keep pinned input, fresh owner window, session revocation and exact Scope/Source/Launch/Intent. |
| Resource Owner Producer V3 | requireLocalProtectedMain calls native gitExactMain; preserve complete native IAM/network/host/PG/S3 evidence. |
| Build Admission Exec V3 | verifyExecutionSources and lineage.verifyExactMain; 15 explicit execution paths are a subset, not closure. |
| Permit Atomic Exec V3 | verifyExactMain before final consume; keep independent fresh Final, 15-second and 120-second gates, exclusive run/nonce slots. |
| Windows Host V1 and child | exact installed node, tsx, SDK, Python, script hash and per-stage ticket; preserve six-stage budget and all runtime gates. Inspect legacy conditional entrypoints separately; do not globally relax historical routes. |

## Bounded design and remaining evidence

Use existing QCP import closure and exact path resolver, existing Release Binding and installed-material digest, and existing Trust/Native Adoption/Permit capabilities. Do not introduce a parallel signing hierarchy. The prototype in this draft compares actual local Git first-parent transitions with full tree path/mode/blob identity; unknown changes hold, dependency changes hold even when later reverted, and reviewed rows are *engineering inputs only*, never trusted authority. It can inventory C6D's actual bound sources against static import roots. It intentionally does not connect to any live authority caller.

Release binding is broad (conservative repository source coverage, including application source, migration SQL and dependency declarations). It is not automatically a minimal runtime closure. Obtain the actual local 6646-file Release inventory and 25631-file installed profile using their accepted digests, reconcile dynamic imports, Python, SDK/tsx, lockfiles, root config, subprocesses, SQL and external services. Existing planner buildImportClosure is a literal-import scanner; dynamic site output is review work, not proof of completeness. QCP exact paths may include workflows intentionally outside installed material. Distinguish qualification-only and runtime dependencies before freezing the successor manifest.

One successor only: exact merge and new QCP/CI for the amended validator; do not relabel C6D or refresh stale proofs as current authority. A future common verifier must obtain authenticated current protected-main identity, check a complete first-parent corridor and current trust/revocation, authenticate any noninterference review via existing governance/QCP, and reject incomplete histories, unknown dependencies, relevant changes, revocation, source or material drift, invalid authority and unreachable authority sources. Do not treat inspect() input as admission. Review authority revocation design and actual external effects before integrating. In-session immutable proof reuse may reduce repeated remote evidence requests; current ref/trust/revocation must still be refreshed before admission and irreversible consumption without extending 120/15-second gates. No persistent untrusted cache. Measure API calls and elapsed time before final integration. Unknown change review must not require re-signing an otherwise unchanged release merely due to HEAD advance.

## Evidence and status

Isolated Git fixture tests: 12/12 on Node 22.16.0 in Linux sandbox, including exact reviewed delta, unknown paths, shared dependency, trust change/revert, non-ancestry, rename/delete, invalid paths, Unicode and symlink. No actual GitHub qualification claimed by fixtures. Actual native Windows audit and authority integration pending. No original source, old ledger, material, PG, MinIO or IAM mutation. No QCP result rewrite. No formal Permit or Final. Physical 0/6.

QUALIFIED_RELEASE_IDENTITY=HOLD_CLOSURE_OPEN
EXECUTION_DEPENDENCY_CLOSURE=UNVERIFIED
PHYSICAL_RESOURCE_ISSUANCE=NOT_YET_AUTHORIZED
PERMIT_CONSUMED=FALSE
FORMAL_PHYSICAL=0/6

## 2026-11-27 actual Windows audit / common identity candidate

- User-supplied C6D report raw SHA-256: 20d41c5bf1d527df1fb381e8afcb13c0931b58ba4dd22ac41cdc0897f3e421b5. 35 roots, 209 literal-import paths, 149 QCP exact paths, 298 union, zero unresolved, zero absent tracked paths, zero untracked Release paths. 26 outside Release = 20 workflows and 6 governance Markdown documents (keep source-qualification protection); 274 dynamic sites in 82 files remain review scope.
- Actual provider source inspection identified two subprocess Python paths absent from the 298 list: GFS raw bundle decoder and KBS scientific core. Both were already Release-bound. Also include package metadata/locks, existing shared SQL/bootstrap, MCFT policy JSON and governance workflows conservatively. The candidate protected path set has 1334 paths. Every path was checked against the actual draft source tree or this exact new commit. This is not a completeness claim; no path prefix grants an exemption.
- Current GitHub ruleset 19167144 is active, has zero bypass actors, but required reviewer count is zero. Protected merge alone is not an independent impact-review attestation.
- Implemented one draft common identity kernel (not wired to old or current admission routes). Full first-parent transition checking uses the existing audit; a relevant dependency change (including change followed by revert) cannot be overruled by an impact comment. Any unknown delta requires an exact native Owner noninterference review bound to release Subject, observed main, policy bytes and complete delta digest. This is a candidate reuse of the existing Owner-comment channel, not an execution approval or a new signer. Review-evidence validation and integration are still open. Fresh repo/branch/ruleset and review re-read are required; the in-process capability cannot be reconstructed from fixture output. A changed observed main invalidates this impact assessment, not the release's historical QCP. Refresh before the short window; measure final-edge latency/API calls before wiring. Do not allow local or unsigned caches or lengthen safety windows.
- Policy state remains CANDIDATE_CLOSURE_OPEN; the actual native entry rejects it. 13/13 isolated Node 22.16.0 Git/contract tests passed in Linux against the source/test blobs prepared for this commit; these are not native Windows or GitHub qualification evidence. Original execution paths, resource state, C6D signatures and historical proof unchanged. No authority comment published, no Permit, no Host. Physical 0/6.

## 2026-11-27 exact inventory reconciliation and review evidence correction

Full C6D uploaded report read and compared with the candidate policy at b264a412cbbc9f1e3b08068d427e27712196f969. All 298 candidate paths and all 82 dynamic-site files are present in the 1334 protected paths. 1036 additional paths are conservative protection. All 26 non-release candidates belong to QCP exact paths and none belong to literal imports. This verifies inventory coverage, not semantic noninterference. The observed C6D-to-8facaba7 compare contains 34 paths outside the candidate policy, all require effect review, not automatic approval. Native PG read-only and account binding already check exact 29-table set, fenced writer, role and permission digest; isolated resource scope must remain an independent native gate. Python imports numpy, refet and eccodes: the existing Material pins Python executable bytes but the report does not establish the package and native-library environment closure outside release root. Do not claim full dependency closure or expand agricultural algorithms.

Corrected the candidate Owner impact-review consumer: the previously accepted arbitrary-format review_evidence_sha256 is now bound to a canonical embedded assessment list, ordered against the complete native delta, with exact per-row digest, noninterference decision and bounded rationale. Missing, duplicate, altered, reordered or unresolved assessments fail. The immutable delta rows are part of the in-process proof; this is an authenticated Owner assertion, not a machine proof that the rationale is true. No new signing hierarchy. The isolated new evidence helper passed 9/9 Node 22.16.0 fixture tests; full integrated test file and CI have not yet run in this turn. Do not enable this prototype. Exact current Git object availability, Python external package binding, dynamic effect review, authority refresh latency and active caller integration remain open. A fixed observed-main review still requires a new impact assessment for a later unreviewed tip; solve this through bounded incremental impact review, not repeated release signatures. No resource or historical authority mutation.

## 2026-11-27 dynamic-site source adjudication and bounded incremental candidate

Read all 274 listed expressions in the 82 exact historical C6D source files, including the corresponding subprocess/loader branches and the three Python provider scripts. This is source-site triage, not a claim that a regex inventory constitutes complete runtime closure. No current native process/ACL/credential operation was run. The evidence below identifies exact historical blobs, site lines and residual dependency groups. Same-path future edits are not implicitly qualified.

- **PYTHON_PROCESS_ENV_OPEN** — Configured Python and exact sibling script path; inherited cwd/environment, package/native DLL and ecCodes data closure not in Material. (2 files).
- **NATIVE_GITHUB_GIT_TOOL_OPEN** — Git/curl or native approval readback and signed source bytes; preserve historical proof; actual executable, configuration and API latency boundary open. (12 files).
- **SIGNED_EVIDENCE_OR_KEY_READ** — Evidence, signed inputs, ledger, stage ticket, explicit private key, or receipt bytes; exact digest/path/authority checks remain required. Historical variants do not become current authority. (43 files).
- **MATERIAL_AND_RESOLVER_OPEN** — Complete release inventory and preloaded module/package metadata checks. External interpreter environment and executable resolution not established by these checks. (3 files).
- **PLANNER_GENERATOR_OPEN** — Static scanner and configured generator subprocess, Git objects, qualification artifacts; must keep exact QCP resolver and generation contracts. (1 files).
- **PG_BOOTSTRAP_SQL_EFFECT** — Qualification SQL actually sent to PG in acceptance test; separate from formal runtime, exact bootstrap/migration sources and isolated DB identity required. (1 files).
- **STATIC_CREATE_REQUIRE_AND_STAGE_ARTIFACT** — Fixed literal module selectors or exact timing evidence; branch selection depends on child authority environment and frozen child ticket. No generic dynamic import exemption. (7 files).
- **LEGACY_BASELINE_AND_RUNNER_TOOL_OPEN** — Legacy conditional paths, Git context, ARM, Python selftest or Node/tsx child dispatch; retain exact historical route gates; do not relax these as active successor shortcut. (4 files).
- **RELEASE_ROOT_PG_S3_MODULES** — pg/AWS SDK resolved against release root, with existing read-only scoped queries or S3 contract. External resource identity and ACL still independently checked. (4 files).
- **ACTIVE_PREPARE_BRANCH_AND_OWNER_TOOL_OPEN** — Prepare chooses exact receiver; Owner producer resolves pg/S3 and invokes Docker/mc/PowerShell with bounded argv and environment; native tool and physical isolation must be proved. (2 files).
- **STAGE_SUBPROCESS_TOOL_OPEN** — Host/Stage receipt child executable/argv/cwd/env, Python selftest and taskkill; require installed identity and exact stage capability. Native OS/tool closure open. (3 files).

| # | Source | C6D Git blob | Sites | Disposition |
|---:|---|---|---|---|
| 1 | `apps/server/src/external_evidence/provider/gfs_raw_bundle_evidence_decoder_v1.ts` | `345e1faf6c873a8e434166df7f90b6cf1e22af29` | 6, 20, 160 | PYTHON_PROCESS_ENV_OPEN |
| 2 | `apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts` | `4d5d14f82ba2cb5eb9f235d9b0393ee842901e89` | 7, 23, 263 | PYTHON_PROCESS_ENV_OPEN |
| 3 | `scripts/cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.cjs` | `d50726ed84b4e700ea1a35b83cd29389a8e5a01e` | 49, 122, 157, 159, 180, 181 | NATIVE_GITHUB_GIT_TOOL_OPEN |
| 4 | `scripts/cap09_adoption_v1/MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V1.cjs` | `572ef95578cb240bb619827b8f411181cc34e294` | 34 | SIGNED_EVIDENCE_OR_KEY_READ |
| 5 | `scripts/cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V1.cjs` | `c8dbd841851cad8b3ced05dbd6a2802925a030d7` | 27, 36, 159, 266 | NATIVE_GITHUB_GIT_TOOL_OPEN |
| 6 | `scripts/cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V2.cjs` | `f1fff59fff513d3b73729bbf7c5c864391309be8` | 28, 37, 188, 295 | NATIVE_GITHUB_GIT_TOOL_OPEN |
| 7 | `scripts/cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V3.cjs` | `2cb6e98025920cc2eb8114095f834ac9638de936` | 28, 37, 188, 295 | NATIVE_GITHUB_GIT_TOOL_OPEN |
| 8 | `scripts/cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.cjs` | `15d3497dab04ecd4ab1ca6a084270c2436f4226a` | 29, 38, 190, 301 | NATIVE_GITHUB_GIT_TOOL_OPEN |
| 9 | `scripts/cap09_adoption_v1/SIGN_R4285_OWNER_LINEAGE_ADOPTION_V5_TRUST_V2_LOCAL.cjs` | `28705dd7033f69f4bbe6b6ba7bfe08f3f75242d7` | 58, 62, 64 | SIGNED_EVIDENCE_OR_KEY_READ |
| 10 | `scripts/cap09_adoption_v1/contract.cjs` | `71ca58a287a38623099390b2b8a3d92e5478f0f1` | 38, 52, 57, 64, 101 | SIGNED_EVIDENCE_OR_KEY_READ |
| 11 | `scripts/cap09_adoption_v1/da9-minio-closure-v1.cjs` | `355f1fce3b04361d8981e39db26f839e907bd4db` | 13, 150 | SIGNED_EVIDENCE_OR_KEY_READ |
| 12 | `scripts/cap09_adoption_v1/da9-minio-disposition-v1.cjs` | `6838859e295a777410a3d4bbe0ee73e5668d213c` | 3, 33, 174 | SIGNED_EVIDENCE_OR_KEY_READ |
| 13 | `scripts/cap09_adoption_v1/da9-retry-bundle-v2.cjs` | `d39d3e9c0cee9e0554475a44a24c8766b328be6c` | 15, 28, 195, 200, 214, 222 | SIGNED_EVIDENCE_OR_KEY_READ |
| 14 | `scripts/cap09_adoption_v1/installed-material.cjs` | `992d68e0e283ed59eb7d9a635050759055cd885b` | 8, 13, 24, 43 | MATERIAL_AND_RESOLVER_OPEN |
| 15 | `scripts/cap09_adoption_v1/offline-context.cjs` | `c023cd72e636e097c81d551388930bc2e5ae9beb` | 101, 117, 173, 181, 187, 283 | SIGNED_EVIDENCE_OR_KEY_READ |
| 16 | `scripts/governance_acceptance/MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.cjs` | `e4ab09b42b7f90ebf4ce9f4169c4f66c55ba658c` | 71 | SIGNED_EVIDENCE_OR_KEY_READ |
| 17 | `scripts/governance_acceptance/MCFT_CAP09_ATTEMPT3_RESOURCE_OWNER_V1.cjs` | `56865d293f2cda9f4cdc8c3ca5fee968c0a37c85` | 76 | SIGNED_EVIDENCE_OR_KEY_READ |
| 18 | `scripts/governance_acceptance/MCFT_CAP09_DA9_PREPERMIT_SOURCE_USE_BUDGET_V3.cjs` | `404ad1d1af2ca4cc82d1253f3b5da71ab439a8f2` | 38, 46, 50, 51, 52 | SIGNED_EVIDENCE_OR_KEY_READ |
| 19 | `scripts/governance_acceptance/MCFT_CAP09_ISOLATED_RETRY_ADMISSION_BRIDGE_V1.cjs` | `d316ee30b71df46db2a54d79d9b91bd1c3efaa78` | 127 | SIGNED_EVIDENCE_OR_KEY_READ |
| 20 | `scripts/governance_acceptance/MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_PROOF_GATE_V1.cjs` | `cbf9fb926bced8a4ce8f31f39a0d706930e7c499` | 42 | SIGNED_EVIDENCE_OR_KEY_READ |
| 21 | `scripts/governance_acceptance/MCFT_CAP09_PREPERMIT_BUDGET_CONTRACT_V2.cjs` | `505a30270177d5847d7c7f379ce50fa9ff4b0b91` | 38, 114, 154 | SIGNED_EVIDENCE_OR_KEY_READ |
| 22 | `scripts/governance_acceptance/MCFT_CAP09_R4285_RESOURCE_OWNER_V1.cjs` | `8e6c481d3cd55b894c0ab5c8ae3565b66cf5e73d` | 76 | SIGNED_EVIDENCE_OR_KEY_READ |
| 23 | `scripts/governance_acceptance/MCFT_CAP09_R4285_RESOURCE_OWNER_V3.cjs` | `e349a379980fccbc7d113a28918646f6c3a1f37e` | 78 | SIGNED_EVIDENCE_OR_KEY_READ |
| 24 | `scripts/governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs` | `ab1e095ec1bba18fe0c62eb9b63ea21f006e0924` | 43, 155 | NATIVE_GITHUB_GIT_TOOL_OPEN |
| 25 | `scripts/governance_acceptance/MCFT_CAP09_RETRY_HISTORICAL_EVIDENCE_V1.cjs` | `852369456cf4cd7d213434ca927298fb5297da3a` | 17 | SIGNED_EVIDENCE_OR_KEY_READ |
| 26 | `scripts/governance_acceptance/MCFT_CAP_09_ISOLATED_RETRY_AUTHORITY_POLICY_V1.cjs` | `f16692f7a50fb657d1e9973540edd31689c13128` | 132 | SIGNED_EVIDENCE_OR_KEY_READ |
| 27 | `scripts/governance_acceptance/PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs` | `15159d41f76e24dd6ed84e700a3e5ae316184b9c` | 28, 97, 115, 184, 372, 385, 398, 401, 405, 409, 470, 501, 820, 830 | PLANNER_GENERATOR_OPEN |
| 28 | `scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_V13_AUTONOMOUS_CONTROLLER_SERVICE_POSTGRES.ts` | `abbb47f6035c52766969285e40efef5c2cb04c13` | 68, 73 | PG_BOOTSTRAP_SQL_EFFECT |
| 29 | `scripts/runtime_acceptance/AGGREGATE_MCFT_CAP09_R4285_TIMING_V1.ts` | `a638bbce393bfff3beb264e745c5373111585296` | 1, 2, 54, 59, 108, 110, 111, 113, 118, 125, 140 | STATIC_CREATE_REQUIRE_AND_STAGE_ARTIFACT |
| 30 | `scripts/runtime_acceptance/AGGREGATE_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V1.ts` | `af0a2af45f537e9d598c856f21911fa246f5e151` | 49, 54 | STATIC_CREATE_REQUIRE_AND_STAGE_ARTIFACT |
| 31 | `scripts/runtime_acceptance/AGGREGATE_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V2.ts` | `31983b8ae13720ffab3a62db79815cf24ecfa7ad` | 1, 2, 54, 59, 108, 109, 111, 116, 123, 138 | STATIC_CREATE_REQUIRE_AND_STAGE_ARTIFACT |
| 32 | `scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_CHILD_STAGE_V2.cjs` | `b81b58193e288e2bcff458cab1ee64b52cce1fab` | 46 | SIGNED_EVIDENCE_OR_KEY_READ |
| 33 | `scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_PERMIT_V2_ATOMIC.cjs` | `ae142ad854ed7ba6c8b84aa6297330076182ae10` | 32, 146, 147 | SIGNED_EVIDENCE_OR_KEY_READ |
| 34 | `scripts/runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs` | `77e726f1e0ee4a623d6ea7492f660accd424cbe0` | 22, 268, 269 | LEGACY_BASELINE_AND_RUNNER_TOOL_OPEN |
| 35 | `scripts/runtime_acceptance/MCFT_CAP09_POSTEXECUTION_TIMING_ADJUDICATION_V2.cjs` | `d2a0b69b202e356ea99dea91197833183da64b5c` | 8 | SIGNED_EVIDENCE_OR_KEY_READ |
| 36 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_ADMISSION_EXEC_V3.cjs` | `05b9e67918af626731f4531fc1d5ac6a7129d0b0` | 84, 104 | NATIVE_GITHUB_GIT_TOOL_OPEN |
| 37 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_ADMISSION_V2.cjs` | `ea7fe5f0828f4d082fc6b49c31f1ab40de4d9287` | 79, 99 | NATIVE_GITHUB_GIT_TOOL_OPEN |
| 38 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_ADMISSION_V3.cjs` | `1e36c4390ffb3435123ecb2d7f3454eb7dccd5bd` | 80, 100 | NATIVE_GITHUB_GIT_TOOL_OPEN |
| 39 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_BUILD_ADMISSION_EXEC_V3.cjs` | `ac1e6426ec38d1df7ef731c2f2f8140291ead8e4` | 53 | SIGNED_EVIDENCE_OR_KEY_READ |
| 40 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_BUILD_ADMISSION_V3.cjs` | `e98c5ab662f9e93828d932d53dca9cff90380fda` | 22 | SIGNED_EVIDENCE_OR_KEY_READ |
| 41 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_CHILD_STAGE_V1.cjs` | `1df8d627327f8a52d2f36f08f4f75afc85546dd9` | 49 | SIGNED_EVIDENCE_OR_KEY_READ |
| 42 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_CONTROLLED_DELAY_V1.cjs` | `f488a3407aba13e64742bbc576483647ec13087b` | 26, 69, 86, 88 | SIGNED_EVIDENCE_OR_KEY_READ |
| 43 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_CURRENT_BASELINE_EXECUTION_V1.cjs` | `d975518b08409624929bad662a214d386ca8aacc` | 68, 78, 86, 100 | LEGACY_BASELINE_AND_RUNNER_TOOL_OPEN |
| 44 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_EXECUTION_APPROVAL_V1.cjs` | `e34df2d3d0655aa2b258ec099209de6026d056a1` | 72 | NATIVE_GITHUB_GIT_TOOL_OPEN |
| 45 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_EXECUTION_IDENTITY_V3.cjs` | `3f26b25a14608282cc2ed4256aa021327f9d9af1` | 19 | SIGNED_EVIDENCE_OR_KEY_READ |
| 46 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_HOST_ADMISSION_EXEC_V3.cjs` | `38bc09e7c6d612a565ee63c6c11ca21ed74aabf2` | 38, 41 | SIGNED_EVIDENCE_OR_KEY_READ |
| 47 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_HOST_ADMISSION_V3.cjs` | `b050df07e28b648af4f2856d47921a4a95a47a60` | 36, 39 | SIGNED_EVIDENCE_OR_KEY_READ |
| 48 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_MATERIAL_FULL_PARALLEL_V2.cjs` | `5646612a66750d8362d08ae42e7263bbd787196f` | 17 | MATERIAL_AND_RESOLVER_OPEN |
| 49 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_PERMIT_ATOMIC_EXEC_V3.cjs` | `401e47c15a37c73c133d88be68f110af8459922e` | 50 | SIGNED_EVIDENCE_OR_KEY_READ |
| 50 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_PERMIT_ATOMIC_V1.cjs` | `f83d851578d9d7d2dc5d124a6c2341b73ce0e110` | 45 | SIGNED_EVIDENCE_OR_KEY_READ |
| 51 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_PERMIT_ATOMIC_V2.cjs` | `2d2a9c1ce91b4630d33203a2961273ad9d52f6e7` | 46 | SIGNED_EVIDENCE_OR_KEY_READ |
| 52 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_PG_ACCOUNT_BINDING_V3.cjs` | `4a7afde8aca61a21610b472573757bc989a5834e` | 9 | RELEASE_ROOT_PG_S3_MODULES |
| 53 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_PG_READONLY_V1.cjs` | `46ef8aa8b672935770fe7e7d885fe4a429a133a2` | 89 | RELEASE_ROOT_PG_S3_MODULES |
| 54 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_PG_READONLY_V3.cjs` | `37a71f0d54d3f5278278bc83f57eecd627a24f91` | 93 | RELEASE_ROOT_PG_S3_MODULES |
| 55 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_PINNED_LOADING_V3.cjs` | `3926e79b56346d4a29483b117da29e45ba4c7683` | 16, 58, 59, 60, 107 | MATERIAL_AND_RESOLVER_OPEN |
| 56 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs` | `d3a1fc13840be1f6012ca5074033eeaf64c72522` | 55, 153 | ACTIVE_PREPARE_BRANCH_AND_OWNER_TOOL_OPEN |
| 57 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_RESOURCE_OWNER_PRODUCER_V3.cjs` | `954195e6b07bc70933418fc46cbe9d56824b9c3c` | 228, 416, 492, 655, 737, 745, 1339, 1369, 1487, 1553, 1618, 1697, 1719 | ACTIVE_PREPARE_BRANCH_AND_OWNER_TOOL_OPEN |
| 58 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_S3_READONLY_V3.cjs` | `5f83a57e6766c989e4ea6cac8a6580aa1f860edf` | 6 | RELEASE_ROOT_PG_S3_MODULES |
| 59 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_SCOPE_V3.cjs` | `ce968e94c46ce2a3c40552071ffc0727247134b8` | 35, 78 | NATIVE_GITHUB_GIT_TOOL_OPEN |
| 60 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_STAGE_CAPABILITY_EXEC_V3.cjs` | `6e92c27b1c2aafddc082f5fcf1c6b09f1f57b216` | 38, 73, 86 | SIGNED_EVIDENCE_OR_KEY_READ |
| 61 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_STAGE_CAPABILITY_V1.cjs` | `478da4ee6dbd1355f57540d4ddcad8412affc47b` | 38, 73, 86, 101, 116, 123, 135 | SIGNED_EVIDENCE_OR_KEY_READ |
| 62 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_STAGE_CAPABILITY_V2.cjs` | `583e1a816ee49d80a1aba2fca745d8b7e82b5c32` | 38, 73, 86, 101, 116, 123, 135 | SIGNED_EVIDENCE_OR_KEY_READ |
| 63 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_STAGE_RECEIPTS_V1.cjs` | `2e0e89d0a215a9b2e54e6d89b4d55573af85a273` | 14, 49, 56, 70 | STAGE_SUBPROCESS_TOOL_OPEN |
| 64 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_WINDOWS_HOST_EXEC_V3.cjs` | `5a938e2d2e9be9a2ff821eba2bad0d4f59f8b344` | 119 | SIGNED_EVIDENCE_OR_KEY_READ |
| 65 | `scripts/runtime_acceptance/MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs` | `16778d036a4b9e94c77a963eedc1667dca2277f9` | 70, 117, 169, 297 | STAGE_SUBPROCESS_TOOL_OPEN |
| 66 | `scripts/runtime_acceptance/MCFT_CAP09_REAL_CONTROLLED_DELAY_V1.cjs` | `7146cfbd6aa47ffe595c21862783973d11967da5` | 26, 69, 86, 88 | SIGNED_EVIDENCE_OR_KEY_READ |
| 67 | `scripts/runtime_acceptance/MCFT_CAP09_REAL_PIPELINE_DELAY_V1.cjs` | `8b2f66eb823517bbe77f665419e6505300cef005` | 65, 80, 100 | SIGNED_EVIDENCE_OR_KEY_READ |
| 68 | `scripts/runtime_acceptance/MCFT_CAP09_REAL_PROVIDER_RESPONSE_DELAY_V1.cjs` | `c4e4af312ea708c24cdb49c4d82ff7935bd2e902` | 81, 95, 111 | SIGNED_EVIDENCE_OR_KEY_READ |
| 69 | `scripts/runtime_acceptance/MCFT_CAP09_RETRY_PERMIT_V1.cjs` | `80a7c6d721a219430d9d99e9cad075bc9cdf6e41` | 85, 88, 130 | SIGNED_EVIDENCE_OR_KEY_READ |
| 70 | `scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V2_SUCCESSION_V1.cjs` | `26538d962b3d212d4390dbe9f171be4c3dadb3b8` | 78, 83, 167, 170 | NATIVE_GITHUB_GIT_TOOL_OPEN |
| 71 | `scripts/runtime_acceptance/MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs` | `a24665c7399c639ce25a3730c32debfe4ca33e11` | 26, 37, 39, 40, 44 | SIGNED_EVIDENCE_OR_KEY_READ |
| 72 | `scripts/runtime_acceptance/MCFT_CAP09_STAGE_CAPABILITY_V1.cjs` | `ffde9172af5ed0307dc51e29b32ee9724414564c` | 36, 67, 80, 95, 110, 117, 127 | SIGNED_EVIDENCE_OR_KEY_READ |
| 73 | `scripts/runtime_acceptance/MCFT_CAP09_STAGE_CAPABILITY_V2.cjs` | `399d39600eb025384c07318eb0f0eb73cd697813` | 38, 73, 86, 101, 116, 123, 135 | SIGNED_EVIDENCE_OR_KEY_READ |
| 74 | `scripts/runtime_acceptance/MCFT_CAP09_STAGE_RECEIPTS_V1.cjs` | `5e152fd24eb54eb26ca8d72f8dba7131bef639c6` | 14, 49, 56, 70 | STAGE_SUBPROCESS_TOOL_OPEN |
| 75 | `scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs` | `f67059bbc03f482a933e99c427771e1722466f51` | 68, 78, 86, 100 | LEGACY_BASELINE_AND_RUNNER_TOOL_OPEN |
| 76 | `scripts/runtime_acceptance/RUN_MCFT_CAP09_R4285_PRODUCER_V1.ts` | `a5e5db4e92028f393c38b723323c28b436123d1c` | 1, 2, 4, 5, 6, 149, 151, 152 | STATIC_CREATE_REQUIRE_AND_STAGE_ARTIFACT |
| 77 | `scripts/runtime_acceptance/RUN_MCFT_CAP09_R4285_TIMING_V1.ts` | `46868f9d0684934094a45ce431e272fbf00657fd` | 1, 2, 3 | STATIC_CREATE_REQUIRE_AND_STAGE_ARTIFACT |
| 78 | `scripts/runtime_acceptance/RUN_MCFT_CAP_09_CURRENT_BASELINE_QUALIFICATION_V1.cjs` | `b1081cd57b78e337ea386b58ae16e000e8b7a215` | 27, 32 | LEGACY_BASELINE_AND_RUNNER_TOOL_OPEN |
| 79 | `scripts/runtime_acceptance/RUN_MCFT_CAP_09_V13_CONTROLLED_TIMING_DELAY_MATRIX_V1.ts` | `200f9e975bf93d8bdb16a00ab9209286f1f74a49` | 131, 132 | SIGNED_EVIDENCE_OR_KEY_READ |
| 80 | `scripts/runtime_acceptance/RUN_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_V2.ts` | `4b30a11186b80b9d37da252b735332202ef94a9d` | 1, 2, 3 | STATIC_CREATE_REQUIRE_AND_STAGE_ARTIFACT |
| 81 | `scripts/runtime_acceptance/RUN_MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2.ts` | `12029e293e7374f3b30258e16ce3b4da7dfa1d47` | 1, 2, 4, 5, 6, 149, 150 | STATIC_CREATE_REQUIRE_AND_STAGE_ARTIFACT |
| 82 | `scripts/runtime_acceptance/VALIDATE_MCFT_CAP_09_V13_FROZEN_TIMING_AUTHORITY_V1.ts` | `f5c332ca0f4175caa1f79d046182b256b4cc4bbe` | 17, 18, 19 | SIGNED_EVIDENCE_OR_KEY_READ |

### Remaining external closure (not waived)

- GFS decoder `mcft_cap09_gfs_raw_bundle_decoder_v1.py` loads its sibling core by exact `importlib.util.spec_from_file_location`; GFS core imports numpy, refet, eccodes; KBS core imports numpy/refet. The existing installed-material profile covers files inside release plus the Python executable bytes, not the entire external stdlib/site-packages, transitive modules, DLLs, ecCodes definitions/samples or interpreter search environment. Both TS decoders launch using `cwd: process.cwd()` and inherit the environment; a pinned executable alone is insufficient. A successor must bind and verify the actual isolated interpreter/dependency/native-library root, resolved module origins, search variables and child environment. Do not install or change Python before measuring the current native environment. Neither provider code nor original material has been modified here.
- Native Git/curl/Docker/mc/PowerShell/taskkill invocation and credential source identity must remain separately verified in the real Windows gate. Pin executable/resolution and review external effects; a source path list is not a host boundary. PG/S3 release-root module resolution, exact run-scoped DB/catalog/fenced ACL, bucket and dedicated network must remain independent native checks. Product migrations/grants/shared facts and deployment/workflow changes remain unknown unless independently resolved; no blanket product exemption.

### Incremental impact candidate, not admission

Implemented ordered, exact first-parent review segments, anchored to qualified Subject, policy bytes, prior checkpoint, target checkpoint, complete segment delta and per-unknown-row evidence. A subsequent tip may reuse an unchanged authenticated prior review without asking for a new whole-release signature. Added two deliberately narrow deterministic source effect rules on actual Customer Portal files: the exact dashboard-title bilingual display literal and exact existing CSS numeric presentation declarations. They anchor to reviewed Git blobs and reject other line changes, unexpected modes, anchor drift and protected changes, including revert. Unknown backend code, migrations, deployment/authority or mixed changes still HOLD until a new exact review or a qualified independent machine proof. An unproven edit to either rule path HOLDs rather than becoming a path exemption. The native wrapper still must obtain authenticated comments and live trust/ruleset/ref state and prove Windows refresh latency. Fixture replies cannot mint live capabilities. This is a candidate proof of a bounded class of ordinary product changes; it does not solve arbitrary backend/external-effect noninterference. Accordingly do not integrate active callers or qualify the policy at this checkpoint.

The previous EA5E2 dependency-closure run 45927275813 failed because the six new paths were not registered in the central planner; the scientific-core job succeeded. Register the exact candidate files under the existing last R4285 check rather than suppress unknown-path checks or reissue historical QCP. Candidate workflow executes the incremental and audit contracts; results pending actual run. No account, Scope, Owner, Permit, Host, main merge or production authorization.

## 2026-11-27 — C6D native Python observation reconciliation (non-authorizing)

Both original user-uploaded JSON files were read byte-for-byte, not reconstructed from console summaries. Their SHA-256 values match the Windows receipts: default 08416e5edaa221db1a3b79513c5051eb479151a7f920ce5b51ba2acedfd02646; isolated 706691cf3145d6619a6da783336f83751cf59e60452487d5548d044858245ad7. Both bind C6D subject, material b41dfb1a5fedfc3051f2bf13fe05157570ccb0989bc146aab54acf6bac33ee2f, native input 41ff9383d120476068d49c6b65b9a2ece0d11926b341765d5cdb8287d9b42c9c and interpreter 4d6f5f81a4bca11191c4c7c6b43632694d0a4ce74e068619d8fdc161d469859a. Both exited zero with no execution or Permit authority. No local paths or raw inventories are published here.

Exact structural equality across the two observations: all 3 package records, all 5 distribution records (1379 file rows: cffi 2.1.1/53, eccodes 2.47.0/68, numpy 1.26.4/1220, pycparser 3.0/21, refet 0.4.2/17), all 279 loaded Python-file rows (including module names), all 61 native-module rows (38 DLL, 22 PYD, 1 EXE), native API 2.47.0, both ecCodes data-path observations and empty .pth hook lists. Native enumeration reports zero unresolved entries. Only mode and search flags/path differ inside data: isolated removes the C6D provider directory from sys.path and disables user-site; no additional path appears. Windows case-insensitive deduplication gives 1545 unique observed file identities: 1520 in Python installation, 25 in Windows System32, 166072137 total bytes, zero missing digests or conflicting identities. The normalized observed inventory digest is 3abddcd173e122ab8779ac4e87a3bd70f82e05912f2b8df612d0369c3da795e9 (canonical JSON array sorted by root and relative_path, rows contain root PYTHON or WINDOWS, lowercase Windows-relative slash path, sha256 and size_bytes; object keys sorted, compact UTF-8). This is a historical observation digest, not a new signed Material or trusted runtime manifest.

Both ecCodes paths are /MEMFS/definitions and /MEMFS/samples, each explicitly VIRTUAL_OR_MISSING_NOT_PROVEN; eccodes_memfs.dll was actually loaded and hashed, but the observation did not exercise a GRIB sample or actual decode. It also does not enumerate all potential lazy stdlib/package/native imports or establish package supply-chain integrity. No Python reinstall or scientific formula change is indicated. Isolated import equivalence is observed, not full decoder equivalence.

Exact current GFS TS decoder blob 345e1faf6c873a8e434166df7f90b6cf1e22af29 launches configured executable with cwd process.cwd(); its Python entry blob beebf349630562a5de4c4c6b14ece216746c5b73 resolves CORE_PATH from Path.cwd(), not from __file__. KBS TS blob 4d5d14f82ba2cb5eb9f235d9b0393ee842901e89 launches its configured script; core blob d97c13907da782e411dbe993bb401af69869dd2c imports numpy/refet. Existing installed-material blob 992d68e0e283ed59eb7d9a635050759055cd885b binds tool executable and public search variables, not complete Python external root. Candidate next contract must bind the actual successor Release cwd, exact isolated interpreter/search policy and environment, external runtime tree and OS/native trust boundary; native decoder selftests and real local GRIB decode must validate the same launch path. Fold this into successor native Material verification, not an endless chain of C6D observation-only probes. The captured import snapshot by itself is not an allowlist for unknown lazy loads.

General backend noninterference remains unproved: same host/user or Docker administration may permit product code to change external runtime resources even when Git paths differ. The existing two presentation-only machine rules cannot justify arbitrary product backend merges. Under CTO stop condition, do not connect the candidate into active authority callers until resource/deployment noninterference is established or CTO chooses the already authorized planned merge-pause contingency. Preserve existing historical QCP results and 205-minute budget, do not declare full closure. No resource issue, signing, Permit, Host, merge or historical C6D modification performed.