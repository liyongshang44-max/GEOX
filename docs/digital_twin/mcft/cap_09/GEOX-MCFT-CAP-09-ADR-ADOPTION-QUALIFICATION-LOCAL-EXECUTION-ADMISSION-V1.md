# MCFT CAP-09 — Adoption Qualification and Local Execution Admission (V1)

Status: APPROVED ARCHITECTURAL DIRECTION; IMPLEMENTATION AND MIGRATION NOT ADOPTED

## Decision

The version-adoption proof boundary and execution-admission boundary are separate. GitHub may participate in reviewed adoption, but never in live local task scheduling or per-run admission. Windows execution is permitted only by an independently signed, immutable adoption qualification plus a separately issued single-use execution permit and an offline local admission decision. No existing execution HOLD is changed by this document.

## Responsibility and trust boundaries

1. **Adoption Qualification** (reviewed adoption): verify protected-main ancestry, immutable first-parent/historical assertion manifests, required acceptance checks, AM19, Phase5, frozen paths, dependency closure and digests, applicability and check coverage. A check-by-check status is mandatory (PASS / FAIL / NOT_APPLICABLE with reason and scope / BLOCKED). Absence or ambiguity of any REQUIRED check is BLOCKED. This stage may use Git and GitHub.
2. **Independent signer**: sign an immutable proof only after adoption verification is complete and authorized. ACCOUNTABLE_SINGLE_OPERATOR remains allowable, but signer and verifier are distinct authorities and code paths. The verifier cannot issue or modify proofs, permissions, or trust roots. Never sign an overall PASS over failed/unresolved checks.
3. **Local Execution Admission** (Windows, per run): offline and deterministic; verify approved signer signature, complete proof, exact subject and actual material contents, host/principal/database endpoint/bucket/ACL/environment and current policy, one-shot permit signature, subject, host, mode, run ID, stage, time bounds and durable non-replay consumption. No GitHub query, Git clone/fetch, historical replay or first-parent walk. Does not issue a permit.
4. **Execution**: a separate authorized launcher consumes the exact permit atomically and conveys bounded execution context to subprocesses. A passing adoption or admission result is not, by itself, authorization to run any real producer.

## ADOPTION_QUALIFICATION_V1 minimum signed payload

- qualification_id, schema_version, qualification_contract_version
- subject_commit_sha, subject_tree_digest, runtime_code_digest, dependency_lock_digest, dependency_manifest_digest
- historical_assertion_manifest_digest, frozen_boundary_digest, required_authority_schema_digest
- check_manifest: every required check_id, check_revision, policy, applicability, result, evidence_ref and evidence_digest; explicit blocked and not-applicable reasoning
- valid_for: explicit TEST_ONLY and/or PRODUCTION_CANDIDATE scopes; never implicit expansion
- issued_at, expires_at and material_invalidation_policy
- issuer_identity, signature_algorithm, signer_key_id, signature (canonical payload encoding)

Verifier trusts provisioned, independently managed public keys, not keys supplied as trusted by the candidate bundle itself. The proof is bound to precise material and a qualification policy version. A mutable pointer to latest/main is never the qualification identity.

## Material invalidation

Reject admission with QUALIFICATION_NOT_APPLICABLE upon material change in subject SHA, actual loaded runtime bytes, relevant dependency locks/content, qualification contract, frozen boundary, required authority schema or security-relevant execution configuration. Temporal expiry is separate. Unrelated main advancement, docs not in the signed scope, unrelated modules, host reboot or a newly issued permit do not independently invalidate adoption qualification. Host-related material mismatches still fail admission even if adoption remains valid.

## Unified machine states

- ADOPTION_INCOMPLETE / ADOPTION_QUALIFIED
- QUALIFICATION_INVALID / QUALIFICATION_NOT_APPLICABLE
- LOCAL_ADMISSION_FAIL / LOCAL_ADMISSION_PASS
- PERMIT_INVALID / PERMIT_REPLAY / PERMIT_CONSUMED
- EXECUTION_HOLD / EXECUTION_AUTHORIZED / EXECUTION_STARTED / EXECUTION_RECEIPT_RECORDED

Each transition records run_id, qualification_id, subject_sha, stage, status, reason_code, evidence_digest and elapsed_ms; no status implies another status without its own proof. Execution authorization requires its own explicit owner decision and valid consumed permit.

## Migration acceptance — minimal synthetic closure

A. Freeze legacy evidence with exact provenance, preserving partial PASS and outstanding blockers, including PR #3704 QCP failure. No synthetic PASS substitutes for missing legacy adoption proof.

B. Establish a check-by-check equivalence mapping (including AM19, Phase5, frozen path sets, historic first-parent assertions, unchanged applicable 52/65/108 contracts). Mapped assertions must remain independently auditable. Missing or uncertain equivalence prevents adoption issuance.

C. Complete full adoption qualification for an exact candidate; sign a tamper-evident artifact via independent signer authority. **Until all required checks pass or receive a justified, permitted NOT_APPLICABLE, no overall PASS certificate may be issued.**

D. Validate offline with synthetic subject and explicitly non-production test keys, plus exact digest and host configuration, then consume synthetic one-shot permit via a no-side-effect adapter. Test false SHA, file drift, lock digest drift, altered payload/signature, expired/invalidated qualification, wrong host, wrong principal, wrong DB endpoint/bucket/ACL, expired permit and replay. Every negative case must FAIL CLOSED.

E. Prove no remote access, GitHub/clone/fetch, historical replay, or nested QCP launch on the local admission path. Instrument latency separately for adoption, local admission, permit consumption and process start; verify finite budgets. Compare actual launcher/child boundary with authorized deployment configuration.

F. Only after independent review of equivalence and completed adoption may the new path be considered for real isolated TEST_ONLY authorization. PRODUCTION remains separately gated.

## Non-effects / current disposition

- PR #3704 remains Draft/Open/Unmerged until independent qualification and review. Existing evidence (historical inheritance PASS and synthetic regression PASS) is not equivalent to ALL_BLOCKERS PASS. The reported PHASE2_CURRENT_MAIN_EXACT_RUN_PROOF_INVALID remains an adoption blocker pending a grounded adjudication, not an admission check to waive.
- TEST_ONLY_EXECUTE_HOLD = true; PRODUCTION_HOLD = true.
- No merge, deployment, runtime or database schema mutation, credential issuance, trust-root change, execution permit or live task is authorized here.
