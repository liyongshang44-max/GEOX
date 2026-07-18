# MCFT Delivery Policy V1

## Status

```text
policy_id: MCFT-DELIVERY-POLICY-V1
scope: ALL_MCFT_CAPABILITY_LINES
policy_kind: REPOSITORY_WIDE_DELIVERY_PROCESS_POLICY
capability_slice: false
runtime_authority: false
canonical_object_authority: false
```

This policy governs how frozen MCFT taskbooks are changed and how pull requests are prepared. It is not a Runtime capability, not a technical prerequisite Slice and not part of any capability's business or architecture graph.

## 1. Frozen-taskbook gap classification

After a taskbook is frozen, every newly discovered gap must be classified as exactly one of the following two classes.

### A. Implementation defect

```text
classification: IMPLEMENTATION_DEFECT
meaning: the frozen taskbook is sufficient, but the current Slice implementation is incorrect or incomplete
required_action: correct the current Slice
slice_order_change: forbidden
taskbook_version_change: not required
new_prerequisite: forbidden
```

The correction remains inside the currently authorized Slice and may not create, insert or imply a new predecessor node.

### B. Taskbook design defect

```text
classification: TASKBOOK_DESIGN_DEFECT
meaning: the frozen taskbook omitted, misclassified or incorrectly ordered required design authority
required_action: pause capability execution; increase the taskbook version; perform full-chain impact analysis; re-freeze and re-authorize the corrected frontier
slice_order_change: allowed only through the new taskbook version
new_prerequisite_under_old_frozen_version: forbidden
```

A taskbook design defect is resolved by changing the design authority. It is never resolved by keeping the old taskbook frozen while inserting an ad hoc prerequisite into execution state.

## 2. Forbidden third mode

The following mode is prohibited:

```text
TASKBOOK_REMAINS_FROZEN
AND
AD_HOC_PREREQUISITE_IS_INSERTED
AND
EXECUTION_CONTINUES
```

Equivalent labels such as `entry control`, `preflight prerequisite`, `corrective prerequisite`, `temporary predecessor`, `bridge Slice`, `stabilization prerequisite` or `governance prerequisite` do not bypass this prohibition when they alter the capability sequence.

A newly required technical dependency discovered after freeze must therefore be either:

1. an implementation defect corrected within the current Slice without changing order; or
2. a taskbook design defect handled through a taskbook version upgrade and full-chain impact analysis.

There is no third classification.

## 3. Taskbook version-upgrade protocol

A `TASKBOOK_DESIGN_DEFECT` requires all of the following before capability execution resumes:

```text
1. execution is explicitly PAUSED;
2. the effective taskbook version is incremented;
3. a machine-readable taskbook manifest identifies the old and new versions;
4. the defect and its root cause are recorded;
5. the complete Slice graph is re-evaluated;
6. predecessor and successor impact is recorded for every remaining Slice;
7. already merged technical evidence is classified as valid, invalid or conditionally reusable;
8. historical artifacts are preserved and explicitly superseded or reclassified;
9. the corrected taskbook is re-frozen;
10. merged-main proof activates the new taskbook version;
11. only then may the previously paused frontier resume.
```

The version upgrade is governance correction, not a new capability Slice. It may pause a Slice, but it may not appear as a business or Runtime node in the capability graph.

## 4. Technical prerequisites versus delivery-process policy

The following are examples of real technical authority and may belong in a taskbook, Slice contract or Slice acceptance boundary:

```text
authority graph
dual-time semantics
exact ref/hash binding
Runtime Config dispatch
repository query shape
canonical object envelope
idempotency and recovery semantics
projection derivation authority
numeric policy and fixed-point rules
```

The following are delivery-process controls and must not be represented as capability Slices:

```text
PR commit-count limits
WIP/debug/retry commit cleanup
Draft PR history cleanup
branch transport or carrier rules
temporary branch naming
ready-for-review hygiene
merge-method selection
local patch or bundle transport
CI retry presentation
```

Delivery-process controls may block a PR from becoming ready or merging. They may not:

```text
create a capability predecessor;
change the capability graph;
be counted as a completed technical Slice;
authorize Runtime source;
authorize canonical writes;
be used as evidence that a Runtime capability exists.
```

## 5. Pull-request hygiene

The repository-wide default is:

```text
final PR history contains intentional logical commits;
WIP, debug, retry and temporary carrier commits are removed before ready-for-review;
commit-count guidance is review guidance, not Runtime design authority;
proof-only PRs are closed without merge;
carrier branches and local patch transport never become capability evidence;
exact-head CI, head-to-merge equivalence and merged-main proof remain required where a taskbook requires them.
```

A capability may tighten technical acceptance evidence, but it may not create a capability Slice solely to enforce these delivery controls.

## 6. Historical MCFT-CAP-06 S5-ENTRY disposition

The historical artifact:

```text
MCFT-CAP-06.S5-ENTRY.AUTHORITY-GRAPH-PREFLIGHT-AND-PR-HYGIENE-V1
```

is preserved as repository history but is reclassified as follows:

```text
historical_status: MERGED_EFFECTIVE_HISTORICAL_RECORD
capability_slice_status: MISCLASSIFIED_NOT_A_CAPABILITY_SLICE
root_cause: TASKBOOK_DESIGN_DEFECT
```

Its contents are split by authority:

```text
authority graph / exact-ref traversal / query shape / structured preflight
-> technical S5 entry criteria under the corrected MCFT-CAP-06 taskbook

commit count / WIP cleanup / Draft history / branch transport
-> MCFT-DELIVERY-POLICY-V1
```

No merged commit, workflow, acceptance result or historical document is rewritten. The historical node is removed from the normative capability graph and from capability-Slice completion counts.

## 7. Enforcement

Repository governance checks must fail when a change:

```text
inserts a new prerequisite while retaining the same frozen taskbook version;
uses delivery-process vocabulary as a capability Slice;
changes task order without a TASKBOOK_DESIGN_DEFECT record and impact analysis;
resumes a paused capability before the revised taskbook is merged-main effective;
relabels historical delivery-process controls as Runtime authority.
```

This policy applies to every current and future MCFT capability line.