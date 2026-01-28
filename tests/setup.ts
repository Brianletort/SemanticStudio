import '@testing-library/jest-dom';
import { vi, beforeEach, afterAll } from 'vitest';

// Mock environment variables
process.env.OPENAI_API_KEY = 'test-api-key';

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Clean up after all tests
afterAll(() => {
  vi.restoreAllMocks();
});
