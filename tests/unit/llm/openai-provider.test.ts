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

// Mock functions that we can control
const mockImagesGenerate = vi.fn().mockResolvedValue(mockImageGenerationResponse);
const mockImagesEdit = vi.fn().mockResolvedValue(mockImageGenerationResponse);
const mockFilesCreate = vi.fn().mockResolvedValue(mockFileUploadResponse);
const mockModelsList = vi.fn().mockResolvedValue({
  data: [
    { id: 'gpt-5-mini' },
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
        { id: 'gpt-image-1.5' },
        { id: 'text-embedding-3-large' },
      ],
    });
    provider = new OpenAIProvider('test-api-key');
  });

  describe('generateImage', () => {
    it('should generate an image with default options', async () => {
      const prompt = 'a simple red circle on white background';
      
      const result = await provider.generateImage(prompt);
      
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt,
          model: 'gpt-image-1.5',
          n: 1,
          size: '1024x1024',
          quality: 'medium',
        })
      );
      expect(result.imageBase64).toBe(MOCK_IMAGE_BASE64);
      expect(result.action).toBe('generate');
      expect(result.size).toBe('1024x1024');
      expect(result.quality).toBe('medium');
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
    it('should yield progress events and complete event', async () => {
      const prompt = 'a streamed image';
      const events: Array<{ type: string; progress?: number; imageBase64?: string }> = [];
      
      for await (const event of provider.generateImageStream(prompt)) {
        events.push(event);
      }
      
      // Should have progress events and a complete event
      expect(events.length).toBeGreaterThan(1);
      
      // Check for progress events
      const progressEvents = events.filter(e => e.type === 'progress');
      expect(progressEvents.length).toBeGreaterThan(0);
      
      // Check for complete event
      const completeEvent = events.find(e => e.type === 'complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent?.imageBase64).toBe(MOCK_IMAGE_BASE64);
      expect(completeEvent?.progress).toBe(100);
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
});
