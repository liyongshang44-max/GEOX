# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-09

更新时间：2026-08-09 16:55（UTC+8）

```text
repository:
liyongshang44-max/GEOX

protected_main_at_handoff:
9dc8f99303e9d1efaec52afe5eac7ed816c5a8d2

current_taskbook:
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md

current_taskbook_version:
Complete Taskbook v0.5 — Stage 1B Design Freeze / S6 Amendment-01 + Amendment-02 + Amendment-03 + Amendment-04 Bound

current_effective_overlay:
Amendment-05 — External Formal Runtime Authority Profile

current_frontier:
MCFT-CAP-09.S6 / EA5B1 External Evidence Binding Authority Seam

current_pr:
#3006

current_pr_head:
2873d6bb66d28813c9f227887fffcd30e256599b

current_blocker:
EA5B1 focused governance exact-file boundary still expects the pre-CAP08-safe path set

next_legal_successor_after_ea5b1_effective:
S6-EA5B2-CAP04-EXTERNAL-BINDING-SERVICE-THREADING

formal_database_write_started:
false

formal_window_started:
false

o00_o23_started:
false

mcft_cap09_complete:
false

handoff_authority_class:
CONTINUATION_CONTEXT_ONLY
```

---

## 0. 这份 handoff 的定位

本文是 `docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-08.md` 的后继 continuation handoff。

旧 2026-08-08 handoff 的最后 frontier 是 `EA1O_B_LIVE_SFLUX_SOURCE_AND_SPATIAL_QUALIFICATION`。截至本文，仓库已经经过后续 EA1O / EA2 / EA3 / EA4 / EA5A 与 Amendment-05，旧 handoff 的 SHA、frontier、source blocker 和 EA1O 当前状态均已过期。

旧 handoff 中以下方法论仍然有效：

```text
1. Taskbook / Delivery Policy / protected main 高于 handoff
2. protected-main repository fact 高于 Candidate status snapshot
3. live PR / exact-head run / artifact 高于 PR body 中的旧描述
4. handoff 只恢复上下文，不制造 effectiveness
```

下一位接手者不得因为本文写了“已完成”就跳过 protected-main presence / exact-head CI / focused acceptance 的核验。

---

# 1. 当前到底在做什么任务

我们仍然在做：

```text
MCFT-CAP-09 — Shadow-Online Promotion
S6 — Formal 24-hour Stage-1B closure
```

最终目标仍然没有变化：

```text
External Reality / Evidence
→ governed canonical Evidence
→ honest External Runtime authority/config
→ A0
→ actual O00 ... O23
→ 24 persisted scheduler slots / resolved ticks
→ State / Forecast / Checkpoint / Health / lineage
→ restart / backfill / stale / late-evidence behavior
→ final exact-SHA / R2 closure
```

当前不是在接 GEOX 商业闭环，也不是在做 Recommendation / Approval / AO-ACT / Dispatch。

当前具体任务已经进入 EA5：

```text
EA5A  fresh Formal Neon database preflight          EFFECTIVE
Amendment-05 External Formal Runtime Profile       EFFECTIVE
EA5B1  External Evidence binding seam              IN PROGRESS
EA5B2  CAP04 External binding service threading    NEXT AFTER B1
EA5C   durable raw retention + restricted ingress  NOT STARTED
EA5D   External bootstrap/config/A0/24-chain write NOT STARTED
EA5E   final preflight/manifest/schedule/V3         NOT STARTED
O00    NOT AUTHORIZED
```

---

# 2. 当前 protected-main 权威事实

## 2.1 Protected main

当前 protected `main`：

```text
9dc8f99303e9d1efaec52afe5eac7ed816c5a8d2
```

该 commit 是 PR #3005 的 merge commit：

```text
MCFT-CAP-09 EA5: freeze External Formal Runtime Authority Profile
```

## 2.2 Taskbook

当前 Taskbook 顶层仍是：

```text
Complete Taskbook v0.5
GEOX-MCFT-CAP-09-TASK-V0.5-STAGE-1B-S6-AMENDMENT-01-02-03-04-BOUND
```

Taskbook 文件本身绑定 Amendment-01 ~ Amendment-04。

Amendment-05 是随后单独 adjudicated、已经进入 protected main 的 EA5 architecture overlay；不要误以为 Taskbook 标题没有写 Amendment-05 就代表 Amendment-05 未生效。

---

# 3. 本轮已经完成并 effective 的关键工作

## 3.1 EA4 Recovery 已成为 EA5 predecessor

EA5A 的 protected-main predecessor 已经证明：

```text
original KBS source recovered under unchanged thresholds
live source qualified
complete GFS 72h value pipeline qualified
72h future ET0 execution qualified
EA5 candidate development authorized
External Evidence Package still formal_eligible=false
O00–O23 not started
```

不要重新回到早期 EA4 source-discovery / solar-reconstruction 失败路径；EA5 当前工作建立在 EA4 recovery 已 effective 的事实之上。

## 3.2 EA5A — Fresh Formal Neon database preflight

PR：

```text
#3004
MCFT-CAP-09 S6 EA5A: qualify fresh Formal Neon database preflight
```

已 merged：

```text
merge SHA:
c5f10a0628aba158463e7c4d4e151ed14b60ff79
```

EA5A 是严格 read-only preflight。

它证明目标 Formal store 是：

```text
provider: Neon PostgreSQL
project: delicate-glade-62464340
branch:  br-cold-dust-a6j6aymz  (main / primary / default)
database: geox_mcft_cap09_s6_formal_24h
```

明确禁止复用历史 simulation branch：

```text
br-falling-cake-a6lfsdak
```

EA5A 在 read-only transaction 中证明：

```text
required Runtime/Scheduler schema present
total facts = 0
External Formal scope facts = 0
field_c8_demo references = 0
forbidden action-authority facts = 0
scheduler slots/cursor = 0
active lineage/state/forecast/checkpoint/lease = 0
```

EA5A 没有写数据库。

## 3.3 Amendment-05 — External Formal Runtime Authority Profile

PR：

```text
#3005
MCFT-CAP-09 EA5: freeze External Formal Runtime Authority Profile
```

已 merged：

```text
merge SHA:
9dc8f99303e9d1efaec52afe5eac7ed816c5a8d2
```

Amendment-05 的关键裁决：

### A. 修正必须是 additive，不得重写历史 Replay authority

历史 Replay contracts / hashes / completed acceptance 保持有效。

External Formal 路径新增显式 External authority profile，不把 Replay identity 冒充 External truth。

### B. 五个 External Formal binding IDs 已冻结

```text
soil:
kbs_lter_variate25_vwc_100mm_v1

rainfall:
kbs_lter_raw_hourly_rain_mm_v1

historical ET0:
kbs_lter_asce_short_reference_et_hourly_v1

future weather:
noaa_ncep_gfs_pgrb2_kbs_nearest_72h_v1

future ET0:
noaa_ncep_gfs_asce_short_reference_et_same_cycle_72h_v1
```

禁止 successor implementation 自己另造 live binding ID 然后声称 Formal eligible。

### C. Epistemic class 固定，不允许因 source qualification 成功而升级

```text
soil       OBSERVED
rainfall   OBSERVED
hist ET0   ESTIMATED
future wx  ASSUMED
future ET0 ASSUMED
```

### D. KBS soil 仍只是 near-site 100-mm point support

```text
measurement depth = 100 mm
spatial support = NEAR_SITE_POINT_SUPPORT
root-zone representativeness = PARTIAL
direct field equivalence = false
direct root-zone equivalence = false
```

External soil observation operator：

```text
POINT_100MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1
```

`H = 1` 只是一项 observation-model approximation，不是“100mm observation 等于 root-zone truth”。

### E. Model parameter provenance

外部路径继续使用 CAP08 数值参数时，只允许：

```text
MODEL_PRIOR_FROM_CAP08
NOT_FIELD_CALIBRATED
```

禁止把 CAP08 parameter 说成 KBS field calibration。

### F. External runtime profile

External A0 / Runtime authority 要使用：

```text
SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY
```

External canonical members 不得携带：

```text
CONTROLLED_SYNTHETIC_REPLAY_PROXY
runtime_mode = REPLAY
```

### G. Formal execution 后续必须是一条 24-slot Runtime Config chain

不能再使用一个固定 runtime_config_ref/hash 覆盖 O00–O23。

每个 actual tick 必须绑定其有效逻辑时间对应的 Runtime Config，并保持 exact parent chain。

### H. Runtime 仍不得直接联网 fetch provider

正确顺序保持：

```text
collector / canonicalizer / ingress
→ governed database Evidence
→ Runtime
```

并且 Formal canonical Evidence append 之前必须完成 durable private raw retention。

---

# 4. 当前进行中的 EA5B1

## 4.1 PR

当前唯一主工作 PR：

```text
#3006
MCFT-CAP-09 EA5B1: add External Evidence binding authority seam
```

状态：

```text
OPEN
DRAFT
base = main@9dc8f99303e9d1efaec52afe5eac7ed816c5a8d2
head = 2873d6bb66d28813c9f227887fffcd30e256599b
```

最新 head commit：

```text
2873d6bb66d28813c9f227887fffcd30e256599b
fix(mcft-cap09): make EA5B1 A0 binding seam CAP08-safe
```

## 4.2 EA5B1 的目的

EA5B1 不是 External Runtime 完成，也不是 DB ingress。

它只建立第一层 additive binding primitives / selection seam：

```text
External Formal binding constants
+ explicit soil binding authority
+ A0 Evidence Window explicit allow-list / rejection
+ External-only A0 Evidence Window preparation service
+ CAP03 continuation selector explicit binding authority
+ CAP03 continuation Evidence Window threading
+ historical default behavior preservation
```

成功后仍然：

```text
CAP04 single-tick service threading = false
External A0 bootstrap persistence = false
External package formal_eligible = false
EA5C authorized = false
DB writes = 0
Formal Evidence writes = 0
O00 = false
```

---

# 5. 本轮最关键的架构坑：CAP08 byte-freeze

## 5.1 发生了什么

EA5B1 初版曾尝试修改历史：

```text
apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.ts
```

把 External soil binding authority 直接 thread 进历史 A0 bootstrap service。

这个做法在局部设计上看起来合理，但违反 CAP08 completion authority。

CAP08 已经把历史 A0 bootstrap core byte-freeze。

必须保持的历史 blob：

```text
7d2db571b421f1cbfe7fd1192398297def5307c2
```

## 5.2 已经怎么修正

错误修改已经撤回。

历史 A0 bootstrap service 已恢复到原 blob，不再修改。

新的 additive service：

```text
apps/server/src/runtime/twin_runtime/external_formal_a0_evidence_window_service_v1.ts
```

candidate authority 当前记录该 service blob：

```text
1a02cd7c39da8a17ebd161f487c7d2c3c7c704e1
```

这个新 service 只负责 External A0 Evidence Window preparation / binding enforcement。

它：

```text
MAY enforce exact Formal KBS 100mm soil binding
MAY reject same-scope unauthorized C8 soil
MUST preserve historical Replay default path
MAY NOT persist bootstrap state
MAY NOT construct full External A0 canonical member graph
MAY NOT mutate CAP08 frozen historical core
```

这是当前必须保留的正确架构。

---

# 6. EA5B1 当前实现已经证明 / 设计冻结的行为

当前 candidate 已经冻结以下语义：

## 6.1 Explicit External authority

当 External caller 显式给：

```text
kbs_lter_variate25_vwc_100mm_v1
```

同 scope 的历史 C8 soil：

```text
soil_obs_c8_20cm_v1
```

必须被明确排除，不得 estimator-consumed。

## 6.2 Default-preserving

没有 supplied External authority 时：

```text
historical A0 default behavior stays Replay
historical CAP03 default binding stays soil_obs_c8_20cm_v1
```

不能为了 External seam 改变历史 caller 的 semantic identity。

## 6.3 Blank authority

空 binding authority 必须 fail closed。

不能把 blank 当 default External binding。

## 6.4 Semantic identity

显式 External binding ID 必须参与 External semantic identity / digest。

但历史 omitted-profile 路径不得因为新字段存在而发生 byte / semantic drift。

---

# 7. 当前真正卡在哪里

## 7.1 仓库级 CI 不是 blocker

当前 head `2873d6bb...` 上以下全部成功：

```text
mcft-main-ruleset-readiness-v1          PASS
mcft-delivery-policy-v2                 PASS
mcft-release-lane-v1                    PASS
mcft-candidate-declaration-selftest-v2  PASS
mcft-cap-08-authority-reconciliation    PASS
ci                                      PASS
```

唯一红灯：

```text
mcft-cap-09-ea5b1-external-evidence-binding-seam
```

## 7.2 精确失败步骤

focused workflow 当前在：

```text
Validate exact EA5B1 governance boundary
```

失败。

因此这一轮的后续：

```text
server typecheck
8-case External Evidence binding acceptance
CAP01 historical A0 regression
CAP03 historical default binding regression
implementation-only final verifier
```

都没有真正进入执行。

## 7.3 精确错误

当前 run 报：

```text
EA5B1_EXACT_NINE_FILE_BOUNDARY_FAIL
```

实际当前 nine-file diff 是：

```text
.github/workflows/mcft-cap-09-ea5b1-external-evidence-binding-seam.yml
apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.ts
apps/server/src/runtime/twin_runtime/assimilated_continuation_evidence_window_v2.ts
apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v2.ts
apps/server/src/runtime/twin_runtime/evidence_window_builder_v1.ts
apps/server/src/runtime/twin_runtime/external_formal_a0_evidence_window_service_v1.ts
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B1-EXTERNAL-EVIDENCE-BINDING-SEAM-V1.json
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B1_EXTERNAL_EVIDENCE_BINDING_SEAM.cjs
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B_EXTERNAL_EVIDENCE_BINDING_SEAM.ts
```

也就是说，代码边界已经改成 CAP08-safe additive service，但 governance gate 的 `EXPECTED` / exact-file-set 仍保留 pre-fix path assumption。

### 当前第一修复动作

只修：

```text
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B1_EXTERNAL_EVIDENCE_BINDING_SEAM.cjs
```

使它的 exact nine-file boundary：

```text
REMOVE historical a0_bootstrap_runtime_service_v1.ts
ADD    external_formal_a0_evidence_window_service_v1.ts
```

并同步校验：

```text
historical A0 bootstrap required blob = 7d2db571...
historical service unchanged = true
External A0 service additive = true
External A0 persistence = false
```

不要通过扩大 exact boundary 或删除 gate 来“让 CI 绿”。

---

# 8. EA5B1 focused workflow 收口后必须证明什么

在修正 exact-boundary wiring 后，focused workflow 才允许进入真正验证。

至少需要同时证明：

## A. EA5B1 新 8-case design acceptance

重点包括：

```text
External KBS binding selected
same-scope C8 binding rejected
historical A0 default preserved
historical CAP03 default preserved
blank binding fail-closed
binding IDs unique/frozen
future weather + future ET0 exact pair frozen
External A0 preparation service uses exact Formal soil binding
```

## B. Server typecheck

必须 PASS。

## C. CAP08 G3 / completion successor regression

这是本轮新增的关键 guard。

必须证明：

```text
CAP08 frozen A0 bootstrap core remains byte-identical
EA5B1 does not mutate predecessor kernel/core authority
additive successor service does not invalidate CAP08 completion authority
```

不要只依赖 `mcft-cap-08-authority-reconciliation` 仓库级绿灯替代 focused successor regression；EA5B1 自己也需要把这条 predecessor invariant 写进 focused proof。

## D. CAP01 A0 historical behavior

历史 A0 acceptance 必须继续成立。

仓库里 CAP01 的旧 repo-wide scope guard 已经存在 protected-base stale issue；正确做法是：

```text
prove historical behavioral assertions
+ prove stale scope is predecessor-base debt
+ prove EA5B1 itself没有新增 forbidden scope path
```

不要借 EA5B1 顺手修改 CAP01 历史 authority。

## E. CAP03 historical default binding

历史 default：

```text
soil_obs_c8_20cm_v1
```

必须在无 explicit External override 时继续有效。

External override 只能是 additive opt-in。

---

# 9. EA5B1 合并后的唯一正确下一步

如果且仅如果 #3006：

```text
focused EA5B1 PASS
+ server typecheck PASS
+ CAP08 G3 successor regression PASS
+ CAP01 historical A0 behavior PASS
+ CAP03 default binding PASS
+ Delivery / Ruleset / release / full CI PASS
+ protected-main merge effectiveness established
```

则 frontier 前移为：

```text
S6-EA5B2-CAP04-EXTERNAL-BINDING-SERVICE-THREADING
```

## 9.1 EA5B2 的任务

把 EA5B1 已冻结的显式 External binding authority 真正 thread 到 CAP04 single-tick service 输入路径。

EA5B2 应继续遵守：

```text
additive
explicit authority
historical default-preserving
fail closed
no provider fetch in Runtime
no DB/Formal writer activation
```

EA5B2 不是 EA5C，也不是 Formal ingress。

## 9.2 EA5B2 不应做什么

不要在 B2 顺手实现：

```text
durable raw retention
restricted canonical Evidence writer
External DB bootstrap
24 Runtime Config chain persistence
Formal Window Input Manifest
scheduler enable
O00
```

这些属于后续 EA5C / EA5D / EA5E。

---

# 10. EA5B2 后的整体计划

Amendment-05 已冻结的大顺序仍然有效：

```text
EA5B1
External Evidence binding primitives / A0 Evidence preparation / CAP03 seam

→ EA5B2
CAP04 single-tick External binding service threading

→ finish EA5B External Runtime Profile implementation
External canonical Runtime Config / resolver / honest External A0 profile

→ EA5C
durable raw retention
+ restricted canonical Evidence ingress

→ EA5D
External bootstrap config
+ External A0 persistence
+ exact 24-config parent chain persistence

→ EA5E
post-bootstrap preflight
+ Formal Window Input Manifest
+ schedule readiness
+ Authority V3 effectiveness

→ ONLY THEN O00

→ actual O00 ... O23

→ final Stage-1B exact-SHA / R2 closure
```

---

# 11. 已踩过的坑 / 必须避免的错误路径

## 11.1 不要修改 CAP08 frozen historical A0 bootstrap service

这是当前最重要的坑。

禁止再次修改：

```text
apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.ts
```

required historical blob：

```text
7d2db571b421f1cbfe7fd1192398297def5307c2
```

如果 External path 需要新能力，使用 additive service / adapter / explicit profile，而不是改 predecessor frozen core。

## 11.2 不要“修” CAP08 authority 来允许新 mutation

不能因为 successor 需要功能就反过来修改 predecessor completion authority。

正确原则：

```text
preserve historical authority
+ additive External successor seam
```

## 11.3 PR body 可能落后于 current head

#3006 PR body 仍有早期措辞：

```text
A0 bootstrap service threading
```

并且早期 exact-boundary 描述包含 historical A0 service。

当前 repository truth 已经变成：

```text
historical A0 service restored
new External A0 Evidence Window service added
```

所以继续工作必须以：

```text
current head diff
current candidate authority JSON
current focused run
```

为准，不要照抄 PR body。

## 11.4 Exact-boundary gate 与实现路径必须一起更新

这次当前红灯就是典型例子：

```text
implementation fixed
but governance EXPECTED file set stayed stale
```

任何 path substitution / additive service replacement 后必须同步：

```text
exact changed-file set
blob pins
candidate authority implementation_blobs
governance assertions
workflow path filters
```

## 11.5 Regression proof 不是可选项

EA5B1 的“历史默认不变”不是一句 nonclaim。

必须有可执行证据覆盖：

```text
CAP08 predecessor/core
CAP01 A0 behavior
CAP03 default binding
```

## 11.6 不要把 explicit External binding 变成新的全局 default

历史 caller 未提供 External authority 时仍必须保持 Replay 默认。

External authority 是 explicit opt-in，不是全局替换。

## 11.7 Blank binding 必须 fail closed

禁止：

```text
blank -> External default
unknown -> first matching soil record
first-record-wins
```

## 11.8 不要降低 KBS soil representativeness

即使 KBS 100-mm soil binding 工作完全正常，也仍然：

```text
NEAR_SITE_POINT_SUPPORT
PARTIAL root-zone representativeness
NOT field truth
NOT root-zone truth
```

## 11.9 不要升级 epistemic class / confidence

五类 External Evidence epistemic classes 已冻结。

成功 fetch / binding / persistence / Runtime execution都不能把：

```text
ESTIMATED -> OBSERVED
ASSUMED -> OBSERVED
```

也不能把 `MODEL_PRIOR_FROM_CAP08` 写成 `FIELD_CALIBRATED`。

## 11.10 Runtime 不得联网 fetch providers

External source acquisition 与 Runtime 必须继续隔离：

```text
collector/canonicalizer/ingress
before Runtime
```

## 11.11 现在绝不能开始 O00–O23

当前：

```text
Formal DB writes = 0
Formal Evidence writes = 0
External A0 bootstrap persistence = false
CAP04 External threading = false
External package formal_eligible = false
EA5C/EA5D/EA5E incomplete
```

所以 O00 不具备合法启动条件。

## 11.12 不要重新连接商业 closed loop

MCFT-CAP-09 当前仍是 Shadow-online qualification / Formal evidence/runtime closure。

本任务不授权：

```text
Recommendation
Approval
AO-ACT
Dispatch
Model Activation
commercial closed-loop connection
```

---

# 12. 下一对话的最短接手路径

下一位接手者应按以下顺序执行：

```text
1. git / GitHub verify protected main == 9dc8f99303e9d1efaec52afe5eac7ed816c5a8d2

2. read:
   docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md
   Amendment-05
   EA5A authority/status
   PR #3006 current head diff
   EA5B1 candidate authority JSON

3. verify #3006 head == 2873d6bb66d28813c9f227887fffcd30e256599b
   unless a newer head already exists

4. inspect current focused failure:
   EA5B1_EXACT_NINE_FILE_BOUNDARY_FAIL

5. update EA5B1 governance exact-file set to replace:
   historical a0_bootstrap_runtime_service path
   with external_formal_a0_evidence_window_service_v1.ts

6. add/confirm CAP08 G3 successor regression in focused workflow

7. rerun focused EA5B1 and require:
   governance PASS
   typecheck PASS
   8-case design PASS
   CAP08 regression PASS
   CAP01 historical A0 PASS
   CAP03 default binding PASS

8. require repo-wide Delivery / Ruleset / release / CI all green

9. merge EA5B1 only on exact final head

10. verify protected main effectiveness

11. start only:
    S6-EA5B2-CAP04-EXTERNAL-BINDING-SERVICE-THREADING
```

如果在步骤 1–3 发现 protected main 或 #3006 head 已经前移，必须重新读取 live repository facts；不要机械使用本 handoff 的 SHA。

---

# 13. 当前 nonclaims / state summary

```text
EA5A fresh Formal Neon preflight:           EFFECTIVE
Amendment-05 External Runtime authority:    EFFECTIVE
EA5B1 binding seam:                         CANDIDATE / OPEN / NOT EFFECTIVE
EA5B2 CAP04 threading:                      NOT STARTED
EA5C durable retention + ingress:           NOT STARTED
EA5D External bootstrap/config persistence: NOT STARTED
EA5E final readiness / Authority V3:        NOT STARTED
Formal DB write:                            0
Formal Evidence write:                      0
O00–O23:                                    NOT STARTED
Stage-1B closure:                           NOT COMPLETE
MCFT-CAP-09:                                NOT COMPLETE
commercial closed loop:                     NOT AUTHORIZED
```

---

# 14. 最重要的一句话

当前不是卡在 External source，也不是卡在 Neon。

当前卡点是：

> **EA5B1 已经改成 CAP08-safe additive External A0 Evidence Window service，但 focused governance 仍按旧 historical-A0-service path 做 exact-nine-file 验收。先把这一治理接线修正，并同时证明 CAP08 / CAP01 / CAP03 历史行为不回归；EA5B1 合并后，下一步才是 EA5B2 把 External binding authority thread 到 CAP04 single-tick service。**
