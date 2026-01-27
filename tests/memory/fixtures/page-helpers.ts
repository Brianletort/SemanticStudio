/**
 * Page Helpers for SemanticStudio E2E Tests
 * 
 * Provides helper functions with correct selectors for the SemanticStudio UI.
 */

import { type Page, expect } from '@playwright/test';

export const BASE_URL = 'http://localhost:3000';
export const RESPONSE_TIMEOUT = 60000;

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

/**
 * Send a message in the chat
 * Uses Enter key to submit since the button can be intercepted
 */
export async function sendMessage(page: Page, message: string) {
  // Find the chat input - SemanticStudio uses "Ask anything about your business data..."
  const input = page.locator('textarea[placeholder*="Ask anything"]');
  await input.fill(message);
  
  // Wait a moment for input to be processed
  await page.waitForTimeout(300);
  
  // Press Enter to send (more reliable than clicking)
  await input.press('Enter');
  
  // Wait for initial processing
  await page.waitForTimeout(1000);
}

/**
 * Wait for AI response to complete
 */
export async function waitForResponse(page: Page, timeout: number = RESPONSE_TIMEOUT) {
  // Wait for the send button to become disabled (indicating processing)
  // then wait for it to become enabled again, or for response content to appear
  try {
    // First, wait for any loading state
    await page.waitForTimeout(2000);
    
    // Look for the response area having new content
    const responseContent = page.locator('text=/received|Here|I can|Let me|Based on/i');
    await responseContent.first().waitFor({ state: 'visible', timeout });
  } catch {
    // Response may have appeared differently
    await page.waitForTimeout(2000);
  }
}

/**
 * Click the New Chat button to create a new session
 */
export async function clickNewChat(page: Page) {
  // SemanticStudio has both "New chat" and "New Chat" buttons
  const newChatButton = page.locator('button:has-text("New chat")').first();
  await newChatButton.click();
  await page.waitForTimeout(500);
}

/**
 * Get the welcome heading element
 */
export function getWelcomeHeading(page: Page) {
  return page.locator('h2:has-text("Welcome to SemanticStudio")');
}

/**
 * Get the chat history heading element
 */
export function getChatHistoryHeading(page: Page) {
  return page.locator('h2:has-text("Chat History")');
}

/**
 * Get the main chat input
 */
export function getChatInput(page: Page) {
  return page.locator('textarea[placeholder*="Ask anything"]');
}

/**
 * Get the send button
 */
export function getSendButton(page: Page) {
  return page.locator('button:has(svg)').last();
}

/**
 * Get all session items in sidebar
 */
export function getSessionItems(page: Page) {
  // Session items are buttons in the sidebar area, usually collapsed
  return page.locator('[class*="session"], button[class*="truncate"]');
}

/**
 * Get the agent trace heading
 */
export function getAgentTraceHeading(page: Page) {
  return page.locator('h3:has-text("Agent Trace")');
}

/**
 * Get the mode selector
 */
export function getModeSelector(page: Page) {
  return page.locator('combobox[name="Auto"], button:has-text("Auto"), [role="combobox"]');
}

/**
 * Navigate to settings page
 */
export async function navigateToSettings(page: Page) {
  await page.locator('a[href*="settings"], link:has-text("Settings")').first().click();
  await page.waitForLoadState('networkidle');
}

/**
 * Check if response contains specific text (case insensitive)
 */
export async function responseContains(page: Page, text: string): Promise<boolean> {
  const content = await page.content();
  return content.toLowerCase().includes(text.toLowerCase());
}

/**
 * Get the last assistant message
 */
export function getLastAssistantMessage(page: Page) {
  // In SemanticStudio, assistant messages appear after user messages
  // Look for response-like content patterns
  return page.locator('text=/received|Here|Based on|Let me|I can help/i').last();
}

/**
 * Get all messages in the chat
 */
export function getMessages(page: Page) {
  return page.locator('[class*="message"], [role="article"]');
}

/**
 * Wait for element with retry
 */
export async function waitForElement(
  page: Page, 
  locator: ReturnType<Page['locator']>, 
  timeout: number = 10000
): Promise<boolean> {
  try {
    await locator.waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Take a test screenshot with timestamp
 */
export async function takeTestScreenshot(page: Page, name: string) {
  const timestamp = Date.now();
  await page.screenshot({ path: `test-results/${name}-${timestamp}.png` });
}
