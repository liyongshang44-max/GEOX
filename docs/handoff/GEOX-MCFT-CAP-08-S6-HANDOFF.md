---
title: "GEOX MCFT-CAP-08 S6 Handoff"
document_id: "GEOX-MCFT-CAP-08-S6-HANDOFF"
repository: "liyongshang44-max/GEOX"
generated_at: "2026-08-04T15:52:00+08:00"
status: "ACTIVE_HANDOFF"
language: "zh-CN"
runtime_governance_base_before_handoff_update: "678a21c4f6489dafe053d3a20de118b234721626"
supersedes:
  - "GEOX-MCFT-CAP-08-S6-HANDOFF-2026-08-04T01:45+08:00"
  - "GEOX-MCFT-CAP-08-S6-HANDOFF-2026-08-03"
  - "GEOX-MCFT-CAP-08-S6-HANDOFF-2026-08-02"
---

# GEOX MCFT-CAP-08 S6 交接文档

> 本文件是 MCFT-CAP-08 S6 的仓库内唯一活动交接入口。  
> 新对话必须先读本文，再通过 GitHub 重新核对 `main`、PR、workflow、artifact、authority、执行次数和 frozen blob。  
> 不得依据聊天记忆直接 dispatch；不得复用任何已经消费、失败、过期、被 supersede 或对象集不完整的 authority。

---

# 0. 当前总裁决

```text
S1–S5                                                  COMPLETE / EFFECTIVE
S6 exact runtime subject                               ce9d6b4df8c708c0d4a99bb24846e1bc44b3cf59
56-object exact-path development qualification         PASS
Formal RUN_A                                           TERMINAL SUCCESS / SETTLED
Formal RUN_A authority                                 CONSUMED / RETIRED
Formal RUN_B                                           TERMINAL SUCCESS / SETTLED
Formal RUN_B authority                                 CONSUMED / RETIRED
Formal A/B comparator implementation                   MERGED / QUALIFIED
Formal comparator execution workflow                   MERGED / QUALIFIED
Replacement-001 comparator candidate                   MERGED
Replacement-001 comparator effectiveness               MERGED
Replacement-001 comparator authority                   EFFECTIVE / UNUSED
Formal comparator workflow dispatch                    NOT PERFORMED
Formal comparator execution                            NOT PERFORMED
Formal comparator evidence                             ABSENT
S6 Candidate exact head                                NOT ESTABLISHED
Candidate Declaration + independent approval           NOT ESTABLISHED
merge-tree witness                                     NOT ESTABLISHED
R2 / 730-day retention attestation                     NOT ESTABLISHED
24/24 Hard Acceptance Ledger settlement                NOT ESTABLISHED
MCFT-CAP-08                                             NOT COMPLETE
MCFT-CAP-09                                             NOT AUTHORIZED
```

准确含义：

> 两个独立的正式 PostgreSQL 运行已经成功、结算并永久消费各自 authority。正式 A/B comparator 的实现、执行工作流、完整 12-object authority candidate 和独立 effectiveness 均已 protected merge。当前不存在实现缺陷或数据差异 blocker；唯一合法阻塞是尚未取得一次性 Formal Cross-Run Comparator 执行授权。未经明确授权，不得 dispatch。

---

# 1. 我们在做什么

MCFT-CAP-08 S6 的目标是完成 Final Two-Run Closure：

```text
Formal RUN_A
→ Formal RUN_B
→ Formal A/B semantic comparator
→ S6 Candidate exact-head freeze
→ Candidate Declaration
→ independent human approval
→ merge-tree witness
→ R2 / 730-day retention attestation
→ HA-01…HA-24 Ledger settlement
→ MCFT-CAP-08 closure
```

当前具体工作不是再修 Runtime，也不是再跑数据库，而是：

```text
使用已生效、单次、不可复用的 comparator authority
→ 对已结算的 Formal RUN_A / RUN_B artifacts执行一次正式语义比较
→ 生成正式 comparator evidence
→ 永久消费 comparator authority
```

---

# 2. 当前必须重新核验的仓库事实

## 2.1 Runtime / governance基线

```text
repository
liyongshang44-max/GEOX

runtime / exact execution subject
ce9d6b4df8c708c0d4a99bb24846e1bc44b3cf59

main before this handoff-only update
678a21c4f6489dafe053d3a20de118b234721626

latest merged PR at that base
#2800

latest merge purpose
establish Replacement-001 formal comparator authority effectiveness
```

本handoff更新只允许修改：

```text
docs/handoff/GEOX-MCFT-CAP-08-S6-HANDOFF.md
```

如果当前 `main` 已因本handoff PR前推，接手者必须比较：

```text
678a21c4f6489dafe053d3a20de118b234721626
→ current main
```

并证明除handoff文档外没有 Runtime、comparator、workflow、authority或evidence对象漂移。

## 2.2 必须检查

```text
1. current main和最新merge PR；
2. #2800是否仍为merged；
3. effective comparator authority blob是否仍为c2df7c3d...；
4. 12-object manifest blob是否仍为57d7817b...；
5. execution workflow blob是否仍为b11d6082...；
6. execution control blob是否仍为f6e16736...；
7. formal wrapper blob是否仍为898fa85e...；
8. normalization blob是否仍为1a2f769a...；
9. 是否已经出现同一comparator_execution_id的workflow_dispatch；
10. authority是否仍在有效期内、execution_count是否仍为0；
11. 是否存在新的comparator result、consumption settlement、S6 Candidate或Ledger记录。
```

事实优先级：

```text
GitHub actual main / PR merge SHA
Git blob / tree / commit
workflow run ID / event / attempt / conclusion
artifact ID / digest / JSON content
authority gate result
compare_commits exact boundary
```

PR body、聊天记录和旧handoff只用于导航。

---

# 3. 已经完成了什么

## 3.1 Permanent exact-path development qualification

PR #2781 建立了与正式路径相同的 development rehearsal，并在 exact merge subject 上完成两个独立 PostgreSQL 16实例：

```text
qualified runtime subject
ce9d6b4df8c708c0d4a99bb24846e1bc44b3cf59

RUN_DEV_A
execution / restart / unified matrix / clean drop PASS

RUN_DEV_B
execution / restart / unified matrix / clean drop PASS

semantic digest A/B
sha256:32c93d4f5ecd1fc50ff94418407767b48b057d77c81bf93dfe3fccf58f0df2f8

difference count
0
```

该 qualification 是正式链的技术前驱，但不是正式证据。

## 3.2 Formal RUN_A

```text
authority identity
REPLACEMENT-011

formal workflow run
30845476698 / attempt 1 / SUCCESS

operational identity
MCFT-CAP-08-S6-FORMAL-RUN-A-20260804-REPLACEMENT-011

logical DB identity
MCFT-CAP-08-S6-FORMAL-DB-A-20260804-REPLACEMENT-011

physical database
geox_mcft_cap08_s6_run_a_replacement_011_30845476698

one-run artifact
8868535301

artifact digest
sha256:4d59d3aa0373bee0c9eb33ab78dd427eb324d4d259e0786aa9c4dea9effdaf2f

formal semantic digest
sha256:e592f00fb0b6c3234985f57e8d20955afc6246964d04aca7a56f9eea9b79e696
```

终态：

```text
FINAL_FORMAL / PASS
22 / 22 witnesses PASS
153 canonical receipts
224 operational events
28 phases
7 recovery vectors
10 CAP-07 surfaces / 11 variants
fresh database PASS
clean drop PASS
authority dispatch count consumed 1 / 1
rerun / identity reuse / authority reuse false
```

结算PR：

```text
#2790 MERGED
```

## 3.3 Formal RUN_B

```text
authority identity
REPLACEMENT-001

broker run
30877442924 / attempt 1 / SUCCESS

formal workflow run
30877450717 / attempt 1 / SUCCESS

operational identity
MCFT-CAP-08-S6-FORMAL-RUN-B-20260804-REPLACEMENT-001

logical DB identity
MCFT-CAP-08-S6-FORMAL-DB-B-20260804-REPLACEMENT-001

physical database
geox_mcft_cap08_s6_run_b_replacement_001_30877450717

one-run artifact
8880057024

artifact digest
sha256:33e8b0333e1cd22bcd3002540ef5c12b72a8c545e58eb8ca185bf49edc6ae9cc

formal semantic digest
sha256:bacf1177784115836b2ebb2350ee2fbc4529af839202165699f540a657a8314e
```

终态与RUN_A相同：

```text
FINAL_FORMAL / PASS
22 / 22 witnesses PASS
153 canonical receipts
224 operational events
28 phases
7 recovery vectors
fresh database PASS
clean drop PASS
authority dispatch count consumed 1 / 1
rerun / identity reuse / authority reuse false
```

结算PR：

```text
#2795 MERGED
```

## 3.4 Formal comparator implementation

PR #2796：

```text
formal wrapper
scripts/runtime_acceptance/mcft_cap08_s6_formal_comparator/formal_semantic_comparator_v1.cjs

wrapper blob
898fa85e2453add103671eac92ea792f0c600436

qualified normalization dependency
scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/semantic_comparator_v1.cjs

normalization blob
1a2f769aa8a305588eb169e43a4862e9f84db22f

implementation merge
fd3e5662b8e80053365b4e9ca4e356233ff82194

qualification run
30881117123 / attempt 1 / SUCCESS

qualification artifact
8881320548

qualification digest
sha256:1593ef3f5f7b7a1217f26fb3126899d31ff0cee1416306b43e48897b0480639a
```

非正式implementation qualification证明：

```text
semantic digest A
sha256:32c93d4f5ecd1fc50ff94418407767b48b057d77c81bf93dfe3fccf58f0df2f8

semantic digest B
sha256:32c93d4f5ecd1fc50ff94418407767b48b057d77c81bf93dfe3fccf58f0df2f8

difference count
0
```

这不是正式comparator evidence。

## 3.5 Formal comparator execution workflow

PR #2798：

```text
workflow
.github/workflows/mcft-cap-08-s6-formal-cross-run-comparator-execution.yml

workflow blob
b11d60820f35ee39ac2df2a4372cbce7df8cf876

execution control
scripts/runtime_acceptance/mcft_cap08_s6_formal_comparator/formal_comparator_execution_control_v1.cjs

control blob
f6e1673681f734474340c1a1ffab79be60892a7a

workflow merge
596510a233e9c3727ae46405b471acbb29d4984f

qualification run
30884238735 / attempt 1 / SUCCESS

qualification artifact
8882436260

qualification digest
sha256:83183392b756e97d7aea6df82b3e9dd4aceaf20341e14f6ead3184d9f9126555
```

互斥路径：

```text
pull_request / merge_group
→ static qualification only
→ formal execution job SKIPPED

workflow_dispatch
→ effective authority gate
→ exact RUN_A/RUN_B artifact transport
→ exact GitHub input audit
→ one comparator execution
→ one 730-day formal artifact
```

## 3.6 Comparator authority replacement chain

### 不得使用的前任

PR #2797已merged，但candidate遗漏正式execution workflow/control对象，已被append-forward supersede：

```text
predecessor candidate blob
235a1312af7951022a212159cd40e884cda8fbd9

predecessor effectiveness
PROHIBITED

predecessor execution
BLOCKED
```

不得修改或激活它。

### 当前有效链

PR #2799：

```text
Replacement-001 non-effective candidate MERGED
candidate head f5c5ab35dd4f2e1e462d8aff2ee955d6ef569176
candidate merge 4959f5e97b1acea3b0906100ae2f353d352e4d8e
candidate blob dffb2a6df42c4a0860f461761f1cf3e2d360c8ac
candidate qualification run 30887072630 / attempt 1 / SUCCESS
candidate artifact 8883505949
candidate artifact digest
sha256:7c7a97bd501b3ee0187a525fc4c85ffa4663d49002bdb243c2f068cee6eef76d
```

PR #2800：

```text
Replacement-001 effectiveness MERGED
effectiveness merge / current runtime-governance base
678a21c4f6489dafe053d3a20de118b234721626
```

有效authority：

```text
path
docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-001-EXECUTION-AUTHORITY-EFFECTIVE-V1.json

authority ID
GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-001-EXECUTION-AUTHORITY-EFFECTIVE-V1

record status
FORMAL_CROSS_RUN_COMPARATOR_AUTHORIZED

comparator execution ID
MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-20260804-REPLACEMENT-001

effective authority blob
c2df7c3da181ff231931a66c7f6c6b2312b7015a

effective semantic digest
sha256:d16a382c883f3d18677bf2003f347f2dce14b23dfc1089a52ba0ccd216da85ff

authority effective
true

comparator execution authorized
true

maximum execution count
1

required execution attempt
1

rerun / duplicate / authority reuse
false

explicit one-shot approval required
true

formal comparator executed
false
```

冻结12-object manifest：

```text
object-set blob
57d7817bc60074baee4ca3bd71c21e9bb5dab3b2

object-set semantic digest
sha256:d0b9bdaebafd0f71ea8d14dc6995018b7935d1b55c547bf5a32c39cb82a3d26b

object count
12
```

authority有效期：

```text
expires_at
2026-08-08T07:28:00Z
2026-08-08T15:28:00+08:00
```

---

# 4. 当前卡在哪里

当前没有Runtime、PostgreSQL、artifact、normalization或semantic difference技术blocker。

唯一blocker：

```text
EXPLICIT_ONE_SHOT_FORMAL_CROSS_RUN_COMPARATOR_EXECUTION_AUTHORIZATION
```

当前尚未成立：

```text
workflow dispatch
formal comparator execution
formal comparator evidence
authority consumption
S6 Candidate
```

“继续推进”“继续吧”“合并”均不得解释为一次性执行授权。新对话必须要求用户明确授权，例如：

```text
授权执行 Replacement-001 的一次性 Formal Cross-Run Comparator。
```

授权前只允许：

```text
read-only verification
authority expiry check
blob / object-set audit
workflow input audit
existing-run uniqueness audit
handoff/documentation maintenance
```

---

# 5. 下一步完整计划

## Gate 1：执行前只读复核

```text
current main
effective authority path / blob / semantic digest
12-object manifest
workflow / control / wrapper / normalization blobs
RUN_A / RUN_B settled records
RUN_A / RUN_B artifact IDs and digests
authority expiry
existing matching workflow_dispatch count == 0
existing execution_count == 0
```

任何一项不一致都必须停止。

## Gate 2：取得明确一次性授权

不得自动跨越。

## Gate 3：单次dispatch

正式workflow inputs：

```text
exact_subject_sha
ce9d6b4df8c708c0d4a99bb24846e1bc44b3cf59

comparator_execution_id
MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-20260804-REPLACEMENT-001

execution_authority_path
docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-001-EXECUTION-AUTHORITY-EFFECTIVE-V1.json
```

执行约束：

```text
workflow_dispatch exactly once
run_attempt == 1
no rerun
no duplicate dispatch
no authority reuse
authority gate before artifact download
```

## Gate 4：正式结果验收

必须证明：

```text
RUN_A exact artifact audit PASS
RUN_B exact artifact audit PASS
independent operational / logical / physical DB identities
same exact subject
formal wrapper exact blob
normalization exact blob
semantic digest A == B
difference count == 0
formal evidence class
730-day retention
authority execution count consumed 1 / 1
```

预期semantic digest：

```text
sha256:32c93d4f5ecd1fc50ff94418407767b48b057d77c81bf93dfe3fccf58f0df2f8
```

但正式裁决必须来自正式workflow artifact，不能引用implementation qualification代替。

## Gate 5：Comparator success settlement

独立append-forward settlement PR：

```text
formal comparator terminal-success record
authority-consumption record
formal evidence / artifact digest
single-execution uniqueness proof
frozen settlement boundary
focused read-only validator
```

不得在settlement PR中再次执行comparator。

## Gate 6：S6 Candidate和最终关闭

```text
freeze exact S6 Candidate head
Candidate Declaration
independent human exact-SHA approval
merge-tree witness
R2 / 730-day retention attestation
HA-01…HA-24 lifecycle-correct settlement
MCFT-CAP-08 closure
```

只有完成以上全部步骤，才允许MCFT-CAP-09。

---

# 6. 坑与注意事项

## 6.1 不得把development comparator当formal comparator

现有：

```text
scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/semantic_comparator_v1.cjs
```

是已资格化normalization dependency，但其原始执行入口只接受development/non-formal evidence。正式执行必须通过：

```text
scripts/runtime_acceptance/mcft_cap08_s6_formal_comparator/formal_semantic_comparator_v1.cjs
```

和正式execution workflow。

## 6.2 #2797不可生效

#2797对象集遗漏execution workflow/control。它是历史记录，不是备用authority：

```text
DO NOT CREATE EFFECTIVENESS FROM #2797
DO NOT DISPATCH #2797
DO NOT MODIFY #2797 HISTORY
```

## 6.3 Authority失败后也不得rerun

如果正式comparator workflow已经dispatch，即使因transport、audit或代码错误失败：

```text
authority should be treated as consumed
no rerun
no same execution ID reuse
settle failure append-forward
issue a fresh replacement candidate/effectiveness
obtain fresh explicit authorization
```

不得把一次性正式执行当调试器。

## 6.4 Gate必须在artifact transport前

不得先下载A/B artifacts再验证authority。正式workflow已经冻结为：

```text
authority gate
→ artifact transport
→ input audit
→ comparator
```

不得改变顺序。

## 6.5 Normalization不是“忽略产品数据”

只允许：

```text
signed cursor token                 PRESENCE_ONLY
response transport timestamp/hash   EXCLUDED
recovery event instance ref         PRESENCE_ONLY
```

仍必须完整比较：

```text
canonical objects
153 canonical receipts
224 operational events
phase results
selector snapshot
CAP-07 readback
```

## 6.6 Append-forward，不覆盖历史

遇到candidate遗漏对象、authority过期或执行失败时：

```text
preserve old record
write supersession record
issue REPLACEMENT-NNN
new candidate
new effectiveness
new explicit approval
```

不得更新旧authority JSON伪装成新authority。

## 6.7 不得复用正式身份

禁止复用：

```text
comparator_execution_id
authority ID
workflow run attempt
formal artifact identity
RUN_A / RUN_B operational identity
logical / physical database identity
```

## 6.8 GitHub连接器可能没有workflow_dispatch写接口

可使用：

```text
direct GitHub Actions API / authenticated gh
或
受控 one-shot broker
```

如果使用broker：

```text
branch push不得触发
仅protected main merge触发一次
exact before SHA
run_attempt == 1
gate + HTTP 204 + run resolution + retained receipt
不得向已关闭PR写评论
```

RUN_A broker曾因向已关闭PR评论返回403；那不是正式run失败，但新broker不得重复该设计。

## 6.9 Observer只能read-only、关闭不合并

任何为读取push/workflow run而创建的observer必须：

```text
actions: read
no dispatch / rerun permission
close unmerged after evidence retrieval
```

## 6.10 CI中的P1 smoke存在已知executor竞争

PR #2793第一次standard CI中，常驻executor抢先claim P1 smoke task并写FAILED；重试在相同代码和main上通过。只有在日志证明是同一非确定性竞争时，才允许重跑PR CI。

这不适用于正式workflow：

```text
PR CI retry != formal execution rerun
```

---

# 7. 关键PR索引

```text
#2781  exact-path double-run development rehearsal              MERGED
#2784  previous handoff                                         MERGED
#2786  Formal RUN_A candidate                                   MERGED
#2787  Formal RUN_A effectiveness                               MERGED
#2788  Formal RUN_A one-shot dispatch broker                    MERGED
#2790  Formal RUN_A terminal-success settlement                 MERGED
#2791  Formal RUN_B candidate                                   MERGED
#2792  Formal RUN_B effectiveness                               MERGED
#2793  Formal RUN_B one-shot dispatch broker                    MERGED
#2795  Formal RUN_B terminal-success settlement                 MERGED
#2796  formal comparator implementation                         MERGED
#2797  incomplete predecessor comparator candidate              MERGED / SUPERSEDED / NEVER EFFECTIVE
#2798  formal comparator execution workflow                     MERGED
#2799  Replacement-001 complete comparator candidate            MERGED
#2800  Replacement-001 comparator effectiveness                 MERGED
```

历史禁止路径：

```text
#2780  CLOSED / UNMERGED / DO NOT REVIVE
REPLACEMENT-010 NON-EFFECTIVE / NEVER CONSUMED
```

Read-only observers：

```text
#2785 / #2789 / #2794 CLOSED / UNMERGED
```

截至本handoff生成时，没有已知开放的MCFT-CAP-08 S6 execution PR。

---

# 8. 新对话接手清单

```text
1. 读取本文；
2. 获取current main；
3. 比较678a21c4...到current main；
4. 确认handoff-only delta或重新审计全部变化；
5. 读取#2799与#2800；
6. fetch effective authority、object set、workflow、control、wrapper和normalization blobs；
7. 查询是否存在matching comparator workflow_dispatch；
8. 查询authority是否过期或已消费；
9. 未得到明确授权前，只做read-only检查；
10. 得到授权后，只dispatch一次；
11. 正式结果后先做独立settlement，不直接建立S6 Candidate；
12. 完成Candidate Declaration、独立审批、retention和24/24 Ledger后才关闭CAP-08。
```

---

# 9. 一句话交接

> MCFT-CAP-08 S6 的两个正式独立数据库运行已经成功并结算；Formal A/B comparator的实现、执行工作流、完整12-object Replacement-001 candidate和effectiveness均已合入，当前有效authority为`c2df7c3d...`，但尚未取得一次性执行授权、尚未dispatch、尚无正式comparator evidence。下一对话必须先证明authority未过期且未消费，再向用户请求明确的一次性Formal Cross-Run Comparator授权；不得自动执行、不得rerun、不得使用已supersede的#2797。
