-- Add prompt library table for user and system prompts/templates
CREATE TABLE IF NOT EXISTS prompt_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  is_system BOOLEAN DEFAULT FALSE,
  is_edited BOOLEAN DEFAULT FALSE,
  system_prompt_id UUID,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_prompt_library_user_id ON prompt_library(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_library_category ON prompt_library(category);
CREATE INDEX IF NOT EXISTS idx_prompt_library_is_system ON prompt_library(is_system);

-- Insert default system prompts
INSERT INTO prompt_library (title, content, category, is_system, display_order) VALUES
  -- Getting Started
  ('Explain this data', 'Explain how the data in {{table_or_topic}} relates to my business goals.', 'getting_started', TRUE, 1),
  ('Quick insights', 'What are the key insights you can provide about {{topic}}?', 'getting_started', TRUE, 2),
  ('Data overview', 'Give me an overview of the available data and what questions I can ask.', 'getting_started', TRUE, 3),
  
  -- Analysis
  ('Compare items', 'Compare {{item_A}} with {{item_B}} and highlight the key differences.', 'analysis', TRUE, 10),
  ('Trend analysis', 'Show me the trends for {{metric}} over the past {{timeframe}}.', 'analysis', TRUE, 11),
  ('Top performers', 'What are the top {{number}} {{items}} by {{metric}}?', 'analysis', TRUE, 12),
  ('Anomaly detection', 'Are there any unusual patterns or anomalies in {{dataset_or_metric}}?', 'analysis', TRUE, 13),
  
  -- Reporting
  ('Summary report', 'Create a summary report of {{topic}} including key metrics and insights.', 'reporting', TRUE, 20),
  ('Performance review', 'Generate a performance review for {{entity}} covering {{time_period}}.', 'reporting', TRUE, 21),
  ('Export data', 'Provide the data for {{query}} in a format I can export.', 'reporting', TRUE, 22),
  
  -- Research
  ('Deep dive', 'Do a deep dive analysis on {{topic}} and explain the findings.', 'research', TRUE, 30),
  ('Correlation analysis', 'What factors correlate with {{outcome_or_metric}}?', 'research', TRUE, 31),
  ('Forecast', 'Based on historical data, what can we forecast for {{metric}} in {{future_period}}?', 'research', TRUE, 32),
  
  -- General (practical everyday prompts)
  ('Explain like I''m 5', 'Explain {{concept}} in simple terms that anyone could understand.', 'general', TRUE, 40),
  ('Action items', 'Based on {{context}}, what are the key action items I should focus on?', 'general', TRUE, 41),
  ('Quick summary', 'Give me a brief summary of {{topic}} in 3 bullet points.', 'general', TRUE, 42);
