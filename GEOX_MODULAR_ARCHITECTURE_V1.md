# GEOX 模块化架构蓝图 v1

## 1. 项目定位
GEOX 是一个面向远程农业经营的模块化控制平台。

目标：
- 远程感知土地与作物
- 远程决策与执行作业
- 支持作物/设备/农学能力持续扩展（类似 skill 平台）

---

## 2. 总体架构

### 五层结构
1. 核心平台层（Field / Season / Device / Operation / Evidence / Auth）
2. 能力包层（Crop / Device / Agronomy / Acceptance Skills）
3. 决策编排层（Recommendation → Approval → Execution）
4. 产品交互层（Dashboard / Field / Operation / Evidence）
5. 外部协作层（天气 / IoT / 存储 / AI）

---

## 3. 核心实体

- Tenant
- Field
- Season
- Crop Plan
- Device
- Operation
- Execution
- Evidence
- Recommendation
- Acceptance
- Skill Package

关键原则：
Operation ≠ Device

---

## 4. 模块划分

- Field Module
- Season Module
- Device Module
- Operation Module
- Agronomy Module
- Acceptance Module
- Evidence Module
- Skill Registry Module

---

## 5. 能力包体系

### Crop Skills
- corn_baseline_v1
- tomato_baseline_v1

### Device Skills
- irrigation_valve_v1
- soil_sensor_v1

### Agronomy Skills
- water_balance_v1
- pest_risk_v1

### Acceptance Skills
- irrigation_acceptance_v1
- seeding_acceptance_v1

---

## 6. Skill Package 结构

{
  "id": "",
  "version": "",
  "category": "",
  "input_schema": {},
  "output_schema": {}
}

---

## 7. 数据流闭环

1. 感知
2. 状态解释
3. 建议生成
4. 审批
5. 作业编排
6. 执行
7. 验收
8. 学习反馈

---

## 8. 产品结构

主入口：Dashboard（监控台）

辅助：
- Field
- Season
- Operation
- Device
- Evidence

---

## 9. 农学模块演进

阶段1：规则
阶段2：参数自适应
阶段3：AI模型

---

## 10. 推荐代码结构

packages/
- core-domain
- skill-registry
- crop-skills
- device-skills
- agronomy-skills
- acceptance-skills

apps/
- server
- web
- executor
- telemetry-ingest

---

## 11. 开发优先级

P0 核心稳定
P1 Dashboard
P2 作业模型
P3 Skill机制
P4 学习反馈
P5 生态接入

---

## 12. 总结

GEOX = 模块化农业操作系统
