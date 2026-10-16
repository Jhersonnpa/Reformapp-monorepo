ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_status_check;
ALTER TABLE service_requests ADD CONSTRAINT service_requests_status_check
  CHECK (status IN ('OPEN','ACCEPTED','DONE','CANCELLED'));
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS service_requests_open_idx ON service_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS service_requests_accepted_idx ON service_requests(accepted_by, created_at DESC);
