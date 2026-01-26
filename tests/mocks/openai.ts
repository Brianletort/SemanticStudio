import { vi } from 'vitest';

// Sample base64 encoded image (1x1 transparent PNG for testing)
export const MOCK_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Mock image generation response
export const mockImageGenerationResponse = {
  data: [{
    url: undefined,
    b64_json: MOCK_IMAGE_BASE64,
    revised_prompt: 'A beautiful red circle on a pristine white background',
  }],
};

// Mock image edit response
export const mockImageEditResponse = {
  data: [{
    url: undefined,
    b64_json: MOCK_IMAGE_BASE64,
    revised_prompt: 'Edited image with applied changes',
  }],
};

// Mock file upload response
export const mockFileUploadResponse = {
  id: 'file-abc123',
  object: 'file',
  bytes: 12345,
  created_at: Date.now(),
  filename: 'test-image.png',
  purpose: 'vision',
};

// Mock chat completion response
export const mockChatCompletionResponse = {
  id: 'chatcmpl-test123',
  object: 'chat.completion',
  created: Date.now(),
  model: 'gpt-5-mini',
  choices: [{
    index: 0,
    message: {
      role: 'assistant' as const,
      content: 'This is a test response from the mock.',
    },
    finish_reason: 'stop',
  }],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 15,
    total_tokens: 25,
  },
};

// Mock models list response
export const mockModelsListResponse = {
  data: [
    { id: 'gpt-5-mini', object: 'model' },
    { id: 'gpt-image-1.5', object: 'model' },
    { id: 'text-embedding-3-large', object: 'model' },
  ],
};

// Create a mock OpenAI client
export function createMockOpenAIClient() {
  return {
    images: {
      generate: vi.fn().mockResolvedValue(mockImageGenerationResponse),
      edit: vi.fn().mockResolvedValue(mockImageEditResponse),
    },
    files: {
      create: vi.fn().mockResolvedValue(mockFileUploadResponse),
    },
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue(mockChatCompletionResponse),
      },
    },
    models: {
      list: vi.fn().mockResolvedValue(mockModelsListResponse),
    },
    embeddings: {
      create: vi.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }],
      }),
    },
  };
}

// Type for the mock client
export type MockOpenAIClient = ReturnType<typeof createMockOpenAIClient>;
