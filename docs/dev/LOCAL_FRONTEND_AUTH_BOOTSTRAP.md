# 本地前端认证引导（AO-ACT）

> 适用范围：本地开发 `/login` 页面和 API 调试。

## 1) 查看 container token file

容器里通常会放置 `security_acceptance_tokens.json`（包含 `admin_token`）。

示例（按你的实际路径调整）：

```bash
cat /workspace/GEOX/security_acceptance_tokens.json
```

如果不确定位置，可在仓库内查找：

```bash
find /workspace/GEOX -name 'security_acceptance_tokens.json'
```

## 2) 使用 `admin_token` 登录前端

1. 打开 `security_acceptance_tokens.json`，复制 `admin_token`。
2. 打开前端登录页 `/login`。
3. 将 `admin_token` 粘贴到「访问 Token」输入框并提交。

> 注意：后端认证只接受 AO-ACT Bearer token，前端正式会话键名为 `geox_ao_act_token`。

## 3) 用 curl 验证 `/api/v1/auth/me`

将 `<ADMIN_TOKEN>` 替换为实际 token：

```bash
curl -i \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  http://localhost:8000/api/v1/auth/me
```

返回 `200` 且有身份信息时，说明 AO-ACT token 可用。

## 4) `geox_delivery_token_v1` 与 `geox_ao_act_token` 区别

- `geox_delivery_token_v1`：历史/交付链路相关 token（delivery token），不是当前 API 会话凭据。
- `geox_ao_act_token`：当前前端 API 客户端会读取并携带的 AO-ACT Bearer token。

因此：

- 浏览器里**仅有** `geox_delivery_token_v1` 时，API 仍会判定未登录；
- 必须设置 `geox_ao_act_token`（通常通过 `/login` 输入 AO-ACT token 完成）。
