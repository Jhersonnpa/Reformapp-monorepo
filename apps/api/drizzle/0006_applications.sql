CREATE TABLE IF NOT EXISTS request_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  tech_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, tech_id)
);
CREATE INDEX IF NOT EXISTS request_applications_request_idx ON request_applications(request_id);
