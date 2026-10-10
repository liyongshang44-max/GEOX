# CAP-09 bounded historical replay (engineering only)

Base: `af4c68e9c3bd5da782b08443b9397b496ba85b74` (PR #3688).

Windows diagnostic `MCFT-history-timeout-20261010-192854.zip` recorded exit 1
after 250.5636647 seconds. Git 2.52.0.windows.1 recorded 1,387 completed root
Git commands, all exit 0; their cumulative process durations were 187.1768
seconds. There were 933 `show`, 345 `cat-file`, three clones, eight completed
worktree additions, and no fetch commands. Status alone reached 16.048377
seconds. The outer 240-second Node historical replay expired while deeper
historical work continued. These observations prove an elapsed-time failure,
not a historical assertion PASS and not a live qualification attempt.

## Scope

Exactly seven engineering paths are registered by
`HISTORY_REPLAY_BUDGET_20261010_V1`. Candidate admission must descend from the
exact base. Post-merge admission requires exact main, two parents with that
base first, and a zero-delta candidate tree. All existing 50 QCP checks and
resolvers remain unchanged. The prior bucket verifier changes only by adding
a successor delegation; its complete original assertions are byte-checked.

The new verifier clones and executes immutable PR #3688 source. A reviewed
preload changes only the existing 240-second Node `execFileSync` budgets when
the sole argument is one of these three historical governance scripts:

- `VERIFY_MCFT_CAP_09_ISOLATED_PRODUCER_BUCKET_SEAM_SUCCESSOR_V1.cjs`
- `VERIFY_MCFT_CAP_09_ISOLATED_QUALIFICATION_AUTHORIZATION_SUCCESSOR_V1.cjs`
- `VERIFY_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_SUCCESSOR_V1.cjs`

The root historical process has a finite 20-minute deadline. Nested matching
calls share that deadline, reduced by two seconds at each level for cleanup
and error propagation. They do not each receive a fresh 20 minutes. External
NODE_OPTIONS or a supplied deadline are rejected by the initiating verifier.
Git timeouts, deeper leaf-verifier timeouts, assertions, stdout, exit codes,
and exceptions remain unchanged. No cached PASS or synthetic proof is used.
The helper is passed only to the historical subprocess; the parent and later
qualification executor do not inherit its environment. Expiration fails.

## Preserved boundaries

No Runtime, Producer, timing executor, ARM, dependency, production resource,
or historical commit changes. Frozen Runtime remains 108 paths at
`3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a`. The original failed receipt and
read-only audit remain immutable. This engineering proof neither retries
Execute nor authorizes production, Formal, A0, or O00. A new protected-main
subject still needs its own operator binding and all existing preflight,
expiry, scope, and single-attempt guards.

## Validation

Preparation acceptance tests cover exact seven-path pre/post merge admission,
wrong parents/trees/paths, fixed shared deadline, expiration, unchanged Git
and execution-runner options, external preload rejection, and actual child
stdout/nonzero exit propagation. Historical replay must return its real PASS.
Linux validation does not establish Windows host completion; the latter must
be measured after protected-main adoption.
