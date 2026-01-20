-- CAF 导入最小验收 SQL（v0）
-- 用法示例：
-- docker exec -i geox-postgres psql -U landos -d landos -f sql/caf_import_acceptance.sql

\echo '1) 目标传感器总量/时间范围（raw_samples）'
select
  sensor_id,
  count(*) as n_samples,
  min(ts_ms) as min_ts_ms,
  to_char(to_timestamp(min(ts_ms)/1000.0) at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') as min_utc,
  max(ts_ms) as max_ts_ms,
  to_char(to_timestamp(max(ts_ms)/1000.0) at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') as max_utc
from raw_samples
where sensor_id in ('CAF003','CAF009')
group by sensor_id
order by sensor_id;

\echo '2) 每个 metric 的点数与空值（raw_samples）'
select
  sensor_id,
  metric,
  count(*) as n,
  sum(case when value is null then 1 else 0 end) as n_null,
  min(ts_ms) as min_ts_ms,
  max(ts_ms) as max_ts_ms
from raw_samples
where sensor_id in ('CAF003','CAF009')
group by sensor_id, metric
order by sensor_id, metric;

\echo '3) 时间戳去重后的完整性估计（每个 ts 期望 10 个 metric）'
with t as (
  select sensor_id, ts_ms
  from raw_samples
  where sensor_id in ('CAF003','CAF009')
  group by sensor_id, ts_ms
),
n_time as (
  select sensor_id, count(*) as n_timestamps
  from t
  group by sensor_id
),
n_rows as (
  select sensor_id, count(*) as n_samples
  from raw_samples
  where sensor_id in ('CAF003','CAF009')
  group by sensor_id
)
select
  n_rows.sensor_id,
  n_time.n_timestamps,
  n_rows.n_samples,
  (n_time.n_timestamps * 10) as expected_samples_if_full,
  round(100.0 * n_rows.n_samples / nullif(n_time.n_timestamps * 10.0, 0), 2) as pct_present,
  round(100.0 * (1.0 - n_rows.n_samples / nullif(n_time.n_timestamps * 10.0, 0)), 2) as pct_missing_est
from n_rows
join n_time using (sensor_id)
order by sensor_id;

\echo '4) 长连续覆盖窗口（按 sensor_id 分段）'
-- 规则：dt > 2*60000 视为断点（这里假设期望间隔 60s）
with s as (
  select sensor_id, ts_ms,
         ts_ms - lag(ts_ms) over (partition by sensor_id order by ts_ms) as dt
  from (
    select sensor_id, ts_ms
    from raw_samples
    where sensor_id in ('CAF003','CAF009')
    group by sensor_id, ts_ms
  ) x
),
g as (
  select
    sensor_id,
    ts_ms,
    sum(case when dt is null or dt > 2*60000 then 1 else 0 end)
      over (partition by sensor_id order by ts_ms) as grp
  from s
)
select
  sensor_id,
  min(ts_ms) as start_ts_ms,
  to_char(to_timestamp(min(ts_ms)/1000.0) at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') as start_utc,
  max(ts_ms) as end_ts_ms,
  to_char(to_timestamp(max(ts_ms)/1000.0) at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') as end_utc,
  count(*) as n_timestamps,
  (count(*) * 10) as expected_samples_if_full
from g
group by sensor_id, grp
order by sensor_id, n_timestamps desc
limit 20;

\echo '5) 证据保留：facts 中是否包含 source_line_text（导入数据）'
select
  count(*) as n_with_source_line_text
from facts
where record_json like '%"type":"raw_sample_v1"%'
  and record_json like '%"source_line_text"%'
  and (record_json like '%"sensor_id":"CAF003"%' or record_json like '%"sensor_id":"CAF009"%');
