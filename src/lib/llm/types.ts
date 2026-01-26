export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  responseFormat?: 'text' | 'json';
}

export interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
}

// Image generation types for Responses API
export type ImageQuality = 'low' | 'medium' | 'high' | 'auto';
export type ImageSize = '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
export type ImageAction = 'auto' | 'generate' | 'edit';
export type ImageBackground = 'transparent' | 'opaque' | 'auto';
export type ImageModel = 'gpt-image-1.5' | 'gpt-image-1' | 'gpt-image-1-mini';
export type ImageOutputFormat = 'png' | 'jpeg' | 'webp';

export interface ImageGenerationOptions {
  model?: ImageModel;
  quality?: ImageQuality;
  size?: ImageSize;
  action?: ImageAction;
  background?: ImageBackground;
  inputFidelity?: 'low' | 'high';
  partialImages?: 0 | 1 | 2 | 3;
  inputImages?: ImageInput[]; // File IDs, URLs, or base64
  mask?: ImageInput; // For inpainting
  outputFormat?: ImageOutputFormat;
  outputCompression?: number; // 0-100 for jpeg/webp
}

export interface ImageInput {
  type: 'file_id' | 'url' | 'base64';
  value: string;
  mimeType?: string;
}

export interface GeneratedImage {
  imageBase64: string;
  revisedPrompt?: string;
  action?: 'generate' | 'edit';
  size?: ImageSize;
  quality?: ImageQuality;
  background?: ImageBackground;
}

// Legacy interface for backward compatibility
export interface LegacyGeneratedImage {
  url: string;
  revisedPrompt?: string;
}

export interface ImageStreamEvent {
  type: 'partial' | 'complete' | 'progress' | 'error';
  partialImageIndex?: number;
  imageBase64?: string;
  progress?: number; // 0-100 estimated progress
  revisedPrompt?: string;
  action?: 'generate' | 'edit';
  error?: string;
}

export interface ImageGenerationResult {
  success: boolean;
  image?: GeneratedImage;
  error?: string;
  durationMs?: number;
}

export interface LLMProvider {
  name: string;
  
  // Chat completion
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
  
  // Streaming chat
  streamChat(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<string, void, unknown>;
  
  // Embeddings
  embed(text: string | string[], options?: EmbeddingOptions): Promise<number[][]>;
  
  // Image generation (optional - not all providers support this)
  generateImage?(prompt: string, options?: ImageGenerationOptions): Promise<GeneratedImage>;
  
  // Streaming image generation with partial images (optional)
  generateImageStream?(
    prompt: string,
    options?: ImageGenerationOptions
  ): AsyncGenerator<ImageStreamEvent, void, unknown>;
  
  // Upload file to provider for image editing (optional)
  uploadFile?(file: Buffer, filename: string, mimeType: string): Promise<string>; // Returns file ID
  
  // Check if provider is available
  isAvailable(): Promise<boolean>;
  
  // List available models
  listModels?(): Promise<string[]>;
}

export type ProviderName = 'openai' | 'anthropic' | 'ollama';

export type ModelRole = 
  | 'composer'
  | 'composer_fast'
  | 'planner'
  | 'reflection'
  | 'mode_classifier'
  | 'memory_extractor'
  | 'embeddings'
  | 'image_generation'
  | 'research';

export interface ModelConfigRecord {
  role: ModelRole;
  provider: ProviderName;
  modelName: string;
  config: Record<string, unknown>;
  fallbackProvider?: ProviderName;
  fallbackModel?: string;
}
