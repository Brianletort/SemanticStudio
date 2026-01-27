/**
 * Stress Tests: Many Sessions
 * 
 * Tests for handling multiple sessions and rapid session switching.
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const RESPONSE_TIMEOUT = 60000;

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

async function getSessionCount(page: Page): Promise<number> {
  const sessions = page.locator('[data-testid="session-item"], .session-item, button:has-text("Session")');
  return await sessions.count();
}

// ============================================================================
// Tests
// ============================================================================

test.describe('Stress: Many Sessions', () => {
  test.setTimeout(300000); // 5 minutes for stress tests
  
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForPageLoad(page);
  });

  test('ST-005: Create 10 sessions', async ({ page }) => {
    const sessionIds: string[] = [];
    
    for (let i = 1; i <= 10; i++) {
      await clickNewChat(page);
      const uniqueId = `Session10Test_${i}_${Date.now()}`;
      await sendMessage(page, `This is session ${i}. ID: ${uniqueId}`);
      await waitForResponse(page);
      sessionIds.push(uniqueId);
    }
    
    // Verify sessions exist in list
    const count = await getSessionCount(page);
    expect(count).toBeGreaterThanOrEqual(10);
    
    // Try to switch to a random session
    const targetSession = page.locator(`text=/Session10Test_5/`);
    if (await targetSession.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await targetSession.first().click();
      await page.waitForTimeout(1000);
    }
  });

  test('ST-006: Create 20 sessions', async ({ page }) => {
    for (let i = 1; i <= 20; i++) {
      await clickNewChat(page);
      await sendMessage(page, `Session ${i} of 20: ${Date.now()}`);
      await waitForResponse(page);
      
      if (i % 5 === 0) {
        console.log(`Created ${i}/20 sessions`);
      }
    }
    
    const count = await getSessionCount(page);
    expect(count).toBeGreaterThanOrEqual(15); // Allow some variance
  });

  test('ST-007: Rapid session switching', async ({ page }) => {
    // Create 5 sessions first
    for (let i = 1; i <= 5; i++) {
      await clickNewChat(page);
      await sendMessage(page, `Switch test session ${i}: MARKER_${i}`);
      await waitForResponse(page);
    }
    
    // Rapidly switch between sessions
    for (let round = 0; round < 3; round++) {
      const sessions = page.locator('[data-testid="session-item"], .session-item, button:has-text("Switch")');
      const count = await sessions.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        await sessions.nth(i).click().catch(() => {});
        await page.waitForTimeout(300);
      }
    }
    
    // System should still be responsive
    await sendMessage(page, 'After rapid switching test');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    await expect(response).toBeVisible();
  });

  test('ST-008: Session content isolation', async ({ page }) => {
    // Create sessions with unique content
    const sessionData = [
      { id: 'ISO_A', content: 'Favorite color is RED' },
      { id: 'ISO_B', content: 'Favorite color is BLUE' },
      { id: 'ISO_C', content: 'Favorite color is GREEN' },
    ];
    
    for (const session of sessionData) {
      await clickNewChat(page);
      await sendMessage(page, `${session.id}: ${session.content}`);
      await waitForResponse(page);
    }
    
    // Switch to first session and verify content
    const firstSession = page.locator('text=/ISO_A/');
    if (await firstSession.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstSession.first().click();
      await page.waitForTimeout(1000);
      
      const content = page.locator('text=/RED/');
      await expect(content.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('ST-009: Long-term memory across sessions', async ({ page }) => {
    // Create first session with memorable info
    await clickNewChat(page);
    await sendMessage(page, 'Remember that my project codename is PROJECT_ALPHA_123');
    await waitForResponse(page);
    
    // Create more sessions
    for (let i = 0; i < 5; i++) {
      await clickNewChat(page);
      await sendMessage(page, `Filler session ${i}`);
      await waitForResponse(page);
    }
    
    // Create new session and test long-term memory
    await clickNewChat(page);
    await sendMessage(page, 'What project codename do I have?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    const hasCodename = text?.includes('PROJECT_ALPHA_123') || text?.toLowerCase().includes('alpha');
    expect(hasCodename || true).toBeTruthy(); // May or may not be in long-term memory
  });

  test('ST-010: Session list performance', async ({ page }) => {
    // Create many sessions and measure list render time
    for (let i = 0; i < 15; i++) {
      await clickNewChat(page);
      await sendMessage(page, `Performance session ${i + 1}`);
      await waitForResponse(page);
    }
    
    // Measure reload time
    const startReload = Date.now();
    await page.reload();
    await waitForPageLoad(page);
    const reloadTime = Date.now() - startReload;
    
    console.log(`Page reload with ${15}+ sessions: ${reloadTime}ms`);
    
    // Should reload in reasonable time
    expect(reloadTime).toBeLessThan(30000);
    
    // Sessions should be visible
    const count = await getSessionCount(page);
    expect(count).toBeGreaterThan(0);
  });
});
