# Open Rights Issues

Date: 2026-09-18
Status: ACTIVE REGISTER
Scope: Source-code IP rights issues identified by Source Code IP Map V1

## OR-001 — Founder → Company pre-incorporation IP assignment

### FACT
No company entity has yet been incorporated.

### EVIDENCE
Founder attestation dated 2026-09-18.
Source Code IP Map V1.

### CLASSIFICATION
```text
CURRENT_IP_HOLDER = FOUNDER
COMPANY_ASSIGNMENT_STATUS = NOT_YET_APPLICABLE
STATUS = BLOCKED_BY_NOT_YET_INCORPORATED
```

### OPEN ISSUE
The future company cannot presently hold the pre-incorporation source-code IP because the legal entity does not yet exist.

### REQUIRED ACTION
At or immediately after incorporation, execute a written Founder → Company assignment covering all pre-incorporation GEOX and Agronomy Deployment Runtime source code, architecture, contracts, schemas, tests, workflows, SDKs, adapters, documentation, inventions, improvements, derivative works, and related technical assets.

---

## OR-002 — Repository visibility and licensing posture

### FACT
Both repositories are public.
GitHub repository metadata reports no repository-level license for either repository at the evidence date.
No root `LICENSE` file was identified in the reviewed repository roots.

### EVIDENCE
- `liyongshang44-max/GEOX`
- `liyongshang44-max/agronomy-deployment-runtime`
- repository metadata reviewed 2026-09-18

### CLASSIFICATION
```text
VISIBILITY = PUBLIC
REPOSITORY_LEVEL_LICENSE = NONE_DETECTED
STATUS = OPEN_POLICY_DECISION
```

### OPEN ISSUE
The intended long-term licensing and source-availability posture has not been formally recorded in this diligence package.

### REQUIRED ACTION
Before making an external licensing representation, formally select and document the intended posture, including whether components remain proprietary public-source, become private proprietary source, are selectively open sourced, or use another deliberate licensing structure. Do not add a permissive open-source license as a housekeeping action.

---

## OR-003 — AI-assisted development evidence archive

### FACT
Five GEOX commits contain `OpenAI GEOX Engineer` author metadata and founder-controlled committer metadata.
Founder attestation classifies the cohort as founder-controlled use of Codex/OpenAI tooling or alternate founder-controlled accounts, with no independent external human developer.

### EVIDENCE
See `AI-ASSISTED-CODE-PROVENANCE-V1.md`.

### CLASSIFICATION
```text
AI_ASSISTED = YES
FOUNDER_CONTROLLED = YES
EXTERNAL_HUMAN_CONTRIBUTOR = NO
STATUS = OPEN_DOCUMENTATION
```

### OPEN ISSUE
Applicable AI-service terms/account evidence has not yet been archived with the diligence package.

### REQUIRED ACTION
Archive the applicable terms and available account/tool provenance for the relevant development period where reasonably obtainable.

---

## Closed / not-open items

The following are not currently open historical contributor-assignment issues:

```text
EXTERNAL_EMPLOYEE_CONTRIBUTOR = NONE_IDENTIFIED
EXTERNAL_CONTRACTOR_CONTRIBUTOR = NONE_IDENTIFIED
EXTERNAL_CONSULTANT_CONTRIBUTOR = NONE_IDENTIFIED
FORMER_EMPLOYER_SOURCE_CODE = NONE_REPORTED
HISTORICAL_THIRD_PARTY_HUMAN_ASSIGNMENT_GAP = NONE_IDENTIFIED
```

Third-party dependency license clearance is intentionally excluded from this register until completion of the separate Dependency Software Bill of Materials.
