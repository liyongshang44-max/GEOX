# GEOX 智能灌溉 MVP-0 试点复盘模板

## 1. 文档定位

本文档用于 GEOX 智能灌溉 MVP-0 付费共创试点结束或阶段确认时的复盘。

本文档继承以下既有商业与验收口径：

- `docs/TRIAL_PAYMENT_INVOICE_ACCEPTANCE_SOP.md`
- `docs/TRIAL_BILLING_AND_ACCEPTANCE_MIN_MODEL.md`
- `docs/TRIAL_COMMERCIAL_BOUNDARY_AND_DELIVERY_SCOPE.md`

本文档不是合同，不是报价单，不是财务结算单。它用于把试点运行事实、Field Memory、ROI Ledger 和客户反馈整理成继续 / 调整 / 停止的决策依据。

---

## 2. 复盘结论

复盘结论只能选择以下三类之一：

- `CONTINUE`：继续试点或扩地块
- `ADJUST`：调整传感器、设备、skill、baseline 或流程后继续
- `STOP`：当前场景不适合继续投入

结论：`CONTINUE / ADJUST / STOP`

结论摘要：

```text
填写本轮试点的最终判断。
```

---

## 3. 试点基本信息

| 项目 | 内容 |
|---|---|
| 客户名称 |  |
| 试点名称 | GEOX 智能灌溉 MVP-0 付费共创试点 |
| 试点周期 |  |
| 地块范围 |  |
| 作物 / 作物阶段 |  |
| 销售负责人 |  |
| 交付负责人 |  |
| 支持负责人 |  |
| 客户侧负责人 |  |
| 报告日期 |  |

---

## 4. 试点范围确认

本轮试点默认范围：

- 一个地块
- 一个作物季前半段或 4–8 周
- 一条智能灌溉闭环
- mock valve 或指定设备接口预留
- 周报
- 客服支持
- ROI 证据链
- Field Memory 记录

本轮是否超出默认范围：`是 / 否`

如超出，说明单独约定内容：

```text
填写扩展范围、责任边界和费用/验收约定。
```

---

## 5. 闭环运行数据

| 指标 | 数值 | 说明 |
|---|---:|---|
| 闭环次数 |  | 从缺水 observation 到报告的完整链路次数 |
| 缺水事件次数 |  | soil moisture 或等价信号触发次数 |
| 灌溉推荐次数 |  | recommendation 数量 |
| 处方生成次数 |  | prescription 数量 |
| 人工审批次数 |  | approval 数量 |
| 灌溉执行次数 |  | mock valve 或真实设备 / 人工执行次数 |
| receipt 数量 |  | 执行回执数量 |
| as-executed 数量 |  | 实际执行记录数量 |
| acceptance 数量 |  | 验收次数 |
| 验收通过率 |  | PASS / total |
| 证据不足次数 |  | missing evidence 或 insufficient evidence |
| 设备故障次数 |  | mock valve / device failure |

---

## 6. ROI Ledger 摘要

### 6.1 节水

| 项目 | 内容 |
|---|---|
| ROI 类型 | WATER_SAVED |
| baseline_type |  |
| baseline_value |  |
| actual_value |  |
| delta_value |  |
| unit |  |
| value_kind | MEASURED / ESTIMATED / ASSUMPTION_BASED / INSUFFICIENT_EVIDENCE |
| confidence |  |
| calculation_method |  |
| evidence_refs |  |
| 结论 |  |

### 6.2 少跑田 / 人工节省

| 项目 | 内容 |
|---|---|
| ROI 类型 | LABOR_SAVED |
| baseline_type |  |
| baseline_value |  |
| actual_value |  |
| delta_value |  |
| unit |  |
| value_kind |  |
| confidence |  |
| calculation_method |  |
| evidence_refs |  |
| 结论 |  |

### 6.3 异常提前发现

| 项目 | 内容 |
|---|---|
| ROI 类型 | EARLY_WARNING_LEAD_TIME |
| baseline_type |  |
| baseline_value |  |
| actual_value |  |
| delta_value |  |
| unit |  |
| value_kind |  |
| confidence |  |
| calculation_method |  |
| evidence_refs |  |
| 结论 |  |

### 6.4 验收一次通过率

| 项目 | 内容 |
|---|---|
| ROI 类型 | FIRST_PASS_ACCEPTANCE_RATE |
| baseline_type |  |
| baseline_value |  |
| actual_value |  |
| delta_value |  |
| unit |  |
| value_kind |  |
| confidence |  |
| calculation_method |  |
| evidence_refs |  |
| 结论 |  |

### 6.5 ROI 总体判断

```text
填写 ROI 是否足以支持继续试点、是否只是估算、是否需要客户提供更可靠 baseline。
```

---

## 7. Field Memory 摘要

### 7.1 地块响应记忆

填写内容：

- 灌前湿度
- 灌后湿度
- 湿度变化
- 是否达到目标区间
- 证据引用
- 可信度

摘要：

```text
填写该地块对灌溉的响应情况。
```

### 7.2 设备可靠性记忆

填写内容：

- 阀门或 mock valve 响应情况
- ACK 延迟
- 执行超时情况
- receipt 完整性
- 失败次数

摘要：

```text
填写设备或 mock valve 链路可靠性。
```

### 7.3 Skill 表现记忆

填写内容：

- irrigation_deficit skill 触发次数
- recommendation 被审批次数
- 执行成功次数
- acceptance 通过次数
- skill_trace_ref
- 失败模式

摘要：

```text
填写智能灌溉 skill 在本轮试点中的表现。
```

---

## 8. 客户反馈

| 问题 | 客户反馈 | 处理建议 |
|---|---|---|
| 是否看懂缺水发现 |  |  |
| 是否认可 recommendation 解释 |  |  |
| 是否认可 prescription 和 approval 边界 |  |  |
| 是否认可 mock valve 作为 MVP-0 验证方式 |  |  |
| 是否认可 acceptance 结果 |  |  |
| 是否认可 Field Memory 表达 |  |  |
| 是否认可 ROI Ledger 可信度 |  |  |
| 是否愿意继续提供 baseline |  |  |
| 是否愿意接真实设备 |  |  |
| 是否愿意扩地块 |  |  |

---

## 9. 问题与风险

| 风险项 | 是否发生 | 影响 | 后续动作 |
|---|---|---|---|
| 传感器数据不足 |  |  |  |
| 设备或 mock valve 执行失败 |  |  |  |
| approval 卡住 |  |  |  |
| acceptance 不通过 |  |  |  |
| Field Memory 未形成 |  |  |  |
| ROI 缺 baseline |  |  |  |
| ROI 可信度低 |  |  |  |
| 客户预期超出 MVP-0 |  |  |  |
| 客户要求增产承诺 |  |  |  |

---

## 10. 继续 / 调整 / 停止判定规则

### 10.1 建议 CONTINUE 的条件

满足多数条件时，可建议继续或扩地块：

- 至少一条智能灌溉闭环完整跑通
- 验收通过率可接受
- Field Memory 三类摘要形成
- ROI Ledger 能解释节水、人工、异常或验收指标
- 客户认可估算 / 实测边界
- 客户愿意继续提供 baseline 或接真实设备

### 10.2 建议 ADJUST 的条件

出现以下情况时，建议调整后继续：

- observation 不稳定但可修复
- mock valve 或真实设备链路不稳定
- ROI 缺客户 baseline
- Field Memory 有记录但表达不够清楚
- acceptance 失败原因明确且可改
- 客户希望扩大范围但需重订边界

### 10.3 建议 STOP 的条件

出现以下情况时，建议停止该场景扩张：

- 多次无法形成有效 observation
- recommendation 长期无法转 prescription
- 执行链路长期失败
- acceptance 长期不通过
- ROI 长期证据不足且客户不接受估算
- 客户不愿继续提供试点数据
- 客户要求超出 MVP-0 的承诺且无法单独约定

---

## 11. 下一步建议

选择一项：

- 继续当前地块试点
- 扩展到更多地块
- 接入真实阀门 / 泵站
- 补充传感器
- 调整 baseline
- 调整 skill 或阈值
- 暂停试点
- 停止该场景

具体建议：

```text
填写下一步执行建议。
```

---

## 12. 归档材料清单

复盘归档时，应至少包含：

- 本复盘模板
- Operation Report / Customer Report
- Field Memory 摘要
- ROI Ledger 摘要
- 支持记录
- 客户沟通纪要
- 验收或阶段确认材料
- 商务节点说明

本文档到此结束。
