/**
 * Chat Test Framework
 * 
 * A comprehensive testing framework for the AgentKit chat application.
 * Uses browser MCP tools for automated UI testing with self-healing capabilities.
 * 
 * Usage:
 *   import { runTestSuite, selfHealingTestLoop } from './tests/chat';
 * 
 *   // Run all tests
 *   const results = await runTestSuite();
 * 
 *   // Run self-healing loop
 *   const results = await selfHealingTestLoop(3);
 * 
 *   // Run specific category
 *   const results = await runCategoryTests('code');
 */

// Export test runner functions
export {
  runTestSuite,
  selfHealingTestLoop,
  runSmokeTest,
  runCategoryTests,
  cli,
  type TestResult,
  type TestSuiteResult,
  type StepResult,
} from './runner';

// Export test cases
export {
  getAllTestCases,
  getTestsByCategory,
  getTestById,
  basicChatTests,
  codeBlockTests,
  sessionTests,
  formattingTests,
  memoryTests,
  type TestCase,
  type TestStep,
} from './test-cases';

// Export browser helpers
export {
  createTestContext,
  navigateToChat,
  waitForElement,
  fillInput,
  clickElement,
  takeScreenshot,
  getSnapshot,
  lockBrowser,
  unlockBrowser,
  sendChatMessage,
  waitForResponse,
  scrollChat,
  sleep,
  findElement,
  elementExists,
  getElementsByRole,
  type BrowserSnapshot,
  type SnapshotElement,
  type TestContext,
} from './browser-helpers';

// Export assertions
export {
  assertElementExists,
  assertElementNotExists,
  assertPageTitle,
  assertPageUrl,
  assertInputValue,
  assertButtonEnabled,
  assertButtonDisabled,
  assertElementCount,
  assertTextContains,
  assertHeadingExists,
  assertSessionExists,
  assertCodeBlockLanguage,
  assertAll,
  type AssertionResult,
} from './assertions';
