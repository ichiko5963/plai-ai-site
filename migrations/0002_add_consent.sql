-- Add consent column to submissions
ALTER TABLE submissions ADD COLUMN consent_newsletter INTEGER NOT NULL DEFAULT 1;
