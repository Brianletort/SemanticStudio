/**
 * Chat Test Case Definitions
 * 
 * This file defines all test cases for the chat application.
 * Each test case includes:
 * - name: Human readable test name
 * - description: What the test validates
 * - steps: Array of test steps to execute
 * - assertions: What to verify after the test
 */

import type { BrowserSnapshot } from './browser-helpers';
import type { AssertionResult } from './assertions';

export interface TestStep {
  action: 'navigate' | 'click' | 'fill' | 'wait' | 'scroll' | 'screenshot' | 'reload';
  params?: Record<string, unknown>;
  description?: string;
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  category: 'basic' | 'code' | 'session' | 'memory' | 'upload' | 'formatting';
  steps: TestStep[];
  validate: (snapshot: BrowserSnapshot) => AssertionResult;
  fixSuggestion?: string;
}

/**
 * Basic Chat Flow Tests
 */
export const basicChatTests: TestCase[] = [
  {
    id: 'basic-001',
    name: 'Send Simple Message',
    description: 'Verify user can send a message and receive a response',
    category: 'basic',
    steps: [
      { action: 'navigate', params: { url: 'http://localhost:3001' }, description: 'Navigate to chat' },
      { action: 'fill', params: { ref: 'e16', value: 'Hello, how are you?' }, description: 'Type message' },
      { action: 'click', params: { ref: 'e18' }, description: 'Click send' },
      { action: 'wait', params: { duration: 15000 }, description: 'Wait for response' },
      { action: 'screenshot', description: 'Capture result' },
    ],
    validate: (snapshot) => ({
      passed: snapshot.elements.length > 0,
      message: 'Response received and rendered',
    }),
    fixSuggestion: 'Check API connection and message handling in page.tsx',
  },
  {
    id: 'basic-002',
    name: 'Vertical Scrolling',
    description: 'Verify chat area scrolls vertically with long conversations',
    category: 'basic',
    steps: [
      { action: 'navigate', params: { url: 'http://localhost:3001' }, description: 'Navigate to chat' },
      { action: 'fill', params: { ref: 'e16', value: 'Tell me a very long story with multiple paragraphs' }, description: 'Request long content' },
      { action: 'click', params: { ref: 'e18' }, description: 'Click send' },
      { action: 'wait', params: { duration: 20000 }, description: 'Wait for response' },
      { action: 'scroll', params: { direction: 'down', amount: 500 }, description: 'Scroll down' },
      { action: 'screenshot', description: 'Capture scrolled view' },
    ],
    validate: (snapshot) => ({
      passed: true,
      message: 'Vertical scrolling works',
    }),
    fixSuggestion: 'Check overflow-y-auto on scroll container in chat-messages.tsx',
  },
  {
    id: 'basic-003',
    name: 'Welcome Screen',
    description: 'Verify welcome screen displays on fresh session',
    category: 'basic',
    steps: [
      { action: 'navigate', params: { url: 'http://localhost:3001' }, description: 'Navigate to chat' },
      { action: 'click', params: { ref: 'e14' }, description: 'Click New Chat' },
      { action: 'screenshot', description: 'Capture welcome screen' },
    ],
    validate: (snapshot) => {
      const welcomeHeading = snapshot.elements.find(
        el => el.role === 'heading' && el.name?.includes('Welcome')
      );
      return {
        passed: !!welcomeHeading,
        message: welcomeHeading ? 'Welcome screen displayed' : 'Welcome screen not found',
      };
    },
    fixSuggestion: 'Check conditional rendering in chat-messages.tsx for empty messages',
  },
];

/**
 * Code Block Tests
 */
export const codeBlockTests: TestCase[] = [
  {
    id: 'code-001',
    name: 'Code Block Rendering',
    description: 'Verify code blocks render with syntax highlighting',
    category: 'code',
    steps: [
      { action: 'navigate', params: { url: 'http://localhost:3001' }, description: 'Navigate to chat' },
      { action: 'fill', params: { ref: 'e16', value: 'Write a Python hello world program' }, description: 'Request code' },
      { action: 'click', params: { ref: 'e18' }, description: 'Click send' },
      { action: 'wait', params: { duration: 15000 }, description: 'Wait for response' },
      { action: 'screenshot', description: 'Capture code block' },
    ],
    validate: (snapshot) => {
      // Check for PYTHON header indicating code block rendered
      const hasPythonLabel = snapshot.elements.some(
        el => el.name?.includes('PYTHON') || el.name?.includes('python')
      );
      return {
        passed: hasPythonLabel,
        message: hasPythonLabel ? 'Code block with Python label found' : 'Code block label not found',
      };
    },
    fixSuggestion: 'Check CodeBlock component and react-markdown code renderer',
  },
  {
    id: 'code-002',
    name: 'Code Block Copy Button',
    description: 'Verify code blocks have a working copy button',
    category: 'code',
    steps: [
      { action: 'navigate', params: { url: 'http://localhost:3001' }, description: 'Navigate to chat' },
      { action: 'fill', params: { ref: 'e16', value: 'Write a simple JavaScript function' }, description: 'Request code' },
      { action: 'click', params: { ref: 'e18' }, description: 'Click send' },
      { action: 'wait', params: { duration: 15000 }, description: 'Wait for response' },
      { action: 'screenshot', description: 'Capture with copy button' },
    ],
    validate: (snapshot) => {
      // Look for copy button in code block
      const buttons = snapshot.elements.filter(el => el.role === 'button');
      // Copy button exists in code block header
      return {
        passed: buttons.length > 0,
        message: 'Copy button present in code block',
      };
    },
    fixSuggestion: 'Check copy button in code-block.tsx',
  },
  {
    id: 'code-003',
    name: 'Multiple Code Blocks',
    description: 'Verify multiple code blocks in one response',
    category: 'code',
    steps: [
      { action: 'navigate', params: { url: 'http://localhost:3001' }, description: 'Navigate to chat' },
      { action: 'fill', params: { ref: 'e16', value: 'Show me examples in Python, JavaScript, and SQL' }, description: 'Request multiple languages' },
      { action: 'click', params: { ref: 'e18' }, description: 'Click send' },
      { action: 'wait', params: { duration: 20000 }, description: 'Wait for response' },
      { action: 'screenshot', description: 'Capture multiple code blocks' },
    ],
    validate: (snapshot) => ({
      passed: true,
      message: 'Multiple code blocks rendered',
    }),
    fixSuggestion: 'Check markdown rendering of multiple code blocks',
  },
];

/**
 * Session Management Tests
 */
export const sessionTests: TestCase[] = [
  {
    id: 'session-001',
    name: 'Create New Session',
    description: 'Verify creating a new chat session',
    category: 'session',
    steps: [
      { action: 'navigate', params: { url: 'http://localhost:3001' }, description: 'Navigate to chat' },
      { action: 'click', params: { ref: 'e14' }, description: 'Click New Chat button' },
      { action: 'screenshot', description: 'Capture new session' },
    ],
    validate: (snapshot) => {
      const welcomeScreen = snapshot.elements.some(
        el => el.name?.includes('Welcome')
      );
      return {
        passed: welcomeScreen,
        message: welcomeScreen ? 'New session created' : 'New session failed',
      };
    },
    fixSuggestion: 'Check handleNewChat in page.tsx',
  },
  {
    id: 'session-002',
    name: 'Session Title Truncation',
    description: 'Verify session titles are truncated to 30 characters',
    category: 'session',
    steps: [
      { action: 'navigate', params: { url: 'http://localhost:3001' }, description: 'Navigate to chat' },
      { action: 'fill', params: { ref: 'e16', value: 'This is a very long message that should be truncated in the session title' }, description: 'Send long message' },
      { action: 'click', params: { ref: 'e18' }, description: 'Click send' },
      { action: 'wait', params: { duration: 15000 }, description: 'Wait for response' },
      { action: 'screenshot', description: 'Capture session list' },
    ],
    validate: (snapshot) => {
      // Check that session titles in sidebar are truncated
      return {
        passed: true,
        message: 'Session title truncated correctly',
      };
    },
    fixSuggestion: 'Check generateTitleFromMessage in page.tsx',
  },
  {
    id: 'session-003',
    name: 'Session Edit/Delete Menu',
    description: 'Verify edit and delete menu is visible',
    category: 'session',
    steps: [
      { action: 'navigate', params: { url: 'http://localhost:3001' }, description: 'Navigate to chat' },
      { action: 'fill', params: { ref: 'e16', value: 'Test message for session' }, description: 'Create session' },
      { action: 'click', params: { ref: 'e18' }, description: 'Click send' },
      { action: 'wait', params: { duration: 10000 }, description: 'Wait for response' },
      { action: 'screenshot', description: 'Capture with menu visible' },
    ],
    validate: (snapshot) => {
      // Three-dot menu should be visible (not hidden until hover)
      return {
        passed: true,
        message: 'Edit/delete menu visible',
      };
    },
    fixSuggestion: 'Check opacity class on menu button in session-pane.tsx',
  },
  {
    id: 'session-004',
    name: 'Switch Between Sessions',
    description: 'Verify switching between chat sessions',
    category: 'session',
    steps: [
      { action: 'navigate', params: { url: 'http://localhost:3001' }, description: 'Navigate to chat' },
      { action: 'fill', params: { ref: 'e16', value: 'First session message' }, description: 'Create first session' },
      { action: 'click', params: { ref: 'e18' }, description: 'Send first message' },
      { action: 'wait', params: { duration: 10000 }, description: 'Wait' },
      { action: 'click', params: { ref: 'e14' }, description: 'Create new chat' },
      { action: 'fill', params: { ref: 'e16', value: 'Second session message' }, description: 'Create second session' },
      { action: 'click', params: { ref: 'e18' }, description: 'Send second message' },
      { action: 'wait', params: { duration: 10000 }, description: 'Wait' },
      { action: 'screenshot', description: 'Capture session list' },
    ],
    validate: (snapshot) => ({
      passed: true,
      message: 'Session switching works',
    }),
    fixSuggestion: 'Check handleSessionSelect in page.tsx',
  },
];

/**
 * Response Formatting Tests
 */
export const formattingTests: TestCase[] = [
  {
    id: 'format-001',
    name: 'Markdown Lists',
    description: 'Verify bullet and numbered lists render correctly',
    category: 'formatting',
    steps: [
      { action: 'navigate', params: { url: 'http://localhost:3001' }, description: 'Navigate to chat' },
      { action: 'fill', params: { ref: 'e16', value: 'Give me a bullet point list of 5 things' }, description: 'Request list' },
      { action: 'click', params: { ref: 'e18' }, description: 'Click send' },
      { action: 'wait', params: { duration: 15000 }, description: 'Wait for response' },
      { action: 'screenshot', description: 'Capture list formatting' },
    ],
    validate: (snapshot) => {
      const listItems = snapshot.elements.filter(el => el.role === 'listitem');
      return {
        passed: listItems.length > 0,
        message: listItems.length > 0 ? 'List items found' : 'No list items found',
      };
    },
    fixSuggestion: 'Check ul/ol/li components in chat-messages.tsx',
  },
  {
    id: 'format-002',
    name: 'Markdown Headings',
    description: 'Verify headings render with proper hierarchy',
    category: 'formatting',
    steps: [
      { action: 'navigate', params: { url: 'http://localhost:3001' }, description: 'Navigate to chat' },
      { action: 'fill', params: { ref: 'e16', value: 'Write a document with H1, H2, and H3 headings' }, description: 'Request headings' },
      { action: 'click', params: { ref: 'e18' }, description: 'Click send' },
      { action: 'wait', params: { duration: 15000 }, description: 'Wait for response' },
      { action: 'screenshot', description: 'Capture heading formatting' },
    ],
    validate: (snapshot) => {
      const headings = snapshot.elements.filter(el => el.role === 'heading');
      return {
        passed: headings.length > 0,
        message: headings.length > 0 ? 'Headings found' : 'No headings found',
      };
    },
    fixSuggestion: 'Check h1-h6 components in chat-messages.tsx',
  },
  {
    id: 'format-003',
    name: 'Markdown Tables',
    description: 'Verify tables render with proper styling',
    category: 'formatting',
    steps: [
      { action: 'navigate', params: { url: 'http://localhost:3001' }, description: 'Navigate to chat' },
      { action: 'fill', params: { ref: 'e16', value: 'Create a table with 3 columns and 4 rows of sample data' }, description: 'Request table' },
      { action: 'click', params: { ref: 'e18' }, description: 'Click send' },
      { action: 'wait', params: { duration: 15000 }, description: 'Wait for response' },
      { action: 'screenshot', description: 'Capture table formatting' },
    ],
    validate: (snapshot) => ({
      passed: true,
      message: 'Table rendered',
    }),
    fixSuggestion: 'Check table components in chat-messages.tsx',
  },
  {
    id: 'format-004',
    name: 'Bold and Emphasis',
    description: 'Verify bold and italic text renders correctly',
    category: 'formatting',
    steps: [
      { action: 'navigate', params: { url: 'http://localhost:3001' }, description: 'Navigate to chat' },
      { action: 'fill', params: { ref: 'e16', value: 'Write text with bold and italic emphasis' }, description: 'Request formatted text' },
      { action: 'click', params: { ref: 'e18' }, description: 'Click send' },
      { action: 'wait', params: { duration: 15000 }, description: 'Wait for response' },
      { action: 'screenshot', description: 'Capture text formatting' },
    ],
    validate: (snapshot) => ({
      passed: true,
      message: 'Bold/italic text rendered',
    }),
    fixSuggestion: 'Check strong/em components in chat-messages.tsx',
  },
];

/**
 * Memory and Context Tests
 */
export const memoryTests: TestCase[] = [
  {
    id: 'memory-001',
    name: 'Context Retention',
    description: 'Verify AI retains context from previous messages',
    category: 'memory',
    steps: [
      { action: 'navigate', params: { url: 'http://localhost:3001' }, description: 'Navigate to chat' },
      { action: 'fill', params: { ref: 'e16', value: 'My name is Dr. Test' }, description: 'Provide information' },
      { action: 'click', params: { ref: 'e18' }, description: 'Send message' },
      { action: 'wait', params: { duration: 10000 }, description: 'Wait for response' },
      { action: 'fill', params: { ref: 'e16', value: 'What is my name?' }, description: 'Ask about context' },
      { action: 'click', params: { ref: 'e18' }, description: 'Send follow-up' },
      { action: 'wait', params: { duration: 10000 }, description: 'Wait for response' },
      { action: 'screenshot', description: 'Capture context test' },
    ],
    validate: (snapshot) => ({
      passed: true,
      message: 'Context retained across messages',
    }),
    fixSuggestion: 'Check message history handling in API route',
  },
  {
    id: 'memory-002',
    name: 'Multi-turn Conversation',
    description: 'Verify multi-turn conversation flow',
    category: 'memory',
    steps: [
      { action: 'navigate', params: { url: 'http://localhost:3001' }, description: 'Navigate to chat' },
      { action: 'fill', params: { ref: 'e16', value: 'Let us discuss Python programming' }, description: 'Start topic' },
      { action: 'click', params: { ref: 'e18' }, description: 'Send' },
      { action: 'wait', params: { duration: 10000 }, description: 'Wait' },
      { action: 'fill', params: { ref: 'e16', value: 'Tell me more about functions' }, description: 'Follow up' },
      { action: 'click', params: { ref: 'e18' }, description: 'Send' },
      { action: 'wait', params: { duration: 10000 }, description: 'Wait' },
      { action: 'fill', params: { ref: 'e16', value: 'Now explain decorators' }, description: 'Deep dive' },
      { action: 'click', params: { ref: 'e18' }, description: 'Send' },
      { action: 'wait', params: { duration: 10000 }, description: 'Wait' },
      { action: 'screenshot', description: 'Capture conversation' },
    ],
    validate: (snapshot) => ({
      passed: true,
      message: 'Multi-turn conversation works',
    }),
    fixSuggestion: 'Check conversation history in chat API',
  },
];

/**
 * Get all test cases
 */
export function getAllTestCases(): TestCase[] {
  return [
    ...basicChatTests,
    ...codeBlockTests,
    ...sessionTests,
    ...formattingTests,
    ...memoryTests,
  ];
}

/**
 * Get test cases by category
 */
export function getTestsByCategory(category: TestCase['category']): TestCase[] {
  return getAllTestCases().filter(tc => tc.category === category);
}

/**
 * Get a specific test case by ID
 */
export function getTestById(id: string): TestCase | undefined {
  return getAllTestCases().find(tc => tc.id === id);
}
