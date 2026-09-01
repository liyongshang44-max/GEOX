-- B-Line Formal Field Memory provenance closure.
-- Missing confidence is unknown; it must never be converted into an authoritative numeric default.
ALTER TABLE field_memory_v1
  ALTER COLUMN confidence DROP DEFAULT,
  ALTER COLUMN confidence DROP NOT NULL;
