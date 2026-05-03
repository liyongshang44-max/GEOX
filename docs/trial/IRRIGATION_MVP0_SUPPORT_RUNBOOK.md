# GEOX 智能灌溉 MVP-0 支持与排障 Runbook

## 1. 文档定位

本文档用于 GEOX 智能灌溉 MVP-0 付费共创试点期间的支持、排障和应急回退。

本文档继承以下既有通用试点文档：

- `docs/COMMERCIAL_V1_TRIAL_RUNBOOK.md`
- `docs/TRIAL_DAY1_CHECKLIST.md`
- `docs/TRIAL_PAYMENT_INVOICE_ACCEPTANCE_SOP.md`

本文档只服务于智能灌溉 MVP-0，不用于施肥、植保、巡检或成熟 SaaS 运维。

---

## 2. 排障总原则

出现问题时必须先定位链路层，不允许直接猜原因。

排障顺序固定为：

```text
环境 / 权限
→ Field
→ Observation
→ Recommendation
→ Prescription
→ Approval
→ Task / Skill Run
→ Receipt / As-executed
→ Acceptance
→ Field Memory
→ ROI Ledger
→ Customer Report
```

禁止：

- 用工程日志替代客户可读报告
- 跳过前置对象直接重跑后置任务
- 把失败链路包装成成功
- 把估算 ROI 包装成实测 ROI
- 把 mock valve 演示说成真实设备已兼容

---

## 3. 环境或页面不可访问

现象：

- Web 页面打不开
- API 请求失败
- 登录或 token 失效
- 页面白屏

处理：

1. 确认是否使用正式试点环境。
2. 确认 server / web 入口是否正确。
3. 确认 token 或会话是否有效。
4. 确认是否误用 legacy / dev 页面。
5. 未恢复前，不进入业务链路排障。

对客户口径：

> 当前是试点环境访问问题，尚未进入业务闭环判断。恢复后会重新从地块和 observation 开始检查。

---

## 4. demo field 缺失

现象：

- 找不到试点地块
- 进入地块页失败
- 地块不属于当前试点范围

处理：

1. 确认 field_id / field name 是否正确。
2. 确认当前账号是否有地块访问权限。
3. 确认地块是否已创建。
4. 若是演示环境，重建 demo field。

对客户口径：

> 当前问题是试点对象未就绪，不是灌溉闭环失败。需要先恢复地块对象。

---

## 5. 传感器无数据 / observation 缺失

现象：

- 没有 soil moisture observation
- observation 时间戳过旧
- 数据无法作为 recommendation 依据

处理：

1. 确认设备或模拟数据是否已写入。
2. 确认 metric 是否为 soil_moisture 或当前灌溉 skill 支持的等价指标。
3. 确认 observed_at 是否在可接受时间窗口内。
4. 如为真实设备，检查设备在线、网关、采集周期和时间同步。
5. 如为 mock 数据，重新写入缺水 observation。

对客户口径：

> GEOX 不会在缺少有效观测数据时强行生成可信建议。当前需要先恢复观测数据。

---

## 6. recommendation 未生成

现象：

- 有 observation，但没有 irrigation recommendation
- recommendation 不关联当前 field
- recommendation 没有 skill_trace

处理：

1. 确认 observation 是否显示缺水风险。
2. 确认 irrigation_deficit skill 或等价能力是否已注册。
3. 确认 field / crop / season 是否满足 skill binding 条件。
4. 确认 recommendation 生成接口或任务是否返回错误。
5. 若 recommendation 无 skill_trace，不进入 MVP-0 正式报告。

对客户口径：

> 当前卡在诊断建议阶段。系统不会把没有明确来源和解释的建议推进到处方和任务。

---

## 7. prescription 未生成

现象：

- recommendation 存在，但没有 irrigation prescription
- prescription 缺目标、执行窗口、计划用水或验收条件

处理：

1. 确认 recommendation_id 正确。
2. 确认 recommendation 的 action type 是灌溉相关。
3. 确认 prescription 生成接口是否成功。
4. 确认 prescription 保留 skill_trace 来源。
5. 缺 prescription 时，不允许生成正式 Action Task。

对客户口径：

> 建议不会直接变成任务。当前需要先形成可审批、可执行、可验收的处方。

---

## 8. approval 卡住或被拒绝

现象：

- approval 未生成
- approval 长时间 pending
- approval rejected

处理：

1. 确认 prescription_id 是否存在。
2. 确认审批人或 token 是否有效。
3. 查看审批备注。
4. 若 rejected，不继续执行 device skill。
5. 如需重提，必须重新生成或重新提交审批，保留原始记录。

对客户口径：

> 当前被审批边界阻断。GEOX 的试点设计就是避免未经确认的自动执行。

---

## 9. mock valve 执行失败

现象：

- mock valve skill run 未生成
- skill run 返回 DEVICE_OFFLINE 或等价失败
- task 有但没有执行结果

处理：

1. 确认 approval 已通过。
2. 确认 task_id 正确。
3. 确认 mock valve skill 可用。
4. 确认 device_id 和 field_id 是否匹配。
5. 若失败，记录失败原因，必要时转人工执行口径。

对客户口径：

> 当前卡在执行层。系统不会把设备未响应包装成成功，会记录为执行失败或转人工处理。

---

## 10. receipt 或 as-executed 缺失

现象：

- skill run 有结果，但没有 receipt
- receipt 有，但 as-executed 未生成
- 执行量或时间缺失

处理：

1. 确认 skill run 是否成功。
2. 确认 receipt 是否写入。
3. 确认 receipt 是否包含执行时间、资源用量、证据引用。
4. 确认 as-executed 是否从 receipt 生成。
5. 缺 receipt / as-executed 时，不进入高可信 acceptance。

对客户口径：

> 执行发生必须有回执和实际执行记录，否则不能形成完整验收和 ROI 依据。

---

## 11. acceptance 不通过或缺失

现象：

- acceptance 未生成
- acceptance fail
- missing evidence
- post-irrigation observation 无回升

处理：

1. 确认 receipt / as-executed 是否存在。
2. 确认 post-irrigation observation 是否存在。
3. 确认灌后湿度是否回升。
4. 确认证据是否充分。
5. 若不通过，输出失败原因，不允许标记为成功。

对客户口径：

> GEOX 区分“执行发生”和“作业有效”。验收未通过时，系统会保留失败原因用于复盘。

---

## 12. Field Memory 不显示

现象：

- Operation Report 中“系统记住了什么”为空
- 三类 memory 不完整
- skill performance memory 缺 skill_trace

处理：

1. 确认 acceptance 已完成。
2. 确认 field_memory_v1 是否写入。
3. 确认至少有三类 memory：
   - FIELD_RESPONSE_MEMORY
   - DEVICE_RELIABILITY_MEMORY
   - SKILL_PERFORMANCE_MEMORY
4. 确认 report 查询 operation_id / task_id / recommendation_id / acceptance_id 能匹配 memory。
5. 缺 Field Memory 时，报告不得说“系统已记住”。

对客户口径：

> 当前记忆层未形成，不能宣称系统已经沉淀本次作业经验。需要修复写入或报告关联。

---

## 13. ROI Ledger 不显示

现象：

- Operation Report 中“本次价值账本”为空
- ROI 缺 baseline
- ROI 缺 confidence
- ROI 被错误标记为 measured

处理：

1. 确认 as-executed 与 acceptance 是否存在。
2. 确认 roi_ledger_v1 是否写入。
3. 确认 ROI 至少包含 baseline、calculation_method、confidence、evidence_refs。
4. 确认 value_kind 是否正确区分 MEASURED / ESTIMATED / ASSUMPTION_BASED / INSUFFICIENT_EVIDENCE。
5. 缺 baseline 时，不得作为强收益证明。

对客户口径：

> 当前 ROI 证据链不足，只能作为待补充项，不能包装成确定收益。

---

## 14. 客户质疑 baseline

处理：

1. 询问客户是否有历史用水、人工、巡检或相邻地块数据。
2. 若有，标记为 CUSTOMER_PROVIDED 或 HISTORICAL_AVERAGE。
3. 若没有，只能使用 DEFAULT_ASSUMPTION。
4. 使用 DEFAULT_ASSUMPTION 时，必须标注为估算。

对客户口径：

> ROI 的可信度取决于 baseline。客户提供真实基准线后，试点复盘会更接近实际收益。

---

## 15. 何时转人工

出现以下情况，应转人工执行或人工复核：

- approval 未明确通过
- mock valve / 真实设备执行失败
- 证据不足
- post-irrigation observation 异常
- acceptance fail
- ROI 可信度过低且客户要求继续操作

转人工后仍需保留 receipt、as-executed、acceptance 和报告说明。

---

## 16. 何时暂停试点

出现以下情况，应暂停试点并进入复盘：

- 多次无有效 observation
- 多次 recommendation 无法形成 prescription
- 多次设备执行失败
- 多次 acceptance 不通过
- Field Memory 长期无法写入
- ROI 长期无法形成 baseline 和 confidence
- 客户对试点范围或收益口径产生重大分歧

---

## 17. 支持结论模板

每次支持处理后，输出：

```text
问题层级：Observation / Recommendation / Prescription / Approval / Execution / Acceptance / Field Memory / ROI / Report
问题现象：
已确认事实：
当前处理：
是否影响客户演示：是 / 否
是否影响收费试点验收：是 / 否
后续动作：
```

本文档到此结束。
