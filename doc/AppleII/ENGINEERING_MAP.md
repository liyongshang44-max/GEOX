# 🍎 Apple II · Judge — Engineering Map (FROZEN)

This file maps constitutional documents to concrete code responsibilities.

## Core Judge Engine
- Pipeline orchestration → doc/AppleII/GEOX-AII-02.md → apps/judge/src/pipeline.ts
- Deterministic logic rules → doc/AppleII/GEOX-AII-04.md → apps/judge/src/rules/

## Canonical Objects
- ProblemStateV1 → doc/AppleII/GEOX-AII-01.md → packages/contracts/problem_state_v1.schema.json
- ReferenceViewV1 → doc/AppleII/GEOX-AII-03.md → packages/contracts/reference_view_v1.schema.json
- LBCandidateV1 → doc/AppleII/GEOX-AII-05.md → packages/contracts/lb_candidate_v1.schema.json
- AO-SENSE → doc/AppleII/GEOX-AII-00-APP-A.md → packages/contracts/ao_sense_v1.schema.json

## Runtime / API
- Runtime semantics & persistence → doc/AppleII/GEOX-AII-06.md → apps/judge/src/runtime.ts / apps/judge/src/store/
- HTTP API → apps/judge/src/routes.ts

## Acceptance Checklist
- Silent-by-default verified
- One ProblemState per window
- Determinism tests pass
- Append-only storage enforced (run_id)
- Step1 hooks always present
- No forbidden decision vocabulary present

## Simulator Runtime Ownership (Single Implementation)
- 唯一实现：后端 simulator runner 维护运行态并写入 telemetry（不得由前端本地定时伪造）。
- Frontend 仅允许调用 start/stop/status API，不承担 telemetry 生成职责。
- 运行实例锁按 `(tenant_id, device_id)` 约束，防止重复启动多套循环。
