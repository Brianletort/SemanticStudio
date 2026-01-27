-- Add turn_id column to chat_agent_events for per-turn trace retrieval
-- This allows fetching all events for a specific assistant response

ALTER TABLE chat_agent_events
ADD COLUMN turn_id UUID;

-- Index for efficient lookup by turn_id
CREATE INDEX idx_chat_agent_events_turn_id ON chat_agent_events(turn_id);
