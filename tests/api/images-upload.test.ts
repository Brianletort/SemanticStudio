import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the LLM module
vi.mock('@/lib/llm', () => ({
  uploadImageFile: vi.fn().mockResolvedValue('file-abc123'),
}));

// Mock the database with proper chaining
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ 
          id: 'upload-test-123',
          openaiFileId: 'file-abc123',
        }]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  },
}));

// Import after mocks
import { POST, GET } from '@/app/api/images/upload/route';

// Helper to create a GET request
function createGetRequest(fileId?: string): NextRequest {
  const url = fileId 
    ? `http://localhost:3000/api/images/upload?fileId=${fileId}`
    : 'http://localhost:3000/api/images/upload';
  
  return new NextRequest(url, {
    method: 'GET',
  });
}

describe('/api/images/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST - file upload validation', () => {
    it('should reject missing file', async () => {
      const formData = new FormData();
      const request = new NextRequest('http://localhost:3000/api/images/upload', {
        method: 'POST',
        body: formData,
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('No file provided');
    });
  });

  describe('GET - file info', () => {
    it('should return 400 without fileId parameter', async () => {
      const request = createGetRequest();
      
      const response = await GET(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('File ID is required');
    });

    it('should return 404 for non-existent file', async () => {
      const request = createGetRequest('non-existent-file');
      
      const response = await GET(request);
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('File not found');
    });
  });
});
