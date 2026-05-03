# GEOX 智能灌溉 MVP-0 操作手册

## 1. 文档定位

本文档用于指导交付人员、销售支持人员和试点客户窗口完成 GEOX 智能灌溉 MVP-0 的基础操作。

本文档继承以下通用试点文档：

- `docs/COMMERCIAL_V1_TRIAL_RUNBOOK.md`
- `docs/TRIAL_DAY1_CHECKLIST.md`
- `docs/TRIAL_COMMERCIAL_BOUNDARY_AND_DELIVERY_SCOPE.md`

本文档不是开发调试手册，不要求操作者理解容器、Topic、数据库表或内部工程对象。

本文档只围绕一条路径：

```text
缺水 observation
→ recommendation
→ prescription
→ approval
→ mock valve skill run
→ receipt / as-executed
→ acceptance
→ Field Memory
→ ROI Ledger
→ customer report
```

---

## 2. 操作前检查

开始操作前，确认：

1. 使用当前正式试点环境。
2. Web 页面可访问。
3. 操作账号具备查看报告和执行试点动作的权限。
4. demo field 已准备。
5. mock valve skill 可用。
6. 操作人员知道本次只演示智能灌溉 MVP-0。
7. 不把施肥、植保、巡检作为本次操作范围。

如果以上条件不满足，先按 Support Runbook 排障，不进入客户演示。

---

## 3. 查看 demo field

目标：确认本次演示或试点有一个明确地块作为闭环对象。

操作：进入地块详情页或客户总览页，找到本次 demo field。

需要确认：

- 地块名称或 field_id 正确
- 地块属于当前试点范围
- 地块能进入详情页
- 该地块能关联 observation / recommendation / operation report

通过标准：客户能明确知道这次演示就是围绕这一块地展开。

---

## 4. 查看缺水 observation

目标：确认系统有一条缺水观测作为闭环入口。

操作：查看地块当前状态、传感器数据或报告中的 observation 入口。

重点确认：

- soil moisture 低于阈值或处于缺水风险
- observation 有时间戳
- observation 能作为 recommendation 的依据

讲解口径：

> GEOX 不是直接下发任务，而是先记录观测数据。观测数据是后续诊断、推荐和验收的依据。

异常处理：如果没有 observation，不继续演示 recommendation，转到 Support Runbook 的“传感器无数据 / observation 缺失”部分。

---

## 5. 查看 recommendation

目标：确认系统基于缺水 observation 生成灌溉建议。

操作：进入 recommendation 或作业相关页面，查看智能灌溉建议。

重点确认：

- recommendation 存在
- recommendation 关联当前 field
- recommendation 说明为什么建议灌溉
- recommendation 有 skill_trace 或等价追踪信息

讲解口径：

> 建议说明系统认为这块地存在缺水风险，但建议本身不会直接变成任务，还需要处方和审批。

异常处理：如果 recommendation 未生成，先确认 observation、地块范围和智能灌溉 skill，不允许口头声称“理论上可以生成”。

---

## 6. 查看 prescription

目标：确认 recommendation 已转成可执行、可审批、可验收的灌溉处方。

操作：打开处方详情或报告中的处方摘要。

重点确认：

- prescription_id 存在
- 目标地块正确
- 灌溉目标明确
- 执行窗口明确
- 计划用水或执行时长明确
- 验收条件明确
- 保留 recommendation / skill_trace 来源

讲解口径：

> 处方是 GEOX 从建议走向执行的正式契约层。没有处方，不允许直接生成正式作业任务。

---

## 7. 执行 approval

目标：确认灌溉处方经过人工审批。

操作：进入审批入口，查看或执行 approval。

重点确认：

- 审批状态
- 审批人
- 审批时间
- 审批备注

通过标准：审批通过后，才能进入 Action Task 和 mock valve skill run。

讲解口径：

> 试点阶段保留人工审批，确保自动化执行有明确责任边界。系统不是看到缺水就擅自开阀。

---

## 8. 查看 mock valve skill run

目标：确认设备执行链路通过 Skill 层完成。

操作：查看任务执行状态、skill run 或作业报告中的执行区块。

重点确认：

- Action Task 存在
- mock valve skill run 存在
- 执行状态明确
- 执行开始 / 结束时间可见
- 有回执或日志引用

讲解口径：

> MVP-0 用 mock valve 验证 GEOX 的设备执行治理链路。真实阀门接入属于后续试点扩展项，但接口必须通过 Skill 层。

异常处理：如果 mock valve 执行失败，不继续声称已执行，必要时转人工执行口径。

---

## 9. 查看 receipt / as-executed

目标：确认系统有执行回执和实际执行记录。

操作：在作业详情或报告中查看 receipt、as-executed、执行开始时间、执行结束时间、实际执行量和证据引用。

讲解口径：

> receipt 证明执行发生，as-executed 说明实际执行了什么。它们是验收和 ROI 的基础，不是单独的收费对象。

---

## 10. 查看 acceptance

目标：确认系统对灌溉效果进行验收。

操作：查看作业报告中的“验收结果”区块。

重点确认：

- 验收状态
- 验收结论
- 缺失证据提示
- 验收时间

讲解口径：

> GEOX 不把执行完成等同于成功。系统会继续检查灌后观测和证据，判断是否达到预期。

---

## 11. 查看 Field Memory

目标：确认本次闭环形成地块记忆。

操作：打开 Operation Report 中的“系统记住了什么”。

至少确认三类：

- 地块响应记忆
- 设备可靠性记忆
- Skill 表现记忆

讲解口径：

> 系统不仅记录这次做过灌溉，还会记住这块地灌后响应如何、设备是否可靠、诊断 skill 是否被采纳。这些信息用于后续报告和复盘。

当前版本边界：MVP-0 不承诺 Field Memory 已经自动调参。

---

## 12. 查看 ROI Ledger

目标：确认本次闭环形成价值账本。

操作：打开 Operation Report 中的“本次价值账本”。

重点查看：

- 节水
- 少跑田 / 人工节省
- 异常提前发现
- 验收一次通过率
- baseline
- confidence
- value kind

讲解口径：

> ROI Ledger 会说明和什么比、怎么算、证据是什么、可信度多高。估算值不会包装成实测值。

---

## 13. 查看客户报告

目标：通过客户报告完整讲清闭环。

进入 Operation Report 页面，按顺序查看：

1. 为什么做
2. 谁批准
3. 怎么执行
4. 有什么证据
5. 验收结果
6. 系统记住了什么
7. 本次价值账本
8. 最终结论

通过标准：客户能看懂为什么建议灌溉、谁批准、实际做了什么、是否通过验收、系统记住了什么、ROI 怎么算。

---

## 14. 操作完成定义

一次 MVP-0 操作完成，必须具备：

- demo field 可识别
- 缺水 observation 可说明
- recommendation 可追踪
- prescription 可说明
- approval 可见
- mock valve skill run 可见
- receipt / as-executed 可见
- acceptance 可见
- Field Memory 可见
- ROI Ledger 可见
- Operation Report 可讲

缺任一关键环节，不应对客户说“完整闭环已完成”。

---

## 15. 常见禁止操作

禁止：

- 用工程日志替代客户报告
- 用 receipt 替代 acceptance
- 用执行成功替代 ROI
- 用估算 ROI 冒充实测 ROI
- 用 mock valve 承诺真实阀门已兼容
- 在没有 Field Memory 时说系统已经沉淀记忆
- 在没有 baseline 时说 ROI 已可强证明收益

本文档到此结束。
