# 【强制规范：GEOX 前后端约定】

所有浏览器请求必须支持以下 header：

- `x-tenant-id`
- `x-project-id`
- `x-group-id`

后端 CORS 必须显式允许以上 header，否则浏览器请求会被拦截（不会进入业务逻辑）。
