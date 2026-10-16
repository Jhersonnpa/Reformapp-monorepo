CREATE TABLE IF NOT EXISTS service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('PLUMBING','ELECTRICAL','CLIMATE','MASONRY','PAINTING','CARPENTRY','OTHER')),
  description TEXT NOT NULL,
  province TEXT NOT NULL,
  locality TEXT NOT NULL,
  address TEXT NOT NULL,
  availability TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_requests_user_idx ON service_requests(user_id, created_at DESC);
