# GEOX MCFT-CAP-09 Continuation Handoff

更新时间：2026-08-06 20:10（UTC+8）

## 0. 文档定位

本文档用于下一对话继续接手 `MCFT-CAP-09 — Shadow-Online Promotion`。

它记录四件事：

1. 当前实际在做什么任务；
2. 已经完成并正式生效了什么；
3. 当前开放 PR 卡在哪里；
4. 下一步合法序列与已经踩过、不得重复的坑。

本文件按以下仓库事实编写：

```text
repository
liyongshang44-max/GEOX

protected main
fafb90c8fdb49023c08ac403ffa28aa9ca4b0bf2

current open Candidate PR
#2927

current Candidate head
ef80b1a19e9edcc5660e4802edc376181104ea51
```

开始后续工作前必须重新确认远端 `main`、PR #2927 head 和 checks 状态。若 `main` 已前移，不得直接沿用本文的 base SHA；应先审查新增提交，再重新冻结边界。

---

## 1. 当前到底在做什么

当前能力线是：

```text
MCFT-CAP-09
Stage 1B Shadow-online Closure
当前切片：MCFT-CAP-09.S4
Restart / Backfill / Stale Detection
```

CAP-09 不是创建第二套 Twin kernel，而是把 CAP-08 已证明的 Replay Runtime 语义推广为受治理的单 scope Shadow-online 运行体。

共享内核语义仍被冻结，包括：

```text
domain model
canonical object contracts
state-transition semantics
forecast / scenario semantics
transaction families
resolve -> E -> H -> A -> B -> G -> C -> barrier
append-only facts and rebuildable projections
idempotency / fencing / checkpoint / revision rules
read-only Operator Runtime API family
```

S4 当前只允许实现：

```text
restart from persisted checkpoint
expired active slot recovery
oldest-first missed-slot backfill
stale / missing Evidence degradation
scheduler lag Runtime Health
no duplicate canonical work
```

当前不允许：

```text
background daemon
cron
server-startup production wiring
public HTTP writer
canonical Runtime transaction
canonical fact write
live device ingestion
Recommendation / Approval / AO-ACT
model activation
crop-health or agronomic claim
```

---

## 2. 当前 authoritative baseline

### 2.1 S3 已正式生效

S3 `Persistent Sequential Scheduler` 已完成 Candidate、protected merge、exact-SHA 和 R2 / 730 天不可变留存。

```text
S3 effective subject
15cdb24667d43cf7c21294d22b68160c6668cf73

S3 exact-SHA / R2 run
31080310315

S3 exact-SHA artifact
8959189326

S3 semantic artifact digest
sha256:f9e47c55cdfe2f2d17e290b68d7a4bcdbd46106e24cf6cc4d372907e902d17e8

R2 readback verified
true

locked-version delete denied
true

retain until
2028-08-05
```

S3 已证明：

```text
durable schedule cursor
oldest-first missed-slot queue
six-key lease / fencing reuse
at most one active RUNNING slot per scope
restart readback
terminal-success no implicit retry
zero canonical fact delta
```

### 2.2 S4 Registry registration 已合并

```text
PR
#2919

merge
881dad9794895c4f50abea358338c440b0ca833e

Registry revision
1.10 -> 1.11
```

该 PR 只登记 S4 transition，不是 S4 Candidate，也不使 S4 生效。

### 2.3 S4 Candidate lifecycle routing 已合并

```text
PR
#2921

merge / current protected main
fafb90c8fdb49023c08ac403ffa28aa9ca4b0bf2
```

它使 S1 / S2 / S3 / S4 / trusted Registry lanes 能正确识别 S4 Candidate，而不把它误判为旧生命周期或 Registry transition。

---

## 3. 当前开放工作：PR #2927

PR #2927 是 S4 Candidate 第三次原子重建：

```text
PR
#2927

base
fafb90c8fdb49023c08ac403ffa28aa9ca4b0bf2

head
ef80b1a19e9edcc5660e4802edc376181104ea51

tree
00b8b7e4b33212d7342bed46b7a51bb9b5354d6e

commits
1

files
11

behind
0

mergeable
true
```

该 Candidate 实现：

```text
读取 persisted NextTick 后再做 recovery / backfill
过期 CLAIMED / RUNNING slot 原位重新绑定
slot_id 与 idempotency_key 保持不变
fencing token 单调增加
旧 owner / 旧 fencing token 失效
同 owner active retry 保持幂等
没有 expired active slot 时回退到 oldest eligible missed slot
restart 复用 durable S3 cursor，不创建新 cursor
stale / missing Evidence 只降级 Runtime Health
scheduler lag = durable cursor next logical time 到 observed wall clock
不产生 crop-health 或 agronomic claim
```

持久化边界：

```text
twin_shadow_online_scheduler_cursor_v1
twin_shadow_online_scheduler_slot_v1
twin_runtime_lease_v1
facts 只读 Evidence ingress
```

没有新 migration 或新 table。

### 3.1 已通过的 #2927 checks

```text
focused S4 workflow
run 31095078446
status SUCCESS

focused artifact
8965094398

focused artifact digest
sha256:5bed38174fd7dbac1e8820412e4626d97d755550ec5a1401b19d77d340c0d97a

S2 Registry lifecycle
SUCCESS

S3 Registry lifecycle
SUCCESS

S4 Registry lifecycle
SUCCESS

Candidate Declaration self-test
SUCCESS

Delivery Policy
SUCCESS

Release Lane
SUCCESS

main ruleset readiness
SUCCESS

CAP-08 authority reconciliation
SUCCESS

standard CI build-test
SUCCESS
```

focused PostgreSQL 16 验收已经证明：

```text
expired active slot recovered
old claim rejected
oldest missed slot first
restart cursor readback
stale database Evidence degraded
scheduler lag Runtime Health
canonical fact delta = 0
background scheduler started = false
```

---

## 4. 当前卡点

PR #2927 当前唯一失败是标准 CI：

```text
standard CI run
31095078694

build-test job
92595010992
SUCCESS

acceptance job
92595359402
FAILURE

acceptance artifact
8965282473

acceptance artifact digest
sha256:26d3cbca2b655307600b5d47bcbe7211c194357ac335463ed25fb695b82413d1
```

失败发生在全量 `test:acceptance` 的 `P1_SMOKE`，精确错误为：

```text
AssertionError [ERR_ASSERTION]:
success smoke 回归失败：report_json.evidence_refs 为空
operation=opl_b06ce6358e134c89a9c7f363972c041a

source
apps/server/scripts/p1_skill_loop_minimal.mjs:575:12
```

在该失败之前，以下均已通过：

```text
commercial runtime startup
services ready
PR18I preflight
C8 backend P0
frontend runtime audit
Controlled Pilot
Stage-1 fixture
P1 idempotency preflight
customer-report wiring
customer-report suite
```

后续许多 acceptance gate 仍继续运行并通过，但整体 suite 因 `P1_SMOKE` 失败而失败，MVP0 release gate 被跳过。

### 4.1 对卡点的当前判断

该失败不是 S4 focused Runtime 语义失败。S4 focused workflow、真实 PostgreSQL recovery/backfill/stale 验收与 server typecheck 均已成功。

更可能的方向是：

```text
P1 smoke fixture / seed 在本次 full-suite 顺序下未产生 report_json.evidence_refs
operation report projection 或 readback 时序出现回归
全量 acceptance 中某个前置步骤污染或重用了 operation 状态
```

但在复现和证据核对前不得直接宣称“与 S4 无关”。必须按 request -> API -> write model -> read model -> acceptance fixture 的顺序定位。

### 4.2 当前禁止动作

```text
不得合并 #2927
不得在 #2927 head 上追加修复 commit
不得 force-push #2927
不得把 focused success 当作 standard CI success
不得跳过 full commercial acceptance
不得因失败看似与 S4 无关就手工豁免
```

---

## 5. 下一步合法计划

### Step 1 — 保全当前失败证据

先下载并审查：

```text
standard CI run 31095078694
acceptance artifact 8965282473
job 92595359402 logs
```

重点保存和比较：

```text
失败 operation opl_b06ce6358e134c89a9c7f363972c041a
operation_plan / task / receipt / evidence projection
report_json.evidence_refs
P1 smoke seed 与前序 acceptance 对数据库的影响
```

### Step 2 — 判断是否可复现于当前 main

在 `main@fafb90c8…` 或等价 clean database 环境运行相关最小链：

```text
P1 smoke seed
successful operation execution
operation report build / readback
assert report_json.evidence_refs non-empty
```

必须区分：

```text
A. main 本身已有独立 P1 回归
B. #2927 的 11 文件边界触发了回归
C. full-suite 顺序或 fixture 污染导致非确定失败
```

### Step 3 — 遵守 immutable Candidate 纪律

无论根因属于 A、B 或 C，#2927 当前 head 已有失败的 required CI，不应追加 commit。

若需要代码或 acceptance 修复：

```text
关闭 #2927，不合并
确认最新 main
从最新 main 创建 fresh branch
原子重建新的 Candidate 或独立前置修复 PR
保持单一 commit 和精确文件边界
重新运行 focused + Registry lanes + standard CI
```

如果根因是 main 独立回归，优先用独立、非 Candidate 修复 PR 关闭 P1 smoke，再从修复后的 main 重建 S4 Candidate。

如果根因确实来自 S4 Candidate，关闭 #2927，并把修复纳入新的 immutable S4 Candidate replacement。

### Step 4 — S4 protected merge 后仍不能直接进入 S5

S4 Candidate 全部 checks 成功并 protected merge 后，仍需：

```text
建立 S4 exact-SHA lifecycle routing
创建 exact-SHA / R2 control plane
绑定 exact merge subject 与 focused artifact
完成 R2 / 730 immutable upload
readback verified
locked-version delete denied
subject status SUCCESS
```

只有 S4 exact-SHA / R2 effectiveness 成立后，才允许 S5 Registry registration。

---

## 6. 已踩过的坑，必须避免

### 6.1 不要把 merge 当成 effectiveness

Candidate merge 只表示实现进入 `main`。每个切片必须完成：

```text
exact merge SHA
Candidate tree = merge tree
focused artifact binding
standard CI binding
semantic artifact digest
R2 / 730 immutable retention
readback
locked-version delete denial
subject success status
```

之后才能授权下一 Registry slice。

### 6.2 失败 PR 不追加 commit

本能力线多次证明，失败后在同一 PR 追加 commit 会破坏：

```text
exact base
single-commit boundary
Candidate Declaration head binding
semantic Blob snapshot
review / CI evidence identity
```

正确动作是关闭、从最新 main 原子重建。

### 6.3 Registry lifecycle 必须先路由

Registry、Candidate、exact-SHA control plane 会触发历史 S1 / S2 / S3 / trusted lanes。未先注册新生命周期时，历史 lanes 会 fail closed。

顺序必须是：

```text
route-only lifecycle repair
protected merge
Registry registration
Candidate
exact-SHA control plane
R2 effectiveness
```

### 6.4 S2 Evidence 语义不可退回旧实现

已冻结语义：

```text
duplicate identity = origin_source_id + role event time
conflict = canonical payload semantic hash 不同
coverage = covered interval buckets / expected interval buckets
不是 selected record count
```

### 6.5 scheduler lag 不是整点差

S4 Candidate 前一版 acceptance 错误地期望 3600 秒。

契约正确值：

```text
durable cursor logical time 12:00
observed scheduler wall clock 13:05
scheduler lag = 3900 seconds
```

不得再次改回 3600。

### 6.6 exact-SHA validator 不要依赖可变 display name

不要严格比较 GitHub workflow display name。应绑定：

```text
run ID
head SHA
event
conclusion
job success
artifact ID
artifact digest
```

### 6.7 validator 自扫描会误报

若 validator 源码包含被禁止的完整 Candidate Declaration 标识或被禁止表达式，它可能扫描到自身并 fail closed。

应动态构造 marker，或只检查真实 HTML declaration block，不要把完整禁用字面写入被扫描文件。

### 6.8 失败 control plane 是代际链，不可覆盖旧代

S3 exact-SHA 修复经历多代失败。不能用“把第一代常量替换成最新失败常量”的方式建模；必须显式记录：

```text
route merge
first failed control plane
second failed control plane
third failed control plane
current repair
```

每一代都绑定独立 merge / head / tree / blobs / run。

### 6.9 artifact digest 必须读取实时 GitHub 元数据

早期曾把 focused artifact digest 记录错误。不得从聊天摘要或手工抄写值直接生成 authority；应从 GitHub run artifact API 读取并锁定。

### 6.10 semantic digest 契约必须与 retention store 一致

CAP-09 exact-SHA 使用既有契约：

```text
对完整 attestation 删除 semantic_artifact_digest 字段
canonicalize
SHA-256
```

不要改成仅对嵌套 `semantic_artifact` 哈希，除非先完成独立架构修订。

### 6.11 retention namespace 不得缺字段

attestation 必须包含：

```text
capability_line_id
slice_id
subject_sha
```

缺少 `capability_line_id` 或 `slice_id` 会导致 retention key 出现空段并以 `UNSAFE_SEGMENT:` fail closed。

### 6.12 长 Base64 和隐藏路径容易损坏对象运输

已遇到：

```text
长 Base64 截断或字节漂移
upload-artifact 默认遗漏 .github 隐藏目录
heredoc 破坏 YAML indentation
artifact 解压多一层目录
```

可靠方式：

```text
runner materializer 生成文件
生成 tarball 保留 .github 路径
同时生成 SHA-256 + Git Blob manifest
下载后二次核对
使用 Git Data API 创建未引用 Blob
最终从受保护 base 原子创建 Tree / Commit
临时 materializer / loader PR 永不合并
```

### 6.13 不要随意修改共享 retention store

S3 摘要失败最终是 S3 attestation 偏离既有契约，不是共享 store 错误。修改共享 store 会影响 CAP-07 / CAP-08 / CAP-09 既有 authority，必须极其谨慎。

### 6.14 shallow merge ref 可能没有 origin/main

GitHub Actions 使用 PR merge ref 或 shallow checkout 时，`origin/main...HEAD` 可能不可用。治理脚本应显式 fetch base，或使用 event 提供的 exact base SHA，不要依赖本地 tracking branch 恰好存在。

---

## 7. 下一位接手者的启动检查清单

```text
1. 确认 main 是否仍为 fafb90c8fdb49023c08ac403ffa28aa9ca4b0bf2
2. 确认 PR #2927 是否仍 open，head 是否仍为 ef80b1a19e9edcc5660e4802edc376181104ea51
3. 确认 standard CI run 31095078694 没有 rerun 或新 attempt
4. 下载 acceptance artifact 8965282473
5. 复核 P1_SMOKE evidence_refs 空值的根因
6. 不在 #2927 上追加 commit
7. 根据根因决定独立 main 修复或 fresh S4 Candidate replacement
8. 全部 checks 成功前不合并
9. S4 merge 后必须另做 exact-SHA / R2 effectiveness
10. S4 effective 前不得进入 S5 Registry
```

---

## 8. 当前权威状态摘要

```text
CAP-08 Stage 1A closure effective              true
CAP-09 S0 effective                            true
CAP-09 S1 effective                            true
CAP-09 S2 database Evidence ingress effective  true
CAP-09 S3 persistent scheduler effective       true
CAP-09 S4 Registry registered                  true
CAP-09 S4 Candidate implemented in open PR     true
CAP-09 S4 Candidate merged                     false
CAP-09 S4 externally effective                 false
CAP-09 S5 Registry authorized                  false
background scheduler authorized                false
canonical write authorized                     false
production startup wiring present              false
```

当前唯一正确目标是：先关闭 #2927 的标准 CI `P1_SMOKE evidence_refs` 失败，再完成一个所有治理、focused 和标准商业 acceptance 均成功的 immutable S4 Candidate。