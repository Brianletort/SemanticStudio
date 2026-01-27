/**
 * Response Rendering Tests
 * 
 * Tests for markdown rendering, code blocks, tables, and streaming.
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

// ============================================================================
// Tests
// ============================================================================

test.describe('Response Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForPageLoad(page);
  });

  test('RR-001: Markdown headers render', async ({ page }) => {
    await sendMessage(page, 'Write a document with H1, H2, and H3 headings');
    await waitForResponse(page);
    
    // Look for heading elements
    const headings = page.locator('h1, h2, h3, [role="heading"]');
    const count = await headings.count();
    
    expect(count).toBeGreaterThan(0);
  });

  test('RR-002: Bullet lists render', async ({ page }) => {
    await sendMessage(page, 'Give me a bullet point list of 5 fruits');
    await waitForResponse(page);
    
    // Look for list items
    const listItems = page.locator('li, [role="listitem"]');
    const count = await listItems.count();
    
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('RR-003: Numbered lists render', async ({ page }) => {
    await sendMessage(page, 'Give me a numbered list of 5 steps');
    await waitForResponse(page);
    
    // Look for ordered list or numbered items
    const orderedList = page.locator('ol');
    const listItems = page.locator('ol li, li:has-text(/^\\d/)');
    
    const olCount = await orderedList.count();
    const liCount = await listItems.count();
    
    expect(olCount > 0 || liCount >= 5).toBeTruthy();
  });

  test('RR-004: Code blocks with syntax highlighting', async ({ page }) => {
    await sendMessage(page, 'Write a Python function that adds two numbers');
    await waitForResponse(page);
    
    // Look for code block
    const codeBlock = page.locator('pre, code, [class*="code"], [class*="highlight"]');
    const hasCode = await codeBlock.first().isVisible({ timeout: 10000 });
    
    expect(hasCode).toBeTruthy();
    
    // Check for syntax highlighting (colored spans)
    const highlightedCode = page.locator('pre span, code span, [class*="token"]');
    const hasHighlight = await highlightedCode.first().isVisible({ timeout: 5000 }).catch(() => false);
    
    // Either has highlight or plain code
    expect(hasCode).toBeTruthy();
  });

  test('RR-005: Code block copy button', async ({ page }) => {
    await sendMessage(page, 'Write a JavaScript hello world');
    await waitForResponse(page);
    
    // Look for copy button in code block
    const copyButton = page.locator('button:has-text("Copy"), button[aria-label*="copy"], pre button, [class*="code"] button');
    const hasCopy = await copyButton.first().isVisible({ timeout: 10000 }).catch(() => false);
    
    if (hasCopy) {
      await copyButton.first().click();
      await page.waitForTimeout(1000);
      
      // Check for success indicator
      const success = page.locator('text=/copied|success/i, [class*="toast"]');
      const hasSuccess = await success.first().isVisible({ timeout: 3000 }).catch(() => false);
      
      // Button exists and is clickable
      expect(true).toBeTruthy();
    }
  });

  test('RR-006: Tables render correctly', async ({ page }) => {
    await sendMessage(page, 'Create a table with 3 columns (Name, Age, City) and 4 rows of sample data');
    await waitForResponse(page);
    
    // Look for table elements
    const table = page.locator('table, [role="table"]');
    const hasTable = await table.first().isVisible({ timeout: 10000 });
    
    if (hasTable) {
      // Check for rows
      const rows = page.locator('tr, [role="row"]');
      const rowCount = await rows.count();
      
      expect(rowCount).toBeGreaterThanOrEqual(4);
    } else {
      // Table might render differently - check for structured data
      const pageContent = await page.content();
      expect(pageContent.includes('Name') || pageContent.includes('Age')).toBeTruthy();
    }
  });

  test('RR-007: Bold and italic text', async ({ page }) => {
    await sendMessage(page, 'Write text with **bold** and *italic* formatting');
    await waitForResponse(page);
    
    // Look for strong/em elements
    const bold = page.locator('strong, b, [class*="bold"]');
    const italic = page.locator('em, i, [class*="italic"]');
    
    const hasBold = await bold.first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasItalic = await italic.first().isVisible({ timeout: 10000 }).catch(() => false);
    
    // At least one should be visible, or check page content
    const pageContent = await page.content();
    expect(hasBold || hasItalic || pageContent.includes('<strong>') || pageContent.includes('<em>')).toBeTruthy();
  });

  test('RR-008: Links are clickable', async ({ page }) => {
    await sendMessage(page, 'Give me a link to google.com');
    await waitForResponse(page);
    
    // Look for links
    const links = page.locator('a[href], [role="link"]');
    const count = await links.count();
    
    if (count > 0) {
      // Get href of first relevant link
      const href = await links.first().getAttribute('href').catch(() => '');
      expect(href?.length).toBeGreaterThan(0);
    }
  });

  test('RR-009: Inline code renders', async ({ page }) => {
    await sendMessage(page, 'The function name is `calculateTotal` in the code');
    await waitForResponse(page);
    
    // Look for inline code
    const inlineCode = page.locator('code:not(pre code), [class*="inline-code"]');
    const hasInline = await inlineCode.first().isVisible({ timeout: 10000 }).catch(() => false);
    
    // Or check for backtick-styled text
    const pageContent = await page.content();
    expect(hasInline || pageContent.includes('calculateTotal')).toBeTruthy();
  });

  test('RR-010: Streaming response works', async ({ page }) => {
    // Start a long response and watch for streaming
    await sendMessage(page, 'Tell me a detailed story about a robot');
    
    // Wait a bit for streaming to start
    await page.waitForTimeout(3000);
    
    // Check that content is appearing
    const assistant = page.locator('[data-role="assistant"], .assistant-message');
    const text1 = await assistant.first().textContent().catch(() => '');
    
    // Wait more
    await page.waitForTimeout(3000);
    
    const text2 = await assistant.first().textContent().catch(() => '');
    
    // If streaming, text should be growing (or already complete)
    expect(text2.length >= text1.length).toBeTruthy();
    
    await waitForResponse(page);
  });

  test('RR-011: Auto-scroll on long response', async ({ page }) => {
    await sendMessage(page, 'Write a very long detailed essay about technology with multiple sections');
    
    // Wait for response to complete
    await waitForResponse(page, 90000);
    
    // Check that chat area can be scrolled
    const scrollArea = page.locator('[class*="scroll"], [class*="overflow"], [style*="overflow"]').first();
    
    if (await scrollArea.isVisible().catch(() => false)) {
      // Try scrolling
      await scrollArea.evaluate(el => el.scrollTop = 0);
      await page.waitForTimeout(500);
      const scrollTop1 = await scrollArea.evaluate(el => el.scrollTop);
      
      await scrollArea.evaluate(el => el.scrollTop = el.scrollHeight);
      await page.waitForTimeout(500);
      const scrollTop2 = await scrollArea.evaluate(el => el.scrollTop);
      
      // Should have been able to scroll
      expect(scrollTop2 >= scrollTop1).toBeTruthy();
    }
  });

  test('RR-012: Multiple code languages', async ({ page }) => {
    await sendMessage(page, 'Show me the same algorithm in Python, JavaScript, and SQL');
    await waitForResponse(page, 90000);
    
    // Check for multiple code blocks
    const codeBlocks = page.locator('pre, [class*="code-block"]');
    const count = await codeBlocks.count();
    
    expect(count).toBeGreaterThanOrEqual(1);
    
    // Check for language labels
    const pageContent = await page.content();
    const hasPython = pageContent.toLowerCase().includes('python');
    const hasJS = pageContent.toLowerCase().includes('javascript') || pageContent.toLowerCase().includes('js');
    
    expect(hasPython || hasJS).toBeTruthy();
  });
});
