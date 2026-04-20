# COMMERCIAL_V1 首日检查脚本与页面口径对照

> 组别：A组（试点交付稳态组）  
> 目的：把 `commercial_v1_trial_day1_check.mjs` 的 PASS / WARN / FAIL 输出，与页面侧实际可见状态收口成同一套首日判断口径。  
> 边界说明：本文件不改主链语义，不替代脚本，也不替代页面；只解决“脚本怎么对应页面、页面怎么理解脚本”。

---

## 1. 本文件解决什么问题

首日试点链同时依赖两类证据：

- 页面证据（Field / Device / Program 页面）
- 脚本证据（day1 check）

如果没有统一对照，会出现：

- 脚本 PASS，但现场不知道页面应该看到什么
- 脚本 WARN，但现场误以为还能演示
- 页面看起来差不多，脚本却一直 WARN
- 支持和实施各自解释

本文件的作用：统一解释口径。

---

## 2. 首日正式判断原则

**页面状态 + 脚本输出 = 首日判断**

约束：

- 只看页面，不成立
- 只看脚本，不成立
- 必须两者一致

---

## 3. 脚本检查项与页面关系

### 3.1 环境项

脚本：

- server reachable
- web reachable
- bearer token

页面关系：

- 环境失败时，不进入页面解释
- 先修环境

### 3.2 对象项

脚本：

- field exists
- device exists
- program exists

页面对应：

- FieldCreate / FieldDetail
- DeviceOnboarding / DeviceDetail
- ProgramCreate / ProgramDetail

原则：

- 页面必须能看到对象
- 脚本也必须指向同一对象

### 3.3 链路项

脚本：

- field-device binding
- device online
- first telemetry
- recommendation / operation

页面对应：

- FieldDetail 检查项
- DeviceDetail 状态
- Program / Operation 承接

原则：

- 脚本检查项必须能在页面找到对应状态

---

## 4. PASS / WARN / FAIL 对照

### 4.1 PASS

#### 脚本

全部关键项 PASS  
`TRIAL_DAY1_STATUS=PASS`

#### 页面

FieldDetail：

- 已绑定设备
- 设备在线
- 已有首条数据
- 有建议或作业

DeviceDetail：

- 在线
- 已绑定
- 有数据

ProgramDetail：

- 可打开
- 可回 field / operation

路径：

- 首页 → 地块 → 作业可走通

#### 结论

可以正式演示。

---

### 4.2 WARN

#### 脚本

部分链路未闭合  
`TRIAL_DAY1_STATUS=WARN`

典型：

- 设备未在线
- 无首条数据
- 无建议 / 作业

#### 页面

FieldDetail：

- 有设备但未在线
或
- 有在线但无数据
或
- 有 program 但无承接

DeviceDetail：

- 离线 / 数据不足

Program：

- 存在但无法证明闭环

#### 结论

不可对外说“可以演示”。  
必须明确卡点。

---

### 4.3 FAIL

#### 脚本

环境或对象失败  
`TRIAL_DAY1_STATUS=FAIL`

典型：

- server 不通
- token 错
- field/device 不存在

#### 页面

- 页面不可用
或
- 无法进入对象
or
- 对象不是当前链

#### 结论

不进入演示。  
先修环境/对象。

---

## 5. 页面角色边界

### FieldDetail

- 首日核心检查页
- 展示 6 项状态

但：

- 不能替代脚本

### DeviceDetail

负责：

- 在线
- 数据
- 绑定

但：

- 不能证明业务闭环

### ProgramDetail

负责：

- 已初始化经营

但：

- 不等于链路完成

---

## 6. 脚本与页面不完全一致的处理

现状：

- 判断方向一致
- 数据来源不完全相同

处理原则：

1. 不强行改主链
2. 用本文件统一解释
3. 出现冲突优先检查：
   - 是否同一对象链
   - program 是否记录
   - telemetry 是否真实到达
   - 是否已形成承接链

一句话：

A组统一解释，不改语义。

---

## 7. 现场执行顺序

1. 看回归记录（基线）
2. 确认样例对象链
3. 跑 day1 脚本
4. 对照本文件
5. 再演示或排障

---

## 8. 签收结论

A组确认：

- PASS / WARN / FAIL 已有统一页面解释
- 页面与脚本已完成口径收口
- 不再允许现场自由解释

---

## 9. 使用关系

配合：

- `docs/A_GROUP_DELIVERY_CONSISTENCY_REGRESSION_RECORD.md`
- `docs/COMMERCIAL_V1_TRIAL_SAMPLE_OBJECTS.md`
- `docs/A_GROUP_ACCEPTANCE_NOTE.md`
