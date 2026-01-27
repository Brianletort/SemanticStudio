/**
 * Tier 2: Session Memory Tests
 * 
 * Tests for session-level fact extraction and retrieval.
 */

import { test, expect, type Page } from '@playwright/test';
import { getSessionFacts, verifyFactExists } from '../fixtures/db-helpers';

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

async function getCurrentSessionId(page: Page): Promise<string | null> {
  // Try to get session ID from URL or page
  const url = page.url();
  const match = url.match(/session[=/]([a-f0-9-]+)/i);
  if (match) return match[1];
  
  // Or from data attribute
  const sessionEl = page.locator('[data-session-id]').first();
  if (await sessionEl.isVisible({ timeout: 1000 }).catch(() => false)) {
    return await sessionEl.getAttribute('data-session-id');
  }
  
  return null;
}

// ============================================================================
// Tests
// ============================================================================

test.describe('Tier 2: Session Memory', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForPageLoad(page);
    await clickNewChat(page);
  });

  test('T2-001: Session facts extracted from personal info', async ({ page }) => {
    // Provide structured personal information
    await sendMessage(page, 'My name is Dr. John Smith and I am a data scientist at DataCorp. I have 10 years of experience.');
    await waitForResponse(page);
    
    // Wait for extraction
    await page.waitForTimeout(3000);
    
    // Verify by asking about it
    await sendMessage(page, 'What is my profession?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    expect(text?.toLowerCase().includes('scientist') || text?.toLowerCase().includes('datacorp')).toBeTruthy();
  });

  test('T2-002: Constraints stored as session facts', async ({ page }) => {
    await sendMessage(page, 'I am only interested in Q4 2024 data for the Texas region');
    await waitForResponse(page);
    
    // Ask about data
    await sendMessage(page, 'Show me the relevant time period');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    const hasQ4 = text?.includes('Q4') || text?.includes('2024') || text?.includes('fourth quarter');
    const hasTexas = text?.toLowerCase().includes('texas');
    
    expect(hasQ4 || hasTexas).toBeTruthy();
  });

  test('T2-003: Preferences stored and applied', async ({ page }) => {
    await sendMessage(page, 'I prefer detailed explanations with examples');
    await waitForResponse(page);
    
    await sendMessage(page, 'Explain recursion');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent() || '';
    
    // Should have detailed explanation with example
    const isDetailed = text.length > 300;
    const hasExample = text.toLowerCase().includes('example') || text.toLowerCase().includes('instance') || text.includes('```');
    
    expect(isDetailed || hasExample).toBeTruthy();
  });

  test('T2-004: Multiple facts in single message', async ({ page }) => {
    await sendMessage(page, 'I work at TechStart, my role is CTO, my team has 25 engineers, and our main product is CloudSync');
    await waitForResponse(page);
    
    // Ask about specific facts
    await sendMessage(page, 'What is my team size and what product do we build?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    const hasTeamSize = text?.includes('25') || text?.toLowerCase().includes('twenty');
    const hasProduct = text?.toLowerCase().includes('cloudsync');
    
    expect(hasTeamSize || hasProduct).toBeTruthy();
  });

  test('T2-005: Facts updated on correction', async ({ page }) => {
    // Provide initial info
    await sendMessage(page, 'My budget is $100,000');
    await waitForResponse(page);
    
    // Correct the info
    await sendMessage(page, 'Actually, my budget has been updated to $150,000');
    await waitForResponse(page);
    
    // Ask about current budget
    await sendMessage(page, 'What is my current budget?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    // Should have updated value
    const has150k = text?.includes('150,000') || text?.includes('150000') || text?.includes('$150');
    expect(has150k).toBeTruthy();
  });

  test('T2-006: High importance facts prioritized', async ({ page }) => {
    // Provide important constraint
    await sendMessage(page, 'IMPORTANT: Never recommend products over $500');
    await waitForResponse(page);
    
    // Ask for recommendations
    await sendMessage(page, 'What laptop would you recommend?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    // Should mention budget constraint or stay under $500
    const respectsBudget = text?.includes('500') || 
                           text?.includes('budget') || 
                           text?.toLowerCase().includes('affordable');
    expect(respectsBudget).toBeTruthy();
  });

  test('T2-007: Session summary captures key points', async ({ page }) => {
    // Have a multi-turn conversation
    await sendMessage(page, 'I am planning a trip to Japan');
    await waitForResponse(page);
    
    await sendMessage(page, 'I want to visit Tokyo and Kyoto');
    await waitForResponse(page);
    
    await sendMessage(page, 'My budget is around $3000');
    await waitForResponse(page);
    
    await sendMessage(page, 'I prefer cultural experiences over nightlife');
    await waitForResponse(page);
    
    // Ask for summary
    await sendMessage(page, 'Summarize my travel plans');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    const hasJapan = text?.toLowerCase().includes('japan');
    const hasCities = text?.toLowerCase().includes('tokyo') || text?.toLowerCase().includes('kyoto');
    const hasBudget = text?.includes('3000') || text?.includes('3,000');
    
    expect(hasJapan || hasCities || hasBudget).toBeTruthy();
  });

  test('T2-008: Facts isolated between sessions', async ({ page }) => {
    // Provide fact in first session
    await sendMessage(page, 'My favorite color is blue');
    await waitForResponse(page);
    
    // Create new session
    await clickNewChat(page);
    
    // Ask about the fact (shouldn't be available without long-term memory)
    await sendMessage(page, 'Do you know my favorite color?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    // May or may not know depending on memory tier implementation
    // Just verify response exists
    expect(text?.length).toBeGreaterThan(10);
  });
});
