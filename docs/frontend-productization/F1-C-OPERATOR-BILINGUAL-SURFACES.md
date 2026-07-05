<!-- docs/frontend-productization/F1-C-OPERATOR-BILINGUAL-SURFACES.md -->
# F1-C Operator Formal Surface Bilingualization

## Phase

F1-C Operator Formal Surface Bilingualization follows F1-B Shell / Navigation Bilingual Integration.

F1-C only covers Operator formal surfaces.

F1-C does not cover Customer or Admin.

## Purpose

F1-C bilingualizes visible Operator product copy while preserving raw/source traceability values.

```text
Operator formal surface copy is bilingual, while traceability/source values remain raw and unchanged.
```

## Preconditions

F1-B must already provide:

```text
Customer / Operator / Admin formal shells have visible LocaleToggle.
Operator shell nav labels are bilingual.
Operator shell title / lead / nonclaims are bilingual.
F1-B acceptance passes.
```

F1-C does not connect LocaleToggle to shells. F1-C only consumes the existing locale infrastructure.

## Allowed files

```text
apps/web/src/features/operator/pages/OperatorTwinOverviewPage.tsx
apps/web/src/features/operator/pages/OperatorGatewayDemoViewerPage.tsx
apps/web/src/features/operator/fieldRuntime/
apps/web/src/features/operator/replayDemo/
apps/web/src/features/operator/pilotReadiness/
apps/web/src/styles/operatorFieldRuntime.css
apps/web/src/styles/operatorReplayDemo.css
apps/web/src/styles/operatorPilotReadiness.css
apps/web/src/lib/productSurfaceLabels.ts
scripts/frontend_acceptance/ACCEPTANCE_F1_C_OPERATOR_BILINGUAL_SURFACES_V1.cjs
scripts/frontend_acceptance/ACCEPTANCE_F1_B_SHELL_BILINGUAL_INTEGRATION_V1.cjs
docs/frontend-productization/F1-C-OPERATOR-BILINGUAL-SURFACES.md
```

The F1-B acceptance file is allowed only as an integration acceptance carry-forward repair. F1-C is stacked on F1-B in the same integration branch, and the required local command sequence still runs the F1-B acceptance after F1-C is added. That script must therefore validate the accepted F1-B slice instead of scanning the whole current HEAD.

## Forbidden files

```text
apps/web/src/app/App.tsx
apps/web/src/app/routes/
apps/web/src/layouts/
apps/web/src/features/customer/
apps/web/src/features/admin/
apps/web/src/views/
apps/server/
migrations/
packages/contracts/
fixtures/
.github/
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
```

F1-C forbids route topology changes, backend calls, package dependencies, and Customer/Admin page changes.

## Operator surface scope

```text
/operator/twin
/operator/fields/*
/operator/twin/gateway-demo
/operator/pilot
```

Surface names:

```text
Operator Runtime Overview
Field Runtime
Replay-backed Gateway Demo
Pilot Readiness
```

## Operator Runtime Overview bilingual scope

F1-C covers overview page hero, overview section titles, overview boundary copy, overview nonclaim copy, overview empty / unavailable copy, and overview helper text.

Required bilingual copy includes:

```text
Runtime Overview
Runtime status
Evidence coverage
Replay-backed boundary
Read-only runtime review
运行总览
运行状态
证据覆盖
回放支撑边界
只读运行审查
```

Backend-returned field state text, risk text, confidence text, field IDs, evidence refs, trace refs, hashes, and route paths remain raw/source values.

## Field Runtime bilingual scope

F1-C covers Field Runtime header, Field Runtime tab labels, Field Runtime boundary copy, Field Runtime nonclaims, Field Runtime empty state, Field Runtime unavailable state, Field Runtime loading state, Field Runtime read-only copy, and Field Runtime traceability helper copy.

Required tab labels:

```text
Fields
Overview
Evidence
State
Forecast
Scenario
Residual
Calibration
Health
Audit
地块
总览
证据
状态
预测
情景
残差
校准
健康
审计
```

Required boundary copy:

```text
Read-only
No runtime mutation
No external command
No model state mutation
No value ledger mutation
No long-term field record mutation
只读
不修改运行状态
不下发外部命令
不修改模型状态
不写入价值台账
不写入长期地块记录
```

Required nonclaims include live/replay denial:

```text
Live Device: Not connected
Production Gateway: Not online
Field Pilot: Not started
Controlled Execution: Disabled
实时设备：未连接
生产网关：未上线
田间试点：未开始
受控执行：已禁用
```

## Replay Demo bilingual scope

F1-C covers Replay Demo hero, Replay Demo boundary banner, Replay Demo nonclaims, Replay Demo snapshot labels, Replay Demo gateway path labels, Replay Demo device evidence labels, Replay Demo standards mapping labels, Replay Demo duplicate / clock skew / ingestion window labels, and Replay Demo traceability labels.

Required bilingual copy includes:

```text
Replay-backed Gateway Demo
Replay-backed Gateway Snapshot
Replay-backed demo
not a live device connection
Production Gateway: Not online
Field Pilot: Not started
AO-ACT Dispatch: Disabled
Snapshot
Gateway path
Device evidence
Standards mapping
Traceability
回放支撑网关演示
回放支撑网关快照
回放支撑演示
不是实时设备连接
生产网关：未上线
田间试点：未开始
AO-ACT 派发：已禁用
快照
网关路径
设备证据
标准映射
可追溯性
```

Snapshot IDs, device identifiers, source refs, trace refs, hashes, commit SHAs, and acceptance script names remain raw/source values.

## Pilot Readiness bilingual scope

F1-C covers Pilot Readiness hero, Pilot Readiness gate labels, Pilot Readiness boundary copy, Pilot Readiness nonclaims, Pilot Readiness role labels, Pilot Readiness safety / stop-rule labels, Pilot Readiness readiness status labels, and Pilot Readiness limitation copy.

Required bilingual copy includes:

```text
Pilot Readiness
readiness gate
planning gate
safety
stop rules
human role
rollback
not field execution
Field Pilot: Not started
AO-ACT Dispatch: Disabled
试点准备度
准备度门禁
规划门禁
安全
停止规则
人员角色
回滚
不是田间执行
田间试点：未开始
AO-ACT 派发：已禁用
```

F1-C preserves the current boundary:

```text
pilot has not started
field execution has not started
real devices are not claimed deployed
AO-ACT task is not created
dispatch is not enabled
ROI is not computed
Field Memory is not learned
```

## Raw/source text boundary

F1-C must not translate:

```text
route paths
source identifiers
fact IDs
trace IDs
decision cycle IDs
tenant IDs
project IDs
group IDs
field IDs
device IDs
commit hashes
determinism hashes
acceptance script names
raw evidence payload
raw source labels
contract kind
API field names
enum values
backend-returned domain object values
```

These values are part of traceability, replay, audit, source identity, or contract semantics. Translating them would damage evidence integrity.

## Nonclaim translation boundary

F1-C must preserve negative production claims in both languages.

Allowed negative statements include:

```text
not connected
not online
not started
disabled
does not dispatch
does not compute ROI
does not write Field Memory
未连接
未上线
未开始
已禁用
不派发
不计算 ROI
不写入 Field Memory
```

F1-C must not claim live device connection, production gateway online, field pilot execution, AO-ACT dispatch, ROI computation, or Field Memory learning.

## Engineering phase label guard

Visible formal product copy must not expose engineering phase labels such as:

```text
H58 H59 H60 H61 H62 H63 H64 H65 H66 H67
F0 F1
P51 P52 P53 P54 P55 P56 P57
TK
fixture
acceptance
```

Exceptions:

```text
comments
data attributes
acceptance script filenames
docs explaining historical source/raw values
raw/source text register
```

## Acceptance

```text
node scripts/frontend_acceptance/ACCEPTANCE_F1_B_SHELL_BILINGUAL_INTEGRATION_V1.cjs
node scripts/frontend_acceptance/ACCEPTANCE_F1_C_OPERATOR_BILINGUAL_SURFACES_V1.cjs
pnpm run typecheck:web
pnpm run build:web
git status --short
```

Acceptance is static repo read-only. It does not start the app, call backend, call DB, write facts, or mutate source.

Because F1-C is stacked on accepted F1-B, F1-C changed-file validation uses the accepted F1-B head as its diff base:

```text
9f929ed34beb95d9603b30bdc84fbfc30f6b97cd
```

F1-B acceptance validation uses the accepted F1-B slice:

```text
6e16784fced8f7cae1b7cd37b49c6f7bd9d51495...9f929ed34beb95d9603b30bdc84fbfc30f6b97cd
```

## Non-goals

F1-C does not cover Customer or Admin.
F1-C does not translate raw evidence or identifiers.
F1-C does not translate backend-returned domain values.
F1-C does not change route topology.
F1-C does not change runtime semantics.
F1-C does not claim live runtime readiness.
F1-C does not claim live device connection.
F1-C does not claim production gateway online.
F1-C does not claim field pilot execution.
F1-C does not enable AO-ACT dispatch.
F1-C does not compute ROI.
F1-C does not write Field Memory.

## Next phase

F1-C prepares F1-D Customer / Admin Formal Surface Bilingualization.

F1-D may cover Customer formal page-level copy, Customer report shell-visible static copy, Admin formal page-level copy, and Admin dashboard/evidence/health static copy.
