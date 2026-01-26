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

// Mock chat completion response (legacy - for backward compatibility)
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

// ============================================
// RESPONSES API MOCKS (New)
// ============================================

// Mock Responses API response
export const mockResponsesResponse = {
  id: 'resp-test123',
  object: 'response',
  status: 'completed' as const,
  model: 'gpt-5-mini',
  output_text: 'This is a test response from the Responses API.',
  output: [
    {
      type: 'message',
      content: [{
        type: 'output_text',
        text: 'This is a test response from the Responses API.',
      }],
    },
  ],
  usage: {
    input_tokens: 10,
    output_tokens: 15,
    total_tokens: 25,
  },
};

// Mock deep research response (initial - in_progress)
export const mockDeepResearchResponse = {
  id: 'resp-research-123',
  object: 'response',
  status: 'in_progress' as const,
  model: 'o3-deep-research',
  output_text: undefined,
  output: [],
};

// Mock deep research status - in progress with sources
export const mockDeepResearchInProgress = {
  id: 'resp-research-123',
  object: 'response',
  status: 'in_progress' as const,
  model: 'o3-deep-research',
  output_text: undefined,
  output: [
    {
      type: 'web_search_call',
      action: { type: 'search', query: 'test research query' },
      status: 'completed',
    },
    {
      type: 'web_search_call',
      action: { type: 'open_page', url: 'https://example.com' },
      status: 'completed',
    },
  ],
};

// Mock deep research status - completed
export const mockDeepResearchComplete = {
  id: 'resp-research-123',
  object: 'response',
  status: 'completed' as const,
  model: 'o3-deep-research',
  output_text: `# Research Report

## Summary
This is a comprehensive research report on the requested topic.

## Key Findings
1. Finding one with [citation](https://example.com)
2. Finding two with data

## Sources
- [Source 1](https://example.com)
- [Source 2](https://example2.com)`,
  output: [
    {
      type: 'web_search_call',
      action: { type: 'search', query: 'test research query' },
      status: 'completed',
    },
    {
      type: 'web_search_call',
      action: { type: 'open_page', url: 'https://example.com' },
      status: 'completed',
    },
    {
      type: 'web_search_call',
      action: { type: 'open_page', url: 'https://example2.com' },
      status: 'completed',
    },
    {
      type: 'message',
      content: [{
        type: 'output_text',
        text: '# Research Report...',
        annotations: [
          { url: 'https://example.com', title: 'Source 1', start_index: 100, end_index: 120 },
          { url: 'https://example2.com', title: 'Source 2', start_index: 150, end_index: 170 },
        ],
      }],
    },
  ],
};

// Mock models list response
export const mockModelsListResponse = {
  data: [
    { id: 'gpt-5-mini', object: 'model' },
    { id: 'gpt-5.2', object: 'model' },
    { id: 'o3-deep-research', object: 'model' },
    { id: 'gpt-image-1.5', object: 'model' },
    { id: 'text-embedding-3-large', object: 'model' },
  ],
};

// Create a mock OpenAI client
export function createMockOpenAIClient() {
  // Track call count for responses.retrieve to simulate progress
  let retrieveCallCount = 0;

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
        // Legacy API - still supported for backward compatibility
        create: vi.fn().mockResolvedValue(mockChatCompletionResponse),
      },
    },
    // New Responses API
    responses: {
      create: vi.fn().mockImplementation((params: { model?: string; background?: boolean }) => {
        // Return deep research response for o3-deep-research model
        if (params.model === 'o3-deep-research') {
          return Promise.resolve(mockDeepResearchResponse);
        }
        // Return standard responses response for other models
        return Promise.resolve(mockResponsesResponse);
      }),
      retrieve: vi.fn().mockImplementation(() => {
        retrieveCallCount++;
        // Simulate progress: first few calls return in_progress, then complete
        if (retrieveCallCount < 3) {
          return Promise.resolve(mockDeepResearchInProgress);
        }
        return Promise.resolve(mockDeepResearchComplete);
      }),
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
