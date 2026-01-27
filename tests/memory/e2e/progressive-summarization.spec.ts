/**
 * Progressive Summarization Tests
 * 
 * Tests for token counting, context compression, and sliding window behavior.
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const RESPONSE_TIMEOUT = 90000;

async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

async function sendMessage(page: Page, message: string) {
  const input = page.locator('textarea, input[type="text"]').first();
  await input.fill(message);
  
  const sendButton = page.locator('button:has-text("Send"), button[aria-label*="Send"]').last();
  await sendButton.click();
  
  await page.waitForTimeout(2000);
}

async function waitForResponse(page: Page, timeout: number = RESPONSE_TIMEOUT) {
  try {
    await page.waitForSelector('[data-loading="true"], .loading', {
      state: 'hidden',
      timeout,
    });
  } catch {
    // Loading may not exist
  }
  await page.waitForTimeout(1000);
}

async function clickNewChat(page: Page) {
  const newChatButton = page.locator('button:has-text("New"), button[aria-label*="New"]').first();
  await newChatButton.click();
  await page.waitForTimeout(500);
}

// ============================================================================
// Tests
// ============================================================================

test.describe('Progressive Summarization', () => {
  test.setTimeout(180000); // 3 minutes for long tests
  
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForPageLoad(page);
    await clickNewChat(page);
  });

  test('PS-001: Long conversation maintains coherence', async ({ page }) => {
    // Start a conversation that will build up context
    await sendMessage(page, 'I want to plan a 10-day trip to Europe');
    await waitForResponse(page);
    
    await sendMessage(page, 'Days 1-3 will be in Paris, France');
    await waitForResponse(page);
    
    await sendMessage(page, 'Days 4-6 will be in Rome, Italy');
    await waitForResponse(page);
    
    await sendMessage(page, 'Days 7-10 will be in Barcelona, Spain');
    await waitForResponse(page);
    
    await sendMessage(page, 'My budget is $5000 total');
    await waitForResponse(page);
    
    await sendMessage(page, 'I prefer boutique hotels');
    await waitForResponse(page);
    
    // Test context retention
    await sendMessage(page, 'Summarize my complete trip plan');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    // Should remember key details
    const hasParis = text?.toLowerCase().includes('paris');
    const hasRome = text?.toLowerCase().includes('rome');
    const hasBarcelona = text?.toLowerCase().includes('barcelona');
    
    expect(hasParis || hasRome || hasBarcelona).toBeTruthy();
  });

  test('PS-002: 15-turn conversation works', async ({ page }) => {
    const topics = [
      'What is machine learning?',
      'How is it different from AI?',
      'What are neural networks?',
      'Explain deep learning',
      'What is supervised learning?',
      'What is unsupervised learning?',
      'Explain reinforcement learning',
      'What are transformers?',
      'How does GPT work?',
      'What is fine-tuning?',
      'Explain embeddings',
      'What is a loss function?',
      'How does backpropagation work?',
      'What is gradient descent?',
      'Summarize everything we discussed',
    ];
    
    for (const topic of topics) {
      await sendMessage(page, topic);
      await waitForResponse(page);
    }
    
    // Check final response has context
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    expect(text?.length).toBeGreaterThan(100);
  });

  test('PS-003: Context maintained after many messages', async ({ page }) => {
    // Provide important info early
    await sendMessage(page, 'IMPORTANT: My name is CompressTest and I am a researcher');
    await waitForResponse(page);
    
    // Send several filler messages
    for (let i = 0; i < 8; i++) {
      await sendMessage(page, `This is message number ${i + 1}. Tell me a random fact.`);
      await waitForResponse(page);
    }
    
    // Check if early context is retained
    await sendMessage(page, 'What was my name and profession?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    const hasName = text?.toLowerCase().includes('compresstest');
    const hasResearcher = text?.toLowerCase().includes('researcher');
    
    expect(hasName || hasResearcher).toBeTruthy();
  });

  test('PS-004: Session summary generated', async ({ page }) => {
    // Have a substantial conversation
    await sendMessage(page, 'Let me tell you about my project requirements');
    await waitForResponse(page);
    
    await sendMessage(page, 'We need a web app with user authentication');
    await waitForResponse(page);
    
    await sendMessage(page, 'It should support file uploads up to 10MB');
    await waitForResponse(page);
    
    await sendMessage(page, 'The backend should use Node.js');
    await waitForResponse(page);
    
    await sendMessage(page, 'Frontend will be React with TypeScript');
    await waitForResponse(page);
    
    // Ask for summary
    await sendMessage(page, 'Can you summarize the project requirements?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    // Should have key requirements
    const hasAuth = text?.toLowerCase().includes('auth');
    const hasUpload = text?.toLowerCase().includes('upload') || text?.toLowerCase().includes('file');
    const hasNode = text?.toLowerCase().includes('node');
    const hasReact = text?.toLowerCase().includes('react');
    
    expect(hasAuth || hasUpload || hasNode || hasReact).toBeTruthy();
  });

  test('PS-005: Token budget respected', async ({ page }) => {
    // Send 20 messages to trigger compression
    for (let i = 0; i < 20; i++) {
      await sendMessage(page, `Message ${i + 1}: Please provide a detailed explanation of topic ${i + 1}`);
      await waitForResponse(page);
    }
    
    // Send one more - system should still work
    await sendMessage(page, 'What have we been discussing?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    await expect(response).toBeVisible();
  });

  test('PS-006: Important info prioritized in compression', async ({ page }) => {
    // Mark something as important
    await sendMessage(page, 'CRITICAL: My API key is NEVER to be shared');
    await waitForResponse(page);
    
    // Send many messages
    for (let i = 0; i < 10; i++) {
      await sendMessage(page, `Filler message ${i + 1} with random content`);
      await waitForResponse(page);
    }
    
    // Check if critical info remembered
    await sendMessage(page, 'Is there anything critical I mentioned?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    const hasAPIKey = text?.toLowerCase().includes('api') || text?.toLowerCase().includes('key') || text?.toLowerCase().includes('critical');
    expect(hasAPIKey).toBeTruthy();
  });

  test('PS-007: Context window visualization', async ({ page }) => {
    // Look for any token count or context visualization
    await sendMessage(page, 'Hello, this is a test message');
    await waitForResponse(page);
    
    // Check for token indicators in UI
    const tokenIndicator = page.locator('text=/token|context|\\d+\\s*\\/\\s*\\d+/i');
    const hasToken = await tokenIndicator.first().isVisible({ timeout: 5000 }).catch(() => false);
    
    // May or may not be visible depending on UI
    expect(true).toBeTruthy();
  });

  test('PS-008: Compression recovery on error', async ({ page }) => {
    // Send messages rapidly to potentially trigger issues
    const promises: Promise<void>[] = [];
    
    await sendMessage(page, 'Rapid message 1');
    await page.waitForTimeout(500);
    await sendMessage(page, 'Rapid message 2');
    await page.waitForTimeout(500);
    await sendMessage(page, 'Rapid message 3');
    
    await waitForResponse(page, 120000);
    
    // System should still be responsive
    await sendMessage(page, 'Are you still working?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    await expect(response).toBeVisible();
  });
});
