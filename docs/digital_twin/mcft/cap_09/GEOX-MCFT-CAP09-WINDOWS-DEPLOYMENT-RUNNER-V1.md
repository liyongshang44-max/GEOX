# MCFT CAP-09 Windows Deployment Runner V1

## Purpose

This runner converts the 2026-10-14 A44/Run 800c takeover lessons into one versioned, regression-tested Windows path.

It is deliberately narrower than an execution host. It prepares and verifies canonical release bytes, rejects stale ambient credentials/endpoints, verifies the dedicated Docker endpoint, can prove the four run-scoped PostgreSQL logins and their negative cross-database ACL, can digest the complete effective public table/sequence/routine ACL, and can verify a non-admin MinIO profile with positive read plus explicit out-of-scope denial.

It never starts Producer, Timing or controlled-delay stages. It performs no database mutation, no S3 PUT/DELETE, no container restart, no credential reset, and does not issue or consume a permit. A successful FullReadOnly result means only that the collected local-admission inputs are ready for a separate signed qualification/admission decision. It never sets execution_authorized or production_authorized true.

## Files

- scripts/runtime_acceptance/MCFT_CAP09_WINDOWS_DEPLOYMENT_RUNNER_V1.ps1
- scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP09_WINDOWS_DEPLOYMENT_RUNNER_V1.cjs
- docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-WINDOWS-DEPLOYMENT-RUNNER-800C-CONFIG-V1.json
- .github/workflows/mcft-cap09-windows-deployment-runner-v1.yml

The 800c config intentionally leaves the authoritative effective-ACL digests and MinIO restricted profile/prefix/negative bucket/policy digest unset. FullReadOnly must therefore fail closed until those independently reviewed values exist. Observing the current database or MinIO state is not allowed to self-authorize its own baseline.

## Modes

ReleaseOnly performs exact-subject release preparation only. It verifies the externally trusted manifest digest before parsing it. If an original archive is supplied, that archive is used. Otherwise the runner downloads the exact commit SHA archive; it never falls back to branch HEAD or mutable main. Only manifest-listed files are copied into a fresh payload directory, and every file is size/SHA-256 checked before and after the copy. This prevents Windows checkout CRLF conversion from becoming release material.

HostPreflight runs ReleaseOnly plus ambient credential rejection and Docker endpoint identity. It is the safe takeover mode when PostgreSQL restricted credentials or MinIO scoped identity are not ready.

FullReadOnly adds actual restricted PostgreSQL logins, explicit opposite-database permission-denied tests, exact effective ACL digest comparison, MinIO policy digest/read-only policy analysis, in-scope head/list and an explicit out-of-scope AccessDenied/Forbidden/403 probe.

## First use for Run 800c

Run the no-effect regression first:

    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\runtime_acceptance\MCFT_CAP09_WINDOWS_DEPLOYMENT_RUNNER_V1.ps1 -SelfTest

For release verification with the retained original archive and retained reviewed A44 manifest, run ReleaseOnly with the 800c config, -ReleaseArchivePath, -ReleaseManifestPath and -EvidenceRoot D:\gptdown. Host takeover preflight uses the same inputs with -Mode HostPreflight. The runner expects mcft-cap09-800c023cf337-pg-dedicated on 127.0.0.1:55434 and will not fall back to the old 55432 endpoint.

Before FullReadOnly, supply all independently established authority inputs:

1. Pin evidence and twin expected_acl_digest_sha256 values in the 800c config after reviewing the complete effective ACL matrix against the frozen schema/ACL authority.
2. Recover the exact new-run MinIO prefix, restricted named AWS profile, known existing out-of-scope denied bucket and reviewed non-secret IAM policy from original 800c provisioning. Do not infer these from the old 72dc container.
3. Point PGPASSFILE at the already-provisioned protected four-login credential file. PGPASSWORD and other ambient PG endpoint variables are rejected.
4. Pass -AwsProfile and -MinioPolicyPath. Raw AWS access keys, MinIO root variables and ambient AWS profiles are rejected.

Only then run FullReadOnly. Any failure writes a fresh RESULT.json with stage, code, root cause, remedy and regression guard. Existing output directories are never overwritten.

## Frozen ACL digest rule

The PostgreSQL ACL digest is generated under each actual low-privilege login from a deterministic V1 JSON readback containing role-safety booleans, expected privilege-role membership, database CONNECT, public schema USAGE/CREATE, every public table's effective SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER booleans, every public sequence's USAGE/SELECT/UPDATE booleans, and every public routine's EXECUTE boolean.

The expected digest must come from an independently reviewed authority baseline. The runner refuses to copy its own observation into the expected field. This closes the earlier gap where table-count observations could be mistaken for a frozen per-object contract.

## MinIO rule

Port 59000 and the running old 72dc MinIO container are transport observations only. They are not accepted as Run 800c resource identity.

The runner uses only AWS CLI head-bucket and list-objects-v2 for positive proof and head-bucket for a known existing out-of-scope negative probe. The policy file is non-secret evidence; its bytes are SHA-256 pinned, and any Allow for wildcard, S3 write/admin action, or resource outside the current run bucket is rejected. There is no mc admin path and no object mutation path.

## Authority boundary

A PASS from this runner is not an Adoption Qualification, not a signed Local Execution Admission, not TEST_ONLY execution permission and not production restoration. TEST_ONLY_HOLD and PRODUCTION_HOLD remain in force until the independent governance chain explicitly changes them.
