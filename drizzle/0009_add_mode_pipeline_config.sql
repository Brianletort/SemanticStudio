-- Add mode and pipeline configuration fields to user_settings
-- These fields allow users to customize chat mode behavior

-- Add modeConfigOverrides column (JSON for per-mode settings)
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS mode_config_overrides JSONB DEFAULT NULL;

-- Add memoryTierConfig column (JSON for memory tier settings)
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS memory_tier_config JSONB DEFAULT '{"tier1WorkingContext": true, "tier2SessionMemory": true, "tier3LongTermMemory": true}'::jsonb;

-- Add pipelineConfig column (JSON for pipeline settings)
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS pipeline_config JSONB DEFAULT '{"enableReflection": true, "enableClarification": true, "showEvaluationInChat": true, "autoModeDefault": "think"}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN user_settings.mode_config_overrides IS 'Per-mode configuration overrides (maxResults, graphHops, webResultsIfEnabled per mode)';
COMMENT ON COLUMN user_settings.memory_tier_config IS 'Memory tier configuration (tier1WorkingContext, tier2SessionMemory, tier3LongTermMemory)';
COMMENT ON COLUMN user_settings.pipeline_config IS 'Pipeline configuration (enableReflection, enableClarification, showEvaluationInChat, autoModeDefault)';
