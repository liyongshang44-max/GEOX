# GEOX MCFT-CAP-09 Conversation Handoff — 2026-08-27 — Phase 2 Evidence Productization / KBS Raw Hourly Graph Frontier

Status: **CONVERSATION HANDOFF / CURRENT FRONTIER — NOT MASTER-TASK AUTHORITY**

Timestamp: **2026-08-27 01:41 +08:00**

Repository: `liyongshang44-max/GEOX`

Purpose: hand off the exact MCFT-CAP-09 engineering frontier after the Phase 2A production-Evidence extraction work in Draft PR #3299, including the completed governance/evidence work, the post-COMMIT visibility / EvidenceSupplyCursor boundary, the KBS Raw Hourly product-owned scientific core and TypeScript adapter, the current central-planner / EA5E2 graph blocker, the remaining GFS scientific-core debt, and the exact non-effects that must remain frozen.

> This document supersedes `docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-26.md` **for current conversation state only**.
>
> The 2026-08-26 handoff remains a historical record of CP-5 closure, Phase 1 closure, and the initial Phase 2 frontier.
>
> This handoff does **not** supersede `docs/SSOT.md`, the MCFT Master Task Line, any CAP Taskbook, accepted CAP-01→08 historical authority, immutable Formal-v4 NO-GO evidence, the qualification-control-plane authorities, or the frozen production-hosting architecture route.

---

## 0. READ THIS FIRST — mandatory authority order

Before changing MCFT-CAP-09 runtime, workflow, schema, database, provider, scheduler, Compose, production ownership, Formal, Graduation, or qualification-control-plane logic, reconstruct authority in this order:

1. repository-level SSOT / frozen repository authority;
2. MCFT Master Task Line / digital-twin total task book;
3. applicable CAP Taskbooks;
4. accepted CAP-01→08 predecessor evidence;
5. immutable Formal-v4 NO-GO authority;
6. frozen v13 successor subject;
7. qualification control-plane / CP-5 closure;
8. frozen production-hosting architecture route;
9. Production Hosting Phase 1 closure;
10. `docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-26.md` for the initial Phase 2 takeover state;
11. **this handoff** for the current Phase 2 implementation frontier;
12. current exact-head GitHub Actions evidence.

### 0.1 Mandatory frozen architecture document

Read in full before continuing Phase 2:

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md`

Frozen architecture commit:

`2f7a065cc95e4a5a2c95411fb381fe5e4479d645`

Hard architecture:

```text
External Providers
        ↓
Evidence Runtime / Live Evidence Plane
        ↓
governed database Evidence
        ↓
Twin Runtime Plane
        ↓
canonical Twin state / Forecast / Scenario / checkpoint
```

Evidence Runtime and Twin Runtime are separate production roles.

GitHub Actions remains CI / qualification / deployment / independent audit. It must not become the routine production provider clock, the Twin tick scheduler, or the production cadence owner.

### 0.2 Do not mix the numbering systems

Capability sequence:

```text
MCFT-CAP-01 → MCFT-CAP-09
```

Qualification-control-plane sequence:

```text
CP-0 → CP-5
```

Production-hosting migration sequence:

```text
Phase 0
Phase 0A
Phase 1
Phase 2
Phase 3
Phase 4
Phase 5
Phase 6
Phase 7
```

There is no frozen `CP-6`.

`Phase 6` in the production-hosting plan means production ownership cutover, not a qualification-control-plane phase.

---

## 1. Current task in one sentence

**Continue Production Hosting Phase 2 by making the KBS Raw Hourly Evidence path fully governed and qualification-equal-to-production, then productize the remaining GFS scientific core, while preserving post-COMMIT visibility / EvidenceSupplyCursor ordering and without starting Phase 3, a production Evidence Runtime host, Compose, Formal-v5, or production cadence ownership.**

---

## 2. Exact authority / branch / PR state at handoff time

### 2.1 Protected main

Protected `main` remains:

`26c1383f7f45abb76c99e28ec3d06714e85d1b2c`

No Phase 2 implementation work in this conversation has been merged into protected `main`.

Do not casually rebase Phase 2 onto a later main.

Any main movement must be treated as a new authority event, not as a harmless sync.

### 2.2 CP-5 predecessor

CP-5 closure predecessor remains:

PR #3291 exact head:

`14653ba622bb12261a1ea79f3ea7e42be0b49f92`

### 2.3 Production Hosting Phase 1 predecessor

Phase 1 implementation / qualification predecessor remains:

PR #3297 exact head:

`8943c752a354cb916cc7f144681203aa9a19f70b`

This is the exact base of the current Phase 2 implementation PR.

### 2.4 Current Phase 2 implementation PR

Draft PR:

**#3299 — `refactor(mcft-cap09): phase2a extract production Evidence provider seams`**

Branch:

`feat/mcft-cap09-phase2-evidence-production-modules-v1`

Base:

`feat/mcft-cap09-phase1-typed-runtime-composition-v1`

Exact base SHA:

`8943c752a354cb916cc7f144681203aa9a19f70b`

Current exact head at this handoff:

`b24c81097da101f5f17ba4d72b8761d54d53505e`

At verification time:

```text
state      = open
Draft      = true
merged     = false
mergeable  = true
commits    = 35
files      = 18
additions  = 2156
deletions  = 264
```

Do not merge #3299 merely because individual lanes are green.

Phase 2 is not closed.

### 2.5 Conversation handoff PR

The docs-only conversation handoff remains in:

PR #3298

Branch:

`docs/mcft-cap09-handoff-2026-08-26-phase2-evidence-module-frontier`

It is deliberately separate from #3299 so handoff edits do not perturb the implementation PR's controlled dependency graph.

The 2026-08-27 handoff is added to that docs-only branch.

---

## 3. Current phase map

```text
CP-5 exact-head closure                         PASS / HISTORICAL CLOSED
        ↓
Phase 1 typed Runtime composition               PASS / HISTORICAL CLOSED
        ↓
CAP08_FROZEN_REPLAY_EQUIVALENCE                 PASS / HISTORICAL CLOSED
        ↓
Phase 2 production Evidence productization      IN PROGRESS  ← CURRENT
        ↓
Phase 3 Evidence Runtime host                   BLOCKED ON PHASE 2
        ↓
Phase 4 Twin Runtime host                       BLOCKED
        ↓
Phase 5 two-service accelerated 24T             BLOCKED
        ↓
Phase 6 production ownership cutover            BLOCKED
        ↓
Phase 7 fresh Formal-v5                         FORBIDDEN / NOT ARMED
```

MCFT-CAP-09 remains:

```text
IN PROGRESS
NOT COMPLETE
NOT GRADUATED
FORMAL-V5 NOT ARMED
PRODUCTION OWNERSHIP NOT CUT OVER
```

---

## 4. Frozen Phase 2 boundary — what belongs here

Phase 2 is the production-module extraction / composition phase for the Evidence plane.

Allowed Phase 2 concerns include:

```text
provider acquisition
HTTPS transport
scientific decoding
raw-retention-first composition
canonical Evidence construction
governed Evidence ingress composition
post-COMMIT physical visibility proof
EvidenceSupplyCursor contract / ordering
qualification proving future production uses the same modules
machine governance of exact changed paths / dependencies
```

Phase 2 does **not** mean:

```text
production Evidence Runtime host
production cadence loop
durable Evidence Runtime ownership
production scheduler
lease/fencing owner
Compose service activation
durable EvidenceSupplyCursor database table
cursor migration
Formal-v5
Graduation
production Twin Runtime host
```

The most important boundary reconfirmed during this conversation is:

**Phase 2 requires the EvidenceSupplyCursor contract/composition and the ordering proof. Durable cursor persistence belongs to Phase 3.**

Therefore do not add a cursor table or migration now just because an `EvidenceSupplyCursorPortV1` exists.

---

## 5. What Phase 2 has materially completed so far

This section records only work that actually entered the current Phase 2 implementation lineage.

### 5.1 Formal HTTPS transport exists in product tree

Product module:

`apps/server/src/external_evidence/provider/https_external_evidence_transport_v1.ts`

This is the production Evidence transport seam used by the product provider modules.

The intent is to avoid a future architecture where qualification fetches one way and production fetches another way.

### 5.2 KBS variate-25 soil provider was extracted into product tree

Product module:

`apps/server/src/external_evidence/provider/kbs_variate25_soil_provider_v1.ts`

Historical `formal_live_kbs_soil_ingress_executor_v1.ts` was retained as compatibility composition while provider/decoder behavior moved toward formal product modules.

Historical EA5C2B1 authority was not rewritten.

### 5.3 Historical EA5C2B1 governance was preserved by successor routing

The old EA5C2B1 gate was a historical exact-base / exact-candidate gate.

It was not legal to simply edit that old gate to pretend the Phase 2 candidate was the historical candidate.

The correct repair was:

```text
historical gate stays historical
        +
Phase 2 successor requalification gate
        +
exact Phase 1 predecessor
```

Current successor governance gate:

`scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C2B1_PHASE2_SUCCESSOR_REQUALIFICATION_V1.cjs`

It requires exact Phase 1 base:

`8943c752a354cb916cc7f144681203aa9a19f70b`

It freezes historical authority dependencies and permits only explicitly declared sensitive deltas.

### 5.4 EA5E2 / AM19 governance history was repaired without rewriting history

During Phase 2 extraction, several dependency closures legitimately changed.

The work did **not** rewrite historical evidence.

Instead it used:

```text
successor requalification
rolling dependency graph rebind
durable requalification evidence
exact predecessor sets
```

A historical AM19 V3/V4 authority-symbol mismatch was discovered only after an older base guard stopped masking it.

The Phase 1 base already contained that mismatch.

It was therefore wrong to "fix" the historical runner as if Phase 2 had caused it.

The solution was a byte-locked generated compatibility subject:

`scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_AM19_PHASE2_AUTHORITY_SYMBOL_COMPATIBILITY_V1.ts`

That compatibility proof does not mutate the historical runner, does not activate persistent Formal execution, and does not convert a historical qualification inconsistency into a new runtime semantic change.

### 5.5 Central control-plane reached a historical all-green Phase 2 point

At exact head:

`11c44224cf95b102164c27d73190db30749d8fe2`

commit:

`gov(mcft-cap09): govern phase2 visibility and supply cursor modules`

the Phase 2 visibility/cursor paths were explicitly registered in the central control plane.

At that point, repository Actions evidence showed ordinary `ci` SUCCESS.

During the same stabilized lineage, central control-plane, EA5E2 graph, successor runner, and AM19 reached SUCCESS before the next KBS Raw Hourly adapter delta moved the governed dependency frontier again.

This is important:

**do not interpret the current red central/EA5E2 status as proof that those mechanisms are fundamentally broken. They were closed before the new KBS adapter became a new governed dependency.**

### 5.6 Post-COMMIT visibility entered product tree

Product Evidence-plane composition:

`apps/server/src/external_evidence/mcft_cap09_evidence_visibility_supply_cursor_v1.ts`

Product PostgreSQL read-only visibility adapter:

`apps/server/src/persistence/external_evidence/postgres_external_formal_evidence_visibility_v1.ts`

The frozen ordering is:

```text
governed ingress returns after COMMIT
        ↓
fresh PostgreSQL readback
        ↓
exact committed Evidence identity verification
        ↓
EvidenceSupplyCursor advance
```

The product composition is:

`PostCommitVisibleExternalFormalEvidenceIngressV1`

The PostgreSQL adapter performs a fresh read of `public.facts` by exact `fact_id` and verifies:

```text
record_type
source_record_id
source_record_hash
semantic hash
retention_ref
raw_sha256
raw_bytes
```

before cursor advancement is allowed.

There is no raw-object fallback in the visibility adapter.

### 5.7 EvidenceSupplyCursor is currently a contract / port, not durable state

The Phase 2 contract is:

`EvidenceSupplyCursorPortV1`

with:

`advanceAfterVisibleEvidence(...)`

This proves the supply-side ordering seam.

It does **not** create:

```text
cursor table
cursor migration
durable cursor repository
scheduler
lease/fencing
runtime host
production cadence owner
```

Those belong to Phase 3.

### 5.8 Visibility/cursor acceptance was repaired for Node 20 / tsx

Acceptance:

`scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE2_POST_COMMIT_VISIBILITY_CURSOR_V1.ts`

The initial version used:

`import.meta.dirname`

under the Node 20 / tsx execution path.

That caused startup failure before the actual acceptance semantics ran.

Commit:

`2e482bbbdc7abea4240391b0e334315d2ec8a1d0`

changed the root resolution to:

`path.resolve(process.cwd())`

The important lesson is that this was an acceptance bootstrapping defect, not an Evidence ordering defect.

After the repair, the post-COMMIT visibility / cursor-ordering proof executed.

### 5.9 KBS Raw Hourly scientific core is now product-owned

Product Python scientific core:

`apps/server/src/external_evidence/provider/python/mcft_cap09_kbs_raw_hourly_scientific_core_v1.py`

The current product core owns, among other things:

```text
KBS Raw Hourly CSV header discovery
provider UTC timestamp parsing
exact target-hour row selection
provider-latest diagnostic age
rainfall range checks
temperature / vapor / solar / wind checks
10 m → 2 m wind factor
W/m² → MJ/m²/h conversion
ASCE short hourly ET0 via refet
exact interval JSON result
```

The current core is no longer a wrapper around the old EA4 acceptance Python.

It imports product/runtime dependencies directly:

```text
numpy
refet
```

and does not import from `scripts/runtime_acceptance`.

That is a material improvement over the earlier Phase 2 frontier.

### 5.10 KBS Raw Hourly TypeScript product adapter exists

Product adapter:

`apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts`

It exports:

```text
KbsRawHourlyLiveTransportV1
KbsRawHourlyExactIntervalDecoderV1
```

Transport behavior reuses:

`HttpsExternalEvidenceTransportV1`

The scientific decoder invokes the product-owned Python core:

`apps/server/src/external_evidence/provider/python/mcft_cap09_kbs_raw_hourly_scientific_core_v1.py`

The TypeScript adapter does not own:

```text
raw retention
database writer
scheduler
lease/fencing
Twin state mutation
GitHub run identity
production cadence ownership
```

The product Python core is invoked as a scientific decoding process, not as an acceptance runner.

### 5.11 KBS Raw Hourly successor governance explicitly recognizes the product modules

Current Phase 2 successor gate explicitly names:

```text
apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts
apps/server/src/external_evidence/provider/python/mcft_cap09_kbs_raw_hourly_scientific_core_v1.py
```

and checks forbidden dependency markers.

The gate deliberately rejects product scientific code that contains direct qualification/runtime-control dependencies such as:

```text
scripts/runtime_acceptance
acceptance-output
MCFT_SUBJECT_SHA
GITHUB_
github.run
importlib.util
subprocess
os.environ
tempfile
urlopen
INSERT INTO
RuntimeTickCursor
twin_state
```

for the Python scientific core.

### 5.12 Strict lexical governance caught a comment-only false positive

The KBS TypeScript adapter originally contained the literal marker:

`RuntimeTickCursor`

inside a comment describing what the adapter does **not** own.

The strict successor gate is lexical and rejected that marker.

This was not an actual RuntimeTickCursor import or dependency.

The correct response was **not** to weaken the gate.

Commit:

`b24c81097da101f5f17ba4d72b8761d54d53505e`

changed only the comment wording:

`RuntimeTickCursor` → `runtime tick cursor`

and preserved the gate.

This exact pitfall must not be "fixed" later by broadening or disabling the forbidden-marker check.

---

## 6. Current exact-head status — `b24c8109…`

Current #3299 exact head:

`b24c81097da101f5f17ba4d72b8761d54d53505e`

### 6.1 Current green lanes

At this head, verified successful lanes include:

```text
EA5E2 successor runner qualification
AM19 persistent-24T static/successor qualification
EA5C2B1 live KBS soil successor qualification
release-lane / policy / ruleset related checks
candidate declaration checks
```

These successes mean the current problem should not be diagnosed as a generic runtime collapse.

### 6.2 Current central control-plane red

Current run:

`mcft-cap-09-qualification-control-plane-v1`

run:

`32995220687`

job:

`98262519972`

fails at:

`Prove generation, durable-anchor, and dependency-digest semantics`

The preceding steps pass:

```text
Checkout exact control-plane subject                     PASS
Require governed successor predecessor                  PASS
Prove central applicability semantics                   PASS
```

The failure occurs before immutable evidence resolution / exact PR blocker enumeration.

### 6.3 Current EA5E2 graph red happens before full graph qualification

Current run:

`mcft-cap-09-ea5e2-runtime-dependency-graph`

run:

`32995220862`

job:

`98262520479`

fails at:

`Generate central applicability plan`

The following graph steps are skipped:

```text
Route EA5E2 from central planner                    SKIPPED
Run full EA5E2 runtime dependency qualification     SKIPPED
Validate full EA5E2 qualification proof             SKIPPED
```

Therefore:

**there is no current generated expected graph digest from this head that is safe to bind yet.**

Do not edit the carrier digest speculatively.

### 6.4 Exact central-planner gap causing the current frontier

The current central authority defines:

`PHASE2_EVIDENCE_PROVIDER_MODULES`

as an exact path set.

It currently includes the KBS product Python core:

`apps/server/src/external_evidence/provider/python/mcft_cap09_kbs_raw_hourly_scientific_core_v1.py`

but it does **not** currently include the new TypeScript adapter:

`apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts`

This is the key current governance drift.

The adapter exists in the product tree and is recognized by the KBS successor gate, but the central Phase 2 resolver has not yet been advanced to own that exact path.

This is why the next step starts in central planning, not by changing the EA5E2 digest.

---

## 7. EA5E2 graph capability already supports the required fix

EA5E2 graph acceptance:

`scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4.cjs`

already has explicit sets:

```text
ENTRY
STATIC
MUST
```

and an import/discovery closure.

It is not necessary to introduce a directory wildcard to govern the KBS product modules.

The graph can explicitly add stable production dependencies.

For the KBS Raw Hourly path, the intended governance approach is:

```text
explicit exact product adapter path
+
explicit exact product Python scientific-core path
+
existing import/generated closure
```

not:

```text
apps/server/src/external_evidence/provider/**
```

as a semantic dependency declaration.

Workflow path triggers may remain broad where historically required, but the governed runtime dependency graph itself must remain explicit and reviewable.

---

## 8. What remains incomplete in the KBS Raw Hourly path

### 8.1 Central control-plane registration

Add the exact adapter path:

`apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts`

to the appropriate Phase 2 control-plane resolver / governed dependency set.

Do not solve this with an unknown-path exemption.

Do not solve it with a branch-name exemption.

### 8.2 EA5E2 production dependency graph registration

Once central planning recognizes the path, add the KBS adapter + scientific core to EA5E2 graph using the existing explicit STATIC/MUST mechanism as appropriate.

Do not change the rolling carrier digest before this governed path set is stable and the graph generator actually runs.

### 8.3 Focused qualification of the actual product adapter is still required

The repository now contains:

```text
KbsRawHourlyLiveTransportV1
KbsRawHourlyExactIntervalDecoderV1
```

but Phase 2 is not closed merely because those classes exist and the Python core selftest passes.

A focused qualification must actually instantiate:

`KbsRawHourlyLiveTransportV1`

and:

`KbsRawHourlyExactIntervalDecoderV1`

and prove that qualification is executing the same implementation intended for future production.

The test should prove at minimum:

```text
real product transport class is instantiated
real product decoder class is instantiated
decoder calls product-owned Python core
same exact-T semantics
same diagnostic freshness semantics
same ASCE ET0 method/version
no acceptance Python implementation used as scientific authority
no GitHub run identity required
no direct DB writer
no scheduler
no RuntimeTickCursor
no Twin state mutation
no production cadence activation
```

This focused qualification is the missing bridge between:

```text
"product module exists"
```

and:

```text
"qualification proves future production uses this module"
```

### 8.4 KBS current production-core caveat from earlier audit is resolved

Earlier in the Phase 2 conversation, an intermediate KBS product-core version still loaded EA4 qualification helpers.

That is no longer true at current head.

Do **not** carry that old blocker forward.

At `b24c8109…`, the KBS product Python core contains its own parsing / exact-T / ET0 implementation and the successor gate explicitly forbids `scripts/runtime_acceptance`.

The remaining KBS blocker is governance + focused product-adapter qualification, not acceptance-Python import removal.

---

## 9. GFS scientific core remains the larger Phase 2 debt

After KBS Raw Hourly closes, Phase 2 still is **not** complete.

GFS scientific/provider logic still needs the same productization treatment.

The remaining GFS scientific debt includes, at minimum:

```text
cycle selection
provider-cycle availability semantics
NOMADS / GFS acquisition semantics
GRIB / eccodes decoding
APCP accumulation differencing
solar integration / interval semantics
ASCE ET0 computation
quality / exact-source / exact-time handling
```

The frozen rule is:

**do not create one GFS algorithm for qualification and a different simplified GFS algorithm for production.**

The product module must become the implementation both use.

A valid Phase 2 GFS extraction should end with:

```text
qualification runner
        ↓
product GFS provider / scientific core
        ↓
same future production Evidence module
```

not:

```text
qualification-only Python
        +
new production rewrite
```

---

## 10. Phase 2 visibility / cursor closure semantics

The current Evidence-plane order is a hard contract:

```text
raw provider bytes
        ↓
durable raw retention
        ↓
decode retained bytes
        ↓
canonicalize Evidence
        ↓
governed DB ingress
        ↓
COMMIT
        ↓
fresh DB readback
        ↓
exact identity verification
        ↓
EvidenceSupplyCursor advance
```

Two ordering rules must not be weakened:

1. raw retention occurs before decode / canonical Evidence admission;
2. EvidenceSupplyCursor advances only after committed Evidence is physically visible and identity-matched.

If fresh readback returns:

```text
0 rows
>1 row
wrong source_record_hash
wrong semantic hash
wrong raw provenance
missing fact_id
```

cursor advancement must fail closed.

---

## 11. Phase 2 vs Phase 3 — do not cross this line

### Phase 2 owns

```text
EvidenceSupplyCursorPortV1
cursor advance request/result contract
ordering composition
post-COMMIT visibility
read-only visibility adapter
focused qualification
provider/scientific product modules
```

### Phase 3 owns

```text
durable Evidence Runtime host
durable cursor persistence
cursor table / migration if frozen design requires it
lease/fencing
restart/recovery ownership
provider cadence loop
runtime process lifecycle
production configuration / secrets binding
Compose service if authorized
```

Do not add Phase 3 artifacts to #3299 to make Phase 2 "look complete."

---

## 12. Exact non-effects that still hold

At current frontier, none of the Phase 2 work authorizes or performs:

```text
protected main mutation
production Evidence Runtime activation
production Twin Runtime activation
production provider cadence ownership
Runtime provider fallback
Formal-v5 arm
Formal database production mutation
Graduation
MCFT-CAP-09 completion
Phase 3 durable EvidenceSupplyCursor persistence
new cursor table
new cursor migration
production Compose service
```

Keep these explicit in every Phase 2 acceptance result and governance gate.

---

## 13. Failure / repair history that must be remembered

### 13.1 EA5E2 graph digest is not a magic constant

Earlier Phase 2 changes legitimately changed the governed graph.

A stale carrier digest caused failure.

The safe sequence is:

```text
finish exact governed path set
        ↓
central planner PASS
        ↓
run generated graph
        ↓
read generated expected digest
        ↓
only then rebind carrier
        ↓
rerun exact-head graph qualification
```

Do not guess the digest.

### 13.2 Distinguish inner frozen authority from rolling carrier binding

Do not see one digest mismatch and change every digest-like value.

Historical/frozen graph identity and rolling successor carrier identity may be different layers.

Changing the wrong layer rewrites history.

### 13.3 Unknown changed paths are supposed to fail closed

When central planning says a path is unknown, that is not CI noise.

It means the control plane has no machine-owned reason why the path is allowed to change.

The repair is:

```text
explicit resolver ownership
+
exact predecessor
+
qualified execution workflow
```

not:

```text
ignore unknown path
```

### 13.4 Do not use broad directory wildcards as governance semantics

The EA5E2 graph can name STATIC/MUST product dependencies explicitly.

Use that.

Avoid turning Phase 2 governance into:

`provider/**`

because it destroys the ability to tell which files are actually part of the qualified runtime graph.

### 13.5 Strict lexical gates can be triggered by comments

The `RuntimeTickCursor` comment incident proves this.

When a forbidden marker appears only in commentary:

- verify it is not a real dependency;
- keep the gate strict;
- remove/rephrase the misleading literal from the comment.

Do not weaken the gate just because a false positive is inconvenient.

### 13.6 Node 20 / tsx does not guarantee `import.meta.dirname`

The visibility acceptance failed before test execution because it relied on:

`import.meta.dirname`

The stable repo-root execution path used:

`path.resolve(process.cwd())`

For future acceptance scripts, do not introduce runtime-specific path assumptions without proving them in the repository's pinned Node/tsx environment.

### 13.7 Do not rewrite historical gates to accept new candidates

EA5C2B1 and AM19 both showed why this is dangerous.

Historical gate:

```text
historical subject
historical base
historical blobs
historical meaning
```

Successor change:

```text
new exact predecessor
new successor gate
new requalification evidence
```

Do not turn the historical gate into a moving allowlist.

### 13.8 Do not "fix" a pre-existing historical failure as a Phase 2 semantic change

The AM19 V3/V4 symbol mismatch existed in the Phase 1 base.

Phase 2 merely exposed it after a base guard was repaired.

The correct repair was a byte-frozen compatibility proof, not changing the historical runner.

### 13.9 Do not register durable requalification evidence too early

If a workflow or dependency path will still change, its digest can change again.

The safe sequence is:

```text
finish governing code
        ↓
exact-head successful run
        ↓
final dependency digest
        ↓
immutable evidence binding
        ↓
durable anchor
```

Registering evidence before the dependency graph stabilizes creates immediately stale evidence.

### 13.10 Separate independent red lanes

Do not assume:

```text
central red
EA5E2 red
AM19 red
KBS red
```

all have one cause.

Earlier in this conversation, several were independently classified:

```text
dependency graph requalification
historical base guard
historical V3/V4 compatibility
central evidence registry
```

Always inspect the exact failed step before editing code.

### 13.11 A green successor runner does not mean the graph is closed

At current `b24c8109…`:

successor runner is green while the EA5E2 graph workflow fails in central planning.

These are different proofs.

Do not infer graph closure from runner success.

### 13.12 A product class existing is not enough

For KBS Raw Hourly, the TypeScript adapter exists.

Phase 2 still requires focused qualification to instantiate it.

The architecture requirement is:

**qualification implementation == future production implementation**

not merely:

**qualification semantics approximately match product code.**

---

## 14. Current KBS Raw Hourly semantic facts to preserve

The current product scientific core preserves these important semantics:

### 14.1 Exact target-hour admission

The target must be canonical UTC hour.

There must be exactly one matching row at target T.

### 14.2 Provider availability vs historical freshness diagnostic

The old `<=6h` concept remains diagnostic.

It is not the late-authoritative admission gate.

Current product result explicitly carries:

`freshness_is_late_authoritative_admission_gate: false`

Do not regress to:

```text
authority_pass = age <= 6h
```

### 14.3 Plausibility / quality bounds

Current core validates finite and bounded:

```text
rainfall
air temperature
actual vapor pressure
solar radiation
wind
ET0
```

Do not silently remove these checks in a future "production rewrite."

### 14.4 ASCE hourly ET0 method

Current core uses `refet.Hourly` with:

`method="asce"`

and the product adapter records:

`method_version: "refet-0.4.2"`

Keep qualification and future production on the same method.

---

## 15. Current central-control-plane repair sequence

The immediate repair sequence should be:

### Step A — lock exact head

Before modifying anything:

```text
PR #3299 head
PR #3299 base
protected main
current workflow runs
```

If head moved from `b24c8109…`, rebuild evidence from the new exact head.

### Step B — register the missing KBS adapter path centrally

Add exact:

`apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts`

to the appropriate Phase 2 resolver / control-plane ownership.

Do not add an unknown-path escape hatch.

### Step C — rerun central plan before graph digest work

The expected signal is that the central planner gets past the current exact-path ownership problem.

Only after that should EA5E2 proceed to generated graph qualification.

### Step D — add KBS adapter + core to EA5E2 graph explicitly

Use existing STATIC/MUST facilities.

The exact choice between STATIC and MUST should reflect whether the dependency is required to be present in the qualified production path, not merely changed in the PR.

Do not use a directory wildcard.

### Step E — generate graph and inspect the actual expected digest

Only when the graph acceptance actually runs should the new expected digest be read.

If:

`carrier_dependency_graph_sha256 != expected_dependency_graph_sha256`

then perform one legal rolling carrier rebind.

Do not touch unrelated frozen graph authority.

### Step F — rerun exact-head graph + central + successor lanes

Minimum evidence:

```text
central control-plane PASS
unknown_changed_paths = 0
authority_errors = 0
resolver_errors = 0
EA5E2 graph PASS
successor runner PASS
AM19 PASS
KBS soil successor PASS
ordinary CI PASS
```

Do not declare closure from a subset.

---

## 16. Focused KBS product-adapter qualification design

The focused qualification should be bounded.

Recommended shape:

```text
fixture / retained raw bytes
        ↓
instantiate KbsRawHourlyLiveTransportV1
        ↓
instantiate KbsRawHourlyExactIntervalDecoderV1
        ↓
product-owned Python scientific core
        ↓
GovernedDecodedEvidenceDraftV1[]
```

The qualification should avoid creating a second scientific implementation.

### 16.1 Positive proof

Prove:

```text
correct request builder / endpoint
HTTPS final-host constraints
product transport identity
product decoder identity/version
product scientific core path
exact-T decode
rainfall Evidence draft
historical ET0 Evidence draft
diagnostic freshness flag remains non-authoritative
raw payload not embedded
no direct SQL
no Twin mutation
```

### 16.2 Negative proof

Prove fail-closed for at least:

```text
non-canonical target hour
missing exact target row
duplicate target row
invalid / nonfinite ET0 inputs
out-of-range rain
out-of-range air temperature
out-of-range vapor
out-of-range solar
out-of-range wind
scientific result target mismatch
provider locator mismatch
provider id mismatch
source family mismatch
```

### 16.3 Product/qualification identity proof

The qualification should assert it imports/instantiates the product TypeScript classes.

Do not duplicate their behavior inside the acceptance script.

---

## 17. GFS Phase 2 extraction plan after KBS

Do not start this until the KBS graph / focused qualification is stable.

### GFS step 1 — map actual qualification implementation

Inventory the exact current files/functions for:

```text
cycle selection
provider request
GRIB download
eccodes field extraction
APCP differencing
solar integration
temperature/dewpoint/wind transformation
ASCE ET0
quality semantics
```

### GFS step 2 — identify which logic is scientific core vs transport

Keep separate:

```text
transport / request / bytes
scientific decoding / transformation
Evidence canonicalization
```

### GFS step 3 — move scientific implementation to product-owned module

Do not rewrite from memory.

Move the qualified algorithm.

### GFS step 4 — route qualification through the product module

The old qualification runner may remain as orchestration, but its scientific decision must call the product implementation.

### GFS step 5 — graph/control-plane registration

Add exact product paths.

Generate digest after path set stabilizes.

### GFS step 6 — focused product proof

Prove:

```text
qualification uses product GFS core
same cycle selection
same APCP difference
same solar interval meaning
same ET0
same causal source-time semantics
```

---

## 18. Phase 2 completion definition

Do not say "Phase 2 complete" until all of the following are true at one exact head:

### Product modules

- [ ] KBS Raw Hourly TypeScript adapter governed.
- [ ] KBS Raw Hourly scientific core governed.
- [ ] focused KBS product-adapter qualification PASS.
- [ ] GFS transport/provider product seam complete.
- [ ] GFS scientific core product-owned.
- [ ] GFS qualification uses product implementation.
- [ ] no second GFS scientific algorithm exists only for production.
- [x] formal HTTPS transport product-owned.
- [x] KBS variate-25 soil provider product-owned.
- [x] raw retention adapter already product-owned.
- [x] canonicalizer already product-worthy.
- [x] governed ingress adapter already product-worthy.
- [x] post-COMMIT visibility product-owned.
- [x] EvidenceSupplyCursor contract/composition product-owned.

### Governance / graph

- [ ] all Phase 2 product paths explicitly owned by central control plane.
- [ ] unknown_changed_paths = 0.
- [ ] authority_errors = 0.
- [ ] resolver_errors = 0.
- [ ] EA5E2 generated graph contains the required product dependencies.
- [ ] carrier digest equals generated expected digest.
- [ ] no broad semantic wildcard introduced to hide dependencies.
- [ ] immutable/requalification evidence only reflects final dependency state.

### CI / qualification

- [ ] central control-plane PASS.
- [ ] EA5E2 graph PASS.
- [ ] successor runner PASS.
- [ ] AM19 PASS.
- [ ] KBS successor/live soil qualification PASS.
- [ ] ordinary CI PASS.
- [ ] focused KBS adapter proof PASS.
- [ ] focused GFS product proof PASS.

### Non-effects

- [ ] no protected main mutation.
- [ ] no production Evidence Runtime activation.
- [ ] no production Twin Runtime activation.
- [ ] no production cadence owner.
- [ ] no Runtime provider fallback.
- [ ] no durable Phase 3 cursor persistence.
- [ ] no Compose production service.
- [ ] no Formal-v5 arm.
- [ ] no Graduation.
- [ ] MCFT-CAP-09 still not marked complete until later frozen phases close.

Only after these hold may Phase 3 be opened.

---

## 19. First 30 minutes for the next engineer

### Minute 0–5 — restore authority

Read:

```text
docs/SSOT.md
MCFT master task line
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md
docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-26.md
docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-27.md
```

### Minute 5–10 — lock GitHub facts

Verify:

```text
main == 26c1383f7f45abb76c99e28ec3d06714e85d1b2c
#3299 base == 8943c752a354cb916cc7f144681203aa9a19f70b
#3299 head == expected current head
#3299 Draft == true
#3299 merged == false
```

If any SHA changed, do not reuse old CI conclusions blindly.

### Minute 10–15 — inspect current red steps

For central:

```text
which exact step failed?
did central applicability semantics pass?
did exact PR plan run?
unknown_changed_paths?
authority_errors?
resolver_errors?
```

For EA5E2:

```text
did failure occur at central plan?
did route step run?
did full graph generator run?
was a new expected digest actually emitted?
```

### Minute 15–20 — inspect exact Phase 2 resolver

Confirm whether:

`kbs_raw_hourly_live_provider_v1.ts`

is present in `PHASE2_EVIDENCE_PROVIDER_MODULES`.

At this handoff it is not.

### Minute 20–30 — make the smallest governance patch

Preferred first patch:

```text
central resolver exact-path registration
+
EA5E2 explicit STATIC/MUST product dependency registration
```

Then rerun before touching carrier digest.

---

## 20. Things not to do in the next conversation

Do not:

1. start again from old Draft PR #3295;
2. call Phase 1 incomplete;
3. start Phase 2 from protected main;
4. merge #3297 just to simplify the stack;
5. merge #3299 before Phase 2 closure;
6. change Formal-v5;
7. start production Evidence Runtime host;
8. add Compose production service;
9. add durable EvidenceSupplyCursor table in Phase 2;
10. add production scheduler / lease owner;
11. let Twin Runtime fetch provider/R2 fallback directly;
12. change graph digest before the graph generator runs;
13. use a directory wildcard to silence unknown paths;
14. weaken strict forbidden-marker gates because a comment tripped one;
15. rewrite historical EA5C2B1 or AM19 authority;
16. "fix" historical AM19 runner semantics as a Phase 2 change;
17. create a simplified GFS production algorithm that differs from qualification;
18. declare KBS closed before focused product-adapter qualification;
19. declare Phase 2 complete before GFS scientific core is product-owned;
20. interpret one green workflow as complete system qualification.

---

## 21. High-value exact file map

### Frozen route

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md`

### Central control plane

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json`

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json`

`scripts/governance_acceptance/PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs`

`.github/workflows/mcft-cap-09-qualification-control-plane-v1.yml`

### EA5E2 graph

`scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4.cjs`

`scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4_BINDING.cjs`

`.github/workflows/mcft-cap-09-ea5e2-runtime-dependency-graph.yml`

### Existing product Evidence core

`apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts`

`apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.ts`

`apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts`

### Visibility / supply cursor

`apps/server/src/external_evidence/mcft_cap09_evidence_visibility_supply_cursor_v1.ts`

`apps/server/src/persistence/external_evidence/postgres_external_formal_evidence_visibility_v1.ts`

`scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE2_POST_COMMIT_VISIBILITY_CURSOR_V1.ts`

### KBS product modules

`apps/server/src/external_evidence/provider/https_external_evidence_transport_v1.ts`

`apps/server/src/external_evidence/provider/kbs_variate25_soil_provider_v1.ts`

`apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts`

`apps/server/src/external_evidence/provider/python/mcft_cap09_kbs_raw_hourly_scientific_core_v1.py`

### KBS successor governance

`scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C2B1_PHASE2_SUCCESSOR_REQUALIFICATION_V1.cjs`

`.github/workflows/mcft-cap-09-ea5c2b1-live-kbs-soil-ingress-executor.yml`

### AM19 compatibility

`scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_AM19_PHASE2_AUTHORITY_SYMBOL_COMPATIBILITY_V1.ts`

`.github/workflows/mcft-cap-09-amendment19-persistent-24t-qualification.yml`

---

## 22. Exact known commits worth preserving in the mental model

### Initial Phase 2 implementation branch base

`8943c752a354cb916cc7f144681203aa9a19f70b`

Phase 1 closure / exact predecessor.

### Visibility/cursor control-plane registration

`11c44224cf95b102164c27d73190db30749d8fe2`

Message:

`gov(mcft-cap09): govern phase2 visibility and supply cursor modules`

### Node 20 / tsx acceptance root fix

`2e482bbbdc7abea4240391b0e334315d2ec8a1d0`

Message:

`fix(mcft-cap09): resolve phase2 visibility acceptance from repo root`

### Current comment-only strict-gate repair / handoff head

`b24c81097da101f5f17ba4d72b8761d54d53505e`

Message:

`fix(mcft-cap09): avoid false runtime-cursor marker in KBS provider`

---

## 23. Why the current problem is bounded

The current red state is not an unknown production failure.

Evidence:

```text
successor runner = SUCCESS
AM19 = SUCCESS
KBS soil successor = SUCCESS
central applicability semantics step = SUCCESS
EA5E2 full graph step = not reached
```

The new TypeScript adapter was introduced after a previously stabilized governance state.

The central Phase 2 exact path set has not yet been updated to own that adapter.

Therefore the next investigation should remain in:

```text
control-plane exact-path ownership
        ↓
EA5E2 explicit graph dependency
        ↓
generated digest
```

not jump to:

```text
provider semantics rewrite
database change
scheduler
Formal
```

---

## 24. Why Phase 2 must not be declared complete yet

Three independent reasons remain:

### Reason 1 — current exact head is not centrally qualified

Central / EA5E2 are red at `b24c8109…`.

### Reason 2 — KBS product adapter is not yet focused-qualified

The product classes exist but qualification has not yet fully demonstrated that it instantiates the exact future-production adapter/decoder pair.

### Reason 3 — GFS scientific core is still acceptance-era debt

Even a fully closed KBS path does not close Phase 2 while GFS scientific logic remains qualification-only.

---

## 25. Recommended next PR slicing inside #3299

Do not widen #3299 into Phase 3.

Preferred bounded slices:

### Slice A — KBS governance closure

```text
central exact-path registration
EA5E2 exact production dependency registration
generated digest / legal carrier rebind if required
```

### Slice B — KBS focused product qualification

```text
instantiate product transport
instantiate product decoder
product Python core
positive / negative proof
machine non-effects
```

### Slice C — GFS scientific-core extraction

```text
move existing qualified scientific semantics into product-owned core
qualification routes through product core
focused product proof
graph / central registration
```

### Slice D — Phase 2 exact-head closure

```text
central
EA5E2
successor
AM19
KBS
GFS focused proof
ordinary CI
non-effects
```

Only after Slice D:

open Phase 3.

---

## 26. Handoff bottom line

The project is no longer at:

```text
"Phase 2 has not started"
```

and it is also not at:

```text
"Phase 2 complete"
```

The precise current state is:

```text
Phase 2 product Evidence architecture materially exists
        +
post-COMMIT visibility / EvidenceSupplyCursor ordering is productized
        +
KBS Raw Hourly scientific core is product-owned
        +
KBS Raw Hourly TypeScript transport/decoder adapter exists
        +
historical successor governance has been preserved
        +
central/EA5E2 were previously green before the latest adapter delta
        ↓
current adapter is not yet fully registered in central/EA5E2 governed dependency sets
        +
focused qualification of the product adapter pair is still missing
        +
GFS scientific core remains to be productized
        ↓
Phase 2 remains IN PROGRESS
```

The immediate next action is **not** to change graph digest.

It is:

```text
register exact KBS adapter ownership in central control plane
        ↓
register exact KBS product dependencies in EA5E2 STATIC/MUST graph
        ↓
rerun central plan
        ↓
only after graph generation, read/rebind digest if needed
        ↓
focused-qualify KbsRawHourlyLiveTransportV1
+ KbsRawHourlyExactIntervalDecoderV1
        ↓
then productize GFS scientific core
```

Keep #3299 Draft.

Keep protected `main` untouched.

Keep Formal-v5 unarmed.

Keep Phase 3 closed until Phase 2 exact-head closure is machine-proved.
