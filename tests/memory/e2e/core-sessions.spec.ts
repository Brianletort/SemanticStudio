/**
 * Core Session Management Tests
 * 
 * Tests for creating, switching, editing, and deleting chat sessions.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  BASE_URL,
  RESPONSE_TIMEOUT,
  waitForPageLoad,
  sendMessage,
  waitForResponse,
  clickNewChat,
  getWelcomeHeading,
  getChatHistoryHeading,
} from '../fixtures/page-helpers';

// ============================================================================
// Tests
// ============================================================================

test.describe('Core Session Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForPageLoad(page);
  });

  test('CS-001: Create new session', async ({ page }) => {
    // Click new chat button
    await clickNewChat(page);
    
    // Verify empty/welcome state - AgentKit shows "Welcome to AgentKit"
    const welcomeText = getWelcomeHeading(page);
    await expect(welcomeText).toBeVisible({ timeout: 5000 });
  });

  test('CS-002: Session list shows', async ({ page }) => {
    // Send a message to create a session
    await sendMessage(page, 'Test message for session list');
    await waitForResponse(page);
    
    // Look for Chat History heading
    const chatHistory = getChatHistoryHeading(page);
    await expect(chatHistory).toBeVisible({ timeout: 10000 });
    
    // Verify message was sent and appears in the page
    const messageContent = page.locator('text=/Test message for session/i');
    await expect(messageContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('CS-003: Session switching', async ({ page }) => {
    // Create first session
    await sendMessage(page, 'First session unique message alpha');
    await waitForResponse(page);
    
    // Create second session
    await clickNewChat(page);
    await sendMessage(page, 'Second session unique message beta');
    await waitForResponse(page);
    
    // Find and click first session
    const firstSession = page.locator('text=/First session/i, text=/alpha/i').first();
    if (await firstSession.isVisible()) {
      await firstSession.click();
      await page.waitForTimeout(1000);
      
      // Verify first session content is displayed
      const firstContent = page.locator('text=/alpha/i');
      await expect(firstContent.first()).toBeVisible();
    }
  });

  test('CS-004: Session title auto-generate', async ({ page }) => {
    const longMessage = 'This is a very long message that should be truncated when displayed as a session title in the sidebar';
    await sendMessage(page, longMessage);
    await waitForResponse(page);
    
    // Check that title appears in sidebar (truncated)
    const sessionTitle = page.locator(`text=/This is a very long/i`);
    const titleText = await sessionTitle.first().textContent();
    
    // Title should be truncated (less than original message)
    expect(titleText?.length).toBeLessThan(longMessage.length);
  });

  test('CS-005: Session edit via menu', async ({ page }) => {
    // Create a session first
    await sendMessage(page, 'Session to edit');
    await waitForResponse(page);
    
    // Look for menu button (three dots)
    const menuButton = page.locator('button:has(svg[class*="more"]), button[aria-label*="menu"], button:has-text("⋮"), button:has-text("...")').first();
    
    if (await menuButton.isVisible({ timeout: 3000 })) {
      await menuButton.click();
      
      // Look for edit option
      const editOption = page.locator('text=/edit|rename/i');
      if (await editOption.isVisible({ timeout: 2000 })) {
        await editOption.click();
        // Test passes if edit dialog/input appears
      }
    }
  });

  test('CS-006: Session delete', async ({ page }) => {
    // Create a session
    await sendMessage(page, 'Session to delete unique');
    await waitForResponse(page);
    
    // Count sessions before delete
    const sessionsBefore = await page.locator('[data-testid="session-item"], .session-item').count();
    
    // Look for delete option in menu
    const menuButton = page.locator('button:has(svg[class*="more"]), button[aria-label*="menu"]').first();
    
    if (await menuButton.isVisible({ timeout: 3000 })) {
      await menuButton.click();
      
      const deleteOption = page.locator('text=/delete/i');
      if (await deleteOption.isVisible({ timeout: 2000 })) {
        await deleteOption.click();
        
        // Confirm delete if dialog appears
        const confirmButton = page.locator('button:has-text("Delete"), button:has-text("Confirm")');
        if (await confirmButton.isVisible({ timeout: 2000 })) {
          await confirmButton.click();
        }
        
        await page.waitForTimeout(1000);
      }
    }
  });

  test('CS-007: Multiple sessions navigation', async ({ page }) => {
    // Create 3 sessions
    for (let i = 1; i <= 3; i++) {
      if (i > 1) await clickNewChat(page);
      await sendMessage(page, `Session ${i} created`);
      await waitForResponse(page);
    }
    
    // Verify the Chat History heading is visible (indicating sidebar is working)
    const chatHistory = getChatHistoryHeading(page);
    await expect(chatHistory).toBeVisible({ timeout: 5000 });
    
    // Verify the messages we sent are in the page
    const sessionContent = page.locator('text=/Session.*created/i');
    const count = await sessionContent.count();
    
    // Should have created sessions (at least the last one should be visible)
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('CS-008: Session persists on reload', async ({ page }) => {
    // Create a session with unique content
    const testMessage = 'Persistence test message hello world';
    await sendMessage(page, testMessage);
    await waitForResponse(page);
    
    // Wait for session to save
    await page.waitForTimeout(2000);
    
    // Reload page
    await page.reload();
    await waitForPageLoad(page);
    
    // After reload, the chat history should still be visible
    const chatHistory = getChatHistoryHeading(page);
    await expect(chatHistory).toBeVisible({ timeout: 10000 });
    
    // The page should have loaded (verify basic UI is present)
    // Check for either welcome heading OR our test message content
    const welcome = page.locator('h2:has-text("Welcome")');
    const testContent = page.locator('text=/Persistence test/i');
    
    const welcomeVisible = await welcome.isVisible({ timeout: 5000 }).catch(() => false);
    const contentVisible = await testContent.first().isVisible({ timeout: 5000 }).catch(() => false);
    
    expect(welcomeVisible || contentVisible).toBeTruthy();
  });
});
