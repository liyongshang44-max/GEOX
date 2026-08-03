---
title: "GEOX MCFT-CAP-08 S6 Handoff"
document_id: "GEOX-MCFT-CAP-08-S6-HANDOFF"
repository: "liyongshang44-max/GEOX"
generated_at: "2026-08-03T16:05:00+08:00"
status: "ACTIVE_HANDOFF"
language: "zh-CN"
supersedes:
  - "GEOX-MCFT-CAP-08-S6-HANDOFF-2026-08-02"
  - "GEOX-MCFT-CAP-08-S6-HANDOFF-2026-07-31"
---

# GEOX MCFT-CAP-08 S6 交接文档

> 本文件是 MCFT-CAP-08 S6 的仓库内唯一活动交接入口。  
> 新对话必须先读本文，再通过 GitHub 重新核对 `main`、开放 PR、workflow run、artifact 和 authority 原文。  
> 不得依据聊天记忆继续，不得复用任何已经 dispatch 或失败的 authority、operational identity、logical database identity 或 physical database identity。

---

## 0. 接手后必须先做的事实核验

```text
repository
liyongshang44-max/GEOX

expected main at handoff
1475b326994e15e9e0ce6a393dde825825763ff6

expected main meaning
Merge PR #2779
Issue REPLACEMENT-010 non-effective RUN_A authority candidate
```

接手后依次核验：

```text
1. current main 是否仍为 1475b326994e15e9e0ce6a393dde825825763ff6；
2. PR #2779 是否 merged；
3. PR #2780 是否仍 open / draft / 未合并；
4. PR #2781 的实际 head 是否仍为
   55d7b4314f7f73aac9355a2ba06288d252996b65；
5. PR #2781 是否仍是单提交、22 文件；
6. exact-path rehearsal run 30792360746 的终态是否仍为 failure；
7. RUN_DEV_A 与 RUN_DEV_B 是否都在 CAP-07 readback 同一位置失败；
8. 两个 disposable PostgreSQL 数据库是否都已删除；
9. 是否出现新的 correction PR、replacement authority 或 workflow dispatch；
10. 是否有人错误合并 PR #2780、触发正式 RUN_A、点击 Re-run jobs 或启动 RUN_B。
```

特别注意：

```text
PR #2781 描述中的 candidate head/tree 已过时。
实际 GitHub head 才是事实：
55d7b4314f7f73aac9355a2ba06288d252996b65
```

若 `main`、PR head 或 run 状态已变化，先审计新事实，再决定路径，不得直接沿用本文中的 SHA。

---

# 1. 我们正在做什么

## 1.1 最终任务

当前目标仍是关闭：

```text
MCFT-CAP-08
S6 Final Two-Run Closure
24-Tick End-to-End Closure
Stage 1A Replay-backed Closure
```

最终必须在两个相互独立、全新的 PostgreSQL 16 实例中，对同一冻结正式执行对象集完成：

```text
Formal RUN_A
Formal RUN_B
cross-run semantic comparator
S6 Candidate exact head freeze
Candidate Declaration + human approval
R2 / 730-day retention attestation
24/24 Hard Acceptance Ledger settlement
MCFT-CAP-08 closure
```

完整运行链包含：

```text
B00 bootstrap
→ T00–T23
→ State / Checkpoint / Forecast / Scenario
→ Decision / Approval / Plan / Execution / Outcome
→ 24 FVO
→ 24 Residual
→ 16 Calibration + 8 Holdout
→ Calibration Candidate
→ Shadow Evaluation
→ zero Model Activation
→ Restart / Recovery / Late Evidence
→ CAP-07 readback
→ 22 real witness producers
→ exact closure identity
```

## 1.2 当前具体工作包

当前不是正式 RUN_A 阶段。

当前唯一活动工作包是：

```text
PR #2781
Exact-path double-run development rehearsal
```

目的：在不消耗正式 authority、不产生正式 evidence 的前提下，用与正式 workflow 相同的真实路径，提前执行：

```text
RUN_DEV_A
RUN_DEV_B
two fresh PostgreSQL 16 databases
exact migrations / roles / ACL / seed
same workflow entrypoint
same harness
same port bundle
same product chain
same T16 → S4 → T17 bridge
same materialization and closure reader
restart/readback
semantic comparator
integration-owner qualification
clean database drops
```

这是为终止“每次正式 one-shot RUN_A 才暴露下一个错误”的错误工作方式。

---

# 2. 当前仓库状态

## 2.1 `main`

```text
main
1475b326994e15e9e0ce6a393dde825825763ff6

source PR
#2779

meaning
REPLACEMENT-010 candidate merged
candidate remains NON-EFFECTIVE
```

## 2.2 REPLACEMENT-010 candidate

```text
candidate head
28cfc061a7b47b0fe405a7a07001512e915c2cd6

candidate merge
1475b326994e15e9e0ce6a393dde825825763ff6

exact execution subject
89517a1b3ff61a1a1ba3259ef4e04001d6e1fee8

operational identity
MCFT-CAP-08-S6-FORMAL-RUN-A-20260802-REPLACEMENT-010

logical database identity
MCFT-CAP-08-S6-FORMAL-DB-A-20260802-REPLACEMENT-010

physical database template
geox_mcft_cap08_s6_run_a_replacement_010_<github_run_id>

object count
54
```

Candidate 状态：

```text
authority effective             false
database execution authorized   false
workflow dispatch authorized    false
runtime gate eligible           false
RUN_B authorized                false
```

冻结对象：

```text
candidate authority blob
3873a9c3b7a64a63287d24fec17e587d01a96eb5

candidate semantic digest
sha256:27bd5c0fe936e817c19491b0dc898d7f10adfb3d5fab556dedd0697115f74233

object-set manifest blob
cbeae03ad6118c8f8138df18b7260e5d20cdbb3e

object-set semantic digest
sha256:63c77a83fddd7fed476b10b3267c44921486b79f0d99c9d46f0e5b4b6cb0dea7

product chain
de12666d4d5bebeac9b57f07d663a0f0f2dc4de1

closure reader
cdee98e8b7bbd4a1d5ba45361978d5803873b610
```

## 2.3 PR #2780：effectiveness，当前必须保持阻塞

```text
URL
https://github.com/liyongshang44-max/GEOX/pull/2780

state
open / draft

head
f00ba3ed3f20f6e7722edd6e3ea854208831c449

base
1475b326994e15e9e0ce6a393dde825825763ff6

changed files
5
```

PR #2780 原计划把 REPLACEMENT-010 激活为一次性正式 RUN_A authority。

现在不得合并，原因：

```text
1. PR #2781 的 exact-path development rehearsal 尚未 PASS；
2. PR #2781 会修改正式执行路径相关对象；
3. PR #2781 合并后，#2779 冻结的 54-object set 很可能不再等于实际 merged execution path；
4. 因此 #2780 不能在 #2781 之后直接视为仍然有效；
5. 默认正确路径是：
   integration qualification PASS
   → merge #2781
   → post-merge rehearsal PASS
   → 重新冻结 candidate
   → 新的独立 effectiveness
   → 单次正式 RUN_A。
```

除非治理审计明确证明 object set 未漂移，否则不要尝试“保留 #2780 直接合并”。

## 2.4 PR #2781：当前活动实现 PR

```text
URL
https://github.com/liyongshang44-max/GEOX/pull/2781

state
open / draft / mergeable

actual head
55d7b4314f7f73aac9355a2ba06288d252996b65

base
1475b326994e15e9e0ce6a393dde825825763ff6

commits
1

changed files
22
```

已通过：

```text
static architecture gate
run 30792360795
PASS

standard CI
run 30792360699
PASS

delivery policy
PASS

release lane
PASS

ruleset readiness
PASS

candidate declaration selftest
PASS

authority reconciliation
PASS

CAP-07 closure applicability
PASS
```

真实 exact-path rehearsal：

```text
run
30792360746

result
FAIL
```

---

# 3. 当前真正卡点

## 3.1 两个独立 development runs 同点失败

```text
RUN_DEV_A
job 91618468132
FAIL

RUN_DEV_B
job 91618468105
FAIL
```

两条路径均已通过：

```text
development authority generation
non-formal authority gate
exact subject checkout
PostgreSQL 16 container
fresh disposable database identity
migrations
migrator / runner roles
ACL
bootstrap seed facts
formal workflow entrypoint
product execution path before CAP-07 readback
clean database drop
artifact upload
```

两条路径均在同一步失败：

```text
Execute RUN_DEV_A/B through exact formal entrypoint,
harness and port bundle
```

准确异常：

```text
TypeError: Cannot read properties of undefined (reading 'scope')

scripts/runtime_acceptance/
mcft_cap08_s6_single_run_ports/
cap07_reader_v1.cjs

called by:
scripts/runtime_acceptance/
mcft_cap08_s6_single_run_db/
cap07_readback_execution_adapter_v1.cjs
```

调用链：

```text
cap07_reader_v1.cjs request()
→ fetchVariantV1()
→ executeCompleteCap07ReadbackV1()
→ executeSingleRunDatabaseHarnessV1()
→ workflow_entrypoint_v1.ts
```

当前工程判断：

```text
CAP-07 readback adapter 与 CAP-07 reader 的 request shape 不一致；
reader 读取了 undefined payload/context 的 scope；
这是 exact-path integration defect；
不是数据库 bootstrap、authority、identity、T17、FVO 或 comparator 问题。
```

因执行在 CAP-07 readback 前终止，以下步骤尚未执行：

```text
restart/readback A
restart/readback B
unified regression matrix A/B
semantic comparator A/B
integration qualification owner
post-merge rehearsal
```

## 3.2 当前证据

```text
rehearsal authority artifact
8847522549
sha256:183dec6dcdff4de52bd11ccf3bfb8d6504e3f46c4ded1111a0ac405b7db4733a

RUN_DEV_A artifact
8847549675
sha256:23bfe1bb5a504f25d6159951c9cd869e199a8c5653d674ee1c5f687d7470f383

RUN_DEV_B artifact
8847548183
sha256:a8a0ffcbd565144c0ac43b595447f3675af224947d59387ed7c89035fd363e14
```

两个 development database 均已清理。Development rehearsal 不消耗 REPLACEMENT-010。

---

# 4. 已经完成的核心能力

以下能力已完成，不得重做或绕开：

```text
S1–S5 implementation / effectiveness
HA mapping and lifecycle
coverage gate
separated witness producers
orchestrator
single-run harness
formal workflow control plane
fresh PostgreSQL bootstrap
migrator / runner role separation
platform ACL
54-object exact execution set
153 canonical receipts
224 operational events
7 recovery vectors
10 CAP-07 surfaces
22 real witness producers / proof sets
T16 → S4 → T17 authority-bound transition
T17 transition guard
phase-order transport
FVO-10 exact canonical alias handling
FVO-17 corrected forecast binding
database cleanup proof
```

## 4.1 关键产品修复已经成立

```text
T16 base state
→ S4 append-forward corrected T16
→ dedicated T17 transition bridge
→ T17 consumes corrected posterior
→ T18–T23 ordinary path
```

不允许回退到：

```text
generic CAP-04 assertion relaxation
temporary corrected handoff wrapper
latest-pointer mutation for S4
synthetic T17 simulation
```

## 4.2 FVO 语义边界

FVO-10：

```text
允许两个冻结物理载体折叠为一个 canonical object，
前提是 exact source pair + exact semantic hash equality。
```

其他重复：

```text
同来源重复
第三载体
哈希漂移
其他 FVO ref 重复
全部 fail-closed。
```

FVO-17：

```text
不是合法 alias；
此前是真实语义分叉：
T17 使用 corrected T16 forecast，
S5 observation rebuild 使用 base T16 forecast。
现已修正为 FVO-17 与 R-17 共用 corrected T16 forecast。
```

---

# 5. 正式 RUN_A 失败阶梯

以下 run 都已经消费各自 authority。禁止 rerun、禁止复用身份。

| Run | Authority | 首个失败点 | 结算/修复 |
|---|---|---|---|
| `30736728638` | earlier replacement | top-level await / CJS transform | PR #2750 |
| `30738876293` | earlier replacement | harness validator symbol mismatch | PR #2753，loader pin PR #2755 |
| `30745867826` | REPLACEMENT-003 | legal bootstrap baseline 被误判为不 fresh | PR #2758 |
| `30749559715` | REPLACEMENT-004 | materializer 未绑定 authority；DB identity template 漂移 | PR #2762 |
| `30756390297` | REPLACEMENT-005 | CAP04 next-handoff mismatch；S4/T17 时序错误 | PR #2765 |
| `30758716511` | REPLACEMENT-006 | T17 guard ACL `42501 permission denied` | PR #2768 |
| `30760836890` | REPLACEMENT-007 | execution spec 缺少 `phase_order` | PR #2772 |
| `30778431135` | REPLACEMENT-008 | `CLOSURE_REF_DUPLICATE:FVO-10` | PR #2775 |
| `30781414909` | REPLACEMENT-009 | `CLOSURE_REF_DUPLICATE:FVO-17` | PR #2778 |

上述失败说明：

```text
正式 one-shot workflow 被当成串行调试器，
每次只能暴露最深路径中的下一个错误；
因此必须先完成 PR #2781 的永久 exact-path rehearsal。
```

---

# 6. 下一步计划

## Step 1：修复 PR #2781 当前 CAP-07 request contract

目标：

```text
cap07_readback_execution_adapter_v1.cjs
与
cap07_reader_v1.cjs

对 request payload/context/scope 的合同完全一致。
```

要求：

```text
不要用 optional chaining 或空 scope 兜底；
不要绕过 CAP-07 readback；
不要模拟 10 个 CAP-07 surfaces；
必须由 exact formal path 真实执行。
```

应增加 focused acceptance，至少证明：

```text
all CAP-07 variants receive exact six-key scope
missing scope fails with explicit contract error
request envelope is deterministic
readback returns all required surfaces
reader and adapter use one shared request schema
```

## Step 2：在 PR #2781 内重新运行完整 rehearsal

必须全部 PASS：

```text
static architecture gate
RUN_DEV_A execution
RUN_DEV_A restart/readback
RUN_DEV_A unified matrix
RUN_DEV_A clean drop

RUN_DEV_B execution
RUN_DEV_B restart/readback
RUN_DEV_B unified matrix
RUN_DEV_B clean drop

semantic comparator A/B
integration qualification owner
standard CI
current governance required checks
```

若修改 PR head：

```text
保持相对同一 base 的单提交；
原子替换 head；
更新 PR 描述中的 actual head / tree；
不得积累调试提交链。
```

## Step 3：合并 PR #2781 后做 merged-main rehearsal

PR checks PASS 不等于 merged-main execution path 已证明。

必须在 exact merge SHA 上再次执行 development rehearsal，并取得：

```text
two fresh PostgreSQL PASS
two restart/readback PASS
two clean drops PASS
semantic comparator PASS
integration-owner artifact PASS
```

## Step 4：重建正式 authority chain

PR #2781 合并会改变正式执行对象，因此：

```text
不要直接合并 PR #2780；
不要沿用旧 54-object manifest；
不要假设 REPLACEMENT-010 candidate 仍与 merged path 一致。
```

正确路径：

```text
审计 merged-main exact object set
→ 新 non-effective RUN_A candidate
→ protected merge
→ candidate-to-merge zero file delta
→ independent effectiveness PR
→ protected merge
→ single-use formal authority readback
```

## Step 5：只执行一次新的 Formal RUN_A

仅当：

```text
post-merge development rehearsal PASS
integration-owner qualification PASS
new candidate merged
new effectiveness merged
authority unexpired
main/object set exact
```

才允许：

```text
workflow_dispatch Formal RUN_A exactly once
run_attempt = 1
```

Formal RUN_A terminal success 之前：

```text
RUN_B blocked
comparator blocked
S6 Candidate blocked
R2 blocked
Ledger settlement blocked
MCFT-CAP-08 completion blocked
```

---

# 7. 已踩过的坑与禁止事项

## 7.1 不要再用正式 one-shot run 调试

错误模式：

```text
dispatch formal RUN_A
→ 暴露第一个深层错误
→ 消费 authority
→ correction
→ candidate
→ effectiveness
→ 再 dispatch
```

正确模式：

```text
exact-path non-formal rehearsal
→ two independent DB runs
→ restart/readback
→ comparator
→ integration owner
→ merged-main rehearsal
→ formal authority
→ one-shot formal run
```

## 7.2 每个正式 authority 即使失败也被消费

禁止：

```text
Re-run jobs
rerun failed jobs
duplicate workflow_dispatch
reuse operational identity
reuse logical database identity
reuse physical database identity
edit consumed authority back to effective
```

## 7.3 candidate、effectiveness、dispatch 必须分离

```text
candidate != effective authority
effective authority != executed run
PR checks != merged-main proof
failed artifact != formal result
```

不得在一个 PR 中同时做：

```text
implementation
authority candidate
effectiveness
database execution
formal settlement
```

## 7.4 不要把所有红色 workflow 当成当前失败

仓库存在大量历史 frozen-boundary workflow。新 PR 修改治理对象后，它们可能按旧 blob 正常拒绝。

裁决顺序：

```text
current focused workflow
current required branch contexts
standard CI
exact-path integration workflow
job terminal logs
artifact
```

不要仅凭 GitHub 页面“有红灯”就修改代码。

## 7.5 PR 描述可能已经过时

PR #2781 的 body 中旧 candidate head/tree 与实际 GitHub head 不一致。

永远以：

```text
PR API actual head SHA
compare_commits
actual changed files
workflow run head SHA
```

为准，不以描述文本或聊天记录为准。

## 7.6 不要放宽底层断言掩盖上层装配错误

已经证明的原则：

```text
CAP04 handoff mismatch
→ 修 S4/T17 orchestration
不是放宽 CAP04 assertion

FVO-17 duplicate
→ 修 product-chain forecast binding
不是扩大 closure alias whitelist

CAP-07 scope undefined
→ 修 adapter/reader contract
不是返回空 readback
```

## 7.7 数据库 fresh 不等于 facts=0

合法 fresh platform baseline 可以包含：

```text
bootstrap facts
visibility epoch/index
migrations
security roles
seed identities
```

Fresh 的正确含义：

```text
zero formal Runtime contamination
zero current operational identity contamination
exact DB identity
exact role
exact required relations
exact bootstrap baseline
```

## 7.8 migration 中的 conditional GRANT 不足以证明最终 ACL

若 role 在 migration 之后创建，conditional GRANT 可能未生效。

最终权限事实必须由：

```text
platform security bootstrap whitelist
+
real PostgreSQL ACL acceptance
```

证明。

## 7.9 TypeScript 模块加载必须走统一 loader

Native：

```text
import(file://*.ts)
```

在 exact rehearsal 中已被证明不可用。

PR #2781 已改为：

```text
tsx/esm/api
tsImport()
```

当前 rehearsal 已越过 loader，进入 CAP-07 readback，说明 loader 修复方向有效。不要引入：

```text
compiled substitute
synthetic module list
test-only fake loader
```

## 7.10 不要长时间无结论轮询 CI

正确工作方式：

```text
读取一次当前 job steps
确定正在运行的具体阶段
只在状态变化后更新
完成后读取 terminal logs/artifacts
立即给出裁决
```

不要连续重复查询同一 in-progress step，也不要让“等待 CI”掩盖实际工程状态。

## 7.11 不要信任未落入 GitHub 的工作结果

此前出现过聊天中声称 PR/branch 已建立、但 GitHub 实际不存在的情况。

完成定义必须是：

```text
blob exists
tree exists
commit exists
branch points to commit
PR exists
actual diff verified
workflow evidence exists
```

---

# 8. 关键入口

```text
active handoff
docs/handoff/GEOX-MCFT-CAP-08-S6-HANDOFF.md

formal workflow
.github/workflows/mcft-cap-08-s6-single-run-database-execution.yml

current active development PR
https://github.com/liyongshang44-max/GEOX/pull/2781

blocked effectiveness PR
https://github.com/liyongshang44-max/GEOX/pull/2780

latest merged authority candidate
https://github.com/liyongshang44-max/GEOX/pull/2779

current rehearsal run
https://github.com/liyongshang44-max/GEOX/actions/runs/30792360746
```

Current error files：

```text
scripts/runtime_acceptance/
mcft_cap08_s6_single_run_ports/
cap07_reader_v1.cjs

scripts/runtime_acceptance/
mcft_cap08_s6_single_run_db/
cap07_readback_execution_adapter_v1.cjs
```

Current exact execution path also includes：

```text
scripts/runtime_acceptance/
mcft_cap08_s6_single_run_workflow/
workflow_entrypoint_v1.ts

scripts/runtime_acceptance/
mcft_cap08_s6_single_run_db/
harness_v1.cjs

scripts/runtime_acceptance/
mcft_cap08_s6_single_run_ports/
product_chain_v1.cjs
```

---

# 9. 新对话的最小接手指令

```text
由你接手 MCFT-CAP-08 S6。

先读取：
docs/handoff/GEOX-MCFT-CAP-08-S6-HANDOFF.md

然后通过 GitHub 重新核对：
- current main
- PR #2779 / #2780 / #2781
- PR #2781 actual head
- workflow run 30792360746
- RUN_DEV_A/B job logs and artifacts

当前不要合并 #2780，不要执行 formal RUN_A，不要执行 RUN_B。

先修复 PR #2781 中
cap07_readback_execution_adapter_v1.cjs
与
cap07_reader_v1.cjs
的 request/scope contract，
并取得 two-run exact-path rehearsal、
restart/readback、semantic comparator、
integration-owner artifact 全部 PASS。

之后合并 #2781，执行 merged-main rehearsal，
重新冻结新的 formal candidate/effectiveness，
最后才允许一次正式 RUN_A。
```

---

# 10. 当前总裁决

```text
S1–S5                               COMPLETE / EFFECTIVE
S6 core execution path              IMPLEMENTED
T16 → S4 → T17                      IMPLEMENTED / PROVEN TO REACH
153 receipts                        PROVEN
224 events                          PROVEN
FVO-10 alias                        CORRECTED
FVO-17 forecast binding             CORRECTED
REPLACEMENT-009                     CONSUMED
REPLACEMENT-010 candidate           MERGED / NON-EFFECTIVE
PR #2780 effectiveness              BLOCKED
PR #2781 development rehearsal      ACTIVE / FAILING AT CAP-07 READBACK
Formal RUN_A terminal success       NOT ESTABLISHED
Formal RUN_B                        BLOCKED
Cross-run comparator                BLOCKED
S6 Candidate                        NOT ESTABLISHED
R2 / 730-day retention              NOT ESTABLISHED
24/24 Ledger settlement             NOT ESTABLISHED
MCFT-CAP-08                         NOT COMPLETE
MCFT-CAP-09                         NOT AUTHORIZED
```
