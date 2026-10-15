# CAP-09 adoption / offline admission: synthetic candidate V1

Implements ADR migration step D and a bounded, synthetic portion of E. It does
**not** adopt the architecture or resolve #3704's old QCP blockers. All emitted
results retain `execution_authorized=false` and `production_authorized=false`.
The existing retry host, trust registry and historical validators are unchanged.

## Run the complete proof-package acceptance

Node 20.11.1 or newer; no package installation, Git operation, database or network:

```powershell
node scripts/cap09_adoption_v1/acceptance.cjs --bundle C:\path\to\NEW-synthetic-proof-bundle
if ($LASTEXITCODE -ne 0) { throw 'Synthetic acceptance failed; preserve output' }
```

The output directory must not exist. This creates only synthetic public proof,
permit, policy, materials, check evidence, source hashes and one-use receipts.
Temporary signing keys stay in memory for the retained bundle; CLI signing tests
use disposable private files outside that bundle and remove only their own temp
fixture directory. No existing host resource or credential is used. The package's
permit is consumed by the acceptance test and must not be reused. Its material
and ledger paths are host-specific; copying the bundle does not make a new permit.

`acceptance.cjs` without arguments runs the same suite and removes its own
synthetic temporary directory. CI runs this command with a retained bundle on
Windows Server 2022 and Ubuntu and uploads the public result as an artifact.

## Four separated components

- `contract.cjs`: canonical JSON, SHA-256 material inventories, check manifest,
  Ed25519 verification, exclusive output writing. No signing operation.
- `signer.cjs`: separate qualification and permit signing entry points. Requires
  an explicit private-key file and separately supplied policy. Checks evidence
  bytes and required check dispositions before signing a qualification. A FAIL,
  BLOCKED, missing or unapproved NOT_APPLICABLE check prevents issuance.
- `verifier.cjs`: read-only admission; no signer import, private key, network,
  child process or Git. Verifies proof and permit purposes, pinned subject,
  all seven material inventories, current policy, evidence bytes, configuration,
  host/operator, stage, time window and resource observation freshness.
- `synthetic-launcher.cjs`: verifies admission and consumes nonce and run
  reservations before the compiled-in no-effect adapter. No arbitrary command,
  callback, Producer or actual six-stage process execution exists on this path.

CLI layouts (request files contain the fields constructed by acceptance):

```text
node signer.cjs qualification request.json trusted-policy.json private.pem proof.json
node signer.cjs permit request.json trusted-policy.json private.pem permit.json
node verifier.cjs request.json trusted-policy.json
node synthetic-launcher.cjs request.json trusted-policy.json
```

These are synthetic developer interfaces. They accept only `SYNTHETIC_ONLY`,
`NO_EFFECT`, and explicitly registered test keys. There is deliberately no switch
that enables TEST_ONLY or production. The verifier cannot create a proof, permit
or trust root. `ACCOUNTABLE_SINGLE_OPERATOR` permits the same named operator in
separate signing and verifying workflows; it does not require another person.

## Trust and material limits

The synthetic policy is supplied separately from the candidate proof, keyed by
signer purpose, pinned subject SHA, key fingerprint/lifetime, revocation epoch
and expiry. Unknown bundle public keys cannot become trust roots. This demonstrates
the separation but does not provision a real OS-protected trust store. A host
owner able to replace both program and policy is outside this synthetic boundary.

Inventories hash actual files in seven explicitly scoped material directories,
including additions and deletions; links and hard-linked files are rejected.
The synthetic subject SHA and check results are fixtures, not a claim that the
GEOX source at that SHA passed adoption. Mapping a real immutable release package
and loaded dependency closure into those directories remains an adoption task.
No complete repository clone or historical first-parent walk runs in admission.
Only the package's scoped material and compact evidence bytes are hashed.

Host identity, ACL/environment digests and resource observations in the synthetic
request are fixture data, cryptographically bound to the permit. A real trusted
Windows collector/launcher must obtain these from the actual host, enforce the
fixed policy/ledger paths and bind the bytes actually loaded before real use.
This candidate does not claim an anti-TOCTOU or host-attestation solution.

Qualification lifetime is bounded to 24 hours, permit and observation freshness
to at most five minutes; test policy uses shorter windows. Offline revocation
requires a provisioned new epoch/policy or expiry; no immediate remote revocation
is claimed. Policy changes invalidate old proofs in this conservative V1.

Nonce and run `mkdir` reservations serialize competing processes; receipt files
use exclusive creation and fsync. Partial failure burns the attempt; no rollback
or retry. This proves process concurrency/crash fail-closed behavior, **not**
Windows power-loss durability, ACL tamper resistance or durable-storage rollback
protection. Those require host storage validation before real adoption.

## Acceptance and remaining adoption work

The suite exercises signatures, missing/failed/blocked checks, scope separation,
seven-category drift, keys, config/ACL, expiry, replay, duplicate run with a new
nonce, partial reservation, directory links and four competing processes. A
preloaded denial harness blocks network and subprocess imports, signing and
filesystem writes while the standalone verifier succeeds. The suite has a
60-second total bound and each subprocess a 10-second bound. Admission,
consumption and no-effect adapter timings plus concurrent-process wall time are
recorded; actual six-stage scheduling budgets remain outside this milestone.

`GEOX-MCFT-CAP09-ADOPTION-MIGRATION-INVENTORY-V1.json` preserves exact source
provenance and outstanding blockers. It is an explicitly incomplete source
inventory, not an equivalence certificate. AM19, Phase5, 52/65 checks, 108 frozen
paths and historical assertions still require complete, reviewed check-by-check
mapping and original evidence before a real adoption qualification can be issued.
No synthetic manifest may substitute for those results.
