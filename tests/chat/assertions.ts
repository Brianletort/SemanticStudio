/**
 * Assertion Helpers for Chat Testing
 * 
 * These functions provide assertions for validating chat UI behavior.
 */

import type { BrowserSnapshot, SnapshotElement } from './browser-helpers';
import { findElement, getElementsByRole, elementExists } from './browser-helpers';

export interface AssertionResult {
  passed: boolean;
  message: string;
  expected?: unknown;
  actual?: unknown;
}

/**
 * Assert that an element exists in the snapshot
 */
export function assertElementExists(
  snapshot: BrowserSnapshot,
  role: string,
  name?: string
): AssertionResult {
  const exists = elementExists(snapshot, role, name);
  return {
    passed: exists,
    message: exists 
      ? `Element ${role}${name ? ` "${name}"` : ''} found`
      : `Element ${role}${name ? ` "${name}"` : ''} not found`,
    expected: true,
    actual: exists,
  };
}

/**
 * Assert that an element does NOT exist in the snapshot
 */
export function assertElementNotExists(
  snapshot: BrowserSnapshot,
  role: string,
  name?: string
): AssertionResult {
  const exists = elementExists(snapshot, role, name);
  return {
    passed: !exists,
    message: !exists
      ? `Element ${role}${name ? ` "${name}"` : ''} correctly not found`
      : `Element ${role}${name ? ` "${name}"` : ''} unexpectedly exists`,
    expected: false,
    actual: exists,
  };
}

/**
 * Assert that the page title matches
 */
export function assertPageTitle(
  snapshot: BrowserSnapshot,
  expectedTitle: string
): AssertionResult {
  const matches = snapshot.title === expectedTitle;
  return {
    passed: matches,
    message: matches
      ? `Page title matches: "${expectedTitle}"`
      : `Page title mismatch`,
    expected: expectedTitle,
    actual: snapshot.title,
  };
}

/**
 * Assert that the page URL matches
 */
export function assertPageUrl(
  snapshot: BrowserSnapshot,
  expectedUrl: string
): AssertionResult {
  const matches = snapshot.url === expectedUrl;
  return {
    passed: matches,
    message: matches
      ? `Page URL matches: "${expectedUrl}"`
      : `Page URL mismatch`,
    expected: expectedUrl,
    actual: snapshot.url,
  };
}

/**
 * Assert that an input has a specific value
 */
export function assertInputValue(
  snapshot: BrowserSnapshot,
  inputRef: string,
  expectedValue: string
): AssertionResult {
  const elements = getElementsByRole(snapshot, 'textbox');
  const input = elements.find(el => el.ref === inputRef);
  
  if (!input) {
    return {
      passed: false,
      message: `Input with ref "${inputRef}" not found`,
      expected: expectedValue,
      actual: undefined,
    };
  }

  const matches = input.value === expectedValue;
  return {
    passed: matches,
    message: matches
      ? `Input value matches`
      : `Input value mismatch`,
    expected: expectedValue,
    actual: input.value,
  };
}

/**
 * Assert that a button is enabled
 */
export function assertButtonEnabled(
  snapshot: BrowserSnapshot,
  buttonRef: string
): AssertionResult {
  const elements = getElementsByRole(snapshot, 'button');
  const button = elements.find(el => el.ref === buttonRef);
  
  if (!button) {
    return {
      passed: false,
      message: `Button with ref "${buttonRef}" not found`,
      expected: 'enabled',
      actual: undefined,
    };
  }

  const isDisabled = button.states?.includes('disabled');
  return {
    passed: !isDisabled,
    message: !isDisabled
      ? `Button is enabled`
      : `Button is disabled`,
    expected: 'enabled',
    actual: isDisabled ? 'disabled' : 'enabled',
  };
}

/**
 * Assert that a button is disabled
 */
export function assertButtonDisabled(
  snapshot: BrowserSnapshot,
  buttonRef: string
): AssertionResult {
  const elements = getElementsByRole(snapshot, 'button');
  const button = elements.find(el => el.ref === buttonRef);
  
  if (!button) {
    return {
      passed: false,
      message: `Button with ref "${buttonRef}" not found`,
      expected: 'disabled',
      actual: undefined,
    };
  }

  const isDisabled = button.states?.includes('disabled');
  return {
    passed: isDisabled === true,
    message: isDisabled
      ? `Button is disabled`
      : `Button is enabled`,
    expected: 'disabled',
    actual: isDisabled ? 'disabled' : 'enabled',
  };
}

/**
 * Assert that a specific number of elements exist
 */
export function assertElementCount(
  snapshot: BrowserSnapshot,
  role: string,
  expectedCount: number
): AssertionResult {
  const elements = getElementsByRole(snapshot, role);
  const matches = elements.length === expectedCount;
  return {
    passed: matches,
    message: matches
      ? `Found ${expectedCount} ${role} elements`
      : `Element count mismatch for ${role}`,
    expected: expectedCount,
    actual: elements.length,
  };
}

/**
 * Assert that text content contains a substring
 */
export function assertTextContains(
  snapshot: BrowserSnapshot,
  searchText: string
): AssertionResult {
  function searchElements(elements: SnapshotElement[]): boolean {
    for (const el of elements) {
      if (el.name && el.name.includes(searchText)) {
        return true;
      }
      if (el.children && searchElements(el.children)) {
        return true;
      }
    }
    return false;
  }
  
  const found = searchElements(snapshot.elements);
  return {
    passed: found,
    message: found
      ? `Text "${searchText}" found in page`
      : `Text "${searchText}" not found in page`,
    expected: true,
    actual: found,
  };
}

/**
 * Assert that a heading exists with specific text
 */
export function assertHeadingExists(
  snapshot: BrowserSnapshot,
  headingText: string
): AssertionResult {
  const headings = getElementsByRole(snapshot, 'heading');
  const found = headings.some(h => h.name === headingText);
  return {
    passed: found,
    message: found
      ? `Heading "${headingText}" found`
      : `Heading "${headingText}" not found`,
    expected: headingText,
    actual: headings.map(h => h.name).join(', '),
  };
}

/**
 * Assert that session list contains a session with specific title
 */
export function assertSessionExists(
  snapshot: BrowserSnapshot,
  sessionTitle: string
): AssertionResult {
  // Sessions appear as buttons or list items in the sidebar
  const buttons = getElementsByRole(snapshot, 'button');
  const listItems = getElementsByRole(snapshot, 'listitem');
  
  const allElements = [...buttons, ...listItems];
  const found = allElements.some(el => 
    el.name && el.name.includes(sessionTitle)
  );
  
  return {
    passed: found,
    message: found
      ? `Session "${sessionTitle}" found`
      : `Session "${sessionTitle}" not found`,
    expected: sessionTitle,
    actual: found ? 'found' : 'not found',
  };
}

/**
 * Assert that a code block exists with specific language
 */
export function assertCodeBlockLanguage(
  snapshot: BrowserSnapshot,
  language: string
): AssertionResult {
  // Code blocks have a header with language label
  const found = assertTextContains(snapshot, language.toUpperCase());
  return {
    passed: found.passed,
    message: found.passed
      ? `Code block with language "${language}" found`
      : `Code block with language "${language}" not found`,
    expected: language,
    actual: found.passed ? language : 'not found',
  };
}

/**
 * Combine multiple assertions into a single result
 */
export function assertAll(...assertions: AssertionResult[]): AssertionResult {
  const failed = assertions.filter(a => !a.passed);
  
  if (failed.length === 0) {
    return {
      passed: true,
      message: `All ${assertions.length} assertions passed`,
    };
  }
  
  return {
    passed: false,
    message: `${failed.length} of ${assertions.length} assertions failed:\n` +
      failed.map(a => `  - ${a.message}`).join('\n'),
  };
}
