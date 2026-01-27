/**
 * SemanticStudio Product Tour Screenshot Capture v2
 * 
 * Fast-paced, comprehensive tour showcasing all features
 * Run with: npx tsx promo/capture-tour.ts
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const VIEWPORT = { width: 1920, height: 1080 };

// Clear and recreate screenshot directory
if (fs.existsSync(SCREENSHOT_DIR)) {
  fs.rmSync(SCREENSHOT_DIR, { recursive: true });
}
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let screenshotCounter = 0;

async function screenshot(page: Page, name: string, options?: { fullPage?: boolean }) {
  screenshotCounter++;
  const filename = `tour-${String(screenshotCounter).padStart(3, '0')}-${name}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: options?.fullPage ?? false });
  console.log(`✓ ${filename}`);
  return filepath;
}

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🎬 SemanticStudio Product Tour v2 - Comprehensive Feature Showcase\n');
  
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
    // SECTION 1: CHAT INTERFACE & MODES
    // ============================================
    console.log('\n📍 Section 1: Chat Interface & Modes\n');

    // 1. Welcome/Hero shot
    await page.goto(BASE_URL);
    await wait(1000);
    await screenshot(page, 'hero-welcome');

    // 2. Show all chat modes - Quick click through each
    const modeSelector = page.locator('button:has-text("Auto")').first();
    await modeSelector.click().catch(() => {});
    await wait(300);
    await screenshot(page, 'mode-auto-selected');

    // Click through each mode quickly
    for (const mode of ['Quick', 'Think', 'Deep', 'Research']) {
      await page.click(`div[role="option"]:has-text("${mode}")`).catch(() => {});
      await wait(200);
    }
    await screenshot(page, 'mode-research-selected');
    await page.keyboard.press('Escape');

    // 3. Type a business query
    const chatInput = page.locator('textarea[placeholder*="Ask anything"]');
    await chatInput.fill('Analyze Q4 revenue trends across our top customer segments');
    await wait(300);
    await screenshot(page, 'query-typed');

    // 4. Enable Web Search
    const webSwitch = page.locator('button[role="switch"]').first();
    await webSwitch.click();
    await wait(200);
    await screenshot(page, 'web-search-enabled');

    // 5. Open Trace/Reasoning Panel
    await page.click('button[title*="trace"]').catch(() =>
      page.locator('button:has(svg.lucide-activity)').click()
    );
    await wait(300);
    await screenshot(page, 'trace-panel-open');

    // ============================================
    // SECTION 2: FILE UPLOAD & IMAGE GENERATION
    // ============================================
    console.log('\n📍 Section 2: File Upload & Image Generation\n');

    // 6. Show file attachment menu
    await page.click('button[title*="Add files"]').catch(() =>
      page.locator('button:has(svg.lucide-paperclip)').first().click().catch(() => 
        page.locator('button:has(svg.lucide-plus)').first().click()
      )
    );
    await wait(400);
    await screenshot(page, 'file-upload-menu');

    // 7. Show image generation option if available
    await page.locator('button:has-text("Image")').first().click().catch(() => {});
    await wait(300);
    await screenshot(page, 'image-generation-option');
    await page.keyboard.press('Escape');
    await wait(200);

    // ============================================
    // SECTION 3: ADMIN DASHBOARD
    // ============================================
    console.log('\n📍 Section 3: Admin Dashboard\n');

    // 8. Admin Dashboard
    await page.goto(`${BASE_URL}/admin`);
    await wait(800);
    await screenshot(page, 'admin-dashboard');

    // ============================================
    // SECTION 4: OBSERVABILITY
    // ============================================
    console.log('\n📍 Section 4: Observability\n');

    // 9. Observability page
    await page.goto(`${BASE_URL}/admin/observability`).catch(() => 
      page.click('a:has-text("Observability")').catch(() => {})
    );
    await wait(800);
    await screenshot(page, 'observability');

    // ============================================
    // SECTION 5: DOMAIN AGENTS
    // ============================================
    console.log('\n📍 Section 5: Domain Agents (28 Agents)\n');

    // 10. Domain Agents Grid
    await page.goto(`${BASE_URL}/admin/agents`);
    await wait(1200);
    await screenshot(page, 'domain-agents-grid');

    // 11. Filter by category
    await page.click('button:has-text("All categories")').catch(() => {});
    await wait(300);
    await screenshot(page, 'agents-category-dropdown');
    
    // 12. Show Customer agents
    await page.click('div[role="option"]:has-text("customer")').catch(() =>
      page.click('div[role="option"]:has-text("Customer")').catch(() => {})
    );
    await wait(400);
    await screenshot(page, 'agents-customer-category');

    // 13. Open agent edit dialog
    const editBtn = page.locator('button:has-text("Edit")').first();
    await editBtn.click().catch(() => {});
    await wait(400);
    await screenshot(page, 'agent-edit-dialog');
    await page.keyboard.press('Escape');
    await wait(200);

    // ============================================
    // SECTION 6: MODEL CONFIGURATION
    // ============================================
    console.log('\n📍 Section 6: Model Configuration\n');

    // 14. Model Config
    await page.goto(`${BASE_URL}/admin/models`);
    await wait(1000);
    await screenshot(page, 'model-config');

    // 15. Show model dropdown if available
    await page.locator('button:has-text("Select")').first().click().catch(() => {});
    await wait(300);
    await screenshot(page, 'model-selection');
    await page.keyboard.press('Escape');

    // ============================================
    // SECTION 7: MODE CONFIGURATION
    // ============================================
    console.log('\n📍 Section 7: Mode Configuration & Pipeline\n');

    // 16. Mode Config - Pipeline visualization
    await page.goto(`${BASE_URL}/admin/modes`);
    await wait(1200);
    await screenshot(page, 'mode-config-pipeline');

    // 17-20. Quick cycle through all modes
    for (const mode of ['quick', 'think', 'deep', 'research']) {
      await page.click(`button:has-text("${mode}")`).catch(() => {});
      await wait(400);
      await screenshot(page, `mode-${mode}-config`);
    }

    // ============================================
    // SECTION 8: DATA SOURCES
    // ============================================
    console.log('\n📍 Section 8: Data Sources\n');

    // 21. Data Sources
    await page.goto(`${BASE_URL}/admin/data`);
    await wait(800);
    await screenshot(page, 'data-sources');

    // ============================================
    // SECTION 9: ETL JOBS
    // ============================================
    console.log('\n📍 Section 9: ETL Jobs\n');

    // 22. ETL Jobs
    await page.goto(`${BASE_URL}/admin/etl`);
    await wait(800);
    await screenshot(page, 'etl-jobs');

    // 23. Show ETL job details/actions if available
    await page.locator('button:has-text("Run")').first().click().catch(() => {});
    await wait(300);
    await screenshot(page, 'etl-job-actions');
    await page.keyboard.press('Escape').catch(() => {});

    // ============================================
    // SECTION 10: KNOWLEDGE GRAPH (INTERACTIVE)
    // ============================================
    console.log('\n📍 Section 10: Knowledge Graph (Interactive 3D)\n');

    // 24. Knowledge Graph Overview
    await page.goto(`${BASE_URL}/admin/graph`);
    await wait(2500); // Give 3D graph time to render
    await screenshot(page, 'knowledge-graph-3d');

    // 25. Filter by node type
    await page.click('button:has-text("All Types")').catch(() => 
      page.locator('button[role="combobox"]').first().click()
    );
    await wait(300);
    await screenshot(page, 'graph-filter-dropdown');
    
    // Select a type if available
    await page.locator('div[role="option"]').first().click().catch(() => {});
    await wait(500);
    await screenshot(page, 'graph-filtered');

    // 26. Click on a node in the graph
    const canvas = page.locator('canvas').first();
    if (await canvas.isVisible()) {
      const box = await canvas.boundingBox();
      if (box) {
        // Click near center of graph
        await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
        await wait(800);
        await screenshot(page, 'graph-node-clicked');
        
        // Try clicking different areas to find nodes
        await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.4);
        await wait(600);
        await screenshot(page, 'graph-node-selected');
        
        // Show connections tab if node selected
        await page.click('button:has-text("Connections")').catch(() => {});
        await wait(400);
        await screenshot(page, 'graph-node-connections');
        
        // Show records tab
        await page.click('button:has-text("Records")').catch(() => {});
        await wait(400);
        await screenshot(page, 'graph-node-records');
      }
    }

    // 27. Zoom controls
    await page.click('button[title="Zoom In"]').catch(() => {});
    await wait(300);
    await page.click('button[title="Zoom In"]').catch(() => {});
    await wait(500);
    await screenshot(page, 'graph-zoomed');

    // ============================================
    // SECTION 11: SESSION MANAGEMENT
    // ============================================
    console.log('\n📍 Section 11: Session & Settings\n');

    // 28. Back to chat - show sessions
    await page.goto(BASE_URL);
    await wait(800);
    
    // Expand session folders
    await page.locator('button[aria-expanded="false"]').first().click().catch(() => {});
    await wait(300);
    await screenshot(page, 'session-folders');

    // 29. Settings
    await page.goto(`${BASE_URL}/settings`);
    await wait(600);
    await screenshot(page, 'settings');

    // ============================================
    // FINAL HERO SHOTS
    // ============================================
    console.log('\n📍 Final Hero Shots\n');

    // 30. Final chat hero
    await page.goto(BASE_URL);
    await wait(600);
    await screenshot(page, 'final-hero');

    console.log(`\n✅ Capture complete! ${screenshotCounter} screenshots`);
    console.log(`📁 Saved to: ${SCREENSHOT_DIR}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

main();
