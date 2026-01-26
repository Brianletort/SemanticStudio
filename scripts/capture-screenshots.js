const { chromium } = require('playwright');
const path = require('path');

const SCREENSHOTS = [
  {
    name: 'hero-chat.png',
    url: 'http://localhost:3000',
    setup: async (page) => {
      await page.waitForTimeout(1500);
      
      // Close agent trace pane first if open - click the X button in trace pane
      const closeTraceBtn = await page.$('button[title="Close"]');
      if (closeTraceBtn) await closeTraceBtn.click();
      await page.waitForTimeout(500);
      
      // Hide chat history panel - button has title="Hide panel"
      const hideBtn = await page.$('button[title="Hide panel"]');
      if (hideBtn) await hideBtn.click();
      await page.waitForTimeout(500);
    }
  },
  {
    name: 'admin-dashboard.png',
    url: 'http://localhost:3000/admin',
  },
  {
    name: 'admin-agents.png',
    url: 'http://localhost:3000/admin/agents',
    setup: async (page) => {
      await page.waitForTimeout(1500); // Wait for agents to load
    }
  },
  {
    name: 'admin-models.png',
    url: 'http://localhost:3000/admin/models',
    setup: async (page) => {
      await page.waitForTimeout(1500); // Wait for models to load
    }
  },
  {
    name: 'admin-graph.png',
    url: 'http://localhost:3000/admin/graph',
    setup: async (page) => {
      await page.waitForTimeout(2000); // Wait for 3D graph to render
    }
  },
  {
    name: 'admin-etl.png',
    url: 'http://localhost:3000/admin/etl',
  },
  {
    name: 'chat-modes.png',
    url: 'http://localhost:3000',
    setup: async (page) => {
      await page.waitForTimeout(1500);
      
      // Close agent trace pane first
      const closeTraceBtn = await page.$('button[title="Close"]');
      if (closeTraceBtn) await closeTraceBtn.click();
      await page.waitForTimeout(500);
      
      // Hide chat history panel
      const hideBtn = await page.$('button[title="Hide panel"]');
      if (hideBtn) await hideBtn.click();
      await page.waitForTimeout(500);
      
      // Click mode dropdown to open it
      const modeDropdown = await page.$('[role="combobox"]');
      if (modeDropdown) await modeDropdown.click();
      await page.waitForTimeout(500);
    }
  },
  {
    name: 'reasoning-pane.png',
    url: 'http://localhost:3000',
    viewport: { width: 1600, height: 900 }, // Wider viewport to show trace pane
    setup: async (page) => {
      await page.waitForTimeout(2000);
      
      // Hide chat history panel (but keep trace pane open - it's open by default)
      const hideBtn = await page.$('button[title="Hide panel"]');
      if (hideBtn) {
        await hideBtn.click();
        console.log('    Clicked hide panel button');
      }
      await page.waitForTimeout(500);
      
      // Enter a sample prompt to trigger the reasoning trace
      const input = await page.$('textarea');
      if (input) {
        await input.click();
        await input.fill('What are our top customers by revenue?');
        console.log('    Entered prompt');
        await page.waitForTimeout(500);
        
        // Press Enter to submit
        await page.keyboard.press('Enter');
        console.log('    Pressed Enter to submit');
        
        // Wait for the trace to populate (needs time for API response)
        await page.waitForTimeout(8000);
        console.log('    Waited for trace events');
      }
    }
  },
];

async function captureScreenshots() {
  const browser = await chromium.launch({ headless: true });
  
  const outputDir = path.join(__dirname, '..', 'docs', 'images');
  
  for (const screenshot of SCREENSHOTS) {
    console.log(`Capturing ${screenshot.name}...`);
    
    // Create context with custom or default viewport
    const viewport = screenshot.viewport || { width: 1400, height: 900 };
    const context = await browser.newContext({
      viewport,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    
    try {
      await page.goto(screenshot.url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1000); // Initial settle time
      
      if (screenshot.setup) {
        await screenshot.setup(page);
      }
      
      await page.screenshot({
        path: path.join(outputDir, screenshot.name),
        fullPage: false,
      });
      
      console.log(`  ✓ Saved ${screenshot.name}`);
    } catch (error) {
      console.error(`  ✗ Failed to capture ${screenshot.name}:`, error.message);
    }
    
    await page.close();
    await context.close();
  }
  
  await browser.close();
  console.log('\nDone! Screenshots saved to docs/images/');
}

captureScreenshots().catch(console.error);
