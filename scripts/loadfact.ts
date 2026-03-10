/* eslint-disable no-console */ // 关闭 console lint（导入脚本需要输出进度）
// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

import fs from "node:fs"; // 读取本地数据文件
import readline from "node:readline"; // 逐行流式读取，避免一次性加载大文件
import crypto from "node:crypto"; // 生成稳定的 fact_id（幂等导入）
import pg from "pg"; // PostgreSQL 客户端

const { Pool } = pg; // 取出连接池构造器

// ----------------------------------------------------------------------------
// 1) 配置与入参解析（最小可用）
// ----------------------------------------------------------------------------

type CliArgs = {
  file: string; // 输入文件路径（TSV）
  projectId: string; // entity.project_id
  groupId: string; // entity.group_id
  tz: "UTC"; // 时间解析时区（v0 固定 UTC）
  writeRawSamples: boolean; // 是否同时写 raw_samples（若你的系统不需要，可关）
};

function parseArgs(argv: string[]): CliArgs {
  // 简单 argv 解析（避免引入额外依赖）
  const m = new Map<string, string>(); // 存储 --k=v / --k v 形式参数

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] ?? ""; // 当前 token
    if (!a.startsWith("--")) continue; // 只处理 -- 开头参数
    const eq = a.indexOf("="); // 查找是否为 --k=v
    if (eq >= 0) {
      m.set(a.slice(2, eq), a.slice(eq + 1)); // 写入键值
    } else {
      const k = a.slice(2); // 键名
      const v = argv[i + 1] ?? ""; // 值（下一个 token）
      m.set(k, v); // 写入键值
      i += 1; // 消费掉 value
    }
  }

  const file = m.get("file") ?? ""; // 必填：输入文件
  if (!file) throw new Error("Missing --file"); // 缺少则直接报错

  const projectId = m.get("projectId") ?? "P_DEFAULT"; // 默认与现有一致
  const groupId = m.get("groupId") ?? "G_CAF"; // 默认与现有一致

  const tz = "UTC" as const; // v0 固定 UTC

  const writeRawSamples = (m.get("writeRawSamples") ?? "1") !== "0"; // 默认写 raw_samples

  return { file, projectId, groupId, tz, writeRawSamples }; // 返回解析结果
}

// ----------------------------------------------------------------------------
// 2) 指标映射（列名 -> metric）
// ----------------------------------------------------------------------------

const METRIC_MAP: Record<string, string> = {
  VWC_30cm: "soil_moisture_vwc_30cm",
  VWC_60cm: "soil_moisture_vwc_60cm",
  VWC_90cm: "soil_moisture_vwc_90cm",
  VWC_120cm: "soil_moisture_vwc_120cm",
  VWC_150cm: "soil_moisture_vwc_150cm",
  T_30cm: "soil_temp_c_30cm",
  T_60cm: "soil_temp_c_60cm",
  T_90cm: "soil_temp_c_90cm",
  T_120cm: "soil_temp_c_120cm",
  T_150cm: "soil_temp_c_150cm",
}; // 约定：输入列名必须在这里可映射，否则视为不支持列

// ----------------------------------------------------------------------------
// 3) 时间解析（MM/DD/YYYY + H:MM -> ts_ms UTC）
// ----------------------------------------------------------------------------

function parseTsMsUTC(dateMMDDYYYY: string, timeHMM: string): number {
  // date: MM/DD/YYYY
  const [mmS, ddS, yyyyS] = dateMMDDYYYY.split("/"); // 拆分年月日
  const mm = Number(mmS); // 月
  const dd = Number(ddS); // 日
  const yyyy = Number(yyyyS); // 年

  // time: H:MM or HH:MM
  const [hS, minS] = timeHMM.split(":"); // 拆分时分
  const hh = Number(hS); // 小时
  const mi = Number(minS); // 分钟

  // Date.UTC 的 month 从 0 开始，因此 mm-1
  const ms = Date.UTC(yyyy, mm - 1, dd, hh, mi, 0, 0); // 生成 UTC epoch ms
  if (!Number.isFinite(ms)) throw new Error(`Bad datetime: ${dateMMDDYYYY} ${timeHMM}`); // 防御性校验
  return ms; // 返回毫秒时间戳
}

// ----------------------------------------------------------------------------
// 4) 事实 JSON 构造（保留原行证据到 meta.evidence_line）
// ----------------------------------------------------------------------------

type RawSampleFact = {
  type: "raw_sample_v1"; // 与系统一致的类型
  schema_version: 1; // 与你当前数据一致（你库里是 1）
  occurred_at: string; // ISO 字符串
  entity: {
    project_id: string; // 项目
    group_id: string; // 组
    sensor_id: string; // 传感器
  };
  payload: {
    sensorId: string; // 传感器（payload 口径）
    metric: string; // 指标
    ts_ms: number; // 毫秒时间戳
    value: number | null; // 值（NA -> null）
    quality: "ok" | "na"; // 质量标记
    source: "import_caf_v0"; // 来源标记
  };
  meta: {
    source_file: string; // 来源文件名
    line_no: number; // 行号（从 2 开始：1 是表头）
    evidence_line: string; // 原始 TSV 行文本（严格保留）
  };
};

function buildFactJSONText(p: {
  projectId: string;
  groupId: string;
  sensorId: string;
  metric: string;
  tsMs: number;
  value: number | null;
  quality: "ok" | "na";
  sourceFile: string;
  lineNo: number;
  evidenceLine: string;
}): string {
  const occurred_at = new Date(p.tsMs).toISOString(); // 从 ts_ms 生成 occurred_at（UTC Z）

  const fact: RawSampleFact = {
    type: "raw_sample_v1",
    schema_version: 1,
    occurred_at,
    entity: {
      project_id: p.projectId,
      group_id: p.groupId,
      sensor_id: p.sensorId,
    },
    payload: {
      sensorId: p.sensorId,
      metric: p.metric,
      ts_ms: p.tsMs,
      value: p.value,
      quality: p.quality,
      source: "import_caf_v0",
    },
    meta: {
      source_file: p.sourceFile,
      line_no: p.lineNo,
      evidence_line: p.evidenceLine,
    },
  };

  return JSON.stringify(fact); // 注意：这里返回“请求 JSON 文本”，供 facts.record_json 原样保存
}

// ----------------------------------------------------------------------------
// 5) 幂等 fact_id（以 dedupe_key 的 sha1 生成）
// ----------------------------------------------------------------------------

function computeFactId(dedupeKey: string): string {
  // 生成稳定 ID：raw_<sha1>
  const h = crypto.createHash("sha1").update(dedupeKey, "utf8").digest("hex"); // sha1(dedupeKey)
  return `raw_${h}`; // 与你现有 raw_ 前缀保持一致
}

// ----------------------------------------------------------------------------
// 6) 主流程：逐行读取 -> 展开 10 个 metric -> 写入 DB
// ----------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2)); // 解析 CLI 参数

  const dbUrl = process.env.DATABASE_URL ?? ""; // 从环境变量读取数据库连接
  if (!dbUrl) throw new Error("Missing DATABASE_URL"); // 缺少则中止

  const pool = new Pool({ connectionString: dbUrl }); // 创建连接池

  const sourceFile = args.file.split(/[\\/]/).pop() ?? args.file; // 取文件名用于 meta

  // 用 readline 流式读取（适合大文件）
  const rl = readline.createInterface({
    input: fs.createReadStream(args.file, { encoding: "utf8" }), // 以 utf8 读取
    crlfDelay: Infinity, // 兼容 CRLF
  });

  let header: string[] | null = null; // 表头列名
  let lineNo = 0; // 行号计数（含表头）
  let insertedFacts = 0; // 成功插入 facts 的计数
  let skippedDup = 0; // 去重跳过计数
  let badLines = 0; // 无法解析的行计数

  const seen = new Set<string>(); // 文件内去重集合（dedupe_key）

  // 预编译 SQL（避免每次拼接）
  const sqlInsertFacts = `
    insert into facts (fact_id, record_json)
    values ($1, $2)
    on conflict (fact_id) do nothing
  `; // 注意：只写入事实账本，record_json 为“原始 JSON 文本证据”

  const sqlInsertRawSamples = `
    insert into raw_samples (fact_id, sensor_id, metric, ts_ms, value, quality, source)
    values ($1, $2, $3, $4, $5, $6, $7)
    on conflict (fact_id) do nothing
  `; // 可选：若你系统没有自动投影，则写入 raw_samples

  const client = await pool.connect(); // 获取单连接（便于事务/批量）

  try {
    await client.query("begin"); // 开启事务（整批导入原子性；文件太大可改为分段提交）

    for await (const line of rl) {
      lineNo += 1; // 更新行号

      // 跳过空行
      if (!line.trim()) continue; // 空行不处理

      // 表头行
      if (lineNo === 1) {
        header = line.split("\t"); // 读取表头
        continue; // 进入下一行
      }

      if (!header) {
        throw new Error("Missing header"); // 防御：理论上不会发生
      }

      const cols = line.split("\t"); // 拆分 TSV 列
      if (cols.length !== header.length) {
        badLines += 1; // 记录坏行
        continue; // 跳过（不终止）
      }

      const row: Record<string, string> = {}; // 将列映射为对象
      for (let i = 0; i < header.length; i += 1) {
        const k = header[i] ?? ""; // 列名
        row[k] = cols[i] ?? ""; // 列值
      }

      const location = row["Location"] ?? ""; // 传感器/位置
      const dateS = row["Date"] ?? ""; // 日期
      const timeS = row["Time"] ?? ""; // 时间

      if (!location || !dateS || !timeS) {
        badLines += 1; // 必要字段缺失
        continue; // 跳过
      }

      let tsMs = 0; // 毫秒时间戳
      try {
        tsMs = parseTsMsUTC(dateS, timeS); // 解析时间
      } catch {
        badLines += 1; // 时间解析失败
        continue; // 跳过
      }

      // 遍历表头中除 Location/Date/Time 外的所有列（即 10 个指标）
      for (const colName of header) {
        if (colName === "Location" || colName === "Date" || colName === "Time") continue; // 跳过主键列

        const metric = METRIC_MAP[colName]; // 映射为系统 metric
        if (!metric) continue; // 未映射列直接跳过（v0 保守策略）

        const raw = (row[colName] ?? "").trim(); // 原始值
        const isNA = raw === "NA" || raw === "NaN" || raw === ""; // 缺失判定（按实际可扩展）
        const value = isNA ? null : Number(raw); // 解析数值
        const okNumber = value === null ? true : Number.isFinite(value); // 校验数值是否可用

        const quality: "ok" | "na" = isNA || !okNumber ? "na" : "ok"; // 质量标记
        const finalValue: number | null = quality === "ok" ? (value as number) : null; // 非 ok 的一律置空

        // dedupe_key（v0）：Location + ts_ms + metric
        const dedupeKey = `${location}|${tsMs}|${metric}`; // 形成稳定去重键
        if (seen.has(dedupeKey)) {
          skippedDup += 1; // 文件内重复
          continue; // 跳过
        }
        seen.add(dedupeKey); // 记录去重键

        const factId = computeFactId(dedupeKey); // 计算稳定 fact_id

        const recordJsonText = buildFactJSONText({
          projectId: args.projectId,
          groupId: args.groupId,
          sensorId: location,
          metric,
          tsMs,
          value: finalValue,
          quality,
          sourceFile,
          lineNo,
          evidenceLine: line, // 关键：严格保留原行文本证据
        }); // 构造“请求 JSON 文本”

        // 写入 facts（幂等：ON CONFLICT DO NOTHING）
        const r1 = await client.query(sqlInsertFacts, [factId, recordJsonText]); // 插入事实账本
        const inserted = (r1.rowCount ?? 0) > 0; // 判断是否实际插入

        if (inserted) {
          insertedFacts += 1; // 更新计数
        } else {
          skippedDup += 1; // DB 侧已存在（视为重复）
        }

        // 可选：写 raw_samples（如果你的系统没有自动投影）
        if (args.writeRawSamples && inserted) {
          await client.query(sqlInsertRawSamples, [
            factId,
            location,
            metric,
            tsMs,
            finalValue,
            quality,
            "import_caf_v0",
          ]); // 插入投影表
        }
      }
    }

    await client.query("commit"); // 提交事务
  } catch (e) {
    await client.query("rollback"); // 出错则回滚
    throw e; // 抛给上层打印
  } finally {
    client.release(); // 释放连接
    await pool.end(); // 关闭连接池
  }

  console.log(
    JSON.stringify(
      {
        file: args.file,
        inserted_facts: insertedFacts,
        skipped_dup: skippedDup,
        bad_lines: badLines,
        write_raw_samples: args.writeRawSamples,
      },
      null,
      2,
    ),
  ); // 输出导入摘要（便于留档）
}

main().catch((e) => {
  console.error(e); // 打印错误
  process.exit(1); // 非 0 退出码
}); // 入口
