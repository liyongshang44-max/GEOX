---
title: "GEOX MCFT-CAP-08 S6 Handoff"
document_id: "GEOX-MCFT-CAP-08-S6-HANDOFF"
repository: "liyongshang44-max/GEOX"
generated_at: "2026-08-04T01:45:00+08:00"
status: "ACTIVE_HANDOFF"
language: "zh-CN"
supersedes:
  - "GEOX-MCFT-CAP-08-S6-HANDOFF-2026-08-03T19:40+08:00"
  - "GEOX-MCFT-CAP-08-S6-HANDOFF-2026-08-03T16:05+08:00"
  - "GEOX-MCFT-CAP-08-S6-HANDOFF-2026-08-02"
  - "GEOX-MCFT-CAP-08-S6-HANDOFF-2026-07-31"
---

# GEOX MCFT-CAP-08 S6 交接文档

> 本文件是 MCFT-CAP-08 S6 的仓库内唯一活动交接入口。  
> 新对话必须先读本文，再通过 GitHub 重新核对 `main`、开放 PR、workflow、artifact、authority 和数据库身份。  
> 不得依据聊天记忆直接推进；不得复用任何已 dispatch、失败、过期或对象集漂移的 authority、operational identity、logical database identity 或 physical database identity。

---

# 0. 当前总裁决

```text
S1–S5                                      COMPLETE / EFFECTIVE
S6 exact-path implementation               MERGED
PR #2781                                   MERGED
PR-head exact-path qualification           ESTABLISHED
merged-main exact-path qualification        ESTABLISHED
56-object development execution baseline   QUALIFIED
RUN_DEV_A fresh PostgreSQL                  PASS
RUN_DEV_A restart/readback                  PASS
RUN_DEV_A unified matrix                    PASS
RUN_DEV_A clean drop                        PASS
RUN_DEV_B fresh PostgreSQL                  PASS
RUN_DEV_B restart/readback                  PASS
RUN_DEV_B unified matrix                    PASS
RUN_DEV_B clean drop                        PASS
A/B semantic comparator                     PASS / DIFFERENCE COUNT 0
integration qualification owner             PASS
PR #2785 observer                           CLOSED / UNMERGED
REPLACEMENT-010                             NON-EFFECTIVE / HELD
PR #2780                                    OPEN / DRAFT / DO NOT MERGE
new Formal RUN_A authority                  ABSENT
Formal RUN_A execution                      NOT ESTABLISHED
Formal RUN_B                                BLOCKED
formal cross-run comparator                 BLOCKED
S6 Candidate                                NOT ESTABLISHED
Candidate Declaration + approval            NOT ESTABLISHED
R2 / 730-day retention                      NOT ESTABLISHED
24/24 Ledger settlement                     NOT ESTABLISHED
MCFT-CAP-08                                 NOT COMPLETE
MCFT-CAP-09                                 NOT AUTHORIZED
```

准确含义：

> `ce9d6b4df8c708c0d4a99bb24846e1bc44b3cf59` 已在两个独立、全新的 PostgreSQL 16 实例中完成完整 development rehearsal，并通过 restart/readback、统一回归矩阵、数据库清理、跨运行语义比较和独立 integration-owner 汇总。该证据满足创建新正式 authority 的技术前驱，但它仍是 `NON_FORMAL` development evidence，不是 Formal RUN_A，不是 hard acceptance，也不允许复活旧 REPLACEMENT-010。

---

# 1. 接手后必须重新核验

## 1.1 预期仓库事实

```text
repository
liyongshang44-max/GEOX

qualified merged-main runtime subject
ce9d6b4df8c708c0d4a99bb24846e1bc44b3cf59

source implementation PR
#2781

source implementation head
4aa7edb19e098404583415328882ddcbff954762

source implementation tree
8edafc35e6e31dc56049a4170baeb35fd4f30e4d

qualified development execution objects
56
```

## 1.2 必须依次检查

```text
1. current main 是什么 SHA；
2. PR #2781 是否仍为 merged，merge SHA 是否为 ce9d6b4d...；
3. 从 ce9d6b4d... 到 current main 是否只存在 handoff / governance 文档变更；
4. 56 个已资格化执行对象相对 ce9d6b4d... 是否零漂移；
5. merge-SHA qualification run 30837192005 是否仍为 terminal success；
6. RUN_DEV_A / RUN_DEV_B / comparator / integration artifacts 是否仍存在且 digest 一致；
7. PR #2785 是否 closed / unmerged；
8. PR #2780 是否仍 open / draft / unmerged；
9. REPLACEMENT-010 是否仍未 effective、未 dispatch；
10. 是否出现新的 formal candidate、effectiveness、workflow dispatch、Formal RUN_A 数据库身份或 formal evidence。
```

事实优先级：

```text
GitHub PR actual head / merge SHA
compare_commits exact boundary
workflow exact checked-out SHA
terminal job steps and logs
artifact IDs, digests and JSON content
Git blob / tree / commit
```

PR body、旧 handoff、聊天记录只用于导航，不是最终事实。

---

# 2. 最终任务

当前目标仍是关闭：

```text
MCFT-CAP-08
S6 Final Two-Run Closure
24-Tick End-to-End Closure
Stage 1A Replay-backed Closure
```

最终正式链仍必须完成：

```text
new Formal RUN_A candidate
independent candidate review
protected candidate merge
candidate-to-merge exact delta proof
independent effectiveness PR
protected effectiveness merge
single-use Formal RUN_A dispatch
fresh independent Formal RUN_B authority and dispatch
formal cross-run semantic comparator
S6 Candidate exact head freeze
Candidate Declaration + independent human approval
R2 / 730-day retention attestation
24/24 Hard Acceptance Ledger settlement
MCFT-CAP-08 closure
```

完整产品链：

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

---

# 3. 当前仓库状态

## 3.1 PR #2781：已合并的实现修复

```text
PR
#2781

state
CLOSED / MERGED

implementation head
4aa7edb19e098404583415328882ddcbff954762

implementation tree
8edafc35e6e31dc56049a4170baeb35fd4f30e4d

merge SHA
ce9d6b4df8c708c0d4a99bb24846e1bc44b3cf59

boundary before merge
1 commit / 26 files / behind_by 0
```

该 PR 建立了永久 exact-path development rehearsal，并修复真实路径逐层暴露的问题；不是只增加 focused mock 或静态字符串检查。

## 3.2 PR #2785：merge-SHA observer

```text
PR
#2785

state
CLOSED / UNMERGED

observer head
7d232382e3c365b89aeb1459e82bca71ebf345e1

changed files
1 workflow observer file

execution subject
ce9d6b4df8c708c0d4a99bb24846e1bc44b3cf59
```

PR #2785 只解决 GitHub connector 无法枚举 `push: main` run 的观测问题。其 workflow 定义位于 observer branch，但每一个执行 job 都显式 checkout exact merge SHA，并在 authority preparation 中验证：

```text
git rev-parse HEAD
==
ce9d6b4df8c708c0d4a99bb24846e1bc44b3cf59
```

因此：

```text
observer head != execution subject
observer PR must never merge
observer workflow file is not product change
artifacts remain valid after PR close
```

## 3.3 PR #2780 / REPLACEMENT-010

```text
PR #2780
OPEN / DRAFT / UNMERGED

old effectiveness head
f00ba3ed3f20f6e7722edd6e3ea854208831c449

old execution object count
54

REPLACEMENT-010
authority effective             false
database execution authorized   false
workflow dispatch authorized    false
runtime gate eligible           false
RUN_B authorized                false
```

旧 54-object chain 不包含 #2781 合入的 56-object execution baseline、State projection reconciliation、CAP-07 envelope 修复、witness selector 修复、bounded artifact hashing 和 comparator normalization。因此：

```text
DO NOT MERGE #2780
DO NOT DISPATCH REPLACEMENT-010
DO NOT RE-RUN ANY CONSUMED FORMAL AUTHORITY
DO NOT START FORMAL RUN_B
```

---

# 4. merged-main exact-path qualification

## 4.1 Workflow

```text
workflow
mcft-cap-08-s6-merge-sha-qualification-observer

run
30837192005

exact subject
ce9d6b4df8c708c0d4a99bb24846e1bc44b3cf59

observer head
7d232382e3c365b89aeb1459e82bca71ebf345e1

evidence class
NON_FORMAL

authority class
DEVELOPMENT_REHEARSAL
```

终态：

```text
prepare 56-object authorities  PASS
RUN_DEV_A execution            PASS
restart/readback A             PASS
unified matrix A               PASS
clean drop A                   PASS
RUN_DEV_B execution            PASS
restart/readback B             PASS
unified matrix B               PASS
clean drop B                   PASS
semantic comparator            PASS
integration owner              PASS
```

## 4.2 两个独立数据库

```text
RUN_DEV_A
geox_mcft_cap08_s6_rehearsal_a_30837192005

RUN_DEV_B
geox_mcft_cap08_s6_rehearsal_b_30837192005
```

两个数据库均：

```text
fresh PostgreSQL 16 instance
independent physical identity
exact migrations
migrator / runner roles
ACL
seed bootstrap
complete product chain
restart/readback
unified matrix
clean drop
absence verified after drop
```

## 4.3 统一回归矩阵

每个 run 均通过：

```text
CJS_MODULE_LOADING
PORT_EXPORT_IMPORT_BINDING
FRESH_BOOTSTRAP_FACTS
AUTHORITY_ARGUMENT_TRANSPORT
PHYSICAL_DATABASE_IDENTITY
T16_S4_T17_INTERLEAVE
T17_GUARD_ACL
EXECUTION_PHASE_ORDER
STATE_PROJECTION_CANONICAL_PAYLOAD
CANONICAL_RECEIPT_CARDINALITY_153
OPERATIONAL_EVENT_CARDINALITY_224
FVO10_CANONICAL_ALIAS
FVO17_CORRECTED_FORECAST_BINDING
EXACT_WITNESS_PRODUCERS_22
RESTART_READ_CONTINUITY
DATABASE_CLEAN_DROP
```

## 4.4 Semantic comparator

```text
semantic digest A
sha256:32c93d4f5ecd1fc50ff94418407767b48b057d77c81bf93dfe3fccf58f0df2f8

semantic digest B
sha256:32c93d4f5ecd1fc50ff94418407767b48b057d77c81bf93dfe3fccf58f0df2f8

difference count
0

semantic equivalence
true
```

Normalization contract：

```text
signed cursor token                 PRESENCE_ONLY
response transport timestamp/hash   EXCLUDED
recovery event instance ref         PRESENCE_ONLY
canonical objects                    FULL_VALUE
canonical receipts                   FULL_VALUE
operational events                   FULL_VALUE
```

该 comparator 没有通过忽略产品对象制造一致性。Canonical objects、153 receipts 和 224 operational events 仍按完整值比较。

## 4.5 Artifacts

```text
RUN_DEV_A
artifact 8865363139
sha256:747ada7c3d7558015d9d985f77f6be45119e97c31b3d68324dc6383ab579ce67

RUN_DEV_B
artifact 8865358556
sha256:f59039fb2d35079ae91c1e3db069fa25599ffe603806736d0880f006024cd6d5

semantic comparator
artifact 8865374104
sha256:2c69d77bdcdd887fa7addbd9f7af8e00ee3748f9fd01104ccc84a7ef2dd19bc7

integration qualification owner
artifact 8865385476
sha256:5bccada8f5713d1ef8a5e6534b1cf2f8165e76a57631c8b7377f6ff2e082a3ed

development authorities
artifact 8865304347
sha256:64ae1d2465fbe01ded3aebb0fa6f3584e361c1d0d87728675401bca92454cfd5
```

Integration artifact 明确记录：

```text
formal_authority_predecessor_satisfied true
formal_authority_created               false
formal_run_executed                    false
hard_acceptance_eligible               false
next legal action
GOVERNANCE_REVIEW_DOUBLE_RUN_REHEARSAL_ARTIFACT_BEFORE_FORMAL_AUTHORITY
```

---

# 5. #2781 修复的真实缺陷

```text
CAP-07 adapter/reader request-envelope mismatch
exact six-key scope transport
CALIBRATION_CANDIDATE / SHADOW_EVALUATION variants
State projection canonical payload divergence
historical State projection guarded reconciliation
assimilation status selector mapping
scenario option_id mapping
T08 E/H/A/B phase projection
R-01 / R-16 residual logical aliases
22-witness diagnostic persistence
37 MB artifact Buffer canonicalization OOM
bounded 1 MiB byte-stream SHA-256
R-17 logical alias → physical object resolution
forecast_run_ref qualification
signed cursor / response transport comparator normalization
```

重要边界：

```text
没有提高 Node memory limit 掩盖 OOM
没有缩小 evidence bundle
没有修改冻结 witness expected contract
没有放宽 FVO-10 / FVO-17 canonical identity
没有模拟 CAP-07 readback
没有模拟 receipts / events
没有使用 source-string-only proof 替代 execution
```

---

# 6. 强制推进方式

以下制度是 S6 当前执行约束，不是可选建议。

## 6.1 永久保留 exact-path development rehearsal

Development rehearsal 必须与正式数据库 workflow 使用相同的：

```text
exact subject checkout
frozen exact object set
PostgreSQL 16 bootstrap
migrations
migrator / runner roles
ACL
physical database identity builder
workflow entrypoint
harness
port bundle
product chain
T16 → S4 → T17 bridge
materialization
closure reader
CAP-07 readback
22 real witness producers
restart/readback
clean database drop
```

唯一允许不同的是：

```text
authority_class = DEVELOPMENT_REHEARSAL
evidence_class  = NON_FORMAL
identity        = fresh disposable
hard_acceptance = false
formal_dispatch = false
```

## 6.2 历史失败必须留在统一矩阵

不能再接受：

```text
focused workflow A PASS
focused workflow B PASS
focused workflow C PASS
→ complete chain first run exposes next defect
```

所有已知缺陷必须由同一个完整 run 的统一矩阵验证。

## 6.3 开发期与最终 authority 分离

开发修复：

```text
one correction PR
→ complete exact-path A/B qualification
```

最终正式 authority：

```text
formal candidate PR
→ independent review
→ protected merge
→ candidate-to-merge zero-delta proof
→ independent effectiveness PR
→ protected merge
→ single-use formal dispatch
```

## 6.4 职责分离

```text
implementation agent
  owns implementation boundary

integration qualification agent
  owns A/B execution, restart, matrices,
  comparator and integration artifact

governance / authority agent
  may act only after independently accepting
  the complete integration artifact

human approver
  owns explicit merge / formal dispatch approval
```

Authority agent 不得只依据 focused CI、static manifest 或 standard CI 签发 authority。

---

# 7. handoff 合并后的 main 处理规则

本 handoff PR 只允许修改：

```text
docs/handoff/GEOX-MCFT-CAP-08-S6-HANDOFF.md
```

它合并后会使 current main SHA 晚于 `ce9d6b4d...`，但不会自动产生新的 runtime qualification。合法处理方式：

```text
1. 比较 ce9d6b4d... 与 current main；
2. 证明差异仅为 handoff / governance 文档；
3. 对 56 个已资格化 execution objects 建立 exact zero-delta proof；
4. 若任何 execution object 变化，merged-main qualification 失效，必须重跑完整 A/B；
5. 若 execution object 零漂移，可继续以 ce9d6b4d... 作为已资格化 runtime subject，
   并从新的 governance main 创建 Formal RUN_A candidate。
```

禁止把“文档 PR 合并”误写成新的产品执行证明。

---

# 8. 下一合法工作包

当前下一工作包不是 Formal RUN_A dispatch，而是：

```text
Formal RUN_A candidate design and freeze
```

执行顺序：

```text
A. 独立接受 artifact 8865385476
B. 证明 current main 对 ce9d6b4d... 的 56 execution objects 零漂移
C. 关闭 / 明确废弃旧 #2780 effectiveness 路径
D. 从当前 governance main 创建新的 Formal RUN_A candidate PR
E. 冻结新的 exact execution subject、object set、authority identity 和 max-dispatch=1
F. candidate focused/static/standard CI 全部通过
G. 独立人类 review 并 protected merge candidate
H. 证明 candidate head → merge SHA 的 exact execution delta 为 0
I. 创建新的独立 effectiveness PR
J. protected merge effectiveness
K. 一次性 dispatch Formal RUN_A
```

新 candidate 必须重新定义，不能继承旧 REPLACEMENT-010：

```text
new authority version
new operational run instance identity
new logical database identity
new physical database template
new candidate blob
new object-set manifest
new semantic digests
new effectiveness object
max_dispatch_count = 1
rerun_authorized = false
RUN_B_authorized = false
```

正式 candidate 的对象总数必须由新 manifest 实际计算，不得机械沿用旧 54 或 development 56 作为最终治理总数。

---

# 9. 正式 RUN_A 成功后的后续链

只有 Formal RUN_A terminal success 后才能：

```text
freeze RUN_A evidence
verify database identity and cleanup policy
create independent Formal RUN_B authority
execute RUN_B on a second fresh PostgreSQL instance
perform formal cross-run semantic comparator
freeze S6 Candidate exact head
issue Candidate Declaration
obtain independent human approval
complete R2 / 730-day retention attestation
settle 24/24 Hard Acceptance Ledger
close MCFT-CAP-08
```

Development comparator 不能替代 formal comparator；development artifacts 不能进入 hard acceptance Ledger。

---

# 10. 禁止事项

```text
DO NOT MERGE PR #2780
DO NOT REVIVE REPLACEMENT-010
DO NOT MERGE PR #2785
DO NOT USE OBSERVER HEAD AS EXECUTION SUBJECT
DO NOT CREATE FORMAL AUTHORITY FROM PR-HEAD-ONLY EVIDENCE
DO NOT DISPATCH FORMAL RUN_A BEFORE NEW EFFECTIVENESS
DO NOT RERUN A CONSUMED FORMAL AUTHORITY
DO NOT START FORMAL RUN_B BEFORE RUN_A TERMINAL SUCCESS
DO NOT COUNT DEVELOPMENT EVIDENCE AS HARD ACCEPTANCE
DO NOT MODIFY RUNTIME WHILE FREEZING AUTHORITY WITHOUT REQUALIFICATION
DO NOT ACCEPT SOURCE-STRING CHECKS AS PRODUCT EXECUTION PROOF
```

---

# 11. 接手执行清单

```text
[ ] Read this handoff
[ ] Verify current main
[ ] Verify #2781 merge SHA ce9d6b4d...
[ ] Verify run 30837192005 terminal success
[ ] Verify artifacts and digests
[ ] Verify A/B database identities differ
[ ] Verify both clean drops PASS
[ ] Verify semantic difference_count = 0
[ ] Verify integration predecessor satisfied = true
[ ] Verify formal authority created = false
[ ] Verify #2785 closed / unmerged
[ ] Verify #2780 still held
[ ] Prove 56 execution objects zero-delta to current main
[ ] Inspect current formal candidate/effectiveness contract before writing
[ ] Create new candidate only on a clean branch from current main
```

---

# 12. 当前结算表

| 工作项 | 状态 |
|---|---|
| S1–S5 | COMPLETE / EFFECTIVE |
| Exact-path development implementation | MERGED |
| PR-head A/B qualification | PASS |
| Merged-main A/B qualification | PASS |
| Restart/readback A/B | PASS |
| Unified matrices A/B | PASS |
| Clean drops A/B | PASS |
| Development semantic comparator | PASS |
| Integration-owner artifact | PASS |
| Old REPLACEMENT-010 | HELD / NON-EFFECTIVE |
| New Formal RUN_A candidate | ABSENT |
| New effectiveness | ABSENT |
| Formal RUN_A | NOT EXECUTED |
| Formal RUN_B | BLOCKED |
| Formal comparator | BLOCKED |
| S6 Candidate | NOT ESTABLISHED |
| R2 / retention | NOT ESTABLISHED |
| 24/24 Ledger | NOT SETTLED |
| MCFT-CAP-08 | NOT COMPLETE |

---

# 13. 一句话交接

> MCFT-CAP-08 S6 的真实完整执行路径已经在 exact merge SHA `ce9d6b4df8c708c0d4a99bb24846e1bc44b3cf59` 上完成两个 fresh PostgreSQL 实例的非正式双运行资格，当前应关闭旧 REPLACEMENT-010，证明 handoff 合并不改变 56 个执行对象，然后重新冻结新的 Formal RUN_A candidate 与独立 effectiveness；不得直接 dispatch，也不得把 development evidence 当作 formal hard acceptance。
