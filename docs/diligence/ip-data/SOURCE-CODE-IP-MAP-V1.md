# GEOX / Agronomy Deployment Runtime — Source Code IP Map V1

Date: 2026-09-18
Status: PRE-INCORPORATION V1
Scope: Source-code intellectual-property provenance and chain-of-title evidence
Evidence base:
- GEOX repository: `liyongshang44-max/GEOX`
- GEOX baseline main: `f7d28aef3d2fe8e65ce0afff64e6f2673c2eb39b`
- Agronomy Deployment Runtime repository: `liyongshang44-max/agronomy-deployment-runtime`
- Agronomy Deployment Runtime baseline main: `aaf5e83ab9a302a935661e284828a91aa58448d1`
- Founder attestation: 2026-09-18

## 1. FACT

### 1.1 Corporate status
No company entity has yet been incorporated for GEOX / Agronomy Deployment Runtime.

### 1.2 Human development population
Founder attestation states:
- the founder is the only human developer;
- no employee has contributed source code;
- no contractor has contributed source code;
- no consultant, advisor, friend, or other external human contributor has contributed source code;
- the founder has not previously been employed by another company;
- no former-employer source code exists in the repositories;
- the products were independently developed by the founder.

### 1.3 Repository visibility and repository-level license metadata
At the evidence date:
- `liyongshang44-max/GEOX` is public;
- `liyongshang44-max/agronomy-deployment-runtime` is public;
- GitHub repository metadata reports no repository-level license for either repository;
- no root `LICENSE` file was identified in the reviewed repository roots.

### 1.4 GEOX authorship observations
A mainline Git-history review covering approximately 6,000 commits from the current head backwards identified:
- predominant human GitHub login: `liyongshang44-max`;
- predominant author email: `liyongshang44@gmail.com`;
- author alias `mylr` using the same email and mapping to the same GitHub account;
- automation identities including GitHub Actions and GEOX governance automation;
- five commits with author metadata `OpenAI GEOX Engineer <openai-geox@users.noreply.github.com>`.

The reviewed GEOX history segment did not identify an independent external human contributor identity. The review segment was not represented as exhaustive to repository genesis.

### 1.5 Agronomy Deployment Runtime authorship observations
The reviewed `main` history contained 897 commits in the pagination range to repository genesis:
- 895 commits were attributable to the founder-controlled GitHub identity;
- 2 commits were attributable to GitHub Actions automation;
- no independent external human contributor identity was identified.

### 1.6 AI-associated commit cohort
Five GEOX commits dated 2026-07-17 contain author metadata `OpenAI GEOX Engineer <openai-geox@users.noreply.github.com>` while the committer identity is founder-controlled:

- `ff336875c590482a740f14b9a76113826f9f4a2b`
- `16dd6785967094edf325bfea8345d98deadb9152`
- `8e0f5564ce83e60c44e64166a12a1d63d4c31a12`
- `a801a2eaad6396db6ea013af12c82012d8c31e98`
- `d6085d0721b519f6a57971600f32b4fa89d15f97`

Founder attestation states that these commits resulted from founder-controlled use of Codex/OpenAI tooling or alternate founder-controlled accounts, including use of alternate accounts when primary-account usage limits were exhausted. No independent external human developer was involved.

### 1.7 Internal generated-code provenance
The repository contains internally generated artifacts with an explicit deterministic generation chain, including:

`config/judge/ruleset_v1.json`
→ `apps/judge/scripts/gen_ruleset.mjs`
→ `apps/judge/src/generated/ruleset.ts`
→ `apps/web/src/generated/judge_ruleset.schema.json`

The generated file header identifies the repository-controlled generator and source of truth.

## 2. EVIDENCE

### 2.1 Repository evidence
- GEOX baseline: `f7d28aef3d2fe8e65ce0afff64e6f2673c2eb39b`
- Agronomy Deployment Runtime baseline: `aaf5e83ab9a302a935661e284828a91aa58448d1`
- GitHub repository metadata: public visibility; repository license metadata = null for both repositories at review time.
- GEOX root application domains include `apps/server`, `apps/web`, `apps/judge`, `apps/executor`, and `apps/telemetry-ingest`.
- GEOX shared/core package domains include `packages/contracts`, `packages/control-kernel`, `packages/control-constitution-validator`, `packages/guardrails`, `packages/agronomy-skills`, `packages/crop-skills`, and `packages/device-skills`.
- Agronomy Deployment Runtime package domains include `source-registry`, `provenance`, `knowledge-registry`, `knowledge-release`, `context-contract`, `context-manifest`, `agronomic-policy-compilation`, `scientific-compiler`, `applicability`, `synthesis-engine`, `conflict-engine`, `deployment`, `runtime-profile`, `runtime-plan`, `runtime-binding`, `runtime-eligibility`, `decision-problem`, `decision-result`, `decision-robustness`, `historical-decision-basis`, `implementation-registry`, `implementation-conformance`, `rights-authority`, `authorization`, `audit`, and `public-api`.

### 2.2 Founder attestation evidence
Founder attestation dated 2026-09-18:
- sole human developer;
- no employee/contractor/consultant/external contributor;
- no prior employer;
- no former-employer source;
- independent development;
- AI-associated author metadata originated from founder-controlled tooling/accounts.

## 3. CLASSIFICATION

```text
CURRENT_IP_HOLDER = FOUNDER
CORPORATE_ENTITY = NOT_YET_INCORPORATED
COMPANY_ASSIGNMENT_STATUS = NOT_YET_APPLICABLE

EXTERNAL_HUMAN_CONTRIBUTOR = NONE_IDENTIFIED
CONTRIBUTOR_ASSIGNMENT_GAP = NONE_IDENTIFIED_FOR_HISTORICAL_EXTERNAL_CONTRIBUTORS

GEOX_AUTHORSHIP_TRACEABILITY = STRONG_WITH_LIMITED_NON_EXHAUSTIVE_HISTORY_REVIEW
ADR_AUTHORSHIP_TRACEABILITY = STRONG_FULL_MAIN_HISTORY_REVIEW

AI_ASSISTED_CODE = IDENTIFIED
AI_ASSISTED_CODE_CONTROL = FOUNDER_CONTROLLED
INDEPENDENT_AI_HUMAN_CONTRIBUTOR = NO

INTERNAL_GENERATED_CODE = TRACEABLE_FOR_IDENTIFIED_JUDGE_GENERATION_CHAIN

REPOSITORY_VISIBILITY = PUBLIC
REPOSITORY_LEVEL_LICENSE = NONE_DETECTED

THIRD_PARTY_COPIED_SOURCE = NONE_KNOWN_BY_FOUNDER_ATTESTATION
THIRD_PARTY_DEPENDENCY_LICENSE_CLEARANCE = OUT_OF_SCOPE_FOR_THIS ARTIFACT
```

## 4. ASSET MAP

| Asset ID | Repository | Component / Path | Asset class | Current IP holder | AI-assisted status | External human contributor | Assignment status |
|---|---|---|---|---|---|---|---|
| G-01 | GEOX | `apps/server/src/**` | Core service platform | Founder | Mixed / not globally classified | None identified | Founder→Company pending incorporation |
| G-02 | GEOX | `apps/server/src/domain/twin_kernel/**`, `domain/twin_runtime/**`, `runtime/twin_runtime/**`, `docs/digital_twin/**` | Digital twin / MCFT | Founder | Includes identified AI-assisted cohort in MCFT history | None identified | Founder→Company pending incorporation |
| G-03 | GEOX | `domain/decision/**`, `domain/approval/**`, `domain/controlplane/**` | Decision and approval governance | Founder | Not globally classified | None identified | Founder→Company pending incorporation |
| G-04 | GEOX | `domain/execution/**`, `domain/operations/**`, `apps/executor/**` | Execution and accountability | Founder | Not globally classified | None identified | Founder→Company pending incorporation |
| G-05 | GEOX | `apps/telemetry-ingest/**`, `domain/sensing/**`, `domain/field/**` | Field sensing and state ingestion | Founder | Not globally classified | None identified | Founder→Company pending incorporation |
| G-06 | GEOX | `domain/agronomy/**`, `domain/soil_water/**`, `domain/fertilization/**`, `packages/agronomy-skills/**`, `packages/crop-skills/**` | Agronomic implementation | Founder | Not globally classified | None identified | Founder→Company pending incorporation |
| G-07 | GEOX | `packages/control-kernel/**`, `packages/control-constitution-validator/**`, `packages/guardrails/**` | Control and governance | Founder | Not globally classified | None identified | Founder→Company pending incorporation |
| G-08 | GEOX | `apps/web/**`, `apps/server/src/product_projection/**` | Product surface and projection | Founder | Includes internal generated artifacts | None identified | Founder→Company pending incorporation |
| G-09 | GEOX | `packages/contracts/**`, `apps/server/src/contracts/**` | Shared contracts | Founder | Not globally classified | None identified | Founder→Company pending incorporation |
| G-10 | GEOX | `apps/server/src/integrations/adr/**`, ADR adoption scripts/config | ADR integration | Founder | Not globally classified | None identified | Founder→Company pending incorporation |
| A-01 | ADR | `packages/source-registry/**`, `packages/provenance/**`, `packages/knowledge-registry/**`, `packages/knowledge-release/**` | Knowledge provenance | Founder | Not globally classified | None identified | Founder→Company pending incorporation |
| A-02 | ADR | `packages/context-contract/**`, `packages/context-manifest/**`, `packages/reference-resolution/**` | Context semantics | Founder | Not globally classified | None identified | Founder→Company pending incorporation |
| A-03 | ADR | `packages/agronomic-policy-compilation/**`, `packages/scientific-compiler/**`, `packages/applicability/**` | Agronomic compilation/applicability | Founder | Not globally classified | None identified | Founder→Company pending incorporation |
| A-04 | ADR | `packages/synthesis-engine/**`, `packages/conflict-engine/**`, `packages/knowledge-retrieval/**` | Knowledge synthesis | Founder | Not globally classified | None identified | Founder→Company pending incorporation |
| A-05 | ADR | `packages/deployment/**`, `packages/runtime-profile/**`, `packages/runtime-plan/**`, `packages/runtime-binding/**`, `packages/runtime-eligibility/**`, `packages/runtime-results/**` | Runtime/deployment | Founder | Not globally classified | None identified | Founder→Company pending incorporation |
| A-06 | ADR | `packages/decision-problem/**`, `packages/decision-result/**`, `packages/decision-robustness/**`, `packages/historical-decision-basis/**` | Decision semantics/history | Founder | Not globally classified | None identified | Founder→Company pending incorporation |
| A-07 | ADR | `packages/implementation-registry/**`, `packages/implementation-conformance/**`, `packages/implementation-broker/**` | Implementation governance | Founder | Not globally classified | None identified | Founder→Company pending incorporation |
| A-08 | ADR | `packages/rights-authority/**`, `packages/authorization/**`, `packages/audit/**`, `packages/security-operations/**` | Rights/audit/security | Founder | Not globally classified | None identified | Founder→Company pending incorporation |
| A-09 | ADR | `packages/public-api/**`, `sdks/typescript/**`, `adapters/geox/**`, `adapters/reference-field-platform/**` | API/SDK/integration | Founder | Not globally classified | None identified | Founder→Company pending incorporation |

## 5. OPEN ISSUE

Open source-code IP rights issues are maintained in `OPEN-RIGHTS-ISSUES.md`.

No historical external-human contributor assignment gap is currently identified.

## 6. REQUIRED ACTION

1. Upon incorporation, execute a written Founder → Company assignment covering all pre-incorporation GEOX and Agronomy Deployment Runtime source code, architecture, contracts, schemas, tests, workflows, SDKs, adapters, documentation, inventions, improvements, derivative works, and related technical assets.
2. Preserve the identified AI-assisted commit cohort and attach applicable AI-service terms/account evidence where reasonably available.
3. Make a deliberate repository visibility and licensing policy decision before representing the codebase as open source, source-available, proprietary public-source, or trade-secret protected.
4. Complete the separate Dependency Software Bill of Materials and license review before treating third-party dependency rights as cleared.
5. Require written IP assignment terms before any future employee, contractor, or other human contributor is granted contribution access.
