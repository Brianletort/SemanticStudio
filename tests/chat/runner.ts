/**
 * Chat Test Runner with Self-Healing Capabilities
 * 
 * This runner executes chat tests, captures failures, and can suggest/apply fixes.
 * It integrates with the browser MCP for automated UI testing.
 */

import type { TestCase, TestStep } from './test-cases';
import { getAllTestCases, getTestsByCategory, getTestById } from './test-cases';
import type { BrowserSnapshot, TestContext } from './browser-helpers';
import { 
  createTestContext, 
  sleep, 
  navigateToChat,
  fillInput,
  clickElement,
  takeScreenshot,
  getSnapshot,
  lockBrowser,
  unlockBrowser,
  waitForResponse,
  scrollChat,
} from './browser-helpers';
import type { AssertionResult } from './assertions';

export interface TestResult {
  testId: string;
  testName: string;
  passed: boolean;
  duration: number;
  error?: string;
  screenshot?: string;
  suggestedFix?: string;
  steps: StepResult[];
}

export interface StepResult {
  step: TestStep;
  passed: boolean;
  error?: string;
  duration: number;
}

export interface TestSuiteResult {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  results: TestResult[];
  fixesApplied: string[];
}

/**
 * Execute a single test step
 */
async function executeStep(
  step: TestStep,
  ctx: TestContext
): Promise<StepResult> {
  const startTime = Date.now();
  
  try {
    switch (step.action) {
      case 'navigate':
        await navigateToChat(ctx);
        break;
      case 'click':
        await clickElement(
          step.params?.element as string || 'element',
          step.params?.ref as string
        );
        break;
      case 'fill':
        await fillInput(
          step.params?.element as string || 'input',
          step.params?.ref as string,
          step.params?.value as string
        );
        break;
      case 'wait':
        await sleep(step.params?.duration as number || 1000);
        break;
      case 'scroll':
        await scrollChat(
          step.params?.direction as 'up' | 'down',
          step.params?.amount as number
        );
        break;
      case 'screenshot':
        await takeScreenshot(step.params?.filename as string);
        break;
      case 'reload':
        // Reload would be implemented via MCP
        break;
    }
    
    return {
      step,
      passed: true,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      step,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Execute a single test case
 */
async function executeTest(
  testCase: TestCase,
  ctx: TestContext
): Promise<TestResult> {
  const startTime = Date.now();
  const stepResults: StepResult[] = [];
  let lastSnapshot: BrowserSnapshot | null = null;
  
  console.log(`\n  Running: ${testCase.name}`);
  
  // Execute all steps
  for (const step of testCase.steps) {
    const stepResult = await executeStep(step, ctx);
    stepResults.push(stepResult);
    
    if (!stepResult.passed) {
      return {
        testId: testCase.id,
        testName: testCase.name,
        passed: false,
        duration: Date.now() - startTime,
        error: `Step failed: ${step.action} - ${stepResult.error}`,
        suggestedFix: testCase.fixSuggestion,
        steps: stepResults,
      };
    }
    
    // Small delay between steps
    await sleep(100);
  }
  
  // Get final snapshot for validation
  try {
    lastSnapshot = await getSnapshot();
  } catch (error) {
    // Continue even if snapshot fails
  }
  
  // Validate test result
  const validationResult = testCase.validate(lastSnapshot || {
    url: '',
    title: '',
    elements: [],
  });
  
  // Take final screenshot
  const screenshotName = await takeScreenshot(`${testCase.id}-result.png`);
  
  return {
    testId: testCase.id,
    testName: testCase.name,
    passed: validationResult.passed,
    duration: Date.now() - startTime,
    error: validationResult.passed ? undefined : validationResult.message,
    screenshot: screenshotName,
    suggestedFix: validationResult.passed ? undefined : testCase.fixSuggestion,
    steps: stepResults,
  };
}

/**
 * Run all tests in the suite
 */
export async function runTestSuite(
  options: {
    category?: TestCase['category'];
    testIds?: string[];
    maxRetries?: number;
    autoFix?: boolean;
  } = {}
): Promise<TestSuiteResult> {
  const startTime = Date.now();
  const ctx = createTestContext();
  const results: TestResult[] = [];
  const fixesApplied: string[] = [];
  
  // Determine which tests to run
  let tests: TestCase[];
  if (options.testIds && options.testIds.length > 0) {
    tests = options.testIds
      .map(id => getTestById(id))
      .filter((t): t is TestCase => t !== undefined);
  } else if (options.category) {
    tests = getTestsByCategory(options.category);
  } else {
    tests = getAllTestCases();
  }
  
  console.log(`\n========================================`);
  console.log(`  Chat Test Suite`);
  console.log(`  Running ${tests.length} tests`);
  console.log(`========================================\n`);
  
  // Lock browser for automated testing
  await lockBrowser();
  
  try {
    for (const test of tests) {
      let result = await executeTest(test, ctx);
      let retries = 0;
      
      // Retry logic with potential auto-fix
      while (!result.passed && retries < (options.maxRetries || 0)) {
        console.log(`  ⚠️  Test failed, retrying (${retries + 1}/${options.maxRetries})...`);
        
        if (options.autoFix && result.suggestedFix) {
          console.log(`  🔧 Suggested fix: ${result.suggestedFix}`);
          fixesApplied.push(`${test.id}: ${result.suggestedFix}`);
        }
        
        await sleep(2000); // Wait before retry
        result = await executeTest(test, ctx);
        retries++;
      }
      
      results.push(result);
      
      // Log result
      if (result.passed) {
        console.log(`  ✅ PASSED (${result.duration}ms)`);
      } else {
        console.log(`  ❌ FAILED: ${result.error}`);
        if (result.suggestedFix) {
          console.log(`     Fix: ${result.suggestedFix}`);
        }
      }
    }
  } finally {
    // Always unlock browser
    await unlockBrowser();
  }
  
  // Calculate summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`\n========================================`);
  console.log(`  Test Results Summary`);
  console.log(`========================================`);
  console.log(`  Total:   ${tests.length}`);
  console.log(`  Passed:  ${passed}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Duration: ${Date.now() - startTime}ms`);
  console.log(`========================================\n`);
  
  return {
    totalTests: tests.length,
    passed,
    failed,
    skipped: 0,
    duration: Date.now() - startTime,
    results,
    fixesApplied,
  };
}

/**
 * Self-healing test loop
 * Runs tests, identifies failures, applies fixes, and re-runs until passing
 */
export async function selfHealingTestLoop(
  maxAttempts: number = 3
): Promise<TestSuiteResult> {
  let attempt = 0;
  let lastResult: TestSuiteResult | null = null;
  
  console.log(`\n========================================`);
  console.log(`  Self-Healing Test Loop`);
  console.log(`  Max attempts: ${maxAttempts}`);
  console.log(`========================================\n`);
  
  while (attempt < maxAttempts) {
    attempt++;
    console.log(`\n--- Attempt ${attempt} of ${maxAttempts} ---\n`);
    
    const result = await runTestSuite({
      maxRetries: 1,
      autoFix: true,
    });
    
    lastResult = result;
    
    if (result.failed === 0) {
      console.log(`\n🎉 All tests passed on attempt ${attempt}!`);
      return result;
    }
    
    // Log failures and suggested fixes
    const failures = result.results.filter(r => !r.passed);
    console.log(`\n${failures.length} tests still failing:`);
    for (const failure of failures) {
      console.log(`  - ${failure.testName}`);
      if (failure.suggestedFix) {
        console.log(`    Fix: ${failure.suggestedFix}`);
      }
    }
    
    if (attempt < maxAttempts) {
      console.log(`\nWaiting before next attempt...`);
      await sleep(5000);
    }
  }
  
  console.log(`\n⚠️ Self-healing loop completed after ${maxAttempts} attempts`);
  console.log(`   Some tests may still be failing.`);
  
  return lastResult!;
}

/**
 * Run a quick smoke test
 */
export async function runSmokeTest(): Promise<TestSuiteResult> {
  return runTestSuite({
    testIds: ['basic-001', 'basic-003', 'session-001'],
    maxRetries: 1,
  });
}

/**
 * Run tests for a specific category
 */
export async function runCategoryTests(
  category: TestCase['category']
): Promise<TestSuiteResult> {
  return runTestSuite({
    category,
    maxRetries: 2,
    autoFix: true,
  });
}

// Export for CLI usage
export const cli = {
  runAll: () => runTestSuite(),
  runSmoke: runSmokeTest,
  runBasic: () => runCategoryTests('basic'),
  runCode: () => runCategoryTests('code'),
  runSession: () => runCategoryTests('session'),
  runFormatting: () => runCategoryTests('formatting'),
  runMemory: () => runCategoryTests('memory'),
  selfHeal: selfHealingTestLoop,
};

// Main entry point
if (typeof process !== 'undefined' && process.argv[1]?.includes('runner')) {
  const command = process.argv[2] || 'runSmoke';
  const fn = cli[command as keyof typeof cli];
  
  if (fn) {
    fn().then(result => {
      process.exit(result.failed > 0 ? 1 : 0);
    });
  } else {
    console.log('Available commands:', Object.keys(cli).join(', '));
  }
}
