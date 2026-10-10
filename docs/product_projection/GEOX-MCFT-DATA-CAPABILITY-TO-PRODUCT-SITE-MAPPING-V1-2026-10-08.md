# GEOX MCFT → Product API → Customer Site 数据能力映射 V1

**Status: repository evidence audit / design mapping only — not a production activation authority.**

- Audit basis protected main: `648c1499f23c9c5d11483b0b797c8700e398349d` (2026-10-08).
- Scope: MCFT master V2 / CAP-04 Forecast-Scenario / CAP-07 minimal read model / CAP-09 Shadow-online, Product API Wave-02 source and module contracts, frontend canonical blueprint. Current ChatGPT Site running files and actual local Docker are **not independently accessed** in this audit.
- This document catalogs **implemented semantics**, **qualified data path**, **current Product projection**, and **desired Site user experience** separately. A code object existing does NOT prove a current Formal-v5 record or customer API data in production.
- No Runtime, schema, owner, ARM, A0, O00, protected main or Site change is authorized by this document.

## A. Overall finding

**MCFT is the producer/authority of field observations, the modelled field state, forecast outputs and their causal history; Product API is a non-authoritative read-only customer projection; Site is a consumer, not the writer or the authority.** ADR and B-Line each retain their own separate decision and execution authority.

There are **84 traceable capability/ownership rows** in Section C, **10 Site-surface mappings** in Section D and **10 delivery gates** in Section E. This inventory is exhaustive for the **selected master/CAP-04/07/09 + Product Wave-02/customer Site baseline**, not a claim that every GEOX-wide capability, data table or feature across the organization is already built.

### Four independent status dimensions (DO NOT conflate)

1. **MCFT contract/implementation**: proven in a Replay/Shadow-online repository capability vs currently actually generated at CAP-09 production O00.
2. **Read-surface qualification**: CAP-07 can read the canonical object vs Product API can read it for a specific authorized customer and exact scope.
3. **Product projection**: an actually implemented mapped field vs a typed placeholder or unimplemented endpoint.
4. **Site consumption**: an actually wired Site control vs a proposed design target. Site production runtime was not separately inspected.

**Product-state legend for Section C:** `E` = current Wave-02 customer projection implemented (underlying field may be null or an existing limitation); `C` = current Wave-02 conditional active-scope/canonical-state projection implemented but live data not established; `U` = MCFT source/object exists or specified but **no customer-safe Wave-02 projection**; `G` = governance/operator-only or not suitable as a raw public customer field; `X` = out of MCFT field-state authority or a value Product must not invent.

**Priority:** `P0` necessary to show first truthful current state; `P1` core field-intelligence product value; `P2` successor/extended scope or separate authority.

### Confirmed Wave-02 endpoints

| Existing route | Product contract | Repo implementation | Current limit |
|---|---|---|---|
| `GET /api/product/v1/overview` | `CustomerOverviewProjectionV1` | `registerProductV1Routes` | field previews exist; Attention/Operations/Reports are typed unavailable collections |
| `GET /api/product/v1/fields` | `FieldSummaryProjectionV1[]` | PostgreSQL `field_index_v1`, plus active lineage / posterior resolution | no active six-key runtime => `MCFT_CURRENT_RUNTIME_NOT_ESTABLISHED`; display name can be null |
| `GET /api/product/v1/fields/:fieldRef` | `FieldWorkspaceProjectionV1` | current condition from exact CAP-07 S4, state canonical payload | Activity, Evidence, History, Action Cases, Outcomes, Capabilities are placeholders/unavailable |

Customer auth is restricted to tenant/project/group + allowed fields, enforced before reading. Read-only Product API uses `GEOX_PRODUCT_DATABASE_URL`, a non-writer SQL role and read-only SQL guards; it must not reuse MCFT Evidence/Twin writer credentials. See Section G.

### First O00 does **not** automatically equal Site availability

CAP-09 Formal-v5 target database: `geox_mcft_cap09_s6_formal_t4r1_24h_v5`. Product API documented deployment database: `geox_mcft_cap09_production_runtime_v1`. These are distinct physical read targets. Their governed projection/replication/authority binding, target six-key scope, active lineage and Product API credentials **must be proven**; no direct blind database swap. CAP-09 formally covers **one public-research field/season/zone**, not arbitrary customer parcels. Site can show a lawful status before 24T is complete, but must not claim Stage1B/CAP09 COMPLETE without G12/G13 adjudication.

## B. Source shorthand (exact files)

- **A**: `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md + Amendment-01`
- **B**: `docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-TASK.md`
- **C**: `docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-TASK.md`
- **D**: `docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE-V2.md`
- **P**: `apps/server/src/product_projection/customer/customer_product_projection_builder_v1.ts + contracts_v1.ts`
- **F**: `docs/product_projection/PRODUCT_API_MODULE_DATA_COVERAGE_V1.json`
- **S**: `docs/frontend-productization/GEOX-FRONTEND-CANONICAL-BLUEPRINT-V1.md`

## C. MCFT capability/authority → Product API → Site mapping

| ID | Data capability | Exact producer / data family | Product | Site consumption | Required condition / limitation | Owner | Priority | Audit source |
|---|---|---|---|---|---|---|---|---|
| I01 | 田块身份 | field_index_v1: field_id | E | C02 / C03 Overview | 已存在身份读取；仅同 tenant/project/group + allowed_field_ids | FOUI | P0 | P,S |
| I02 | 客户作用域 | tenant/project/group/allowed_field_ids | E | C01 / C02 / C03 | Product route auth + customer scope；禁止跨租户拼接 | FOUI | P0 | P,S |
| I03 | 季节与分区身份 | season_id / zone_id | C | C03 Overview | 要求唯一 active lineage；多 active 区域不能隐式聚合 | FOUI+MCFT | P0 | P,B |
| I04 | 活动运行谱系 | twin_active_lineage_index_v1 / active_lineage | C | C03 Overview / History | 存在条件读取；缺唯一 active scope 时 UNAVAILABLE | FOUI+MCFT | P0 | P,B |
| I05 | 田块名称 | field_index_v1: COALESCE(field_name,name) | E | C02 / C03 | 数据可能为空；禁止客户端编造名称 | FOUI | P0 | P,F |
| I06 | 田块面积 | field_index_v1: area_ha | E | C02 / C03 | 现有合同以 ha 返回；不代表边界真实准确 | FOUI | P1 | P,F |
| I07 | 农场显示名 / 地块归属 | 客户身份/管理关系 | U | C01 / C02 / C03 | Wave-02 显式未投影；需客户安全关系/权限证据 | FOUI | P1 | F,S |
| I08 | 田块几何与边界 | field_polygon_v1 / GeoJSON（外围资产） | U | C02 地图 / C03 Overview | 当前 Product 仅 geometry_availability；正式几何投影需独立治理 | FOUI | P1 | F,S |
| I09 | 作物名称与季节展示 | 作物身份/season 当前事实 | U | C02 / C03 Overview | Wave-02 crop_display_name / season_display = null；不可由模型猜测 | FOUI+MCFT | P1 | P,F |
| E01 | 土壤水分点位观测 | soil_moisture_observation_v1: KBS 100mm VWC | U | C03 Evidence | 必须展示测深、代表性、质量；不得叫作根区实测 | MCFT→FOUI | P0 | A,B |
| E02 | 小时降雨观测 | observed_rainfall_v1: KBS Raw Hourly | U | C03 Evidence / History | 需保留真实 observation-time、publication-time、修订 | MCFT→FOUI | P0 | A,B |
| E03 | 观测气温 | KBS 公共气象来源 | U | C03 Evidence / History | 需区分观测源与预报源；仅已资格化 input 可展示 | MCFT→FOUI | P1 | A |
| E04 | 空气湿度 / 露点 | KBS 公共气象来源 | U | C03 Evidence | 用于 ET0；不声称田内传感器观测 | MCFT→FOUI | P1 | A |
| E05 | 地面风速 | KBS 公共气象来源 | U | C03 Evidence | 需高度修正及来源字段 | MCFT→FOUI | P1 | A |
| E06 | 短波太阳辐射（历史） | 观测气象 ET0 输入 | U | C03 Evidence | 需 QC、单位、缺测说明；不能混入预测 DSWRF | MCFT→FOUI | P1 | A |
| E07 | 历史小时参考蒸散 ET0 | historical_et0_estimate_v1 | U | C03 Overview / History | ASCE standardized short ET；模型推导，非现场实测 | MCFT→FOUI | P1 | A |
| E08 | 未来小时气象 | future_weather_assumption_v1 / NOAA GFS | U | C03 Forecast（新视图） | 72 点同一完整 cycle；不等同于现场观测 | MCFT→FOUI | P1 | A,C |
| E09 | 未来太阳辐射输入 | GFS sflux DSWRF | U | C03 Forecast / Evidence | 允许的 sflux 例外；估算时间插值须标注 LIMITED | MCFT→FOUI | P1 | A |
| E10 | 未来小时参考 ET0 | future_et0_assumption_v1 | U | C03 Forecast | 须与未来气象属于同一 GFS cycle | MCFT→FOUI | P1 | A |
| E11 | 原始供应商回包/文件 | retained raw + content digest | U | C03 Evidence | 仅展示安全元数据/授权查看；不得直暴露私有对象 | MCFT→FOUI | P0 | A,B |
| E12 | 原始数据来源身份 | provider / station / sensor / source_version | U | C03 Evidence | 必须保留原始 provider 与支持类型 | MCFT→FOUI | P0 | A |
| E13 | 时间因果链 | observed_at / available_to_runtime_at / cutoff | U | C03 Evidence / History | 严格禁止 future Evidence leakage；时间语义单独展示 | MCFT→FOUI | P0 | A,B |
| E14 | KBS 日批发布/修订 | raw publication batch / revision visibility | U | C03 Evidence / Data Health | 发布约 24h 数据不代表逐小时发布；须按可见时间使用 | MCFT→FOUI | P1 | A |
| E15 | GFS 预报周期与完整性 | GFS cycle / issue / file completeness | U | C03 Evidence / Forecast | 仅当时已完整可获得的周期合法 | MCFT→FOUI | P1 | A |
| E16 | 输入缺失与降级原因 | Evidence quality / limitation reason | U | C03 Evidence / Data Health | 不能把缺失转换成正常值 | MCFT→FOUI | P0 | A,B |
| E17 | Evidence Window | twin_evidence_window_v1 | U | C03 Evidence / History | 由 CAP-07 exact current root 解析；Product 当前未投影 | MCFT→FOUI | P0 | B |
| E18 | 证据修订/迟到 | revision + append-forward correction | U | C03 History / Evidence | 旧 terminal 不得事后重写；保留可见性与新 revision | MCFT→FOUI | P1 | D,B |
| E19 | 数据采集服务健康 | Evidence owner/provider attempt | G | Operator Data Health（权限隔离） | 内部运行日志和秘密不应暴露客户 | MCFT/Ops | P1 | A,D |
| E20 | 空间支持与代表性 | station-to-field spatial support / direct equivalence | U | C03 Evidence | KBS 公共研究源不可被包装为客户田间精准传感器 | MCFT→FOUI | P0 | A |
| M01 | 当前作物身份 | field / season / crop authority | U | C03 Overview | CAP-09 单一 KBS corn scope；禁止假映射到客户其它地块 | MCFT→FOUI | P0 | A |
| M02 | 生物学阶段权威 | DT02 biological stage authority | U | C03 Overview / Evidence | 模型阶段有来源及不确定性；不得标为田间目测结果 | MCFT→FOUI | P1 | A,D |
| M03 | 水分利用阶段 | A18 stage-binding: crop-water-use stage | U | C03 Overview | 与生物学阶段独立；保留 as-of/valid-until | MCFT→FOUI | P1 | A |
| M04 | 作物系数 Kc | governed Kc (R6 LATE = 0.6 subject-bound) | U | C03 Overview / Evidence | 只有满足具体 R6/stage 资格才可带数值；非普适作物系数 | MCFT→FOUI | P1 | A |
| M05 | 阶段有效期 | authority_as_of / authority_valid_until | U | C03 Evidence / Data Health | 不把过期权威标为 CURRENT | MCFT→FOUI | P0 | A |
| M06 | 土壤水力参数 | Runtime Config MODEL_PRIOR_FROM_CAP08 | U | C03 Overview 说明 | 先验参数不等于田块实测校准 | MCFT→FOUI | P1 | A,D |
| M07 | 根区参数及假设 | root zone depth/capacity model config | U | C03 Overview 说明 | 区分场地土壤真值/默认模型 | MCFT→FOUI | P1 | A,C |
| M08 | Runtime Config 版本链 | twin_runtime_config_v1 refs/hashes | U | C03 Evidence / Operator | 客户可查看模型版本摘要；完整 hash 走详情 | MCFT→FOUI | P2 | B,C |
| M09 | 参数生效与历史变更 | revision/lineage/config effective time | U | C03 History | as-of 读取；不使用客户端 latest 替代历史真相 | MCFT→FOUI | P1 | B |
| M10 | 校准资格 | calibration_candidate / shadow_evaluation | G | Operator 模型治理 | Stage1A Replay 能力；CAP-09 不得自动激活模型 | MCFT/Ops | P2 | D,B |
| S01 | State prior | twin_prior_state_v1 | U | C03 History（专家视图） | 内部模型状态，不等于 posterior | MCFT→FOUI | P2 | B |
| S02 | 传播结果 | twin_state_transition_v1 | U | C03 History | 展示状态变更及来源，不伪称是观测 | MCFT→FOUI | P1 | B |
| S03 | 选定同化观测 | twin_assimilation_update_v1 links | U | C03 Evidence / History | 必须追溯同化依据、拒绝/限制原因 | MCFT→FOUI | P1 | B |
| S04 | 同化创新量 | assimilation innovation | U | C03 History（专家视图） | 与 forecast residual 不同 | MCFT→FOUI | P2 | B |
| S05 | 同化 disposition | twin_assimilation_update_v1 | U | C03 History / Data Health | 不得把未同化看作没有证据 | MCFT→FOUI | P1 | B |
| S06 | 当前后验状态 | twin_state_history_projection_v1 + exact poster state | C | C02 当前田况 / C03 Overview | 现有 builder 要求 exact active lineage + CAP07 complete graph + ref/hash | MCFT→FOUI | P0 | P,B |
| S07 | 根区水储量均值 | derived_state.root_zone_water_storage_mm.mean | C | C03 Overview | 已实现条件映射，单位 mm；不是 100mm 点位传感器值 | MCFT→FOUI | P0 | P |
| S08 | 根区水储量不确定性 | stddev / interval_low / interval_high | C | C03 Overview / Forecast | 合同已有，但源 graph 必须满足约束 | MCFT→FOUI | P0 | P |
| S09 | 可利用水比例 | derived_state.available_water_fraction | C | C02 / C03 Overview | 现有字段已实现条件投影 | MCFT→FOUI | P0 | P |
| S10 | 相对田间持水量亏缺 | derived_state.depletion_from_field_capacity_mm | C | C03 Overview | 现有字段已实现条件投影；不可当成现场测值 | MCFT→FOUI | P0 | P |
| S11 | 水分胁迫分类 | water_stress_state | X | C03 Overview（仅 NOT_ESTABLISHED） | 现有合同明令不得推断胁迫等级 | MCFT/ADR/FOUI | P2 | P |
| S12 | 状态置信等级 | confidence | X | C03 Overview（仅 NOT_ESTABLISHED） | 现有合同不建立 customer confidence；不能自造绿色评价 | MCFT/FOUI | P2 | P |
| S13 | 状态时点与来源 | logical_time / source_fact_id / determinism_hash | C | C02 / C03 | 当前条件映射 exact_state_time + source_refs | MCFT→FOUI | P0 | P |
| S14 | 状态可用性三态 | AVAILABLE / LIMITED / UNAVAILABLE + reason_codes | E | C01 / C02 / C03 | 产品返回缺失理由而非伪造零值；当前现场状态未成立 | FOUI | P0 | P,F |
| F01 | 未来 72h 预测运行 | twin_forecast_run_v1 | U | C03 Forecast（新视图） | CAP-04 实现；CAP-09 仅在 COMPLETED 后读；不是目前 Product API 输出 | MCFT→FOUI | P1 | C,B |
| F02 | 72 个小时预测点 | twin_forecast_point_projection_v1 | U | C03 Forecast（新视图） | T+1 到 T+72；只展示可见、合格 forecast | MCFT→FOUI | P1 | C,B |
| F03 | 预测区间及过程不确定性 | forecast mean/interval/variance | U | C03 Forecast（新视图） | 模型预测非未来观测 | MCFT→FOUI | P1 | C |
| F04 | Forecast COMPLETED/BLOCKED | forecast result/status/reason_codes | U | C03 Forecast（新视图） | BLOCKED 不得被显示为成功 72h Forecast | MCFT→FOUI | P0 | C,B |
| F05 | 最新成功 Forecast 指针 | twin_forecast_success_latest_index_v1 | U | C03 Forecast（新视图） | 可能早于当前 tick；与当前预测分开展示 | MCFT→FOUI | P1 | C,B |
| F06 | 当前 Tick Forecast 指针 | twin_forecast_result_latest_index_v1 | U | C03 Forecast（新视图） | 与 latest successful 区分 | MCFT→FOUI | P1 | B |
| F07 | 气象强迫追踪 | forecast forcing refs / same-cycle proof | U | C03 Forecast / Evidence | NOAA GFS 与 ET0 exact cycle provenance | MCFT→FOUI | P1 | A,C |
| F08 | 三个灌溉情景 | scenario_set: NO_ACTION/15mm/25mm | U | C03 Scenarios（新视图） | CAP04 Replay 能力；Stage1B 非默认保证，必须显式 source eligibility | MCFT→FOUI | P2 | C,D |
| F09 | 情景差异 | scenario comparison vs baseline | U | C03 Scenarios（新视图） | 仅模拟，不是 recommendation/approval | MCFT→FOUI | P2 | C |
| F10 | 预测残差 | twin_forecast_residual_v1 | U | C03 History / Forecast | 仅 verification observation 成熟时可生成；与同化创新不同 | MCFT→FOUI | P2 | D,B |
| F11 | 模型校准/影子评估 | calibration_candidate / shadow_evaluation | G | Operator Model Governance | Replay 验证资产，Stage1B 不自动模型上线 | MCFT/Ops | P2 | D,B |
| H01 | 状态历史事件 | CAP07 Timeline: STATE_TRANSITION/POSTERIOR_STATE | U | C03 History | 客户历史 builder 未实现；需要稳定分页/版本身份 | MCFT→FOUI | P1 | B,F |
| H02 | Evidence Window 时间线 | CAP07 EVIDENCE_WINDOW | U | C03 History / Evidence | 独立与 terminal group hash 精确对应 | MCFT→FOUI | P1 | B |
| H03 | 同化历史事件 | CAP07 ASSIMILATION_UPDATE | U | C03 History | 不可将 invalid/missing observation 简化成正常同化 | MCFT→FOUI | P1 | B |
| H04 | Tick 与 Checkpoint | twin_runtime_tick_v1 / twin_runtime_checkpoint_v1 | U | C03 History / Data Health | CAP07 精确 readback；非 customer projection | MCFT→FOUI | P1 | B |
| H05 | Runtime Health（双语义） | terminal_record_set_health vs operational_health | U | C03 Data Health（新视图） | 必须区分 terminal fact 与 attempt audit | MCFT→FOUI | P1 | B |
| H06 | Forecast Failure / Blocked 历史 | CAP07 FORECAST_FAILURE/FORECAST_RESULT | U | C03 History / Forecast | 不能把 BLOCKED 当成 COMPLETE | MCFT→FOUI | P1 | B |
| H07 | 迟到/乱序证据更正 | append-forward revision/visibility | U | C03 History / Evidence | 不得修改旧 canonical 历史 | MCFT→FOUI | P1 | D,B |
| H08 | 重启与断点恢复 | checkpoint / fencing / recovery proof | G | Operator Data Health | 客户只可见简化可用性，不暴露内部 token | MCFT/Ops | P1 | D,B |
| H09 | 受控 missed slot 回填 | scheduler recovery / oldest-first | G | Operator 资格验收 | 24T 的故障验证，不是客户动作记录 | MCFT/Ops | P1 | D |
| H10 | 24T 资格执行进度 | 24 actual UTC slots / terminal ticks | G | Operator / Site 资格说明（可选） | 只能展示确证进度；不可在 G13 前称 CAP09 COMPLETE | MCFT/Ops | P1 | D |
| H11 | 来源证据哈希/Trace Graph | CAP07 trace_graph_content_hash | U | C03 Evidence / History | 同源数字摘要和 exact refs；隐藏用户不需要的敏感数据 | MCFT→FOUI | P1 | B |
| H12 | Canonical visibility / cursor | CAP07 signed snapshot + bounded pagination | G | C03 History（底层约束） | 跨页一致性由后端负责；不向客户暴露 HMAC 秘钥 | MCFT→FOUI | P1 | B |
| H13 | Provenance summary | authority and non-authority counts | E | C03 Overview | 当前 FieldWorkspace 返回计数，不等于 Evidence Artifact 列表 | FOUI | P0 | P |
| D01 | Human Decision（受控 Replay） | CAP05 decision fact | X | C03 Activity（后续） | CAP09 1B 不会自动产生真实决策；ADR 决策权威独立 | ADR/B-Line/FOUI | P2 | D |
| D02 | Approved Plan / Approval | CAP05 evidence + B-Line/ADR authority | X | C03 Activity（后续） | 不可由 MCFT State 推断已审批 | B-Line/ADR/FOUI | P2 | D |
| D03 | Operation / Dispatch | B-Line operation_plan / ao_act_dispatch | X | C03 Activity（后续） | 当前 Product Wave02 operation builder 未实施；非 MCFT 自有状态 | B-Line/FOUI | P2 | F |
| D04 | 现场执行回执 | B-Line ao_act_receipt / as_executed | X | C03 Evidence / Activity（后续） | 不得把 MCFT 输入数据当执行完成证明 | B-Line/FOUI | P2 | F |
| D05 | Outcome / Attribution | Outcome chain / separate proof | X | C03 History / Outcomes（后续） | 当前 product 显式没有 Outcome builder；禁止推导效果归因 | Outcome/B-Line/FOUI | P2 | F |
| D06 | Needs Attention（决策/执行） | authority-backed alert/action state | X | C01 Attention（后续） | 不可以由缺测状态自动臆造风险/优先级 | ADR/B-Line/FOUI | P2 | F |
| D07 | 正式客户报表 | Product Report projection | X | C01 Reports（后续） | Wave02 builder 缺失；不能用 Legacy Customer DTO 冒充 | FOUI | P2 | F |

## D. Customer Site / Operator page coverage matrix

**Current tested Product routes ≠ Site visually verified.** Current user-approved Customer Site primary routes are `/customer/overview`, `/customer/fields`, `/customer/fields/:fieldRef` with Overview / Activity / Evidence / History. Forecast/Scenarios/Data Health are **proposed subviews** (not claimed built). Older blueprint also describes legacy/secondary Customer Operations, Reports and Operator routes; they are not treated as already active Site pages.

| Surface | Site route / target | Product read entry | Data currently implemented | Missing or blocked | Linked capabilities | Acceptance criteria |
|---|---|---|---|---|---|---|
| C01 Customer Overview | /customer/overview | GET /api/product/v1/overview | 已实现字段预览与统计；运行态按 FieldSummary 条件可读 | Attention、operations、reports 为占位/UNAVAILABLE | I01,I02,S06,S14,H13,D06,D07 | P0 用第一条合法 State 证明 current_fields 增加；P2 分开做 Attention/Reports |
| C02 Field List | /customer/fields | GET /api/product/v1/fields | field_ref/area/可空名称可读；current_condition 取决于 exact active scope | crop/farm/season/geometry、列表地图和筛选维度未接通 | I01,I02,I03,I05,I06,I07,I08,I09,S06,S09,S14 | P0 scope/active lineage/read-model 一致性；P1 名称/作物/几何 |
| C03 Overview | /customer/fields/:fieldRef | GET /api/product/v1/fields/:fieldRef | identity/current_condition/reporting_state/provenance_summary 合同存在 | 模型阶段、ET0、趋势、原始证据详情、权限投影不足 | S06,S07,S08,S09,S10,S11,S12,S13,M01,M03,M04,E07,H13 | P0 当前根区水分与时间来源；P1 作物、阶段、来源摘要 |
| C03 Activity | /customer/fields/:fieldRef [Activity] | 仅现有 FieldWorkspace placeholders | recent_changes/recent_operations/open_action_cases 均为有限状态占位 | MCFT Timeline 与 B-Line/ADR 两类权威需要分别接入 | H01,H03,H04,D01,D02,D03,D06 | P1 MCFT 状态变更历史；P2 另起 B-Line 业务活动 |
| C03 Evidence | /customer/fields/:fieldRef [Evidence] | 仅现有 evidence_summary placeholders | 目前字段证据 / 执行证据 summary 并无实际 artifact 列表 | 需 Evidence Window/来源绑定/安全摘要；执行证据属于 B-Line | E01,E02,E11,E12,E13,E16,E17,E20,H11,D04 | P1 公共证据索引和 provenance；P2 权限化 artifact 链 |
| C03 History | /customer/fields/:fieldRef [History] | 仅 history_summary placeholders | 当前无客户版 Timeline/History builder | CAP07 canonical timeline 可用作受治理的后端来源 | H01,H02,H03,H04,H06,H07,H12,F10 | P1 新只读分页历史投影；不得拿 current state 伪造历史 |
| 新增 Forecast（提案） | C03 子视图，非已验收 Site 路由 | 新 Product read-only Forecast projection [尚未实现] | MCFT CAP04/07 有 Forecast 对象和读模型语义 | Product API 缺 72h forecast curve/customer JSON；CAP09 BLOCKED 需处理 | E08,E09,E10,F01,F02,F03,F04,F05,F06,F07 | P1 划分 forecast status/points/uncertainty/forcing provenance |
| 新增 Scenarios（提案） | C03 子视图，非已验收 Site 路由 | 新 Product scenario projection [尚未实现] | CAP04 有 Replay 3-option 能力，不证明 CAP09 当前正式输出 | 仅 COMPLETED Forecast + qualified attached Scenario 可显示；非建议 | F08,F09 | P2 source-eligible/qualification, no authority invention |
| 新增 Data Health（提案） | C03 受限子视图或 Operator 视图 | 新 read-only health summary [尚未实现] | CAP07 Health/tick/checkpoint 事实可追踪 | 隐藏 lease token/internal URL；明确 degraded/missing/since | H05,H08,H09,H10,E14,E15,M05 | P1 summary user-safe，operator 与客户权限分离 |
| Operator Read Model（独立） | /operator/twin /operator/fields/... | MCFT CAP07 S4 read surface（非 Product 客户 API） | 精确 root graph/trace/timeline/health 读模型存在 | 不能不经客户投影直接向公共 Site 输出 | S01,S02,S03,S04,S05,H01,H02,H05,H11 | 内控审计；不为 Site 自动开放 |

## E. Delivery backlog / acceptance gates (in priority order)

| Gate | Workstream | Source/contract work | Machine-evidenced DONE definition | Owner | Do not do |
|---|---|---|---|---|---|
| P0-A | 作用域与第一条状态 | 正式 O00 后 exact six-key 作用域、FieldIndex 与 active lineage 的对应；同库可见性 | C01/C02/C03 当前水分从 UNAVAILABLE→AVAILABLE 或 LIMITED（真实原因） | FOUI+MCFT | 不可强制把研究 KBS 身份拼成其它客户田块 |
| P0-B | 合法只读数据路径 | 正式库/生产库间的投影权威、只读数据库主体、CAP07 读取资格、secret 分离 | Product API 只读隔离、/ready 和 DB permission PASS | FOUI 后端/Infra | 禁止直接给 Site 连接 Formal Store 或 writer credentials |
| P0-C | 当前状态合同 | 字段 mean/stddev/interval/available_fraction/depletion；condition status 与 source refs | 3 个 Product routes 独立 smoke、exact ref/hash、no synthetic truth | FOUI | APP 状态字段不得把 MODELED 当 OBSERVED |
| P0-D | Site 身份与数据通路 | token scope、CORS、runtime /ready、Sites ApiProductDataSource、页面 5 态 | C01/C02/C03 全部有非 mock 数据且不可用原因可见 | Site+FOUI | 不以 HTTP 200 等于数据 AVAILABLE |
| P1-A | 气象与证据 | E01–E20；Evidence Window + source provenance + provider revisions | C03 Evidence 审计索引、来源类型/质量/截止时间 | MCFT+FOUI | KBS 100mm != 根区实测 |
| P1-B | 农业上下文 | M01–M09；生物学阶段/水分阶段/Kc/有效期及先验 | C03 Crop stage 信息带模型/有效期标注 | MCFT+FOUI | 阶段过期不展示 CURRENT |
| P1-C | 72 小时预测 | F01–F07；72 point + BLOCKED/COMPLETED + success pointer | C03 Forecast 资格化预测曲线 | MCFT+FOUI/Site | 当前 tick BLOCKED 时不得取旧成功结果冒充 current |
| P1-D | 历史与健康 | H01–H13；CAP07 timeline/trace/pagination/health 分离 | C03 History 和 Data Health 可审计 | MCFT+FOUI/Site | 不可把最新指针当 terminal 身份；不可透露秘密 |
| P2-A | 情景与模型 | F08/F09/F11，模型资格限定 | 仅已资格化 Scenario，明确模拟与建议边界 | MCFT+FOUI | Replay 阶段存在 != CAP09 实际生产生效 |
| P2-B | Action/Attention/Outcome | D01–D07；ADR/B-Line/Outcome 来源权威 | C01/Activity/Execution/Reports 可用或有明确不可用原因 | ADR/B-Line/FOUI | MCFT 不生成审批/派工/成效归因 |

## F. Exact integration and freshness contract

1. **Identity**: Product query scope must match exact `tenant_id/project_id/group_id/field_id/season_id/zone_id`. Source `field_index_v1` identity must have a legitimate customer tenancy link to Formal scope. The Wave-02 builder selects at most one active Runtime lineage per field; zero => UNAVAILABLE, >1 => LIMITED, not implicit aggregation.
2. **Current state**: `PostgresMcftFieldTwinS4ReadApiV1` must return `COMPLETE_EXACT_GRAPH`, active lineage and posterior state. The `twin_state_history_projection_v1` row must match `state_object_id`, `determinism_hash` and `source_fact_id` exactly before Product constructs root-zone output. Required payload keys: `available_water_fraction`, `depletion_from_field_capacity_mm`, `root_zone_water_storage_mm.{mean,stddev,interval_low,interval_high}`.
3. **Semantics**: KBS `100mm VWC` is a **point observation**, not a calibrated root-zone sensor; Kc / crop stage from governance are model context, not phenocam field truth. Root-zone model estimate is not rain gauge reading. Customer water stress and confidence remain `NOT_ESTABLISHED` in the current contract.
4. **Availability/freshness**: `AVAILABLE/LIMITED/UNAVAILABLE` is independent from `CURRENT/LIMITED/UNAVAILABLE` reporting state. Existing customer Product envelope sets `freshness.status = UNKNOWN` and `PRODUCT_TEMPORAL_FRESHNESS_POLICY_NOT_ESTABLISHED`; a future refresh SLA needs an explicit authority, not 'real-time' marketing copy.
5. **Write/read isolation**: MCFT writes canonical facts on its own governed service principals. Product must connect via an explicitly provisioned read-only role / qualified read replica / governed customer projection. No Site direct DB connection, no browser-held database secret, no MCFT writer URL, no fallback to Legacy Customer API.
6. **Timeline**: use CAP-07 signed canonical visibility snapshot, immutable source refs, bounded pagination, exact event taxonomy and terminal vs operational health semantics. Do not synthesize 'recent changes' from comparing two latest-state JSON payloads as if it were canonical history.
7. **Forecast**: a `COMPLETED` 72-hour forecast is eligible; `BLOCKED` forecast is not a 72-point curve. Separate current result from latest successful forecast and label their logical times. Scenario is simulation, not ADR decision or irrigation advice.
8. **Authority split**: MCFT field-state/evidence → ADR target-scope/context/runtime decision → B-Line approval/execution/receipt. Product composes linked, non-authoritative customer read models only. Stage1B prohibits automatic Recommendation, Approval, AO-ACT, Dispatch and Model Activation.
9. **Authorization and qualification**: an unmerged amendment/design, existing schema, or the first O00 event does not by itself grant CAP-09 completion. Expose a truthful status ('provisional online', 'qualification in progress', 'completed' only after G12/G13), with exact evidence basis. Read access can precede 24T only under independently approved scope, source and credential gates.
10. **Current blocker from repository diagnostic**: `PRODUCT_API_FIELD_UNAVAILABLE_ROOT_CAUSE_V1.json` reported one field with `MCFT_CURRENT_RUNTIME_NOT_ESTABLISHED`, active runtime scope count 0, and existing identity row. This is a historical captured diagnostic, not a live 2026-10-08 production query; verify anew after formal start.

## G. Canonical path checklist and actual contract-level evidence

- `apps/server/src/product_projection/customer/customer_product_projection_contracts_v1.ts`: three projection types, exact current root-zone fields, typed placeholders and non-authority ceiling.
- `apps/server/src/product_projection/customer/customer_product_projection_builder_v1.ts`: full exact-scope/state/root water resolver and current module placeholder composition; `freshness.status = UNKNOWN`.
- `apps/server/src/product_projection/contracts/product_projection_source_binding_registry_v1.ts`: MCFT active lineage/posterior/forecast role registrations + separate ADR/B-Line authority roles. **Registration does not imply a connected customer API builder.**
- `apps/server/src/routes/product_v1.ts`: three actual Product API routes, authorization, etag and error transport.
- `apps/server/src/product_api/product_api_public_runtime_v1.ts`: public runtime, `GEOX_PRODUCT_DATABASE_URL`, writer role deny-list, no wildcard CORS, read-only pool.
- `docs/product_projection/GEOX-PRODUCT-API-PUBLIC-DEPLOYMENT-V1.md`: intended Production Product database/creds and Sites configuration boundaries.
- `docs/product_projection/PRODUCT_API_MODULE_DATA_COVERAGE_V1.json`: 15 detailed Wave-02 module implementation/data-status declarations.
- `docs/product_projection/PRODUCT_API_FIELD_UNAVAILABLE_ROOT_CAUSE_V1.json`: captured one-field missing-active-scope diagnostic.
- `docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE-V2.md`: Stage1A/1B/1C completion and nonnegotiable semantic separation.
- `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md`: single research scope, real-UTC 24T and no automatic downstream actions.
- `docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-TASK.md`: 16-question exact canonical read surface, Timeline taxonomy, trace and health dual semantics.

## H. Non-effects and change policy

This is **a documentation-only mapping**. It creates no new Product API endpoint, projection builder, Site route, local Docker execution, CAP09 effective authority, user permission, read-only database role, production deployment, protected-main merge or database content. Its future PR must remain **Draft/Unmerged** until the current Formal arm continuity is separately adjudicated. Do not 'fix' fail-closed continuity checks to merge it.

**Direct verdict:** The correct P0 is not to make MCFT emit fewer objects. It is to make the **existing exact posterior-state and active-lineage read path** physically available to the Product API under lawful tenant mapping and a read-only principal. Then expand Evidence, 72h Forecast, Timeline and agronomic context; keep ADR/B-Line action authority separate.
