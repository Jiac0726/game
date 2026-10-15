-- 001: flyingRoom authoritative state stored as JSONB in CloudBase PostgreSQL.
-- Execute once in CloudBase SQL editor against the SAME database used by PGDATABASE.
-- Do not create this in NoSQL. No existing application table is dropped.
BEGIN;
CREATE TABLE IF NOT EXISTS public.flying_rooms (
  room_id VARCHAR(32) PRIMARY KEY
    CHECK (room_id ~ '^[a-f0-9]{32}$'),
  state JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flying_rooms_expires_at_idx
  ON public.flying_rooms (expires_at);

-- Deny access to any API client role by default. Table owner (cloud function
-- connection) remains able to read/write; see README for a separate service role.
ALTER TABLE public.flying_rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.flying_rooms FROM PUBLIC;
COMMIT;

-- Verify after running (read only):
-- SELECT to_regclass('public.flying_rooms') AS flying_rooms_table;
-- SELECT relrowsecurity FROM pg_class WHERE oid='public.flying_rooms'::regclass;
