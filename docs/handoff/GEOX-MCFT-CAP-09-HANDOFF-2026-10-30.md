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


## 12. Step 4C-6C：WSL V3 补充 PASS（2026-10-30 用户 Windows 实测）

```text
A3_WSL_BOUNDARY_DIAGNOSTIC_V3=READ_ONLY
RUN=6ff9b41f6f7f
WSL_EXE_PRESENT=True
WSL_QUERY_MODE=FINISHED
WSL_QUERY_EXIT_CODE=0
WSL_QUERY_STDOUT_BYTES=32
WSL_QUERY_STDERR_BYTES=0
WSL_QUERY_ERROR_CLASS=NONE
WSL_RUNNING_DISTRIBUTION_COUNT=1
WSL_NON_DOCKER_RUNNING_DISTRIBUTIONS=0
RUNNING_WSL_DISTRIBUTION_CLASS=DOCKER_DESKTOP
WSL_READONLY_LIST_COMPLETED_NOT_WORKLOAD_ABSENCE
WSL_REGISTERED_DOCKER_DISTROS=1
WSL_REGISTERED_NON_DOCKER_DISTROS=1
WSL_REGISTERED_UNKNOWN_DISTROS=0
WSL_REGISTRY_INVENTORY=READ_ONLY_BOUNDED_CURRENT_USER
NO_RESOURCE_OWNER_NO_PRODUCTION_BINDING_ABSENCE_CLAIM_NO_ADOPTION_NO_PERMIT
```

**判定：** 已证明 WSL 命令可用、Windows 当前用户 WSL 注册清单可读；在该时点唯一运行中的发行版为 Docker Desktop，非 Docker 的已注册发行版 1 个但当时未运行。关闭 `HOLD_WSL_RUNNING_DISTRIBUTION_QUERY`，**不**由此证明 WSL 内 Docker 所有持久化数据或未来工作负载绝对不存在其他配置引用。

**剩余精确阻断：** Windows 当前 active production 配置入口和服务/容器绑定来源的 bounded 覆盖仍不完整；受保护的部分非内核进程未核实运行中映像身份，SCM 的登记路径签名不等于实时映像已签名。不得仅凭已验收检查将 `production_bindings_present=false` 或 `owner_exclusive=true` 写入正式 Raw。原始六阶段仍 0/6、Resource Owner/Adoption/Permit 仍 HOLD。


## 13. Step 4C-6D：活动部署配置入口的 bounded 只读复核（待现场执行）

在 Step 4C-6C WSL PASS 后，不再重复 73/73 Docker Env、272 个计划任务、四组 SCRAM 或 S3 V5。下一块未覆盖的事实是**运行中部署入口引用的实际配置文件**，而非全盘内容搜索。

新的独立 PS5.1 只读脚本：`CAP09-A3-ACTIVE-CONFIG-BINDING-READONLY-PS51.ps1`，本次生成的 SHA-256 `7b9dbe453deeffacd049ad5e5e29611442a24e941c89b5c174e75660c754cc9c`。脚本通过 Docker inspect 的 Compose `com.docker.compose.project.working_dir`、`config_files` 标签，以及绑定挂载 `Mounts` 发现候选配置来源，并补充有限的两处 GEOX 已知部署根。仅读取部署配置候选文本，在进程内检测 55490/59290、精确两库、Bucket、选定容器名；不打印内容、密码、环境变量值或命令行。文件身份仅打印路径 SHA-256；不读取 `PRIVATE-DO-NOT-UPLOAD`、凭据或密钥目录。

预期输出包括 `DOCKER_CONTAINERS_INSPECTED`、`COMPOSE_DECLARED_CONFIG_PATHS`、`BIND_DIRECTORY_REFERENCES`、`UNRESOLVED_NONWINDOWS_PATHS`、`CONFIG_FILES_READ`、`ACTIVE_CONFIG_REFERENCE_COUNT` 和 `COVERAGE_ERROR_COUNT`。

**裁决边界：** 此脚本尚未经过用户 Windows PS5.1 实测，因此没有 PASS。哪怕无引用也仅是发现范围内的配置扫描，不是生产绑定绝对不存在的证明。未解析的 WSL/Linux-only 源路径、运行时动态读取或被系统保护的映像，仍必须按实际覆盖边界审计。Resource Owner/Adoption/Permit HOLD，原始六阶段 0/6。


## 14. Step 4C-6D：活动部署配置扫描真实回执（2026-10-30）

```text
A3_ACTIVE_CONFIG_BINDING_DISCOVERY=READ_ONLY
RUN=6ff9b41f6f7f
DOCKER_CONTAINERS_INSPECTED=73
DOCKER_RUNNING_CONTAINERS=36
COMPOSE_DECLARED_CONFIG_PATHS=73
COMPOSE_WORKDIR_REFERENCES=51
BIND_CONFIG_FILE_REFERENCES=0
BIND_DIRECTORY_REFERENCES=11
UNRESOLVED_NONWINDOWS_PATHS=0
CONFIG_ROOTS_FOUND=18
CONFIG_ROOTS_NOT_FOUND=1
CONFIG_FILES_CANDIDATE_COUNT=66
CONFIG_FILES_READ=60
HOLD_DECLARED_CONFIG_FILE_UNREADABLE KIND=COMPOSE_CONFIG_DECLARED (6 occurrences)
CONFIG_REFERENCE_COUNT=0
ACTIVE_CONFIG_REFERENCE_COUNT=0
COVERAGE_ERROR_COUNT=6
HOLD_BOUNDED_DEPLOYMENT_CONFIG_BINDING_REVIEW
NO_GLOBAL_PRODUCTION_BINDING_ABSENCE_NO_RESOURCE_OWNER_NO_ADOPTION_NO_PERMIT
```

**判定：** 已读取 60 个候选配置文件且未发现选定 `55490/59290`、两库、Bucket、选定容器名的显式引用；尚不能证明余下 6 个不可读取的 Compose 配置是否属于已停止容器（历史路径失效）或当前运行容器（活跃部署审查缺口）。原扫描以 `Test-Path -PathType Leaf` 为判定条件，将不存在、目录错误、重解析/访问问题统一输出 `UNREADABLE`，缺失实际归属与错误类型。

**下一步必须限定在这 6 个缺口的归属及原因分类**，不重复 PG、MinIO、SCRAM、73/73 Docker ENV、272 任务、WSL。已准备 `CAP09-A3-MISSING-COMPOSE-PATH-OWNERS-READONLY-PS51.ps1`，SHA-256 `37f5ca3e6bfa7ba612146034bd2d51e754abf61fb7ca0126376a2ffa4d104fd1`。它从现有 Docker Compose 标签（仅容器元数据）关联路径至运行/停止容器，用 Windows 只读 `Get-Item` 元数据区分磁盘/父目录不可达、文件不存在、访问拒绝、非文件和重解析路径；不读取配置正文，不输出原始路径、密钥、环境变量值。**脚本未在实际 Windows 5.1 主机上运行，结果未证实。**

仅当 6 个路径全部证明属于已停止容器且确实历史失效，才能就其对**当前运行容器 Compose 配置扫描**的适用性做限定处置；不能推导所有生产绑定不存在。若存在活跃 owner 或路径权限问题，继续 HOLD，并针对明确 owner 查真实部署来源。Owner Exclusive、Resource Owner、Adoption、Permit 维持 HOLD，原六阶段 0/6。


## 15. Step 4C-6E 真实六个配置缺口归属与 4C-6F 接续（2026-10-30）

用户在 Windows PowerShell 5.1 完成只读缺失 Compose 路径归属审查：

```text
A3_MISSING_COMPOSE_DECLARATION_OWNER_REVIEW=READ_ONLY
RUN=6ff9b41f6f7f
CONTAINER_METADATA_RECORDS=73
RUNNING_CONTAINER_COUNT=36
COMPOSE_DECLARATION_REFERENCES=73
UNIQUE_COMPOSE_DECLARED_CONFIGS=15
DECLARED_FILE_PRESENT_COUNT=9
DECLARED_FILE_GAP_COUNT=6
GAP_RUNNING_OWNER_COUNT=5
GAP_STOPPED_ONLY_COUNT=1
GAP_UNEXPECTED_CAUSE_COUNT=0
UNMAPPED_PATH_COUNT=0
QUERY_ERROR_COUNT=0
HOLD_ACTIVE_OR_UNRESOLVED_COMPOSE_CONFIG_GAPS
```

六个唯一路径的归属（路径不入库，仅保存本机路径 SHA-256）：

| 缺口 | Path SHA-256 | 丢失原因 | 活跃 Owner | 已停止 Owner | 具体归属 |
|---|---|---|---:|---:|---|
| 1 | `37181170d617b61f9511b3b72f684e44ece631168be4bba9e2cfb48ec1bf1611` | 文件缺失、父目录存在 | 1 | 1 | `geox-mcft-cap09-production-v1-geox-mcft-cap09-evidence-runtime-v1-1`（运行中）；`...twin-runtime-v1-1`（停止） |
| 2 | `4266d5484f456e091c9cba563b96d78eceb433ee5c2236a943c72c7058f72665` | 文件缺失、父目录存在 | 1 | 1 | 同上 |
| 3 | `5127130b3490b486e2e1572c708340f1bc4648ae0a41b0f7eda483a141665ac5` | 文件缺失、父目录存在 | 0 | 8 | `geox-bline-phaseb-*` 历史停止容器 |
| 4 | `2b9ecddc244a5fec0ea7f5199996a948c1497f01c5cfe45f72cdfede9f212413` | 文件缺失、父目录存在 | 3 | 0 | `lexicon-pr54-viewport-{web,server,postgres}-1` |
| 5 | `0b9fd05f316461d7ffbbf5d3014dd24a374d34f22baba2577fb6982ce657b9a1` | 父目录缺失或不可访问 | 3 | 0 | `lexicon-pr58-versus-{web,server,postgres}-1` |
| 6 | `fe51b32d05c55fa8f514e8f547ccaba7e277bb0339284f3e88cf528897df834a` | 文件缺失、父目录存在 | 2 | 0 | `lexicon-public-smoke-{web,server}-1` |

注意 `GAP_RUNNING_OWNER_COUNT=5` 是**独立缺失路径**的数量，不是进程数；这 5 个路径关联 1 个 MCFT Evidence Runtime 及 8 个 Lexicon 活跃容器（共 9 个唯一活跃容器，10 次路径-容器关联）。目前不能将它们全部标记为历史失效或豁免。

**重要优先级：** 缺口 1/2 直接对应正在运行的 MCFT 生产 Evidence Runtime。仓库当前生产 Compose 源码 `docker-compose.mcft-cap09-production.yml` 和 `docker-compose.mcft-cap09-production-preformal.yml` 均将 Evidence Runtime 的 PG URL、S3 Endpoint 和 Bucket 通过 Docker environment 注入。因此，即使原 Compose 路径不可读，`docker inspect` 的当前实际 `Config.Env`、`NetworkSettings.Networks`、`Mounts`、`Config.Cmd/Entrypoint` 能作**受限有效运行配置**核查；但不能还原已经丢失的原始 Compose 源文件或追认上线变更。

准备的下一项独立 Windows PS5.1 只读探针：`CAP09-A3-ACTIVE-CONTAINER-EFFECTIVE-BINDING-READONLY-PS51.ps1`，交付 SHA-256 `ceee77919859615a9d12e14bb6d1ca707f48c321c64b0aa02ab27adf6d19e412`。仅检查缺口 1/2/4/5/6 关联的上述九个活跃容器，核验内存中的 Config.Env（不打印环境变量值）、对选定 `55490/59290`、`positive/negative DB`、Bucket、容器名的精确引用、MCFT PG/S3 显式 endpoint 类别、网络连接、挂载与实际启动分类。输出仅类别、布尔值与计数；不改动容器、数据库、S3 或配置。**未在用户 Windows 现场运行，不能提前判 PASS**。

后续即使有效运行配置未发现所选资源引用，结论依然是**限定 Docker 运行时目标绑定检查**，不自动成立全局 `production_bindings_present=false` 或 `owner_exclusive=true`；正式 Resource Owner Raw / 签名仍需独立新鲜事实。原始六阶段 `0/6`、Adoption / Permit HOLD。


## 16. Step 4C-6F：九个运行中容器的有效资源绑定实测（2026-10-30）

用户本机只读检查实际回执：

```text
A3_ACTIVE_CONTAINER_EFFECTIVE_BINDING=READ_ONLY
RUN=6ff9b41f6f7f
EXPECTED_ACTIVE_OWNER_COUNT=9
ACTUAL_RUNNING_OWNER_COUNT=9
TARGET_SIGNAL_OCCURRENCES=0
SELECTED_NETWORK_ATTACHMENTS=0
MCFT_PRODUCTION_DB_URL_CLASS=PARSED_NON_TARGET_PG
MCFT_PRODUCTION_S3_ENDPOINT_CLASS=PARSED_NON_TARGET_S3
MCFT_PRODUCTION_S3_BUCKET_CLASS=EXPLICIT_NON_TARGET_BUCKET
MCFT_PRODUCTION_ENTRYPOINT_CLASS=OTHER_OR_UNDETERMINED_HOLD
MCFT_PRODUCTION_IMAGE_ID_PRESENT=True
COMPOSE_MISSING_DECLARATION_REFERENCES=0
COMPOSE_UNMAPPED_DECLARATION_REFERENCES=18
PRODUCTION_ENDPOINT_VERIFICATION_HOLDS=0
HOLD_EFFECTIVE_RUNTIME_BINDING_OR_SNAPSHOT_REVIEW
DECLARED_COMPOSE_FILES_STILL_MISSING_NOT_RECONSTRUCTED
NO_PRODUCTION_BINDING_ABSENCE_CLAIM_NO_OWNER_NO_ADOPTION_NO_PERMIT
```

**已经证明：** 九个实际运行的容器中没有选定隔离网络成员关系和脚本检查范围内的资源信号；正在运行的 MCFT Production Evidence Runtime 的 PG URL、S3 Endpoint、Bucket 均属于明确非本 Run 目标的资源，三项 Authority mount 均只读；这与先前的 73/73 Docker Env 扫描相互印证。它是**当前 Docker 有效运行配置的限定目标隔离 PASS**，而非全局 Owner 身份 PASS。

**复核脚本发现确定性解析缺陷：** `CAP09-A3-ACTIVE-CONTAINER-EFFECTIVE-BINDING-READONLY-PS51.ps1` 的 `Normalize-HostPath()` 检测 Windows 盘符路径采用正则 `^[a-zA-Z]:[\/]` 的无反斜杠形式（脚本原文为单斜杠字符类）；原 `CAP09-A3-MISSING-COMPOSE-PATH-OWNERS-READONLY-PS51.ps1` 使用同时识别 `\\` 和 `/` 的字符类，已取得 `UNMAPPED_PATH_COUNT=0`。这解释新脚本 9×2 共 18 个 `UNMAPPED`，不能作为 18 个新增配置文件或真实文件状态。**前一轮六个唯一缺失路径事实仍有效，不能由新解析器的 `MISSING=0` 推翻。**

**尚待独立核对的有效容器启动入口：** 6F 脚本从 `Config.Cmd + Config.Entrypoint` 未识别出 `mcft_cap09_evidence_[preformal_owner_]runtime`，输出 `OTHER_OR_UNDETERMINED_HOLD`。仓库源 `docker-compose.mcft-cap09-production-preformal.yml` 的预期启动模块为 `mcft_cap09_evidence_preformal_owner_runtime.js`；`docker-compose.mcft-cap09-production.yml` 为 `mcft_cap09_evidence_runtime.js`。需读取正在运行容器 `Path/Args/Config.Cmd/Entrypoint`，必要时 `docker top`，只打印启动模块类别而不暴露命令行/凭据。不得仅以运行中和映像 ID 存在推断正确模块。

**处理原则：** 不需要重新扫描 Docker 73 个容器，或重做 9 个容器资源绑定证据；只修清晰的脚本路径解析缺陷、定点核对 MCFT Production Evidence Runtime 实际启动模块，同时保留历史 Compose 原文件缺失事实。Resource Owner / Adoption / Permit HOLD；原始六阶段 0/6。


## 17. Step 4C-6G：真实启动模块初次分类 HOLD（2026-10-30）

用户通过 `docker inspect` 取得 MCFT Production Evidence Runtime 的真实 `Path/Args/Config.Cmd/Entrypoint`，并运行 `docker top`。结果：

```text
A3_PRODUCTION_ENTRYPOINT_REVIEW=READ_ONLY
CONTAINER_RUNNING=True
RUNTIME_PATH_CLASS=NOT_IDENTIFIED
RUNTIME_ARGS_CLASS=OTHER_MCFT_MODULE
CONFIG_CMD_CLASS=OTHER_MCFT_MODULE
CONFIG_ENTRYPOINT_CLASS=NOT_IDENTIFIED
DOCKER_TOP_EXIT_CODE=0
LIVE_PROCESS_CLASS=OTHER_MCFT_MODULE
PRODUCTION_ENTRYPOINT_DIAGNOSTIC_COMPLETE
NO_RESOURCE_OWNER_NO_ADOPTION_NO_PERMIT
```

**正确裁决：** 模块可见，但不属于早期脚本内硬编码的 `mcft_cap09_evidence_preformal_owner_runtime.js` 或 `mcft_cap09_evidence_runtime.js` 两种形态。不能判它错误或正确；未输出**实际模块 basename**。经仓库 protected main `5d69b8a3...` 的源码核查，另有 `docker-compose.mcft-cap09-production-preformal-am22-v2.yml` AM22 overlay，其 Evidence 入口为 `scripts/runtime_acceptance/RUN_MCFT_CAP_09_AM22_EVIDENCE_OWNER_ENTRY_V2.cjs`，与 V1 入口不同；该文件存在是可核的候选解释，**不能假定当前运行容器正在使用 AM22 overlay**。

下一步只从 `docker inspect` 已有的 `Args/Config.Cmd/Entrypoint` 与 `docker top` 中提取合法 MCFT `.js/.cjs/.ts` 文件名（只打印 basename，不打印完整命令行、环境、凭据），确认是否是上述 overlay，随后审查实际 container image/entrypoint 对齐性。已经验收的非目标 PG/S3/Bucket、0 selected network attachment 结论不需要重跑。Resource Owner/Adoption/Permit HOLD，原始六阶段 0/6。


## 18. Step 4C-6H：真实 Production Evidence 入口确认（2026-10-30）

本机用户实测，容器 `geox-mcft-cap09-production-v1-geox-mcft-cap09-evidence-runtime-v1-1`：

```text
A3_EXACT_ENTRY_MODULE_DISCOVERY=READ_ONLY
RUN=6ff9b41f6f7f
CONTAINER_ARGS_MODULE=mcft_cap09_am22_gfs_bootstrap_evidence_owner_v1.js
CONFIG_CMD_MODULE=mcft_cap09_am22_gfs_bootstrap_evidence_owner_v1.js
CONFIG_ENTRYPOINT_MODULE=NO_MCFT_MODULE_NAME_FOUND
DOCKER_TOP_EXIT_CODE=0
LIVE_MODULE=mcft_cap09_am22_gfs_bootstrap_evidence_owner_v1.js
EXACT_ENTRY_MODULE_DISCOVERY_COMPLETE
NO_RESOURCE_OWNER_NO_ADOPTION_NO_PERMIT
```

仓库受保护 `main=5d69b8a3f254600726bc10f0404f1330de1e4562` 存在精确配置 `docker-compose.mcft-cap09-am22-gfs-bootstrap-v1.yml`，入口为 `apps/server/dist/apps/server/src/runtime/mcft_cap09_am22_gfs_bootstrap_evidence_owner_v1.js`，与实际 basename 一致。对应实现为 `apps/server/src/runtime/mcft_cap09_am22_gfs_bootstrap_evidence_owner_v1.ts`，读取 `GEOX_DEPLOYMENT_SUBJECT_COMMIT`、runtime-start authority、owner-cutover authority，验证同一 host_id 后调用 `runMcftCap09ProductionEvidenceRuntimeV1`。因此之前 `OTHER_MCFT_MODULE` 是检查脚本只识别较早两个 Evidence Runtime 入口的误分类。**关闭 MODULE_NAME_UNKNOWN 阻断；不将其提升为镜像来源或当前生产授权 PASS。**

源文档 `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-GFS-BOOTSTRAP-CUTOVER-V1.md` 对该 seam 的说明为：GFS same-cycle pre-A0 seed / Owner cutover 引导链，可产生真实生产 Evidence 侧效果；不对 Formal-v5/A0/O00 授权，且六阶段物理测量仍独立必要。仅凭启动模块存在不能证明当前 Authority 生效、Owner 独占或最新 Evidence 健康。

**重要的进一步来源事实：** `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-BASELINE-PREPARATION-CONTRACT-V1.json` 保存了更早一次 Operator Docker inspect 部署观察：`deployment_subject=3b46be1dda2406ffdcc869c55758f3393d69c716`、`image_id=sha256:b2eed3f3845ce4ba45627da028ecc7a04947dd03223698d65cebacf10c659456`、`image_contents_attested=false`、`production_recovery_authorized=false`。这只是**历史观察基线**，还没有在当前 2026-10-30 容器上重新核对，不得将其等同当前鉴证。

**下一步唯一推荐的只读定点：** 对当前生产 Evidence 容器读 `Config.Image`、实际 `Image` ID 和 `GEOX_DEPLOYMENT_SUBJECT_COMMIT` 值，并与上述历史观察作**一致性对比**，只报告匹配布尔值和必要的非敏感 image/subj SHA；不重新打开 Compose 源配置，不动数据库/MinIO，不执行任何 Owner cutover、recovery、Adoption 或 Permit。无论是否匹配，镜像内容及 Authority/Owner 证据仍须独立核验。

Resource Owner / Adoption / Permit HOLD；原始六阶段 0/6。


## 19. Step 4C-6I：生产部署主体及镜像身份精确核对 PASS（2026-10-30 实测）

对运行中的 `geox-mcft-cap09-production-v1-geox-mcft-cap09-evidence-runtime-v1-1`，用户在 Windows PowerShell 5.1 通过 `docker inspect` 获取 `Config.Env` 中唯一的 `GEOX_DEPLOYMENT_SUBJECT_COMMIT`、`Config.Image`、不可变容器 `Image`；再通过 `docker image inspect` 独立回读不可变 ID。结果：

```text
A3_PRODUCTION_IMAGE_IDENTITY=READ_ONLY
SUBJECT_MATCHES_RECORDED_DEPLOYMENT=True
IMAGE_ID_MATCHES_RECORDED_DEPLOYMENT=True
IMAGE_TAG_MATCHES_RECORDED_DEPLOYMENT=True
IMMUTABLE_IMAGE_ID_READBACK=True
PRODUCTION_IMAGE_IDENTITY_DISCOVERY_COMPLETE
IMAGE_CONTENT_ATTESTATION_NOT_ESTABLISHED
NO_RESOURCE_OWNER_NO_ADOPTION_NO_PERMIT
```

对应受保护主线既有历史部署观察：

```text
deployment_subject=3b46be1dda2406ffdcc869c55758f3393d69c716
image_id=sha256:b2eed3f3845ce4ba45627da028ecc7a04947dd03223698d65cebacf10c659456
image_tag=geox-mcft-cap09-runtime:3b46be1dda2406ffdcc869c55758f3393d69c716
image_contents_attested=false
production_recovery_authorized=false
```

历史观察源：`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-BASELINE-PREPARATION-CONTRACT-V1.json`。源码 `docker-compose.mcft-cap09-am22-gfs-bootstrap-v1.yml` 的入口 basename `mcft_cap09_am22_gfs_bootstrap_evidence_owner_v1.js` 也已经与实际 `docker top` 核对一致。

**本轮完成的限定子项：** 当前生产 Evidence 容器 deployment subject、tag、不可变 Image ID 与历史登记的观察值精确一致；实际执行入口与仓库 GFS bootstrap overlay 的模块名一致；前述对 Run `6ff9b41f6f7f` 的指定 PG/S3/Bucket 非目标连接结论不受影响。**未证明：** 独立镜像内容证明、当前 production owner 健康、全部 Windows/WSL 长期动态访问路径排除、选定隔离资源 Owner 唯一归属，以及正式签署的 Resource Owner Raw。不要因为镜像/进程一致性再次重启生产容器。

下一步不再追查生产镜像身份或历史 Compose 原路径，专注所选 A3 PG/S3 的独占归属、具体生产绑定适用性审查；只有限定事实充分时才运行一次独立新的 Windows PG/S3 fresh 原始回读，按 `scripts/governance_acceptance/MCFT_CAP09_ATTEMPT3_RESOURCE_OWNER_V1.cjs` 生成 byte-hash-bound 的 TEST_ONLY 签署。原始六阶段仍 0/6，Resource Owner / Adoption / Permit HOLD。


## 20. CTO Step 4C-7 正式执行批准与 Fresh Resource Owner 本地封闭工具（2026-10-30）

**CTO 决定：`APPROVED FOR BOUNDED RESOURCE OWNER CLOSURE`，而非 Resource Owner PASS。** 指定资源冻结：`cap09-a3-pg-6ff9b41f6f7f`、`cap09-a3-minio-6ff9b41f6f7f`，端点 `127.0.0.1:55490`、`127.0.0.1:59290`，正负数据库 `mcft_cap09_requal_6ff9b41f6f7f_{positive,negative}`，Bucket `mcft-cap09-requal-6ff9b41f6f7f`。不重新创建容器、卷、网络、数据库或 Bucket；不重复生产镜像身份/已通过科学采集/历史物理测试。Resource Owner 通过后主线依次为 Adoption V2 → 非授权 S3→Candidate→PG 全链（必要时）→ Windows `--preflight-only` → 单独 TEST_ONLY Permit 裁决。

重新核实受保护 `main` 上的强制验签模块 `scripts/governance_acceptance/MCFT_CAP09_ATTEMPT3_RESOURCE_OWNER_V1.cjs`：payload 严格字段、`MCFT_CAP09_ATTEMPT3_RESOURCE_READBACK_V1` 原始字节 SHA-256、 `WINDOWS_READ_ONLY_PG_S3_INDEPENDENT_HOST` probe 来源 SHA、已登记 `ACCOUNTABLE_SINGLE_OPERATOR` Ed25519 key、`issued_at-observed_at<=300000ms`、`expires_at-issued_at<=300000ms`，签署 `GEOX_MCFT_CAP09_ATTEMPT3_ISOLATED_RESOURCE_OWNER_ATTESTATION_V1\\n` domain。读取 `scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json`，登记 host `LAPTOP-STN2A2P1`、Operator `mcft_cap09_operator_mylr1`、key `mcft_cap09_ed25519_223c806e`、SPKI `223c806e89c4e6df5e91a089e0b22e5cef05934d42ee7df817faaeaa67553365`，有效期 `2026-10-13` 至 `2026-11-13` UTC；未使用独立治理签名者，不改变证据用途。

根据本次授权，已在本地生成**未执行**单次 Windows fresh producer + same-process signer/verifier：

- `CAP09-A3-RESOURCE-OWNER-FRESH-SIGN-VERIFY-V1.cjs`，SHA-256 `63ed18a730a0f62fcc8b8a1d8d4692f91e5be4ccf7ed9c33e077b117a3367a31`；Node `--check` 通过，Linux 非 Windows guard 正确 fail closed；未取得 Windows 实测。读取现有 PG/S3 服务、专用网/卷、精确 host port、PG 正负库空表和 SCRAM 实测、角色/ACL、非循环客户端、PG 现有会话、MinIO 匿名权限/当前+版本+未完成 multipart、其他 MinIO 命名容器是否共用 exact root credential、目标端口 host 活跃连接；不重验历史生产镜像身份。Source SHA 是本工具真实文件摘要，不从日志生成。
- `RUN-CAP09-A3-RESOURCE-OWNER-FRESH-PS51.ps1`，SHA-256 `92a1ee09bdb44923a96991642c065fad673818ec72a156b775e750fae7f5eb5b`；通过 SHA-256 校验，自动查找当前 **clean exact protected main** 或由用户指定仓库位置；不更新 checkout。
- 可下载打包 `CAP09-A3-RESOURCE-OWNER-CLOSURE-V1.zip`，SHA-256 `193bb0ef154693d199be0713008c6e477adf77a378b3caa5abb6f188f1a1b2f0`（用户聊天附件；**未上传到仓库**）；含使用说明，不含凭据/私钥。

**防止错误提升的边界：** 任何进程/服务/端口/卷/账号/对象状态不一致，都提前 STOP，不生成 signed Owner envelope。仅在 fresh probes 成功、原始 JSON 实际字节保存并通过仓库 `verifyReadbackFile`、单一真实私钥与 trust SPKI 一致、严格 payload `bindSignedToReadback`、正式 `verify` 成功时，才产生独立的 Raw JSON、Signed Envelope 和 Verification Receipt 到本地**仓库外**目录；不上传凭据。对生产绑定的否定是**已发现活跃配置与当前观察范围**的受限结论，不宣称任何休眠/未来主机进程绝对无法访问这些端口。历史 Compose 丢失保留在前节，不重建。实际 Owner PASS 仍需要 Windows 原始实际结果；此工具生成与成功静态检查不能替代实测。

**截至本次记录的唯一正式状态：** `RESOURCE_EXCLUSIVITY=HOLD`、`FRESH_RAW_READBACK=NOT_RUN`、`OWNER_ED25519=HOLD`、`ADOPTION_V2=HOLD`、`FULL_CHAIN=HOLD`、`PERMIT=HOLD`、`ORIGINAL_SIX_STAGES=0/6`。

**第一项剩余阻断及最小动作：** 真实 Windows 本机尚未执行本次 fresh probe/签署闭环。用所附签署工具在当前 clean exact protected main 上执行**一次**，仅当独占检查确证后产出原始回读与签名；如报 HOLD，按工具第一项 `HOLD_*` 精确修复，不重跑历史验收。

## 21. Step 4C-7 第一次正式执行：仅启动器仓库发现失败（2026-10-30 Windows 回执）

用户在已有解压目录 `D:\\gptdown\\CAP09-A3-RESOURCE-OWNER-CLOSURE-V1` 执行 `RUN-CAP09-A3-RESOURCE-OWNER-FRESH-PS51.ps1`，终止于第 26 行：
```text
git.exe : fatal: not a git repository (or any of the parent directories): .git
at RUN-CAP09-A3-RESOURCE-OWNER-FRESH-PS51.ps1:26
$Head = @(& git.exe -C $Dir.FullName rev-parse HEAD 2>$null)
```

**准确原因：** 脚本候选目录发现先判断 `MCFT_CAP09_ATTEMPT3_RESOURCE_OWNER_V1.cjs` 文件存在，但某候选只是源码复制件、缺少 Git worktree 元数据。Windows PowerShell 5.1 的 `$ErrorActionPreference='Stop'` 将非仓库候选的 `git rev-parse` STDERR NativeCommandError 升级为整个启动器终止。程序并未调用 Node 物理探针，未访问 PG/S3，未生成 Fresh Raw 或签名；这不是资源独占性失败，也不需要重新运行之前 PASS 的镜像/容器/网络检查。

**最小纠正：** 打包原 Node producer 不变的 `CAP09-A3-RESOURCE-OWNER-CLOSURE-V2.zip`，ZIP SHA-256 `ec9c0c7adde29cb71ad1b1c557e5ce9d8f691263bc09f070dedb16b7561767c6`；其中仅 PS5.1 启动器对四类 Git 候选探测命令（rev-parse / branch / status / ls-remote）添加定点 `try/catch { continue }`，确保**只跳过非 Git/不满足资格的候选**，没有改变所有 exact protected main、clean branch、远端 HEAD 等 fail-closed 要求。新的 PS 启动器 SHA-256 `88398f245a53ad95f98985128dfa660cb6a5532055731d8e8955eba19a8b1648`。Node producer 原 SHA-256 `63ed18a730a0f62fcc8b8a1d8d4692f91e5be4ccf7ed9c33e077b117a3367a31` 保持不变，`node --check` PASS，归档清单/字节 SHA 回读一致；未进行 Windows PS5.1 实测。

**下一动作：** 解压 V2 到新目录（不覆盖 V1），验 ZIP/PS/Node SHA 后运行新启动器一次。若 `HOLD_NO_CLEAN_EXACT_MAIN_CHECKOUT_FOUND_USE_REPOROOT`，应只明确定位合法的 clean exact protected main checkout，再通过 `-RepoRoot` 指定；不得自行将失去 Git 元数据的源码复制目录当作精确主线。仅当进入 Node 后才可能执行 Fresh PG/S3 Raw 与 5 分钟签署。保持 `RESOURCE_EXCLUSIVITY=HOLD`, `FRESH_RAW_READBACK=NOT_RUN`, `OWNER_ED25519=HOLD`, `ADOPTION_V2=HOLD`, `FULL_CHAIN=HOLD`, `PERMIT=HOLD`, `ORIGINAL_SIX_STAGES=0/6`。


## 22. Step 4C-7 第二次操作：V2 ZIP 本地路径不存在（2026-10-30 Windows 回执）

Windows 用户执行 `Get-FileHash D:\\gptdown\\CAP09-A3-RESOURCE-OWNER-CLOSURE-V2.zip`、`Expand-Archive`、调用 `RUN-CAP09-A3-RESOURCE-OWNER-FRESH-PS51.ps1` 均失败，第一故障为 `Resolve-Path ItemNotFound`，即 ZIP 没有实际保存到预期路径，后续只是级联失败。**无物理回读、无 Owner 签名、未访问目标 PG/S3。**

已核实对话工具包原本存在完整 V1 与 V2，且 V2 中 `CAP09-A3-RESOURCE-OWNER-FRESH-SIGN-VERIFY-V1.cjs` 的原始 Node 生产者没有改动。原 V1 已在 `D:\\gptdown\\CAP09-A3-RESOURCE-OWNER-CLOSURE-V1` 解压，启动器显式接受 `-RepoRoot` 参数；故下一步**不再要求下载 V2 ZIP**。从 `D:\\gptdown` 下存在真实 `.git` 及 `MCFT_CAP09_ATTEMPT3_RESOURCE_OWNER_V1.cjs` 的候选检出目录中确定唯一 clean protected main，显式传 `-RepoRoot` 运行现有 V1（Node 内依然强制 `HEAD===git ls-remote origin refs/heads/main`、`branch=main`、`status --porcelain` 为空）。绝不把缺少 Git 元数据的源码复制目录冒充正式主线；若无唯一合格仓库，应只定位/准备合法 checkout，不涉及 Docker PG/S3 施工。

状态：`RESOURCE_EXCLUSIVITY=HOLD`；`FRESH_RAW_READBACK=NOT_RUN`；`OWNER_ED25519=HOLD`；`ADOPTION_V2=HOLD`；`FULL_CHAIN=HOLD`；`PERMIT=HOLD`；`ORIGINAL_SIX_STAGES=0/6`。


## 23. Step 4C-7 第三次操作：精确本地工作树候选已定位，待校验后显式选择（2026-10-30 Windows 回执）

本次 Windows PS5.1 执行只读工作树发现：

```text
RESOURCE_OWNER_PROBE_SHA256_PRECHECK=NO_ERROR
REAL_GIT_REPOSITORY_CANDIDATES=2
CANDIDATE=D:\\gptdown\\MCFT-CAP09-3748-READONLY
CANDIDATE=D:\\gptdown\\MCFT-CAP09-MAIN-5D69B8A3
HOLD_SELECT_EXACT_MAIN_REPOSITORY
```

**判定：** 此次扫描判定条件仅为“存在 `.git` 且存在 Owner 验证器文件”，并**未**测量两个候选当前 HEAD、分支、工作树清洁状态、远端 `origin/main`。因此数值 2 不等于两个仓库均满足 exact clean main，也不代表 V1 运行器或物理 probe 失败。V1 未执行、PG/S3 Raw 未发生、未签署。

**最小下一动作：** 优先只检查 `D:\\gptdown\\MCFT-CAP09-MAIN-5D69B8A3` 的 `rev-parse HEAD`、`branch --show-current`、`status --porcelain`、`ls-remote origin refs/heads/main`，要求 `main`、干净、HEAD 与当前远端一致（并与冻结 `5d69b8a3f254600726bc10f0404f1330de1e4562` 的 subject 进行确认）。如果全满足，执行已存在的 `D:\\gptdown\\CAP09-A3-RESOURCE-OWNER-CLOSURE-V1\\RUN-CAP09-A3-RESOURCE-OWNER-FRESH-PS51.ps1 -RepoRoot D:\\gptdown\\MCFT-CAP09-MAIN-5D69B8A3`；不重新下载 V2、自动扫描整个目录、不改 Git。若不满足，则 HOLD 并报告第一失败条件，不切换到历史只读检出以规避门禁。

状态仍为 `RESOURCE_EXCLUSIVITY=HOLD`，`FRESH_RAW_READBACK=NOT_RUN`，`OWNER_ED25519=HOLD`，`ADOPTION_V2=HOLD`，`FULL_CHAIN=HOLD`，`PERMIT=HOLD`，`ORIGINAL_SIX_STAGES=0/6`。


## 24. Step 4C-7 第四次操作：唯一剩余精确主线阻断是分支状态（2026-10-30）

用户在 `D:\\gptdown\\MCFT-CAP09-MAIN-5D69B8A3` 实测（从 Git 实际 stdout）：

```text
BRANCH_MAIN=False
WORKTREE_CLEAN=True
EXACT_FROZEN_HEAD=True
HEAD_MATCHES_REMOTE_MAIN=True
HOLD_EXACT_CLEAN_PROTECTED_MAIN
```

之后用户继续逐行运行 `Write-Host 'EXACT_MAIN_ADMISSION=PASS'`，那**只是手动打印**，前面的 throw 已确实阻断；不是验收结果。V1 工具再执行，`SOURCE_PROBE_SHA256=63ed18a730a0f62fcc8b8a1d8d4692f91e5be4ccf7ed9c33e077b117a3367a31`，输出目录 `D:\\gptdown\\CAP09-A3-RESOURCE-OWNER-FRESH-20261030T011056604Z`，Node 在进入物理探针前正确返回 `first_blocker=HOLD_EXACT_CLEAN_PROTECTED_MAIN_REQUIRED`。**没有 PG/S3 Fresh Raw、Ed25519 签署或 Permit 消费。**

**准确原因：** HEAD 正确、当前远端 main 正确、工作树干净；只有当前检出分支并非字面 `main`（可能 detached HEAD 或其他分支，暂未定），与本次强制资格门禁不符。历史 `D:\\gptdown\\MCFT-CAP09-3748-READONLY` 保持保留；不需要清理旧工作树。建议仅在 `D:\\gptdown\\MCFT-CAP09-MAIN-5D69B8A3` 中确认当前 Git refs 与远端 HEAD 后，安全地 `git switch main`（若存在且等于 exact head），或本地 `git switch -c main <exactHead>`（仅当 local main ref 不存在）——只能改变本地分支指向，不提交、不 push、不更新受保护 main、不强制接管其他工作树。重新验证 branch/main、clean status、exact head、remote SHA，全部 PASS 后调用已有 V1 `-RepoRoot`。不能忽略 Node 严格主线核验。

**状态：** `RESOURCE_EXCLUSIVITY=HOLD`, `FRESH_RAW_READBACK=NOT_RUN`, `OWNER_ED25519=HOLD`, `ADOPTION_V2=HOLD`, `FULL_CHAIN=HOLD`, `PERMIT=HOLD`, `ORIGINAL_SIX_STAGES=0/6`。


## 25. Step 4C-7 第五次操作：本地 main ref 与正确 HEAD 不同（2026-10-30 Windows 回执）

用户已证实 `D:\\gptdown\\MCFT-CAP09-MAIN-5D69B8A3` 当前 checkout HEAD 与远端 protected main `5d69b8a3f254600726bc10f0404f1330de1e4562` 相同，worktree clean，当前分支非 `main`。进一步尝试安全切换前，`git show-ref --verify refs/heads/main` 存在，但 `git rev-parse refs/heads/main` 与 exact expected HEAD 不同，脚本按设计终止：

```text
HOLD_LOCAL_MAIN_POINTS_TO_DIFFERENT_HEAD
```

该事实**只证明本地 main ref 不同**，尚未证明是本地落后还是分叉；不得直接 `git branch -f` / `reset --hard`，也不更改远端或删除旧 `MCFT-CAP09-3748-READONLY` 工作树。Node Fresh probe 未运行、PG/S3 未复采、Owner 未签署。

唯一最小安全动作：重新验证 exact HEAD、clean、remote SHA → `git merge-base --is-ancestor refs/heads/main <exact HEAD>`。仅当返回 0，才能 `git switch main` 再 `git merge --ff-only <exact HEAD>`，完毕后重新查 `main`/clean/HEAD/remote，全部精确一致才调用现有 V1 `-RepoRoot`。如果本地 main 是分叉或已被其他 worktree 占用，保持 HOLD 并报告第一项具体 Git 失败；不做强制分支更新。

状态仍为 `RESOURCE_EXCLUSIVITY=HOLD`, `FRESH_RAW_READBACK=NOT_RUN`, `OWNER_ED25519=HOLD`, `ADOPTION_V2=HOLD`, `FULL_CHAIN=HOLD`, `PERMIT=HOLD`, `ORIGINAL_SIX_STAGES=0/6`。


## 26. Step 4C-7 — Windows Resource Owner Fresh Raw + Operator Ed25519 实测完成（2026-10-30）

**首次正式现场成功回执**（用户上传的 Windows PowerShell 全量日志，末尾含工具生成的单行 JSON；文件未直接上传原始 Raw JSON 或签名 Envelope）：

```text
EXACT_MAIN_ADMISSION=PASS
A3_OWNER_CLOSURE=BOUNDED_WINDOWS_FRESH
RUN=6ff9b41f6f7f
SOURCE_PROBE_SHA256=63ed18a730a0f62fcc8b8a1d8d4692f91e5be4ccf7ed9c33e077b117a3367a31
OUTPUT_DIR=D:\gptdown\CAP09-A3-RESOURCE-OWNER-FRESH-20261030T012250812Z
RESOURCE_EXCLUSIVITY=PASS
FRESH_RAW_READBACK=PASS
OWNER_ED25519=VERIFIED
ADOPTION_V2=HOLD
FULL_CHAIN=HOLD
PERMIT=HOLD
ORIGINAL_SIX_STAGES=0/6
```

精确证据索引（来自同一次工具终态 JSON）：

- `subject_sha=5d69b8a3f254600726bc10f0404f1330de1e4562`
- `host_id=LAPTOP-STN2A2P1`
- `raw_sha256=8605568797c21b0094ad501075d12b4b9e969fbaefe341d259ee0199fdc9ad17`
- `signed_sha256=992bd3f5c3f3d28beebddb02b1521933bae9741d997090ff2e3ce50f884ac554`
- Local-only evidence path: `D:\gptdown\CAP09-A3-RESOURCE-OWNER-FRESH-20261030T012250812Z`

操作中先对本地 `D:\gptdown\MCFT-CAP09-MAIN-5D69B8A3` 完成安全 `git switch main` 和 `git merge --ff-only`，Git 显示 `Fast-forward`，随后 `EXACT_MAIN_ADMISSION=PASS`，实际 Node probe/Signer 进入并返回正式 PASS。Git 输出的 `602 files changed` 是**本地 main 快进的源码树更新摘要**，不表示资源生产化变更或向远端推送。既有其他工作树未删除；生产运行容器身份检查 Step 4C-6I 已冻结。

**正式裁决：** Run `6ff9b41f6f7f` 的 Resource Exclusivity / Windows Fresh Raw / Operator Ed25519 当前现场验收为 `PASS / PASS / VERIFIED`。该结论基于本次真实 Windows 工具成功日志与回执摘要；未将本地原始 JSON、签名 Envelope、私钥或测试密码上传仓库，仓库 Handoff 不是签署物本身。后续正式验证器消费必须从上述本地目录按 SHA-256 校验原始 bytes，不得由本日志/Handoff 重构正式 Raw 或补造签名。保留原始证据文件，勿修改或移动直至后续消费流程完成。

**立即切主线：** Adoption V2 当前精确 Subject 签署资格；若必需补非授权 S3→Candidate→PG 全链，再完成真正 Windows `--preflight-only`，最后单独 TEST_ONLY Permit 裁决。不得因 Owner 已 PASS 自动提升 Adoption、Full Chain、Permit；不启动原始六阶段、不重新施工 PG/S3、不重复已通过的生产镜像或科学采集。

**下一项唯一直接阻断：** `ADOPTION_V2=HOLD`；最小动作是审查现有 current subject 65 项 QCP 资格与原 54 formal 定义、取得当前主线 Adoption V2 的用途专属批准/签名输入，并通过已存在的正式消费程序验证，禁止伪造或重用陈旧签名。

**状态：** `RESOURCE_EXCLUSIVITY=PASS`; `FRESH_RAW_READBACK=PASS`; `OWNER_ED25519=VERIFIED`; `ADOPTION_V2=HOLD`; `FULL_CHAIN=HOLD`; `PERMIT=HOLD`; `ORIGINAL_SIX_STAGES=0/6`.


## 27. Resource Owner 完成后：Adoption V2 当前主线原生证据初核（2026-10-30）

从 GitHub 真实原生 API 独立回读：

- PR **#3748** `state=CLOSED`，`merged=true`，`head=db275e6f9699a719f5cd72c0d70a763cc2e8e2bb`，`merge_commit_sha=5d69b8a3f254600726bc10f0404f1330de1e4562`，与 protected `refs/heads/main` 当前值一致。
- #3748 source QCP run `40747123426`，`completed/success`，head `db275e6f...`；artifact id `12841204944`，name `mcft-cap09-qualification-control-plane-db275e6f9699a719f5cd72c0d70a763cc2e8e2bb`，`expired=false`，GitHub artifact SHA-256 `696460a2b646423dcc641a066ccad41df5c0a2ba4a7de8db2dc059037e81586e`，size 319725 bytes；appplicability-and-blocker-inventory job `123024417814` 为 SUCCESS，其余四个 QCP workflow job 是 skipped（合约是否允许须由正式 Consumer 核对，勿从 workflow success 自动推断整个 QCP65 PASS）。
- #3748 GitHub issue comments 共 8 条；截至本次回读，没有正文以严格 `GEOX_MCFT_CAP09_ADOPTION_V2_NEW_MAIN_OWNER_APPROVAL_V1` 开头的**当前主线 Owner 批准评论**。该评论是 `MCFT_CAP09_ADOPTION_V2_NEW_MAIN_SUCCESSOR_V1.cjs` 的原生强制输入，须由仓库 owner `liyongshang44-max` 在 #3748 **合并后**发布；正文必须严格等于基于 unsigned candidate payload 的 `ownerApprovalText(p)`，含新 main、source head、Run/Host/Operator、`MATERIAL_DIGEST`、issuer/key、TEST_ONLY 与 No Permit 等边界。现有工程评论不能冒充这一评论，亦不能在 candidate/material digest 未定前编造。
- 签署由已存在的 `SIGN_MCFT_CAP09_ADOPTION_V2_OFFLINE.cjs` 在 Windows 上执行，要求当前 release、unsigned candidate、material、合格用途 ADOPTION 注册 key 和若适用的 operator scope grant，正式 Consumer `MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.cjs` 验证成功后才持久化 Signed Request。该用途与刚完成的 **Resource Owner** Ed25519 签署不同，不能复用签名值或假定同一 key 获得 ADOPTION 用途资格。

**第一实际阻断：** 当前 subject 的 Adoption V2 尚无经 Consumer 验证的完整 unsigned candidate/material/provenance bundle 及合并后 Owner 用途专属原生批准；已有 #3748 source QCP 工程 SUCCESS + artifact 不能独立替代 Adoption。最小动作是严格按当前 Consumer 组装 candidate/material，以真实 digest 生成 Owner comment，读取其 GitHub 原生 ID，然后在 Windows 用 ADOPTION 注册密钥签署并正式消费。资源 Owner 已 PASS，**不得因此重跑其 Fresh Raw 或更改隔离 PG/S3**。

状态仍：`RESOURCE_EXCLUSIVITY=PASS`; `FRESH_RAW_READBACK=PASS`; `OWNER_ED25519=VERIFIED`; `ADOPTION_V2=HOLD`; `FULL_CHAIN=HOLD`; `PERMIT=HOLD`; `ORIGINAL_SIX_STAGES=0/6`.


## 28. Adoption V2 当前 Subject：原生双 QCP Source + Windows 材料准备包（2026-10-30）

**原生资料已独立取回并按 GitHub Artifact digest 验证，并非合成：**
- PR #3747 source `61820645059360ba2c8c44cc2453925a0e68f83e` / merge `d38a5b07a92a63c67fbe2fcc3982ff9b9491e5ac`；QCP run `40709390062`，job `122890190873`，artifact `12826495755`，ZIP SHA-256 `6803cdc407ed4e3d7dc70941f21d53f75b0c79046a1b8f676bdfc8aa124708f4`，原始 `MCFT_CAP_09_ALL_BLOCKERS_PREFLIGHT_V1_RESULT.json` SHA-256 `70c3246a845a3ec5923b3864e54a8be9a901bb887af22d1a3da1256d6a83c49e`；machine `PASS`、`65/65`、`56 PASS / 9 NOT_APPLICABLE`、零 blocker。其严格历史 NA 集为 5 formal + 4 technical，符合现有 `MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.cjs` 的 `checkQcp65` 固定准入。
- PR #3748 source `db275e6f9699a719f5cd72c0d70a763cc2e8e2bb` / protected merge `5d69b8a3f254600726bc10f0404f1330de1e4562`；QCP run `40747123426`，job `123024417814`，artifact `12841204944`，ZIP SHA-256 `696460a2b646423dcc641a066ccad41df5c0a2ba4a7de8db2dc059037e81586e`，原始 JSON SHA-256 `631b66cc614729a145b678695289a3e45165a4ab718c5be617c9425bba385d66`；machine `PASS`、`65/65`、`55 PASS / 10 NOT_APPLICABLE`、零 blocker。`#3748` 的 `55/10` 由独立 `MCFT_CAP09_ADOPTION_V2_NEW_MAIN_SUCCESSOR_V1.cjs` 负责验证，而非直接套用历史 QCP 的 `56/9` NA 集，**不是已证实的签署阻断**。两 ZIP 均由 GitHub 原生 Artifact 下载，大小 318677 与 319725 字节，与原生 digest 一致；不得改写历史及后继 QCP Raw。
- 通过 GitHub 当前 Owner OAuth 核验 `liyongshang44-max`。已在 #3748 发布本次精确 Owner 批准评论 ID `6513969227`，链接 `https://github.com/liyongshang44-max/GEOX/pull/3748#issuecomment-6513969227`；作者 `liyongshang44-max`、`author_association=OWNER`、正文与 `ownerApprovalText()` 逐字一致、创建后未编辑、时间晚于 #3748 merge。批准严格为 `TEST_ONLY / APPROVE_FORMAL_ADOPTION_V2_SIGNATURE_REVIEW_ONLY`，并明确 Host/Permit/physical stages/production 全部 false。
- 主线 `scripts/cap09_adoption_v1/offline-trust.json` 有 Purpose=`ADOPTION`、ACCOUNTABLE_SINGLE_OPERATOR `mcft_cap09_operator_mylr1`、key `mcft_cap09_ed25519_223c806e`，直到 `2026-11-13T00:00:00.000Z` 有效；但是该 Operator 没有内嵌 `formal_adoption_scope`，所以 `offline-context.cjs` 要求额外的、由 ADOPTION key 按 `GEOX_MCFT_CAP09_OPERATOR_ADOPTION_SCOPE_GRANT_V1\\n` domain 单独签名的 `TEST_ONLY` scope grant，绑定准确 `material_digest`、subject、host、issuer；Owner 原生评论仍另行必需。不能复用之前 Resource Owner Ed25519 签名内容或用途。
- 准备包 `CAP09-ADOPTION-V2-PREPARE-3748.zip`，SHA-256 `f6e87fb7ac6e0fb031697adf7b6f783e75878bdaf2cd61dc35e99a10ca06dfb2`；包含双 QCP 原生 ZIP/Raw、derivation、Windows PS5.1 准备与最终签署脚本。用户 Windows 本机已实际完成准备：`status=SOURCE_AND_MATERIAL_PREPARED_OWNER_COMMENT_REQUIRED_NOT_ADOPTED`；`material_digest=f6352bb88baabb1a5f94c021859aecdf70ddb2a066b80864469272f3192cf04c`；`policy_digest=64c4996763ba6fa98718930f5667d648e3c45031703e94a62c06d53767b17df7`；Host `LAPTOP-STN2A2P1`；historical QCP `56/9`、successor QCP `55/10`，两份均 65 项、零 fail/unknown/forbidden/authority errors/unknown paths/blockers。Candidate 仍为 `adoption_owner_approval_comment_id=0` 的原始 pending 文件；最终签署脚本会绑定已验证 comment ID 并生成正式最终 candidate。
- 设计限定：Windows 准备脚本仅从 clean exact main 做 `git archive` 到仓库外全新目录，将下载工件原样置入 evidence，调用仓库原生 `installed-material.collect` 绑定 Windows Node/Python/PowerShell 和完整 release content，计算 `material_digest` 并产生 unsigned candidate、`release_binding`、`OWNER-APPROVAL-TEXT-EXACT.txt`。候选内 `adoption_owner_approval_comment_id=0` 是**明确 pending，不能签署**。收到真实 Owner 原生评论 id 后，第二脚本先验证其严格正文和来源，再独立签发 scope grant、刷新签署时效，调用仓库原生 `SIGN_MCFT_CAP09_ADOPTION_V2_OFFLINE.cjs` 和 Consumer；真实 Operator 私钥只在 Windows 使用、不能上传。没有触碰 PG/S3、Permit 或原六阶段。
- **下一实际操作：** 在同一个 Windows PS5.1 会话中运行 `FINALIZE-SIGN-ADOPTION-V2.cjs`，参数使用 release root `D:\gptdown\CAP09-A3-ADOPTION-V2-3748-PREPARED\installed-release`、output root `D:\gptdown\CAP09-A3-ADOPTION-V2-3748-PREPARED`、已核验 Owner comment ID `6513969227`、本机 ADOPTION 私钥 `D:\gptdown\MCFT-CAP09-PRIVATE-SIGNER\signer-private.pem`、以及 `material.json` 中实际登记的 Python 路径。该脚本会重新从 GitHub 核验 Owner comment、生成独立 `TEST_ONLY` Operator Scope Grant 和 ADOPTION Ed25519 签名，并调用正式 Consumer；私钥不得上传。

**当前状态：** `RESOURCE_EXCLUSIVITY=PASS`，`FRESH_RAW_READBACK=PASS`，`OWNER_ED25519=VERIFIED`，`ADOPTION_OWNER_APPROVAL=VERIFIED`；`ADOPTION_V2=AWAITING_WINDOWS_SIGNATURE_AND_CONSUMER`，`FULL_CHAIN=HOLD`，`PERMIT=HOLD`，`ORIGINAL_SIX_STAGES=0/6`。
