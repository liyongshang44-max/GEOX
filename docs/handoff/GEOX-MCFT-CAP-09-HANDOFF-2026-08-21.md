# GEOX MCFT-CAP-09 Conversation Handoff — 2026-08-21

Status: **CONVERSATION HANDOFF ONLY — NOT REPOSITORY AUTHORITY**

本 handoff 汇总本轮从 fresh-v4 Amendment-19 qualification、producer-bound rehydration 非确定性、ET0 canonical determinism 修复、T3R1 crop-window authority 失效、Alternative Scope Rescue、T4R1 successor authority/runtime rebind、EA5A V3 fresh Formal DB qualification，一直到 **T4R1 fresh bootstrap 已实际业务 PASS、但 workflow 被 post-success Neon connection termination 标红** 的完整工作脉络。

它不是新的规范、不是新的 authority、不是对 Taskbook/Amendment 的替代。下一位接手者必须按仓库 authority hierarchy 重新核验 protected main、live PR/run/artifact/Neon state，再用本文恢复对话上下文。

---

## 1. 当前 exact repository frontier

截至本 handoff 写入前的 live 核验：

```text
repository:
liyongshang44-max/GEOX

protected main:
cec35325afef39dbd39ad8e39e54e7b5c3ea6a2b

main merge:
PR #3253
MCFT-CAP-09: add guarded T4R1 fresh-bootstrap successor

PR #3253 base:
8213ec945c2d25c6441fcf708f88991a157eb76a

PR #3253 head:
e02511f10ee03f15e56360c8db7e89b6897f1af3

PR #3253 merge SHA:
cec35325afef39dbd39ad8e39e54e7b5c3ea6a2b

current live run:
32483760451
workflow:
mcft-cap-09-t4r1-fresh-bootstrap
trigger:
workflow_dispatch on protected main
run head:
cec35325afef39dbd39ad8e39e54e7b5c3ea6a2b
GitHub conclusion:
FAILURE

IMPORTANT BUSINESS RESULT:
bootstrap runner itself emitted PASS before process termination.
The target Formal DB contains the expected bootstrap state.
The red workflow conclusion is currently attributed to a post-success
connection-lifecycle / administrator-termination defect, not to a failed
bootstrap mutation.

bootstrap artifact:
9449271971
artifact exists and must be retained as evidence.
```

当前唯一正确 restart point 是：

> **先冻结并复核 run 32483760451 的成功业务事实与 artifact；修复/裁决 post-success connection lifecycle，使“已经 PASS 的 bootstrap”不会因 cleanup/connection termination 被翻成 workflow failure；不得重新制造第二次 fresh bootstrap。之后从现有 T4R1 A0 state 继续 fresh rolling → producer-bound rehydration → v4 persistent 13/13 → graduation → real O00–O23。**

---

## 2. Authority hierarchy：下一位接手者先读什么

不要把本文当规范。接手顺序仍应是：

1. 数字孪生总任务书 / Complete Agricultural Digital Twin task boundary；
2. MCFT-CAP-09 Taskbook 与当前 Delivery Policy；
3. 当前生效 Amendment，尤其 Amendment-19；
4. protected `main @ cec35325...` 上的 authority/config/runtime/workflow code；
5. live GitHub PR / workflow run / artifact；
6. live Neon exact database state；
7. 最后才是本文 handoff。

任何本文与 protected main 或 live evidence 冲突时，以前者为准。

---

## 3. 我们现在到底在做什么任务

当前任务不是：

- 再调查 KBS 是 hourly 还是 daily；
- 等 T3R1 GDD 数周；
- 重跑旧 v3 qualification；
- 重建一个新的 simplified runner；
- 重跑 fresh bootstrap 直到 GitHub 变绿。

当前主线已经收敛为：

```text
MCFT-CAP-09 final completion
    ↓
T3R1 full-window crop authority failed
    ↓
Alternative Scope Rescue
    ↓
T4R1 selected as qualified successor
    ↓
T4R1 lifecycle / geometry / crop / site / reality authority
    ↓
T4R1 production runtime/source/config rebind
    ↓
T4R1 crop semantics bound into existing v4 qualification lane
    ↓
EA5A V3 tooling adoption
    ↓
distinct T4R1 Formal DB
    ↓
26-relation Formal runtime schema qualification
    ↓
global/T1/T3/T4 zero-state
    ↓
repository secret binding
    ↓
T4R1 guarded fresh bootstrap
    ↓
【CURRENT】bootstrap business PASS, workflow red after PASS
    ↓
post-success lifecycle adjudication/fix
    ↓
fresh rolling
    ↓
producer-bound rehydration
    ↓
v4 persistent 13/13
    ↓
subject-bound graduation
    ↓
real wall-clock O00–O23
    ↓
final readback/adjudication
    ↓
MCFT-CAP-09 completion candidate
```

因此当前 frontier 已经越过“能不能建立 T4R1 A0”。

**T4R1 fresh A0 已经实际建立。**

当前要解决的是：

1. 把 run `32483760451` 的业务 PASS 与 GitHub failure 正确分层；
2. 不破坏现有 A0 的前提下修正 harness 的 post-success lifecycle；
3. 以 existing-state read-only/reverify 证明修复；
4. 继续 fresh rolling / v4 qualification。

---

## 4. 本轮前半段：必须保留的历史结论

### 4.1 ET0 rehydration non-determinism 已修

历史 persistent consumer 曾在 producer-bound rehydration semantic manifest equality 上失败。

诊断最终把漂移收敛到：

```text
record family:
future_et0_assumption_v1
```

而不是：

```text
weather retained raw
soil retained raw
provider source identity
```

生产修复 PR #3238：

```text
fix(mcft-cap09): canonicalize ET0 decoder output
```

关键修复：

- 新增 `decode-gfs-v2`；
- 历史 V1 保持不变；
- ET0 canonical value 做明确 decimal normalization；
- rolling / rehydration / Formal A0 / Formal hourly 统一使用同一 canonical decode path；
- 没有降低 semantic hash；
- 没有 consumer-only rounding；
- 没有 simplified runner。

以后若再遇到 hash mismatch，不得通过“重跑一次 PASS”视为修复。

### 4.2 v4 qualification stores 才是当前 qualification generation

必须牢记版本轴不同：

```text
v4 qualification stores
!=
V3 crop authority
!=
V3 A18 materializer
```

当前 accelerated/persistent qualification stores 仍然是：

```text
geox_mcft_cap09_s6_accel24t_am19_v4
geox_mcft_cap09_s6_accel24t_am19_blocked_v4
```

旧 v3 stores 仅保留历史 audit evidence。

**不要因为 T4R1 crop authority 叫 V3，就错误地把 qualification store 退回 v3。**

---

## 5. T3R1 为什么被 supersede

### 5.1 full-window crop preflight 的真实失败

Amendment-19 crop-window preflight 在 T3R1 candidate window 上证明：

```text
O00..O16:
valid

O17:
window spans MID and LATE
```

因此完整 24-slot crop authority 不能唯一成立，必须 fail closed。

这不是 provider failure，也不是 persistence failure。

### 5.2 Branch A phenology reproof

PR #3242 扫描 KBS AgLog：

```text
planting observation:
6966

planting date:
2026-05-20

scope:
T3 / T3R1

pages:
5

records:
150
```

结论：

```text
NO_T3R1_PHENOLOGY_AUTHORITY_CURRENTLY_ESTABLISHED
```

没有足够 direct、spatially bound、temporally bound、mapping-qualified 的 T3R1 current-season phenology authority。

### 5.3 为什么不继续等 T3R1 GDD

GDD observer 仍可作为保底，但不是主线。

Taskbook 要求的是一个合格 External Research Scope 完成真实 O00–O23，并未永久冻结 T3R1。

因此选择 Alternative Scope Rescue 是为了完成任务，不是规避任务。

---

## 6. Alternative Scope Rescue 与 T4R1 successor

扫描前先冻结 deterministic selection rule，再扫描当前季 KBS corn scopes，避免“看完结果再挑最方便的 field”。

最终唯一合格候选：

```text
scope:
T4R1

field identity:
KBS_MCSE_T4R1

planting observation:
6974

planting date:
2026-05-27

hybrid:
43-96P

crop stage for current qualified window:
MID
```

历史 T1R1/T3R1 evidence 保留，但不迁移 canonical state。

T4R1 lifecycle / crop-only geometry / Formal successor authority 已分别通过仓库资格化链。

---

## 7. T4R1 runtime rebind 与 persistent semantics

### 7.1 不只是改 field ID

T4R1 successor 必须同时切换：

- scope identity；
- crop authority；
- site/reality authority；
- geometry；
- runtime config binding；
- A18 crop materialization；
- qualification/graduation subject identity；
- Formal DB identity。

任何只改 `field_id` 的做法都不合格。

### 7.2 PR #3251

PR：

```text
#3251
MCFT-CAP-09: bind T4R1 crop semantics into v4 persistent qualification
```

base：

```text
6fd839dfafb8f62da637dea2b46b0003da680596
```

head：

```text
9bc99b882192a99ed6475d7963dd844479c545eb
```

merge：

```text
bf5c09e0eef5d666d190298cbe7cb4d6655de1e7
```

完成：

- Amendment-19 crop-window preflight 从 T3R1 V2 authority 切到 T4R1 V3；
- 冻结 T4R1 identity；
- 新增独立 T4R1 A18 crop-context materializer V3；
- 历史 T3R1 materializer V2 保持不变；
- canonical runner 接受 V2|V3 successor union，但独立验证 materializer profile；
- graduation classification 绑定 T4R1 crop authority + materialization identity；
- v4 stores 不变；
- persistent-live 在 PR head 上保持 skipped。

这一步解决了一个真实 stale coupling：

> v4 persistent runner 虽然写的是 v4 store，但内部仍可能 materialize 历史 T3R1 A18 crop identity。

不能把“数据库版本正确”误认为“subject semantics 已正确”。

---

## 8. EA5A V3 tooling 与 fresh Formal DB

### 8.1 PR #3252

PR：

```text
#3252
MCFT-CAP-09: adopt T4R1 EA5A V3 tooling without live DB access
```

base：

```text
bf5c09e0eef5d666d190298cbe7cb4d6655de1e7
```

head：

```text
d6f9fe8dce24e6e495a1ad1fb8d4fc39bc8e5dbc
```

merge：

```text
8213ec945c2d25c6441fcf708f88991a157eb76a
```

关键设计：

```text
PR phase = static tooling adoption only
live DB qualification = post-merge separate stage
```

PR workflow 明确：

- 不读取 `DATABASE_URL`；
- 不消费 T4R1 DB secret；
- 不执行 live DB probe；
- 不创建/修改 Neon DB。

这修复了旧 #3250 的 circular dependency 风险。

### 8.2 distinct T4R1 Formal DB

创建：

```text
project:
delicate-glade-62464340

branch:
br-cold-dust-a6j6aymz

database:
geox_mcft_cap09_s6_formal_t4r1_24h
```

创建语义：

```text
TEMPLATE template0
no T1R1 row copy
no T3R1 row copy
no v3 row copy
no v4 row copy
```

初始确认：

```text
public tables = 0
```

---

## 9. 41 tables vs 26 relations：这轮踩过的重要坑

历史上存在两个不同 schema 口径：

1. 早期 EA5A / commercial surface 曾出现 41 public base tables；
2. 后续 Formal runtime persistence closure 冻结为 26 relations。

本轮一度需要重新裁决，不能凭“历史 T3R1 Formal DB 有 41 张表”直接复制。

最终采用当前 authority：

```text
Formal runtime persistence closure = 26 relations
```

而不是早期 41-table commercial schema。

T4R1 DB 的 schema-only qualification 结果：

```text
required_relation_count = 26

columns_fingerprint
= 873a8e86f55d75a04a5f671627e98ae1

constraints_fingerprint
= 7803f7e7706e52eca3ca2aa4290ff5dd

indexes_fingerprint
= ea5b3ba0392fd52fb471bc754e94ed35
```

三项与冻结 runtime schema authority 匹配。

重要原则：

> 不要通过“表数量看起来差不多”判断 schema authority。必须使用冻结 relation set + exact fingerprints。

---

## 10. fresh DB zero-state qualification

schema-only 后执行 read-only fail-closed zero-state proof。

在 secret 绑定之前确认：

```text
facts = 0
state = 0
forecast = 0
checkpoint = 0
scheduler = 0
T1 scope = 0
T3 scope = 0
T4 scope = 0
```

并对 governed public tables 做全表 zero-state 检查。

之后用户人工在 GitHub repository Actions Secrets 中绑定：

```text
GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL
```

Secret 值是 exact T4R1 Neon DB connection string。

**不要把 secret/connection string 写入 handoff、PR body、workflow log 或聊天。**

---

## 11. T4R1 guarded fresh bootstrap successor

### 11.1 为什么不能直接跑历史 T3R1 workflow

历史 live bootstrap workflow 仍绑定：

- T3R1 secret；
- T3R1 database；
- T3R1 execution token；
- T3R1 orchestration assumptions。

即使底层 canonical bootstrap core 已具备 T4R1 successor authority，也不能直接拿旧 workflow 硬跑。

### 11.2 PR #3253

PR：

```text
#3253
MCFT-CAP-09: add guarded T4R1 fresh-bootstrap successor
```

base：

```text
8213ec945c2d25c6441fcf708f88991a157eb76a
```

head：

```text
e02511f10ee03f15e56360c8db7e89b6897f1af3
```

merge：

```text
cec35325afef39dbd39ad8e39e54e7b5c3ea6a2b
```

exact boundary：

```text
4 new files only
```

包括：

- T4R1 fresh-bootstrap execution authority；
- T4R1 successor adapter；
- exact governance gate；
- protected-main workflow。

### 11.3 adapter 设计

没有复制一套新的 bootstrap production core。

successor adapter：

- pin 历史已验收 T3R1 runner blob；
- 只做可审计 T3→T4 identity/authority replacement；
- 最终仍调用同一个 live-soil ingress；
- 最终仍调用同一个 bootstrap persistence service；
- 额外证明 T3 scope 不被污染。

PR 阶段还实际：

```text
materialize generated T4 runner
→ TypeScript compile
→ delete temporary generated runner
```

这样在 live provider 请求前就能抓到 successor adapter 的语法/符号错误。

---

## 12. Fresh bootstrap run 32483760451

用户在 GitHub 手工触发：

```text
workflow:
mcft-cap-09-t4r1-fresh-bootstrap

branch:
main

execution token:
EXECUTE_T4R1_FRESH_BOOTSTRAP
```

run：

```text
32483760451
```

run started：

```text
2026-08-21T12:49:43Z
```

head：

```text
cec35325afef39dbd39ad8e39e54e7b5c3ea6a2b
```

GitHub terminal conclusion：

```text
failure
```

**不要看到 `failure` 就认为 bootstrap 失败。**

---

## 13. 为什么这个 run 看起来“卡了很久”

runner 不是立即写数据库。

它按真实时间选择 logical boundary：

```text
now + 25 minutes
→ ceil to next full hour
```

本次 run 约 12:49Z 启动，因此：

```text
bootstrap logical boundary:
2026-08-21T14:00:00Z
```

soil collection 在 boundary 前约 8 分钟的 authorized point。

因此 run 从 12:49Z 到接近 14:00Z 长时间停留在同一个 GitHub step，是设计行为，不是 runner deadlock。

这轮在等待期间多次查 Neon，数据库保持 zero-state，进一步证明当时尚未进入 persistence。

### 13.1 可观测性问题

当前 workflow 把：

```text
wait-for-soil-boundary
acquire-soil
wait-for-A0-boundary
persist-A0
```

都藏在同一个 step 中。

UI 看起来像“挂住”。

未来可以考虑拆 step 改善 observability，但这不是当前 completion blocker，不要现在为了 UI 漂亮修改 production semantics。

---

## 14. Bootstrap 实际业务结果：PASS

runner 在 connection termination 之前已经明确输出：

```text
status = PASS
```

实际 bootstrap result：

```text
database_write_count = 35
fresh soil evidence = 1
canonical bootstrap writes = 34
runtime configs = 25
hourly configs = 24
A0 members = 9
scheduler slot writes = 0
scheduler cursor writes = 0
Formal window started = false
T1R1 scope = 0
T3R1 scope = 0
crop stage = MID
```

bootstrap logical time：

```text
2026-08-21T14:00:00Z
```

fresh soil observed time：

```text
2026-08-21T13:40:00Z
```

available-to-runtime：

```text
2026-08-21T13:52:00.454Z
```

A0 runtime config：

```text
external_formal_runtime_config_3b2eec25d4ef44cb04867e06
```

A0 hash：

```text
sha256:7414c2341537a9120946501e3f0e46d9570d978b893bb8934449abe3030af851
```

这是真实 fresh T4R1 A0，不是 dry-run。

---

## 15. Neon post-state 已再次只读复核

run 标红后，没有立刻重跑。

先对 exact T4R1 Formal DB 做只读 post-state 核验。

确认：

```text
facts_total = 35
```

其中包括：

```text
twin_runtime_config_v1 = 25
```

其余 canonical A0/state families 合计与 runner 的 34 canonical writes 一致，加 1 条 fresh soil observation，总数为 35。

这说明：

- bootstrap transaction/state 已经实际落库；
- GitHub failure 不是“数据库什么都没写”；
- 也不是“只写了一半”；
- 不应该把目标 DB reset 回 zero-state 再重跑。

注意：早期 preflight 使用过 `twin_lineage_v1` 等历史命名；当前 exact 26-relation closure 的 relation names 不应凭旧名字猜。查询前应先读 current schema/authority。

---

## 16. Artifact 已存在

run `32483760451` 已上传 artifact：

```text
artifact id:
9449271971
```

该 artifact 必须保留，作为首次 fresh T4R1 bootstrap 的 evidence。

不要因为 workflow 红灯就删除 artifact 或重新制造一个“更好看”的首次执行 artifact。

下一位接手者应：

1. fetch artifact metadata；
2. 必要时下载并检查内容；
3. 将 artifact 与 exact run/head/A0 identity 一起纳入 adjudication。

---

## 17. 当前真正 blocker：post-success connection lifecycle

runner 输出 PASS、persisted verification 完成之后，日志出现：

```text
terminating connection due to administrator command
```

随后 process exit code 非零，导致 GitHub workflow conclusion：

```text
failure
```

当前最合理分层：

```text
bootstrap business semantics:
PASS

persisted state:
PASS / present

workflow process lifecycle:
FAIL
```

### 17.1 当前不能过度声称的部分

尚未最终证明：

- 是哪个具体 `pool.end()` / `client.end()` / cleanup callback 把 termination 传播成 exit 1；
- administrator command 来自 Neon compute lifecycle、connection pool teardown 还是 runner cleanup timing；
- 是否需要 production code fix、workflow wrapper fix，还是只需要 existing-state adjudication rule。

所以 handoff 中必须写成：

> **post-success connection lifecycle defect under investigation**

而不是已经定案为某一个函数 bug。

---

## 18. 绝对不要做：直接 rerun fresh bootstrap

这是当前最重要的操作禁令之一。

目标 DB 已经不是 zero-state：

```text
facts_total = 35
```

如果直接 rerun：

- 不再是首次 fresh bootstrap；
- 会进入 existing-state/reverify 或 idempotency path；
- 会混淆首次执行 evidence；
- 可能让后续接手者误以为第二次 run 才是 authority；
- 可能掩盖真正的 lifecycle bug。

因此：

```text
DO NOT rerun run 32483760451 blindly.
DO NOT reset/drop T4R1 Formal DB.
DO NOT recreate A0.
```

正确做法是 existing-state read-only/reverify。

---

## 19. 下一步计划：P0

### P0-A：冻结首次 bootstrap 成功事实

必须把以下 exact evidence 绑在一起：

```text
protected main:
cec35325afef39dbd39ad8e39e54e7b5c3ea6a2b

run:
32483760451

artifact:
9449271971

Formal DB:
geox_mcft_cap09_s6_formal_t4r1_24h

A0:
external_formal_runtime_config_3b2eec25d4ef44cb04867e06

A0 hash:
sha256:7414c2341537a9120946501e3f0e46d9570d978b893bb8934449abe3030af851

logical boundary:
2026-08-21T14:00:00Z
```

### P0-B：定位 lifecycle defect

只读审查：

- T4 successor adapter；
- generated T4 runner；
- historical pinned T3 runner exit/finally path；
- live soil ingress cleanup；
- bootstrap persistence service connection ownership；
- workflow shell error propagation。

目标不是吞掉所有 DB error。

目标是区分：

```text
error before PASS / before persisted verification
=> real failure

connection termination after PASS + exact persisted verification
=> must not retroactively invalidate business PASS without explicit authority
```

### P0-C：修复必须 fail closed

任何修复都不能写成：

```text
catch all errors after bootstrap and exit 0
```

必须只接受可证明的 post-success lifecycle condition。

如果无法严格区分，就宁可保留 failure 并通过单独 adjudication/reverify 建立 authority。

---

## 20. 下一步计划：P1 — existing-state reverify

lifecycle fix/adjudication 后，不重新 fresh bootstrap。

应新增或复用 read-only existing-state proof，验证：

```text
facts = 35
canonical bootstrap facts = 34
runtime configs = 25
hourly configs = 24
A0 members = 9
soil evidence = 1
T1 scope = 0
T3 scope = 0
scheduler writes = 0
Formal O00 started = false
A0 id/hash exact match
```

并证明：

```text
no new writes during reverify
```

如果需要一个 GitHub green evidence run，应是：

```text
READ-ONLY REVERIFY
```

而不是第二次 fresh bootstrap。

---

## 21. 下一步计划：P2 — fresh rolling

只有 bootstrap lifecycle/adjudication 闭合后，才进入 fresh rolling。

要求：

- exact current protected-main subject；
- T4R1 authority V3；
- current A0 identity；
- same canonical production core；
- retained raw evidence；
- decode-gfs-v2；
- ET0 deterministic canonicalization；
- no T1/T3 canonical state migration。

fresh rolling evidence 不得从 predecessor SHA 搬运。

---

## 22. 下一步计划：P3 — producer-bound rehydration

fresh rolling producer artifact 生成后：

1. consumer 必须绑定 exact producer artifact；
2. retained raw objects 必须相同；
3. semantic manifest 必须 equality；
4. 不允许 provider refetch 替代 retained raw；
5. 不允许 consumer-side alternate decoder；
6. 不允许因历史 ET0 漂移问题而降低 hash。

只有 rehydration PASS 才能打开 v4 persistent write path。

---

## 23. 下一步计划：P4 — v4 persistent 13/13

当前 qualification generation 仍然是：

```text
v4
```

不是 v3。

persistent qualification 必须使用：

```text
geox_mcft_cap09_s6_accel24t_am19_v4
geox_mcft_cap09_s6_accel24t_am19_blocked_v4
```

并绑定：

- exact protected-main SHA；
- T4R1 crop authority；
- T4R1 materializer profile；
- exact rolling producer artifact；
- current A0 subject。

目标：

```text
13/13
```

但 predecessor 13/13 不迁移。

---

## 24. 下一步计划：P5 — graduation

只有 fresh T4R1 v4 qualification 完整通过后，才能 subject-bound graduation。

graduation classifier 已在 #3251 中增加：

- crop authority identity；
- crop context materialization profile；
- exact SHA；
- exact v4 DB generation。

不要退回只检查 SHA + DB name 的旧逻辑。

---

## 25. 下一步计划：P6 — real O00–O23

完成 graduation 后才进入真实 wall-clock Formal：

```text
O00
...
O23
```

不能把 accelerated 24T 当 Formal O00–O23。

accelerated lane 的目的：

- 证明 canonical execution graph；
- 证明 persistence；
- 证明 scheduler/lease/fencing；
- 证明 state propagation/forecast semantics；
- 提前发现 deterministic/runtime defects。

Formal 仍然需要真实时间链。

---

## 26. 当前数据库与版本轴速查

### Formal T4R1 DB

```text
geox_mcft_cap09_s6_formal_t4r1_24h
```

状态：

```text
BOOTSTRAPPED
not zero-state anymore
facts_total = 35
Formal O00 not started
```

### Accelerated/persistent qualification stores

```text
geox_mcft_cap09_s6_accel24t_am19_v4
geox_mcft_cap09_s6_accel24t_am19_blocked_v4
```

用途：

```text
future fresh rolling/rehydration/persistent qualification
```

不要与 Formal DB 混淆。

### Historical v3 stores

仅作为历史 audit evidence。

不要复用。

---

## 27. 这轮踩过的坑：版本号同名误导

最危险的认知错误之一：

```text
V3 authority
=> v3 database
```

这是错的。

当前同时存在：

```text
T4R1 crop authority V3
T4R1 A18 materializer V3
EA5A preflight V3
v4 qualification stores
```

版本号属于不同演化轴。

接手时必须先问：

> 这个 V3/V4 到底修饰的是 authority、materializer、preflight、store generation 还是 schema contract？

---

## 28. 这轮踩过的坑：static governance 自指误判

多次 static gate 失败不是业务错误，而是 gate 自己扫描 workflow 文本时把：

- forbidden token 的自检字符串；
- `paths:` 中的文件名；
- static generated-runner compile command

误认为真实 live mutation。

修复原则：

- 检查语义级命令，而不是裸 `includes(filename)`；
- ordering gate 限定到 live job；
- static proof 显式标记 `STATIC_ADAPTER_PROOF=true`；
- 不因 false positive 放宽真正的 authority gate。

---

## 29. 这轮踩过的坑：GitHub ruleset 同步延迟

#3252/#3253 merge 前出现：

```text
Actions 侧已全部 success
ruleset 仍显示 required checks in progress
```

正确做法：

- 不 bypass；
- 不 force merge；
- 核 exact head/base/main；
- 等 ruleset 同步；
- 用 expected-head SHA 重试 merge。

不要把 ruleset 同步延迟当代码失败。

---

## 30. 这轮踩过的坑：workflow action_required

临时 workflow/修改 workflow 文件曾触发 GitHub Actions `action_required`。

表现：

- run 直接 action_required；
- job 甚至没有创建。

这不是 runtime failure。

临时 patch workflow 必须在候选 payload 中完全删除，不能合入 main。

---

## 31. 这轮踩过的坑：不要篡改历史 V2 materializer

发现 T3R1 A18 materializer V2 写死历史 identity 后，不能直接把 V2 内容改成 T4R1。

正确做法：

```text
keep T3R1 V2 frozen
add T4R1 successor materializer V3
```

否则会把历史 evidence 的语义一起改写。

---

## 32. 这轮踩过的坑：不要提前建 Formal DB

曾经出现想先走 Formal DB 支线的倾向。

正确顺序来自冻结 authority：

```text
successor authority/runtime semantics
→ EA5A tooling adoption
→ distinct empty DB
→ schema-only
→ zero-state
→ secret bind
→ fresh bootstrap
```

不要为了“先准备好”提前创建带状态的 Formal DB。

---

## 33. 这轮踩过的坑：secret 只能人工安全绑定

GitHub connector 当时没有 repository-secret 写接口。

正确处理：

- 从 Neon 控制台复制 exact connection string；
- 用户在 GitHub Actions Secret 页面人工保存；
- 不在聊天中粘贴 secret；
- 不把 connection string commit 到 workflow。

当前 secret 已由用户保存成功。

---

## 34. 这轮踩过的坑：不要把长 wait 当 hang

bootstrap runner 使用真实时间 boundary。

在没有理解 `waitUntil()` 之前，不要因为一个 GitHub step 跑 60–70 分钟就取消。

正确诊断：

- 读 runner boundary selection；
- 查 DB 是否仍 zero-state；
- 判断是在 provider/clock wait 还是 persistence；
- 到预期 collection/A0 时间后再判异常。

---

## 35. 这轮踩过的坑：workflow red != business mutation failed

run `32483760451` 是最典型案例。

必须分层：

```text
GitHub process conclusion
business semantic result
persisted state result
artifact result
```

不能只看 UI 红绿。

但也不能反过来忽略红灯。

正确做法是：

- 保留红灯；
- 查日志中 PASS 出现位置；
- 查 persisted state；
- 查 artifact；
- 修 lifecycle/adjudication；
- 不伪造绿色结果。

---

## 36. 这轮踩过的坑：不要用 rerun 掩盖首次执行证据

如果一次 run 在业务上已经写成功，再 rerun 会改变系统状态。

尤其 fresh bootstrap 是一次性语义。

因此当前 run 不能直接 rerun。

未来任何类似 one-shot workflow，都应该在设计时明确：

```text
first-run mutation mode
existing-state read-only reverify mode
```

不要让“Retry”成为默认修复手段。

---

## 37. 关键 PR 演化链

本轮后半段最重要的 PR 顺序：

```text
#3238
ET0 canonical determinism

#3239
fresh v4 qualification / subject binding

#3241
full crop-window preflight

#3242
T3R1 Branch A phenology reproof

#3243
Alternative Scope Rescue

#3244
T4R1 lifecycle + geometry qualification

#3245
T4R1 Formal successor authority

#3248
T4R1 runtime-rebind routing repair

#3247
T4R1 runtime/source rebind predecessor implementation line

#3251
bind T4R1 crop semantics into v4 persistent qualification

#3252
adopt T4R1 EA5A V3 tooling without live DB access

#3253
add guarded T4R1 fresh-bootstrap successor
```

接手者不要从 #3238 或 T3R1 frontier 重新开始。

---

## 38. 旧 handoff PR #3249

旧 docs-only PR：

```text
#3249
docs(mcft-cap09): hand off T4R1 runtime-rebind frontier
```

它的 base 是：

```text
002f73f96ae5632162675a86518844c111e30d6d
```

其 restart point 停在 #3248/#3247 时代，已经明显落后于：

- #3251；
- #3252；
- #3253；
- T4R1 Formal DB creation；
- zero-state qualification；
- secret binding；
- live bootstrap run `32483760451`。

因此旧 #3249 应被本 handoff supersede，不要继续维护两个互相冲突的 2026-08-21 handoff frontier。

---

## 39. 下一位接手者第一小时建议操作顺序

### Step 1 — exact main

```text
verify protected main == cec35325afef39dbd39ad8e39e54e7b5c3ea6a2b
```

如果 main 已 drift：

- 不直接迁移本文的 exact-subject结论；
- 先判断 drift 是否影响 bootstrap/lifecycle/qualification subject；
- 必要时重新资格化 exact-main-sensitive gates。

### Step 2 — run 32483760451

读取：

- workflow metadata；
- job steps；
- full logs；
- artifact metadata。

确认 PASS 输出在 administrator termination 之前。

### Step 3 — Neon read-only post-state

确认：

```text
facts_total = 35
runtime_config = 25
A0 exact id/hash present
T1 = 0
T3 = 0
scheduler = 0
Formal O00 not started
```

### Step 4 — lifecycle root cause

定位 exact connection ownership/cleanup path。

### Step 5 — minimal fix/adjudication

要求：

- 不重新 bootstrap；
- 不 reset DB；
- 不吞 pre-PASS error；
- 不改 production semantics；
- existing-state read-only proof。

### Step 6 — rolling

只有 P0/P1 闭合后进入 fresh rolling。

---

## 40. 当前 GO / NO-GO 表

```text
T4R1 successor authority:
GO

T4R1 runtime/source rebind:
GO

T4R1 crop semantics in v4 qualification:
GO

EA5A V3 tooling:
GO

T4R1 distinct Formal DB:
GO

26-relation schema:
GO

pre-bootstrap zero-state:
GO

secret binding:
GO

fresh T4R1 bootstrap business semantics:
PASS

fresh T4R1 persisted A0 state:
PASS

fresh bootstrap workflow terminal status:
FAIL due post-success lifecycle issue

rerun fresh bootstrap:
NO-GO

fresh rolling immediately without lifecycle adjudication:
NO-GO

post-success lifecycle fix + read-only reverify:
GO / CURRENT ACTION

v4 persistent 13/13:
NOT STARTED on current T4R1 post-bootstrap subject

Formal O00–O23:
NOT STARTED

MCFT-CAP-09 completion:
NOT YET
```

---

## 41. 不要污染 protected main

当前 exact-main-sensitive evidence 已经绑定：

```text
cec35325afef39dbd39ad8e39e54e7b5c3ea6a2b
```

在 lifecycle fix 设计清楚之前，不要合无关 PR 到 main。

如果必须修改 main：

- 明确记录新的 protected-main SHA；
- 判断哪些 qualification evidence subject-bound；
- 不口头迁移旧 evidence。

---

## 42. 当前完成度的正确表述

可以说：

> T4R1 successor authority、runtime semantics、fresh Formal DB、schema/zero-state、secret binding 和首次 fresh A0 bootstrap 已建立；首次 bootstrap 的业务语义与 persisted state 已 PASS，但 workflow 在 PASS 后发生 Neon administrator connection termination，当前需要闭合 post-success lifecycle/adjudication，然后继续 fresh rolling、v4 persistent 13/13、graduation 和真实 O00–O23。

不要说：

> MCFT-9 已完成。

也不要说：

> fresh bootstrap 失败，什么都没写进去。

两者都不符合 evidence。

---

## 43. 当前最短 completion path

如果 lifecycle defect 可以通过严格、最小、existing-state-safe 的方式闭合，最短路径是：

```text
freeze run 32483760451 + artifact 9449271971
→ lifecycle fix/adjudication
→ read-only bootstrap reverify
→ fresh rolling
→ producer-bound rehydration
→ v4 persistent 13/13
→ graduation
→ real O00–O23
→ final readback
```

不要重新回到：

```text
T3R1 phenology
T3R1 GDD waiting
v3 qualification
new fresh bootstrap DB
```

除非新的 repository authority 明确推翻当前 T4R1 successor。

---

## 44. 最重要的五条接手原则

1. **先看 exact evidence，不看 UI 红绿下结论。**
2. **版本轴分开：V3 authority 不等于 v3 store。**
3. **fresh one-shot 已写成功后绝不盲目 rerun。**
4. **所有 accelerated/persistent path 必须继续调用 production canonical core。**
5. **任何 protected-main drift 都要重新判断 subject-bound evidence 是否可迁移。**

---

## 45. 最终 restart instruction

下一位接手者不要重新做 scope discovery，不要重建 T4R1 DB，不要重新 fresh bootstrap。

从这里开始：

```text
protected main:
cec35325afef39dbd39ad8e39e54e7b5c3ea6a2b

live bootstrap run:
32483760451

artifact:
9449271971

Formal DB:
geox_mcft_cap09_s6_formal_t4r1_24h

A0:
external_formal_runtime_config_3b2eec25d4ef44cb04867e06

A0 hash:
sha256:7414c2341537a9120946501e3f0e46d9570d978b893bb8934449abe3030af851

known state:
bootstrap business PASS
35 facts persisted
GitHub run red after PASS
post-success administrator connection termination under investigation
```

第一项工程任务：

> **定位并闭合 post-success connection lifecycle defect，建立 read-only existing-state bootstrap reverify；不得重新 fresh bootstrap。**

第二项工程任务：

> **从现有 T4R1 A0 开始 fresh rolling → producer-bound rehydration → v4 persistent 13/13。**

第三项工程任务：

> **通过 subject-bound graduation 后启动真实 wall-clock O00–O23，最终完成 MCFT-CAP-09。**

---

## 46. CTO 复盘：当前 completion path、17 天未完成的根因与后续治理修正

> **Post-handoff update — 2026-08-21。** 本章写于原 1–45 章完成之后，用来补充随后发生的 live repository 事实与 CTO 级复盘。它仍然只是 conversation handoff context，不创建新的 repository authority。若本章与 protected main、Taskbook、Amendment、live run/artifact 或 Neon exact state 冲突，始终以后者为准。

### 46.1 原 handoff 之后已经发生的 live 更新

原第 45 章冻结的 protected main 是：

```text
cec35325afef39dbd39ad8e39e54e7b5c3ea6a2b
```

之后 PR #3256 已合并：

```text
PR #3256
fix(mcft-cap09): close T4R1 bootstrap post-success lifecycle

new protected main:
e2252e338a398367927bee4f9cc307b0917a527d
```

#3256 没有重做 fresh bootstrap，也没有重建 A0。它修正的是 post-success connection lifecycle，并新增独立的 protected-main read-only existing-state reverify path。该 reverify 只允许验证现有 35-fact bootstrap state、exact A0/O00 candidate、T1/T3 reuse=0、scheduler/Formal 未启动，并显式要求：

```text
fresh_bootstrap_rerun_performed = false
```

因此原第 17、39、40、41、43、45 章中把 `cec35325...` / lifecycle fix 描述为 CURRENT 的部分，应视为历史快照，而不是接手时的最新 main。

在 #3256 之后又出现当前 Draft：

```text
PR #3257
feat(mcft-cap09): generalize T4R1 rolling rehydration proof

base:
main @ e2252e338a398367927bee4f9cc307b0917a527d

head at this audit snapshot:
3e9f32cb632fdd67cc462fa1ce537988a7913bd7
```

#3257 暴露了一个新的、但本质上属于 control-plane/successor-routing 的阻塞：历史 `mcft-cap-09-rolling-preboundary-capture` workflow event 仍会被历史 Amendment-19 persistent auto-consumer 监听，而该 consumer 的 live path 仍绑定历史 T3R1 parent DB secret。T4R1 fresh capture 不能继续复用这个事件身份，否则可能把 T4R1 producer event 路由到历史 T3R1 consumer。

#3257 的设计因此是：

```text
T4R1-only rolling workflow identity
+
dynamic producer-bound rehydration workflow
+
reuse existing planner / provider collector / candidate assembler /
RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts
```

也就是说，它没有创建第二套 canonical Runtime，也没有改变 schema、T4R1 Formal DB、scheduler、lease/fencing、crop authority 或已有 A0；它是在隔离 successor event routing。

**所以截至这一复盘快照，当前 immediate engineering frontier 已从“修 bootstrap lifecycle”推进到“T4R1 fresh rolling → producer-bound rehydration 的安全 event-isolated control plane”。**

### 46.2 所以现在真正卡在哪

当前不是“MCFT-9 不知道怎么做”。

完成路径已经明确：

```text
T4R1 existing bootstrap read-only reverify
        ↓
T4R1 event-isolated fresh rolling candidate
        ↓
producer-bound retained-raw rehydration
        ↓
fresh v4 persistent qualification
        ↓
13 / 13 PASS
static_blocker_count = 0
        ↓
Formal graduation gate
        ↓
Formal arm
        ↓
REAL O00
        ↓
O01
...
O23
        ↓
final read-only adjudication
        ↓
MCFT-CAP-09 completion
```

#3256 已经把 merge 后的宏观路径明确为：

```text
reverify
→ fresh rolling
→ producer-bound rehydration
→ v4 persistent 13/13
→ graduation
→ real O00–O23
```

#3257 进一步说明，当前 fresh rolling / rehydration 不能直接复用历史 T3R1 auto-trigger identity，而必须先把 T4R1 producer event 与历史 consumer 隔离。

因此当前应使用两层表述：

```text
macro blocker:
final real Formal O00–O23 has not started

immediate engineering frontier:
T4R1-safe fresh rolling → producer-bound rehydration control plane
(PR #3257 at this snapshot)
```

**现在还没有开始最终那一条真实 Formal O00–O23。**

不要把 accelerated/persistent 13/13、historical predecessor 13/13、fresh A0 bootstrap PASS，或后续 read-only reverify 误写成 final Formal closure。

### 46.3 为什么从 2026-08-04 到现在仍未完成：根因排序

MCFT-CAP-09 真正进入 protected-main S0 的起点是 2026-08-04 的 #2828。到本复盘时约 17 天。逐 PR 审计后，根因优先级如下：

| 排名 | 根因 | 严重程度 |
| --- | --- | --- |
| 1 | 治理/control-plane 过度耦合：successor PR 经常被历史 workflow、exact-base、Registry、self-marker、routing、旧 secret/event identity 卡死 | 极高 |
| 2 | Formal Candidate 建得过早，而真实 Evidence / DB / A0 / production runner readiness 在后面才补 | 极高 |
| 3 | KBS publication cadence 初始建模错误，直到 #3101 才正式从 fixed-lag 转为 daily-batch/provider-watermark authority | 极高 |
| 4 | Crop authority 不稳定：T1R1 → T3R1 → T4R1，每次 scope 变更都禁止继承历史 canonical qualification | 极高 |
| 5 | Production-equivalent qualification 太晚：12→26 schema closure、GFS decoder dependencies 等直到真正 Formal 前后才暴露 | 极高 |
| 6 | Qualification harness 与 production contract 漂移，制造多次“产品/持久化行为正确，但验收 harness 错”的 false-negative | 高 |
| 7 | exact-SHA evidence 默认不可迁移：修一个小 runtime/control-plane bug 往往触发 fresh store + fresh rolling + full requalification | 高 |
| 8 | GitHub Actions/API/ruleset/runner 数值环境等基础设施问题进入 critical path | 中高 |
| 9 | 最终 acceptance 本身硬性要求真实 24 个 UTC hourly boundaries，不能由 accelerated lane 取代 | 不可消除 |

这里最需要区分的是：

```text
necessary strictness
!=
necessary rework
```

真实 24h、no future leakage、exact evidence、fail closed、no scope relabel 都属于必要 strictness。

而 historical workflow 自触发、validator self-match、stale exact-base guard、schema contract 在 live epoch 才发现、harness 读取不存在字段、旧 consumer 监听 successor event identity，则属于可以通过更好的开发顺序和 successor-safe control plane 避免的 rework。

### 46.4 最值得批评的不是“做得慢”，而是开发顺序

#### 46.4.1 Formal Candidate 早于 production readiness

2026-08-07 的 #2950 已经命名为：

```text
Formal 24-hour Stage 1B Closure Candidate
```

但紧接着 #2951 就证明，当时合法 Formal 执行仍缺：

```text
governed Evidence writer
A0 / Reality Binding bootstrap
exact hourly Runtime Config
fail-closed preflight
```

因此 Candidate 的命名/生命周期成熟度早于 executable readiness。

后续类似 capability 不应只因为“Formal workflow skeleton 已存在”就进入 closure-candidate 心智模型。更合理的前置条件是先完成：

```text
production-equivalent environment contract
+ executable data plane
+ state continuity
+ exact dependency smoke
+ successor-safe control plane
```

再选正式窗口。

#### 46.4.2 先选 Formal epoch，再发现 state continuity / schema / decoder 不完整

#3190 已经选定第一条 T3R1 Formal epoch：

```text
O00 = 2026-08-17T20:00:00Z
O23 = 2026-08-18T19:00:00Z
```

随后 #3196 才发现：

```text
persisted A0 = 2026-08-15T10:00Z
checkpoint next = 2026-08-15T11:00Z
selected O00 = 2026-08-17T20:00Z

canonical continuity hole = 57h
```

于是必须重新裁决为 fresh zero-state Formal store + O00-1h fresh A0。

到真实 epoch 又由 #3204 记录两个 production-environment gap：

```text
Formal persistence closure was qualified too narrowly
12 relations → actual required 26 relations

production provider lane missed pinned GFS decoder dependencies
(eccodes / eccodeslib / numpy / refet)
```

这些都应该在 epoch selection 前由 production-equivalent gate 阻断，而不应该靠一次珍贵的 real wall-clock Formal epoch 来当 debugger。

#### 46.4.3 provider cadence 与 Runtime cadence 的核心设计，在第一次 Formal 失败后才真正重构

#3101 已经承认 KBS 是：

```text
hourly-resolution observations
+
daily-batch publication
```

并以 `PROVIDER_AVAILABILITY_WATERMARK_V1` 取代错误 fixed-lag authority。

但真正把 provider publication cadence 与 hourly Runtime scheduler eligibility 解耦，是 #3207 Amendment-19，在第一次 Formal epoch 失败以后才建立。

Amendment-19 的核心规则是：

```text
exact KBS pair available at T
→ Mode A / HEALTHY

otherwise coherent prior-step causal GFS assumption pair available
→ Mode B / ASSUMED / DEGRADED / continue without provider wait

otherwise
→ explicit BLOCK / fail closed
```

迟到的 exact KBS 只能 append-forward，不能 retroactively rewrite terminal State/checkpoint。

这是现在正确架构的重要基础，但它在 final-qualification 阶段才被冻结，说明核心 operational semantics 定得过晚。

### 46.5 隐藏的结构性问题：证据不可迁移规则被放大成“几乎所有证明都重跑”

MCFT-9 的治理原则本身是正确的：

> **证据比进度重要，绝不能把 predecessor 的成功冒充 successor 的成功。**

但当前实现方式在很多阶段接近：

```text
any protected-main SHA change
        ↓
predecessor evidence treated as non-transferable
        ↓
fresh rolling
        ↓
fresh retained-raw replay / rehydration
        ↓
fresh qualification store generation or subject sentinel
        ↓
full persistent qualification
```

这把正确原则：

```text
code identity / semantic authority must not be silently relabeled
```

放大成了：

```text
almost every operational proof is non-composable across successor SHAs
```

结果是一个很小的 workflow、routing、pagination、harness、connection-lifecycle 或 event-identity 修复，也可能重新打开完整 qualification loop。

#3257 是这个问题的最新例子：canonical Runtime 没有改变，T4R1 A0 没有改变，schema/scheduler/lease/crop authority 没有改变，但历史 T3R1 workflow event identity 与 consumer secret coupling 仍要求新增 successor-safe control plane。

这不是说 #3257 不该做；恰恰相反，这个隔离是必要的。真正的问题是这种 successor routing 没有从一开始作为可泛化能力设计。

### 46.6 后续应明确区分两类 SHA change

这是 CTO 复盘建议，不是当前 repository authority；若要实施，必须另立治理设计/机器 gate，不能靠人工口头 carry-forward。

第一类：

```text
SEMANTIC_OR_RUNTIME_AFFECTING_CHANGE
```

典型包括：

- canonical core；
- Evidence admission/chronology；
- State/Forecast/Scenario math；
- persistence semantics；
- scheduler/lease/fencing；
- crop/source/runtime authority；
- decoder canonicalization；
- Runtime Config materialization。

这类 change 应继续默认 fail closed，要求 fresh subject-bound qualification，不能迁移 predecessor execution evidence。

第二类：

```text
PROOF_HARNESS_OR_CONTROL_PLANE_ONLY_CHANGE
```

典型包括：

- workflow pagination/API-shape correction；
- historical router successor classification；
- post-success UI/process-lifecycle correction；
- exact proof packaging；
- event identity isolation；
- harness 读取错误字段的修复；
- ruleset/trigger plumbing。

未来如果要允许这类 change 的 evidence carry-forward，必须由机器证明至少：

```text
all governed production/runtime blobs unchanged
all relevant authority blobs unchanged
schema fingerprints unchanged
provider/source identities unchanged
canonical decoder identity unchanged
scheduler/lease/fencing implementation blobs unchanged
persistent data subject identity unchanged
no new write capability introduced
predecessor evidence artifact/run identity immutable and revalidated
```

只有满足一个明确、可审计、fail-closed 的 `CONTROL_PLANE_ONLY_EVIDENCE_CARRY_FORWARD` contract，才可以复用 predecessor proof。

否则仍按现行严格规则重新资格化。

目标不是放松 evidence，而是把：

```text
strict evidence identity
```

从：

```text
whole-repository-SHA identity only
```

提升为：

```text
governed semantic/runtime object-set identity
+ explicit control-plane delta classification
+ immutable predecessor proof revalidation
```

如果不解决这一点，MCFT-10 / MCFT-11 / MCFT-12 很可能重复 MCFT-9 的 requalification amplification。

### 46.7 对当前 MCFT-9 的执行纪律

这次复盘不授权架构扩张。对当前 T4R1 final closure，最重要的是停止继续“顺手重构”。

从当前 frontier 开始，只允许为完成下列链路所必需的最小修复：

```text
#3256 existing bootstrap lifecycle/reverify boundary
        ↓
#3257 T4R1 event-isolated rolling/rehydration boundary
        ↓
fresh exact-main rolling candidate
        ↓
producer-bound retained-raw rehydration
        ↓
fresh T4R1 v4 persistent 13/13
        ↓
static_blocker_count = 0
        ↓
subject-bound Formal graduation
        ↓
real O00–O23
        ↓
final read-only adjudication
```

明确禁止：

- 为“代码更漂亮”修改 canonical Runtime；
- 合入与当前 closure 无关的 main changes；
- 再改 provider temporal semantics，除非新的真实 evidence 证明现行 authority 错误；
- 回到 T3R1 phenology/GDD 主线；
- 重用历史 T3R1 auto-consumer 来消费 T4R1 producer event；
- 把 predecessor 13/13 口头迁移成当前 T4R1 13/13；
- 用 accelerated lane 代替 real wall-clock O00–O23；
- 为绕过 exact-SHA 成本而降低 semantic equality / chronology / fail-closed gate。

### 46.8 当前完成度的最终 CTO 表述

可以准确说：

> MCFT-CAP-09 已经完成了 T4R1 successor authority/runtime rebind、fresh Formal DB、26-relation schema/zero-state qualification、secret binding 和真实 fresh A0 bootstrap；首次 bootstrap 的业务语义与 persisted state 已 PASS，post-success connection lifecycle 已由 #3256 进入 successor repair/reverify 路径。当前主线已推进到 T4R1-safe fresh rolling → producer-bound rehydration control plane（#3257）。fresh T4R1 v4 persistent 13/13、subject-bound graduation 与最终 real wall-clock O00–O23 仍未完成。

不能说：

```text
MCFT-9 complete
```

也不能说：

```text
we are still designing MCFT-9 from scratch
```

当前真实状态是：

```text
core execution architecture substantially proven
+
T4R1 A0 established
+
final successor-specific qualification chain not yet closed
+
real O00–O23 not started
```

### 46.9 对下一位接手者的最终 restart instruction

先重新读取 live repository；不要假设本章写入后的 PR 状态仍未变化。

若 protected main 仍为：

```text
e2252e338a398367927bee4f9cc307b0917a527d
```

且 #3257 仍是 active frontier，则从：

```text
PR #3257
T4R1 event-isolated fresh rolling / dynamic producer-bound rehydration
```

继续。

如果 #3257 已经合并或被 supersede，则先确认新的 exact main、对应 fresh rolling artifact、rehydration result、v4 store state，再进入下一合法 frontier。

无论如何，最终 completion condition 不变：

```text
fresh subject-bound qualification
13 / 13 PASS
static_blocker_count = 0
Formal graduation gate OPEN
real wall-clock O00–O23 terminally complete
final read-only evidence adjudication PASS
MCFT-CAP-09 completion formally established
```

---

End of handoff.