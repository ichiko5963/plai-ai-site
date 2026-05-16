-- D1 schema for PLai contact form submissions
-- Apply with: wrangler d1 migrations apply plai-submissions --remote

CREATE TABLE IF NOT EXISTS contacts (
  id              TEXT     PRIMARY KEY,
  name            TEXT     NOT NULL,
  company         TEXT,
  email           TEXT     NOT NULL,
  phone           TEXT,
  services        TEXT,
  budget          TEXT,
  message         TEXT     NOT NULL,
  candidate_slots TEXT,
  ip              TEXT,
  user_agent      TEXT,
  status          TEXT     NOT NULL DEFAULT 'new',
  notified        INTEGER  NOT NULL DEFAULT 0,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contacts_email      ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_status     ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);
