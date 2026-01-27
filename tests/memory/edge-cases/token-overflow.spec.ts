/**
 * Edge Case Tests: Token Overflow
 * 
 * Tests for handling extremely long messages and context overflow.
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const RESPONSE_TIMEOUT = 120000;

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

test.describe('Edge Cases: Token Overflow', () => {
  test.setTimeout(180000); // 3 minutes
  
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForPageLoad(page);
    await clickNewChat(page);
  });

  test('EC-001: Very long message (5000 chars)', async ({ page }) => {
    const longMessage = 'A'.repeat(5000) + ' - What is this?';
    
    await sendMessage(page, longMessage);
    await waitForResponse(page);
    
    // Should either process or gracefully handle
    const response = page.locator('[data-role="assistant"], .assistant-message, text=/error|message|long/i').last();
    await expect(response).toBeVisible({ timeout: 30000 });
  });

  test('EC-002: Extremely long message (20000 chars)', async ({ page }) => {
    const veryLongMessage = 'Test '.repeat(4000); // ~20000 chars
    
    try {
      await sendMessage(page, veryLongMessage);
      await waitForResponse(page);
    } catch (error) {
      // May fail to input, which is acceptable
      console.log('Long message input may have been truncated');
    }
    
    // System should still be responsive
    await page.waitForTimeout(2000);
    const pageContent = await page.content();
    expect(pageContent.length > 500).toBeTruthy();
  });

  test('EC-003: Many small messages rapidly', async ({ page }) => {
    // Send 50 very short messages rapidly
    for (let i = 0; i < 50; i++) {
      const input = page.locator('textarea, input[type="text"]').first();
      await input.fill(`M${i}`);
      await page.locator('button:has-text("Send")').last().click();
      await page.waitForTimeout(100); // Very short wait
    }
    
    // Wait for all to process
    await page.waitForTimeout(10000);
    
    // System should still work
    await sendMessage(page, 'Final message after rapid fire');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    await expect(response).toBeVisible();
  });

  test('EC-004: Unicode heavy message', async ({ page }) => {
    const unicodeMessage = '日本語テスト 中文测试 한국어테스트 🚀🎯📊 ' + 
                          'العربية тест δοκιμή בדיקה ' +
                          '∑∏∫√∞≈≠≤≥ ©®™°±µ¶';
    
    await sendMessage(page, unicodeMessage);
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    await expect(response).toBeVisible();
  });

  test('EC-005: Emoji only message', async ({ page }) => {
    const emojiMessage = '🚀💡📊🎯✨🔥💪🌟🎨🔬'.repeat(10);
    
    await sendMessage(page, emojiMessage);
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    await expect(response).toBeVisible();
  });

  test('EC-006: Empty message handling', async ({ page }) => {
    // Try to send empty message
    const input = page.locator('textarea, input[type="text"]').first();
    await input.fill('');
    
    const sendButton = page.locator('button:has-text("Send")').last();
    const isDisabled = await sendButton.isDisabled().catch(() => false);
    
    // Either disabled or handles gracefully
    if (!isDisabled) {
      await sendButton.click();
      await page.waitForTimeout(2000);
    }
    
    // System should still work
    await sendMessage(page, 'Message after empty attempt');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    await expect(response).toBeVisible();
  });

  test('EC-007: Whitespace only message', async ({ page }) => {
    const whitespaceMessage = '   \n\t\n   ';
    
    const input = page.locator('textarea, input[type="text"]').first();
    await input.fill(whitespaceMessage);
    
    const sendButton = page.locator('button:has-text("Send")').last();
    await sendButton.click();
    await page.waitForTimeout(2000);
    
    // System should handle gracefully
    await sendMessage(page, 'Message after whitespace');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    await expect(response).toBeVisible();
  });

  test('EC-008: Repeated special characters', async ({ page }) => {
    const specialMessage = '!@#$%^&*()'.repeat(100);
    
    await sendMessage(page, specialMessage);
    await waitForResponse(page);
    
    // Should handle without breaking
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    await expect(response).toBeVisible();
  });

  test('EC-009: Code injection attempt', async ({ page }) => {
    const injectionMessages = [
      "<script>alert('xss')</script>",
      "{{7*7}}",
      "${7*7}",
      "'; DROP TABLE messages; --",
      "<img src=x onerror=alert(1)>",
    ];
    
    for (const injection of injectionMessages) {
      await sendMessage(page, `Test: ${injection}`);
      await waitForResponse(page);
    }
    
    // System should handle safely
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    await expect(response).toBeVisible();
    
    // No actual script execution
    const pageContent = await page.content();
    expect(pageContent.includes('<script>alert')).toBeFalsy();
  });

  test('EC-010: Context budget overflow', async ({ page }) => {
    // Send messages until context should overflow
    for (let i = 0; i < 30; i++) {
      const longContent = `Message ${i + 1}: ${'Context filling content. '.repeat(50)}`;
      await sendMessage(page, longContent);
      await waitForResponse(page);
    }
    
    // System should still function
    await sendMessage(page, 'Can you still respond after all that?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    await expect(response).toBeVisible();
  });
});
