# GEOX MCFT-CAP-09 S0 Continuation Handoff

更新时间：2026-08-05 03:12（UTC+8）

## 0. 文档定位

本文档交接当前 MCFT 后端 / 治理主线。

本对话最初接手的是 `MCFT-CAP-08.S6` 最终关闭。该能力线已经完成正式双数据库运行、Cross-Run Comparator、24/24 Hard Acceptance、Candidate / merge tree equality 和 R2 / 730 天留存，并完成 post-closure 导航投影。

当前实际任务已经切换为：

```text
MCFT-CAP-09
Stage 1B Shadow-online Closure
当前阶段：S0 Authorization Candidate 前置治理
```

当前不是 Runtime 实现阶段。当前目标是从已经修正的 trusted Registry 基线，重建一个新的、单提交、非有效的 S0 Authorization Candidate；其 protected merge 和 exact merge-SHA / R2 effectiveness 通过后，才允许考虑 S1。

---

## 1. 当前 authoritative baseline

```text
repository
liyongshang44-max/GEOX

current protected main
d229cbff7d6d974a2dfdbebd4cc93ec1670a052d

current main source PR
#2843 MCFT-CAP-09: correct trusted Registry to existing status paths

#2843 exact head
e2e073ac532854e25d0ba040eaddb719c07bdb2b

#2843 exact tree
3042e6f54cb563c48e3595767710798b0e8af04c

#2843 merge SHA / current main
d229cbff7d6d974a2dfdbebd4cc93ec1670a052d

candidate-to-merge file delta
0
```

不要从更早的 `0c49f528...`、`3968031d...` 或任何关闭未合并 Candidate head 继续开发。新的工作必须先核对远端 `main` 是否仍为上述 SHA；如已前移，应重新审计新 commits 后再冻结边界。

---

## 2. 当前任务到底在做什么

CAP-09 的目标不是复制一套新的数字孪生语义，而是把 CAP-08 已成立的 Stage 1A Replay-backed closure 推进为受治理的 Stage 1B Shadow-online closure。

冻结设计为：

```text
runtime mode
SHADOW_ONLINE

scope
单一 six-key governed scope

formal closure
24 个真实 UTC 小时调度边界
O00 ... O23

formal accelerated clock
禁止

required operational cases
至少一次 restart
至少一次 missed-slot backfill，oldest-first
至少一次 stale-Evidence degradation
至少一次 late / out-of-order append-forward

online readback
State / Forecast / Health

real-world action authority
NONE
```

共享 Replay 语义必须保持不变，包括：

```text
domain model
canonical object contracts
state-transition semantics
forecast / scenario semantics
transaction families
resolve -> E -> H -> A -> B -> G -> C -> barrier
append-only facts / rebuildable projections
idempotency / fencing / checkpoint / revision rules
read-only Operator Runtime API family
```

Stage 1B 只允许替换或新增受控 adapter：

```text
Clock
EvidenceIngress
PersistentSequentialScheduler
ExecutionFeedback read path
Availability / stale / restart / backfill behavior
operational deployment adapter
```

当前尚未授权任何上述实现。

---

## 3. 已完成工作

### 3.1 MCFT-CAP-08 已正式关闭

CAP-08 已建立：

```text
completion subject
67bd71560268046a7fa9a9433ee074ad3999cb71

exact-SHA / R2 workflow
30908130962 / attempt 1 / SUCCESS

exact artifact
8891897316

GitHub artifact digest
sha256:ceb2dc797d6a9a3c54a6476435f9b1cc5f7dd0f08993af3d8ced424c65afe497

semantic artifact digest
sha256:7e9d713631443641f17c06f71c494319c5f442424ba9ec9f426731940d2700f9

Hard Acceptance
24 / 24 EFFECTIVE

R2 retention
730 days
retain until 2028-08-03T12:13:37.980Z
readback verified true
locked delete denied true
```

CAP-08 只证明 `STAGE_1A_REPLAY_BACKED_CLOSURE_COMPLETE`，不自动授权 CAP-09 Runtime。

### 3.2 CAP-09 S0 pre-candidate foundation 已合入

PR #2828：

```text
head
8a01b0a8a9d5ceeb9082200cf32712e1480160c0

merge
abadd19b2bd7460b397acbac6181253732b49fae
```

已建立：

```text
CAP-09 Taskbook
Stage 1B machine scope contract
CAP-08 exact predecessor lock
non-candidate Current Authority seed
non-candidate S0 Delivery Status seed
focused S0 foundation workflow / validator
```

该阶段：

```text
implementation authorized        false
Runtime source authorized        false
Candidate Declaration authorized false
Registry rule present            false at foundation time
```

### 3.3 Trusted Candidate Registry bootstrap 已完成

PR #2832 合入了 CAP-09 Registry entry，但最初错误地预注册了尚不存在的 S1-S6 status 文件。该缺陷后来通过完整控制面修复链关闭。

### 3.4 S0 Candidate lifecycle 已建立

已合入：

```text
#2833 route S0 authorization Candidate lifecycle
merge f238d9f0a6e1c361e31e5952b8c037b292c59554

#2834 remove self-referential Candidate head binding
merge 0c49f5282c3c05c33caf06da93862afaecda760c

#2837 route complete trusted Registry successor lifecycle
merge d5e31c20c356816294b6a902b27ed8dcbe79c42d
```

Candidate head 的正确绑定方式已经冻结为：

```text
PR Declaration V2 candidate_head
GitHub pull_request head SHA
trusted Candidate integrity workflow
exact semantic snapshot blob list
```

Candidate governance blobs禁止包含自己的 commit SHA：

```text
candidate_head_binding_mode = PR_DECLARATION_V2_AND_GITHUB_EVENT
candidate_head_embedded     = false
candidate_head_sha field     absent
```

### 3.5 完整 shared Registry trigger control plane 已修复

在多次关闭未合并尝试之后，PR #2842 完成原子七文件修复：

```text
head
0d3a4a78bd63e5f436867375f7faf2eb4f99665a

merge
3968031dbffbcf547c46e1cb038b97974bd7a937
```

该修复枚举并处理了中央 Registry 变更触发的历史 workflows，包括遗漏过的：

```text
mcft-cap-08-s2-pre-candidate-foundation
```

成熟 resolver 与历史 lifecycle validator 被保留为 CORE module；wrapper 只识别 exact non-candidate control-plane repair，其余场景继续委托原 CORE，保持普通 Candidate fail closed。

### 3.6 Trusted Registry existing-path correction 已生效

PR #2843 已合入当前 main：

```text
authority-set revision
1.6 -> 1.7

authority-set change id
MCFT-CAP-09.S0-EXISTING-STATUS-PATHS-CORRECTION

base Registry blob
e92a5af9e422812b76b6b689b4a2d1b0263a41ab

corrected Registry blob
e066ad7e6ec57f8dae9d0c2a41a492434deec4e0
```

CAP-09 现在只登记 protected main 上实际存在的两个 status 文件：

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-DELIVERY-STATUS-V1.json
```

当前唯一注册 transition：

```text
Current Authority.status
-> AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE
-> mcft-cap-09-s0-authorization
```

S1-S6 路径和 transition rule 必须 append-forward：只有对应 status 文件先存在于 protected main 后，才能单独追加到 Registry。

当前状态仍是：

```text
Candidate transition                 false
Candidate Declaration                absent
implementation authorized            false
Runtime source authorized            false
canonical write authorized           false
live ingestion authorized            false
background scheduler authorized      false
public HTTP writer authorized        false
Model Activation authorized          false
controlled action authorized         false
```

---

## 4. 当前停点 / blocker

### 4.1 没有有效 S0 Authorization Candidate

先前 PR #2835 已关闭且未合并，其 Candidate head：

```text
bda416384971595816f8ac2245149f85708e76d9
```

已永久失效，禁止：

```text
复用该 head
在该 branch 上追加修复提交
重新打开并声称有效
复制旧 Declaration 作为新 Candidate Declaration
```

现在必须从 current main `d229cbff...` 重建新的单提交六文件 Candidate。

### 4.2 当前 main 上存在一条历史 CAP-07 exact-SHA 失败状态

```text
context
mcft-cap-07/exact-sha-attestation

workflow run
30941537913

job
92100852366

failure stage
Derive read-only exact-SHA delivery frontier artifact

error
DELIVERY_AUTHORITY_MARKER_MISSING

transient artifact
8905322012

artifact digest
sha256:2ee8203953904acc4cec999cedbb998308a73a303c6aa6e409a424f16081d511
```

这是 CAP-09 Registry merge 误触发历史 CAP-07 push / exact-SHA workflow 后，CAP-07 finalizer无法从该 CAP-09 merge message中解析 CAP-07 delivery authority marker。

当前判断：

```text
不是 CAP-09 Registry correction 语义失败
不是 CAP-09 Candidate transition
不是 Runtime 或数据库失败
是历史 post-merge workflow lifecycle / applicability 噪声
```

但在提交新的 S0 Candidate 前必须完成以下之一：

```text
A. 修复 CAP-07 exact-SHA workflow，使非 CAP-07 successor merge 正确 NOT_APPLICABLE；
或
B. 通过受信规则明确证明该 commit status 不属于 CAP-09 Candidate required contexts，且不会阻塞 protected merge / effectiveness。
```

禁止直接 rerun 该失败 workflow；同一逻辑重跑只会再次得到 `DELIVERY_AUTHORITY_MARKER_MISSING`。

### 4.3 当前没有 Runtime 技术 blocker

目前卡点在治理控制面：

```text
fresh Candidate identity
complete trigger applicability
historical workflow noise isolation
protected merge + exact-SHA / R2 effectiveness
```

不是算法、数据库或 Shadow-online adapter 实现卡住。

---

## 5. 下一步计划

严格按以下顺序推进。

### Step 1：重新核对 current main 与并行变更

```text
expected main
d229cbff7d6d974a2dfdbebd4cc93ec1670a052d
```

如 `main` 已前移：

1. 读取新增 commits / PR；
2. 区分是否来自 PFE-14 前端并行线；
3. 重新计算 backend governance base tree；
4. 不得把旧六文件 Candidate 直接 rebase 后继续使用。

### Step 2：裁决 CAP-07 exact-SHA post-merge 噪声

先做完整触发与 required-context 审计，不直接改代码：

```text
mcft-cap-07 exact-SHA workflow trigger
CAP-09 Candidate six-file path triggers
branch protection required contexts
pull_request / pull_request_target / push / merge_group ownership
```

只有确认真实 lifecycle 缺口后，才做独立、非 Candidate repair PR。

### Step 3：从修正后的 protected main 重建 fresh S0 Candidate

Exact 六文件边界：

```text
.github/workflows/mcft-cap-09-s0-authorization.yml
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-AUTHORIZATION-CANDIDATE-BOUNDARY-V1.json
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-AUTHORIZATION-CANDIDATE-V1.json
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-DELIVERY-STATUS-V1.json
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S0_AUTHORIZATION.cjs
```

Candidate 要求：

```text
1 commit
6 files
behind main 0
Registry byte delta 0
Taskbook byte delta 0
scope-contract delta 0
predecessor-lock delta 0
Runtime source delta 0
migration delta 0
canonical Runtime data delta 0
database ACL delta 0
```

PR body 必须写 exact Candidate Declaration V2，并绑定：

```text
actual candidate head
actual base main
actual tree
six semantic blob SHAs
focused workflow
standard ci
```

### Step 4：提交前做完整离线 trigger matrix

必须先枚举六文件包会触发的所有 workflows，至少包括：

```text
mcft-cap-09-s0-authorization
mcft-cap-09-s0-pre-candidate-governance
mcft-cap-09-trusted-registry-bootstrap
shared Registry applicability workflows
candidate integrity pull_request_target
release lane pull_request_target
standard ci
```

每条 workflow 必须提前得到预期 disposition：

```text
APPLICABLE
NOT_APPLICABLE
candidate-signal
unsupported / expected fail closed
```

禁止再次依赖远端 CI 每轮只暴露第一个错误。

### Step 5：protected merge 后单独建立 effectiveness

S0 Candidate merged 不等于 effective。

必须执行：

```text
candidate tree == merge tree
exact merge-SHA attestation
R2 / minimum 730-day immutable retention
readback verification
locked-version delete denial
Candidate authority effectiveness
```

只有这些通过后，才可以把 S0 effective state 投影为：

```text
status     IN_PROGRESS
next slice S1
```

### Step 6：S1 只能在 S0 effectiveness 后开始

S1 预计是 adapter contracts，但不得提前修改 Runtime。开始前还要先创建 S1 status seed，再 append-forward 更新 Registry，仅登记已经存在于 protected main 的 S1 status path。

---

## 6. 已踩过的坑，必须避免

### 6.1 不要把远端 CI 当串行调试器

错误模式：

```text
提交
-> CI 暴露第一个 workflow
-> 修复
-> 再提交
-> CI 再暴露下一条触发路径
```

正确方式：先枚举完整 path-trigger matrix，在本地 / synthetic Git graph 一次性验证所有 applicability。

### 6.2 不要预注册不存在的 status 文件

Registry fail-closed resolver 会验证 trusted base 上每个 registered status path。S1-S6 文件不存在时提前登记，会直接产生：

```text
BASE_REGISTERED_STATUS_FILE_MISSING
```

正确方式：文件先进入 protected main，Registry rule 后续 append-forward。

### 6.3 不要遗漏间接触发的历史 workflows

#2841 曾遗漏：

```text
mcft-cap-08-s2-pre-candidate-foundation
```

中央 Registry、共享 resolver 或公共 validator 路径变更会触发跨 CAP 历史 workflow。必须仓库级枚举，不只看当前 CAP 文件夹。

### 6.4 不要修改失败 Candidate head

Candidate head 一旦失败或发现边界缺陷：

```text
关闭 PR
不合并
不追加调试提交
从同一或更新后的 protected main 原子重建新 head
```

### 6.5 Candidate blob 不得自引用自身 commit SHA

Git commit 无法包含自己的 SHA。head 绑定只能来自：

```text
PR Declaration
GitHub event head
trusted Candidate integrity
semantic blob snapshot
```

### 6.6 区分 workflow head、execution subject、candidate head、merge SHA

此前 CAP-08 Comparator 曾把 workflow head 与 execution subject 错当同一身份。CAP-09 也必须分别绑定：

```text
trusted base main
candidate head
candidate tree
merge SHA
merge tree
predecessor completion subject
```

### 6.7 不要通过 PR 修改后的 Registry 给同一 PR 授权

Candidate transition 必须由 protected main 上已经存在的 trusted Registry rule授权。Registry bootstrap / correction PR 不能同时成为 Candidate。

### 6.8 避免 base64 文本运输损坏

此前 Registry validator blob 曾因错误 base64 运输成为不可执行乱码。文本治理文件优先使用 UTF-8 blob，并在发布前做：

```text
node --check
JSON parse
YAML parse
Git blob SHA readback
```

### 6.9 历史 push / exact-SHA workflow 必须有 successor applicability

后续 capability merge不应被历史 capability finalizer当成自己的 delivery subject。出现 marker missing 时，先修 lifecycle / applicability，不要盲目 rerun。

### 6.10 不得复用一次性执行 authority

CAP-08 Replacement-001 / 002 的经验继续适用：一次性 authority 无论 success 或 terminal failure，执行次数一旦消费即不可 rerun、不可复用 execution ID。

---

## 7. 并行前端任务线隔离说明

当前有同事并行推进前端任务线：

```text
capability line
PFE-14 Shadow-online Operator Console

open PR
#2844 PFE-14: establish Shadow-online Operator Console S0

branch
agent/pfe-14-shadow-online-operator-console
```

该任务线是独立的 frontend capability line，不属于本 handoff 的 MCFT-CAP-09 backend / control-plane 边界。

本任务必须遵守：

```text
不要修改其 branch
不要替同事 rebase / force-push
不要关闭或合并 #2844
不要把 PFE-14 文件带入 CAP-09 Candidate
不要因为 PFE-14 CI 状态改变 CAP-09 authority 判断
不要让前端文案或 UI 假设反向定义 backend Runtime 已实现能力
```

PFE-14 可以提前冻结 UI contract，但必须继续明确：

```text
MCFT-CAP-09 尚未实现的字段，不得由前端伪造为 Runtime truth
Scheduler / Evidence Freshness / Backfill / Recovery UI authority 尚未成立
```

若 PFE-14 合并导致 `main` 前移：

```text
只重新计算 CAP-09 governance base
不吸收前端文件
不把前端变化解释为 CAP-09 implementation authority
不代替前端同事修其任务线
```

两条线只在正式定义的 read contract 与 predecessor gate 上协同，不共享 Candidate boundary。

---

## 8. 关键 PR / SHA 索引

```text
CAP-08 final completion Candidate     #2816
CAP-08 post-closure navigation        #2825
CAP-09 S0 foundation                  #2828 / merge abadd19b...
CAP-09 trusted Registry bootstrap     #2832 / merge fa26f024...
S0 Candidate lifecycle                #2833 / merge f238d9f0...
non-self-reference correction         #2834 / merge 0c49f528...
invalid first S0 Candidate            #2835 / closed unmerged
complete Registry successor lifecycle #2837 / merge d5e31c20...
complete trigger control plane        #2842 / merge 3968031d...
existing-path Registry correction     #2843 / merge d229cbff...
parallel frontend S0                  #2844 / separate line
```

关闭未合并的控制面探索 PR 还包括：

```text
#2836
#2838
#2839
#2840
#2841
```

这些 PR 可用于根因历史，不得复用其 heads 作为正式 Candidate。

---

## 9. 当前明确 nonclaims

当前仓库没有建立：

```text
CAP-09 S0 effective authority
CAP-09 S1 implementation authority
production Shadow-online Runtime
live Evidence ingestion
persistent background scheduler
24-hour formal online closure evidence
automatic recommendation
approval
AO-ACT
real-world dispatch
Model Activation
canonical production writer
public HTTP writer
CAP-09 completion
```

---

## 10. 接手者第一条操作指令

```text
1. git / GitHub 核对 current main
2. 审计 d229cbff... 上 CAP-07 exact-SHA failure 的 applicability
3. 枚举 fresh S0 Candidate 六文件完整 trigger matrix
4. 只在所有 disposition 离线成立后，原子重建一个新的 S0 Candidate
```

不要直接修改 Runtime，也不要直接从旧 `agent/mcft-cap09-s0-authorization-candidate` branch 继续。
