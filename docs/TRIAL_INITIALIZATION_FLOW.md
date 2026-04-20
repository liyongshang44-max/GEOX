# 试点初始化流程收口（现场执行版）

> 适用范围：试点当天现场交付、联调、值守。  
> 目标：固定“先做什么、后做什么”，避免现场自由发挥导致断链。

---

## 一、固定初始化顺序（必须按序执行）

1. **第一步：新建田块**  
2. **第二步：绑定/接入设备**  
3. **第三步：初始化经营方案**  
4. **第四步：确认首条数据**  
5. **第五步：确认建议可生成**  
6. **第六步：确认可转为作业**

> 以上顺序为试点默认口径，不允许跳步或并行替代。

---

## 二、正式页面入口（统一口径）

- 新建田块入口：`/fields/new`
- 设备接入入口：`/devices/onboarding`
- 初始化经营入口：`/programs/create?field_id=...`

现场培训、SOP、值守手册统一引用以上入口，不使用临时路径。

---

## 三、边界数据口径（必须明确）

- **边界数据可后补。**
- 即使地理边界暂时不完整，也允许先创建 field。
- 试点默认口径是：**先创 field，再继续闭环**。

这条口径用于保障首日推进速度，避免因边界数据采集延迟阻断联调。

---

## 四、页面回流关系（已核并固定）

### 1) FieldCreate → FieldDetail
- `FieldCreate` 创建成功后，页面跳转到 `FieldDetail`。
- 路径形态：`/fields/:fieldId?created=1`。

### 2) FieldDetail 如何引导后续动作
`FieldDetail` 提供初始化清单与动作按钮，包含：
- 去设备接入/设备中心（绑定设备、恢复在线）
- 去初始化经营（`/programs/create?field_id=...`）
- 去建议中心/作业中心继续闭环

### 3) DeviceOnboarding 完成后回流路径
`DeviceOnboarding` 完成后支持：
- 回 `DeviceDetail`
- 回 `DeviceList`
- 回 `Field`（返回田块继续首日验证）

### 4) ProgramCreate → ProgramDetail
- `ProgramCreate` 创建成功后，进入 `ProgramDetail`。
- 已修正为：`/programs/:programId?created=1`，确保 `ProgramDetail` 可展示 created 成功 banner。

---

## 五、断链修补记录（本组 patch）

本次已完成以下明确断点修补：

1. **ProgramCreate 成功跳转补齐 `?created=1`**  
   由 `/programs/:programId` 修补为 `/programs/:programId?created=1`。

2. **DeviceOnboarding 后续动作补齐“回田块”**  
   新增“返回田块继续首日验证”，避免接入完成后现场人员找不到回流入口。

---

## 六、现场执行检查单（交付/值守共用）

- [ ] 是否按 1→6 固定顺序执行。  
- [ ] 是否使用正式入口：`/fields/new`、`/devices/onboarding`、`/programs/create?field_id=...`。  
- [ ] 是否按“边界可后补”口径先完成 field 创建。  
- [ ] Program 创建成功后 URL 是否带 `?created=1`。  
- [ ] 设备接入完成后是否可一键回田块继续首日验证。  
- [ ] 建议与作业链路是否已可见并可继续推进。

本文件为试点初始化流程收口基线，现场执行以本文件为准。
