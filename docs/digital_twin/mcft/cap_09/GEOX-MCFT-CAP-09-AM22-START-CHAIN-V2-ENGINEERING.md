# Amendment-22 V2 startup orchestration — engineering candidate

This successor adds an executable local chain, but does not enable the checked-in production policy. It must not be represented as production-qualified or host-executed. All frozen V1 Runtime, schema/ACL, provider, scheduler, bootstrap and promotion source files remain unchanged.

## Executable ports

`RUN_MCFT_CAP_09_AM22_CUTOVER_ARM_A0_V2.cjs --prepare` calls the new V2 production owner cutover, the new ARM issuer, and the existing schema/ACL materializer. Every effect requires effective protected-main policy and exact current clean main/image admission first. The Compose overlay changes only the Evidence command and adds a read-only signed execution qualification mount. Existing project/service/lease identities remain intact. Failed cutover never automatically invokes Compose down.

The V2 ARM issuer requires the recorded host retirement, preserved original bytes, a independently qualified complete preparation envelope, effective crop authority covering A0 through O23, existing fresh H5 with T1/T2 live lease/container/image renewal, Phase6 retired-trigger audit, exact 29-table/2-routine whole-store pristine readback and same-UTC-hour cutover. It emits the existing Runtime ARM DTO with explicit `arm_issuer=AM22_V2`; it never claims legacy 36-hour qualification.

`--a0 --run-directory=...` revalidates exact main, fixed ARM identity, retirement evidence, signed execution qualification, complete preparation envelope, stage bytes and coverage, and live owners before calling existing revocation-aware promotion and bootstrap entries. The bootstrap still calls the frozen PostgreSQL persistence service, with its original CAS/idempotency/fencing checks. A0 output is explicitly `A0_BOOTSTRAPPED_NOT_ACTIVE`: existing G11 ACTIVE cutover is still a separate required operation before O00. Neither this output nor O23 authorizes G13 completion adjudication.

An operation writes an immutable STARTED marker before effects and an immutable PASS receipt only after success. A failed or previous operation cannot automatically rerun. Recovery requires independent readback and reconciliation; deleting a marker does not undo database effects or establish authorization. Secrets never belong in run inputs or receipts.

## Qualification identity and measurement

Pinning final main SHA, its image ID and host-generated measurement digest back into the same checked-in policy creates an identity cycle. The proposed solution is a detached Ed25519 execution qualification signed by an independently authorized operator key whose public key and trust rule must first be adopted in protected main. No public key, effective rule or production flag is activated by this PR. A caller-supplied certificate or public key is insufficient. The signed certificate binds existing exact main, host, immutable image, independent complete preparation envelope and effective stage bytes, and cannot override root production/completion flags.

The user's actual image-build measurement on main `648c1499f23c9c5d11483b0b797c8700e398349d` was 261120 ms, with image `sha256:306c2c3004e4cb084598394a1b7e8aca753ae1ba0a8692cd4aba429f67314a9e` and unchanged owner containers. It is only image-build evidence, not complete preparation qualification; this successor also changes image contents, so the old image cannot execute these new ports.

Preparation receipts measure actual cutover/ARM/schema command durations under the independently enforced complete timeout. Their scope is deliberately `CUTOVER_ARM_SCHEMA_ONLY_NOT_COMPLETE_PRE_A0_QUALIFICATION`. They do not close the six-phase real-host preparation workload, fresh causal seed readiness, or independent measurement adjudication. No synthetic unit timing is eligible for production.

## Validation and pending gates

The focused CJS acceptance covers V1 handoff rejection, fresh H5, pristine store, same-hour fencing, immutable identity, signed certificate tampering/expiry/wrong key, root authority ceilings, fixed command routing, inactive effect rejection and partial-operation rejection. The isolated PostgreSQL acceptance uses the new ARM data-construction port and existing Runtime A0/O00 services, with controlled H5/handoff/forcing inputs. It does not perform Docker owner cutover, provider acquisition, real-host qualification or a real 24T run.

Before execution: finish central exact-path/QCP/R6/G11/G12/G13 successor qualification, independently adjudicate the detached execution-key contract, obtain actual complete preparation trace and causal seed readiness, adopt real full-24T fresh crop authority, freeze exact main/image, then independently authorize host execution. Do not extend the current 30-hour stage validity or fabricate a future daily snapshot. Post-A0 ACTIVE activation, real O00–O23, G12 readback/watchdog, G13 adjudication and continuous post-O23 production remain mandatory downstream work.
