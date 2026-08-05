# GEOX MCFT-CAP-09 Continuation Handoff — S2 Database Evidence Candidate

更新时间：2026-08-06 01:05（UTC+8）

## 0. 文档定位与合并顺序警告

本文档交接当前 `MCFT-CAP-09 / Stage 1B Shadow-online Closure` 后端、Runtime 与治理主线。

当前准确阶段：

```text
S0 Authorization                    EFFECTIVE
S1 Adapter Contracts / Config       EFFECTIVE
S2 Database Evidence Ingress        CANDIDATE FULLY GREEN, NOT MERGED
S2 external effectiveness           false
S3 Registry registration            not authorized yet
```

**重要：本 handoff 文档更新必须保持独立 `1 commit / 1 file`，且不得先于 PR #2882 合并。**

原因：

```text
#2882 exact base
b3f095be7f808611f1388c3e31ecff29325a7f99
```

任何先进入 protected `main` 的提交——包括纯文档 handoff 提交——都会推进 `main`，使 #2882 的 exact-base Candidate 失效。正确顺序是：

```text
1. 先处理 #2882：最终核验并合并，或明确关闭
2. 若 #2882 合并，再刷新本 handoff 的“当前停点”
3. 最后合并 handoff 文档 PR
```

本 handoff PR 可以先创建，但应保持 Draft / blocked，禁止抢在 #2882 前合并。

---

## 1. 当前 authoritative baseline

```text
repository
liyongshang44-max/GEOX

protected main
b3f095be7f808611f1388c3e31ecff29325a7f99

main source PR
#2881 MCFT-CAP-09 S2: repair registration-to-Candidate routing

#2881 head
158f0c36468bfc869aa185e4cfe7d89fdbc1a35e

#2881 tree
9971f2f6923e84d902b6ed1dd5585d4bf07462bd

#2881 merge SHA / current main
b3f095be7f808611f1388c3e31ecff29325a7f99

#2881 boundary
1 commit / 3 files
```

当前 active Candidate：

```text
PR
#2882 MCFT-CAP-09 S2: implement bounded Database Evidence ingress r2

state
OPEN

mergeability
MERGEABLE

base
b3f095be7f808611f1388c3e31ecff29325a7f99

head
a003770454e45bcb3ea08b39de57170348eca993

tree
7eb9187e2e74b03be7993117cf548998cdfebfa5

compare
ahead 1 / behind 0 / total commits 1

boundary
1 commit / 10 files
```

旧 PR #2880 已关闭且未合并。其 head 永久不可复用，不得 reopen、rebase 或追加提交后重新声明为有效 Candidate。

---

## 2. 我们正在做什么

MCFT-CAP-09 的目标是把 CAP-08 已成立的 Replay-backed Twin closure 推进为受治理的 Stage 1B Shadow-online closure。

当前 S2 的唯一目标是：

```text
从既有 governed PostgreSQL facts SSOT
只读选择 Evidence
在明确的 hourly logical boundary 冻结 eligible Evidence
输出 selected / excluded / coverage / freshness / maximum gap
```

S2 不是完整 Shadow-online Runtime。它不包含：

```text
scheduler loop
persistent cursor / lease implementation
automatic slot execution
canonical Runtime write
production wiring
public HTTP writer
live device gateway
Recommendation / Approval / AO-ACT write
Model Activation
controlled real-world action
```

当前总体完成度估算：

```text
MCFT-CAP-09 overall
约 49%

remaining
约 51%
```

该比例按治理与运行闭环复杂度估算，不按文件数估算。

---

## 3. 已完成的 authoritative chain

### 3.1 MCFT-CAP-08 predecessor 已正式关闭

CAP-08 仍是 CAP-09 的正式 predecessor authority：

```text
completion subject
67bd71560268046a7fa9a9433ee074ad3999cb71

exact-SHA / R2 run
30908130962

artifact
8891897316

semantic artifact digest
sha256:7e9d713631443641f17c06f71c494319c5f442424ba9ec9f426731940d2700f9

Hard Acceptance
24 / 24 EFFECTIVE

retention
R2 / 730 days
```

CAP-08 只证明 Replay-backed closure；不自动授权 CAP-09 Shadow-online Runtime。

### 3.2 CAP-09 S0 Authorization 已 effective

```text
S0 subject / merge SHA
7381d0f8ac56fe9f75fd78ce189920cb9ed99bf4

S0 exact-SHA / R2 run
30978738965

S0 artifact
8919296741

S0 semantic artifact digest
sha256:f2706d9cf3e001a1085d1c0b7db4f4200732605f9a6bad4a80d9ba3065346228

candidate-to-merge tree delta
0

R2 readback
PASS

locked-version delete denial
PASS
```

S0 effectiveness 只授权 S1 Candidate Declaration 的接口与配置冻结范围；没有授权 Runtime implementation。

### 3.3 CAP-09 S1 Adapter Contracts / Configuration 已 effective

S1 Candidate：

```text
PR
#2874

base
1ec6f2dc0ae00716412b00c197f7f36a8be8b516

head
0e835d90f435f3bd0c50edcbae67e02187f0bbdc

tree
af5a270d01f1f49af50f76db0eda8f79f031c35a

merge subject
843ed078d6d384e43e2c6bd2568d789dcd508934

boundary
1 commit / 11 files
```

S1 冻结了五类纯接口：

```text
ClockPortV1
EvidenceIngressPortV1
SchedulerPortV1
ExecutionFeedbackPortV1
AvailabilityPortV1
```

同时冻结：

```text
O00 ... O23
PT1H
single governed six-key scope
observed_at / ingested_at / available_to_runtime_at boundary
single-scope sequential lease / fencing semantics
read-only execution feedback
restart / backfill / stale / lag contract
```

S1 effectiveness：

```text
subject
843ed078d6d384e43e2c6bd2568d789dcd508934

R2 run
31007579256

artifact
8930987741

GitHub artifact digest
sha256:28e2fcbe5571799f06a960fd9c5ff676b5f808ecb48825b608810fa218f5d42d

semantic artifact digest
sha256:0f67da5732f43a427d2518e320a617f3ad3872c6c34065060e432d92128404ef

retention
R2 / 730 days

retain until
2028-08-04T12:53:03.321Z

readback verified
true

locked version delete denied
true
```

S1 effectiveness 的第一合法下一步是 S2 Registry registration；并未直接授权 S2 Candidate 或实现。

### 3.4 S2 Registry registration 已完成

```text
PR
#2879

merge SHA
508da08b2c5855e6391bc87e0d56042fc9232a97
```

该步骤：

```text
注册 S2 status path
注册 s2_candidate_implemented transition
绑定 S1 effective subject / R2 artifact
Candidate transition false
Runtime source delta 0
migration delta 0
```

S2 Candidate 只有在该 registration 进入 protected main 后才合法。

### 3.5 S2 registration-to-Candidate lifecycle repair 已完成

旧 #2880 证明：S2 Registry workflow 能处理 registration，但会把合法 10 文件 S2 Candidate 错误路由到 6 文件 registration validator。

#2881 关闭了该缺口：

```text
PR
#2881

repair merge SHA
b3f095be7f808611f1388c3e31ecff29325a7f99

boundary
1 commit / 3 files
```

修复后以下三条 Registry / lifecycle 路径都能正确区分：

```text
S2 lifecycle repair
S2 Registry registration
S2 Candidate signal
```

修复语义：

```text
exact 3-file repair boundary
exact 6-file registration boundary
exact 10-file Candidate boundary
unsupported boundary remains fail-closed
trusted Registry lane preserved
S1 Registry lane preserved
S2 Registry lane corrected
```

---

## 4. S2 Candidate #2882 已实现的内容

### 4.1 Exact Candidate identity

```text
base
b3f095be7f808611f1388c3e31ecff29325a7f99

head
a003770454e45bcb3ea08b39de57170348eca993

tree
7eb9187e2e74b03be7993117cf548998cdfebfa5

commits
1

files
10

behind main
0
```

### 4.2 Exact 10-file boundary

```text
.github/workflows/mcft-cap-09-s2-database-evidence-ingress.yml

apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CANDIDATE-BOUNDARY-V1.json

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CANDIDATE-V1.json

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CONFIG-V1.json

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-HARD-ACCEPTANCE-EVIDENCE-V1.json

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json

scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS.cjs

scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS.ts
```

### 4.3 Adapter boundary

S2 实现了一个只读 PostgreSQL `EvidenceIngressPortV1` adapter：

```text
source table
facts

query mode
read-only PostgreSQL

database writes
none

DDL / migration
none

scope
exact tenant_id / project_id / group_id / field_id / season_id / zone_id

boundary fields
observed_at
ingested_at
available_to_runtime_at

future Evidence
excluded

late / post-boundary Evidence
excluded

quality-ineligible Evidence
excluded

scope mismatch
excluded

duplicate Evidence
deterministic supersession

coverage ratio
emitted

freshness
emitted

maximum gap
emitted
```

Duplicate deterministic winner policy：

```text
latest ingested_at
then deterministic stable identity / ordering tie-break
```

S2 pure acceptance证明：

```text
selected Evidence
2

explicit exclusions
7

all configured exclusion classes
covered

repeated freeze
deterministic

future Evidence leakage
0

SQL write / DDL verbs
absent
```

### 4.4 明确 nonclaims

```text
external effectiveness         false
production activation          false
production wiring              absent
scheduler loop                 absent
persistent cursor              absent
lease implementation           absent
canonical Runtime write        absent
database migration             absent
database ACL delta             0
public HTTP writer             absent
live device gateway            absent
Recommendation write           absent
Approval write                 absent
AO-ACT write                   absent
Model Activation               false
controlled action              false
frontend / PFE-14 delta         0
```

---

## 5. #2882 已通过的完整检查

截至本 handoff 更新时间，#2882 不再处于 acceptance 运行中；完整矩阵已经结束并全部成功。

Workflow runs：

```text
mcft-candidate-declaration-selftest-v2
run 31022992869
SUCCESS

ci
run 31022990581
SUCCESS

mcft-cap-08-authority-reconciliation
run 31022989088
SUCCESS

mcft-cap-09-s2-database-evidence-ingress
run 31022989104
SUCCESS

mcft-main-ruleset-readiness-v1
run 31022989047
SUCCESS

mcft-cap-09-trusted-registry-bootstrap
run 31022989141
SUCCESS

mcft-cap-09-s1-registry-registration
run 31022989502
SUCCESS

mcft-cap-09-s2-registry-registration
run 31022989082
SUCCESS

mcft-release-lane-v1
run 31022989119
SUCCESS

mcft-delivery-policy-v2
run 31022989027
SUCCESS
```

Focused S2：

```text
focused governance
PASS

S1 exact-SHA / R2 authority consumption
PASS

pure Database Evidence acceptance
PASS

server Runtime typecheck
PASS

structured result validation
PASS

focused artifact upload
PASS
```

Standard CI `build-test`：

```text
route dependency guard
PASS

route response ownership guard
PASS

PR-18I hotfix guard
PASS

typecheck
PASS

build
PASS

server selfcheck
PASS
```

Standard CI `acceptance`：

```text
commercial compose rendering
PASS

runtime dependencies startup
PASS

service readiness
PASS

PR18I formal-chain preflight
PASS

controlled pilot seed
PASS

C8 formal chain backend P0
PASS

Playwright Chromium install
PASS

frontend runtime page audit
PASS

Controlled Pilot strict release gate
PASS

Stage-1 fixture raw-sample gate
PASS

P1 smoke idempotency gate
PASS

customer-report wiring gate
PASS

customer-report boundary suite
PASS

full acceptance suite
PASS

runtime evidence collection
PASS

COMMERCIAL MVP0 release gate
PASS

runtime hygiene / artifact collection
PASS

artifact upload
PASS
```

---

## 6. 当前准确停点 / blocker

### 6.1 当前没有测试或技术 blocker

#2882 当前状态：

```text
OPEN
MERGEABLE
all triggered workflows SUCCESS
exact base unchanged
ahead 1
behind 0
```

当前剩余工作不是继续写 adapter，也不是修 CI。

当前只差：

```text
1. 再次确认 protected main 仍为 b3f095be...
2. 再次确认 PR head 仍为 a003770...
3. 再次确认 10 个 workflow 全部 SUCCESS
4. 使用 expected-head 保护合并 #2882
```

### 6.2 S2 尚未 effective

即使 #2882 merge 成功，也只能证明 Candidate 进入 protected main。

以下步骤完成前，禁止声称 S2 effective：

```text
candidate tree == merge tree
exact merged subject identification
focused artifact binding
standard CI binding
Declaration V2 semantic snapshot binding
exact-SHA attestation
R2 / minimum 730-day immutable retention
readback verification
locked-version delete denial
dedicated commit status success
```

### 6.3 S3 尚未授权

只有 S2 exact-SHA/R2 effectiveness 成立后，第一合法下一步才是：

```text
MCFT-CAP-09.S3 Registry registration
```

禁止直接开始 S3 implementation、scheduler loop 或 Candidate。

---

## 7. 下一步严格执行计划

### Step 1：合并前最终核验 #2882

重新读取：

```text
current main
PR state / mergeability
PR base
PR head
compare base...head
all workflow conclusions
```

必须同时成立：

```text
main == b3f095be7f808611f1388c3e31ecff29325a7f99
base == b3f095be7f808611f1388c3e31ecff29325a7f99
head == a003770454e45bcb3ea08b39de57170348eca993
ahead == 1
behind == 0
files == 10
all workflows == SUCCESS
```

若 main 被任何提交推进：

```text
不要 merge
不要 rebase 旧 Candidate
不要向旧 head 追加提交
关闭 #2882
从新 main 原子重建新的单提交 Candidate
```

### Step 2：使用 expected-head 保护合并

合并目标：

```text
PR
#2882

expected head
a003770454e45bcb3ea08b39de57170348eca993
```

不得使用管理员绕过 required checks。

### Step 3：验证 Candidate-to-merge identity

合并后记录：

```text
merge SHA
merge tree
merge parents
```

必须证明：

```text
candidate tree
7eb9187e2e74b03be7993117cf548998cdfebfa5

merge tree
必须完全相同

candidate-to-merge file delta
必须为 0
```

### Step 4：建立独立 S2 exact-SHA/R2 effectiveness control plane

沿用 S0 / S1 已验证模式，但 subject、Candidate、文件边界和 S2 authority 必须重新绑定。

Control plane 应保持独立、最小边界，不修改：

```text
S2 Candidate files
Registry
Taskbook
Runtime adapter
migration
frontend
```

Canonical attestation 必须绑定：

```text
S2 merge subject
#2882
Candidate head a003770...
Candidate tree 7eb9187e...
focused run 31022989104
standard CI run 31022990581
Declaration V2 snapshot
10-file boundary
```

R2 必须证明：

```text
730-day minimum retention
upload
readback
locked-version delete denial
semantic artifact digest
GitHub convenience artifact
dedicated commit status
```

### Step 5：只有 S2 effective 后注册 S3

先重新读取 Taskbook、Scope Contract、Registry 和 S2 effective artifact。

严格顺序：

```text
S2 effective
-> S3 Registry registration
-> S3 lifecycle routing audit / repair if needed
-> fresh S3 Candidate
-> protected merge
-> S3 exact-SHA/R2 effectiveness
```

不得跳过 Registry registration。

---

## 8. 已踩过的坑与必须避免的事项

### 8.1 任何 main 变更都会使 exact-base Candidate 失效

最容易忽略的包括：

```text
并行 PFE PR
纯文档 PR
handoff PR
governance repair
workflow repair
```

因此本 handoff PR 不得先于 #2882 合并。

### 8.2 关闭未合并的 Candidate head 永久不可复用

已关闭的 #2880 及此前失败 Candidate：

```text
禁止 reopen 后宣称有效
禁止追加提交
禁止 rebase 后继续
禁止复制旧 Declaration 而不重算 SHA / Blob
```

每次 exact base 前移都必须原子重建 fresh Candidate。

### 8.3 Candidate head 必须保持单提交冻结

远端 CI 暴露新问题时：

```text
不要向 Candidate head 添加 repair commit
关闭旧 Candidate
做独立 repair PR
repair 合并后从新 exact base 重建
```

### 8.4 Registry registration、Candidate 和 lifecycle repair 是三种不同边界

必须分别识别：

```text
repair boundary
registration boundary
Candidate boundary
unsupported boundary
```

不能让某一 workflow 把 10 文件 Candidate 路由到 6 文件 registration validator。

### 8.5 Declaration V2 只能在 PR body

完整 declaration marker 不得写入仓库文件。

必须绑定真实：

```text
base head
candidate head
status file
candidate field / value
focused workflow
standard workflow
semantic snapshot files
semantic snapshot blobs
```

### 8.6 Workflow 路径是间接控制面

修改一个 status 或 Registry 文件可能触发：

```text
trusted Registry
S1 Registry
S2 Registry
historical CAP-07 / CAP-08 compatibility
delivery policy
release lane
ruleset readiness
candidate integrity
standard CI
```

提交前必须枚举完整 trigger matrix，不能只看 focused workflow。

### 8.7 Git Blob 运输必须逐字节校验

此前多次遇到：

```text
长 base64 内容损坏
人工分块拼接偏差
远端 Blob SHA 与本地 git hash-object 不一致
```

规则：

```text
先在本地计算 git hash-object
create_blob 后比较远端 SHA
不一致的 Blob 永不进入 Tree
Tree / Commit 只能引用已核验 Blob
```

### 8.8 Semantic artifact digest 必须使用 canonical sorted-key JSON

S1 第一次 exact-SHA/R2 run 曾因：

```text
SEMANTIC_ARTIFACT_DIGEST_MISMATCH
```

失败。

原因是生成端使用普通 `JSON.stringify`，共享 R2 store 使用递归 key-sort canonical JSON。后续 effectiveness validator 必须复用共享 canonical digest policy。

### 8.9 Candidate merge 不等于 effectiveness

每个 slice 都必须单独完成：

```text
protected merge
tree equality
exact-SHA attestation
R2 / 730-day retention
readback
locked delete denial
dedicated success status
```

禁止在 merge 后直接推进下一 slice。

### 8.10 S2 adapter 的只读边界不得被悄悄扩大

禁止在后续 repair 中加入：

```text
INSERT / UPDATE / DELETE
DDL
migration
production wiring
scheduler
cursor
lease implementation
canonical write
public route
device gateway
```

这些属于后续 slice 或未授权能力。

### 8.11 不要因完整 acceptance 耗时而修改 head

完整 CI 的 Docker、Playwright、主 acceptance suite耗时较长。只要 job 是 `in_progress`，不要因等待而：

```text
编辑 PR body
修改 title
追加 commit
重触发 workflow
```

先读取 job steps，区分正常运行、排队和真实失败。

### 8.12 PFE-14 / 前端边界继续隔离

#2882 的 frontend / PFE-14 delta 为 0。

后续 MCFT-09 backend / control-plane 工作不得：

```text
修改 PFE branch
把前端文件带入 Candidate
用 UI 假设替代 backend authority 判断
让前端进度决定 Runtime authorization
```

---

## 9. 剩余工作量估算

当前总体约完成 49%，剩余约 51%。

粗略拆分：

```text
S2 merge + exact-SHA/R2 effectiveness     约 6%
S3 Registry + scheduler/read integration  约 14%
S4 bounded Shadow-online execution        约 12%
S5 restart/backfill/stale/lag recovery     约 10%
S6 closure/completion authority            约 9%
```

该估算可能随 Taskbook 的 S3-S6 exact boundary 审计调整。

---

## 10. 新接手者的第一组动作

按以下顺序执行：

```text
1. 读取本 handoff
2. fetch current main
3. fetch PR #2882
4. compare b3f095be... to a003770...
5. fetch all workflow runs for a003770...
6. 确认 all SUCCESS
7. 确认 main 未前移
8. expected-head merge #2882
9. 证明 candidate tree == merge tree
10. 建立 S2 exact-SHA/R2 control plane
```

在第 8 步之前，不修改仓库任何文件。

---

## 11. 一句话准确状态

```text
MCFT-CAP-09 已完成 S0 与 S1 effectiveness；S2 只读 PostgreSQL Evidence ingress Candidate #2882 已 1 commit / 10 files 全矩阵通过且 mergeable，当前只差 exact-base 最终核验与 protected merge。S2 尚未 effective，S3 尚未授权。
```
