import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ImageGenerationOptions } from '@/lib/llm/types';

// Sample base64 encoded image (1x1 transparent PNG for testing)
const MOCK_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const mockImageGenerationResponse = {
  data: [{
    url: undefined,
    b64_json: MOCK_IMAGE_BASE64,
    revised_prompt: 'A beautiful red circle on a pristine white background',
  }],
};

const mockFileUploadResponse = {
  id: 'file-abc123',
  object: 'file',
  bytes: 12345,
  created_at: Date.now(),
  filename: 'test-image.png',
  purpose: 'vision',
};

// Mock responses for Responses API
const mockResponsesResponse = {
  id: 'resp-test123',
  status: 'completed',
  model: 'gpt-5-mini',
  output_text: 'This is a test response from the Responses API.',
  output: [
    { type: 'message', content: [{ type: 'output_text', text: 'Test response' }] },
  ],
  usage: {
    input_tokens: 10,
    output_tokens: 15,
    total_tokens: 25,
  },
};

const mockDeepResearchResponse = {
  id: 'resp-research-123',
  status: 'in_progress',
  model: 'o3-deep-research',
};

const mockDeepResearchComplete = {
  id: 'resp-research-123',
  status: 'completed',
  model: 'o3-deep-research',
  output_text: '# Research Report\n\nFindings here...',
  output: [
    { type: 'web_search_call', action: { type: 'search', query: 'test' }, status: 'completed' },
    { type: 'web_search_call', action: { type: 'open_page', url: 'https://example.com' }, status: 'completed' },
  ],
};

// Helper to create async iterable for streaming tests
async function* createStreamingMock(events: unknown[]): AsyncGenerator<unknown, void, unknown> {
  for (const event of events) {
    yield event;
  }
}

// Default streaming events that simulate OpenAI's image streaming API
const defaultStreamingEvents = [
  {
    type: 'image_generation.partial_image',
    partial_image_index: 0,
    b64_json: MOCK_IMAGE_BASE64.substring(0, 50),
  },
  {
    type: 'image_generation.partial_image',
    partial_image_index: 1,
    b64_json: MOCK_IMAGE_BASE64.substring(0, 100),
  },
  {
    type: 'image_generation.completed',
    b64_json: MOCK_IMAGE_BASE64,
    revised_prompt: 'A beautiful streamed image',
  },
];

// Mock functions that we can control
const mockImagesGenerate = vi.fn().mockResolvedValue(mockImageGenerationResponse);
const mockImagesEdit = vi.fn().mockResolvedValue(mockImageGenerationResponse);
const mockFilesCreate = vi.fn().mockResolvedValue(mockFileUploadResponse);
const mockModelsList = vi.fn().mockResolvedValue({
  data: [
    { id: 'gpt-5-mini' },
    { id: 'gpt-5.2' },
    { id: 'o3-deep-research' },
    { id: 'gpt-image-1.5' },
    { id: 'text-embedding-3-large' },
  ],
});
const mockChatCreate = vi.fn().mockResolvedValue({
  choices: [{ message: { content: 'test' } }],
  model: 'gpt-5-mini',
  usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
});
const mockEmbeddingsCreate = vi.fn().mockResolvedValue({
  data: [{ embedding: new Array(1536).fill(0.1) }],
});

// Responses API mocks
const mockResponsesCreate = vi.fn().mockImplementation((params: { model?: string }) => {
  if (params.model === 'o3-deep-research') {
    return Promise.resolve(mockDeepResearchResponse);
  }
  return Promise.resolve(mockResponsesResponse);
});
const mockResponsesRetrieve = vi.fn().mockResolvedValue(mockDeepResearchComplete);

// Mock the OpenAI module
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      images = {
        generate: mockImagesGenerate,
        edit: mockImagesEdit,
      };
      files = {
        create: mockFilesCreate,
      };
      chat = {
        completions: {
          create: mockChatCreate,
        },
      };
      // New Responses API
      responses = {
        create: mockResponsesCreate,
        retrieve: mockResponsesRetrieve,
      };
      models = {
        list: mockModelsList,
      };
      embeddings = {
        create: mockEmbeddingsCreate,
      };
    },
  };
});

// Import after mock setup
import { OpenAIProvider } from '@/lib/llm/providers/openai';

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockImagesGenerate.mockResolvedValue(mockImageGenerationResponse);
    mockImagesEdit.mockResolvedValue(mockImageGenerationResponse);
    mockFilesCreate.mockResolvedValue(mockFileUploadResponse);
    mockModelsList.mockResolvedValue({
      data: [
        { id: 'gpt-5-mini' },
        { id: 'gpt-5.2' },
        { id: 'o3-deep-research' },
        { id: 'gpt-image-1.5' },
        { id: 'text-embedding-3-large' },
      ],
    });
    // Reset Responses API mocks
    mockResponsesCreate.mockImplementation((params: { model?: string }) => {
      if (params.model === 'o3-deep-research') {
        return Promise.resolve(mockDeepResearchResponse);
      }
      return Promise.resolve(mockResponsesResponse);
    });
    mockResponsesRetrieve.mockResolvedValue(mockDeepResearchComplete);
    
    provider = new OpenAIProvider('test-api-key');
  });

  describe('generateImage', () => {
    it('should generate an image with default options including output_format and background', async () => {
      const prompt = 'a simple red circle on white background';
      
      const result = await provider.generateImage(prompt);
      
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt,
          model: 'gpt-image-1.5',
          n: 1,
          size: '1024x1024',
          quality: 'medium',
          output_format: 'png',
          background: 'opaque',
        })
      );
      expect(result.imageBase64).toBe(MOCK_IMAGE_BASE64);
      expect(result.action).toBe('generate');
      expect(result.size).toBe('1024x1024');
      expect(result.quality).toBe('medium');
      expect(result.background).toBe('opaque');
    });

    it('should generate an image with custom quality', async () => {
      const prompt = 'a detailed landscape';
      const options: ImageGenerationOptions = { quality: 'high' };
      
      await provider.generateImage(prompt, options);
      
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          quality: 'high',
        })
      );
    });

    it('should generate an image with custom size - square', async () => {
      const prompt = 'a square image';
      const options: ImageGenerationOptions = { size: '1024x1024' };
      
      await provider.generateImage(prompt, options);
      
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          size: '1024x1024',
        })
      );
    });

    it('should generate an image with custom size - portrait', async () => {
      const prompt = 'a portrait image';
      const options: ImageGenerationOptions = { size: '1024x1536' };
      
      await provider.generateImage(prompt, options);
      
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          size: '1024x1536',
        })
      );
    });

    it('should generate an image with custom size - landscape', async () => {
      const prompt = 'a landscape image';
      const options: ImageGenerationOptions = { size: '1536x1024' };
      
      await provider.generateImage(prompt, options);
      
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          size: '1536x1024',
        })
      );
    });

    it('should generate an image with low quality', async () => {
      const prompt = 'a quick draft';
      const options: ImageGenerationOptions = { quality: 'low' };
      
      await provider.generateImage(prompt, options);
      
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          quality: 'low',
        })
      );
    });

    it('should handle custom model', async () => {
      const prompt = 'a test image';
      const options: ImageGenerationOptions = { model: 'gpt-image-1' };
      
      await provider.generateImage(prompt, options);
      
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-image-1',
        })
      );
    });

    it('should pass transparent background when specified', async () => {
      const prompt = 'a transparent image';
      const options: ImageGenerationOptions = { background: 'transparent' };
      
      await provider.generateImage(prompt, options);
      
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          background: 'transparent',
        })
      );
    });

    it('should pass custom output_format when specified', async () => {
      const prompt = 'a webp image';
      const options: ImageGenerationOptions = { outputFormat: 'webp' };
      
      await provider.generateImage(prompt, options);
      
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          output_format: 'webp',
        })
      );
    });

    it('should throw on API error', async () => {
      const apiError = new Error('API rate limit exceeded');
      mockImagesGenerate.mockRejectedValueOnce(apiError);
      
      await expect(provider.generateImage('test')).rejects.toThrow('API rate limit exceeded');
    });

    it('should throw when no image data returned', async () => {
      mockImagesGenerate.mockResolvedValueOnce({ data: [] });
      
      await expect(provider.generateImage('test')).rejects.toThrow('No image data returned from OpenAI');
    });

    it('should return revised prompt from response', async () => {
      const result = await provider.generateImage('test prompt');
      
      expect(result.revisedPrompt).toBe(mockImageGenerationResponse.data[0].revised_prompt);
    });
  });

  describe('generateImageStream', () => {
    beforeEach(() => {
      // Setup streaming mock to return an async iterable
      mockImagesGenerate.mockImplementation((params: { stream?: boolean }) => {
        if (params.stream) {
          return createStreamingMock(defaultStreamingEvents);
        }
        return Promise.resolve(mockImageGenerationResponse);
      });
    });

    it('should include partial_images, output_format, and background in streaming request', async () => {
      const prompt = 'a streamed image';
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _event of provider.generateImageStream(prompt)) {
        // consume events
      }
      
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          stream: true,
          partial_images: 2,
          output_format: 'png',
          background: 'opaque',
        })
      );
    });

    it('should yield partial and complete events from stream', async () => {
      const prompt = 'a streamed image';
      const events: Array<{ type: string; progress?: number; imageBase64?: string; partialImageIndex?: number }> = [];
      
      for await (const event of provider.generateImageStream(prompt)) {
        events.push(event);
      }
      
      // Should have partial events and a complete event
      expect(events.length).toBeGreaterThan(1);
      
      // Check for partial events
      const partialEvents = events.filter(e => e.type === 'partial');
      expect(partialEvents.length).toBe(2);
      expect(partialEvents[0].partialImageIndex).toBe(0);
      expect(partialEvents[1].partialImageIndex).toBe(1);
      
      // Check for complete event
      const completeEvent = events.find(e => e.type === 'complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent?.imageBase64).toBe(MOCK_IMAGE_BASE64);
      expect(completeEvent?.progress).toBe(100);
    });

    it('should use custom partialImages value when specified', async () => {
      const options: ImageGenerationOptions = { partialImages: 3 };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _event of provider.generateImageStream('test', options)) {
        // consume events
      }
      
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          partial_images: 3,
        })
      );
    });

    it('should pass transparent background when specified', async () => {
      const options: ImageGenerationOptions = { background: 'transparent' };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _event of provider.generateImageStream('test', options)) {
        // consume events
      }
      
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          background: 'transparent',
        })
      );
    });

    it('should yield error event on failure', async () => {
      mockImagesGenerate.mockRejectedValueOnce(new Error('Generation failed'));
      
      const events: Array<{ type: string; error?: string }> = [];
      for await (const event of provider.generateImageStream('test')) {
        events.push(event);
      }
      
      const errorEvent = events.find(e => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.error).toBe('Generation failed');
    });

    it('should handle legacy event format as fallback', async () => {
      // Mock with legacy format (no type field)
      const legacyEvents = [
        { partial_image_index: 0, b64_json: 'partial1' },
        { b64_json: MOCK_IMAGE_BASE64, revised_prompt: 'Final image' },
      ];
      mockImagesGenerate.mockImplementationOnce(() => createStreamingMock(legacyEvents));
      
      const events: Array<{ type: string }> = [];
      for await (const event of provider.generateImageStream('test')) {
        events.push(event);
      }
      
      expect(events.some(e => e.type === 'partial')).toBe(true);
      expect(events.some(e => e.type === 'complete')).toBe(true);
    });
  });

  describe('uploadFile', () => {
    it('should upload a file and return file ID', async () => {
      const fileBuffer = Buffer.from(MOCK_IMAGE_BASE64, 'base64');
      const filename = 'test-image.png';
      const mimeType = 'image/png';
      
      const result = await provider.uploadFile(fileBuffer, filename, mimeType);
      
      expect(mockFilesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          purpose: 'vision',
        })
      );
      expect(result).toBe(mockFileUploadResponse.id);
    });

    it('should handle upload errors', async () => {
      const uploadError = new Error('Upload failed');
      mockFilesCreate.mockRejectedValueOnce(uploadError);
      
      const fileBuffer = Buffer.from(MOCK_IMAGE_BASE64, 'base64');
      
      await expect(provider.uploadFile(fileBuffer, 'test.png', 'image/png')).rejects.toThrow('Upload failed');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API is accessible', async () => {
      const result = await provider.isAvailable();
      
      expect(result).toBe(true);
      expect(mockModelsList).toHaveBeenCalled();
    });

    it('should return false when API is not accessible', async () => {
      mockModelsList.mockRejectedValueOnce(new Error('API error'));
      
      const result = await provider.isAvailable();
      
      expect(result).toBe(false);
    });
  });

  describe('listModels', () => {
    it('should return list of available models', async () => {
      const result = await provider.listModels();
      
      expect(result).toContain('gpt-5-mini');
      expect(result).toContain('gpt-image-1.5');
    });

    it('should return empty array on error', async () => {
      mockModelsList.mockRejectedValueOnce(new Error('API error'));
      
      const result = await provider.listModels();
      
      expect(result).toEqual([]);
    });
  });

  // ============================================
  // RESPONSES API TESTS
  // ============================================

  describe('chat (Responses API)', () => {
    beforeEach(() => {
      mockResponsesCreate.mockResolvedValue(mockResponsesResponse);
    });

    it('should call responses.create with correct parameters', async () => {
      const messages = [
        { role: 'system' as const, content: 'You are a helpful assistant' },
        { role: 'user' as const, content: 'Hello' },
      ];
      
      const result = await provider.chat(messages);
      
      expect(mockResponsesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5-mini',
          input: expect.any(String),
        })
      );
      expect(result.content).toBe(mockResponsesResponse.output_text);
      expect(result.responseId).toBe(mockResponsesResponse.id);
    });

    it('should use custom model when provided', async () => {
      const messages = [{ role: 'user' as const, content: 'Hello' }];
      
      await provider.chat(messages, { model: 'gpt-5.2' });
      
      expect(mockResponsesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5.2',
        })
      );
    });

    it('should include instructions from system message', async () => {
      const messages = [
        { role: 'system' as const, content: 'Be concise' },
        { role: 'user' as const, content: 'Hello' },
      ];
      
      await provider.chat(messages);
      
      expect(mockResponsesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: 'Be concise',
        })
      );
    });

    it('should pass reasoning options when provided', async () => {
      const messages = [{ role: 'user' as const, content: 'Hello' }];
      
      await provider.chat(messages, { reasoning: { effort: 'high' } });
      
      expect(mockResponsesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          reasoning: { effort: 'high' },
        })
      );
    });

    it('should handle API errors', async () => {
      mockResponsesCreate.mockRejectedValueOnce(new Error('API error'));
      
      const messages = [{ role: 'user' as const, content: 'Hello' }];
      
      await expect(provider.chat(messages)).rejects.toThrow('API error');
    });
  });

  describe('deepResearch', () => {
    beforeEach(() => {
      mockResponsesCreate.mockResolvedValue(mockDeepResearchResponse);
    });

    it('should call responses.create with o3-deep-research model', async () => {
      const result = await provider.deepResearch('Research AI trends');
      
      expect(mockResponsesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'o3-deep-research',
          input: 'Research AI trends',
          background: true,
        })
      );
      expect(result.id).toBe(mockDeepResearchResponse.id);
      expect(result.status).toBe('in_progress');
    });

    it('should include web_search_preview tool by default', async () => {
      await provider.deepResearch('Research topic');
      
      expect(mockResponsesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.arrayContaining([
            { type: 'web_search_preview' },
          ]),
        })
      );
    });

    it('should pass custom instructions when provided', async () => {
      await provider.deepResearch('Research topic', {
        instructions: 'Focus on recent developments',
      });
      
      expect(mockResponsesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: 'Focus on recent developments',
        })
      );
    });

    it('should handle API errors', async () => {
      mockResponsesCreate.mockRejectedValueOnce(new Error('Research failed'));
      
      await expect(provider.deepResearch('Research topic')).rejects.toThrow('Research failed');
    });
  });

  describe('getResponseStatus', () => {
    beforeEach(() => {
      mockResponsesRetrieve.mockResolvedValue(mockDeepResearchComplete);
    });

    it('should retrieve response status by ID', async () => {
      const result = await provider.getResponseStatus('resp-research-123');
      
      expect(mockResponsesRetrieve).toHaveBeenCalledWith('resp-research-123');
      expect(result.id).toBe(mockDeepResearchComplete.id);
      expect(result.status).toBe('completed');
    });

    it('should count sources found from web search calls', async () => {
      const result = await provider.getResponseStatus('resp-research-123');
      
      // mockDeepResearchComplete has 2 web_search_calls
      expect(result.sourcesFound).toBe(2);
      expect(result.searchesCompleted).toBe(2);
    });

    it('should return output_text when completed', async () => {
      const result = await provider.getResponseStatus('resp-research-123');
      
      expect(result.output_text).toBe(mockDeepResearchComplete.output_text);
    });

    it('should handle in_progress status', async () => {
      mockResponsesRetrieve.mockResolvedValueOnce({
        id: 'resp-research-123',
        status: 'in_progress',
        output: [
          { type: 'web_search_call', status: 'completed' },
        ],
      });
      
      const result = await provider.getResponseStatus('resp-research-123');
      
      expect(result.status).toBe('in_progress');
      expect(result.searchesCompleted).toBe(1);
    });

    it('should handle API errors', async () => {
      mockResponsesRetrieve.mockRejectedValueOnce(new Error('Not found'));
      
      await expect(provider.getResponseStatus('invalid-id')).rejects.toThrow('Not found');
    });
  });
});
