# COMMERCIAL_V1 试点样例对象约定

> 组别：A组（试点交付稳态组）  
> 目的：固化 commercial_v1 试点中优先使用的样例对象链，避免现场临时猜测 field / device / program，减少页面默认值、脚本参数与实施口径漂移。  
> 边界说明：本文件定义的是“推荐试点样例对象约定”，不是正式固定主数据，也不是自动造数机制。

---

## 1. 本文件解决什么问题

当前仓库已具备：

- 首日初始化页面链（field / device / program）
- day1 check 脚本

但缺一个关键东西：

**试点到底优先用哪一套对象链。**

否则会出现：

- 页面用 A field
- 脚本检查 B field
- ProgramDetail 展示 C program

这会直接导致：

- 演示混乱
- 排障成本高
- 现场必须靠研发解释

---

## 2. 适用前提

本文件定义的推荐样例对象链，**仅在试点环境尚未替换为客户正式对象时优先使用**。

默认口径是：

- 若现场还没有切换到客户正式对象链，则优先使用本文件定义的样例对象链；
- 若现场已经切换到客户正式对象链，则允许不再使用 demo 对象；
- 但一旦切换，页面对象、脚本参数、实施记录、支持口径必须同时切换为同一条客户对象链，不得继续混用 demo 对象。

一句话：

**默认优先样例链；进入客户正式链后，必须整体切换，不允许半切换。**

---

## 3. 使用原则

### 3.1 这是“推荐样例”，不是主数据

本文件中的对象：

用于：

- 试点演示
- day1 检查
- 排障统一口径

不代表：

- 必须永久存在
- 是正式业务主数据
- 系统需要为此造数

### 3.2 必须“同一条对象链贯穿”

试点过程中必须保证：

- 页面用的 field
- device onboarding 用的 device
- program 初始化绑定的 field
- day1 脚本检查的对象

是同一套对象。

禁止：

- 页面 A，脚本 B，Program C

---

## 4. 当前仓库中的样例线索

A组核查确认：

页面中已经存在默认值线索：

- `field_demo_001`
- `demo_device_001`

注意：

这些只是**代码层默认值线索**；在本文件之前并不是正式约定。

本文件的作用就是：

把这些线索收口为正式“试点推荐对象”。

---

## 5. 推荐样例对象链

### 5.1 Field

推荐：

`field_demo_001`

用途：

- 首日创建 / 演示 field
- FieldDetail 检查页
- Program 初始化目标
- 脚本 `GEOX_FIELD_ID`

### 5.2 Device

推荐：

`demo_device_001`

用途：

- onboarding 默认设备
- DeviceDetail 检查
- 脚本 `GEOX_DEVICE_ID`

### 5.3 Program

推荐方式：

通过：

`/programs/create?field_id=field_demo_001`

创建首个 Program。

说明：

- 不强制固定 `program_id`
- 使用真实创建结果

用途：

- ProgramDetail 演示
- 脚本 `GEOX_PROGRAM_ID`（建议记录）

---

## 6. Program 记录要求

Program 不要求预先固定 `program_id`，但**创建后必须立即记录实际 `program_id`**，并同步到以下三个位置：

- day1 check 脚本参数
- 现场实施记录
- 支持/回归记录

推荐口径：

- Program 创建完成后，由实施同学把实际生成的 `program_id` 记录到当次试点记录中；
- day1 check 脚本在正式试点验收时，优先显式填写 `GEOX_PROGRAM_ID`；
- 不建议长期依赖“脚本自行抽样命中 Program”作为正式试点口径。

一句话：

**Program 可以动态生成，但生成后必须被记录并回填，不允许只在页面存在、脚本却不指向它。**

---

## 7. 推荐首日使用流程

推荐顺序：

1. 创建或确认 `field_demo_001`
2. onboarding 使用 `demo_device_001`
3. 绑定 device → field
4. 创建 Program（基于该 field）
5. 记录实际生成的 `program_id`
6. 在 Field / Device / Program 页面确认状态
7. 用同一对象链跑 day1 check

---

## 8. 脚本配合方式

推荐环境变量：

`GEOX_FIELD_ID=field_demo_001`

`GEOX_DEVICE_ID=demo_device_001`

`GEOX_PROGRAM_ID=<实际生成>`

基础：

`GEOX_BASE_URL=http://127.0.0.1:3001`

`GEOX_WEB_URL=http://127.0.0.1:5173`

`GEOX_BEARER_TOKEN=...`

说明：

- `GEOX_PROGRAM_ID` 在正式试点验收时建议显式填写；
- 若未填写，则只能作为临时抽样行为，不宜作为正式签收口径。

---

## 9. 不推荐做法

- 页面用 demo，对脚本用客户正式对象
- onboarding 默认值没改，但 program 挂到别的 field
- 同一试点用多套对象链
- 脚本不传参数随机命中对象

---

## 10. 现场与支持统一口径

### 实施

优先使用本文件对象链。  
若替换为客户对象：

- 页面与脚本必须同步切换
- 实施记录必须同步切换
- 不得继续混用 demo 对象

### 支持

先确认当前试点使用的是：

- 样例链
或
- 客户链

一旦确认，不允许中途切换。

---

## 11. 签收结论

A组确认：

- 样例对象线索已存在；
- 本文件已完成正式固化；
- 从此试点应优先使用统一对象链；
- 若进入客户正式对象链，则必须整体切换；
- Program 创建结果必须被记录并回填；
- 不需要新增造数系统。

---

## 12. 使用关系

本文件需配合：

- `docs/A_GROUP_DELIVERY_CONSISTENCY_REGRESSION_RECORD.md`
- `docs/COMMERCIAL_V1_TRIAL_DAY1_SCRIPT_PAGE_ALIGNMENT.md`
- `docs/A_GROUP_ACCEPTANCE_NOTE.md`
