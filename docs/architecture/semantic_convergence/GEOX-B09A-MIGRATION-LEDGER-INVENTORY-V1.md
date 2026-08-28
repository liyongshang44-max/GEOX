# GEOX B-09a Migration Ledger Inventory V1

## 0. Status

B-09 begins only after B-08 overall closure.

Authoritative B-08 product head:

`6702631be2f66587d4fa1230e0f97f6fd4e9b8b9`

B-09a is a governance/inventory phase only.

It does **not** shadow-execute, migrate consumers, remove authority, disable defaults, or delete code.

## 1. Frozen B-09 order

The Amendment-01 order remains exact:

`canonical replacement exists`

→ `legacy/canonical shadow comparison`

→ `semantic divergence inventory`

→ `acceptance/consumer migration`

→ `remove legacy authority`

→ `compatibility-only / no-new-feature`

→ `disable default where safe`

→ `delete only after explicit prerequisites`.

B-09a implements only the inventory/classification needed before the second step.

## 2. Ledger coverage

`GEOX-B09-MIGRATION-LEDGER-V1.json` contains exactly every current producer with:

`grandfathered_duplicate = true`

from the Semantic Ownership Register.

At B-09a base this is exactly **29 producers**.

Each entry snapshots:

- semantic identity;
- legacy producer/path/connectivity;
- current proven consumers;
- replacement state;
- canonical replacement refs or future targets;
- shadow-compare state;
- divergence state;
- consumer-migration state;
- authority-removal eligibility;
- intended final disposition.

No grandfathered producer may be absent or silently added.

## 3. Replacement classes

### PROVEN_REPLACEMENT

A bounded canonical replacement capability is already established and validated, but authority is **not** removed until shadow/divergence/migration gates complete.

This currently includes the exact B-06 Candidate adapters, B-07 Eligibility mappings/runtime, and the replacement-backed Agronomy Agent plan boundary.

### PARTIAL_REPLACEMENT

Canonical contracts/adapters exist, but exact runtime semantic equivalence or consumer migration is not yet demonstrated.

Evidence, Context, Crop Stage and several mixed Calculation/Plan paths are deliberately conservative here.

### NO_REPLACEMENT

No connected canonical replacement exists.

This is especially important for Twin State / Forecast / Scenario because B-08 explicitly ended with:

- real MCFT adapter = NOT CONNECTED;
- real ADR runtime = NOT CONNECTED;
- real LLM provider = NOT CONNECTED.

B-09a therefore forbids claiming a Twin replacement.

## 4. Removal remains impossible in B-09a

Every entry has:

`authority_removal_eligible = false`.

The global ledger also freezes:

- authority removal disabled;
- shadow comparison may be CAPABLE but not RUNNING/COMPLETE;
- divergence remains UNKNOWN;
- consumer migration may not be PARTIAL/COMPLETE;
- runtime authority mutation forbidden;
- mass deletion forbidden;
- real MCFT/ADR/LLM integration forbidden.

The validator fails if any of these advance prematurely.

## 5. Intended dispositions

The ledger distinguishes future intent from present authority:

### REMOVE_AUTHORITY_AFTER_GATES

Only replacement-backed entries may eventually enter this path, and only after compare/divergence/consumer migration.

### RETAIN_AS_NONAUTHORITATIVE_SOURCE

Used where the underlying fact/source remains legitimate but must stop owning the semantic conclusion independently.

The field-program fact is the current example.

### RETAIN_UNTIL_EXTERNAL_REPLACEMENT

Used where no connected canonical replacement exists.

Active Twin state paths are explicitly retained here.

### COMPATIBILITY_ONLY_NO_NEW_FEATURE

Used for unreplaced acceptance/devtools/orphaned/reference paths that should not gain new authority or features.

No code deletion is implied.

## 6. Machine validation

`ACCEPTANCE_B09_MIGRATION_LEDGER_V1.cjs` proves:

- exact 1:1 coverage of all grandfathered producers;
- exact legacy path/connectivity/removal-target snapshot;
- exact current parallel/connectivity edge references;
- canonical replacement refs resolve to existing non-grandfathered producers or existing repository paths;
- NO_REPLACEMENT entries cannot target removal;
- Twin State/Forecast/Scenario cannot claim replacement;
- B-09a cannot claim shadow execution/divergence adjudication/consumer migration completion;
- all authority-removal eligibility remains false;
- summary counts are exact.

## 7. No authority mutation

B-09a must not change any grandfathered producer's:

- `grandfathered_duplicate`;
- `current`;
- `authority_level`;
- `connection_class`;
- `activation`;
- `runtime_edge`;
- `removal_target`;
- `grandfathered_runtime_consumers`.

It must not remove or rewrite any current parallel edge.

Those are later B-09 actions only after evidence gates.

## 8. Next frontier

After B-09a completes, B-09b may begin shadow-compare harnesses for replacement-backed families.

Priority should be the strongest exact mappings first:

1. CandidateDecision producer families;
2. Decision Eligibility precursors;
3. Agronomy Agent direct-plan classification;
4. then partial Evidence/Context/Stage/Calculation families.

Twin State/Forecast/Scenario remain outside removal eligibility until real external replacement exists.
