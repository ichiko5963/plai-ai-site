-- Newsletter send log
CREATE TABLE IF NOT EXISTS newsletter_sends (
  id TEXT PRIMARY KEY,
  campaign_slug TEXT NOT NULL,
  subject TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  resend_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT,
  preview INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_newsletter_sends_campaign ON newsletter_sends(campaign_slug);
CREATE INDEX IF NOT EXISTS idx_newsletter_sends_recipient ON newsletter_sends(recipient_email);
CREATE INDEX IF NOT EXISTS idx_newsletter_sends_sent_at ON newsletter_sends(sent_at DESC);
