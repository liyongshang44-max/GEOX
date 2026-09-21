# GEOX Whole-Repository Authority + Runtime Reachability Audit V2

## Status

Status: **governance-method candidate / audit not yet executed / no product semantic change**

Baseline protected main:

    0c71e55843c659cce402a1457d481e412cdc203c

This method does not rewrite historical audit evidence. It extends the existing whole-repository residual-authority method with capability-level runtime reachability, producer-consumer semantic compatibility, and qualification-production equivalence.

Predecessor mechanisms reused: B-Line Residual Authority Audit V1, B-Line Production Caller Authority Inventory, MCFT-CAP-09 EA5E2 Runtime Dependency Graph, MCFT Vertical Capability Line Matrix, and existing exact-head/successor/post-merge qualification gates.

## 1. Mission

The audit must answer both questions:

    A. Does any authority-capable or mutating surface exist outside the inventory?
    B. For every COMPLETE/effective capability, is it reachable from its intended execution owner/root,
       semantically compatible with its producers/consumers, and supported by runtime proof?

The governing distinction is:

    IMPLEMENTED != WIRED != RUNTIME_REACHABLE != EFFECTIVE != OBSERVED != PROVEN

## 2. Whole-repository scope

The scan remains whole-repository. The historical 'DO NOT MODIFY MCFT IMPLEMENTATION' rule remains a mutation boundary, but MCFT is no longer excluded from audit discovery or reachability adjudication.

Minimum roots: apps/server/src, apps/server/db/migrations, apps/server/scripts, apps/executor/src, apps/judge/src, apps/telemetry-ingest/src, apps/web/src, packages/*, scripts, .github/workflows, docker, docker-compose*.yml, root/app package.json files, docs/architecture, and docs/digital_twin.

Discovery includes routes, module registration, server bootstrap, jobs, workers, daemons, Docker/Compose commands, generated dist entrypoints, controlled runners, GitHub workflows, spawn/exec/fork/shell edges, package-script indirection, database bootstrap/migrations, external adapters, semantic builders, persistence writers, projection/status derivations, read models, qualification roots, and production roots.

Directory labels such as scripts, acceptance, aux, legacy, or qualification do not prove runtime non-reachability.

## 3. Two independent graphs

Authority/semantic graph:

    source/input -> builder/derivation -> canonical object/projection -> writer -> consumer -> semantic consequence

Execution/runtime graph:

    execution root -> process/module/runner -> composition -> service/adapter -> transaction family -> output/effect

The audit joins these graphs. Source-code existence is not runtime reachability. Capability COMPLETE is not proof that it is present in the active runtime graph.

## 4. Execution-root inventory

Every executable root gets a stable execution_root_id and one class:

    PRODUCTION_ONLINE
    PRODUCTION_BATCH
    HTTP_SERVER
    BACKGROUND_WORKER
    CONTROLLED_REPLAY
    QUALIFICATION
    OPERATOR_TRIGGERED
    DATABASE_BOOTSTRAP
    GOVERNANCE_ONLY
    HISTORICAL_INACTIVE

Each root records launch mechanism, source entrypoint, package/Docker/workflow indirection, environment/feature gate, credential/authority boundary, expected capability set, production relevance, and qualification relevance.

## 5. Capability inventory

Enumerate every capability that is COMPLETE, closure_effective, capability_complete, runtime_source_authorized, production-effective, or an active read/worker/execution capability.

Current status must come from the current authoritative lifecycle artifact. If current artifacts disagree, fail with CAPABILITY_STATUS_AUTHORITY_CONFLICT. A stale aggregate matrix may not silently override newer closure/current-delivery authority.

Each capability records capability_id, lifecycle authority ref, current status, execution class, expected execution owner, expected execution roots, canonical inputs/outputs, transaction families, and required runtime proof.

## 6. Static reachability

Construct recursive closure from each declared execution root. Follow ESM/CJS imports, resolvable dynamic imports, require, module/route registration, package scripts, Docker/Compose commands, workflow commands, spawn, exec, fork, shell, and generated dist-entry mappings.

Static reachability answers only whether the root can reach the capability in the source graph. It cannot by itself yield WIRED_AND_PROVEN.

## 7. Runtime reachability proof

WIRED_AND_PROVEN requires evidence from the intended execution root: exact subject SHA, root/process identity, service/adapter, transaction family or observable effect, canonical output/read result, readback/telemetry evidence, and proof artifact/run.

Mutation-producing capabilities require runtime proof. Read-only capabilities may use real route/module registration plus runtime API proof. Controlled replay capabilities are proven from their controlled runner/workflow; absence from the production online process is not automatically a defect.

## 8. Producer-consumer semantic compatibility

Check expected edges independently of wiring. Compare, when applicable: object type, schema version, semantic family, unit, measurement depth, observation operator id, spatial support, field/root-zone equivalence, scope, logical_time, as_of, observed_at, available_at/available_to_runtime_at, runtime config ref/hash, authority class, lineage refs/hashes, and transaction preconditions.

An adapter is compatible only when its transformation is explicitly authorized and testable. Renaming a string/type is not compatibility proof.

## 9. Qualification-production equivalence

Qualification and production are separate execution graphs. When a qualification result supports a production closure claim, compare execution root, process/composition/runner versions, adapter/service graph, transaction families, evidence source, scheduler, clock authority, runtime-config resolution, crop/stage authority path, semantic contracts, and output identities.

If paths differ, an explicit equivalence proof is required. A green qualification run may not silently stand in for a materially different production path.

## 10. Orphan and dead-wiring scans

Orphan candidate: implemented/effective capability + expected execution owner + no valid intended-root runtime proof.

Dead-wiring candidate: authority/execution-capable code + unreachable from every declared current root + not explicitly historical/qualification-only/intentionally disconnected.

Tests importing a file do not make it runtime reachable.

## 11. Final disposition model

Every adjudicated capability/edge ends in exactly one class:

    WIRED_AND_PROVEN
    INTENTIONALLY_DISCONNECTED
    SEMANTICALLY_INCOMPATIBLE
    UNWIRED_DEFECT

No 'probably wired', 'looks safe', or NOT_PROVEN final state is allowed.

Decision rule: explicit governed disconnection -> INTENTIONALLY_DISCONNECTED; expected edge with semantic mismatch -> SEMANTICALLY_INCOMPATIBLE; expected edge with missing intended-root wiring/proof -> UNWIRED_DEFECT; intended root + static path + compatibility + required runtime proof -> WIRED_AND_PROVEN.

An unclassified discovery is not a fifth disposition. It is UNADJUDICATED_DISCOVERY and keeps the audit FAIL.

## 12. Mandatory MCFT reconciliation

M-01 CAP-05 Forecast Residual: identify intended execution owner/root for Cap05ForecastResidualOutcomeTickServiceV1, twin_forecast_residual_v1, and C_FORECAST_RESIDUAL_COMMIT; prove actual runtime reachability or classify it.

M-02 CAP-09 100 mm producer vs CAP-05 residual consumer: compare the active POINT_100MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1 authority with the observation-operator contract accepted by CAP-05. Do not repair during audit.

M-03 Real-clock rehearsal vs Production V2: compare process version, composition version, runner, crop/stage materializer, scheduler, evidence source, persistent tick service, transaction families, and runtime authority bindings. V1 qualification vs V2 production cannot be assumed equivalent.

M-04 CAP-06 controlled calibration/shadow: verify intended controlled replay roots. Do not require it inside hourly production unless current authority says so.

M-05 CAP-07 read surface: prove current server registration reaches the current Field Twin read API and remains read-only as declared.

M-06 CAP-08 replay/decision-action boundary: explicitly classify replay-only, qualification-only, product-read dependencies, and any expected production dependencies.

M-07 CAP-09 production root exactness: prove docker-compose service -> generated dist entry -> production process -> production composition -> runner -> persistent tick service -> canonical writes/readback on the exact closure subject.

## 13. Required audit outputs

    1. all execution roots
    2. all COMPLETE / effective capabilities
    3. expected execution owner per capability
    4. static reachability
    5. runtime reachability proof
    6. producer-consumer semantic compatibility
    7. orphan capability list
    8. dead wiring list
    9. qualification-production divergence list
    10. explicit intentional-disconnected list

## 14. Fail-closed conditions

Audit FAILs on any unresolved: UNREGISTERED_AUTHORITY_CAPABLE_PATH, UNREGISTERED_EXECUTION_ROOT, UNREGISTERED_COMPLETE_CAPABILITY, CAPABILITY_STATUS_AUTHORITY_CONFLICT, EXPECTED_OWNER_MISSING, EXPECTED_ROOT_MISSING, UNADJUDICATED_DISCOVERY, SEMANTIC_EDGE_UNCHECKED, QUALIFICATION_PRODUCTION_EQUIVALENCE_UNCHECKED, or RUNTIME_PROOF_REQUIRED_BUT_MISSING.

SEMANTICALLY_INCOMPATIBLE and UNWIRED_DEFECT are valid audit classifications but block closure of the affected capability until a separately authorized repair.

## 15. Non-effects

This method does not authorize product semantic change, runtime wiring repair, observation-operator change, CAP-05 contract expansion, CAP-06 activation, model activation, production DB/raw mutation, Formal-v5 arm, A0, O00-O23, Stage 1B closure, MCFT-CAP-09 completion, B-Line reopening, or ADR change.

## 16. Execution safety boundary

This audit is authorized to continue only through repository/GitHub-isolated work.

Allowed:

    continue #3617 audit closure
    create independent repair branch
    create Draft repair PR
    GitHub-hosted isolated CI
    static/governance acceptance
    isolated PostgreSQL acceptance
    contract design and code implementation

Forbidden stable codes:

    MERGE_PR_3617
    MERGE_REPAIR_PR
    ADVANCE_PROTECTED_MAIN
    LOCAL_WORKTREE_SWITCH_RESET_PULL_TO_REPAIR_BRANCH
    REBUILD_CURRENT_REHEARSAL_IMAGE
    RECREATE_CURRENT_REHEARSAL_PROJECT
    MUTATE_REHEARSAL_POSTGRESQL
    CLEANUP_REHEARSAL
    RESTART_REHEARSAL_UNLESS_SELF_FAILURE
    MUTATE_FORMAL_STORE
    REARM_FORMAL_STORE

Human-readable forbidden operations:

    merge #3617
    merge any repair PR
    advance protected main
    git switch/reset/pull the current C:\Users\mylr1\GEOX worktree to a repair branch
    rebuild the currently running rehearsal image
    docker compose down/up/recreate the current rehearsal project
    mutate the rehearsal PostgreSQL database
    cleanup the rehearsal
    restart the rehearsal unless the rehearsal itself fails
    mutate Formal store
    perform re-arm

The audit and repair work must not depend on the current rehearsal container, its PostgreSQL instance, its image, its compose project, or the Formal store. GitHub-hosted PostgreSQL acceptance must use disposable isolated databases only.

## 17. Method exit

Freeze scan roots, execution-root classes, lifecycle-authority resolution, reachability rules, runtime-proof requirements, semantic compatibility dimensions, qualification-production comparison, four terminal dispositions, mandatory MCFT items, and non-effects. Then run a fresh whole-repository audit on one exact protected-main SHA. Historical PASS counts are not current graph-completeness proof.
