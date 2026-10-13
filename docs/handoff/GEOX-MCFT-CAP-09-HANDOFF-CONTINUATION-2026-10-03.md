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
