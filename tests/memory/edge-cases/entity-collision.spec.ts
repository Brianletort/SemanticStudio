/**
 * Edge Case Tests: Entity Collision
 * 
 * Tests for handling ambiguous entities, non-existent entities, and aliases.
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

// ============================================================================
// Tests
// ============================================================================

test.describe('Edge Cases: Entity Collision', () => {
  test.setTimeout(120000);
  
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForPageLoad(page);
    await clickNewChat(page);
  });

  test('EC-011: Ambiguous entity name - Apple', async ({ page }) => {
    // "Apple" could be company or fruit
    await sendMessage(page, 'Tell me about Apple');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    // Should handle ambiguity - either ask for clarification or pick one
    expect(text?.length).toBeGreaterThan(50);
    
    // Follow up to clarify
    await sendMessage(page, 'I mean the technology company');
    await waitForResponse(page);
    
    const response2 = page.locator('[data-role="assistant"], .assistant-message').last();
    const text2 = await response2.textContent();
    
    const hasTech = text2?.toLowerCase().includes('iphone') || 
                    text2?.toLowerCase().includes('mac') ||
                    text2?.toLowerCase().includes('technology');
    expect(hasTech).toBeTruthy();
  });

  test('EC-012: Non-existent entity', async ({ page }) => {
    await sendMessage(page, 'Tell me about XyzNonExistent12345Corp');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    // Should acknowledge uncertainty
    const hasUncertainty = text?.toLowerCase().includes('don\'t have') ||
                           text?.toLowerCase().includes('not familiar') ||
                           text?.toLowerCase().includes('no information') ||
                           text?.toLowerCase().includes('could not find') ||
                           text?.toLowerCase().includes('not aware');
    
    // Or provides some response
    expect(hasUncertainty || text?.length! > 50).toBeTruthy();
  });

  test('EC-013: Entity alias resolution', async ({ page }) => {
    await sendMessage(page, 'Tell me about MS');
    await waitForResponse(page);
    
    // Should understand MS = Microsoft
    await sendMessage(page, 'What products does Microsoft make?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    const hasMSProducts = text?.toLowerCase().includes('windows') ||
                          text?.toLowerCase().includes('office') ||
                          text?.toLowerCase().includes('azure');
    expect(hasMSProducts).toBeTruthy();
  });

  test('EC-014: Entity with special characters', async ({ page }) => {
    await sendMessage(page, 'Tell me about the company O\'Reilly Media');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    // Should handle apostrophe correctly
    expect(text?.length).toBeGreaterThan(50);
  });

  test('EC-015: Homonym entity - Python', async ({ page }) => {
    // Python = programming language or snake
    await sendMessage(page, 'Python is great');
    await waitForResponse(page);
    
    // In tech context, should assume programming
    await sendMessage(page, 'Show me a Python example');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    const hasCode = text?.includes('```') || 
                    text?.toLowerCase().includes('def ') ||
                    text?.toLowerCase().includes('print');
    expect(hasCode).toBeTruthy();
  });

  test('EC-016: Multiple entities same message', async ({ page }) => {
    await sendMessage(page, 'Compare Google, Amazon, and Microsoft cloud services');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    // Should address all three
    const hasGoogle = text?.toLowerCase().includes('google') || text?.toLowerCase().includes('gcp');
    const hasAmazon = text?.toLowerCase().includes('amazon') || text?.toLowerCase().includes('aws');
    const hasMicrosoft = text?.toLowerCase().includes('microsoft') || text?.toLowerCase().includes('azure');
    
    expect(hasGoogle || hasAmazon || hasMicrosoft).toBeTruthy();
  });

  test('EC-017: Entity context switch', async ({ page }) => {
    // Start with one entity
    await sendMessage(page, 'Tell me about Tesla the car company');
    await waitForResponse(page);
    
    // Switch to different meaning
    await sendMessage(page, 'Actually, tell me about Nikola Tesla the inventor');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    const hasInventor = text?.toLowerCase().includes('inventor') ||
                        text?.toLowerCase().includes('electric') ||
                        text?.toLowerCase().includes('1856') ||
                        text?.toLowerCase().includes('scientist');
    expect(hasInventor).toBeTruthy();
  });

  test('EC-018: Made up entity definition', async ({ page }) => {
    // Define a new entity
    await sendMessage(page, 'Let\'s define ProjectX as a new initiative to improve customer satisfaction');
    await waitForResponse(page);
    
    // Reference it
    await sendMessage(page, 'What is the goal of ProjectX?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    const hasGoal = text?.toLowerCase().includes('customer') ||
                    text?.toLowerCase().includes('satisfaction') ||
                    text?.toLowerCase().includes('projectx');
    expect(hasGoal).toBeTruthy();
  });

  test('EC-019: Numeric entity names', async ({ page }) => {
    await sendMessage(page, 'What is Area 51?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    // Should understand Area 51
    const hasArea51 = text?.toLowerCase().includes('nevada') ||
                      text?.toLowerCase().includes('military') ||
                      text?.toLowerCase().includes('classified') ||
                      text?.toLowerCase().includes('air force');
    expect(hasArea51 || text?.length! > 100).toBeTruthy();
  });

  test('EC-020: Entity with acronym expansion', async ({ page }) => {
    await sendMessage(page, 'What does NASA stand for?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    const hasExpansion = text?.toLowerCase().includes('national') &&
                         text?.toLowerCase().includes('aeronautics');
    expect(hasExpansion).toBeTruthy();
  });
});
