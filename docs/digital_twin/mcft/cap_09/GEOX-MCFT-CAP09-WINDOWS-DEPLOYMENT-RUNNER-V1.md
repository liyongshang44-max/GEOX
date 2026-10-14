# MCFT CAP-09 Windows Deployment Runner V1

## Purpose

This runner converts the 2026-10-14 A44/Run 800c takeover lessons into one versioned, regression-tested Windows path.

It is deliberately narrower than an execution host. It prepares and verifies canonical release bytes, rejects stale ambient credentials/endpoints, verifies the dedicated Docker endpoint, can prove the four run-scoped PostgreSQL logins and their negative cross-database ACL, can digest the complete effective public table/sequence/routine ACL, and can verify a non-admin MinIO profile with positive read plus explicit out-of-scope denial.

It never starts Producer, Timing or controlled-delay stages. It performs no database mutation, no S3 PUT/DELETE, no container restart, no credential reset, and does not issue or consume a permit. The reviewed 800c application policy may contain target-bucket write/delete permissions needed by later execution; the runner validates those permissions as policy evidence but never exercises them. A successful FullReadOnly result means only that the collected local-admission inputs are ready for a separate signed qualification/admission decision. It never sets execution_authorized or production_authorized true.

## Files

- scripts/runtime_acceptance/MCFT_CAP09_WINDOWS_DEPLOYMENT_RUNNER_V1.ps1
- scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP09_WINDOWS_DEPLOYMENT_RUNNER_V1.cjs
- docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-WINDOWS-DEPLOYMENT-RUNNER-800C-CONFIG-V1.json
- .github/workflows/mcft-cap09-windows-deployment-runner-v1.yml

The 800c config intentionally leaves the authoritative PostgreSQL effective-ACL digests unset, so FullReadOnly must still fail closed until those independently reviewed values exist. The MinIO side is now pinned to the reviewed shared-service container ID, target bucket, prior-Run negative bucket and non-secret policy digest/action set. The private credential JSON is never stored in GitHub and must be supplied at runtime. Observing current state is not allowed to self-authorize its own PostgreSQL baseline.

## Modes

ReleaseOnly performs exact-subject release preparation only. It verifies the externally trusted manifest digest before parsing it. If an original archive is supplied, that archive is used. Otherwise the runner downloads the exact commit SHA archive; it never falls back to branch HEAD or mutable main. Only manifest-listed files are copied into a fresh payload directory, and every file is size/SHA-256 checked before and after the copy. This prevents Windows checkout CRLF conversion from becoming release material.

HostPreflight runs ReleaseOnly plus ambient credential rejection and Docker endpoint identity. It is the safe takeover mode when PostgreSQL restricted credentials or MinIO scoped identity are not ready.

FullReadOnly adds actual restricted PostgreSQL logins, explicit opposite-database permission-denied tests, exact effective ACL digest comparison, MinIO policy-digest/scoped-action analysis, target ListObjectsV2, prior-Run explicit AccessDenied and bounded ListBuckets response-scope adjudication. The runner suppresses out-of-scope bucket names from evidence and records counts only.

## First use for Run 800c

Run the no-effect regression first:

    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\runtime_acceptance\MCFT_CAP09_WINDOWS_DEPLOYMENT_RUNNER_V1.ps1 -SelfTest

For release verification with the retained original archive and retained reviewed A44 manifest, run ReleaseOnly with the 800c config, -ReleaseArchivePath, -ReleaseManifestPath and -EvidenceRoot D:\gptdown. Host takeover preflight uses the same inputs with -Mode HostPreflight. The runner expects mcft-cap09-800c023cf337-pg-dedicated on 127.0.0.1:55434 and will not fall back to the old 55432 endpoint.

Before FullReadOnly, supply all independently established authority inputs:

1. Pin evidence and twin expected_acl_digest_sha256 values in the 800c config after reviewing the complete effective ACL matrix against the frozen schema/ACL authority.
2. Use the existing protected 800c private credential JSON only through `-MinioCredentialJsonPath`; do not create an AWS profile, print the JSON, commit it, upload it, or export its secrets into the parent PowerShell environment. The runner injects credentials only into each bounded `aws` child process.
3. Supply the reviewed non-secret `minio-policy.json` with `-MinioPolicyPath`. Its SHA-256 and exact target-bucket action set are config-pinned; `s3:ListAllMyBuckets`, wildcard actions/resources and out-of-bucket resources are rejected. The policy may contain reviewed Put/Delete actions, but this runner has no S3 write call.
4. Point PGPASSFILE at the already-provisioned protected four-login credential file. PGPASSWORD and other ambient PG endpoint variables are rejected.

Only then run FullReadOnly. Any failure writes a fresh RESULT.json with stage, code, root cause, remedy and regression guard. Existing output directories are never overwritten.

## Frozen ACL digest rule

The PostgreSQL ACL digest is generated under each actual low-privilege login from a deterministic V1 JSON readback containing role-safety booleans, expected privilege-role membership, database CONNECT, public schema USAGE/CREATE, every public table's effective SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER booleans, every public sequence's USAGE/SELECT/UPDATE booleans, and every public routine's EXECUTE boolean.

The expected digest must come from an independently reviewed authority baseline. The runner refuses to copy its own observation into the expected field. This closes the earlier gap where table-count observations could be mistaken for a frozen per-object contract.

## MinIO rule

Port 59000 and the running old 72dc MinIO container are transport observations only. They are not accepted as Run 800c resource identity.

The runner launches native tools through `System.Diagnostics.ProcessStartInfo` with redirected stdout/stderr and bounded timeout, so an expected nonzero S3 denial cannot become a terminating Windows PowerShell `NativeCommandError`. It does not require an AWS profile: the existing private credential JSON is parsed in memory and its values are injected only into the `aws` child process environment. Positive proof is target `ListObjectsV2`; negative proof is the known prior-Run bucket `ListObjectsV2` and must be explicit AccessDenied/Forbidden/403. `ListBuckets` is separately adjudicated: explicit denial passes, or a successful response passes only when parsed names contain no prior-Run or other out-of-scope bucket; shared evidence records counts, not unexpected names. The non-secret policy bytes are SHA-256 pinned and exact scoped Allow actions/resources are checked. There is no mc admin path and no object mutation path.

## Authority boundary

A PASS from this runner is not an Adoption Qualification, not a signed Local Execution Admission, not TEST_ONLY execution permission and not production restoration. TEST_ONLY_HOLD and PRODUCTION_HOLD remain in force until the independent governance chain explicitly changes them.
