# Judge ruleset (SSOT)

This repo uses **config/judge/default.json** as the **Single Source of Truth**. `config/judge/ruleset_v1.json` is retained only as a legacy compatibility snapshot and is not an active runtime or generator authority source.

Generated artifacts:
- `apps/judge/src/generated/ruleset.ts`
- `apps/web/src/generated/judge_ruleset.schema.json`

## Key semantics

### C-2: Exclusion markers affect coverage by **removing time** (not QC)
Marker kinds in `marker.exclusion_kinds` are treated as **excluded minutes** for coverage and gap calculations.

### C-3: missing-origin raw is **no evidence**
Raw samples with quality in `evidence.raw_sample.missing_origin_quality_values` are excluded from:
`sufficiency, coverage, qc`

They are not "bad evidence" — they mean "no evidence".
