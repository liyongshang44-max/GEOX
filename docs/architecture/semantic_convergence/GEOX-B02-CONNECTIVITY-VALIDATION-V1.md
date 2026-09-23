# GEOX B-02 Runtime Connectivity Validation V1

Status: **derived validation record / B-02 gate support**

Repository-level SSOT: `docs/SSOT.md`

Sprint / Tag / Freeze authority: `README_MIGRATION.md`

Protected-main audit basis:

```text
26c1383f7f45abb76c99e28ec3d06714e85d1b2c
```

This file does not create architecture authority and does not modify runtime semantics. It records the B-02 validation method after the Semantic Ownership Register was extended with current runtime connectivity.

## B-02 completion equation

```text
Semantic Ownership
        +
Runtime Connectivity
        =
B-02 machine-readable repository map
```

The machine-readable source remains the existing files:

```text
docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json
docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json
scripts/governance_acceptance/ACCEPTANCE_B02_SEMANTIC_CONTRACT_LINTER_V1.cjs
```

This validation record is not a second register or graph.

## Exact-main corrections preserved

B-02 records code truth rather than forcing a planned classification.

In particular:

```text
EvidenceJudgeV2 -> AgronomyJudgeV2
contract compatible = true
runtime edge = NOT_PROVEN
status = NOT_WIRED
```

because the two Judge endpoints are separate POST routes and the Agronomy Judge route does not automatically load/run Evidence Judge.

Also:

```text
Acceptance -> Field Memory
```

is classified as a proven current runtime edge, not a manual seam: the audited acceptance route directly records formal Field Memory after a formal PASS when a field is present.

By contrast:

```text
Acceptance -> Water Response Verification
```

remains a MANUAL_SEAM because no automatic call from Acceptance has been proven.

## Failure handling discipline

If the B-02 linter fails, the failure must first be classified as one of:

```text
REAL_NEW_PRODUCER
REAL_CONSUMER
LEGAL_COMPATIBILITY
INTENTIONAL_ISOLATION
SCANNER_FALSE_POSITIVE
REGISTER_OR_GRAPH_ERROR
```

Unknown findings must not be silenced by expanding an allowlist before this classification is complete.

## Formal completion gate

B-02 is COMPLETE only when all conditions below pass on one exact B-02 head:

```text
Ownership Register                         PASS
Parallel Authority Graph                   PASS
Forbidden Edge Graph                       PASS
Connectivity classification                PASS
Connectivity edges                         PASS
Static linter                              PASS
Exact-head general CI                      PASS
Existing MCFT governance/release lanes     PASS
Unknown unclassified production edge       0
```

The exact-head linter evidence (commit SHA, exit code, semantic-register stats, connectivity stats and PASS marker) is recorded in the Draft PR conversation so recording evidence does not mutate the validated commit after validation.

Until that gate passes:

```text
DO NOT START B-03
DO NOT MODIFY RUNTIME SEMANTICS
DO NOT DISABLE AGRONOMY AGENT
DO NOT REWIRE JUDGE
DO NOT MODIFY MCFT
DO NOT DELETE LEGACY CODE
```
