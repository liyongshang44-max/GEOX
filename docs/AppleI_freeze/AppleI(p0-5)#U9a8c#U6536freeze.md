GEOX · FREEZE.md

Phase-5（P5）工程冻结声明

生效日期： 2025-12-24
适用范围： GEOX Phase-5（Evidence-Only Monitoring）

⸻

一、冻结目的（Why This Exists）

本文件用于明确冻结 GEOX Phase-5 的工程事实边界，防止以下行为：
	•	为“好看”而改变数据语义
	•	为“智能”而引入隐式推断
	•	为“用户友好”而破坏可重放性（Replayability）

P5 是“证据呈现层”，不是决策层。

⸻

二、Phase-5 的核心不变量（Invariants）

以下不变量 任何改动都会破坏 Phase-5 的成立条件：
	1.	Evidence-Only
	•	所有展示内容必须来自真实写入的数据事实
	•	不允许 UI / API 层生成新含义
	2.	Replayability
	•	同一数据 + 同一时间窗
	•	⇒ 同一 series / overlays / P5 panel 结论
	3.	No Advice
	•	不给建议
	•	不给阈值
	•	不给“应该做什么”

⸻

三、冻结项（Frozen — ❌ 不得修改）

🔒 F-1 数据契约（Data Contracts）

raw_sample_v1
	•	ts
	•	sensor_id
	•	metric
	•	value
	•	quality

禁止：
	•	隐式插值
	•	自动平滑
	•	前端补点

⸻

overlay_v1
	•	kind
	•	startTs / endTs
	•	sensor_id
	•	metric（可为 null）

说明：
	•	overlay 只标记事实
	•	不改变 series 数值

⸻

marker_v1
	•	点位标注事实
	•	不产生推论

⸻

🔒 F-2 Series API 行为

冻结以下语义：
	•	时间窗严格裁剪（startTs / endTs）
	•	gaps 仅表示“无数据区间”
	•	overlays 与 series 独立

明确禁止：
	•	API 层插值
	•	API 层趋势计算
	•	API 层预测

⸻

🔒 F-3 P5 Coach Panel 语义

冻结字段：
	•	latest
	•	readability
	•	trend_label
	•	latest_candidate
	•	window_status

冻结原则：
	•	描述 ≠ 解释
	•	趋势 ≠ 建议
	•	窗口 ≠ 行动窗口

⸻

🔒 F-4 Replayability 定义

Replayability 冻结定义为：

同一数据集
	•	同一查询参数
⇒ 同一可视事实 + 同一 P5 结论

视觉样式差异 不影响 Replay 判定。

⸻

四、允许修改项（Allowed — ✅ 可改）

以下内容 不影响 Phase-5 合法性：
	•	线条颜色（palette）
	•	点大小 / 是否显示 points
	•	线宽
	•	grid / axis 样式
	•	legend / UI 排版

⚠️ 前提：
不得改变数据 → 像素的映射关系

⸻

五、已知且接受的现象（Accepted Behavior）

以下情况 不是 bug：
	•	数据极稀疏（3～6 点）时曲线看起来“断”
	•	数据极密集时曲线看起来“糙”
	•	hover 有值但线不连续（真实 gaps）

这些都是 真实数据的视觉反映。

⸻

六、变更规则（Change Policy）

任何涉及以下内容的修改：
	•	数据语义
	•	Series 构造逻辑
	•	P5 Panel 判定逻辑

必须：
	1.	新开 Phase（如 Phase-6）
	2.	或提交独立 RFC
	3.	不得直接修改本冻结范围

⸻

七、Phase-5 完成声明（Final）

Phase-5 在 GEOX 中已工程完成并冻结。

后续所有：
	•	Explainability
	•	Decision Support
	•	Agronomy Logic

必须构建在 Phase-5 之上，而不是修改 Phase-5。
Phase-5 是 Apple I 的最终能力上限。
Apple I 不再新增任何“理解、判断或控制”能力。