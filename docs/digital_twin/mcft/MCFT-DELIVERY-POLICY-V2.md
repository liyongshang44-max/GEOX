# MCFT Delivery Policy V2

## Authority

`MCFT-DELIVERY-POLICY-V2` is repository-wide delivery-process policy. It is not a capability Slice, Runtime authority, canonical-write authority, predecessor, or successor authorization.

It supersedes V1 for current enforcement. V1 remains an immutable historical record of the CAP-06/S9-specific rule.

## Candidate declaration V2

Any MCFT PR that creates a candidate-state transition must include exactly one declaration block in the PR body:

```text
<!-- MCFT_CANDIDATE_DECLARATION_V2
capability_line=MCFT-CAP-07
slice_id=MCFT-CAP-07.EXAMPLE-SLICE-V1
status_file=docs/digital_twin/mcft/cap_07/EXAMPLE-STATUS.json
candidate_field=candidate_implemented
candidate_value=true
focused_workflow=mcft-cap-07-example
standard_workflow=ci
semantic_snapshot_files=path/authority.json,path/contract.json,path/status.json
semantic_snapshot_blobs=<blob-sha>,<blob-sha>,<blob-sha>
candidate_head=<commit-sha>
base_head=<commit-sha>
-->
```

The rule is capability- and Slice-agnostic. The declaration binds the exact PR head, exact PR base, candidate status field, required workflows, and ordered semantic path/blob pairs.

A candidate-like transition in an MCFT status or authority JSON without the V2 declaration fails closed.

## Release lane

`MCFT-RELEASE-LANE-V1` validates the GitHub test-merge object rather than a historical fixed commit. For a declared candidate it requires:

```text
current main == declared/base PR SHA
candidate head == declared candidate SHA
test merge parents include current base and candidate head
test merge tree == candidate head tree
candidate head remains unchanged after validation
```

This prevents a candidate validated on one base from being merged after another governance PR has changed `main`, which was the direct failure mode of MCFT-CAP-06 S9 PR #2576.

The lane uses one repository-wide concurrency group. It creates no branch, transports no file, commits no generated output, and creates no proof-only PR.

## Workflow security

Enforcement runs under `pull_request_target` using only policy code from the default branch. It reads PR metadata, repository blobs, workflow status, Git commit trees, and test-merge topology through the GitHub API. It never checks out or executes untrusted PR code with elevated permissions.

Permissions remain read-only:

```text
contents: read
actions: read
pull-requests: read
```

## Historical disposition

The following V1 mechanisms become manual-only historical validators:

```text
mcft-delivery-policy-v1
mcft-candidate-declaration-integrity-v1
```

They no longer represent current repository-wide enforcement. In particular, current policy must not check out the frozen CAP-06 taskbook revision commit and call that a live all-repository Gate.

## Repository setting boundary

The workflows implement real-time declaration and merge-ref checks. A GitHub branch ruleset should require the V2 candidate and release-lane checks for declared MCFT candidates. Repository ruleset configuration is an external repository setting, not a committed capability artifact.

## Nonclaims

This policy does not authorize MCFT-CAP-07, does not establish production Runtime capability, and does not convert delivery governance into a technical Slice.
