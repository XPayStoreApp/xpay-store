ALTER TABLE deposits
ADD COLUMN IF NOT EXISTS telegram_message_id INTEGER;
