# MCFT CAP-09 — Real Provider response-delay qualification admission boundary

Date: 2026-10-11. Scope: #3692 successor only, **DRAFT / UNMERGED / EXECUTE_HOLD**.

## Actual delay injection and scientific limits

The isolated V13 producer composer alone accepts an optional `fetch_impl`; the frozen production wrapper and 108 frozen Runtime paths are unchanged. In the **governed Producer child**, the transport delegate calls the genuine HTTPS Provider with exactly the original request and abort signal, receives the genuine `Response`, checks successful HTTP status, waits a bounded measured monotonic-clock delay **after the real response and before the canonical decoder consumes it**, then returns the original, unmodified response. Only the first real HTTP response per one of the three sequential Producer bases is delayed; the subsequent member requests are unchanged.

For each base, exclusive `wx` evidence records the target, real hostname, original HTTP status, response-time delay (requested/observed), immutable SHA256 of the request path rather than the URL, and proof the HTTP body was not read or rewritten by the injection. The producer requires one completed delay for **each of three real bases** and writes a separate immutable response-delay evidence aggregate. The controlled-delay stage verifies this proof and all three original Timing samples before any disposable scratch timing probes. The final aggregator verifies the same proof and records its SHA256 separately.

**Do not conflate the following:** an actual delayed HTTPS response returned into the real isolated Provider/capture path is more than the previous scratch-only test. It is **not** proof of delayed Provider server processing, six independent worst-case pipeline cases, cross-wake contention, promotion queue injection, or post-commit readback latency. Keep `controlled_delay_matrix_executed=false` and `full_six_case_pipeline_delay_qualified=false`. A0, Formal-v5, O00/O23 and Product production publication remain unapproved.

## Signed activation requirements

The new signed bundle `observed.real_provider_response_delay_plan` must have **only** the exact fields below:

- `schema_version: geox_mcft_cap09_real_provider_response_delay_v1`
- `mode: REAL_HTTPS_RESPONSE_BEFORE_CANONICAL_DECODER`
- `run_id`: exactly the fresh 12-hex ARM run (not historical `72dc0304a21a`)
- `subject_sha`: the current exact protected-main subject in ARM and permit
- `first_base`: the canonical next future UTC base in the ARM
- `response_delay_ms`: integer 25..15000
- `expected_distinct_bases: 3`

The signed Observations SHA256 and ARM SHA256 must be bound to a separately signed Ed25519 one-use independent-governance permit. The Producer stage timeout must allow at least `3 * response_delay_ms + 5000` ms and the complete six-stage budget must fit the signed observed deadline and safety margin. Fail closed if any field or digest is stale, the real response is non-2xx, a base is missing or duplicated, a response proof is changed, the actual Provider does not return, the aborted request terminates, or either output path pre-exists.

The previously required adopted flags `adopted`, `execution_enabled`, `real_delay_controller_adopted`, and `stage_capability_adopted` remain mandatory; **an additional independently reviewed** `real_provider_transport_delay_adopted=true` is needed at both parent and child gates. The repository trust registry is still `adopted=false`/`execution_enabled=false` with no trusted issuer, so none of these changes enables Execute.

Before activation, the independent reviewer and Windows operator must also verify: current protected-main merge/readback; 108 frozen Runtime paths; clean exact-head Windows checkout; retained first-attempt evidence and UNKNOWN first Provider call count; a new run, new positive/negative databases and new object bucket; schema/ACL and zero-row/zero-object readbacks including object versions/multipart; no production bindings; fresh actual Provider data visibility and sufficient deadline; independent retry adjudication replacing historical denial; a new signed ARM; source/plan/observations digests; and a one-use ledger nonce. No fixture that drops, truncates or cleans the retained qualification databases is allowed.

## Evidence versus authorization

Synthetic GitHub Windows/Ubuntu tests issue real loopback HTTP requests to prove that response bytes survive physical waiting and that altered/replayed evidence and illegal plans fail closed. They are **not** evidence that KBS/GFS accepted a live request on the Windows operator host. Real external Provider requests, PostgreSQL/S3 writes, six-stage live execution, independently adopted signatures and actual delayed capture/promote/readback observations have not occurred in this engineering successor.

**Current verdict:** `TRANSPORT_DELAY_SEAM_IMPLEMENTED_AND_NEGATIVE_TESTED / LIVE_PROVIDER_NOT_EXECUTED / AUTHORITY_UNADOPTED / EXECUTE_HOLD`.

## Actual isolated promotion and physical-readback delay successor

The separately signed `observed.real_pipeline_delay_plan` is required together with the existing real Provider response-delay plan. Its exact fields are `schema_version=geox_mcft_cap09_real_pipeline_delay_v1`, `mode=REAL_ISOLATED_PROMOTION_AND_PHYSICAL_READBACK`, `run_id`, `subject_sha`, `first_base`, `expected_distinct_bases=3`, `promotion_queue_delay_ms` and `post_commit_readback_delay_ms` (both integers 25–15000). Every field is bound into the existing independently signed Observations digest. The Producer stage timeout must cover all nine bounded waits plus a 10-second reserve; the combined six-stage deadline and permitted host window remain mandatory.

After each actual isolated capture and phase transition, the authorized Producer inserts an observed monotonic wait before invoking the unmodified fenced promotion primitive. After the primitive reports three physically committed facts, it waits again before invoking the unmodified controller-fenced physical-visibility attester. Six ordered, single-use, exclusive files bind base, phase, requested/observed waits and checked callback-return contracts; the final evidence is SHA-256 verified by both the Controlled Delay child and Aggregate child. Wrong phase, mismatched base, failure, tampering, missing events or duplicate invocation fail closed. No negative fixture drops, truncates, wipes or reuses historical stores.

**Scientific scope:** the separate isolated callbacks are wired to the real promotion and physical-readback methods when and only when a newly adopted Windows operator host calls them; GitHub tests substitute *test callbacks*, not Provider/Postgres/S3. Even successfully running three real captures with these two delays and the three genuine HTTPS-response delays does not prove all six modeled full-pipeline worst cases or authorize Formal-v5; `full_six_case_pipeline_delay_qualified` and `controlled_delay_matrix_executed` remain false without further adjudication.

A fifth adopted trust flag `real_pipeline_delay_adopted=true` is required on *both* parent and child. Current repository trust stays unadopted and disabled. The independent reviewer must separately adopt a new run, signed retry adjudication, run-scoped empty resources, current crop freshness, new hourly base/deadline, signed plan/observations/ARM, an independent Ed25519 issuer, and a one-use nonce; the Windows operator must perform actual host preflight and retain immutable Evidence. No signing key, host credential, production target or retroactive first-attempt assertion is published by this engineering proposal.
