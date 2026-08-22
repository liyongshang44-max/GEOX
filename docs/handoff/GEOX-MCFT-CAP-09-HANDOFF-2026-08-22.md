# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-22

更新时间：2026-08-22 16:35（UTC+8）

> **CONVERSATION HANDOFF ONLY — NOT REPOSITORY AUTHORITY.** 本文用于恢复工程上下文，不制造新的 authority / effectiveness / activation / crop-stage / epoch / Formal write 权限。若本文与数字孪生总任务书、MCFT-CAP-09 Taskbook、effective Amendments、protected `main`、exact PR head、exact workflow run、Neon live state 或 immutable artifact 冲突，以这些更高权威事实为准。

---

## 0. 当前快照 / 下一对话第一步

```text
repository:
liyongshang44-max/GEOX

protected_main_at_handoff:
a65bb730c1f099e02ff4cec537fd36a1b9ae8aaa

protected_main_merge:
PR #3264 — fix(mcft-cap09): use PostgreSQL 18 client for T4 store schema dump

current_taskbook:
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md

current_phase:
MCFT-9 FINAL QUALIFICATION / FORMAL EXECUTION FRONTIER

current_active_run:
32560854635 — mcft-cap-09-t4r1-rolling-preboundary-capture

current_active_run_subject:
a65bb730c1f099e02ff4cec537fd36a1b9ae8aaa

current_active_run_state_at_handoff:
IN_PROGRESS
static-contract = SUCCESS
protected-main-live-capture = IN_PROGRESS
current step = Execute real pre-boundary soil plus same-cycle GFS capture

fresh_store_provisioning:
PASS — run 32560739905
artifact 9472705933
artifact digest sha256:62aa846fb616e22d5d89056ca5d691d87a4a4c980c9a72f28b32e8ac17a8109b

current qualification generation:
v6 / blocked_v6

actual Formal store generation:
geox_mcft_cap09_s6_formal_t4r1_24h_v2

formal_execution:
NOT STARTED / 0 of 24 real wall-clock ticks

mcft_cap09_complete:
false
```

### 下一对话第一步必须做什么

不要从旧 T3R1、#3255、v4、v5 或旧 rolling artifact 开始。第一步只读取 live facts：

```text
1. protected main 是否仍 == a65bb730c1f099e02ff4cec537fd36a1b9ae8aaa
2. run 32560854635 最终 status/jobs/logs/artifacts
3. 若 rolling PASS：读取新的 T4R1 rolling artifact ID、producer_subject_sha、target_t、expiry
4. 确认 provisioning artifact 9472705933 仍对应当前 subject
5. 然后才启动 fresh v6 persistent 13/13
```

如果 `main` 已漂移，先查明是哪一个 PR/commit 推进了 main；**不要把 a65bb730 的 qualification/rolling 证据错误地宣称为新 SHA 的 exact-subject authority。**

---

## 1. 我们现在到底在做什么

总任务仍是：

```text
MCFT-CAP-09 — Shadow-Online Promotion
目标：STAGE_1B_SHADOW_ONLINE_CLOSURE
最终不可替代验收：REAL O00 → O23，24 个真实 UTC 小时
```

本轮已经从 architecture-development phase 进入 final execution phase。工程纪律已经冻结为：

> **不再设计新架构，只清当前 qualification / Formal path 直接暴露的 blocker，然后直线进入 Formal。**

允许进入 protected `main` 的修改只应属于：

1. 当前 qualification path 直接发现的 blocking defect；
2. 防止 Formal 错误执行的 fail-closed safety fix；
3. Formal completion / final adjudication 本身不可缺少的实现。

不要做 repository spring cleaning，不要继续重命名历史 workflow，不要顺手改治理结构，不要因为“更漂亮”再次漂移 exact subject。

当前目标链：

```text
fresh T4R1 rolling on exact main
    ↓
fresh v6 persistent 13/13
    ↓
subject-bound Graduation
    ↓
post-gate T4R1 rolling candidate
    ↓
Formal NO-GO preflight
    ↓
Formal arm
    ↓
fresh future A0 in actual Formal v2 store
    ↓
REAL O00 → O23
    ↓
24/24 final readback + chronology + no-side-effect proof
    ↓
formal_completion_candidate
    ↓
final read-only adjudication
    ↓
MCFT-CAP-09 COMPLETE
```

---

## 2. T3R1 → T4R1 successor 已经完成的结构性切断

这一轮最重要的工作不是再给 T3R1 打补丁，而是把 active T4R1 从 historical T3R1 operational event source 中彻底解耦。

目标结构已经变成：

```text
HISTORICAL T3R1
  ├─ code retained
  ├─ evidence retained
  ├─ artifacts retained
  └─ operational event source retired from active T4 path

ACTIVE T4R1
  ├─ T4 A0 authority
  ├─ T4 workflow identity
  ├─ T4 rolling producer
  ├─ producer-bound retained-raw rehydration
  ├─ fresh persistent qualification generation
  ├─ T4 Graduation / Formal control-plane
  └─ future REAL Formal execution
```

重要：历史 T3 code/evidence 不要求删除。要求的是 **active T4 path 不得偷偷依赖 T3 workflow trigger、T3 DB secret、T3 database、T3 crop materializer、T3 event route。**

---

## 3. #3258 之后：historical trigger retirement 与 A0 existing-state authority

#3258 完成 historical trigger/control-plane retirement 后，最终 protected-main 上重新做了 T4R1 bootstrap read-only reverify。

代表性成功 run：

```text
32548232758
mcft-cap-09-t4r1-bootstrap-reverify
subject = be121429aeb11fd739c35875149619a0f71ee4d0
status = SUCCESS
```

验证语义不是“再跑 bootstrap”，而是：

```text
READ ONLY
existing A0 intact
no bootstrap rerun
zero DB/provider writes
zero scheduler/runtime writes
```

此前冻结的 existing-state shape 是：

```text
facts = 35
canonical bootstrap = 34
runtime configs = 25
hourly configs = 24
A0 members = 9
A0 ref/hash exact match
T1 reuse = 0
T3 reuse = 0
scheduler = 0
Formal window = NOT STARTED
fresh_bootstrap_rerun_performed = false
```

这一步的意义：切断 T3 历史链后，T4 A0 没有被污染、没有被重建。

---

## 4. T4R1 rolling → producer-bound rehydration 已成立

T4R1 专属 rolling producer 和 dynamic rehydration 已经建立。关键成功链曾包括：

```text
rolling capture run 32509112890 — SUCCESS
rolling rehydration live proof run 32545949190
```

正确语义：

```text
producer_subject_sha = exact producer main
field = field_kbs_mcse_t4r1
zone = zone_kbs_mcse_t4r1_crop_formal_v1
Formal DB writes = 0
scheduler writes = 0
runtime writes = 0
Formal-prefix writes = 0
```

rehydration 必须：

```text
artifact identity verified
producer SHA verified
artifact not expired
retained raw re-read
same decoder / canonicalizer
semantic manifest equality
provider refetch = 0
```

### 一个关键修复：producer SHA 与 consumer SHA 不能错误绑死

第一次 persistent qualification 在 run `32548396403` 失败于：

```text
AM19_CROP_PREFLIGHT_EXACT_SUBJECT_REQUIRED
```

原因不是 crop authority 或 13/13 runner，而是 crop-window preflight 把：

```text
rolling producer subject
==
current qualification consumer subject
```

错误地当成必然相同。

PR #3261：

```text
fix(mcft-cap09): separate crop preflight producer and consumer subjects
commit a00dab55423e968a9273a5cc07c1cd670827876a
```

修复后允许：

```text
authenticated predecessor producer SHA
+
current exact consumer SHA
```

但绝不允许任意 predecessor；producer 必须是 artifact 已认证 identity。原 fail-closed error contract 保留。

live run 后证明：crop-window preflight、retained-raw rehydration、semantic equality 都能跨这个合法 predecessor/consumer seam。

---

## 5. v4/v5 qualification store 的重要教训

### 5.1 v4 不是“脏库事故”，而是已消费完的 immutable qualification generation

run `32550142061` 首次真正进入 persistent production graph 后失败：

```text
AM19_P24_AUDIT_ONLY_RETRY_DB_VERSION_REQUIRED
```

不要把这个 guard 删除，也不要 truncate v4。

只读 Neon 检查证明 v4 已经完整被旧 subject 消费：

```text
subject = cec35325afef39dbd39ad8e39e54e7b5c3ea6a2b
24 scheduler slots
24 terminal ticks
25 state history
24 forecast
24 scenario
blocked lane also non-zero
```

因此正确结论：

> qualification store generation 是一次性证据容器。非 zero-state 且不属于当前 exact subject 时，必须晋级 fresh generation；不能清空、不能覆盖 sentinel、不能 cross-SHA reuse。

### 5.2 v5 fresh qualification 成功完成 13/13

PR #3262 把 T4 persistent qualification 切到 fresh v5 / blocked_v5。随后：

```text
A0 reverify run 32553284142 — SUCCESS
persistent qualification run 32553379098 — SUCCESS
artifact 9470935031
digest sha256:d12a9786c409b4d9d186c031ad49ad0035a63f44f96b1588c42d4ac972bc2393
subject = 5d619007cc3507a24cc62ef8bdce07e3f5df01ca
status = PASS
static_blocker_count = 0
```

13 machine gates 全 PASS：

```text
PERSISTENCE_FREE_24T
PERSISTENT_24T
O00_WARM_START
MODE_A
MODE_B
PARTIAL_PAIR
LATE_EXACT_NO_REWRITE
RESTART
MISSED_SLOT_BACKFILL
IDEMPOTENCY
ZERO_PROVIDER_WAIT
SCHEMA_ENV_PREFLIGHT
FULL_CHAIN_READBACK
```

readback：

```text
24 slots
24 terminal ticks
1 Mode A
23 Mode B
0 failed
25 states
25 checkpoints
25 forecasts
0 decision records
0 approved plans
0 action feedback
0 downstream side effects
formal_database_write_count = 0
future_formal_epoch_selected = false
formal_o00_started = false
final_actual_24h_still_required = true
mcft_cap09_completed = false
```

这证明 accelerated engineering qualification 已经成立，但 **绝不等于 MCFT-9 COMPLETE**。

---

## 6. 为什么 v5 PASS 后没有直接 Formal arm

审查 Formal control-plane 时发现严重历史残留：如果直接 arm，会形成：

```text
T4R1 qualification PASS
    ↓
T3R1 Formal execution
```

当时发现的旧绑定包括：

```text
formal-arm still listened to historical T3 rolling workflow
formal-hourly-evidence still had T3 trigger / T3 DB secret
formal-live-runner normalized to T3R1 Formal DB
old crop materializer / fresh database authority pins remained in Formal orchestration
```

因此正确地 fail-closed，没有启动 Formal。

另一个关键时间语义：已有 T4 bootstrap DB 的 A0/O00 属于过去 epoch（A0 2026-08-21T14:00Z，O00 15:00Z）。它可以保留为 bootstrap/qualification evidence，但不能在 2026-08-22 以后事后 arm 并宣称过去的 O00–O23 是 real wall-clock Formal。

所以 actual Formal 必须使用新的 fresh store generation 和未来 epoch。

---

## 7. #3263：T4R1 Formal control-plane successor cutover

PR #3263 完成了最后一轮 Formal orchestration successor cutover，并已合并。

它的原则是：

> 把已经存在的 T4 authority 接到 Formal orchestration，不复制 canonical Runtime，不重写 scheduler/service/repository。

主要边界：

```text
T4 scope
T4 rolling event source
T4 DB secret
T4 crop authority/materializer V3
T4 fresh-database authority
T4 Graduation
T4 Formal arm
T4 A0
T4 hourly ingress
T4 scheduled live runner
T4 final readback/completion
```

canonical persistent tick service、State/Forecast/Scenario、repositories、lease/fencing、scheduler semantics 没有重构。

### actual Formal store

新 actual Formal generation：

```text
geox_mcft_cap09_s6_formal_t4r1_24h_v2
```

它专供未来 REAL Formal epoch。旧 T4 bootstrap/qualification DB 保留 evidence，不复用为 actual Formal。

### cutover 后必须重新 qualification

#3263 合并必然改变 protected-main subject，因此 v5 只能作为旧 SHA 的 immutable evidence，不能直接授权新 SHA Formal。

所以同一 cutover 同时定义 fresh：

```text
geox_mcft_cap09_s6_accel24t_am19_v6
geox_mcft_cap09_s6_accel24t_am19_blocked_v6
```

下一步必须在最终 exact main 上重新跑 v6 13/13。

---

## 8. fresh store provisioning：PG16/PG18 坑与最终成功

#3263 引入一次性 schema-only provisioning workflow：

```text
mcft-cap-09-t4r1-formal-store-provision
```

设计边界：

```text
CREATE fresh template0 DB
pg_dump --schema-only --no-owner --no-privileges from authoritative T4 schema source
restore schema only
no business row clone
then verify exact 26/26 fingerprints + all governed tables zero-state
```

### 第一次 provisioning 失败

run：

```text
32559734067 — FAILED
```

失败在 schema dump：GitHub runner 是 `pg_dump 16.15`，Neon server 已经是 PostgreSQL `18.6`。pg_dump 会主动拒绝 server-major > client-major。

这不是 Neon permission、schema 或 URL 问题。

### PR #3264 hotfix

```text
fix(mcft-cap09): use PostgreSQL 18 client for T4 store schema dump
head 0a385cc4ab3a76e7af2e9afb66e162cfc1e545c3
1 commit / 1 file / +4 -2
```

只让 dump 使用官方 `postgres:18-alpine` 中的 pg_dump 18；现有 psql 逻辑不动。

#3264 merge 后 protected main：

```text
a65bb730c1f099e02ff4cec537fd36a1b9ae8aaa
```

### provisioning 最终成功

```text
run 32560739905 — SUCCESS
artifact 9472705933
digest sha256:62aa846fb616e22d5d89056ca5d691d87a4a4c980c9a72f28b32e8ac17a8109b
subject a65bb730c1f099e02ff4cec537fd36a1b9ae8aaa
```

三个 fresh stores：

```text
geox_mcft_cap09_s6_formal_t4r1_24h_v2
geox_mcft_cap09_s6_accel24t_am19_v6
geox_mcft_cap09_s6_accel24t_am19_blocked_v6
```

全部已证明：

```text
schema-only restore PASS
26/26 governed tables PASS
exact schema fingerprints PASS
all governed tables zero-state PASS
no qualification row clone
no Formal execution side effect
```

此 provisioning 章节已关闭。不要再重建这些库，除非 live evidence 证明它们被错误写入。

---

## 9. 当前正在运行的 live step

当前 active run：

```text
32560854635
mcft-cap-09-t4r1-rolling-preboundary-capture
subject a65bb730c1f099e02ff4cec537fd36a1b9ae8aaa
```

截至 handoff：

```text
static-contract = SUCCESS
protected-main-live-capture = IN_PROGRESS
exact protected-main T4R1 subject = PASS
private transient R2 bindings = PASS
repository + decoder dependencies = PASS
future target selection = PASS
current step = Execute real pre-boundary soil plus same-cycle GFS capture
```

这一步可能因为它选择的 future target causal lead 而持续一段时间，不应仅凭耗时判 hang。

若 PASS，必须读取 artifact 并确认：

```text
producer_subject_sha == a65bb730c1f099e02ff4cec537fd36a1b9ae8aaa
subject_sha == same exact main
field == field_kbs_mcse_t4r1
zone == zone_kbs_mcse_t4r1_crop_formal_v1
Formal DB writes == 0
scheduler writes == 0
runtime writes == 0
Formal R2 prefix writes == 0
artifact not expired
```

然后该新 artifact 才是 v6 13/13 的 rolling input。

---

## 10. 下一步严格执行顺序

### Step 1 — finish current rolling capture

读取 run `32560854635` terminal result。

若失败：只修该 live capture 直接暴露的 blocker，不扩 architecture。

若成功：记录新 rolling artifact ID / digest / target / expiry / producer SHA。

### Step 2 — fresh v6 persistent 13/13

在 exact protected main `a65bb730...`（若未漂移）上运行：

```text
mcft-cap-09-t4r1-amendment19-persistent-24t-qualification
rolling_artifact_id = NEW artifact from run 32560854635
```

必须使用：

```text
geox_mcft_cap09_s6_accel24t_am19_v6
geox_mcft_cap09_s6_accel24t_am19_blocked_v6
```

目标：

```text
13 / 13 PASS
static_blocker_count = 0
subject == exact current protected main
```

若失败，只修 13/13 直接暴露的 blocker。**不要创建 v7，除非 safety guard 证明 v6 已被失败尝试写成不可复用的 non-zero generation。** 如果 guard 触发，先只读审 DB，再决定 generation rollover。

### Step 3 — Graduation

只有 exact current subject 的 v6 13/13 PASS 后才能生成 subject-bound graduation envelope。

必须绑定：

```text
exact subject SHA
exact T4R1 crop authority/materializer
exact rolling artifact
exact v6 persistent qualification artifact
static_blocker_count = 0
```

### Step 4 — post-gate rolling candidate

Graduation gate open 后，重新获取 post-gate T4 rolling candidate。不要把 pre-graduation rolling artifact自动当作 Formal arm evidence。

### Step 5 — final NO-GO preflight before arm

必须检查：

```text
main drift = 0
A0/bootstrap evidence intact
actual Formal v2 DB identity exact
actual Formal v2 still zero-state before arm/bootstrap
crop window supports entire future O00–O23
rolling candidate causal horizon sufficient
required secrets present
decoder selfcheck PASS
26/26 schema fingerprints exact
historical T1/T3 event route not active in T4 execution graph
scheduler zero / expected pre-arm state
```

任何一项不满足都 NO-GO。

### Step 6 — Formal arm + future A0

arm 必须选择未来 epoch，并满足既有 lead/cutoff contract。不得回填过去的 A0/O00。

actual Formal DB：

```text
geox_mcft_cap09_s6_formal_t4r1_24h_v2
```

A0 必须在 actual Formal v2 fresh state 上建立。

### Step 7 — REAL O00 → O23

这是唯一真正不可 accelerated 的阶段：

```text
REAL O00
O01
...
O23
24 real UTC hours
```

不是 simulator、不是 replay、不是 accelerated clock。

最终必须有：

```text
24 terminal ticks
24 causal snapshots
artifact chronology
State / Forecast / Scenario readback
checkpoint continuity
restart proof
no retroactive rewrite
no Recommendation/Approval/Action/Dispatch side effects
NO_GO scan clean
```

然后才允许：

```text
formal_completion_candidate
→ final read-only adjudication
→ MCFT-CAP-09 COMPLETE
```

---

## 11. 踩过的坑 / 必须避免的回归

### 11.1 不要把 workflow 文件 rename 当作无语义变化

旧 T3 runtime dependency graph 曾把 workflow 文件本身纳入 digest。历史 workflow rename 后，Runtime/provider/assembler没变，但 graph digest失配。

教训：任何 control-plane rename 都先查 dependency graph binding；final phase 不再做无必要 rename。

### 11.2 不要把 producer subject 和 consumer subject机械要求相同

producer-bound retained raw允许“已认证 predecessor producer → current consumer rehydrate”，但必须显式验证 producer identity。既不能强制 same-SHA，也不能放宽成任意 predecessor。

### 11.3 qualification DB 不能跨 SHA 擦除/复用

v4 已证明：non-zero qualification generation 是 immutable evidence。不要 truncate、不要改 sentinel、不要把旧 subject 的成功/失败状态洗成 fresh。

### 11.4 不要因为 accelerated 13/13 PASS 就宣称 Formal COMPLETE

accelerated qualification证明 execution graph；最终 acceptance 仍要求 REAL wall-clock O00–O23。

### 11.5 不要让 T4 qualification 接上 T3 Formal control-plane

这是本轮最危险的潜在错误。必须同时检查 trigger、secret、DB normalization、crop materializer、fresh-database authority、completion readback，不能只改 workflow 名。

### 11.6 过去 epoch 不能事后 arm

已有 bootstrap A0/O00 若已在过去，只能作为 qualification evidence。actual Formal 必须 fresh future epoch。

### 11.7 schema-only provisioning 不等于 clone + truncate

禁止从已资格化 DB data clone 后再 truncate。fresh Formal/qualification store必须从 template0/empty DB开始，只复制 schema，然后现场证明 zero-state。

### 11.8 pg_dump client major 必须兼容 Neon server

Neon 当前 PostgreSQL 18.6；runner 默认 pg_dump 16 会拒绝。provisioning 已固定用 `postgres:18-alpine` dump。不要回退。

### 11.9 不要在 required check 运行时绕 branch protection

Ready 状态可能重新触发 required checks。等待 exact head terminal PASS，再 merge；不要 bypass。

### 11.10 不要因 current rolling capture 耗时就判失败

它会选择 future target并等待 causal pre-boundary窗口。必须读 step/log/terminal conclusion。

### 11.11 不要顺手清理历史 T3 code/docs

历史 evidence/code retained 是合理的。当前要求是 operational route retired，不是删除历史。清理会制造无意义 SHA drift。

---

## 12. 不可回退的语义边界

以下结论继续冻结：

```text
KBS Raw Hourly 实际为 daily batch publication；不要重新假设 hourly publish cadence。
<=6h 只能是 historical/diagnostic freshness，不是 late exact-T authority gate。
late exact-T authority 依赖 provider availability watermark + same-source exact-T + real timing chain + quality + raw-retention-first + conflict fail-closed。
no future leakage
no interpolation
no persistence fill
no source substitution
raw retention before canonicalization
interval_start/end remain exact T
event_time must not be rewritten
available_to_runtime_at / ingested_at must be real time
```

T4R1 active scope：

```text
field_kbs_mcse_t4r1
zone_kbs_mcse_t4r1_crop_formal_v1
```

最终 Formal 仍然是 shadow-online：

```text
no Recommendation side effects
no Approval side effects
no Action/Dispatch side effects
```

---

## 13. 当前完成度判断

可以把当前 MCFT-9 状态理解为：

```text
architecture / canonical core: CLOSED for this phase
T3→T4 successor cutover: CLOSED
T4 existing bootstrap authority: PROVEN
T4 rolling/rehydration mechanism: PROVEN
accelerated persistent qualification: PROVEN on prior exact subject
T4 Formal control-plane successor: MERGED
fresh v6 + actual Formal v2 stores: PROVISIONED / ZERO-STATE
current exact-main rolling capture: IN PROGRESS
fresh v6 13/13 on final subject: NOT YET RUN
Graduation on final subject: NOT YET
Formal arm: NOT YET
REAL O00–O23: NOT STARTED
MCFT-CAP-09 COMPLETE: FALSE
```

剩余工作已经不是“再发明系统”，而是严格执行最终证据链。

---

## 14. 接手者一句话原则

> **先读 run 32560854635 的终态；若 rolling PASS，就用它在未漂移的 exact main 上跑 fresh v6 13/13。不要改架构、不要复用旧 qualification DB、不要把旧 T3 route 接回来、不要提前 arm。只有 final-subject Graduation + post-gate rolling + NO-GO preflight 全部成立后，才允许启动 future REAL O00–O23。**
