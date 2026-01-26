import { OpenAIProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';
import { OllamaProvider } from './providers/ollama';
import { 
  LLMProvider, 
  ProviderName, 
  ChatMessage, 
  ChatOptions, 
  ChatResponse, 
  ModelRole,
  ImageGenerationOptions,
  ImageStreamEvent,
  GeneratedImage,
  DeepResearchOptions,
  DeepResearchResponse,
  DeepResearchStatus,
} from './types';
import { getModelConfig } from './config';

// Provider instances (lazily initialized)
let providers: Map<ProviderName, LLMProvider> | null = null;

function getProviders(): Map<ProviderName, LLMProvider> {
  if (!providers) {
    providers = new Map<ProviderName, LLMProvider>([
      ['openai', new OpenAIProvider()],
      ['anthropic', new AnthropicProvider()],
      ['ollama', new OllamaProvider()],
    ]);
  }
  return providers;
}

export function getProvider(name: ProviderName): LLMProvider {
  const provider = getProviders().get(name);
  if (!provider) {
    throw new Error(`Unknown provider: ${name}`);
  }
  return provider;
}

export async function getProviderStatus(): Promise<Record<ProviderName, boolean>> {
  const providerMap = getProviders();
  const status: Record<ProviderName, boolean> = {
    openai: false,
    anthropic: false,
    ollama: false,
  };

  await Promise.all(
    Array.from(providerMap.entries()).map(async ([name, provider]) => {
      status[name] = await provider.isAvailable();
    })
  );

  return status;
}

// Convenience functions that use model configs

export async function chat(
  role: ModelRole,
  messages: ChatMessage[],
  overrideOptions?: Partial<ChatOptions>
): Promise<ChatResponse> {
  const config = await getModelConfig(role);
  const provider = getProvider(config.provider);
  
  const options: ChatOptions = {
    model: config.modelName,
    ...config.config as ChatOptions,
    ...overrideOptions,
  };

  try {
    return await provider.chat(messages, options);
  } catch (error) {
    // Try fallback if available
    if (config.fallbackProvider && config.fallbackModel) {
      console.warn(`Primary provider ${config.provider} failed, trying fallback ${config.fallbackProvider}`);
      const fallbackProvider = getProvider(config.fallbackProvider);
      return await fallbackProvider.chat(messages, { ...options, model: config.fallbackModel });
    }
    throw error;
  }
}

export async function* streamChat(
  role: ModelRole,
  messages: ChatMessage[],
  overrideOptions?: Partial<ChatOptions>
): AsyncGenerator<string, void, unknown> {
  const config = await getModelConfig(role);
  const provider = getProvider(config.provider);
  
  const options: ChatOptions = {
    model: config.modelName,
    ...config.config as ChatOptions,
    ...overrideOptions,
  };

  yield* provider.streamChat(messages, options);
}

export async function embed(text: string | string[]): Promise<number[][]> {
  const config = await getModelConfig('embeddings');
  const provider = getProvider(config.provider);
  
  return provider.embed(text, {
    model: config.modelName,
    ...config.config as { dimensions?: number },
  });
}

/**
 * Generate an image using the configured provider (non-streaming)
 */
export async function generateImage(
  prompt: string,
  overrideOptions?: Partial<ImageGenerationOptions>
): Promise<GeneratedImage> {
  const config = await getModelConfig('image_generation');
  const provider = getProvider(config.provider);
  
  if (!provider.generateImage) {
    throw new Error(`Provider ${config.provider} does not support image generation`);
  }
  
  const options: ImageGenerationOptions = {
    model: config.modelName as ImageGenerationOptions['model'],
    ...config.config as Partial<ImageGenerationOptions>,
    ...overrideOptions,
  };
  
  return provider.generateImage(prompt, options);
}

/**
 * Stream image generation with partial images
 */
export async function* generateImageStream(
  prompt: string,
  overrideOptions?: Partial<ImageGenerationOptions>
): AsyncGenerator<ImageStreamEvent, void, unknown> {
  const config = await getModelConfig('image_generation');
  const provider = getProvider(config.provider);
  
  if (!provider.generateImageStream) {
    throw new Error(`Provider ${config.provider} does not support streaming image generation`);
  }
  
  const options: ImageGenerationOptions = {
    model: config.modelName as ImageGenerationOptions['model'],
    ...config.config as Partial<ImageGenerationOptions>,
    ...overrideOptions,
  };
  
  yield* provider.generateImageStream(prompt, options);
}

/**
 * Upload a file for use in image editing
 */
export async function uploadImageFile(
  file: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const config = await getModelConfig('image_generation');
  const provider = getProvider(config.provider);
  
  if (!provider.uploadFile) {
    throw new Error(`Provider ${config.provider} does not support file uploads`);
  }
  
  return provider.uploadFile(file, filename, mimeType);
}

/**
 * Start a deep research job using o3-deep-research model
 * Uses background mode for long-running requests (can take 20-30 minutes)
 * 
 * @param input - The research query/topic
 * @param options - Deep research options
 * @returns Response with job ID and initial status
 */
export async function deepResearch(
  input: string,
  options: DeepResearchOptions = {}
): Promise<DeepResearchResponse> {
  const config = await getModelConfig('research');
  const provider = getProvider(config.provider);
  
  if (!provider.deepResearch) {
    throw new Error(`Provider ${config.provider} does not support deep research`);
  }
  
  // Merge config options with provided options
  const mergedOptions: DeepResearchOptions = {
    ...options,
    instructions: options.instructions || (config.config as { instructions?: string })?.instructions,
  };
  
  return provider.deepResearch(input, mergedOptions);
}

/**
 * Get the status of a deep research job
 * Use this to poll for completion of background research jobs
 * 
 * @param responseId - The response ID from deepResearch()
 * @returns Current status and any available output
 */
export async function getDeepResearchStatus(
  responseId: string
): Promise<DeepResearchStatus> {
  const config = await getModelConfig('research');
  const provider = getProvider(config.provider);
  
  if (!provider.getResponseStatus) {
    throw new Error(`Provider ${config.provider} does not support response status checking`);
  }
  
  return provider.getResponseStatus(responseId);
}

// Re-export types
export * from './types';
export * from './config';
