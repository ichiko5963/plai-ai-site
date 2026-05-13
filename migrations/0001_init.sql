-- D1 schema for PLai submissions (free gift / article gate)
-- Apply with: wrangler d1 migrations apply plai-submissions

CREATE TABLE IF NOT EXISTS submissions (
  id          TEXT     PRIMARY KEY,
  email       TEXT     NOT NULL,
  name        TEXT     NOT NULL,
  company     TEXT,
  position    TEXT,
  gift_type   TEXT     NOT NULL CHECK(gift_type IN ('article_continue','obsidian_vault')),
  source_path TEXT,
  ip          TEXT,
  user_agent  TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_submissions_email      ON submissions(email);
CREATE INDEX IF NOT EXISTS idx_submissions_gift_type  ON submissions(gift_type);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);
