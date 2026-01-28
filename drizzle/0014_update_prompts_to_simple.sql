-- Update prompt library to use simple, non-parameterized prompts
-- This removes the {{variable}} templates and replaces with simple prompts

-- Delete existing system prompts (user prompts are preserved)
DELETE FROM prompt_library WHERE is_system = TRUE AND user_id IS NULL;

-- Insert new simple system prompts
INSERT INTO prompt_library (title, content, category, is_system, display_order) VALUES
  -- Data & Insights
  ('Data Overview', 'Give me an overview of the available data and what questions I can ask.', 'general', TRUE, 1),
  ('Key Insights', 'What are the key insights from the data? Highlight anything important or unusual.', 'general', TRUE, 2),
  ('Recent Trends', 'What are the recent trends? Are things improving or declining?', 'general', TRUE, 3),
  ('Top Performers', 'What are the top performers? Show me the best results.', 'general', TRUE, 4),
  ('Areas of Concern', 'Are there any areas of concern or things I should pay attention to?', 'general', TRUE, 5),
  
  -- Analysis
  ('Summarize This', 'Summarize the most important points in a clear, concise format.', 'general', TRUE, 10),
  ('Explain This', 'Can you explain this in simple terms? Break it down for me.', 'general', TRUE, 11),
  ('What Should I Do?', 'Based on this information, what actions should I consider taking?', 'general', TRUE, 12),
  ('Deep Dive', 'Give me a detailed analysis. I want to understand this thoroughly.', 'general', TRUE, 13),
  ('Quick Summary', 'Give me a quick 3-bullet summary of the key points.', 'general', TRUE, 14);
