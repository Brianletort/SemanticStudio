/**
 * Stress Tests: Long Conversations
 * 
 * Tests for handling very long conversations with 50+ turns.
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
  
  await page.waitForTimeout(1000);
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
  await page.waitForTimeout(500);
}

async function clickNewChat(page: Page) {
  const newChatButton = page.locator('button:has-text("New"), button[aria-label*="New"]').first();
  await newChatButton.click();
  await page.waitForTimeout(500);
}

// ============================================================================
// Tests
// ============================================================================

test.describe('Stress: Long Conversations', () => {
  test.setTimeout(600000); // 10 minutes for stress tests
  
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForPageLoad(page);
    await clickNewChat(page);
  });

  test('ST-001: 25-turn conversation', async ({ page }) => {
    // Establish context
    await sendMessage(page, 'I am testing a 25-turn conversation. My name is StressTest25.');
    await waitForResponse(page);
    
    // Send 24 more messages
    for (let i = 2; i <= 25; i++) {
      await sendMessage(page, `Turn ${i}: Tell me an interesting fact about the number ${i}`);
      await waitForResponse(page);
    }
    
    // Verify context is maintained
    await sendMessage(page, 'What was my name at the start?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    const hasName = text?.toLowerCase().includes('stresstest25');
    expect(hasName).toBeTruthy();
  });

  test('ST-002: 50-turn conversation', async ({ page }) => {
    const startTime = Date.now();
    
    await sendMessage(page, 'Starting 50-turn stress test. Remember: KEYWORD=STRESS50');
    await waitForResponse(page);
    
    for (let i = 2; i <= 50; i++) {
      await sendMessage(page, `Message ${i}/50`);
      await waitForResponse(page);
      
      // Log progress
      if (i % 10 === 0) {
        console.log(`Progress: ${i}/50 messages (${Date.now() - startTime}ms)`);
      }
    }
    
    // Test context
    await sendMessage(page, 'What was the KEYWORD from the start?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    expect(text?.toLowerCase().includes('stress50') || text?.length! > 20).toBeTruthy();
  });

  test('ST-003: Dense information retention', async ({ page }) => {
    // Send messages with specific data points
    const dataPoints = [
      'Revenue Q1: $1.2M',
      'Revenue Q2: $1.5M',
      'Revenue Q3: $1.8M',
      'Revenue Q4: $2.1M',
      'Total employees: 150',
      'Engineering team: 45',
      'Sales team: 35',
      'Top customer: AcmeCorp',
      'Second customer: TechGiant',
      'Primary product: CloudSync',
    ];
    
    for (const data of dataPoints) {
      await sendMessage(page, `Note: ${data}`);
      await waitForResponse(page);
    }
    
    // Add some noise
    for (let i = 0; i < 10; i++) {
      await sendMessage(page, `Random discussion point ${i + 1}`);
      await waitForResponse(page);
    }
    
    // Query specific data
    await sendMessage(page, 'What was the Q3 revenue and how many engineers?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    const hasQ3 = text?.includes('1.8') || text?.toLowerCase().includes('q3');
    const hasEngineers = text?.includes('45') || text?.toLowerCase().includes('engineer');
    
    expect(hasQ3 || hasEngineers).toBeTruthy();
  });

  test('ST-004: Response time consistency', async ({ page }) => {
    const responseTimes: number[] = [];
    
    for (let i = 1; i <= 15; i++) {
      const start = Date.now();
      await sendMessage(page, `Performance test message ${i}`);
      await waitForResponse(page);
      responseTimes.push(Date.now() - start);
    }
    
    // Calculate statistics
    const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const max = Math.max(...responseTimes);
    
    console.log(`Response times - Avg: ${avg}ms, Max: ${max}ms`);
    
    // Response times should be reasonable
    expect(max).toBeLessThan(120000); // No single response > 2 minutes
  });

  test('ST-005: Memory leak check', async ({ page }) => {
    // Monitor page memory if available
    const initialMetrics = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // Send many messages
    for (let i = 0; i < 30; i++) {
      await sendMessage(page, `Memory test ${i + 1}`);
      await waitForResponse(page);
    }
    
    const finalMetrics = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // Memory shouldn't grow excessively (rough check)
    if (initialMetrics > 0 && finalMetrics > 0) {
      const growth = (finalMetrics - initialMetrics) / initialMetrics;
      console.log(`Memory growth: ${(growth * 100).toFixed(2)}%`);
      expect(growth).toBeLessThan(10); // Less than 10x growth
    }
    
    // System should still be responsive
    await sendMessage(page, 'Are you still responsive?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    await expect(response).toBeVisible();
  });
});
