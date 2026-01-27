-- Migration: Add progressive summarization columns to messages table
-- These columns support memory management by compressing older messages

-- Add compression_level column
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS compression_level TEXT DEFAULT 'full' 
CHECK (compression_level IN ('full', 'compressed', 'archived'));

-- Add compressed_content column for summarized versions
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS compressed_content TEXT;

-- Add token_count column for budget management
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS token_count INTEGER;
