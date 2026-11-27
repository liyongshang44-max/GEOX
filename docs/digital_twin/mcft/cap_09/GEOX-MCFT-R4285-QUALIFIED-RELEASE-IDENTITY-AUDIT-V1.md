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
