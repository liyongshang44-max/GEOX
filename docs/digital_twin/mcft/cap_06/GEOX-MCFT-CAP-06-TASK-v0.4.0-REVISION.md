# GEOX MCFT-CAP-06 Taskbook Revision v0.4.0

## Authority

```text
capability_line_id: MCFT-CAP-06
revision_id: MCFT-CAP-06-TASKBOOK-V0.4.0
base_taskbook_version: v0.3.1
change_classification: TASKBOOK_DESIGN_DEFECT
revision_status: CANDIDATE_NOT_EFFECTIVE
execution_status: PAUSED_PENDING_TASKBOOK_V0_4_0_MERGED_MAIN_PROOF
```

This revision is the normative correction to `GEOX-MCFT-CAP-06-TASK.md`. The effective taskbook is the bundle declared by `GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json`. Where this revision conflicts with v0.3.1 or either historical S5 amendment, this revision has precedence.

The revision is governance correction. It is not a capability Slice, does not add a predecessor node and does not authorize Runtime or canonical writes.

## 1. Defect statement

Two post-freeze amendments inserted prerequisites while retaining the frozen v0.3.1 taskbook:

```text
MCFT-CAP-06.S5-ENTRY.AUTHORITY-GRAPH-PREFLIGHT-AND-PR-HYGIENE-V1
MCFT-CAP-06.S5-PREDECESSOR.GRAPH-AND-DUAL-TIME-CONFORMANCE-V1
```

This created a split between design authority and execution authority.

The first artifact also mixed technical entry conditions with delivery-process controls. Authority graph, exact-ref traversal and query shape are technical. Commit-count, WIP cleanup, Draft-history cleanup and branch transport are delivery policy.

Both insertions are classified as `TASKBOOK_DESIGN_DEFECT`, not as new capability prerequisites.

## 2. Frozen-taskbook change rule

After this revision, any gap discovered after taskbook freeze must be classified as exactly one of:

```text
A. IMPLEMENTATION_DEFECT
   -> correct the current Slice
   -> do not alter task order
   -> do not add a prerequisite

B. TASKBOOK_DESIGN_DEFECT
   -> pause execution
   -> increment taskbook version
   -> perform full-chain impact analysis
   -> re-freeze and activate the revised taskbook on merged main
```

The following mode is forbidden:

```text
KEEP_OLD_TASKBOOK_FROZEN
PLUS
INSERT_AD_HOC_PREREQUISITE
PLUS
CONTINUE_EXECUTION
```

`MCFT-DELIVERY-POLICY-V1` is mandatory for all MCFT capability lines.

## 3. Corrected normative Delivery Slice graph

The corrected MCFT-CAP-06 capability graph contains only technical capability Slices:

```text
P-1
DT-02 Object / Transaction / Envelope Adjudication
↓
P0
CAP-05 Terminal SSOT Reconciliation / CAP-06 Provisional SSOT
↓
S0
Authorization / Predecessor Lock / Structural Dataset Qualification
↓
S1
Canonical Matched Residual Windows
↓
S2
Calibration / Shadow Contracts, Fixed-Point Math and Policies
↓
S3
D Persistence, Idempotency, Projection and Recovery
↓
S4
Predecessor Consumption Stabilization
↓
S5
Calibration Candidate Compute and D Commit
↓
S6
Zero-Write Paired Historical Replay Compute
↓
S7
Shadow Evaluation D Commit
↓
S8
Restart / Exact Readback / Facts-Based Projection Rebuild
↓
S9
Post-Evaluation Base-Parameter Non-Consumption Tick
↓
S10
Bounded End-to-End Chain / Zero-Write Replay / Repository-History Assessment
↓
S11A
Closure Candidate
↓
S11B
Merged-main Finalization Gate
↓
S11C
Capability Completion Effectiveness Activation
↓
S11D
Final Effectiveness Reconciliation
```

The historical S5-ENTRY and S5-PREDECESSOR nodes are not present in the normative graph.

## 4. Corrected S5 entry criteria

The technical content discovered by the historical amendments is folded into S5 itself. Before S5 implementation may be accepted, S5 must prove all of the following under one frozen taskbook version:

```text
1. exact Residual-root authority;
2. exact forward graph traversal to Forecast, Config, posterior State and Evidence Window;
3. separate source-Forecast Config and Residual Config resolution;
4. deterministic Config dispatch by config_purpose;
5. observed_at and available_to_runtime_at remain distinct;
6. no latest, range, scope or raw-observation side lookup;
7. PostgresResolvedForecastObservationCaseAssemblerV1 is the sole query authority;
8. graph-conformant controlled profile preserves numerical lineage;
9. fixed S2 math and policy compatibility;
10. S3 persistence and S4 composition regression;
11. structured single-command preflight;
12. exact protected predecessor path boundary.
```

These are S5 entry conditions and acceptance evidence. They are not separately countable capability Slices.

## 5. Delivery-process controls

The following controls are removed from MCFT-CAP-06 technical Slice semantics and governed only by `MCFT-DELIVERY-POLICY-V1`:

```text
maximum logical commit count;
WIP/debug/retry commit cleanup;
Draft PR history cleanup;
temporary or carrier branch rules;
patch/bundle transport rules;
ready-for-review hygiene.
```

They may block a PR from ready-for-review or merge. They cannot block Runtime authorization by appearing as a capability predecessor.

## 6. Historical artifact treatment

The following files and their merged evidence remain immutable historical facts:

```text
GEOX-MCFT-CAP-06-TASK-AMENDMENT-S5-ENTRY-CONTROLS-V1.md
GEOX-MCFT-CAP-06-S5-ENTRY-PREREQUISITE.json
GEOX-MCFT-CAP-06-S5-ENTRY-EFFECTIVENESS.json
GEOX-MCFT-CAP-06-TASK-AMENDMENT-S5-PREDECESSOR-GRAPH-CONFORMANCE-V1.md
GEOX-MCFT-CAP-06-S5-PREDECESSOR-GRAPH-CONFORMANCE.json
GEOX-MCFT-CAP-06-S5-PREDECESSOR-EFFECTIVENESS.json
```

Their corrected classification is:

```text
historical_record: true
merged_evidence_preserved: true
normative_capability_slice: false
root_cause: TASKBOOK_DESIGN_DEFECT
```

Technical outputs remain reusable evidence for S5. Delivery-process content is superseded by `MCFT-DELIVERY-POLICY-V1`.

## 7. Current frontier disposition

At discovery of this design defect:

```text
S8 implementation exact head: 2715140adbd6cb951a424a7594446c9f989dd942
S8 implementation merge: f14dc4c6aaf1cc8b56530c3f9088a1247f5d4db7
S8 merged-main proof workflow: 29631551159
S8 implementation evidence: VALID
S8 effectiveness: NOT_YET_WRITTEN
S9 authorized: false
```

Execution is paused before S8 effectiveness writeback. No Runtime code is reverted. After v0.4.0 is merged-main effective, execution resumes at the pre-existing frontier:

```text
next_action: S8_EFFECTIVENESS_WRITEBACK
not: NEW_PREREQUISITE_SLICE
```

## 8. Non-impact and nonclaims

```text
NO_RUNTIME_SOURCE_CHANGE
NO_CANONICAL_FACT_APPEND
NO_CANONICAL_FACT_UPDATE
NO_CANONICAL_FACT_DELETE
NO_CANDIDATE_APPEND
NO_EVALUATION_APPEND
NO_MODEL_ACTIVATION
NO_ACTIVE_CONFIG_SWITCH
NO_RUNTIME_PARAMETER_CHANGE
NO_STATE_OR_CHECKPOINT_MUTATION
NO_MIGRATION
NO_ROUTE
NO_OPENAPI
NO_WEB
NO_SCHEDULER
NO_S9_AUTHORIZATION_BEFORE_S8_EFFECTIVENESS
NO_MCFT_CAP_07_AUTHORIZATION
```
