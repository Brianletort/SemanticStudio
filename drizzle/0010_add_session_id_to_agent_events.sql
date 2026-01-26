-- Add sessionId column to chat_agent_events table for historical trace retrieval
-- This allows loading traces for a specific session

ALTER TABLE chat_agent_events
ADD COLUMN session_id UUID REFERENCES sessions(id) ON DELETE CASCADE;

-- Create index for efficient session-based queries
CREATE INDEX IF NOT EXISTS idx_chat_agent_events_session_id ON chat_agent_events(session_id);
