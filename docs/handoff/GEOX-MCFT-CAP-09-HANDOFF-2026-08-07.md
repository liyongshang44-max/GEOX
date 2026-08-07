# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-07

更新时间：2026-08-07 15:08（UTC+8）

## 0. 文档定位与接手规则

本文档用于下一对话继续接手 `MCFT-CAP-09 — Shadow-Online Promotion`。

当前不是在做 S4，也不是在做最终 24 小时 S6；当前准确任务是：

```text
MCFT-CAP-09.S5
Shadow-online canonical integration Candidate
在 corrected S2 canonical epistemic authority 上重新完成 S5 Candidate 验收
```

本文记录：

1. 当前真正权威的仓库状态；
2. 已经完成并生效了什么；
3. S5 Candidate 已经实现并证明了什么；
4. 当前唯一 focused blocker 是什么；
5. 下一步合法执行序列；
6. 本轮接手期间发现的 handoff 缺陷与执行偏差；
7. 已踩过、下一位接手者不得重复的坑。

### 0.1 权威优先级——必须先读这一段

下一位接手者不得把 handoff 本身当作与任务书、protected main 等价的权威。

正确优先级是：

```text
1. protected main 上的总任务书 / MCFT-CAP-09 Taskbook / 当前 Delivery Policy
2. protected main 上的 Registry / status / source / workflow / governance contracts
3. GitHub 当前 PR / run / job / artifact / commit 的实时事实
4. handoff
```

handoff 的作用是减少上下文恢复成本，不是授权新的实现、改变任务书，也不能覆盖当前 main。

每次接手的第一步必须重新读取当前 `main`、当前开放 PR、checks 和 effective artifact。本文中的 SHA 是本次交接时的精确事实；如果远端已经前移，先审查新增提交，不得机械沿用。

### 0.2 旧 handoff 的处理结论

旧文件：

```text
docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-06.md
```

它只存在于旧 PR #2928，未进入 protected main，现应视为历史快照，不是当前权威 handoff。

本轮已明确纠正这一点，详见第 9 节“旧 handoff 问题的完整复盘”。

---

## 1. 当前实时仓库状态

```text
repository
liyongshang44-max/GEOX

protected main
9a7e61bc306161c256a43469ab37185c524d1cd8

main commit meaning
MCFT-CAP-09 S2 corrected canonical epistemic authority exact-SHA/R2 attestation

current formal S5 Candidate PR
#2940

PR state
OPEN / MERGEABLE / NOT MERGED

Candidate base
9a7e61bc306161c256a43469ab37185c524d1cd8

Candidate head
fe566adc5f07b2b47ea3af7ad4bb9f80ba028404

commits
1

changed files
13

runtime source files
4

migration delta
0

route delta
0
```

PR：

```text
https://github.com/liyongshang44-max/GEOX/pull/2940
```

开始下一轮前必须重新确认：

```text
git main == 9a7e61bc306161c256a43469ab37185c524d1cd8 ?
PR #2940 still open ?
PR #2940 head still fe566adc5f07b2b47ea3af7ad4bb9f80ba028404 ?
focused workflow 是否已有新 attempt / 新 head ?
```

---

## 2. 总任务与 S5 的准确边界

当前正式 Taskbook：

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md
```

CAP-09 的核心判定没有变化：

```text
CAP-09 不创建第二套 Twin kernel。
Replay 与 Shadow-online 共用既有 canonical Runtime semantics。
允许不同的是 adapters 与 operational configuration。
```

允许变化的 adapter classes：

```text
ClockPort
EvidenceIngressPort
SchedulerPort
ExecutionFeedbackPort
AvailabilityPort
operational deployment configuration
```

S5 的任务是：

```text
从 Shadow-online adapters 调用 unchanged canonical Runtime transactions
允许 canonical families A / B / C / F
已有可信执行 Evidence 时只读消费 H
禁止 G
禁止所有 action creation
```

S5 不等于 Stage 1B 最终 closure。

S6 才负责：

```text
真实 UTC O00 ... O23
24 persisted scheduler slots
24 resolved tick outcomes
actual database Evidence ingress
restart
missed-slot backfill
stale Evidence degradation
late / out-of-order Evidence
online State / Forecast readback
zero automatic Recommendation / Approval / AO-ACT / Dispatch / Model Activation
```

因此当前不得声称：

```text
CAP-09 complete
Stage 1B closed
24-hour Shadow-online closure complete
production deployment active
background scheduler active
```

---

## 3. 已经完成并正式生效的前置能力

### 3.1 S4 Restart / Backfill / Stale Detection 已 effective

```text
S4 effective subject
6a4138e77fe6b838bc0f552a0bc5e2ceb84c026f

S4 exact-SHA/R2 run
31108834682

S4 exact-SHA artifact
8970768718

S4 semantic artifact digest
sha256:64e14355edad6e2711cdde26cc3ac2bd6c7795c7e64439b194679350ce7cc80c

R2 retention/readback/delete-denial
effective
```

S4 已作为 S5 的有效 predecessor authority 使用。

### 3.2 S5 Candidate lifecycle routing 缺口已修复

本轮发现：S5 Registry 已登记后，status 表示下一步可创建 S5 Candidate，但当时的 lifecycle classifier 实际不能正确识别完整 S5 Candidate。

这个 control-plane inconsistency 已通过独立 repair 完成：

```text
repair PR
#2939

result
all required checks passed
protected merged
```

该 repair 只修 lifecycle routing，不是 S5 Runtime implementation，也不使 S5 effective。

### 3.3 Corrected S2 canonical epistemic authority 已 effective

S5 初版推进后发现 S2 Evidence epistemic classification 存在必须纠正的 authority 问题，因此 S5 必须基于 corrected S2 重新验收，不能继续绑定旧 S2 authority。

当前有效 corrected S2：

```text
corrected S2 subject
a4db631f5bab234d9a6f7c25607f4fd027d224a1

correction focused run
31150334462

correction focused artifact
8983045619

corrected S2 exact-SHA/R2 run
31151549954

corrected S2 exact-SHA/R2 artifact
8983485729

corrected S2 semantic digest
sha256:e99cbe0961e47a2b59261a8e16512bef2a10b8168bf5609907b95afcff387543

effective frontier
S5_REVALIDATION
```

当前 protected main `9a7e61bc...` 就是该 corrected S2 exact-SHA/R2 control-plane 落地后的基线。

下一位接手者不得把 corrected S2 当成“只是测试修复”。它是 S5 当前必须消费的正式 epistemic authority。

---

## 4. 当前正式 S5 Candidate：PR #2940

### 4.1 精确边界

```text
base
9a7e61bc306161c256a43469ab37185c524d1cd8

head
fe566adc5f07b2b47ea3af7ad4bb9f80ba028404

commits
1

files
13

runtime source delta
4

migration delta
0

route delta
0
```

13 个文件：

```text
.github/workflows/mcft-cap-09-s5-shadow-online-canonical-integration.yml

apps/server/src/runtime/twin_runtime/postgres_cap04_shadow_online_canonical_tick_adapter_v1.ts
apps/server/src/runtime/twin_runtime/postgres_frozen_shadow_online_evidence_source_v1.ts
apps/server/src/runtime/twin_runtime/postgres_read_only_execution_evidence_adapter_v1.ts
apps/server/src/runtime/twin_runtime/shadow_online_canonical_integration_service_v1.ts

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-DELIVERY-STATUS-V1.json
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-HARD-ACCEPTANCE-EVIDENCE-V1.json
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-SHADOW-ONLINE-CANONICAL-INTEGRATION-CANDIDATE-BOUNDARY-V1.json
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-SHADOW-ONLINE-CANONICAL-INTEGRATION-CANDIDATE-V1.json
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-SHADOW-ONLINE-CANONICAL-INTEGRATION-CONFIG-V1.json

scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S5_SHADOW_ONLINE_CANONICAL_INTEGRATION.cjs
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S5_SHADOW_ONLINE_CANONICAL_INTEGRATION_DB.ts
```

### 4.2 为什么是 13 文件 / 4 Runtime source，而不是早期 12 / 3

这是本轮非常重要的规范纠正。

早期 S5 草案只通过 CAP-05 residual historical selection 间接证明 H，被误认为满足 `ExecutionFeedbackPortV1`。

重新对照 Taskbook §3.4 后确认：

```text
ReadOnlyExecutionEvidenceAdapter
```

是 CAP-09 明确允许不同、并要求实现的 Shadow-online adapter。只有接口而没有 production implementation，S5 不能算完成。

因此正式 S5 增加：

```text
apps/server/src/runtime/twin_runtime/postgres_read_only_execution_evidence_adapter_v1.ts
```

它：

```text
读取既有 canonical H / execution evidence
只选择 trustworthy execution Evidence
只读
不创建 decision
不创建 approval
不创建 task
不创建 dispatch
不创建 receipt
```

这使正式边界从：

```text
错误早期草案：12 files / 3 Runtime source
```

纠正为：

```text
正式边界：13 files / 4 Runtime source
```

后续不得退回 12 文件版本。

### 4.3 S5 当前实现组合

单次 caller-invoked oldest-due slot：

```text
S2 corrected frozen Evidence
        ↓
S3 persistent sequential scheduler claim + fencing token
        ↓
S4 restart/backfill/availability preparation
        ↓
S5 adapter composition
        ↓
unchanged canonical Runtime A / B / eligible C / F
        ↓
read-only H when trustworthy execution Evidence exists
        ↓
terminal scheduler result
```

关键约束：

```text
不重跑 Evidence eligibility selection
不创建第二个 scheduler authority
canonical persistence 使用同一 claim owner / fencing token
C 使用现有 CAP-05 residual service
只有精确 CAP05_FORECAST_RESIDUAL_MATCH_NOT_FOUND 可作为合法 no-C
其他 residual error fail closed
H read-only
G = 0
action creation = 0
```

---

## 5. PR #2940 当前 checks 状态

当前 head：

```text
fe566adc5f07b2b47ea3af7ad4bb9f80ba028404
```

已成功：

```text
ci
run 31153893220
SUCCESS

mcft-delivery-policy-v2
run 31153893204
SUCCESS

mcft-candidate-declaration-selftest-v2
run 31153893184
SUCCESS

mcft-cap-09-s5-registry-registration
run 31153893237
SUCCESS

mcft-release-lane-v1
run 31153893222
SUCCESS

mcft-cap-09-s2-registry-registration
run 31153893228
SUCCESS

mcft-main-ruleset-readiness-v1
run 31153893221
SUCCESS

mcft-cap-08-authority-reconciliation
run 31153893178
SUCCESS
```

唯一失败：

```text
focused S5 workflow
mcft-cap-09-s5-shadow-online-canonical-integration
run 31153893213
FAILURE

job
92789104678
```

注意：focused job 不是整体 S5 integration 失败。它的前 13 个关键步骤已经通过，失败发生在后置的独立 CAP-05 PostgreSQL persistence proof。

---

## 6. 已经通过的 S5 focused 证明

run `31153893213` 中以下步骤均成功：

```text
S4 exact-SHA/R2 artifact download
corrected S2 exact-SHA/R2 artifact download
S5 governance boundary + effective authority validation
CAP04 PostgreSQL acceptance support extraction
server production source typecheck
focused acceptance source transpilation
S5 PostgreSQL canonical integration acceptance
```

### 6.1 Governance PASS

治理结果证明：

```text
exact 13-file boundary = true
runtime_source_delta = 4
migration_delta = 0
corrected S2 R2 consumed = true
S4 R2 consumed = true
g_write_count = 0
action_creation_count = 0
execution_feedback_port_read_only = true
external_effectiveness = false
```

### 6.2 PostgreSQL S5 integration 主验收 PASS

主 S5 DB acceptance 已整体 PASS。

#### Completed path

```text
terminal_state = COMPLETED
forecast_status = COMPLETED
canonical families = A / B / F
exact corrected S2 frozen Evidence reused = true
shared scheduler/canonical fence = true
forbidden_fact_count = 0
g_write_count = 0
action_creation_count = 0
```

#### Blocked path

```text
terminal_state = DEGRADED
forecast_status = BLOCKED
canonical families = A / B / F
exact frozen Evidence reused = true
shared fence = true
forbidden/G/action = 0
```

#### CAP05 no-residual path

```text
forecast_status = COMPLETED
current observation exact residual target time = true
postgres historical Forecast projection count before tick = 0
c_residual_attempted = true
c_residual_count = 0
c_residual_disposition = NO_ELIGIBLE_HISTORICAL_FORECAST
H consumed = false
forbidden/G/action = 0
```

这条证明很重要：no-C 不是因为测试数据时间错位，也不是因为前一个 test case 留下 historical Forecast 导致误选；验收显式锁住 exact target time 和 zero pre-existing historical Forecast projection。

#### Positive C through S5 adapter

```text
terminal_state = COMPLETED
forecast_status = COMPLETED
canonical families = A / B / C / F
H read-only consumed = true
execution_feedback_port_read_only_proven = true
preexisting H fixture count = 1
S5 H write count = 0
c_residual_attempted = true
c_residual_count = 1
c_residual_disposition = COMMITTED
residual source/persistence override pair guard = true
forbidden/G/action = 0
```

这已经证明 positive C 真正穿过 S5 adapter，而不是只在独立 CAP-05 component test 中证明。

---

## 7. 当前唯一 blocker——精确根因

focused workflow 在步骤：

```text
Run independent production PostgreSQL C/H persistence acceptance
```

失败。

该步骤复用：

```text
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_FORECAST_RESIDUAL_OUTCOME_TICK_DB.ts
```

它被安排在已经跑完 S5 integrated DB acceptance 的同一个 PostgreSQL database 上。

精确错误：

```text
check constraint
"twin_object_idempotency_index_v1_identity_kind_check"
of relation
"twin_object_idempotency_index_v1"
is violated by some row

PostgreSQL code
23514
```

失败发生于 CAP-05 独立 acceptance 重新初始化 schema 时应用：

```text
apps/server/db/migrations/2026_07_10_mcft_cap_02_continuation_persistence.sql
```

该 migration 会重建：

```text
twin_object_idempotency_index_v1_identity_kind_check
```

并把 allowed identity kinds 收缩到：

```text
OBJECT
A0_RECORD_SET
A2_RECORD_SET
RUNTIME_CONFIG
```

但同一数据库已经被前面的 S5 acceptance 写入更新世代的 idempotency rows，因此 ALTER TABLE 在重建 CHECK 时发现已有 row 不满足旧约束，直接 fail。

### 7.1 当前判断

这是：

```text
独立 reused CAP-05 acceptance 的数据库隔离问题
```

不是当前证据下的：

```text
S5 canonical integration failure
S5 production source typecheck failure
S5 H read-only failure
S5 positive C composition failure
```

依据是：上述 S5 主 PostgreSQL integration 已完整 PASS，且失败只在下一步重新运行独立 CAP-05 schema initializer 时出现。

但由于该独立 persistence proof 是 focused workflow 的 required step，所以：

```text
PR #2940 当前绝对不能合并
S5 当前不能宣称 Candidate accepted
```

### 7.2 推荐修复

优先方案：

```text
让 independent CAP-05 C/H persistence acceptance 使用第二个 fresh PostgreSQL database
```

不要继续复用：

```text
mcft_cap09_s5_acceptance
```

建议流程：

```text
1. S5 integrated acceptance 使用 DB-A
2. 创建 fresh DB-B
3. 将 CAP05 independent persistence acceptance 的 DATABASE_URL 指向 DB-B
4. 在 DB-B 内由它自己的 initializeSchemaV1 完整建模
5. 保留 0 FAIL 断言
6. structured S5 proof 同时要求：
   - S5 integrated result PASS
   - independent production C/H persistence result PASS
```

不要通过以下方式“修绿”：

```text
不要删除独立 CAP05 proof
不要跳过 migration
不要放松 check constraint
不要修改 CAP02 migration 来适配测试顺序
不要把失败直接标记 allow-failure
```

如果 separate DB 仍失败，再按 CAP-05 acceptance 自身的 clean-database 语义继续定位。

---

## 8. 下一步执行计划

### Step 1 — 只修当前真实 blocker

修改 focused workflow，使独立 CAP-05 PostgreSQL C/H persistence acceptance 跑在 fresh DB-B。

当前 Candidate 的产品语义、4 个 Runtime source 和 13 文件边界无需因这个 blocker 扩张。

### Step 2 — 保持 Candidate 原子身份

如果只改 workflow，但 Candidate Declaration / semantic snapshot 绑定 head/blob，则必须重建一个新的单提交 head，而不是在现有 head 后堆第二个 commit。

推荐：

```text
base 如果仍为 9a7e61bc...
→ 从同一 base 原子重建 13-file tree
→ 更新 workflow blob
→ 更新任何绑定 workflow/head 的 Candidate docs
→ 更新 Candidate Declaration 的 candidate_head / semantic blob snapshot
→ force-update 同一 #2940 Candidate branch 到新的单提交 head
```

这不是旧 handoff 所说的“失败 PR 一律关闭重开”。当前正确要求是：保持任务唯一 PR、精确 base、单提交和 declaration/head/blob 一致。

如果 `main` 已经前移：

```text
先审查新 main
重新判断 predecessor authority 是否变化
从新 main 原子重建
不能继续使用旧 base
```

### Step 3 — 全部 checks 必须重新绿

至少要求：

```text
focused S5 workflow SUCCESS
standard ci SUCCESS
Delivery Policy SUCCESS
Candidate Declaration self-test SUCCESS
Registry lifecycle lanes SUCCESS
ruleset readiness SUCCESS
release lane SUCCESS
```

focused artifact 必须来自新的全绿 run。当前失败 run `31153893213` 的 artifact 只能保留为诊断证据，不能成为 S5 effectiveness authority。

### Step 4 — Protected merge S5 Candidate

所有 required checks 成功后才允许 protected merge。

注意：

```text
S5 Candidate merge != S5 externally effective
```

### Step 5 — 单独完成 S5 exact-SHA/R2 effectiveness

S5 merge 后必须建立独立 effectiveness control plane，绑定：

```text
exact merged subject SHA
Candidate tree == merge tree
focused SUCCESS run/artifact
standard CI SUCCESS
semantic artifact digest
R2 / 730 immutable retention
readback verified
locked-version delete denied
subject success status
```

只有该链成立后，S5 才能 externally effective，并授权 S6 lifecycle。

### Step 6 — 再进入 S6

S6 是真实 24 小时 Stage 1B closure：

```text
actual UTC O00 ... O23
not accelerated
not replay clock
```

不得用 S5 单 tick / focused DB acceptance 替代 S6。

---

## 9. 本轮发现的旧 handoff 问题——必须完整保留

这是本轮最重要的交接治理教训。

### 9.1 旧 handoff 根本没有进入 protected main

旧 handoff：

```text
docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-06.md
```

只存在于 PR #2928。

它当时冻结：

```text
main = fafb90c8...
current S4 Candidate = #2927
S4 not merged/effective
S5 not authorized
```

而后续仓库事实已经发生多轮前移。

问题不是“handoff 不能记录未完成状态”，而是接手时不能把一个未合并、旧 base 的 handoff 当成与当前 main 平级的权威。

旧 handoff 自己其实写了：接手后必须重新确认 main / PR head / checks。这个自检要求是对的；本轮最初没有充分执行。

### 9.2 Handoff 混合了三类不同性质的信息

旧 handoff 把以下三类内容写在同一强度下：

```text
A. Taskbook / architecture 的正式规则
B. 当前仓库某个时点的事实
C. 历史排障形成的操作习惯
```

A 可以长期有效；
B 必须 live re-check；
C 只能作为经验，不能自动升级为永久治理规则。

本轮接手时没有把这三类信息充分拆开，导致部分历史策略被当成当前硬规则。

### 9.3 旧 handoff 过度泛化“失败 PR 必须关闭重建”

旧 handoff 基于当时 exact-head / single-commit / declaration 绑定问题，总结为：

```text
失败 PR 不追加 commit，关闭后 fresh rebuild
```

这个经验在某些 immutable Candidate 场景有价值，但不是总任务书对所有 PR 的普遍规则。

当前更准确的规则是：

```text
必须保持 Candidate identity / exact base / single-commit boundary / declaration / semantic snapshot 一致。
```

在同一唯一任务 PR 上原子重建单提交 head，可以满足这些要求；不应为了历史习惯无条件制造新 PR。

### 9.4 旧 handoff 的 carrier / materializer 运输建议已与当前 Delivery Policy 不兼容

旧 handoff 建议过：

```text
temporary materializer / loader PR
gzip / Base64 carrier
Git Data API object transport
临时 PR 永不合并
```

这些是早期为解决大对象运输与 Git Data API 限制形成的战术。

当前 Delivery Policy 已不应使用 validation-carrier / proof-only transport 作为正式交付路径。

本轮一度按旧建议创建过临时 validation carrier PR #2937，随后重新审查 Delivery Policy 后确认路线错误，并关闭该 PR。

后续禁止重复：

```text
不要为正式 S5 / S6 创建 validation carrier PR
不要用 gzip/Base64 临时 PR 代替 direct-source Candidate
```

未引用 Git Blob 只可作为无副作用内容寻址准备，不能替代正式 direct-source delivery。

### 9.5 我们在 S5 Registry 后才发现 Candidate classifier 不能路由

这是旧 handoff 缺陷与接手执行失误共同造成的典型案例。

当时：

```text
S5 status/Registry 认为下一合法动作是 S5 Candidate
```

但实际 lifecycle classifier 还不能识别完整 S5 Candidate，仍可能回落旧生命周期并 fail closed。

这说明：

```text
Registry registration 成功 != successor Candidate route 已真实可用
```

本轮不得把责任全部归给旧 handoff：旧 handoff其实提示过 lifecycle routing 风险；接手时没有在 S5 Registry 前重新审查 classifier，是执行上的失误。

最终通过 clean control-plane repair #2939 修复。

后续每个新 lifecycle 都应在 transition 前检查：

```text
classifier
router
cross-lifecycle validator
workflow trigger paths
```

而不是机械复制“先 Registry 再发现 route”。

### 9.6 旧 handoff 的状态迅速过时，不能做“继续执行指令”

旧 handoff 记录的是 S4 era；当前已到 corrected S2 authority 上的 S5 revalidation。

因此新的 handoff 必须显式区分：

```text
snapshot facts
versus
long-lived invariants
```

下一位接手者应该把本文的 SHA 看成“启动检查点”，而不是不可重新验证的常量。

### 9.7 新 handoff 的纠偏原则

以后 handoff 必须遵循：

```text
1. 先写 authority hierarchy
2. 明确 handoff 是否已进入 main
3. 把 snapshot SHA 与 architectural invariant 分开
4. 每个 open PR 都写 live verification requirement
5. 历史排障 tactic 标注为 lesson，不标成 universal policy
6. 如与 current Delivery Policy 冲突，以 current protected main policy 为准
7. 不因 handoff 文字而跳过 source / classifier / workflow live audit
```

---

## 10. 本轮另外踩过的坑

### 10.1 S5 早期少实现了真正的 ExecutionFeedbackPort

症状：

```text
通过 historical Forecast residual refs 间接看到了 H
```

但 Taskbook 明确要求：

```text
ReadOnlyExecutionEvidenceAdapter
```

必须存在于 Shadow-online adapter 层。

修复：正式加入 PostgreSQL read-only H adapter，边界改为 13 / 4。

教训：

```text
“组件中用到了 H” != “adapter contract 已实现”
```

### 10.2 不得继续消费 stale S2 authority

S2 后来发生 canonical epistemic compatibility correction。

S5 必须绑定 corrected S2 exact-SHA/R2，而不能因为旧 S2 曾经 effective 就继续沿用旧 artifact。

教训：predecessor effectiveness 若发生正式 correction，successor 必须重新做 authority qualification。

### 10.3 Legacy acceptance fixture 的 historical ET0 epistemic class 错误

旧 CAP04 acceptance fixture 中：

```text
historical_et0_estimate_v1
```

曾被标成：

```text
OBSERVED
```

与冻结 canonical epistemic class 不符。

当前 focused acceptance 只在 acceptance fixture 入库前归一化为：

```text
ESTIMATED
```

这是 acceptance-only normalization：

```text
不得借此修改 production Runtime semantics
不得弱化 corrected S2 selection contract
```

### 10.4 CAP05 no-match 很容易做出假阳性

早期 no-C 路径可能因为：

```text
current observation 时间没有精确绑定 residual target
前一个 test case 留下 historical Forecast projection
```

而“碰巧” no-match。

当前已加硬证明：

```text
current_observation_exact_target_time = true
postgres_forecast_projection_count_before_tick = 0
```

后续不得删除。

### 10.5 Independent DB proof 必须隔离数据库

当前 blocker 就是这个坑。

两个 destructive acceptance 都假设自己从 clean schema 开始时，不得顺序复用同一个 DB，除非第二个 acceptance 明确支持已有新世代 rows。

当前修复应使用 DB-A / DB-B 隔离，而不是改 migration。

### 10.6 Artifact download 目录可能多一层

早期曾把 `actions/download-artifact` 下载路径当成文件直接落在目标根，实际可能带 artifact-name 子目录。

后来通过：

```text
merge-multiple: true
```

和明确 path 处理修复。

教训：validator 读取 artifact 前先核对实际目录结构，不要只根据 action 配置猜路径。

### 10.7 Validator exact-string scan 会产生无意义 false positive

曾出现等价代码：

```text
g_write_count:0
```

被 validator 因只寻找：

```text
g_write_count: 0
```

拒绝。

治理脚本应尽量验证语义、结构化 JSON、AST/可执行结果，少依赖空格敏感的 source token。

### 10.8 Acceptance helper 全量 tsc 与 production typecheck 要区分

仓库历史 acceptance fixture 存在独立类型债务时，直接把抽取 helper 放入严格 project typecheck 可能让 S5 被无关 fixture typing 阻塞。

当前策略：

```text
production server source → full typecheck
focused extracted acceptance source → transpile syntax check
real correctness → destructive PostgreSQL execution
```

这不是允许生产源码跳过 typecheck。

### 10.9 GitHub Actions infrastructure failure 与代码 failure 必须分开

本轮经历 GitHub Actions major outage，出现：

```text
queued 很久
cancelled without steps
workflow API 异常
```

正确做法：

```text
无 step 的 cancelled/infra error → rerun，不改代码
实际 step failure → 读取 logs / artifact 后修代码或验收装配
```

不得因为平台故障降低 protection gate，也不得把 infra cancellation 写成代码失败。

### 10.10 merge 永远不等于 effectiveness

这条仍然是有效长期规则。

```text
Candidate merge
!= exact-SHA authority
!= R2 retention
!= externally effective
```

S5 merge 后还必须另做 exact-SHA/R2。

### 10.11 S5 不能提前声称 S6

S5 focused PostgreSQL 能证明 canonical integration，但不能替代：

```text
actual 24 hourly UTC boundaries
```

S6 才能关 Stage 1B。

---

## 11. 当前禁止动作

```text
不得合并 #2940，直到 focused S5 全绿
不得把 run 31153893213 的失败 artifact 当 S5 effectiveness authority
不得删除 independent production C/H persistence proof 只为了绿 CI
不得修改 CAP02 migration 来绕过 destructive-test DB 污染
不得弱化 corrected S2 epistemic authority
不得移除 ReadOnlyExecutionEvidenceAdapter
不得退回 12-file / 3-source S5 边界
不得产生 G / Recommendation / Approval / AO-ACT / Dispatch / Model Activation
不得加入 daemon / cron / server-startup production wiring
不得宣称 Stage 1B closure
不得回用 validation carrier PR 模式
```

---

## 12. 下一位接手者启动检查单

```text
1. 读取 protected main 当前 SHA
2. 确认 main 是否仍为 9a7e61bc306161c256a43469ab37185c524d1cd8
3. 重新读取 MCFT-CAP-09 Taskbook
4. 重新读取 current Delivery Policy / Candidate Declaration policy
5. 确认 #2940 still open / mergeable
6. 确认 #2940 head 是否仍为 fe566adc5f07b2b47ea3af7ad4bb9f80ba028404
7. 拉取 #2940 最新 workflow runs，不依赖本文静态状态
8. 若 focused 仍失败，读取最新 job logs，不直接复用旧错误假设
9. 当前已知 blocker：independent CAP05 acceptance 与 S5 acceptance 共用 destructive DB
10. 优先改为 fresh DB-B 隔离
11. 原子重建 single-commit Candidate head，并同步 Candidate Declaration / semantic snapshot
12. focused + standard CI + governance 全绿后再 protected merge
13. merge 后不要进入 S6；先完成 S5 exact-SHA/R2 effectiveness
14. S5 externally effective 后再检查/注册 S6 lifecycle
15. S6 最终必须真实运行 UTC O00...O23
```

---

## 13. 当前权威状态摘要

```text
CAP-08 Stage 1A closure effective                    true
CAP-09 S0 governance/effectiveness chain             complete for current frontier
CAP-09 S1 adapter-contract authority                 effective
CAP-09 corrected S2 epistemic authority              effective
CAP-09 S3 persistent scheduler                       effective
CAP-09 S4 restart/backfill/stale detection           effective
CAP-09 S5 Registry / lifecycle routing               ready
CAP-09 S5 formal Candidate PR                        #2940 OPEN
CAP-09 S5 Candidate merged                           false
CAP-09 S5 externally effective                       false
CAP-09 S6 authorized to execute formal 24h closure   false
background scheduler production wiring               false
public HTTP writer                                   false
live device ingestion authority                      false
G write                                               forbidden / zero in S5 proof
action creation                                      forbidden / zero in S5 proof
model activation                                     forbidden
```

当前唯一正确目标：

```text
修复 #2940 focused workflow 的独立 CAP05 PostgreSQL proof 数据库隔离，
使 S5 Candidate 所有 required checks 全绿，
protected merge，
再完成 S5 exact-SHA/R2 effectiveness，
之后才进入 S6。
```

---

## 14. 最后提醒

不要再从旧 handoff 直接“继续执行”。

下一轮正确启动方式是：

```text
Taskbook
→ protected main
→ live PR / run / artifact
→ 本 handoff 用于解释为什么仓库变成现在这样
```

如果这四者有任何冲突，以前 3 项的实时事实重新裁决，并把新的裁决写回 handoff，而不是让 handoff 反过来覆盖仓库。