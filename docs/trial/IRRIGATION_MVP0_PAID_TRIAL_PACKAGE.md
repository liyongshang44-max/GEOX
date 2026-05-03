# GEOX 智能灌溉付费共创试点包

## 1. 文档定位

本文档用于定义 GEOX 智能灌溉 MVP-0 的付费共创试点包边界。

本文档继承以下既有 commercial_v1 试点商务与交付口径：

- `docs/TRIAL_COMMERCIAL_BOUNDARY_AND_DELIVERY_SCOPE.md`
- `docs/TRIAL_PAYMENT_INVOICE_ACCEPTANCE_SOP.md`
- `docs/TRIAL_BILLING_AND_ACCEPTANCE_MIN_MODEL.md`
- `docs/COMMERCIAL_V1_TRIAL_RUNBOOK.md`
- `docs/TRIAL_DAY1_CHECKLIST.md`

本文档不是公开价格页，不是 SaaS 年费说明，不替代合同、报价单、发票文件或法务文本。

本文档只回答一个问题：

> GEOX 智能灌溉 MVP-0 当前可以作为怎样的付费共创试点包对外销售。

---

## 2. 产品名称

正式名称：

**GEOX 智能灌溉付费共创试点包**

内部代号：

`IRRIGATION_MVP0_PAID_TRIAL`

对外表述建议：

> 一个受控范围内的智能灌溉共创试点，用于验证 GEOX 从缺水监测、灌溉建议、处方审批、执行回执、验收、Field Memory 到 ROI Ledger 的闭环价值。

---

## 3. 当前卖什么

当前销售的是一个试点项目包，而不是一个自助购买的软件账号。

客户购买的是：

- 部署
- 培训
- 试点运行
- 周报
- 客服支持
- 试点复盘报告
- ROI 证据链
- Field Memory 记录
- 是否扩地块的建议
- 后续真实设备接入评估建议

当前交付目标是：

> 在一个受控地块范围内，验证 GEOX 是否能把智能灌溉闭环转化为可解释、可验收、可复盘的试点成果。

---

## 4. 建议试点范围

### 4.1 默认范围

默认试点范围为：

- 一个地块
- 一个作物季前半段，或 4–8 周
- 一条智能灌溉闭环
- mock valve 或指定设备接口预留
- 周报
- 客服支持
- 试点复盘报告
- ROI 证据链
- Field Memory 记录
- 是否扩地块建议

### 4.2 可选扩展项

以下内容不是默认包含项，需单独约定：

- 多地块扩展
- 多设备真实接入
- 客户现有传感器接入
- 客户现有阀门 / 泵站适配
- 现场驻场支持
- 定制化报告
- 客户内部系统对接
- 更长试点周期
- 季末产量分析

---

## 5. 交付对象

本试点包默认围绕以下对象交付：

1. demo field 或客户指定试点地块。
2. 缺水 observation。
3. irrigation recommendation。
4. irrigation prescription。
5. approval 记录。
6. mock valve skill run 或设备接口预留结果。
7. receipt。
8. as-executed。
9. post-irrigation observation。
10. acceptance。
11. Field Memory。
12. ROI Ledger。
13. Operation Report / Customer Report。
14. 试点复盘报告。

---

## 6. 默认技术链路

试点默认链路为：

```text
Observation
→ Evidence Judge
→ Agronomy Judge / irrigation_deficit_skill_v1
→ Recommendation
→ Prescription
→ Approval
→ Action Task
→ Skill Binding / mock valve skill run
→ Receipt
→ As-executed
→ Post-irrigation Observation
→ Acceptance
→ Customer Report
→ Field Memory
→ ROI Ledger
```

如果某一环节失败，试点不应把失败包装成成功。失败原因应进入支持记录、客户说明或复盘报告。

---

## 7. 客户买到的材料

试点包应向客户交付或展示以下材料：

### 7.1 启动材料

- 试点范围说明
- 试点周期说明
- 试点地块确认
- 角色与联系人确认
- 操作手册
- 演示脚本或演示说明

### 7.2 运行材料

- 周报
- 缺水事件记录
- 灌溉建议记录
- 处方与审批记录
- 执行与回执记录
- 验收记录
- 异常与处理记录

### 7.3 结果材料

- Operation Report / Customer Report
- Field Memory 摘要
- ROI Ledger 摘要
- 试点复盘报告
- 继续 / 调整 / 停止建议

---

## 8. ROI 范围

MVP-0 只围绕以下 ROI 进行展示和复盘：

- 节水估算或实测
- 少跑田 / 人工节省估算
- 异常提前发现
- 验收一次通过率

暂不把以下内容作为第一版强承诺：

- 增产
- 因增产带来的利润提升
- 品质溢价
- 全季最终收益承诺

### 8.1 ROI 可信度说明

每条 ROI 必须能说明：

- 和什么基准线比较
- 采用什么计算方法
- 证据来自哪里
- 是实测还是估算
- 可信度多高

如果客户不能提供 baseline，ROI 只能作为估算参考，不能作为强销售承诺。

---

## 9. Field Memory 范围

MVP-0 的 Field Memory 第一版只承诺以下用途：

- 在报告中说明系统记住了什么
- 在复盘中总结地块响应、设备可靠性和 skill 表现
- 为后续试点扩展提供依据

MVP-0 不承诺：

- 第一版已经自动调参
- 第一版已经形成完整机器学习模型
- 第一版能够直接预测季末产量

默认沉淀三类记忆：

- 地块响应记忆
- 设备可靠性记忆
- Skill 表现记忆

---

## 10. 当前不卖什么

本试点包明确不销售以下内容：

- 成熟 SaaS 年费
- 全自动农业控制系统
- 全场景农业平台
- 增产承诺包
- 全设备兼容承诺
- 全无人值守承诺
- 自助支付能力
- 自助开票能力
- 完整 IAM / SSO
- 完整 CRM / ERP / 财务系统集成

如客户需要上述能力，必须单独立项、单独报价、单独约定验收口径。

---

## 11. 付款与验收建议

付款与验收应继承 `TRIAL_PAYMENT_INVOICE_ACCEPTANCE_SOP.md` 和 `TRIAL_BILLING_AND_ACCEPTANCE_MIN_MODEL.md` 的原则。

推荐节点：

### 11.1 合同启动款

触发条件：

- 客户主体确认
- 试点地块确认
- 试点周期确认
- 交付范围确认

### 11.2 首日交付款

触发条件：

- 环境可用
- demo field 可进入
- 基础对象已建立
- 演示链路可打开

### 11.3 中期确认款（可选）

触发条件：

- 已运行若干次闭环
- 已形成阶段报告
- 客户确认试点继续运行

### 11.4 最终验收款

触发条件：

- 试点复盘报告交付
- ROI Ledger 摘要形成
- Field Memory 摘要形成
- 客户确认继续 / 调整 / 停止结论

---

## 12. 试点成功定义

试点成功不等于证明 GEOX 已经成为成熟农业 OS。

试点成功定义为：

1. 至少完成一次智能灌溉闭环。
2. 客户能看懂缺水发现、建议、处方、审批、执行、验收、记忆、ROI。
3. Field Memory 形成至少三类摘要。
4. ROI Ledger 能解释节水、人工、异常或验收指标。
5. 客户能根据复盘决定继续、调整或停止。

---

## 13. 试点失败或调整定义

出现以下情况，应进入调整或停止判断：

- 传感器数据长期不足
- 设备或 mock valve 链路无法稳定完成
- 证据不足率过高
- 验收长期不通过
- ROI 可信度长期过低
- 客户无法提供 baseline 且无法接受估算口径
- 客户不愿意继续提供试点数据

失败不应被包装成成功。失败原因应进入复盘模板。

---

## 14. 对外报价提示

本文档不规定具体价格。

报价应基于以下因素单独形成：

- 地块数量
- 试点周期
- 是否需要真实设备接入
- 是否需要驻场
- 是否需要定制报告
- 是否需要额外培训
- 是否需要客户系统对接

默认不按 SaaS 年费报价，不按全平台订阅报价。

---

## 15. 正式结论

GEOX 智能灌溉 MVP-0 当前可以对外销售为：

**一个地块、一个短周期、一个智能灌溉闭环、一个客户报告、一个 Field Memory 摘要、一个 ROI Ledger 摘要、一个试点复盘报告的付费共创试点包。**

本文档到此结束。
