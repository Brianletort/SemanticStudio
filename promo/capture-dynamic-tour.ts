/**
 * AgentKit Dynamic Demo Video
 * 
 * Shows live chat interactions, agent traces, different modes, and image generation
 * Run with: npx tsx promo/capture-dynamic-tour.ts
 */

import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots-dynamic');
const VIEWPORT = { width: 1920, height: 1080 };

// Clear and recreate screenshot directory
if (fs.existsSync(SCREENSHOT_DIR)) {
  fs.rmSync(SCREENSHOT_DIR, { recursive: true });
}
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let screenshotCounter = 0;

async function screenshot(page: Page, name: string) {
  screenshotCounter++;
  const filename = `demo-${String(screenshotCounter).padStart(3, '0')}-${name}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath });
  console.log(`✓ ${filename}`);
  return filepath;
}

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function selectMode(page: Page, mode: string) {
  const modeSelector = page.locator('button:has-text("Auto"), button:has-text("Quick"), button:has-text("Think"), button:has-text("Deep"), button:has-text("Research")').first();
  await modeSelector.click().catch(() => {});
  await wait(200);
  await page.click(`div[role="option"]:has-text("${mode}")`).catch(() => {});
  await wait(200);
}

async function typeAndSubmit(page: Page, query: string) {
  const chatInput = page.locator('textarea[placeholder*="Ask anything"]');
  await chatInput.fill(query);
  await wait(300);
  // Press Enter to submit
  await chatInput.press('Enter');
}

async function waitForResponse(page: Page, maxWait: number = 30000) {
  // Wait for response to start streaming
  await wait(1000);
  
  // Wait for streaming to complete (look for the loading indicator to disappear)
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    const isLoading = await page.locator('svg.animate-spin').count() > 0;
    if (!isLoading) {
      await wait(500); // Give it a moment to fully render
      break;
    }
    await wait(500);
  }
}

async function main() {
  console.log('🎬 AgentKit Dynamic Demo - Live Chat Interactions\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--force-dark-mode']
  });
  const context = await browser.newContext({ 
    viewport: VIEWPORT,
    colorScheme: 'dark'
  });
  const page = await context.newPage();

  try {
    // ============================================
    // SCENE 1: OPENING - Welcome & Setup
    // ============================================
    console.log('\n🎬 Scene 1: Opening\n');

    await page.goto(BASE_URL);
    await wait(1000);
    await screenshot(page, 'hero-opening');

    // Open trace panel first
    await page.click('button[title*="trace"]').catch(() =>
      page.locator('button:has(svg.lucide-activity)').click()
    );
    await wait(500);
    await screenshot(page, 'trace-panel-ready');

    // ============================================
    // SCENE 2: QUICK MODE - Fast Response
    // ============================================
    console.log('\n🎬 Scene 2: Quick Mode Demo\n');

    await selectMode(page, 'Quick');
    await screenshot(page, 'quick-mode-selected');

    // Type a simple query
    await typeAndSubmit(page, 'What is our current customer count?');
    await screenshot(page, 'quick-query-sent');

    // Capture during streaming
    await wait(2000);
    await screenshot(page, 'quick-streaming');

    // Wait for response
    await waitForResponse(page, 15000);
    await screenshot(page, 'quick-response-complete');

    // ============================================
    // SCENE 3: THINK MODE - With Reflection
    // ============================================
    console.log('\n🎬 Scene 3: Think Mode with Agent Trace\n');

    // New chat
    await page.click('button:has-text("New Chat")');
    await wait(500);

    await selectMode(page, 'Think');
    await screenshot(page, 'think-mode-selected');

    // More complex query
    await typeAndSubmit(page, 'Analyze the relationship between customer satisfaction scores and revenue growth across our top segments');
    await screenshot(page, 'think-query-sent');

    // Capture streaming with trace
    await wait(3000);
    await screenshot(page, 'think-streaming-trace');
    
    await wait(3000);
    await screenshot(page, 'think-streaming-mid');

    await waitForResponse(page, 45000);
    await screenshot(page, 'think-response-with-trace');

    // ============================================
    // SCENE 4: DEEP MODE - Comprehensive Analysis
    // ============================================
    console.log('\n🎬 Scene 4: Deep Mode - Graph Traversal\n');

    await page.click('button:has-text("New Chat")');
    await wait(500);

    await selectMode(page, 'Deep');
    await screenshot(page, 'deep-mode-selected');

    // Enable web search for this one
    const webSwitch = page.locator('button[role="switch"]').first();
    await webSwitch.click();
    await wait(200);
    await screenshot(page, 'deep-web-enabled');

    await typeAndSubmit(page, 'Compare our Q4 performance against industry benchmarks and identify areas for improvement');
    await screenshot(page, 'deep-query-sent');

    await wait(4000);
    await screenshot(page, 'deep-streaming-agents');

    await wait(5000);
    await screenshot(page, 'deep-streaming-mid');

    await waitForResponse(page, 60000);
    await screenshot(page, 'deep-response-complete');

    // ============================================
    // SCENE 5: RESEARCH MODE - In-Depth Investigation
    // ============================================
    console.log('\n🎬 Scene 5: Research Mode\n');

    await page.click('button:has-text("New Chat")');
    await wait(500);

    await selectMode(page, 'Research');
    await screenshot(page, 'research-mode-selected');

    await typeAndSubmit(page, 'What are the key factors driving churn in our enterprise customer segment and what strategies should we consider?');
    await screenshot(page, 'research-query-sent');

    await wait(5000);
    await screenshot(page, 'research-streaming');

    await waitForResponse(page, 90000);
    await screenshot(page, 'research-response-complete');

    // ============================================
    // SCENE 6: IMAGE GENERATION
    // ============================================
    console.log('\n🎬 Scene 6: Image Generation\n');

    await page.click('button:has-text("New Chat")');
    await wait(500);
    await screenshot(page, 'image-new-chat');

    // Open attachment menu and select image mode
    await page.click('button[title*="Add files"]').catch(() =>
      page.locator('button:has(svg.lucide-plus)').first().click().catch(() =>
        page.locator('button:has(svg.lucide-paperclip)').first().click()
      )
    );
    await wait(400);
    await screenshot(page, 'image-menu-open');

    // Click image generation option
    await page.locator('button:has-text("Create image"), button:has-text("Image"), div:has-text("Generate")').first().click().catch(() => {});
    await wait(500);
    await screenshot(page, 'image-mode-selected');

    // Type image prompt
    const chatInput = page.locator('textarea[placeholder*="Ask anything"], textarea[placeholder*="Describe"]');
    await chatInput.fill('Create a professional infographic showing a RAG (Retrieval Augmented Generation) chat system architecture with: 1) User query input, 2) Vector database retrieval, 3) Context injection, 4) LLM processing, 5) Response generation. Use a clean, modern tech style with blue and purple gradients.');
    await wait(300);
    await screenshot(page, 'image-prompt-typed');

    // Submit
    await chatInput.press('Enter');
    await wait(1000);
    await screenshot(page, 'image-generating');

    // Wait for image generation (can take 30-60 seconds)
    await wait(10000);
    await screenshot(page, 'image-progress-1');
    
    await wait(15000);
    await screenshot(page, 'image-progress-2');

    // Wait for completion
    await waitForResponse(page, 120000);
    await screenshot(page, 'image-complete');

    // ============================================
    // SCENE 7: SESSION HISTORY
    // ============================================
    console.log('\n🎬 Scene 7: Session History\n');

    // Expand session pane to show all the chats we created
    await page.locator('button[aria-expanded="false"]').first().click().catch(() => {});
    await wait(300);
    await screenshot(page, 'sessions-expanded');

    // Click through a couple previous sessions
    const sessionButtons = page.locator('button:has-text("What is our"), button:has-text("Analyze"), button:has-text("Compare")');
    const sessionCount = await sessionButtons.count();
    
    if (sessionCount > 0) {
      await sessionButtons.first().click().catch(() => {});
      await wait(800);
      await screenshot(page, 'session-history-1');
    }

    if (sessionCount > 1) {
      await sessionButtons.nth(1).click().catch(() => {});
      await wait(800);
      await screenshot(page, 'session-history-2');
    }

    // ============================================
    // SCENE 8: ADMIN QUICK TOUR
    // ============================================
    console.log('\n🎬 Scene 8: Admin Quick Tour\n');

    await page.goto(`${BASE_URL}/admin`);
    await wait(600);
    await screenshot(page, 'admin-dashboard');

    await page.goto(`${BASE_URL}/admin/agents`);
    await wait(1000);
    await screenshot(page, 'admin-agents');

    await page.goto(`${BASE_URL}/admin/modes`);
    await wait(1000);
    await screenshot(page, 'admin-modes-pipeline');

    await page.goto(`${BASE_URL}/admin/graph`);
    await wait(2500);
    await screenshot(page, 'admin-graph');

    // Click on graph node
    const canvas = page.locator('canvas').first();
    if (await canvas.isVisible()) {
      const box = await canvas.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.5);
        await wait(800);
        await screenshot(page, 'graph-node-details');
      }
    }

    // ============================================
    // SCENE 9: CLOSING
    // ============================================
    console.log('\n🎬 Scene 9: Closing\n');

    await page.goto(BASE_URL);
    await wait(800);
    await screenshot(page, 'closing-hero');

    console.log(`\n✅ Dynamic demo capture complete!`);
    console.log(`📊 Total screenshots: ${screenshotCounter}`);
    console.log(`📁 Saved to: ${SCREENSHOT_DIR}`);

  } catch (error) {
    console.error('Error:', error);
    await screenshot(page, 'error-state');
  } finally {
    await browser.close();
  }
}

main();
