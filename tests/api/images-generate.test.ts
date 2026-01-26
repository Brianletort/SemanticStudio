import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Sample base64 encoded image (1x1 transparent PNG for testing)
const MOCK_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Define mock functions at module scope before vi.mock
const mockGenerateImage = vi.fn();
const mockGenerateImageStream = vi.fn();

// Mock the LLM module
vi.mock('@/lib/llm', () => {
  return {
    generateImage: vi.fn(),
    generateImageStream: vi.fn(),
  };
});

// Mock the database
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'img-test-123' }]),
      }),
    }),
  },
}));

// Import the route handler after mocks
import { POST } from '@/app/api/images/generate/route';
import * as llm from '@/lib/llm';

// Helper to create a NextRequest
function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/images/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('/api/images/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementation for non-streaming
    vi.mocked(llm.generateImage).mockResolvedValue({
      imageBase64: MOCK_IMAGE_BASE64,
      revisedPrompt: 'A beautiful image',
      action: 'generate',
      size: '1024x1024',
      quality: 'medium',
      background: 'opaque',
    });
    
    // Default mock implementation for streaming
    vi.mocked(llm.generateImageStream).mockImplementation(async function* () {
      yield { type: 'progress', progress: 10 };
      yield { type: 'progress', progress: 30 };
      yield { type: 'progress', progress: 90 };
      yield {
        type: 'complete',
        imageBase64: MOCK_IMAGE_BASE64,
        revisedPrompt: 'A beautiful image',
        action: 'generate',
        progress: 100,
      };
    });
  });

  describe('validation', () => {
    it('should return 400 for missing prompt', async () => {
      const request = createRequest({});
      
      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Prompt is required');
    });

    it('should return 400 for empty prompt', async () => {
      const request = createRequest({ prompt: '' });
      
      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Prompt is required');
    });
  });

  describe('non-streaming generation', () => {
    it('should generate image with default settings', async () => {
      const request = createRequest({
        prompt: 'a red circle',
        stream: false,
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.imageBase64).toBe(MOCK_IMAGE_BASE64);
      expect(llm.generateImage).toHaveBeenCalledWith(
        'a red circle',
        expect.objectContaining({
          quality: 'medium',
          size: '1024x1024',
        })
      );
    });

    it('should generate image with custom quality', async () => {
      const request = createRequest({
        prompt: 'a detailed landscape',
        quality: 'high',
        stream: false,
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      expect(llm.generateImage).toHaveBeenCalledWith(
        'a detailed landscape',
        expect.objectContaining({
          quality: 'high',
        })
      );
    });

    it('should generate image with custom size', async () => {
      const request = createRequest({
        prompt: 'a portrait image',
        size: '1024x1536',
        stream: false,
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      expect(llm.generateImage).toHaveBeenCalledWith(
        'a portrait image',
        expect.objectContaining({
          size: '1024x1536',
        })
      );
    });

    it('should generate image with transparent background', async () => {
      const request = createRequest({
        prompt: 'a logo with transparency',
        background: 'transparent',
        stream: false,
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      expect(llm.generateImage).toHaveBeenCalledWith(
        'a logo with transparency',
        expect.objectContaining({
          background: 'transparent',
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(llm.generateImage).mockRejectedValueOnce(new Error('API error'));
      
      const request = createRequest({
        prompt: 'test image',
        stream: false,
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('API error');
    });

    it('should return duration in milliseconds', async () => {
      const request = createRequest({
        prompt: 'test image',
        stream: false,
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('streaming generation', () => {
    it('should stream progress events', async () => {
      const request = createRequest({
        prompt: 'a streaming image',
        stream: true,
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      
      // Read the streamed response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullResponse += decoder.decode(value, { stream: true });
        }
      }
      
      // Should contain progress events
      expect(fullResponse).toContain('"type":"progress"');
      // Should contain complete event
      expect(fullResponse).toContain('"type":"complete"');
      // Should contain DONE marker
      expect(fullResponse).toContain('[DONE]');
    });

    it('should handle streaming errors', async () => {
      vi.mocked(llm.generateImageStream).mockImplementation(async function* () {
        yield { type: 'progress', progress: 10 };
        yield { type: 'error', error: 'Generation failed' };
      });
      
      const request = createRequest({
        prompt: 'failing image',
        stream: true,
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullResponse += decoder.decode(value, { stream: true });
        }
      }
      
      expect(fullResponse).toContain('"type":"error"');
      expect(fullResponse).toContain('Generation failed');
    });
  });

  describe('image editing', () => {
    it('should set action to edit when input images provided', async () => {
      const request = createRequest({
        prompt: 'edit this image',
        inputImages: [{ type: 'base64', value: MOCK_IMAGE_BASE64 }],
        stream: false,
      });
      
      await POST(request);
      
      expect(llm.generateImage).toHaveBeenCalledWith(
        'edit this image',
        expect.objectContaining({
          action: 'edit',
          inputImages: [{ type: 'base64', value: MOCK_IMAGE_BASE64 }],
        })
      );
    });
  });
});
