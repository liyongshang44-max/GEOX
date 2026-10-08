# CAP-09 old ARM host retirement

This implements Amendment-22 P0A only. It does not authorize a successor ARM, A0, ACTIVE cutover, or a completion claim. No protected-main merge or host execution is implied by this document.

## Bound retirement

- Old arm identity: `sha256:8826cccdbb9aebd8c5e563119fdd3f52772f77cd9d12c718270655c3f03e940f`.
- Subject: `a60aa6858662ce87b989ff752c50969f21ad4619`.
- Epoch: `mcft_cap09_external_formal_window_epoch_20261010t060000000z_v5`.
- Host: `fae5f756-ef25-40d5-9777-5b2c3d4837a1`.
- Image: `sha256:9ff1b452cbb426f0a9bc70e2f38419fb8dd992cb2ff8ead8d090be8618da1288`.
- Formal database: `geox_mcft_cap09_s6_formal_t4r1_24h_v5`.

## Host collection

Run `RETIRE_MCFT_CAP09_ARM_HOST_V1.ps1` from a tools directory outside the clean subject checkout, alongside the three CJS retirement/guard/verification files. The tool loads only missing required credentials from the existing user/machine-bound SecureString CLIXML; it never prints credential values. It requires local Windows operator authorization.

Before retirement, the tool verifies the old ARM semantic digest, exact clean checkout and bound host; invokes the existing live H5 owner verifier and preserves its previous result; observes running containers and native Node launchers; and checks the exact 29-table Formal schema with every table empty inside a `REPEATABLE READ READ ONLY` transaction. Formal lease and forcing-controller tables are included. Container identities are checked again after the database snapshot, and the live proof must still be fresh. Partial effects or any observed Formal writer block retirement.

The receipt records database UTC, exact owner/container/image/fencing observations, the raw original ARM file digest, owner-proof digest, tool digests and zero database-write/service-stop counts. Audit copies and receipts are exclusively created, never overwritten. The original file bytes are preserved in the audit directory; the original execution pathname becomes a `RETIRED` marker with `formal_v5_arm=false`. The original inode is also moved to an `.original` audit file. Existing Evidence/Twin containers and their environment are never changed, stopped, rebuilt or restarted.

The canonical receipt is in `%USERPROFILE%\.geox\mcft-cap09\formal-v5\arm-retirements-v1\<identity hex>.json`; its audit directory is adjacent. Re-running verifies the saved bytes and repairs a missing execution marker after an interrupted publication. `ALREADY_RETIRED` replays the historical evidence; it is not a fresh runtime health check. If publication fails, keep all files and retry the same tool; do not restore the old ARM to the execution path.

## Startup enforcement

The independent V2 promotion, bootstrap and ACTIVE cutover entrypoints call the guard before Git fetch, SQL, object writes or service operations. The guard unconditionally rejects this source-pinned old identity and its subject/epoch tuple, including renamed archive copies. Deleting a host receipt cannot revive it. Any host receipt for another identity blocks that identity, even if malformed. A `NOT_RETIRED` result is not startup authorization; all existing authority, temporal, lease, schema and ACL gates still apply. Future Amendment-22 entrypoints must reuse the same guard before effects.

The updated entrypoints require the successor governance chain and protected-main qualification before production use. The host tool may run independently to execute the already authorized retirement while keeping the existing clean main checkout. The current old binary rejects the replacement marker via its existing ARM-schema checks; older binaries are not retroactively changed and must not be invoked with audit copies. New source guards enforce identity rejection even for those copies.

## Evidence limits

This is a local-host read-only observation plus explicit operator withdrawal, not a distributed lock or a new execution authority. It cannot prove absence of an unobserved launcher on another host or prevent arbitrary administrators restoring an old binary/file. Receipt hashes detect byte changes and bind the evidence bundle; they are not signatures or independently authenticated attestations. Subsequent startup still needs fresh live fencing and all successor admission proofs. Do not upload the CLIXML or credentials with the receipt.

## Verification

`node scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_ARM_RETIREMENT_V1.cjs --entrypoints` covers old-identity rejection, identity relabel rejection, malformed retirement markers, receipt tampering, schema/table effects, active writer markers, owner changes, stale proof, exact audit-byte preservation, idempotent publication and recovery after marker loss. The three real CJS V2 CLI entrypoints reject an archived old identity before external operations. Bootstrap's existing selftest remains passing.

Local validation: 33 acceptance cases PASS; bootstrap selftest PASS; `git diff --check` PASS. Full server typecheck could not complete in this workspace because installed dependencies omit `@fastify/cors`; no full typecheck PASS or real Windows-host retirement is claimed.

## 2026-10-08 host execution checkpoint

Operator-supplied tool output reports `RETIRED` and independent verification `PASS`. Receipt semantic digest: `sha256:fcd39ed82ad8d471a4348b52451d12547a5d4d8a51e39b156e69567a67032167`. Database UTC: `2026-10-08T12:50:30.327Z`. Original ARM bytes preserved; old identity rejected; database writes and service stops both zero; existing Evidence/Twin preserved. This records the received host result, not a reconstruction or remote verification of the complete receipt. Successor production admission must read and validate the original host receipt and archives.

Governance repair preserves AM21-frozen V1 launcher blobs exactly and adds separate V2 revocation wrappers. These wrappers forward non-retired inputs through all unchanged V1 gates; they do not remove the 36-hour policy or grant Amendment-22 production admission. A bounded retirement-only qualification rechecks unchanged R6/G12/G13 consumers and rejects any change outside its exact path set.
