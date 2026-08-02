---
title: "GEOX MCFT-CAP-08 S6 Handoff"
document_id: "GEOX-MCFT-CAP-08-S6-HANDOFF"
repository: "liyongshang44-max/GEOX"
generated_at: "2026-08-02T20:44:00+08:00"
status: "ACTIVE_HANDOFF"
language: "zh-CN"
supersedes:
  - "GEOX-MCFT-CAP-08-S6-HANDOFF-2026-08-02"
  - "GEOX-MCFT-CAP-08-S6-HANDOFF-2026-07-31"
---

# GEOX MCFT-CAP-08 S6 交接文档

> 本文件是 MCFT-CAP-08 S6 的仓库内唯一活动交接文档。  
> 新对话必须先读本文，再通过 GitHub 重新核对 `main`、开放 PR、最近 workflow run 和 authority 原文。  
> 不得根据聊天记忆继续工作，也不得沿用本文之前的日期版 handoff 中的旧 SHA、旧 authority、旧 operational identity 或旧数据库 identity。

---

## 0. 新对话的第一条指令

```text
repository:
liyongshang44-max/GEOX

expected main at handoff:
5704321af7a81db9c870a6f319b7d49fc0a125af

expected main meaning:
Merge PR #2760
MCFT-CAP-08 S6: establish bootstrap-corrected RUN_A authority effectiveness
```

接手后先核验：

```text
1. current main 是否仍为 5704321af7a81db9c870a6f319b7d49fc0a125af；
2. PR #2758、#2759、#2760 是否仍为 merged；
3. 是否已经出现 REPLACEMENT-004 的 workflow_dispatch run；
4. 若出现，是否只有一次 dispatch，run_attempt 是否为 1；
5. 是否有人点击过 Re-run jobs、重复 dispatch 或提前触发 RUN_B；
6. effective authority 是否仍是：
   docs/digital_twin/mcft/cap_08/
   GEOX-MCFT-CAP-08-S6-BOOTSTRAP-CORRECTED-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json
7. authority 是否仍未过期；
8. main 是否包含新的 correction / settlement / authority 提交；
9. 是否存在开放的 MCFT-CAP-08 S6 PR；
10. 当前正式数据库 run 的终态、artifact、database cleanup 和 authority consumption 状态。
```

若 `main` 已前推，先审计新提交，不得直接使用本文中的 SHA 或 dispatch 参数。

---

# 1. 我们正在做什么任务

## 1.1 主任务

当前任务是关闭：

```text
MCFT-CAP-08
S6 Final Two-Run Closure
24-Tick End-to-End Closure
Stage 1A Replay-backed Closure
```

最终要在两个相互独立、全新的 PostgreSQL 16 实例中，对同一冻结正式对象集分别执行：

```text
RUN_A
RUN_B
```

并证明：

```text
B00 bootstrap
→ T00–T23
→ State / Checkpoint / Forecast / Scenario
→ Decision / Approval / Plan / Execution / Outcome
→ 24 Forecast Verification Observations
→ 24 Residual
→ 16 Calibration + 8 Holdout
→ Calibration Candidate
→ Shadow Evaluation
→ 0 Model Activation
→ Recovery / Restart / Late Evidence
→ CAP-07 readback
→ cross-run semantic equality
→ exact closure identity
→ final Candidate
→ R2 / 730-day retention
→ 24/24 Hard Acceptance Ledger settlement
```

## 1.2 当前具体工作包

当前唯一合法动作是：

```text
DISPATCH_BOOTSTRAP_CORRECTED_FORMAL_RUN_A_ONCE
```

当前不是在做：

```text
新的产品 Runtime 实现
新的 qualification 版本
generic CAP-04 重构
RUN_B
cross-run comparator
S6 Candidate
Candidate Declaration
R2 settlement
final Ledger settlement
MCFT-CAP-08 completion
MCFT-CAP-09 authorization
```

---

# 2. 已经完成了什么

## 2.1 S1–S5 与 S6 基础设施

以下能力已完成或有效，不得重做：

```text
S1–S5 implementation / effectiveness
HA mapping and lifecycle
coverage gate
separated witness producers
orchestrator
single-run harness
workflow control plane
qualification / formal port bundle
fresh PostgreSQL bootstrap
153 canonical receipts
7 recovery vectors
10 CAP-07 surfaces
22 per-run witnesses / proof object sets
```

## 2.2 S4/T17 产品转换实现已经完成

旧 handoff 停在 S4/T17 ADR、尚未实现产品 bridge。该状态已过时。

### PR #2743：产品实现

```text
candidate:
07314c708fdb02478b0b6a14580ff553483b18cc

merge:
395ba4887553c505c6ff1fe79a163f33cea9e843

scope:
authority-bound corrected-T16 → T17 product transition
```

已建立：

```text
专用 T17 application seam
双前驱语义
base T16 four-pointer CAS
corrected T16 computation predecessor
single atomic transaction
transition witness persistence
transition uniqueness guard
replay-first classification
bounded SQLSTATE 40001 retry
exact replay zero-write
projection divergence fail-closed
```

### PR #2745：实现 effectiveness

```text
candidate:
0cfefae709d052b72c39fd6f015170552352ee79

merge:
001a6d4385b49a60d604cc69c0779632492ae127
```

S4/T17 产品实现已进入 merged-main effectiveness。

## 2.3 Formal authority chain 已重新开放

### PR #2746：recovery adjudication

```text
merge:
26d94d5c47ce640e80374124bb473d62003cc9a6
```

该 PR 只允许建立一条最终替代 authority chain，不执行数据库。

### PR #2747：最终替代 authority candidate

```text
candidate:
3e604416fcb31e20ea7102f07fdfe71b121550ba

merge:
208ad8ec34cde4e129e66805d47a994141303d24
```

建立了非可执行 authority candidate 与冻结 object set。

## 2.4 CTO 双账户验证裁决已合并

### PR #2748

```text
merge:
af608d3cd89e6621d1d9588bbf0ef754f62f2c89
```

正式原文：

```text
CTO裁决：搁置双账户的验证。
```

准确语义：

```text
independent review requirement   SUSPENDED_BY_CTO_RULING
第二 GitHub 账户验证              不再是当前 S6 阻塞条件
independent review satisfied     false
independent review performed     false
independent review waived        false
永久豁免                          false
```

技术门禁没有放松。仍强制：

```text
focused workflow
standard CI
protected merge
candidate/merge tree equality
two fresh PostgreSQL runs
cross-run equality
R2 / 730-day retention
24/24 Hard Acceptance
final Ledger settlement
```

## 2.5 正式 single-run workflow 与 authority effectiveness 已建立

### PR #2749

```text
merge:
a2dfc3ee1e5d132059379a0a67be2f033388e8b5
```

建立了正式单次数据库执行 workflow 的 merged-main authority effectiveness。

正式 workflow：

```text
.github/workflows/mcft-cap-08-s6-single-run-database-execution.yml
```

注意不要选错历史 workflow：

```text
错误：
mcft-cap-08-s6-single-run-database-execution-harness

正确：
mcft-cap-08-s6-single-run-database-execution
```

---

# 3. 已发生的正式 RUN_A 失败与修复

这些 run 都已消费各自 authority。禁止 rerun、禁止复用身份。

## 3.1 Run 30736728638：pre-harness top-level await

```text
authority gate        PASS
fresh database        PASS
formal harness        NOT ENTERED
database cleanup      PASS
failure:
TOP_LEVEL_AWAIT_CJS_TRANSFORM_UNSUPPORTED
```

根因：

```text
workflow entrypoint 含 top-level await
tsx / esbuild 按 CJS 转译时拒绝
```

修复与结算：

```text
PR #2750
merge:
93eb19f74faed372908764e5e3d2410a2ff50b45
```

## 3.2 Run 30738876293：harness validator symbol mismatch

```text
authority gate        PASS
fresh database        PASS
formal harness        ENTERED
materializer          NOT ENTERED
database cleanup      PASS
failure:
TypeError: validatePortBundleV1 is not a function
```

根因：

```text
harness import:
validatePortBundleV1

port contract actual export:
validateHarnessPortsV1
```

修复与结算：

```text
PR #2753
merge:
6c17cf1043081621609371b6a46c6ecbeb1ad706
```

随后发现 harness contract loader 的 S6 exact pin 仍指向 CTO 裁决前的合法旧 blob。

loader pin 修复：

```text
PR #2755
merge:
d91a1fb52cf4ea3f1f0650f664f4ce94667e1a59
```

保持：

```text
current governance S6 contract blob:
47ff4215d711b229604b29ce6c663e62b59efc39

formal identity S6 basis blob:
9cecc1aa6bd4063b770304f2539bc68a1ed2390c
```

即：

```text
loader 读取当前合法治理契约
formal identity 仍保持原冻结 machine-contract basis
```

## 3.3 Run 30745867826：legal bootstrap baseline 被错误判定为不新鲜

```text
authority gate                 PASS
exact subject checkout         PASS
fresh PostgreSQL bootstrap     PASS
formal harness entered         YES
first failure                  DATABASE_NOT_FRESH
product materializer entered   NO
formal result emitted          NO
database cleanup               PASS
```

该数据库实际是合法 fresh platform baseline：

```text
facts                           11
ACTIVE visibility epochs        1
visibility rows                 11
missing visibility rows         0
canonical Runtime rows          0
legacy migrations applied       71
CAP-07 visibility migration     PASS
relation count                  30
```

错误 predicate：

```text
facts = 0
```

正确 predicate：

```text
允许 exact legal bootstrap baseline：
11 bootstrap facts
完整 visibility
0 formal Runtime rows
0 当前 operational identity / subject / formal run contamination
正确 disposable database name
正确 runner role
所需 relations 全部存在
```

修复与结算：

```text
PR #2758
candidate:
7941af546f64edf1531950d67bafe4f7d07db7b0

merge:
0187c6ad375c4752b67b58259878dfa552384571
```

证据：

```text
authority artifact ID:
8832847712

authority digest:
sha256:53936ff997a713670aa436f63a55f59493f8090ac55f8762c8e2779f04cb6e17

failed-run artifact ID:
8832858695

failed-run digest:
sha256:f6668c3bb8e449b814a8361670efddf87af879ba4de74d7ecb6cd9df442e4962
```

`REPLACEMENT-003` 已消费且永久不可复用。

---

# 4. 当前 authority 状态

## 4.1 PR #2759：REPLACEMENT-004 candidate

```text
candidate:
ef1880a8692a650ab40187b5bfe6d763d88572d0

candidate tree:
d880155fd1aa8107515350d4b07f30908d8b7e44

merge:
519d559ab38503d316509912a82a8fac5d64a161

changed files:
6

object count:
50
```

该 candidate 使用全新身份：

```text
operational run instance:
MCFT-CAP-08-S6-FORMAL-RUN-A-20260802-REPLACEMENT-004

logical database identity:
MCFT-CAP-08-S6-FORMAL-DB-A-20260802-REPLACEMENT-004
```

候选本身不可执行。

## 4.2 PR #2760：REPLACEMENT-004 effectiveness

```text
candidate:
7e237184474c8885f289ad96d89535f42b2b3024

candidate tree:
167e9a32ca6ae20caa1f7cfee511b33db1d2853a

merge:
5704321af7a81db9c870a6f319b7d49fc0a125af

changed files:
5

candidate-to-merge file delta:
0
```

当前 effective authority：

```text
path:
docs/digital_twin/mcft/cap_08/
GEOX-MCFT-CAP-08-S6-BOOTSTRAP-CORRECTED-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json

blob:
037dda835463a3ee9d4f6d653eb7f3bba092229d

record_status:
SINGLE_FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORIZED

max dispatch:
1

run attempt:
1

rerun:
false

duplicate dispatch:
false

RUN_B:
blocked
```

冻结执行对象：

```text
object count:
50

candidate authority blob:
e11631abd32ad8380b0a21a8f40648c2a149327e

object-set manifest blob:
3b48065b48add7d31bafb13142caaa0dc047b2c5

corrected fresh-database port:
a62a8bb58bf623ddbf1cf701792527d156923d1e

corrected harness:
1833c793a10bba383f54200a35cb3f8912b60b94

corrected loader:
27903ddc8566505053e3e6ccf4e8d08dfc576869

port bundle:
2f574588ba3010a94e64f965bb17fc97b3b33c72

database workflow:
47b5f7748c917a099dc92219f1cbd4055bfb4862
```

---

# 5. 当前卡在哪里

当前没有代码或架构卡点。

当前卡在一个必须由 GitHub UI 完成的一次性外部动作：

```text
正式 dispatch REPLACEMENT-004 RUN_A 一次
```

连接器没有创建首次 `workflow_dispatch` 的写接口，因此实施负责人不能假装已触发，也不能用：

```text
Re-run jobs
rerun failed jobs
rerun workflow
```

替代首次正式 dispatch。

交接时仓库 authority 原文仍声明：

```text
database_execution_performed = false
workflow_dispatch_performed = false
formal_run_executed = false
```

因此，在没有新的 Actions run URL 和终态证据前，准确状态是：

```text
REPLACEMENT-004 authority     EFFECTIVE
REPLACEMENT-004 dispatch      NOT YET PROVEN
formal RUN_A result           ABSENT
RUN_B authority               ABSENT / BLOCKED
cross-run comparator          NOT AUTHORIZED
S6 Candidate                  FALSE
Stage 1A closure              FALSE
MCFT-CAP-08 complete          FALSE
```

---

# 6. 下一步计划

## 6.1 第一步：重新核对是否已 dispatch

新对话先检查：

```text
Actions
→ mcft-cap-08-s6-single-run-database-execution
→ event = workflow_dispatch
→ branch = main
→ operational identity contains REPLACEMENT-004
```

若没有 run，使用以下 exact inputs，且只点击一次：

```text
Branch:
main

exact_subject_sha:
0187c6ad375c4752b67b58259878dfa552384571

run_label:
RUN_A

operational_run_instance_id:
MCFT-CAP-08-S6-FORMAL-RUN-A-20260802-REPLACEMENT-004

execution_authority_path:
docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-BOOTSTRAP-CORRECTED-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json
```

## 6.2 第二步：审计 RUN_A

必须逐项验证：

```text
workflow event = workflow_dispatch
branch/ref = main
run_attempt = 1
authority gate = PASS
authority exact blob = expected
exact subject checkout = 0187c6ad...
physical database name uses replacement_004 + GitHub run ID
fresh PostgreSQL bootstrap = PASS
formal harness = entered
materializer = entered
24-Tick formal sequence = complete
153 canonical receipts
22 witnesses / proof sets
7 recovery vectors
10 CAP-07 surfaces
formal result = PASS
hard_acceptance_eligible = true
artifact digests present
database cleanup = PASS
terminal-success witness present
```

若失败：

```text
禁止 rerun
禁止复用 authority
禁止复用 operational identity
禁止复用 logical database identity
先结算失败，再做 correction → candidate → effectiveness
```

## 6.3 第三步：RUN_A terminal success 后才能处理 RUN_B

顺序：

```text
RUN_A terminal PASS
→ immutable RUN_A evidence settlement
→ issue new RUN_B candidate on same corrected subject
→ RUN_B effectiveness
→ dispatch RUN_B once
```

不得复活旧 RUN_B authority；旧 authority 的 subject、harness 或 freshness object set 已过时。

## 6.4 第四步：两个 run 均 PASS 后

```text
formal dual-run execution settlement
→ cross-run comparator implementation authority
→ read-only comparator implementation
→ comparator merged-main effectiveness
```

比较必须覆盖：

```text
semantic payload digest
153-member closure identity
22 proof object sets
16 object-set refs
7 recovery vectors
10 CAP-07 surfaces
formal identity
explicit run-specific exclusion allowlist
mismatch JSON pointers
```

## 6.5 第五步：最终关闭

```text
freeze exact formal S6 Candidate
→ Candidate Declaration
→ CTO 裁决下不等待双账户验证
→ protected merge
→ candidate/merge tree witness
→ R2 / 730-day immutable retention attestation
→ locked-version delete-denied proof
→ 24/24 Hard Acceptance Ledger settlement
→ Stage 1A closure
→ MCFT-CAP-08 complete
```

CAP-09 只有在 CAP-08 正式关闭后才能单独授权。

---

# 7. 踩过的坑与必须避免的事项

## 7.1 不要把远端正式 run 当调试器

已经发生多次：

```text
一次 authority
→ 暴露一个静态缺陷
→ authority 消费
→ correction
→ 新 authority
```

正式 dispatch 前必须完成：

```text
Node / CJS syntax
TypeScript / tsx transform
module export/import shape
full require graph
contract-loader exact pins
production authority gate
fresh-process harness sentinel
synthetic 153 / 1 / 22 / 22
freshness legal-bootstrap fixture
workflow path collision audit
```

## 7.2 一次 dispatch 即消费 authority

无论失败发生在：

```text
entrypoint
loader
harness
freshness predicate
materializer
```

只要完成了正式 workflow dispatch，该 authority 就不能 rerun 或复用。

禁止：

```text
Re-run jobs
rerun failed jobs
duplicate dispatch
reuse operational identity
reuse database identity
```

## 7.3 不要选错 workflow

错误：

```text
mcft-cap-08-s6-single-run-database-execution-harness
Triggered via pull request
Re-run jobs
```

正确：

```text
mcft-cap-08-s6-single-run-database-execution
workflow_dispatch
Run workflow
```

## 7.4 GitHub 表单字段可能视觉截断

输入框显示不完整不代表值正确。

提交前对长字段执行：

```text
click input
Ctrl+A
Ctrl+C
粘贴到文本编辑器
逐字符核对
```

## 7.5 不要把合法 bootstrap facts 当污染

Fresh database 不等于：

```text
facts = 0
```

平台 migration / bootstrap 可合法产生：

```text
11 bootstrap facts
1 ACTIVE visibility epoch
11 visibility rows
```

正式 freshness 关注的是：

```text
0 formal Runtime rows
0 当前 run identity contamination
0 当前 subject contamination
0 formal run identity contamination
```

## 7.6 loader pin 与 formal identity basis 不是同一概念

当前合法语义：

```text
loader S6 pin:
当前 CTO-amended governance contract blob

formal identity S6 basis:
原冻结 machine-contract blob
```

不要为了消除 blob drift 而改写 formal identity。

## 7.7 不要恢复已失效身份

永久不可复用：

```text
REPLACEMENT-001
REPLACEMENT-002
REPLACEMENT-003
以及其 logical database identities
```

当前唯一有效身份是：

```text
REPLACEMENT-004
```

仅在尚未 dispatch 的前提下有效。

## 7.8 不要提前创建 RUN_B

当前：

```text
RUN_B remains blocked = true
replacement RUN_B authority = absent
parallel RUN_A / RUN_B = forbidden
```

RUN_A terminal-success witness 之前禁止 RUN_B candidate。

## 7.9 历史 workflow path collision

新文件名可能误触发旧 exact-boundary workflow，出现红灯。

必须区分：

```text
当前 focused authority gate
required ruleset checks
历史 workflow path collision
```

历史误触发不能掩盖当前门禁失败，也不能为了清红灯篡改旧证明。

## 7.10 Git Data API 运输必须核对 blob SHA

已经发生过：

```text
base64 手工搬运插入空格
末尾换行改变 blob
长载荷未真正写入
错误 blob 成为不可达对象
```

纪律：

```text
local git hash-object
=
GitHub returned blob SHA
=
fetch_blob readback
```

不一致不得创建 tree。

## 7.11 不要把 Draft PR 的失败修复堆成多提交

候选必须尽量保持：

```text
one exact base
one parent
one candidate commit
exact changed-file boundary
```

发现 validator-only 错误时，应从原 base 原子重建 candidate，而不是保留调试提交链。

## 7.12 CTO 双账户裁决不是“审批已通过”

必须继续写：

```text
independent review satisfied = false
independent review performed = false
independent review waived = false
```

它只是不再阻塞当前 S6 closure。

---

# 8. 关键 PR / run / artifact 索引

## 产品实现与 authority chain

```text
#2743  S4/T17 product implementation
merge  395ba4887553c505c6ff1fe79a163f33cea9e843

#2745  S4/T17 implementation effectiveness
merge  001a6d4385b49a60d604cc69c0779632492ae127

#2746  authority chain recovery adjudication
merge  26d94d5c47ce640e80374124bb473d62003cc9a6

#2747  final replacement authority candidate
merge  208ad8ec34cde4e129e66805d47a994141303d24

#2748  CTO dual-account verification deferral
merge  af608d3cd89e6621d1d9588bbf0ef754f62f2c89

#2749  initial authority effectiveness
merge  a2dfc3ee1e5d132059379a0a67be2f033388e8b5
```

## 正式 run correction 链

```text
run 30736728638
failure:
TOP_LEVEL_AWAIT_CJS_TRANSFORM_UNSUPPORTED

#2750
merge:
93eb19f74faed372908764e5e3d2410a2ff50b45
```

```text
run 30738876293
failure:
validatePortBundleV1 is not a function

#2753
merge:
6c17cf1043081621609371b6a46c6ecbeb1ad706

#2755
merge:
d91a1fb52cf4ea3f1f0650f664f4ce94667e1a59
```

```text
run 30745867826
failure:
DATABASE_NOT_FRESH

authority artifact:
8832847712
sha256:53936ff997a713670aa436f63a55f59493f8090ac55f8762c8e2779f04cb6e17

failed-run artifact:
8832858695
sha256:f6668c3bb8e449b814a8361670efddf87af879ba4de74d7ecb6cd9df442e4962

#2758
merge:
0187c6ad375c4752b67b58259878dfa552384571
```

## 当前有效 authority

```text
#2759
candidate:
ef1880a8692a650ab40187b5bfe6d763d88572d0
merge:
519d559ab38503d316509912a82a8fac5d64a161

#2760
effectiveness candidate:
7e237184474c8885f289ad96d89535f42b2b3024
merge:
5704321af7a81db9c870a6f319b7d49fc0a125af
```

---

# 9. 当前状态矩阵

```text
S1–S5                                           COMPLETE / EFFECTIVE
S6 general infrastructure                       IMPLEMENTED
S4/T17 product transition                       IMPLEMENTED / EFFECTIVE
formal single-run workflow                      IMPLEMENTED
CTO dual-account verification                   SUSPENDED
RUN_A REPLACEMENT-001                            CONSUMED / RETIRED
RUN_A REPLACEMENT-002                            INVALID / UNMERGED / NEVER REUSE
RUN_A REPLACEMENT-003                            CONSUMED / RETIRED
bootstrap freshness correction                   MERGED
RUN_A REPLACEMENT-004 candidate                  MERGED
RUN_A REPLACEMENT-004 effectiveness              MERGED / AUTHORIZED
RUN_A REPLACEMENT-004 dispatch                   NOT PROVEN AT HANDOFF
formal RUN_A terminal result                     ABSENT
replacement RUN_B authority                      ABSENT
formal RUN_B                                     FALSE
formal dual-run settlement                       FALSE
cross-run comparator                             FALSE
S6 Candidate                                     FALSE
Candidate Declaration                            FALSE
merge-tree witness                               FALSE
R2 / 730-day retention attestation               FALSE
24/24 Hard Acceptance Ledger settlement          FALSE
Stage 1A closure                                 FALSE
MCFT-CAP-08 complete                             FALSE
MCFT-CAP-09 authorized                           FALSE
```

---

# 10. 新对话推荐开场提示词

```text
由你继续接手 GEOX 的 MCFT-CAP-08 S6。

先完整阅读：
docs/handoff/GEOX-MCFT-CAP-08-S6-HANDOFF.md

然后通过 GitHub 重新核对：

1. current main 是否仍为 5704321af7a81db9c870a6f319b7d49fc0a125af；
2. #2758、#2759、#2760 是否 merged；
3. 是否已存在 REPLACEMENT-004 的正式 workflow_dispatch run；
4. 是否发生 duplicate dispatch 或 rerun；
5. effective authority 是否仍未过期；
6. RUN_B 是否仍 blocked。

当前唯一合法动作是：

若 REPLACEMENT-004 尚未 dispatch：
按 handoff 中的 exact inputs，只 dispatch RUN_A 一次。

若已 dispatch：
立即审计该 run 的 authority gate、exact subject、fresh PostgreSQL、
formal harness、formal result、artifact 和 database cleanup。

不要重新运行任何旧 run，
不要复用 REPLACEMENT-001/002/003，
不要触发 RUN_B，
不要提前实现 comparator、Candidate 或 Ledger settlement。
```

---

# 11. 最终交接裁决

交接时的准确结论：

```text
MCFT-CAP-08 S6 已经完成产品实现、正式 single-run harness、
三轮正式 pre-materializer 缺陷修复，以及 bootstrap-aware freshness correction。

当前 main 已建立 REPLACEMENT-004 的单次、不可 rerun、不可复用 RUN_A authority。

现在没有产品实现卡点。
唯一外部阻塞是：
由 GitHub UI 对正确 workflow 执行一次精确 RUN_A dispatch，
或者在已经 dispatch 的情况下取得并审计其 run URL。

在 RUN_A terminal PASS 之前，RUN_B、cross-run comparator、
S6 Candidate、R2 retention、Ledger settlement 和 CAP-08 completion
全部保持禁止。
```
