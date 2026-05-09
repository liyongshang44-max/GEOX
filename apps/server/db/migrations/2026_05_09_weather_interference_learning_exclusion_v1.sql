ALTER TABLE field_memory_v1
  ADD COLUMN IF NOT EXISTS weather_interference_detected boolean,
  ADD COLUMN IF NOT EXISTS learning_excluded_reason text;

ALTER TABLE agronomy_rule_performance
  ADD COLUMN IF NOT EXISTS weather_interference_detected boolean,
  ADD COLUMN IF NOT EXISTS learning_excluded_reason text;
