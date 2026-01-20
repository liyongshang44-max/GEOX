03 Language Redlines (FROZEN)

Doc ID: GEOX-P0-03
Status: FROZEN
Scope: UI 文案、API 字段名、日志输出、报告模板
Goal: 防止 Apple I/II/III 边界被“语言”悄悄突破

3.1 禁止词（硬禁止）

以下词语不得出现在：
	•	UI 标题/描述
	•	API 字段名/返回值
	•	默认日志
	•	自动生成报告

硬禁止词清单（最小集）
	•	应该 / 必须 / 建议 / 推荐
	•	有效 / 无效 / 最优 / 最佳
	•	诊断 / 病因 / 原因确定
	•	合法 / 违法（Apple III 才允许在“控制宪法”中出现，但 Apple I/II UI 不可出现）
	•	需要灌溉 / 需要施肥 / 需要打药（任何作业型表达）
	•	提高产量 / 减少损失（收益承诺）

3.2 允许词（建议使用）

Apple I/II 可用的表达（中性）：
	•	“观测到(see doc/AppleII for full text)”
	•	“证据不足 / 冲突”
	•	“数据间断 / stale / gap”
	•	“出现持续偏移（candidate / shift）”
	•	“需要补观测（AO-SENSE）”（仅 Apple I Phase 5/Apple II 允许）

3.3 UI 标签规范（冻结）
	•	Panel 名称不得包含：
	•	Coach / Advisor / Recommendation（你们现在叫 Coach Panel，但副标题已声明 No Advice；建议后续改名为 “Evidence Summary” 更安全）
	•	允许：
	•	Monitor / Timeline / Evidence / Replay / Summary / Candidate

3.4 违规处理（冻结）
	•	PR 检查项：
	•	出现禁止词则必须修改
	•	若必须在测试/注释提到：
	•	仅允许在 docs/ 或 test/ 且明确标注 “Forbidden wording example”

⸻

