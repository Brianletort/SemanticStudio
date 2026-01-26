import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userSettings, modelConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  DEFAULT_MODE_CONFIGS,
  DEFAULT_MEMORY_TIER_CONFIG,
  DEFAULT_PIPELINE_CONFIG,
  getModeConfig,
  validateModeConfig,
  getModeDescription,
  type ModeConfig,
  type ModeSettingsOverrides,
  type MemoryTierConfig,
  type PipelineConfig,
} from "@/lib/chat/mode-config";

// Default user ID for development
const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

// Response type for the API
interface ModeConfigResponse {
  modes: {
    quick: ModeConfigWithMeta;
    think: ModeConfigWithMeta;
    deep: ModeConfigWithMeta;
    research: ModeConfigWithMeta;
  };
  globalSettings: {
    memoryTierConfig: MemoryTierConfig;
    pipelineConfig: PipelineConfig;
  };
  defaults: {
    modes: typeof DEFAULT_MODE_CONFIGS;
    memoryTierConfig: MemoryTierConfig;
    pipelineConfig: PipelineConfig;
  };
  availableModels: Array<{ role: string; modelName: string; provider: string }>;
}

interface ModeConfigWithMeta extends ModeConfig {
  description: string;
  isModified: boolean;
}

/**
 * GET /api/admin/mode-config
 * Returns current mode configurations (defaults + user overrides)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || DEV_USER_ID;

    // Fetch user settings
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    // Parse overrides from settings
    const modeOverrides = (settings?.modeConfigOverrides as ModeSettingsOverrides) || {};
    const memoryTierConfig = (settings?.memoryTierConfig as MemoryTierConfig) || DEFAULT_MEMORY_TIER_CONFIG;
    const pipelineConfig = (settings?.pipelineConfig as PipelineConfig) || DEFAULT_PIPELINE_CONFIG;

    // Fetch available model roles
    const models = await db
      .select({
        role: modelConfigs.role,
        modelName: modelConfigs.modelName,
        provider: modelConfigs.provider,
      })
      .from(modelConfigs)
      .where(eq(modelConfigs.isActive, true));

    // Build response for each mode
    const modes = {
      quick: buildModeResponse('quick', modeOverrides),
      think: buildModeResponse('think', modeOverrides),
      deep: buildModeResponse('deep', modeOverrides),
      research: buildModeResponse('research', modeOverrides),
    };

    const response: ModeConfigResponse = {
      modes,
      globalSettings: {
        memoryTierConfig,
        pipelineConfig,
      },
      defaults: {
        modes: DEFAULT_MODE_CONFIGS,
        memoryTierConfig: DEFAULT_MEMORY_TIER_CONFIG,
        pipelineConfig: DEFAULT_PIPELINE_CONFIG,
      },
      availableModels: models,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch mode config:", error);
    return NextResponse.json(
      { error: "Failed to fetch mode configuration" },
      { status: 500 }
    );
  }
}

/**
 * Build mode response with metadata
 */
function buildModeResponse(
  mode: 'quick' | 'think' | 'deep' | 'research',
  overrides: ModeSettingsOverrides
): ModeConfigWithMeta {
  const config = getModeConfig(mode, overrides[mode]);
  const defaults = DEFAULT_MODE_CONFIGS[mode];
  
  // Check if any values differ from defaults
  const isModified = Object.keys(overrides[mode] || {}).length > 0;

  return {
    ...config,
    description: getModeDescription(mode),
    isModified,
  };
}

/**
 * POST /api/admin/mode-config
 * Saves mode configuration overrides
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || DEV_USER_ID;
    const body = await request.json();

    const {
      modeOverrides,
      memoryTierConfig,
      pipelineConfig,
    }: {
      modeOverrides?: ModeSettingsOverrides;
      memoryTierConfig?: Partial<MemoryTierConfig>;
      pipelineConfig?: Partial<PipelineConfig>;
    } = body;

    // Validate mode overrides
    if (modeOverrides) {
      const modes = ['quick', 'think', 'deep', 'research'] as const;
      for (const mode of modes) {
        if (modeOverrides[mode]) {
          const validation = validateModeConfig(modeOverrides[mode]!);
          if (!validation.valid) {
            return NextResponse.json(
              { error: `Invalid ${mode} config: ${validation.errors.join(', ')}` },
              { status: 400 }
            );
          }
        }
      }
    }

    // Check if user settings exist
    const [existing] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (existing) {
      // Update existing settings
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (modeOverrides !== undefined) {
        updateData.modeConfigOverrides = modeOverrides;
      }
      if (memoryTierConfig !== undefined) {
        updateData.memoryTierConfig = {
          ...DEFAULT_MEMORY_TIER_CONFIG,
          ...memoryTierConfig,
        };
      }
      if (pipelineConfig !== undefined) {
        updateData.pipelineConfig = {
          ...DEFAULT_PIPELINE_CONFIG,
          ...pipelineConfig,
        };
      }

      await db
        .update(userSettings)
        .set(updateData)
        .where(eq(userSettings.userId, userId));
    } else {
      // Create new settings
      await db.insert(userSettings).values({
        userId,
        modeConfigOverrides: modeOverrides || null,
        memoryTierConfig: memoryTierConfig 
          ? { ...DEFAULT_MEMORY_TIER_CONFIG, ...memoryTierConfig }
          : DEFAULT_MEMORY_TIER_CONFIG,
        pipelineConfig: pipelineConfig
          ? { ...DEFAULT_PIPELINE_CONFIG, ...pipelineConfig }
          : DEFAULT_PIPELINE_CONFIG,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save mode config:", error);
    return NextResponse.json(
      { error: "Failed to save mode configuration" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/mode-config
 * Resets mode configuration to defaults
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || DEV_USER_ID;

    await db
      .update(userSettings)
      .set({
        modeConfigOverrides: null,
        memoryTierConfig: DEFAULT_MEMORY_TIER_CONFIG,
        pipelineConfig: DEFAULT_PIPELINE_CONFIG,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to reset mode config:", error);
    return NextResponse.json(
      { error: "Failed to reset mode configuration" },
      { status: 500 }
    );
  }
}
