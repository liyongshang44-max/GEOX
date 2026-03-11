# GEOX Environment Boundaries v1

## Purpose
This document defines the minimum environment boundary for GEOX delivery so that `dev`, `staging`, and `prod` do not share runtime identity, secrets, or evidence storage paths.

## Scope
This is a minimum delivery governance document. It does not introduce new runtime features. It defines repository-level expectations for configuration layout, token separation, export path separation, and deployment naming.

## Required environment layout
The repository keeps environment-specific delivery placeholders under:

- `config/environments/dev/`
- `config/environments/staging/`
- `config/environments/prod/`

Each environment directory must carry its own token SSOT example and must never point to another environment's live secret file.

## Token and secret boundary
Each environment must maintain an independent AO-ACT token source of truth.

- `dev` uses only dev tokens
- `staging` uses only staging tokens
- `prod` uses only prod tokens

Rules:

1. Do not copy a live token file from one environment into another.
2. Do not reuse the same bearer token across `dev`, `staging`, and `prod`.
3. Only example files may be committed into git.
4. Real secret material must be injected outside git.

## Export and evidence path boundary
Each environment must use an isolated evidence export root.

Recommended examples:

- `dev`: `./runtime/dev/evidence`
- `staging`: `./runtime/staging/evidence`
- `prod`: `./runtime/prod/evidence`

Rules:

1. `prod` exports must never be written into a `dev` or `staging` path.
2. Backup jobs must read from the matching environment path only.
3. Restore jobs must target the intended environment only.

## Database and compose boundary
Each environment must have independent runtime naming and database binding.

Recommended examples:

- Compose project names: `geox-dev`, `geox-staging`, `geox-prod`
- Database names: `geox_dev`, `geox_staging`, `geox_prod`
- Container names and volumes should also be environment-specific.

## Minimum delivery files
The following repository-visible files are required for minimum environment governance:

- `config/environments/dev/ao_act_tokens_v0.example.json`
- `config/environments/staging/ao_act_tokens_v0.example.json`
- `config/environments/prod/ao_act_tokens_v0.example.json`

These files are placeholders only. They document the intended shape and ownership boundary. They are not live credentials.

## Deployment checklist
Before handing over an environment:

1. Confirm compose project name is environment-specific.
2. Confirm Postgres database name is environment-specific.
3. Confirm AO-ACT token source is environment-specific.
4. Confirm evidence export path is environment-specific.
5. Confirm backup target path is environment-specific.
6. Confirm restore target environment is explicitly named.
7. Confirm acceptance is run against the intended environment only.

## Acceptance linkage
This delivery artifact is validated by `acceptance/sprintEnv1/ACCEPTANCE_sprintEnv1_environment_boundaries.ps1`.
