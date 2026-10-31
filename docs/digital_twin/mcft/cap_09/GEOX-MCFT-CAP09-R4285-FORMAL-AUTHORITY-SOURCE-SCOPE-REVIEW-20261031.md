# MCFT CAP-09 / R4285 — Formal Permit Authority Source Scope Review

Status: **BOUNDED SOURCE REVIEW COMPLETE / FORMAL REGISTRATION SCOPE HOLD / NON-AUTHORIZING**  
CTO directive: 2026-10-31 — CORRECTIVE AUDIT ACCEPTED / BOUNDED IMPLEMENTATION APPROVED / EXECUTION HOLD.  
Repository: `liyongshang44-max/GEOX`  
Audited protected-main exact SHA: `43b7c467fe1eb55eb72359d0d15372feccf8f1cb`  
Evidence authority: frozen source bytes and existing formal policy only; this file is **not an adoption, registration, signature, Owner adjudication, Permit, or authority upgrade**.  
Run: `4285c3ce342c`; Host: `LAPTOP-STN2A2P1`.

## 1. Authority layering and exact source graph

The matrix below follows concrete caller → callee paths, accepted signature domains and consumption operations, **not just filename matches**. "Reachable" denotes a reachable code path given its specified parameters; it never asserts actual current authorization, a running Windows process or an unobserved host resource.

| Layer / generation | Concrete entry → authority call graph | Trust / authority provenance | Actual ledger effect | Reachability and qualification |
| --- | --- | --- | --- | --- |
| Historical Attempt-2 Permit V1 | `MCFT_CAP09_WINDOWS_LOCAL_QUALIFICATION_ENTRY_V1.ps1` → `MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs` → `MCFT_CAP09_RETRY_PERMIT_V1.cjs:loadHostPermit/verifyPermit` (and Host bundle validation); Host `execute` → `consumePermit` | Repository-owned fixed `MCFT_CAP09_RETRY_TRUST_V1.json`; domain `GEOX_MCFT_CAP09_ISOLATED_RETRY_PERMIT_V1`; V1 fixes `attempt_ordinal=2` and parent `72dc0304a21a` | Dual exclusive `ledger_root/nonce-*/CONSUMED.json` and `ledger_root/run-*/CONSUMED.json` | Historical entry and code-reachable conditional execution path; current static trust has `adopted=false`, `execution_enabled=false` and does **not** self-enable. V1 is not an R4285 issuer or consumer. |
| Historical Attempt-2 offline signing candidates | `scripts/cap09_adoption_v1/da9-retry-bundle.cjs` and `da9-retry-bundle-v2.cjs`, CLI `sign` → fixed historical V1 permit schema/domain → `crypto.sign` | Fixed repository Retry Trust and external private key; reviewed Adoption and fixed historical run/subject binding | **Signing creates a new output file, but does not consume ledger** | Command-reachable conditional signer, frozen Attempt-2 identity; not a general-purpose future Run signer; no R4285 authority. Both are distinct paths and must be inventoried, not mistaken for read-only acceptance. |
| Historical Attempt-3 Permit V2 | `MCFT_CAP09_ATTEMPT3_HOST_V2.cjs:preflight/execute` → `MCFT_CAP09_ATTEMPT3_PERMIT_V2_ATOMIC.cjs:prepare` → `MCFT_CAP09_ATTEMPT3_PERMIT_V2_READONLY.cjs:verifyReadOnly`; Host `execute` → `consumeForQualifiedHost` → stage capability V2 → six-stage scheduler | Registered Retry Trust issuer/public key; domain `GEOX_MCFT_CAP09_ISOLATED_RETRY_PERMIT_ATTEMPT3_V2`; V2 fixes `attempt_ordinal=3`, exact historical parent/run and signed Adoption/resource/full-chain conditions | Same configured `trust.ledger_root`, with distinct V2 consumption schema and atomic dual run/nonce reservation | Historically consumed once. Source exports a callable conditional `execute` primitive but no evidence permits reuse for `6ff9b41f6f7f` or R4285. |
| Historical Attempt-3 readback | `MCFT_CAP09_ATTEMPT3_REAL_LEDGER_READBACK_V1.cjs:verify` → read `run-*/CONSUMED.json`, matching `nonce-*/CONSUMED.json`, stage receipts and immutable artifacts | Inputs are bounded explicit ledger directory, run, subject; stage ticket public key checked independently | Read-only | Validates **that run's** consumption and stage integrity; neither enumerates every formal Permit source nor authorizes execution. |
| R4285 source gate | `MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs:review` → exact predecessor dual-ledger readback, immutable resources and original signed lineage/fullchain | Repository registered accountable-operator signer, existing Trust bytes and prior consumed proof | Read-only | Current exact-subject lineage capability; signed evidence is not R4285 adoption/permit. |
| R4285 Owner / current-subject Consumer | `MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V1.cjs:checkNativeAdoption` → `MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V1.cjs:verifyOwnerInventoryDecision` → signed owner envelope and caller-supplied Registry bytes | Repository Trust exact-byte check, live Github merged-head/QCP67/CI and installed-material checks. Existing registry schema `MCFT_CAP09_R4285_AUTHORITY_ROOT_REGISTRY_READBACK_V1` is **consumed, not produced** | Read-only | Windows CLI `--adoption-check-only`; MUST HOLD until Registry origin/completeness is independently established and Owner signs fixed bytes. |
| R4285 successor Host | `MCFT_CAP09_R4285_HOST_SIGNED_EVIDENCE_PREFLIGHT_V1.cjs:run` → `MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs:review` | Exact signed predecessor evidence; Host accepts only `--preflight-only --input` | No permit issuance, reservation, child dispatch or six-stage execution | Currently implemented **preflight-only** and always ends `HOLD_R4285_SUCCESSOR_HOST_ADOPTION_OWNER_PERMIT_LEDGER_AND_CHILD_CAPABILITY_NOT_IMPLEMENTED`. Future successor permit issuer, atomic ledger and child capability **not implemented**. |
| QCP immutable evidence | `PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs` → current `GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json` and 67-check QCP definitions | Historic qualification artifact digests and applicability policies | No Permit effect | This is **qualification evidence**, not formal Permit Authority Source registration. |
| Adoption signer registry | `scripts/cap09_adoption_v1/offline-trust.json`, `offline-context.cjs:verifySignature` | `purpose=ADOPTION`, immutable checks and allowed signer roles; `ledger_root` not present | No Permit effect | Separate purpose and authority; no implied completeness of formal Permit roots. |

### 1.1 Graph closure boundaries

Concrete V1 and V2 **consumer/writer edges**: `GOVERNED_RETRY_HOST_V1.run` → `retryPermit.consumePermit`; `ATTEMPT3_HOST_V2.execute` → `atomic.consumeForQualifiedHost`. Concrete V1 **signer edges**: `da9-retry-bundle[(-v2)].sign` → `crypto.sign` for the frozen Attempt-2 domain. R4285 Host cannot invoke these consumers; its file imports only the signed-evidence gate and rejects `--execute`.

**Known signer-origin gap:** the Attempt-3 V2 verification domain `GEOX_MCFT_CAP09_ISOLATED_RETRY_PERMIT_ATTEMPT3_V2` and schema `geox_mcft_cap09_signed_retry_permit_attempt3_v2` occur in the repository's read-only verifier/tests; an authenticated *real V2 signer-producer implementation and its installed-host origin* were **not established** by the reviewed repository call graph. The historical signed V2 Permit is not proof its producer is presently registered or that no additional off-repository signer exists. Treat issuer-producer attribution as **UNRESOLVED / HOLD**, not as a negative conclusion that the producer cannot exist. A real readback must bind the actual source or an independently adopted registration policy may classify it as a formally external actor.\n\nA repository code-search result alone cannot exclude dynamic loader paths, externally installed earlier releases, runtime aliases, additional host-side issuers or administrator-created directories. The accountable Windows runtime inventory and explicit source-root registration are separate required proofs. Neither static reachability nor a passing CI establishes that the host's authority source universe has been exhausted.

## 2. Existing registration and revocation authority actually established

1. **Retry Trust** `scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json` (Git blob `61d7949d49a2707aef5844e90440c4566584fbe7`) has one `ledger_root` value, host ID, operator ID, two exact Ed25519 issuer registrations, validity intervals and `revoked` flags; static defaults are `adopted=false`, `execution_enabled=false`. Permit V1 and Attempt-3 V2 consume its configured ledger root. The issuer-provisioning tool produces **off-repository candidate** key/registration files and refuses to change source Trust.
2. **Permit consumption** is one-shot and not a root-registration mechanism. Existing `CONSUMED.json` files retain original schemas and historical digests. Deleting, rewriting, restoring, or relocating them is not authorized reset.
3. **Adoption trust** `scripts/cap09_adoption_v1/offline-trust.json` restricts signers by purpose `ADOPTION`, contains no Permit Ledger Root and cannot supersede Retry Trust.
4. **Approved architecture direction** `GEOX-MCFT-CAP-09-ADR-ADOPTION-QUALIFICATION-LOCAL-EXECUTION-ADMISSION-V1.md` separates signer, verifier, Adoption, permit and Windows admission, but expressly leaves implementation/migration not adopted. `ACCOUNTABLE_SINGLE_OPERATOR` is eligible where expressly authorized; an independent *second human* is not a default requirement.
5. **Scope conclusion:** These sources prove a configured root for known V1/V2 writers and concrete key revocation flags. No effective source examined explicitly gives this Trust the **exclusive, exhaustive authority to register ALL CAP-09 formal Permit issuer/consumer roots**, specifies who may add/revoke *root sources* and how their governed registration is versioned, or establishes a nonforgeable complete-authority source enumeration. Absence of a discovered policy is not proof that no external policy exists. **`FORMAL_AUTHORITY_SCOPE=HOLD`**, not DEFINED.
6. GitHub branch changes to trust, user-supplied `authorized_by_owner:true`, or values of `adopted`/`execution_enabled` do **not** confer registration authority. Any root-set/issuer registration or revocation requires a distinct formally authorized policy action, exact content identity and independent verification. No such action is performed here.

## 3. Narrow additive scope instrument — candidate only; NOT effective

Before any native Registry Producer can emit `REGISTERED_SOURCE_COMPLETENESS=PASS`, the accountable governance principal must adopt a purpose-specific **supplement to the existing Retry Trust scope**, not create a parallel authority catalog. The minimum instrument shall state:

- Principal: identified `ACCOUNTABLE_SINGLE_OPERATOR` or expressly authorized successor; authority to add/remove/revoke CAP-09 formal Permit **source registrations**, with independently verifiable, purpose-separated signature. Registration approval is distinct from R4285 ordinal/Adoption/Permit decisions.
- Coverage: exact Permit entrypoints (V1 signer/consumer; V2 signer/verifier/consumer and host; any other proven production-reachable issuer/consumer), permitted version/signature domains, effective/deprecated generations and source CODE SHA / source file SHA-256 identities.
- Trust source: repository-owned file ref and exact SHA-256 of raw Trust bytes; signed effective scope version, identity and change-chain; not a user-provided arbitrary Trust JSON. Distinguish binding this repository version from a host-installed executable's exact bytes and runtime source provenance.
- Ledger roots: canonical Windows absolute paths, allowed generation/issuer associations, exact authorized root count, lifecycle (registration, additions, changes, revocation), effective interval and evidence of adoption; no assertion that a configured single root proves all other roots absent.
- Closed-world meaning: **all formally registered CAP-09 sources in the defined governance scope**, not every possible external mechanism on Windows. Unregistered, stale, revoked, unreadable, unrecognized, or ambiguous sources cause HOLD.
- Provenance: source-root registration cannot be self-attested by the same caller-supplied readback. Real Owner must approve the scope independently of all-zero counters and an arbitrary `authorized_by_owner` boolean. Bind signed scope digest and Trust raw-byte digest into Producer output and subsequent R4285 Owner decision.
- Change control: append-only registration/supersession evidence. No mutation of old Trust bytes, existing ledger history, QCP67 definitions, frozen acceptance artifacts or V1/V2 signed Permit payloads. Future generation must receive its own purpose-bound source/consumer mapping.

This instrument is **proposed policy text**, not a source registry, new authority, effective amendment, or request to sign per-test results. The existing Owner inventory/ordinal decision is still intended to be a **single** later signed fixed-digest decision after source completeness and readback.

## 3A. Narrow governance addendum: formal Permit acceptance namespace (proposed, not effective)

### 3A.1 Formal registrar and signer source of authority

- **Registrar:** the single `ACCOUNTABLE_SINGLE_OPERATOR` already identified by the repository-controlled `MCFT_CAP09_RETRY_TRUST_V1.json`, specifically `mcft_cap09_operator_mylr1`. This role may propose, formally approve and revoke registrations of **CAP-09 TEST_ONLY Permit acceptors, eligible Ed25519 issuer keys and registered consumption roots** through a purpose-scoped, attributable GitHub protected-main governance change or independently verified Ed25519 governance instrument. It is *not* a new key, independent second natural person, CI identity or separate Registry service.
- **Approval:** an attributed native approval by the authorized Owner for this **exact governance diff**, and its subsequent successful merge into protected main, are mandatory if the GitHub route is used. A comment or bot-generated green check is not authenticated policy adoption. The effective identity is the merged commit SHA, tree and this file's native Git blob and byte SHA-256, re-read from protected main. Any edit, supersession or revocation must go through a new explicitly approved, append-only protected-main successor. This document remains a **candidate** until that happens.
- **Existing trust:** only the repository-owned Retry Trust bytes at `scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json`, **Git blob `61d7949d49a2707aef5844e90440c4566584fbe7`**, **raw SHA-256 `dce2a16f6a82779873dfe25b30194f0445f23b894f5eb41c41a7274b1eb19cf7`**, are covered by this proposed V1 registration scope. The raw SHA-256 must be recomputed on the actual host; the configured file must be exactly the already-reviewed bytes. No `adopted=false` / `execution_enabled=false` change is permitted.
- **Issuer registration:** two keys are present under those exact bytes: Owner `mcft_cap09_operator_mylr1` (`ACCOUNTABLE_SINGLE_OPERATOR`, SPKI `223c806e89c4e6df5e91a089e0b22e5cef05934d42ee7df817faaeaa67553365`) and `mcft_cap09_independent_retry_governance` (`INDEPENDENT_RETRY_GOVERNANCE`, SPKI `ef7459a5918e35c90913532a7c8af545fbca4fec0b7dc95916797db3303fa870`). Either may sign only within the exact historical domain and effective signer restrictions of the particular Permit generation; listing a key is **not** issuing a valid Permit. Unknown/revoked/expired keys HOLD.
- **External signing implementation:** cryptographic issuer *identity* is the adopted key registration and purpose-separated Permit signature, **not the path of whatever off-repository program possesses the private key**. Thus the Attempt-3 V2 physical signing executable remains an unresolved **implementation-provenance** question, not automatic evidence of an additional issuer registration. If the registered scope requires executable provenance, fail closed until it is verified; it must never silently be invented.
- **Registrar changes:** addition/removal/revocation of keys, signer domains, consumer entrypoints or ledger roots is **not allowed through a caller-provided JSON field, output path, new private key or mutable runtime environment**. It requires an accountable-Owner approved policy successor binding exact old/new Trust and source bytes; revocation invalidates subsequent admission, never erases old ledger receipts.

### 3A.2 Exactly bounded consumption roots and entrypoint registrations

Candidate registered Ledger Root set (**one**, not yet formally effective):

```text
D:\gptdown\MCFT-CAP09-AUTHORITY-LEDGER
```

This root is configured in the exact Retry Trust listed above. Its discovery is a scoped contractual assertion **only after formal adoption**, not a statement that another arbitrary Windows directory could not exist.

- `PERMIT_V1`: `MCFT_CAP09_RETRY_PERMIT_V1.cjs` verification / consumption via `MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs` and `MCFT_CAP09_WINDOWS_LOCAL_QUALIFICATION_ENTRY_V1.ps1`. Signer codepaths `da9-retry-bundle.cjs` and `da9-retry-bundle-v2.cjs` exist only for fixed historical Attempt-2 identities. Accepted signature domain `GEOX_MCFT_CAP09_ISOLATED_RETRY_PERMIT_V1\\n`, consumed schema `geox_mcft_cap09_consumed_permit_v1`; **historical, not new R4285**.
- `PERMIT_ATTEMPT3_V2`: `MCFT_CAP09_ATTEMPT3_PERMIT_V2_READONLY.cjs` verification, `MCFT_CAP09_ATTEMPT3_PERMIT_V2_ATOMIC.cjs` atomic consumption, `MCFT_CAP09_ATTEMPT3_HOST_V2.cjs` official Host. Accepted domain `GEOX_MCFT_CAP09_ISOLATED_RETRY_PERMIT_ATTEMPT3_V2\\n`, consumed schema `geox_mcft_cap09_consumed_permit_attempt3_v2`; **historical consumed and not reusable**. External V2 signer-program provenance is unresolved; a valid signature from an existing registered key would prove the *issuer*, not the exact signer executable.
- `R4285`: `MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V1.cjs` and `MCFT_CAP09_R4285_HOST_SIGNED_EVIDENCE_PREFLIGHT_V1.cjs` are **read-only only**. No successor Permit signer, verifier for a new domain, atomic consumption, or child-capability issuer has been registered, implemented or admitted. This addendum **does not create** them.
- `QCP_EVIDENCE`: the 67-check central QCP Evidence Registry is not part of this Permit issuer/consumer root namespace; no qualification evidence is recast as execution authority.

Any formally registered CAP-09 Permit writer/consumer not in this source-versioned set, new root, altered signature domain, changed installed executable, or unknown host process claiming formal registration is an explicit **HOLD** requiring additive supersession. Neither the Host nor Producer may infer it is safe from absence of a filename hit. The registered set is limited to **this CAP-09 governance namespace** and does not claim universal visibility into all software on the Windows host.

### 3A.3 Exact effect and Producer sequencing

1. **CANDIDATE** now: repository source review alone has no right to close the formal-scope gate. The Owner must explicitly approve these registered authorities/roots as the exhaustive permitted **formal CAP-09 registration namespace**, with the affected source identities and Trust raw SHA-256, by a verifiable permitted governance action. A merge without applicable approved governance or a detached comment is not enough.
2. **DEFINED**, only after the authorized native approval, protected-main merge, exact content/subject/Trust binding and valid verification of registration change chain. Re-read the policy's native protected-main bytes and record its blob identity. All prior versions remain historical and cannot retroactively authorize Permit consumption.
3. **READBACK**, after DEFINED only: run the source-backed Windows **read-only** Producer against every registered source and root, cross-check source image and Host, gather actual twin run/nonce receipts and report all unknown/unreadable/extra/truncated/racy states as HOLD. An Owner-granted source scope does not fabricate host readback.
4. **OWNER ORDINAL**, only after native readback and full R4285 inventory closure: obtain exactly one `ACCOUNTABLE_SINGLE_OPERATOR` purpose-specific Ed25519 signed inventory+ordinal decision binding fixed bytes and explicitly `permit_authorized=false`. `4` stays a candidate before that signature. No extra person is needed solely because the signer and verifier are separate code paths.
5. **PERMIT / EXECUTE** remain HOLD/FORBIDDEN under this entire policy. No route, file or status in this addendum permits running original six stages.

### 3A.4 Governance acceptance negatives

Reject: unauthenticated approving identity; unmerged/draft/changed policy; Trust SHA-256 or Git blob mismatch; unregistered/revoked issuer; unexpected second Ledger Root; unidentified V1/V2 runtime acceptance writer; missing signed source scope; alternate subject/Host; changed source bytes; incomplete issuer/consumer inventory; truncated, unreadable or changing native readback; old consumed Run reuse; Owner-supplied `authorized_by_owner:true` without independent attestation; test fixture passed off as actual authority.

## 4. Windows native read-only Producer admission requirements (implementation deferred)

**Do not implement or run a Producer that can claim `PASS` until §3 is formally adopted or existing sufficient scope authority is produced.** At adoption, the smallest successor should reuse Retry Trust and original V1/V2 readback invariants. Exact mandatory controls:

1. Pin installed source exact Git HEAD, clean checkout, protected remote main, host and run; pin accepted registration-scope bytes/signature and trust raw SHA-256; reject all caller-selected trust/registration overrides.
2. Enumerate **every registered source and ledger root** from independently authorized scope, with exact count and source version; reject absent/unexpected issuer/consumer domain and any second root not registered.
3. Use bounded traversal with no symlinks/reparse points; reject unsupported filename/schema, unknown child, unreadable/partial/corrupt evidence, duplicate run/nonce, truncated listing, mixed-trust records, changed root identity and ambiguous registration.
4. Independently read actual `run-*/CONSUMED.json` and `nonce-*/CONSUMED.json` raw bytes; verify pair equivalence and source/generation binding, expected historic digests and immutable recorded failure; record read errors and unknown sources as non-PASS.
5. Use race-consistent snapshots or before/after full-index and identity checks; any read-during-change or inability to prove snapshot consistency → HOLD (TOCTOU).
6. Emit exact provenance and counts, negative details and hashes without private keys or environment values. Output must never self-generate Owner authorization or Permit/execute permission.
7. Negative acceptance before registration/adoption: missing known source, additional root, unreadable source, truncated scan, Trust tamper, revoked issuer, wrong source HEAD/Host/Run, changed files during scan. All HOLD. Synthetic fixture success cannot promote the real registry.
8. After true source readback, bind once to actual bounded inventory and **one** Owner Ed25519 ordinal decision. Do not use candidate ordinal=4 as an approved ordinal.

## 5. Explicit status and exit criteria

```text
FORMAL_AUTHORITY_SCOPE       = HOLD  # no effective ALL_FORMAL_PERMIT_SOURCES governance proof
REGISTERED_SOURCE_COMPLETENESS = HOLD  # source-backed Producer not authorized/implemented
LEDGER_READBACK              = HOLD  # bounded Attempt-2/3 bytes verified in prior evidence; new complete native readback not performed
R4285_INVENTORY              = HOLD  # PASS_BOUNDED is NOT global/registered-scope complete
R4285_ORDINAL                = HOLD  # 4 remains candidate only
OWNER_SIGNATURE              = HOLD  # no purpose-specific inventory+ordinal signed decision
R4285_PERMIT                 = HOLD
R4285_EXECUTE                = FORBIDDEN
```

Historical Attempt-3 consumption is immutable; the R4285 six original stages remain `0/6`. No new database/MinIO provisioning, rehydration, live Provider request, full-chain physical replay, Owner key operation, Permit issue/consumption, or source QCP67 mutation is licensed by this review.

## 6. Required evidence to lift the first HOLD

Either (a) identify and verify an already effective original governance instrument explicitly covering **all** formal CAP-09 Permit authority registrations and root revocation, including signature and currently effective scope, or (b) formally adopt the minimum §3 addendum with exact issuer/root versions and independent Owner authorization.

Only after one of these two facts is independently verified may the source-backed native read-only Producer be introduced, tested and submitted in the **same R4285 task line**, without creating a separate governance system.
