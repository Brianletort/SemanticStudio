/**
 * Tier 1: Working Context Tests
 * 
 * Tests for recent messages, session context, and progressive summarization.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  BASE_URL,
  RESPONSE_TIMEOUT,
  waitForPageLoad,
  sendMessage,
  waitForResponse,
  clickNewChat,
} from '../fixtures/page-helpers';

// ============================================================================
// Tests
// ============================================================================

test.describe('Tier 1: Working Context', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForPageLoad(page);
    await clickNewChat(page);
  });

  test('T1-001: Recent messages retained in context', async ({ page }) => {
    // Send initial information
    await sendMessage(page, 'My name is Alice and I work at TechCorp');
    await waitForResponse(page);
    
    await sendMessage(page, 'I manage the engineering team of 15 people');
    await waitForResponse(page);
    
    // Ask about the context
    await sendMessage(page, 'What do you know about me?');
    await waitForResponse(page);
    
    // Verify response mentions the provided info
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    const hasAlice = text?.toLowerCase().includes('alice');
    const hasTechCorp = text?.toLowerCase().includes('techcorp');
    const hasEngineering = text?.toLowerCase().includes('engineer');
    
    expect(hasAlice || hasTechCorp || hasEngineering).toBeTruthy();
  });

  test('T1-002: Context continuity across turns', async ({ page }) => {
    // Provide information in stages
    await sendMessage(page, 'I am working on a project called Project Phoenix');
    await waitForResponse(page);
    
    await sendMessage(page, 'The project deadline is March 15th');
    await waitForResponse(page);
    
    await sendMessage(page, 'The budget is $500,000');
    await waitForResponse(page);
    
    // Ask combined question
    await sendMessage(page, 'Summarize what you know about my project');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    // Should mention project details
    const hasPhoenix = text?.toLowerCase().includes('phoenix');
    const hasMarch = text?.toLowerCase().includes('march') || text?.includes('15');
    const hasBudget = text?.includes('500') || text?.toLowerCase().includes('budget');
    
    expect(hasPhoenix || hasMarch || hasBudget).toBeTruthy();
  });

  test('T1-003: Session maintains topic context', async ({ page }) => {
    // Establish topic
    await sendMessage(page, 'Let us discuss Python programming');
    await waitForResponse(page);
    
    // Follow-up without explicitly mentioning Python
    await sendMessage(page, 'How do I define a function?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    // Should answer in Python context
    const hasDef = text?.toLowerCase().includes('def ') || text?.toLowerCase().includes('python');
    expect(hasDef).toBeTruthy();
  });

  test('T1-004: Pronoun resolution works', async ({ page }) => {
    await sendMessage(page, 'Tell me about the Eiffel Tower');
    await waitForResponse(page);
    
    await sendMessage(page, 'How tall is it?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    // Should understand "it" refers to Eiffel Tower
    const hasHeight = text?.includes('meter') || text?.includes('feet') || text?.includes('tall') || text?.includes('300') || text?.includes('1000');
    expect(hasHeight).toBeTruthy();
  });

  test('T1-005: Preference remembering in session', async ({ page }) => {
    await sendMessage(page, 'I prefer concise answers with bullet points');
    await waitForResponse(page);
    
    await sendMessage(page, 'What are 5 benefits of exercise?');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    // Check for bullet point indicators
    const hasBullets = text?.includes('•') || text?.includes('-') || text?.includes('*') || text?.includes('1.');
    expect(hasBullets).toBeTruthy();
  });

  test('T1-006: Multi-turn clarification', async ({ page }) => {
    await sendMessage(page, 'What is a good strategy?');
    await waitForResponse(page);
    
    // The AI might ask for clarification, or answer generally
    await sendMessage(page, 'I mean for investing in the stock market');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    // Should now have context about investing
    const hasInvesting = text?.toLowerCase().includes('invest') || 
                         text?.toLowerCase().includes('stock') ||
                         text?.toLowerCase().includes('market') ||
                         text?.toLowerCase().includes('portfolio');
    expect(hasInvesting).toBeTruthy();
  });

  test('T1-007: Entity reference tracking', async ({ page }) => {
    await sendMessage(page, 'Apple is my favorite company');
    await waitForResponse(page);
    
    await sendMessage(page, 'Tell me about their latest products');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    // Should understand "their" = Apple
    const hasAppleProducts = text?.toLowerCase().includes('iphone') ||
                            text?.toLowerCase().includes('ipad') ||
                            text?.toLowerCase().includes('mac') ||
                            text?.toLowerCase().includes('apple');
    expect(hasAppleProducts).toBeTruthy();
  });

  test('T1-008: Constraint application', async ({ page }) => {
    await sendMessage(page, 'Only give me information about events after 2020');
    await waitForResponse(page);
    
    await sendMessage(page, 'Tell me about recent technological advancements');
    await waitForResponse(page);
    
    const response = page.locator('[data-role="assistant"], .assistant-message').last();
    const text = await response.textContent();
    
    // Should focus on recent events
    const hasRecent = text?.includes('2021') || 
                      text?.includes('2022') || 
                      text?.includes('2023') || 
                      text?.includes('2024') ||
                      text?.includes('2025') ||
                      text?.toLowerCase().includes('recent');
    expect(hasRecent).toBeTruthy();
  });
});
