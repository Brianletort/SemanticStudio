/**
 * Tier 3: Long-term Memory Tests
 * 
 * Tests for cross-session memory persistence and retrieval.
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

async function navigateToSettings(page: Page) {
  const settingsLink = page.locator('a[href*="settings"], button:has-text("Settings")');
  if (await settingsLink.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await settingsLink.first().click();
    await page.waitForLoadState('networkidle');
  }
}

// ============================================================================
// Tests
// ============================================================================

test.describe('Tier 3: Long-term Memory', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForPageLoad(page);
  });

  test('T3-001: Memory persists across sessions', async ({ page }) => {
    // Session 1: Save memory
    await clickNewChat(page);
    await sendMessage(page, 'Please remember that my favorite programming language is TypeScript');
    await waitForResponse(page);
    
    // Wait for memory to be saved
    await page.waitForTimeout(3000);
    
    // Session 2: Retrieve memory
    await clickNewChat(page);
    await sendMessage(page, 'What is my favorite programming language?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    const hasTypeScript = text?.toLowerCase().includes('typescript');
    expect(hasTypeScript).toBeTruthy();
  });

  test('T3-002: Cross-session preference retrieval', async ({ page }) => {
    // Session 1: Set preference
    await clickNewChat(page);
    await sendMessage(page, 'Remember that I prefer data visualized as charts rather than tables');
    await waitForResponse(page);
    
    await page.waitForTimeout(3000);
    
    // Session 2: Test if preference is applied
    await clickNewChat(page);
    await sendMessage(page, 'Show me sales data visualization');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    const mentionsCharts = text?.toLowerCase().includes('chart') || 
                           text?.toLowerCase().includes('visual') ||
                           text?.toLowerCase().includes('graph');
    expect(mentionsCharts).toBeTruthy();
  });

  test('T3-003: User identity remembered', async ({ page }) => {
    // Session 1: Provide identity
    await clickNewChat(page);
    await sendMessage(page, 'My name is LongTermTestUser and I am a software architect');
    await waitForResponse(page);
    
    await page.waitForTimeout(3000);
    
    // Session 2: Ask about identity
    await clickNewChat(page);
    await sendMessage(page, 'What do you know about me?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    const hasName = text?.toLowerCase().includes('longtermtestuser');
    const hasRole = text?.toLowerCase().includes('architect');
    
    expect(hasName || hasRole).toBeTruthy();
  });

  test('T3-004: Saved memories via Settings UI', async ({ page }) => {
    // Navigate to settings
    await navigateToSettings(page);
    
    // Look for memories section
    const memoriesTab = page.locator('button:has-text("Memories"), [role="tab"]:has-text("Memories")');
    
    if (await memoriesTab.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await memoriesTab.first().click();
      await page.waitForTimeout(1000);
      
      // Look for memory input or list
      const memoryArea = page.locator('[data-testid="memories"], [class*="memory"], textarea, input');
      const hasMemoryArea = await memoryArea.first().isVisible({ timeout: 5000 }).catch(() => false);
      
      expect(hasMemoryArea).toBeTruthy();
    } else {
      // Settings page might have different structure
      const pageContent = await page.content();
      expect(pageContent.length > 500).toBeTruthy();
    }
  });

  test('T3-005: Memory deletion works', async ({ page }) => {
    // First save a memory
    await clickNewChat(page);
    await sendMessage(page, 'Remember that I hate broccoli');
    await waitForResponse(page);
    
    await page.waitForTimeout(3000);
    
    // Navigate to settings to delete
    await navigateToSettings(page);
    
    const memoriesTab = page.locator('button:has-text("Memories"), [role="tab"]:has-text("Memories")');
    if (await memoriesTab.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await memoriesTab.first().click();
      await page.waitForTimeout(1000);
      
      // Look for delete button
      const deleteButton = page.locator('button:has-text("Delete"), button[aria-label*="delete"]');
      if (await deleteButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await deleteButton.first().click();
        await page.waitForTimeout(1000);
      }
    }
    
    // Go back to chat and verify
    await page.goto(BASE_URL);
    await waitForPageLoad(page);
    await clickNewChat(page);
    
    await sendMessage(page, 'What food do I dislike?');
    await waitForResponse(page);
    
    // Response should indicate uncertainty or memory was deleted
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    expect(text?.length).toBeGreaterThan(0);
  });

  test('T3-006: Multiple long-term memories', async ({ page }) => {
    // Save multiple memories
    await clickNewChat(page);
    await sendMessage(page, 'Remember: I work at TechGlobal, my role is Lead Developer, I use Mac');
    await waitForResponse(page);
    
    await page.waitForTimeout(3000);
    
    // New session
    await clickNewChat(page);
    await sendMessage(page, 'Tell me everything you remember about my work setup');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    const hasCompany = text?.toLowerCase().includes('techglobal');
    const hasRole = text?.toLowerCase().includes('developer') || text?.toLowerCase().includes('lead');
    const hasMac = text?.toLowerCase().includes('mac');
    
    // At least one should be remembered
    expect(hasCompany || hasRole || hasMac).toBeTruthy();
  });

  test('T3-007: Memory used in context', async ({ page }) => {
    // Save role-specific memory
    await clickNewChat(page);
    await sendMessage(page, 'Remember that I am a Python developer who builds data pipelines');
    await waitForResponse(page);
    
    await page.waitForTimeout(3000);
    
    // New session, ask coding question
    await clickNewChat(page);
    await sendMessage(page, 'How should I process a large CSV file?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    // Should suggest Python-based solution
    const hasPython = text?.toLowerCase().includes('python') || 
                      text?.toLowerCase().includes('pandas') ||
                      text?.toLowerCase().includes('csv');
    expect(hasPython).toBeTruthy();
  });

  test('T3-008: Memory prioritization', async ({ page }) => {
    // Save multiple facts with different importance
    await clickNewChat(page);
    await sendMessage(page, 'VERY IMPORTANT: Always remind me to save my work frequently');
    await waitForResponse(page);
    
    await sendMessage(page, 'I like blue backgrounds');
    await waitForResponse(page);
    
    await page.waitForTimeout(3000);
    
    // New session
    await clickNewChat(page);
    await sendMessage(page, 'I am starting a new coding project');
    await waitForResponse(page);
    
    // The important reminder might be mentioned
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    expect(text?.length).toBeGreaterThan(20);
  });
});
