# GEOX B-10A Residual Authority Audit V1

Status: behavior-neutral governance package.

## Mission
During MCFT-CAP-09 parallel closure, prove GEOX has no unregistered authority-capable surface across the non-MCFT product tree before broad authority removal or final typed integration. This package changes no business behavior and no MCFT implementation.

## Why current B-02 is insufficient
Current B-02 explicitly declares STATIC_EXPLICIT_ONLY. It validates known producers, consumers, connectivity and fingerprints, but cannot prove an older or differently named authority path was never registered.

B-10A adds reverse scanning:
semantic object / persisted type / authority-bearing state -> producer-capable path -> entrypoint/activation -> B-02 registration or residual classification.

Any detected path absent from both B-02 and B-10A fails as UNREGISTERED_AUTHORITY_CAPABLE_PATH.

## Scan classes
- persisted fact/table writers
- pure semantic builders/projectors
- execution dispatch-state derivation
- worker/executor entrypoints
- SQL function/trigger authority logic
- runtime/governance scripts and GitHub workflows

Tests and fixtures are excluded as non-production authority, not semantically approved.

## Required classification
Each residual surface records path, entrypoint, activation, writes, reads, semantic family, authority class/role, runtime reachability, feature flag, downstream consumers, and removal/reclassification target.

## Initial verified residuals
Planner CandidateActionV1; Agronomy Agent fabricated-soil/direct-plan path; Decision Engine authority-bearing input resolution; Prescription action-spec plus approval policy; operator/queue/executor DISPATCHED conflation; Human executor adapter; Twin Kernel dispatch projection; root-zone recommendation builder and stale operator_twin.ts.

John Deere #3346 is tracked out-of-tree because it is not present in this B-09y-derived tree; the final consolidated head must scan it.

## Completion
B-10A completes only when exact-head machine output has zero UNREGISTERED_AUTHORITY_CAPABLE_PATH failures and no unresolved runtime-reachability claim for a surface affecting Candidate, Approval, Plan, Task, Dispatch, Receipt, Acceptance, Twin decision inputs, Outcome, Field Memory or ROI.

B-10A does not authorize authority removal, MCFT modification, Forecast integration, or B-07e runtime connection.
