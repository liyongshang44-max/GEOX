# GEOX MCFT CAP-09 — CTO Continuation Handoff（2026-10-30）

> **文档性质：** 仓库内工程接续记录（docs-only），用于下一轮 MCFT CTO 工作交接。它不是 QCP、Adoption、Resource Owner、Permit 或任何其他可消费的正式授权证据。
>
> **证据边界：** 本文基于截至 2026-10-30 用户提供的 Windows PowerShell 5.1 终端实测回执，以及对现有仓库 Resource Owner V1 验证代码的核对。用户终端输出不是已经签名的新鲜 Raw Readback；任何后续受时效约束的签署都必须重新现场取证。
>
> **仓库与版本：** `liyongshang44-max/GEOX`；文档编写时受保护 `main` 为 `5d69b8a3f254600726bc10f0404f1330de1e4562`。本文档先在 docs-only 分支登记，不应被误认为已合入 `main`，也不得因为文档提交改变后继续沿用旧 HEAD 的签名。
>
> **历史交接：** `docs/handoff/` 中旧版本包括 2026-08-08、08-10、08-11、08-12；旧文档是历史快照，不要修改或删除。当前后继实际状态以精确仓库和本轮物理回执为准。

## 0. 一句话接手指令

**Run `6ff9b41f6f7f` 的既有 PostgreSQL `127.0.0.1:55490` 和 MinIO `127.0.0.1:59290` 已通过隔离资源、只读零事实、S3 私有空桶、SCRAM 4/4、Docker 卷/网络/绑定扫描和计划任务扫描。不要再建第三套资源、寻找密码、重迁移或重跑已验收的检查。**

唯一未关闭的工程发现项：**Windows 宿主机生产绑定/Owner 唯一归属的覆盖审查，具体是 22 个不可读取命令行的进程以及已知配置根的 bounded 覆盖声明**。在其解决后，才准备带真实独立来源的 Windows Resource Readback、短时效 Owner Ed25519 签署，并继续 Adoption / 非授权全链 / Permit 门禁。

## 1. 精确身份与治理状态

| 项目 | 已知事实 / 边界 |
|---|---|
| Run | `6ff9b41f6f7f`，仅 `TEST_ONLY` |
| 受保护 main（本次核对时） | `5d69b8a3f254600726bc10f0404f1330de1e4562`，未来执行前须重新核对 |
| 既有资源建造基线 | `e7a8f30ffb60cb4c2bc6bd83d7bbe487eb708cc9`，不可自动提升至新 subject |
| Windows 主机 | `LAPTOP-STN2A2P1`；正式 `host_id` 须由治理输入核定，不能以主机名替代 |
| 历史失败 Run | `df091a71aafc` 封存：不重放、不续租、不消费旧 Permit |
| Resource Owner 独立签署 | **HOLD**，未获得正式合格的本轮签署回执 |
| Adoption V2 | **HOLD**，不得从技术 PASS 推定 |
| 非授权 S3→Candidate→PG 全链 | 本轮未完成正式准入 |
| Permit issued / consumed | `false / false` |
| 原始六阶段物理执行 | **0/6** |
| Production authorized | `false` |

## 2. 固定复用的既有资源（不要再次施工）

| | PostgreSQL | MinIO |
|---|---|---|
| 容器 | `cap09-a3-pg-6ff9b41f6f7f` | `cap09-a3-minio-6ff9b41f6f7f` |
| 回环映射 | `127.0.0.1:55490 → 5432/tcp` | `127.0.0.1:59290 → 9000/tcp` |
| 专用卷 | `cap09-a3-pg-data-6ff9b41f6f7f` | `cap09-a3-s3-data-6ff9b41f6f7f` |
| 专用网络 | `cap09-a3-net-6ff9b41f6f7f` | 同左 |
| 逻辑资源 | `mcft_cap09_requal_6ff9b41f6f7f_positive` 与 `_negative` | `mcft-cap09-requal-6ff9b41f6f7f` |

**未选用但必须保全的重复资源：** 同一 Run 下 2026-10-29 额外构建了 `mcftcap09-a3-pg-6ff9b41f6f7f`（55530）及 `mcftcap09-a3-s3-6ff9b41f6f7f`（59330）。保持隔离、冻结，不删除，不将其凭据用于 55490/59290。对应私有凭据文件位于 `D:\gptdown\CAP09-A3-5D69\STEP4A-ISOLATED-20261029-130642643\PRIVATE-TEST-ONLY-CREDENTIALS.json`，它**仅属于额外资源**。

## 3. Step 4A–4B：已完成实际只读验收

- 早期 `DOCKER_PS_UNAVAILABLE` 已通过真实 Docker 发现处理；全机发现 **73** 容器，后续 **73/73** 独立 inspect 记录对应。曾盘点 40 个 PG/S3 服务实例，40/40 inspect 成功；不能把初期空输出解释为“没有旧容器”。
- 两个选定 PG 数据库各有 **19 张 public 表**、`public.facts = 0`，ACL 元数据已核查：Audit 不可直接 INSERT、不可执行 Fenced Function；Writer 不可直接 INSERT，但允许执行该精确 Fenced Function。先前的约 8 MiB 是数据库磁盘容量，并非事实行数。
- MinIO 选定 Bucket V5 认证回读实测：`BUCKET_IDENTITY=CONFIRMED_AUTHENTICATED`；`OBJECTS=0`；`VERSIONS_AND_MARKERS=0`；`INCOMPLETE_MULTIPART=0`；`ANONYMOUS_LIST_HTTP=403`；`ANONYMOUS_POLICY=PRIVATE`；结束标记 `S3_ZERO_STATE_AND_PRIVATE_POLICY_READBACK_PASS_NOT_RESOURCE_OWNER`，临时 alias 已移除。
- MinIO 客户端初期 `NO_PERSISTED_ALIAS_FOR_59290` 并非资源故障。V5 从**精确已选容器** Docker 配置读取既有测试凭据，仅以进程内临时 `MC_HOST_` 方式认证，不建立永久 alias，不修改 Bucket。
- 历史原始文件存在于本机：`D:\gptdown\MCFT-CAP09-A3-ISOLATED-RESOURCES\CAP09-A3-RESOURCE-PROVISION-READONLY-FACTS.json`、`CAP09-A3-RESOURCE-READBACK-READONLY-FACTS.json`、`CAP09-A3-S3-READBACK-NONSECRET.json`；另有 `CAP09-A3-SCHEMA-ACL-READBACK-FACTS.json` 和 `CAP09-A3-ACL-PHYSICAL-READBACK-FACTS.json` 历史回执。这些材料建于旧 subject/旧时刻，**不得冒充当前 fresh Resource Owner Raw**。

## 4. Step 4C：真实隔离及受限身份检查（已通过子项）

### 4.1 Docker 卷 / 网络 / 端口

- 两个选定命名卷均 `ATTACHED_CONTAINER_COUNT=1`，且分别只挂载到其选定 PG、S3 容器。
- `cap09-a3-net-6ff9b41f6f7f` 的 `NETWORK_MEMBER_COUNT=2`，只包含上述两个容器，无第三个成员。
- PG/S3 均只向 `127.0.0.1` 发布指定专用端口，无发现其他绑定。
- 实测：`A3_DOCKER_NETWORK_AND_PORT_ISOLATION_PASS`。
- 正、负例数据库的只读事务连接快照均 `transaction_read_only=on`，排除本次查询会话后其他连接 **0 行**。这是采样时刻，不等于永远无连接。

### 4.2 真实 SCRAM 四组：4/4 PASS

容器内对 `127.0.0.1` 的 `psql -W` 命中 `pg_hba.conf` 的 `trust`，不能作为密码认证证据。成功脚本使用容器专用 Docker 网络的非回环地址、命中 `scram-sha-256` 规则，逐一使用错误密码做拒绝负例、原始凭据做正例。

| 库 / 角色 | 错密码拒绝 | 真密码接受 | 只读 | 直接 INSERT | Fenced EXECUTE | 非回环来源 |
|---|---|---|---|---|---|---|
| Positive / `cap09_a3_audit` | PASS | PASS | PASS | 禁止 | 禁止 | PASS |
| Positive / `cap09_a3_writer` | PASS | PASS | PASS | 禁止 | 允许 | PASS |
| Negative / `cap09_a3_audit` | PASS | PASS | PASS | 禁止 | 禁止 | PASS |
| Negative / `cap09_a3_writer` | PASS | PASS | PASS | 禁止 | 允许 | PASS |

终止标记：`A3_PG_RESTRICTED_SCRAM_AUTH_AND_ACL_PASS_NOT_RESOURCE_OWNER`、`PROCESS_CREDENTIAL_REFERENCES_CLEARED`。

### 4.3 Docker 环境变量绑定扫描：73/73、零引用

```text
DISCOVERED_CONTAINER_COUNT=73
INSPECT_RECORD_COUNT=73
CHECKED_CONTAINERS=73
OTHER_CONTAINER_REFERENCES=0
RUNNING_CONTAINER_REFERENCES=0
DOCKER_CONTAINER_ENV_SCAN_COMPLETE
```

仅表示已发现其他容器的**环境变量值**中无指定端点/库/Bucket 显式引用；不代表所有配置文件或独立宿主进程没有生产绑定。

## 5. 旧资源私有凭据位置：已恢复，停止重复查找

原始资源施工脚本在本机：

`D:\gptdown\CAP09-A3-ISOLATED-RESOURCE-KIT-PS51-V1\RUN-CAP09-A3-ISOLATED-RESOURCES-PS51.ps1`

静态源码确认第 6 行 `$Root` 是参数；第 27 行 `$Priv` 由 `$Root` 生成；第 163 行初始化 `$pgpass/$auditpass/$writerpass`，第 165–167 行将各项凭据写入私有文件。**不可为了恢复凭据重新执行施工。**

真实私有目录：

`D:\gptdown\MCFT-CAP09-A3-ISOLATED-RESOURCES\PRIVATE-DO-NOT-UPLOAD`

该目录实测包括：

- `audit-LOCAL-DO-NOT-UPLOAD.env`，173 bytes，字段名 `A3_PG_AUDIT_PASSWORD`、`A3_PG_WRITER_PASSWORD`，已支持真实 SCRAM 四组 PASS。
- `minio.env`，113 bytes。
- `postgres.env`，83 bytes。

**只记录路径和字段名。禁止上传、打印、入库、复制凭据内容；无需重置 PG 密码或修改 `pg_hba.conf`。**

## 6. Step 4C-6 Windows 宿主机生产绑定覆盖：当前唯一活动技术发现阻断

### 6.1 首轮 bounded 扫描

```text
WINDOWS_HOST_BINDING_DISCOVERY_MODE=READ_ONLY
RUN=6ff9b41f6f7f
PROCESS_COUNT=270
PROCESS_COMMANDLINE_UNAVAILABLE_COUNT=23
SERVICE_COUNT=304
HOLD_SCHEDULED_TASK_QUERY_UNAVAILABLE
ENV_PROCESS_ENTRY_COUNT=84
ENV_USER_ENTRY_COUNT=7
ENV_MACHINE_ENTRY_COUNT=18
KNOWN_GEOX_CONFIG_ROOTS_FOUND=1
KNOWN_GEOX_CONFIG_FILES_CHECKED=4
ACTIVE_HOST_TCP_CLIENT_COUNT=0
REFERENCE_COUNT=0
ACTIVE_REFERENCE_COUNT=0
COVERAGE_ERROR_COUNT=1
HOLD_WINDOWS_HOST_BINDING_DISCOVERY_REVIEW
```

这不是 `production_bindings_present=false` 的证明。

### 6.2 补充计划任务 COM 与进程审查

2026-10-30 真实实测：

```text
A3_WINDOWS_COVERAGE_DIAGNOSTIC=READ_ONLY
NATIVE_GET_SCHEDULEDTASK_COUNT=272
COM_TASK_FOLDERS_VISITED=147
COM_TASKS_INSPECTED=272
COM_TASK_REFERENCES=0
COM_TASK_COVERAGE_ERRORS=0
COM_TASK_TRAVERSAL_COMPLETE=True
PROCESS_COUNT=270
PROCESS_COMMANDLINE_UNREADABLE_COUNT=22
PROCESS_QUERY_ERRORS=0
SCHEDULED_TASK_COM_BOUNDED_SCAN_NO_REFERENCES_OBSERVED
HOLD_UNREADABLE_PROCESS_COMMANDLINES_REVIEW_REQUIRED
NO_GLOBAL_PRODUCTION_BINDING_ABSENCE_CLAIM_NO_RESOURCE_OWNER_NO_PERMIT
```

**计划任务旧阻断已关闭：147 文件夹、272 任务、零引用、零查询错误。不要重复扫描已完成部分。**

仍有 22 个命令行不可读取的进程（PID 为当时样本，后续可改变）：

```text
0 System Idle Process
4 System
140 Secure System
184 Registry
708 smss.exe
820 csrss.exe
1064 wininit.exe
1072 csrss.exe
1184 services.exe
1228 LsaIso.exe
1236 lsass.exe
3428 Memory Compression
4692 NgcIso.exe
1460 svchost.exe
14588 SecurityHealthService.exe
13152 vmmemWSL
23612 svchost.exe
12348 MsMpEng.exe
16292 MpDefenderCoreService.exe
23304 DefenderAiPlatformHost.exe
5940 DefenderSessionHelper.exe
24528 NisSrv.exe
```

**不能单凭进程名豁免。** 特别需对两个 `svchost.exe` 和 `vmmemWSL` 查明可读可核的 `ExecutablePath`、签名/发布者、服务 PID 映射和 WSL/Docker 工作负载边界。确实被系统保护且不可直接读取的，应记录限制及可替代证据；不得关闭安全软件或提升生产访问。

已知配置根 1、配置文件 4 也只是 bounded discovery：必须结合真实部署清单、服务/任务/外部进程路径形成范围明确的无生产绑定结论，不能作全局绝对断言。

## 7. 正式 Resource Owner 后续门禁（尚未运行）

仓库验证入口：`scripts/governance_acceptance/MCFT_CAP09_ATTEMPT3_RESOURCE_OWNER_V1.cjs`。

现行合同明确要求：

1. 新鲜的 Windows 独立主机 `MCFT_CAP09_ATTEMPT3_RESOURCE_READBACK_V1` 原始 JSON，`status=PASS`、`probe_type=WINDOWS_READ_ONLY_PG_S3_INDEPENDENT_HOST`、真实 `probe_source_sha256`、当前 Run/Subject/Host，未生产授权；不得从聊天 PASS 伪造。
2. 两库存在、零 Facts、受限登录和 ACL、Fenced Function 权限、Bucket 存在/空（对象、历史版本、未完成上传）/PRIVATE、精确资源 ID，以及可证实的 `production_bindings_present=false` 和 `owner_exclusive=true`。
3. Raw 文件真实本机绝对路径、无符号链接、byte SHA-256 匹配；签署 payload 与 raw 内可绑定字段逐一吻合。
4. 注册有效、未撤销、用途匹配的 `ACCOUNTABLE_SINGLE_OPERATOR` Ed25519 公钥和私钥进行真正的运营主体签名。不凭空增加独立第二签名者，但也不能由技术 PASS 推定已有授权。
5. 观察→签发不超过 300s，签发的有效期不超过 300s；正式签署应在就绪时即时重采 fresh raw，不能消费已过期审计记录。
6. 独立完成 Adoption V2、当前 QCP、非授权完整链路、独立 Permit 等余下门禁；**Resource Owner PASS 不等于可执行六阶段，更不等于生产启动**。

## 8. 本轮非授权本地验收脚本（已通过对应用户实测）

| 用途 | 本机文件名 | 已发放 SHA-256（每次使用仍应本机核验） |
|---|---|---|
| S3 私有空桶 V5 PASS | `CAP09-A3-S3-READONLY-RECHECK-V5-PS51.ps1` | `4794bddc1866dfd4c2c8407ed06a2cf0cd000a323a10adea9af9605166117022` |
| PG SCRAM 4/4 PASS | `CAP09-A3-PG-SCRAM-READONLY-V3-PS51.ps1` | `2f1017e74f491666c6f5506c19ae32e29db6e697c28e7db2a02333067bfd4ba3` |
| Windows Host discovery HOLD | `CAP09-A3-WINDOWS-BINDING-DISCOVERY-READONLY-PS51.ps1` | `11625dd9c4ebbfc53723c85796a5b18ae0eb8b80df41dc6befdbdfe3ae2efba3` |
| Task COM gap probe PASS / process review HOLD | `CAP09-A3-WINDOWS-COVERAGE-GAP-READONLY-PS51.ps1` | `ab9550cb95135ca8b33d2e9676820068fb595091073698bff51ade363bab42c3` |

失败历史：S3 脚本 V2–V4 曾出现特殊字符 URL、JSON 数组包装等代码问题；PG SCRAM V1/V2 曾出现 Windows PowerShell 5.1 `StandardInputEncoding` 和客户端地址解析问题。它们在 S3 V5 / PG V3 已修复且得到用户实测 PASS。**这些已关闭的脚本错误不是 PG/S3 资源损坏，不应再重跑历史问题排查。**

## 9. 下轮接手动作与禁止事项

只需按顺序完成：

1. **Step 4C-6 残余：** 对 22 个不可读进程进行可信归属分类和 bounded Windows 配置覆盖核验；不得把名称推测升级为完全排除证明。检查后如仍有实质缺口，保留 `HOLD`，不要虚构 `owner_exclusive=true`。
2. **Step 4C-7 Fresh Raw：** 归属/生产绑定均有实际支持后，重新核对 protected main 和 host_id；执行一次满足当前合同的独立、真正 Windows PG/S3 只读探针，保存原始 bytes 与 SHA-256。
3. **正式 Owner：** 以当前 Raw + 精确 subject + registered accountable operator 有效 Ed25519 签署，在短时效内独立核验。
4. **剩余准入：** Adoption V2、QCP65、非授权 full-chain、一次性 Permit 按其实际合同分别验收；只在真实准入后执行官方六阶段。

严禁新建资源、重建桶/表、改密码、复制密钥、直接写 `main` 绕过受保护 HEAD、把本文档当作 Authority/Permit、重采或续租封存的旧失败 Run，以及把现有 0/6 改写为成功。

### 截止状态

```text
RUN                              6ff9b41f6f7f
SELECTED_PG                      127.0.0.1:55490
SELECTED_S3                      127.0.0.1:59290
PG_ZERO_FACTS                    PASS (observed, not fresh signed Raw)
PG_SCRAM_NEG_POS_ACL             4/4 PASS
S3_PRIVATE_EMPTY                 PASS
DOCKER_VOLUME_NETWORK            PASS
DOCKER_ENV_SCAN                  73/73; 0 other references
WINDOWS_TASKS_COM                147 folders / 272 tasks / 0 references / 0 errors
WINDOWS_PROCESS_COVERAGE         270 processes / 22 command lines unreadable
WINDOWS_PRODUCTION_BINDING       HOLD
OWNER_EXCLUSIVE                  NOT ESTABLISHED
RESOURCE_OWNER_SIGNED            HOLD
ADOPTION_V2                      HOLD
NONAUTH_FULL_CHAIN               NOT FORMALLY ADMITTED
PERMIT_ISSUED / CONSUMED          false / false
ORIGINAL_SIX_STAGES              0/6
PRODUCTION_AUTHORIZED            false
```

**该文件是仓库内 Handoff 文档，记录真实工程历史与接续点，但无任何授权效力。**


## 10. Step 4C-6B 追加回执：Windows 受保护进程分类（2026-10-30）

最新用户实测：

```text
A3_WINDOWS_PROTECTED_PROCESS_REVIEW=READ_ONLY
RUN=6ff9b41f6f7f
PROCESS_COUNT=271
SERVICE_COUNT=304
UNREADABLE_PROCESS_COUNT=24
KERNEL_PROCESS_CANDIDATES=5
CORE_OS_PROCESS_CANDIDATES=8
SERVICE_SECURITY_CANDIDATES=10
WSL_VM_HOST_CANDIDATES=1
UNCLASSIFIED_UNREADABLE_COUNT=0
UNMAPPED_SVCHOST_COUNT=0
DIRECT_MS_SIGNED_PROCESS_PATHS=0
SCM_REGISTERED_MS_SIGNED_IMAGE_PATHS=9
NONKERNEL_IMAGE_NOT_VERIFIABLE_COUNT=10
MAPPED_SERVICE_CONFIG_REFERENCES=0
ACTIVE_SELECTED_PORT_CONNECTIONS=0
QUERY_ERRORS=0
HOLD_WSL_RUNNING_DISTRIBUTION_QUERY
WSL_RUNNING_DISTRIBUTION_COUNT=-1
WSL_NON_DOCKER_RUNNING_DISTRIBUTIONS=-1
WSL_READONLY_INVENTORY_COMPLETE=False
HOLD_WINDOWS_PROTECTED_PROCESS_CLASSIFICATION_OR_BINDINGS
NO_GLOBAL_PRODUCTION_BINDING_ABSENCE_CLAIM_NO_RESOURCE_OWNER_NO_PERMIT
```

相较上一轮快照，进程数 270→271，命令行不可读 22→24；新增的 `svchost.exe` 分别映射 `ClipSVC`、`AppXSvc`。其他已查明的服务映射包括 `wscsvc`、`DoSvc`、`SecurityHealthService`、`WinDefend`、`MDCoreSvc`、`WdNisSvc`。其中九项服务管理器登记映像得到 Microsoft 签名验证，但因为 PID 实际可执行路径不可读取，该签名结果仅证明**登记文件**，不能冒充**运行中映像的独立身份验证**。另有核心受保护进程和安全组件路径仍不可验证。

`vmmemWSL` PID=13152 在该快照中存在。脚本将 `wsl.exe --list --running --quiet` 的异常或非零退出吞并为单一 `HOLD_WSL_RUNNING_DISTRIBUTION_QUERY`，导致本轮无法区分 WSL 查询错误、空列表及编码/宿主权限问题。**WSL 工作负载实际运行边界没有通过；不得因为 Docker 73/73 无引用就推定 WSL 内所有 workload 已审计。**

下一步采用新的只读定点脚本 `CAP09-A3-WSL-BOUNDARY-DIAGNOSTIC-READONLY-V2-PS51.ps1`，通过 .NET 子进程获取真实退出码、输出字节与受限错误类别，并辅以 HKCU Lxss 注册清单；它不会启动 WSL 发行版、不修改服务/DB/S3，不输出敏感命令行或凭据。**该脚本尚未获得 Windows 主机实测结果，不得标记 PASS。**

本轮实际 HOLD：WSL running distro inventory 未确认；不可读取的进程映像并非全部有可绑定 PID 的签名证明；生产配置文件范围仍只是 bounded。Resource Owner、Adoption、Permit 和原始六阶段保持 HOLD / HOLD / HOLD / 0/6。

## 11. Step 4C-6C：WSL V2 查询成功、清单解析脚本报错（2026-10-30）

用户实测：

```text
A3_WSL_BOUNDARY_DIAGNOSTIC_V2=READ_ONLY
RUN=6ff9b41f6f7f
WSL_EXE_PRESENT=True
WSL_QUERY_MODE=FINISHED
WSL_QUERY_EXIT_CODE=0
WSL_QUERY_STDOUT_BYTES=32
WSL_QUERY_STDERR_BYTES=0
WSL_QUERY_ERROR_CLASS=NONE
MethodArgumentConversionInvalidCastArgument: Replace([char]0, '')
```

**正确裁决：** Windows `wsl.exe --list --running --quiet` 调用本身返回退出码 0，且无 stderr，不是 WSL 调用失败；V2 脚本在清理 NUL/BOM 字符时，Windows PowerShell 5.1 将 `.Replace([char]0, '')` 解析为 `char,char` 重载，空字符串无法转成 `char`。所以**WSL 发行版清单解析未完成**，不能填写正在运行的发行版数量，不能断言非 Docker workload 为零，更不能升级为 Resource Owner PASS。

修复文件（独立聊天交付、未纳入仓库源码）：`CAP09-A3-WSL-BOUNDARY-DIAGNOSTIC-READONLY-V3-PS51.ps1`；SHA256 `25c720aa3e2415572c6f62b216eb9ab1935aaabc0c08923c8a48e73b32d96b15`；仅将 NUL/BOM 字符处理改为 `[regex]::Replace([string]$Line, '[\\u0000\\uFEFF]', '').Trim()` 并更新输出版本标识。静态检查通过，**尚未经用户 Windows PS5.1 实测**。下一步只运行 V3 并回传 `WSL_RUNNING_DISTRIBUTION_COUNT`、`WSL_NON_DOCKER_RUNNING_DISTRIBUTIONS`、注册数/最终标记；无需重跑 73/73 Docker、272 项计划任务、PG SCRAM、MinIO。

Resource Owner / Adoption / Permit 仍 HOLD；原始六阶段 0/6。
