/**
 * Browser MCP Helper Functions for Chat Testing
 * 
 * These functions wrap the MCP browser tools for easier use in tests.
 * They are designed to be used with the cursor-ide-browser MCP server.
 */

export interface BrowserSnapshot {
  url: string;
  title: string;
  elements: SnapshotElement[];
}

export interface SnapshotElement {
  role: string;
  name?: string;
  ref: string;
  value?: string;
  states?: string[];
  children?: SnapshotElement[];
}

export interface TestContext {
  viewId?: string;
  baseUrl: string;
  timeout: number;
}

/**
 * Create a new test context
 */
export function createTestContext(baseUrl: string = 'http://localhost:3001'): TestContext {
  return {
    baseUrl,
    timeout: 30000,
  };
}

/**
 * Navigate to the chat application
 */
export async function navigateToChat(ctx: TestContext): Promise<void> {
  // This would call browser_navigate via MCP
  console.log(`Navigating to ${ctx.baseUrl}`);
}

/**
 * Wait for element to appear in the DOM
 */
export async function waitForElement(
  selector: string,
  timeout: number = 10000
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    // Check for element via snapshot
    await sleep(500);
    // In real implementation, this would call browser_snapshot and check
  }
  return false;
}

/**
 * Fill a text input field
 */
export async function fillInput(
  element: string,
  ref: string,
  value: string
): Promise<void> {
  // This would call browser_fill via MCP
  console.log(`Filling ${element} with: ${value}`);
}

/**
 * Click an element
 */
export async function clickElement(
  element: string,
  ref: string
): Promise<void> {
  // This would call browser_click via MCP
  console.log(`Clicking ${element}`);
}

/**
 * Take a screenshot
 */
export async function takeScreenshot(
  filename?: string
): Promise<string> {
  // This would call browser_take_screenshot via MCP
  const name = filename || `screenshot-${Date.now()}.png`;
  console.log(`Taking screenshot: ${name}`);
  return name;
}

/**
 * Get page snapshot for assertions
 */
export async function getSnapshot(): Promise<BrowserSnapshot> {
  // This would call browser_snapshot via MCP
  return {
    url: '',
    title: '',
    elements: [],
  };
}

/**
 * Lock browser for automated testing
 */
export async function lockBrowser(): Promise<void> {
  // This would call browser_lock via MCP
  console.log('Locking browser');
}

/**
 * Unlock browser after testing
 */
export async function unlockBrowser(): Promise<void> {
  // This would call browser_unlock via MCP
  console.log('Unlocking browser');
}

/**
 * Send a chat message
 */
export async function sendChatMessage(message: string): Promise<void> {
  // Find input, fill it, click send
  await fillInput('Chat input', 'e16', message);
  await sleep(100);
  await clickElement('Send button', 'e18');
}

/**
 * Wait for AI response to complete
 */
export async function waitForResponse(timeout: number = 30000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    await sleep(1000);
    // Check if send button is enabled (response complete)
    // In real implementation, check snapshot for send button state
  }
  return true;
}

/**
 * Scroll the chat area
 */
export async function scrollChat(
  direction: 'up' | 'down',
  amount: number = 300
): Promise<void> {
  // This would call browser_scroll via MCP
  console.log(`Scrolling ${direction} by ${amount}px`);
}

/**
 * Sleep helper
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Find element by role and name in snapshot
 */
export function findElement(
  snapshot: BrowserSnapshot,
  role: string,
  name?: string
): SnapshotElement | undefined {
  function search(elements: SnapshotElement[]): SnapshotElement | undefined {
    for (const el of elements) {
      if (el.role === role && (!name || el.name === name)) {
        return el;
      }
      if (el.children) {
        const found = search(el.children);
        if (found) return found;
      }
    }
    return undefined;
  }
  return search(snapshot.elements);
}

/**
 * Check if element exists in snapshot
 */
export function elementExists(
  snapshot: BrowserSnapshot,
  role: string,
  name?: string
): boolean {
  return findElement(snapshot, role, name) !== undefined;
}

/**
 * Get all elements with a specific role
 */
export function getElementsByRole(
  snapshot: BrowserSnapshot,
  role: string
): SnapshotElement[] {
  const results: SnapshotElement[] = [];
  function search(elements: SnapshotElement[]): void {
    for (const el of elements) {
      if (el.role === role) {
        results.push(el);
      }
      if (el.children) {
        search(el.children);
      }
    }
  }
  search(snapshot.elements);
  return results;
}
