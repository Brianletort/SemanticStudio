import { db, modelConfigs } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ModelRole, ModelConfigRecord, ProviderName } from './types';

// Cache for model configs to avoid repeated DB queries
const configCache = new Map<ModelRole, ModelConfigRecord>();
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute

export async function getModelConfig(role: ModelRole): Promise<ModelConfigRecord> {
  const now = Date.now();
  
  // Check cache
  if (now - cacheTimestamp < CACHE_TTL && configCache.has(role)) {
    return configCache.get(role)!;
  }

  try {
    const result = await db.select().from(modelConfigs).where(eq(modelConfigs.role, role)).limit(1);
    
    if (result.length > 0) {
      const config: ModelConfigRecord = {
        role: result[0].role as ModelRole,
        provider: result[0].provider as ProviderName,
        modelName: result[0].modelName,
        config: result[0].config as Record<string, unknown>,
        fallbackProvider: result[0].fallbackProvider as ProviderName | undefined,
        fallbackModel: result[0].fallbackModel || undefined,
      };
      
      configCache.set(role, config);
      cacheTimestamp = now;
      return config;
    }
  } catch (error) {
    console.error(`Failed to fetch model config for ${role}:`, error);
  }

  // Return defaults if DB is not available
  return getDefaultConfig(role);
}

export async function getAllModelConfigs(): Promise<ModelConfigRecord[]> {
  try {
    const results = await db.select().from(modelConfigs);
    return results.map(r => ({
      role: r.role as ModelRole,
      provider: r.provider as ProviderName,
      modelName: r.modelName,
      config: r.config as Record<string, unknown>,
      fallbackProvider: r.fallbackProvider as ProviderName | undefined,
      fallbackModel: r.fallbackModel || undefined,
    }));
  } catch {
    // Return defaults if DB is not available
    return Object.keys(DEFAULT_CONFIGS).map(role => getDefaultConfig(role as ModelRole));
  }
}

export async function updateModelConfig(
  role: ModelRole,
  updates: Partial<Omit<ModelConfigRecord, 'role'>>
): Promise<ModelConfigRecord> {
  const result = await db
    .update(modelConfigs)
    .set({
      provider: updates.provider,
      modelName: updates.modelName,
      config: updates.config,
      fallbackProvider: updates.fallbackProvider,
      fallbackModel: updates.fallbackModel,
      updatedAt: new Date(),
    })
    .where(eq(modelConfigs.role, role))
    .returning();

  // Clear cache
  configCache.delete(role);

  if (result.length === 0) {
    throw new Error(`Model config for role ${role} not found`);
  }

  return {
    role: result[0].role as ModelRole,
    provider: result[0].provider as ProviderName,
    modelName: result[0].modelName,
    config: result[0].config as Record<string, unknown>,
    fallbackProvider: result[0].fallbackProvider as ProviderName | undefined,
    fallbackModel: result[0].fallbackModel || undefined,
  };
}

export function clearConfigCache(): void {
  configCache.clear();
  cacheTimestamp = 0;
}

// Default configurations (used when DB is not available)
// GPT-5.2 series models:
// - gpt-5.2: Main reasoning model (standard tasks)
// - gpt-5.2-pro: Complex reasoning (deep mode)
// - gpt-5-mini: Cost-optimized (quick tasks, background operations)
// - o3-deep-research: Research mode (long-form analysis)
const DEFAULT_CONFIGS: Record<ModelRole, Omit<ModelConfigRecord, 'role'>> = {
  composer: {
    provider: 'openai',
    modelName: 'gpt-5.2',
    config: { temperature: 0.7, maxTokens: 4096 },
  },
  composer_fast: {
    provider: 'openai',
    modelName: 'gpt-5-mini',
    config: { temperature: 0.7, maxTokens: 2048 },
  },
  planner: {
    provider: 'openai',
    modelName: 'gpt-5-mini',
    config: { temperature: 0.3, maxTokens: 1024 },
  },
  reflection: {
    provider: 'openai',
    modelName: 'gpt-5.2',
    config: { temperature: 0.5, maxTokens: 2048 },
  },
  mode_classifier: {
    provider: 'openai',
    modelName: 'gpt-5-mini',
    config: { temperature: 0.1, maxTokens: 256 },
  },
  memory_extractor: {
    provider: 'openai',
    modelName: 'gpt-5-mini',
    config: { temperature: 0.3, maxTokens: 1024 },
  },
  embeddings: {
    provider: 'openai',
    modelName: 'text-embedding-3-large',
    config: { dimensions: 1536 },
  },
  image_generation: {
    provider: 'openai',
    modelName: 'gpt-image-1.5',
    config: { 
      quality: 'medium',
      size: '1024x1024',
      background: 'opaque',
      partialImages: 2,
      outputFormat: 'png',
    },
  },
  research: {
    provider: 'openai',
    modelName: 'o3-deep-research',
    config: { temperature: 0.7, maxTokens: 16384 },
  },
};

function getDefaultConfig(role: ModelRole): ModelConfigRecord {
  const defaults = DEFAULT_CONFIGS[role];
  return {
    role,
    ...defaults,
  };
}
