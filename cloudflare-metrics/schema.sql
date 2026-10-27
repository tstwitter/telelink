CREATE TABLE IF NOT EXISTS click_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot TEXT NOT NULL,
  src TEXT,
  occurred_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_click_events_time
ON click_events (occurred_at);

CREATE INDEX IF NOT EXISTS idx_click_events_bot_time
ON click_events (bot, occurred_at);
