-- B-Line P0 formal Field Memory provenance repair.
-- Confidence is evidence-derived data. Missing confidence must remain unknown;
-- the database must not fabricate 0.8 and must not force callers to invent a number.
--
-- Historical rows are intentionally not rewritten: an existing 0.8 may be either
-- an explicit historical value or the former default, and this migration cannot
-- distinguish those provenances safely.

ALTER TABLE field_memory_v1
  ALTER COLUMN confidence DROP DEFAULT,
  ALTER COLUMN confidence DROP NOT NULL;
