00 SpatialUnit & Scale Policy (FROZEN)

Doc ID: GEOX-P0-00
Status: FROZEN (Apple I / Phase 0)
Applies to: Apple I (Monitor) / Apple II (Judge) / Apple III (Control OS)
Non-goal: 不定义任何“应该做什么”的决策逻辑

0.1 术语
	•	SpatialUnit（空间单元，记为 i）：系统进行状态表达、回放、争议归因的最小锚点单位。
	•	Scale（尺度）：一次判断/一次状态表达所处的空间分辨率与覆盖范围。
	•	SubjectRef：一个空间单元的引用（至少包含 projectId，可扩展包含 groupId/plotId/blockId/See `doc/AppleII/` for the complete frozen Apple II normative texts.）。

0.2 强制规则（冻结）

R1：一次判断只能在一个尺度内完成
	•	任意一次生成/刷新 StateVector、或形成候选/控制结论（未来 Apple II/III）：
	•	必须声明其 Scale
	•	不得混用多个尺度的证据进行“外推式结论”

R2：禁止跨尺度外推（No Cross-Scale Extrapolation）

允许：
	•	在 UI 上同时展示不同尺度的 timeline（并列对照）

禁止：
	•	用 block 的证据推断 plot 的状态
	•	用 plot 的状态推断 project 的风险
	•	用某 sensor 点（point）推断整块田的结论（除非显式定义该点是该 SpatialUnit 的代表点，见 R4）

R3：回放锚定
	•	所有可回放内容（Observables / QC / Overlays / StateVector）都必须可追溯到同一个 SpatialUnit i
	•	争议与审计必须能定位到 i

R4：点位（sensor）与 SpatialUnit 的关系必须显式
	•	传感器（sensor）不是空间单元本身，它是 Observation Source
	•	必须通过 entity 明确关系：
	•	project_id
	•	group_id（或未来 plot_id/block_id）
	•	sensor_id

Apple I 允许以 group 作为 SpatialUnit（例如 G_DEFAULT / G_DEMO_30S），但必须在 SubjectRef 中明确它是当前尺度锚点。

0.3 当前工程落地约定（Apple I）
	•	当前 SpatialUnit = group（例如 groupId=G_DEFAULT / G_DEMO_30S）
	•	UI 的 Timeline 页展示：同一 group 下多个 sensor、多指标
	•	后续如引入 plot/block：必须先升级本政策并重新冻结版本

0.4 变更治理
	•	本文档冻结后：
	•	任何新增尺度（plot/block 等）都必须走 Doc PR + 版本号升级（例如 v1.1）
	•	禁止“先写代码再补文档”
