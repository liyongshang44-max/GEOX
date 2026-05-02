-- Ensure legacy BIGINT created_at is converted to TIMESTAMPTZ with default now()
DO $$
DECLARE t regtype;
BEGIN
  SELECT atttypid::regtype INTO t
  FROM pg_attribute
  WHERE attrelid = 'field_memory_v1'::regclass AND attname = 'created_at' AND NOT attisdropped;

  IF t::text IN ('bigint','integer','numeric') THEN
    ALTER TABLE field_memory_v1 RENAME COLUMN created_at TO created_at_legacy_ms;
    ALTER TABLE field_memory_v1 ADD COLUMN created_at TIMESTAMPTZ;
    UPDATE field_memory_v1
      SET created_at = COALESCE(to_timestamp(created_at_legacy_ms::double precision / 1000.0), now())
      WHERE created_at IS NULL;
    ALTER TABLE field_memory_v1 ALTER COLUMN created_at SET DEFAULT now();
    ALTER TABLE field_memory_v1 ALTER COLUMN created_at SET NOT NULL;
  ELSE
    ALTER TABLE field_memory_v1 ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;
    ALTER TABLE field_memory_v1 ALTER COLUMN created_at SET DEFAULT now();
    ALTER TABLE field_memory_v1 ALTER COLUMN created_at SET NOT NULL;
  END IF;
END $$;
