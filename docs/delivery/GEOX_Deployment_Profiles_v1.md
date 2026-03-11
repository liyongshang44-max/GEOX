# GEOX Deployment Profiles v1

## 目的

本文件定义 GEOX 在 `dev` / `staging` / `prod` 三类环境中的最小部署骨架与边界。
本轮目标是把多环境运行边界从“文档约定”推进到“仓库内真实 compose 骨架”。

## 非目标

- 本轮不引入新的业务语义。
- 本轮不引入新的 secrets 管理系统。
- 本轮不实现自动化发布流水线。

## 基础原则

1. 三个环境必须使用不同的 Compose project name。
2. 三个环境必须使用不同的 token / secret 来源。
3. 三个环境必须使用不同的证据包输出根目录。
4. 生产环境必须关闭开发型 bind mount 与热更新。

## 运行文件

- `docker-compose.yml`：基础服务定义。
- `docker-compose.dev.yml`：开发环境覆盖层。
- `docker-compose.staging.yml`：预发环境覆盖层。
- `docker-compose.prod.yml`：生产环境覆盖层。

## 推荐项目名

- dev: `geox-dev`
- staging: `geox-staging`
- prod: `geox-prod`

## 证据包输出根目录约定

- dev: `runtime/exports/dev`
- staging: `runtime/exports/staging`
- prod: `runtime/exports/prod`

## 启动示例

### dev

```powershell
$env:COMPOSE_PROJECT_NAME = "geox-dev"
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

### staging

```powershell
$env:COMPOSE_PROJECT_NAME = "geox-staging"
docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d --build
```

### prod

```powershell
$env:COMPOSE_PROJECT_NAME = "geox-prod"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## 环境变量来源约束

- dev 可使用仓库内示例文件复制后本地注入。
- staging / prod 必须使用环境外部注入，不得直接提交真实 secrets。
- `config/environments/<env>/ao_act_tokens_v0.example.json` 仅作结构示例，不能作为真实密钥。

## 运维约束

- staging / prod 必须保留容器日志。
- prod 应优先使用只读挂载或镜像内构建产物，而不是开发热更新挂载。
- prod 的 OpenAPI、Runbook、Device Integration Kit 必须与当前交付版本一致。
