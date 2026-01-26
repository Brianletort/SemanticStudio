/**
 * Capture Observability Dashboard Screenshots
 * 
 * Run with: npx tsx promo/capture-observability.ts
 */

import { chromium } from 'playwright';
import * as path from 'path';

const BASE_URL = 'http://localhost:3000';
const DOCS_IMAGES_DIR = path.join(__dirname, '..', 'docs', 'images');
const VIEWPORT = { width: 1200, height: 800 };

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('📸 Capturing Observability Dashboard Screenshots (Dark Mode)\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ 
    viewport: VIEWPORT,
    colorScheme: 'dark'
  });
  const page = await context.newPage();
  
  // Force dark theme via localStorage before navigating
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'dark');
  });

  try {
    // Navigate to observability page
    await page.goto(`${BASE_URL}/admin/observability`);
    await wait(2000); // Wait for charts to render

    // 1. Overview tab (default)
    console.log('📊 Capturing Overview tab...');
    await page.screenshot({ 
      path: path.join(DOCS_IMAGES_DIR, 'admin-observability.png')
    });
    console.log('✓ admin-observability.png');

    // 2. Quality Metrics tab
    console.log('📈 Capturing Quality Metrics tab...');
    await page.click('button[role="tab"]:has-text("Quality Metrics")');
    await wait(1000);
    await page.screenshot({ 
      path: path.join(DOCS_IMAGES_DIR, 'admin-observability-quality.png')
    });
    console.log('✓ admin-observability-quality.png');

    // 3. Users tab
    console.log('👥 Capturing Users tab...');
    await page.click('button[role="tab"]:has-text("Users")');
    await wait(1000);
    await page.screenshot({ 
      path: path.join(DOCS_IMAGES_DIR, 'admin-observability-users.png')
    });
    console.log('✓ admin-observability-users.png');

    console.log('\n✅ All screenshots captured!');
    console.log(`📁 Saved to: ${DOCS_IMAGES_DIR}`);

  } catch (error) {
    console.error('Error during capture:', error);
  } finally {
    await browser.close();
  }
}

main();
