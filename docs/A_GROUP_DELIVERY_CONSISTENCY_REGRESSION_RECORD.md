# A组交付一致性回归记录

> 组别：A组（试点交付稳态组）  
> 目标：对 commercial_v1 试点交付链执行“文档—页面—脚本”三层一致性终检，并形成正式回归记录。  
> 说明：本文件不是单纯判断文档，而是 A 组正式回归记录主体。记录内容分为：
>
> 1. 静态一致性核查结果  
> 2. day1 check 脚本回归执行口径  
> 3. PASS / WARN / FAIL 与页面状态对照  
> 4. 不一致项与修补建议  
>
> 注意：本文件可作为 A-1 的正式主体文件，但仍需与 A 组其余文档一起组成最终签收包。

---

## 1. 本轮回归采用的唯一基线

本轮回归统一只认以下 commercial_v1 基线：

- 主 compose：`docker-compose.commercial_v1.yml`
- server：`http://127.0.0.1:3001`
- web：`http://127.0.0.1:5173`
- postgres：`5433`
- MinIO：`9000`
- MinIO console：`9002`

正式初始化入口：

- `/fields/new`
- `/devices/onboarding`
- `/programs/create?field_id=...`

正式演示路径：

- 首页 → 地块页 → 作业页

本文件只对以上基线负责，不为旧 `3000` 外部口径、其他 compose 或临时演示路径背书。

---

## 2. 回归范围

### 文档

- `docs/COMMERCIAL_V1_TRIAL_BASELINE.md`
- `docs/TRIAL_INITIALIZATION_FLOW.md`
- `docs/TRIAL_DAY1_CHECKLIST.md`
- `docs/COMMERCIAL_V1_TRIAL_RUNBOOK.md`

### 页面

- `FieldCreatePage`
- `FieldDetailPage`
- `DeviceOnboardingPage`
- `DeviceDetailPage`
- `ProgramCreatePage`
- `ProgramDetailPage`

### 脚本

- `apps/server/scripts/commercial_v1_trial_day1_check.mjs`

---

## 3. 静态一致性核查结果

### 3.1 文档与主基线

| 检查对象 | 当前状态 | 是否一致 | 若不一致，如何修补 |
| --- | --- | --- | --- |
| `COMMERCIAL_V1_TRIAL_BASELINE.md` | 已明确唯一主 compose、`3001/5173`、`5433`、`9000/9002` | 一致 | 无 |
| `TRIAL_INITIALIZATION_FLOW.md` | 已明确 field → device → program → telemetry → recommendation → operation 顺序 | 一致 | 无 |
| `TRIAL_DAY1_CHECKLIST.md` | 已明确首日 9 项检查对象，并要求页面 + 脚本共同判定 | 一致 | 无 |
| `COMMERCIAL_V1_TRIAL_RUNBOOK.md` | 已明确正式页面入口、演示路径、角色分工与排障顺序 | 一致 | 无 |

结论：文档四件套已围绕同一 commercial_v1 基线收口，没有第二套交付真相并行。

---

### 3.2 路由与页面入口

| 检查对象 | 当前状态 | 是否一致 | 若不一致，如何修补 |
| --- | --- | --- | --- |
| `/fields/new` | 路由存在，落到 FieldCreatePage | 一致 | 无 |
| `/devices/onboarding` | 路由存在，落到 DeviceOnboardingPage | 一致 | 无 |
| `/programs/create` | 路由存在，落到 ProgramCreatePage | 一致 | 无 |
| `/fields/:fieldId` | 路由存在，落到 FieldDetailPage | 一致 | 无 |
| `/devices/:deviceId` | 路由存在，落到 DeviceDetailPage | 一致 | 无 |
| `/programs/:programId` | 路由存在，落到 ProgramDetailPage | 一致 | 无 |

结论：文档中的正式页面入口在前端真实存在，不是失效路径。

---

### 3.3 FieldCreatePage

| 检查对象 | 当前状态 | 是否一致 | 若不一致，如何修补 |
| --- | --- | --- | --- |
| 边界可后补口径 | 页面明确写出“边界可后续补充” | 一致 | 无 |
| 创建成功跳转 | 成功后跳 `/fields/:fieldId?created=1` | 一致 | 无 |
| 下一步提示 | 提示继续绑定设备并初始化经营方案 | 一致 | 无 |

结论：FieldCreatePage 与初始化文档同源，可作为正式首日入口。

---

### 3.4 FieldDetailPage

| 检查对象 | 当前状态 | 是否一致 | 若不一致，如何修补 |
| --- | --- | --- | --- |
| 首日检查定位 | 页面内置“首次数据可见性检查” | 一致 | 无 |
| 检查项覆盖 | 已覆盖 field、绑定、在线、首条数据、建议、作业 6 项 | 一致 | 无 |
| 动作入口 | 去绑定设备、查看设备状态、查看接入说明、查看建议、查看作业均存在 | 一致 | 无 |
| 初始化 banner | 有“尚未完成初始化经营”提示 | 部分一致 | 开发侧收紧触发条件，避免 created=1 场景下误导 |
| Program 回流 | 有 Program 入口，但当前偏向回 `/programs` 列表 | 部分一致 | 开发侧优先提供当前 ProgramDetail 回流 |

结论：FieldDetailPage 仍是首日试点检查核心页，主要剩余问题是轻量提示与回流精度。

---

### 3.5 DeviceOnboardingPage

| 检查对象 | 当前状态 | 是否一致 | 若不一致，如何修补 |
| --- | --- | --- | --- |
| 固定接入流程定位 | 页面保留设备接入向导与固定步骤说明 | 一致 | 无 |
| 基础上下文输入 | token、device ID、device_mode、device_template、field_id 均存在 | 一致 | 无 |
| 后续动作 | 跳设备详情 / 返回设备列表 / 返回田块继续首日验证 均存在 | 一致 | 无 |
| 默认样例值线索 | 页面中出现 `demo_device_001`、`field_demo_001` 默认值 | 待固化 | 通过《COMMERCIAL_V1_TRIAL_SAMPLE_OBJECTS.md》正式固化 |

结论：DeviceOnboardingPage 可继续作为正式接入入口；默认值目前只能算“可复用样例线索”，尚不是正式基线。

---

### 3.6 DeviceDetailPage

| 检查对象 | 当前状态 | 是否一致 | 若不一致，如何修补 |
| --- | --- | --- | --- |
| 在线状态 | 页面直接展示在线状态 | 一致 | 无 |
| 绑定状态 | 页面展示绑定田块与绑定状态 | 一致 | 无 |
| 首条数据状态 | 页面展示首条数据状态 | 一致 | 无 |
| 离线排查动作 | 离线时提供排查入口 | 一致 | 无 |
| 返回 onboarding | 提供重新打开接入向导入口 | 一致 | 无 |

结论：DeviceDetailPage 已具备首日设备检查面，不需要重构。

---

### 3.7 ProgramCreatePage

| 检查对象 | 当前状态 | 是否一致 | 若不一致，如何修补 |
| --- | --- | --- | --- |
| 初始化经营定位 | 页面明确是首个 Program 初始化入口 | 一致 | 无 |
| `field_id` query 承接 | 支持 `/programs/create?field_id=...` | 一致 | 无 |
| 创建成功跳转 | 成功后跳 `/programs/:programId?created=1` | 一致 | 无 |

结论：ProgramCreatePage 满足首日初始化要求。

---

### 3.8 ProgramDetailPage

| 检查对象 | 当前状态 | 是否一致 | 若不一致，如何修补 |
| --- | --- | --- | --- |
| `created=1` 成功提示 | 页面存在成功 banner | 一致 | 无 |
| 回流路径 | 可回关联田块 / 当前作业 / 方案列表 / 总览 | 一致 | 无 |
| 经营视角表达 | 页面聚焦目标、进度、策略、最近影响 | 一致 | 无 |

结论：ProgramDetailPage 与第五组冻结表达保持一致。

---

### 3.9 day1 check 脚本

| 检查对象 | 当前状态 | 是否一致 | 若不一致，如何修补 |
| --- | --- | --- | --- |
| 环境检查 | 检查 server reachable、auth probe、web reachable、token | 一致 | 无 |
| 对象检查 | 检查 field exists、device exists、program exists | 一致 | 无 |
| 链路检查 | 检查 field-device match、binding、online、first telemetry、handoff | 一致 | 无 |
| 输出分级 | 输出 PASS / WARN / FAIL 及 next step | 一致 | 无 |
| 与页面是否完全同字段同源 | 方向一致，但证据来源并非完全相同 | 不完全一致 | 用《COMMERCIAL_V1_TRIAL_DAY1_SCRIPT_PAGE_ALIGNMENT.md》正式解释，不直接改主链语义 |

结论：脚本具备正式首日检查价值，但必须配套页面对照说明使用。

---

## 4. day1 check 脚本回归执行口径

### 4.1 正式执行环境要求

A 组对 day1 脚本的正式执行口径应为：

- `docker-compose.commercial_v1.yml`
- `GEOX_BASE_URL=http://127.0.0.1:3001`
- `GEOX_WEB_URL=http://127.0.0.1:5173`
- `GEOX_BEARER_TOKEN=...`

按试点对象情况补充：

- `GEOX_FIELD_ID=...`
- `GEOX_DEVICE_ID=...`
- `GEOX_PROGRAM_ID=...`

### 4.2 执行命令

```bash
node apps/server/scripts/commercial_v1_trial_day1_check.mjs
```

说明：

- 不得为通过 A 组验收而改写脚本口径。
- 不得把脚本改成自动造数器。
- 不得脱离 commercial_v1 基线单独跑其他环境后拿来代替本记录。

### 4.3 本文件中的脚本结果口径说明

本文件记录以下两类内容：

第一类：已确认的脚本结构事实

即脚本当前确实会检查：

- server reachable
- authenticated probe
- web reachable
- bearer token configured
- field exists
- device exists
- program exists
- requested field-device match
- field-device binding
- field online device
- field first telemetry
- recommendation/operation handoff

并输出：

- PASS
- WARN
- FAIL
- next step
- `TRIAL_DAY1_STATUS=...`

第二类：A 组标准回归结果样式

由于本轮 A 组文档交付目标是先把“正式回归口径”冻结下来，因此本文件同时给出 PASS / WARN / FAIL 三类标准结果样式，用于现场实施、技术支持和后续真实执行时对照。

如现场已在 commercial_v1 环境完成真实执行，应在本节下补充：

- 执行时间
- 环境标识
- 关键对象 ID
- 原始输出摘录

若尚未补充真实输出，本文件中的 PASS / WARN / FAIL 样式仍可作为 A 组正式判定模板使用，但不得宣称“已附现场真实运行日志”。

---

## 5. PASS / WARN / FAIL 标准结果样式与页面对照

### 5.1 PASS 标准样式

#### 脚本侧标准样式

至少满足以下方向：

- `server reachable = PASS`
- `web reachable = PASS`
- `bearer token configured = PASS`
- `field exists = PASS`
- `device exists = PASS`
- `program exists = PASS`
- `field-device binding = PASS`
- `field online device = PASS`
- `field first telemetry = PASS`
- `recommendation/operation handoff = PASS`
- `TRIAL_DAY1_STATUS=PASS`

#### 页面侧应看到的状态

FieldDetail 应至少满足：

- 已绑定设备
- 设备在线
- 已收到首条数据
- 已有建议或已有作业

DeviceDetail 应至少满足：

- 在线状态明确
- 绑定状态明确
- 首条数据状态为已完成

ProgramDetail 应至少满足：

- 可回关联田块
- 可回当前作业
- 可回总览

正式演示路径应满足：

- 首页 → 地块页 → 作业页可走通

#### A 组判定

PASS 对应“环境、对象、链路均成立，可进入首日演示”。

---

### 5.2 WARN 标准样式

#### 脚本侧标准样式

典型 WARN 场景之一：

- `field exists = PASS`
- `device exists = PASS`
- `program exists = PASS`
- `field-device binding = PASS`
- `field online device = WARN`
- `field first telemetry = WARN`
- `recommendation/operation handoff = WARN`
- `TRIAL_DAY1_STATUS=WARN`

#### 页面侧应看到的状态

FieldDetail 常见表现：

- 已绑定设备，但设备未在线
- 或设备在线但未见首条数据
- 或已有 Program，但建议 / 作业仍未承接

DeviceDetail 常见表现：

- 在线状态为离线/未知
- 首条数据状态为“数据不足”或等价表达

ProgramDetail 常见表现：

- Program 已创建，但无法证明首日闭环已成立

#### A 组判定

WARN 对应“环境或对象部分成立，但首日试点链未闭合，不可直接对外说可演示”。

---

### 5.3 FAIL 标准样式

#### 脚本侧标准样式

典型 FAIL 场景之一：

- `server reachable = FAIL`
或
- `bearer token configured = FAIL`
或
- `requested field-device match = FAIL`
- `TRIAL_DAY1_STATUS=FAIL`

#### 页面侧应看到的状态

常见表现包括：

- server / web 不可达，页面无法作为业务依据
- field / device / program 不存在，无法进入正式对象承接
- 指定 field-device pair 未建立，即使租户级有对象，也不能算当前试点链成立

#### A 组判定

FAIL 对应“当前不进入首日演示判断”。

---

## 6. 当前不一致项与修补建议

### A-DOC-01 样例对象约定缺失

| 检查对象 | 当前状态 | 是否一致 | 若不一致，如何修补 |
| --- | --- | --- | --- |
| 样例对象链正式定义 | 页面/代码中有默认值线索，但无正式文档固化 | 不一致 | 补 `docs/COMMERCIAL_V1_TRIAL_SAMPLE_OBJECTS.md` |

---

### A-DOC-02 脚本与页面对照说明缺失

| 检查对象 | 当前状态 | 是否一致 | 若不一致，如何修补 |
| --- | --- | --- | --- |
| PASS/WARN/FAIL 页面解释 | 尚无独立正式文档 | 不一致 | 补 `docs/COMMERCIAL_V1_TRIAL_DAY1_SCRIPT_PAGE_ALIGNMENT.md` |

---

### A-DEV-01 FieldDetail 初始化 banner 触发条件偏宽

| 检查对象 | 当前状态 | 是否一致 | 若不一致，如何修补 |
| --- | --- | --- | --- |
| FieldDetail 初始化 banner | created=1 场景下仍可能误导为未初始化 | 不完全一致 | 开发侧收紧显示条件，仅在确无 current plan 时显示 |

---

### A-DEV-02 FieldDetail Program 回流不够精确

| 检查对象 | 当前状态 | 是否一致 | 若不一致，如何修补 |
| --- | --- | --- | --- |
| FieldDetail Program 入口 | 当前更偏向 Program 列表，而非当前 ProgramDetail | 不完全一致 | 开发侧优先提供当前 ProgramDetail 回流 |

---

## 7. 当前签收判断

### 已通过

- 文档四件套同源
- 正式页面入口存在
- 首日初始化链页面基本成立
- day1 脚本具备正式首日检查价值
- PASS / WARN / FAIL 三类标准口径已形成

### 未完全通过

- 样例对象文档未补齐前，不能说“现场无需猜对象”
- 脚本-页面对照文档未补齐前，不能说“现场无需解释 WARN / FAIL”
- FieldDetail 两处轻量稳态问题未修补前，不能说“页面侧已完全无歧义”

---

## 8. A-1 当前结论

本文件可作为 A 组《交付一致性回归记录》的正式主体，但要与以下文件一起组成 A 组签收包，才能闭合：

- `docs/COMMERCIAL_V1_TRIAL_SAMPLE_OBJECTS.md`
- `docs/COMMERCIAL_V1_TRIAL_DAY1_SCRIPT_PAGE_ALIGNMENT.md`
- `docs/A_GROUP_ACCEPTANCE_NOTE.md`

单独使用本文件，不构成 A 组最终签收。
