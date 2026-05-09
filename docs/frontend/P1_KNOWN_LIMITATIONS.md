# P1_KNOWN_LIMITATIONS

状态：P2-A0 入口前的已知边界（不是缺陷修复清单）。

## 1. 禁止事项（硬约束）
- 不做 customer API。
- 不做 operator 写操作。
- 不做地图、天气、as-applied。
- 不重做 P1 页面结构。

## 2. Operator 写能力边界（未 ready）
- operator approval 写操作未 ready。
- operator dispatch/retry 写操作未 ready。
- operator acceptance evaluate 写操作未 ready。
- operator evidence export 写操作未 ready。
- alert ACK/close 写操作未 ready。
- device revoke 写操作未 ready。

## 3. 客户导出边界
- 导出版只允许使用客户语言，不得出现工程字段来源描述。
- 导出版时间必须为客户可读本地时间，不得直接暴露 ISO 原始串。
- 风险/诊断文案必须为完整客户句，不得出现拼接病句或异常标点。

## 4. 变更控制
- 上述限制在 P2 正式立项前视为冻结基线。
- 如需突破限制，必须先更新 readiness 文档与 gate 规则，再进入开发。
