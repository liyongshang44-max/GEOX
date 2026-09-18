# AI-Assisted Code Provenance V1

Date: 2026-09-18
Status: ACTIVE EVIDENCE ARTIFACT
Repository: `liyongshang44-max/GEOX`
Baseline main: `f7d28aef3d2fe8e65ce0afff64e6f2673c2eb39b`

## 1. FACT

Five commits dated 2026-07-17 contain:

```text
author = OpenAI GEOX Engineer <openai-geox@users.noreply.github.com>
committer = founder-controlled identity using liyongshang44@gmail.com
```

Founder attestation dated 2026-09-18 states:
- these commits resulted from founder-controlled use of Codex/OpenAI tooling or alternate founder-controlled accounts;
- alternate accounts could be used when primary-account usage limits were exhausted;
- no independent external human developer was involved.

## 2. EVIDENCE

### AI-001
Commit: `ff336875c590482a740f14b9a76113826f9f4a2b`
Message: `MCFT-CAP-06: freeze S5 Candidate authority graph`

Files:
- `docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-CANDIDATE-AUTHORITY-GRAPH.json`
- `docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-CANDIDATE-IMPLEMENTATION-CONTRACT.json`

### AI-002
Commit: `16dd6785967094edf325bfea8345d98deadb9152`
Message: `MCFT-CAP-06: compose Candidate replay and commit`

Files:
- `apps/server/src/runtime/calibration/calibration_candidate_service_v1.ts`
- `apps/server/src/runtime/calibration/resolved_forecast_replay_prediction_adapter_v1.ts`

### AI-003
Commit: `8e0f5564ce83e60c44e64166a12a1d63d4c31a12`
Message: `MCFT-CAP-06: prove Candidate domain orchestration`

Files:
- `scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_CANDIDATE.ts`
- `scripts/runtime_acceptance/mcft_cap_06_s5_candidate_fixture_v1.ts`

### AI-004
Commit: `a801a2eaad6396db6ea013af12c82012d8c31e98`
Message: `MCFT-CAP-06: prove Candidate PostgreSQL commit`

Files:
- `apps/server/scripts/mcft/MCFT_CAP_06_CALIBRATION_SHADOW_RUNNER.ts`
- `scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_CANDIDATE_DB.ts`

### AI-005
Commit: `d6085d0721b519f6a57971600f32b4fa89d15f97`
Message: `MCFT-CAP-06: enforce structured S5 Candidate preflight`

Files:
- `.github/workflows/mcft-cap-06-s5-candidate.yml`
- `docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-CANDIDATE-STATUS.json`
- `scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_CANDIDATE.cjs`
- `scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_CANDIDATE.ts`
- `scripts/runtime_acceptance/RUN_MCFT_CAP_06_S5_CANDIDATE.cjs`

## 3. CLASSIFICATION

```text
COHORT_ID = IP-COHORT-AI-001
AI_ASSISTED = YES
FOUNDER_CONTROLLED = YES
INDEPENDENT_EXTERNAL_HUMAN_CONTRIBUTOR = NO
THIRD_PARTY_COPIED_SOURCE = NOT_ESTABLISHED
CURRENT_IP_HOLDER = FOUNDER
COMPANY_ASSIGNMENT_STATUS = PENDING_INCORPORATION
```

No representation is made in this artifact that an AI service provider is a human code contributor.

## 4. OPEN ISSUE

```text
AI-OR-001
issue = applicable AI service terms/account evidence has not yet been archived with this diligence package
status = OPEN_DOCUMENTATION
```

## 5. REQUIRED ACTION

1. Preserve these exact commits and their Git metadata; do not rewrite history solely to remove AI-associated author metadata.
2. Archive the applicable AI-service terms and account/tool provenance available for the relevant development period where reasonably obtainable.
3. Include this cohort in the Founder → Company pre-incorporation IP assignment schedule after incorporation.
4. Require a documented AI-assisted development policy before additional human contributors are granted repository access.
