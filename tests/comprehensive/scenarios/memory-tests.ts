/**
 * Memory Test Scenarios
 * 
 * Tests for memory system functionality:
 * - Session memory extraction
 * - Memory retrieval and usage
 * - Cross-session memory persistence
 * - Summarization after multiple prompts
 * - MiniGPT pattern (context guides subsequent prompts)
 */

import { TestScenario } from '../framework/types';
import { assert } from '../framework/assertions';

export const memoryTestScenarios: TestScenario[] = [
  // Context Retention Within Session
  {
    id: 'memory-context-retention',
    name: 'AI retains context from previous messages',
    category: 'memory',
    tags: ['context', 'session'],
    steps: [
      {
        id: 'provide-info',
        action: 'send_message',
        params: { message: 'My name is Dr. Sarah Chen and I work in the Finance department.' },
        description: 'Provide personal information',
      },
      {
        id: 'wait-1',
        action: 'wait',
        params: { ms: 2000 },
        description: 'Wait for response',
      },
      {
        id: 'ask-about-context',
        action: 'send_message',
        params: { message: 'What is my name and department?' },
        description: 'Ask about provided context',
      },
    ],
    assertions: [
      assert.responseContains('Sarah'),
      assert.responseContains('Finance'),
    ],
  },
  
  // Memory Extraction
  {
    id: 'memory-extraction',
    name: 'System extracts and stores facts from conversation',
    category: 'memory',
    tags: ['extraction', 'facts'],
    steps: [
      {
        id: 'provide-preference',
        action: 'send_message',
        params: { message: 'I prefer detailed technical explanations with code examples when available.' },
        description: 'State preference',
      },
      {
        id: 'wait-1',
        action: 'wait',
        params: { ms: 2000 },
        description: 'Wait for processing',
      },
      {
        id: 'check-memory',
        action: 'check_memory',
        params: {},
        description: 'Check memory for extracted facts',
      },
    ],
    assertions: [
      assert.memoryContains('technical'),
    ],
  },
  
  // Multi-Turn Conversation
  {
    id: 'memory-multi-turn',
    name: 'Memory works across multiple conversation turns',
    category: 'memory',
    tags: ['multi-turn', 'context'],
    steps: [
      {
        id: 'turn-1',
        action: 'send_message',
        params: { message: 'Let us discuss Python programming' },
        description: 'Start topic',
      },
      {
        id: 'wait-1',
        action: 'wait',
        params: { ms: 2000 },
        description: 'Wait',
      },
      {
        id: 'turn-2',
        action: 'send_message',
        params: { message: 'Tell me about functions' },
        description: 'Continue topic',
      },
      {
        id: 'wait-2',
        action: 'wait',
        params: { ms: 2000 },
        description: 'Wait',
      },
      {
        id: 'turn-3',
        action: 'send_message',
        params: { message: 'Now explain decorators' },
        description: 'Deeper into topic',
      },
      {
        id: 'wait-3',
        action: 'wait',
        params: { ms: 2000 },
        description: 'Wait',
      },
      {
        id: 'turn-4',
        action: 'send_message',
        params: { message: 'What topic have we been discussing?' },
        description: 'Ask about context',
      },
    ],
    assertions: [
      assert.responseContains('Python'),
    ],
  },
  
  // Summarization
  {
    id: 'memory-summarization',
    name: 'Session summary is generated after multiple prompts',
    category: 'memory',
    tags: ['summarization', 'session'],
    steps: [
      // Send 5+ messages to trigger summarization
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `msg-${i}`,
        action: 'send_message' as const,
        params: { message: `Question ${i + 1}: Tell me about topic ${i + 1}` },
        description: `Send message ${i + 1}`,
      })),
      {
        id: 'wait-final',
        action: 'wait',
        params: { ms: 3000 },
        description: 'Wait for summarization',
      },
      {
        id: 'check-summary',
        action: 'check_memory',
        params: { checkSummary: true },
        description: 'Check for session summary',
      },
    ],
    assertions: [
      assert.custom('has-summary', (ctx) => {
        const memory = ctx.memory as { summary?: string };
        return !!memory?.summary && memory.summary.length > 0;
      }),
    ],
  },
  
  // MiniGPT Pattern - Context Setting
  {
    id: 'memory-minigpt-setup',
    name: 'MiniGPT pattern: First prompts set context for session',
    category: 'memory',
    tags: ['minigpt', 'context-setting'],
    steps: [
      {
        id: 'set-context-1',
        action: 'send_message',
        params: { 
          message: 'For this session, you are a helpful assistant focused on HR topics. Always respond with empathy and consider employee wellbeing.' 
        },
        description: 'Set session context',
      },
      {
        id: 'wait-1',
        action: 'wait',
        params: { ms: 2000 },
        description: 'Wait',
      },
      {
        id: 'set-context-2',
        action: 'send_message',
        params: { 
          message: 'Remember: our company values are innovation, integrity, and inclusivity.' 
        },
        description: 'Add company context',
      },
      {
        id: 'wait-2',
        action: 'wait',
        params: { ms: 2000 },
        description: 'Wait',
      },
      {
        id: 'test-context',
        action: 'send_message',
        params: { message: 'An employee is asking about flexible work arrangements. How should I respond?' },
        description: 'Test context is used',
      },
    ],
    assertions: [
      // Response should reflect HR focus and company values
      assert.custom('reflects-context', (ctx) => {
        const response = (ctx.response as string || '').toLowerCase();
        return (
          response.includes('employee') ||
          response.includes('wellbeing') ||
          response.includes('flexibility') ||
          response.includes('inclusive')
        );
      }),
    ],
  },
  
  // Cross-Session Memory (requires session switching)
  {
    id: 'memory-cross-session',
    name: 'Long-term memory persists across sessions',
    category: 'memory',
    tags: ['cross-session', 'long-term'],
    steps: [
      // Session 1: Store information
      {
        id: 'session-1-msg',
        action: 'send_message',
        params: { 
          message: 'Remember that my favorite programming language is Rust and I am building a real-time data pipeline.' 
        },
        description: 'Store preference in session 1',
      },
      {
        id: 'wait-1',
        action: 'wait',
        params: { ms: 3000 },
        description: 'Wait for memory save',
      },
      // Create new session
      {
        id: 'new-session',
        action: 'navigate',
        params: { url: '/chat', newSession: true },
        description: 'Start new session',
      },
      // Session 2: Check if memory is available
      {
        id: 'session-2-msg',
        action: 'send_message',
        params: { message: 'What programming language do I prefer?' },
        description: 'Ask about stored preference in session 2',
      },
    ],
    assertions: [
      assert.responseContains('Rust'),
    ],
  },
  
  // Hiring Workflow - Long Session Test
  {
    id: 'memory-hiring-workflow',
    name: 'Hiring workflow: Memory supports 50+ interactions',
    category: 'memory',
    tags: ['workflow', 'long-session', 'integration'],
    steps: [
      // Setup context
      {
        id: 'setup',
        action: 'send_message',
        params: { 
          message: 'I am hiring for a Senior Software Engineer position. The role requires 5+ years experience in distributed systems and strong Python skills.' 
        },
        description: 'Set hiring context',
      },
      {
        id: 'wait-setup',
        action: 'wait',
        params: { ms: 2000 },
        description: 'Wait',
      },
      // Upload JD (simulated)
      {
        id: 'jd-context',
        action: 'send_message',
        params: { 
          message: 'The job description emphasizes: cloud architecture, system design, technical leadership, and collaboration with product teams.' 
        },
        description: 'Provide JD details',
      },
      {
        id: 'wait-jd',
        action: 'wait',
        params: { ms: 2000 },
        description: 'Wait',
      },
      // First candidate
      {
        id: 'candidate-1',
        action: 'send_message',
        params: { 
          message: 'Candidate 1: Alice - 7 years experience, strong in AWS and Python, led a team of 5, worked at a startup.' 
        },
        description: 'Add first candidate',
      },
      {
        id: 'wait-c1',
        action: 'wait',
        params: { ms: 2000 },
        description: 'Wait',
      },
      // Second candidate
      {
        id: 'candidate-2',
        action: 'send_message',
        params: { 
          message: 'Candidate 2: Bob - 4 years experience, PhD in distributed systems, limited industry experience.' 
        },
        description: 'Add second candidate',
      },
      {
        id: 'wait-c2',
        action: 'wait',
        params: { ms: 2000 },
        description: 'Wait',
      },
      // Compare
      {
        id: 'compare',
        action: 'send_message',
        params: { message: 'Compare Alice and Bob for the Senior Software Engineer position based on the requirements.' },
        description: 'Request comparison',
      },
    ],
    assertions: [
      assert.responseContains('Alice'),
      assert.responseContains('Bob'),
      assert.responseContains('experience'),
      assert.hasEvaluation(),
    ],
  },
  
  // Memory Tier Testing
  {
    id: 'memory-tiers',
    name: 'Memory tiers are used appropriately by mode',
    category: 'memory',
    tags: ['tiers', 'modes'],
    steps: [
      // Store some facts
      {
        id: 'store-fact',
        action: 'send_message',
        params: { message: 'My project deadline is December 31st and the budget is $50,000.' },
        description: 'Store project facts',
      },
      {
        id: 'wait-1',
        action: 'wait',
        params: { ms: 2000 },
        description: 'Wait',
      },
      // Quick mode should use T1 only
      {
        id: 'select-quick',
        action: 'select_mode',
        params: { mode: 'quick' },
        description: 'Select quick mode',
      },
      {
        id: 'quick-query',
        action: 'send_message',
        params: { message: 'What is my deadline?' },
        description: 'Query in quick mode',
      },
    ],
    assertions: [
      // Memory events should show tiers used
      assert.eventOccurred('memory_retrieved'),
    ],
  },
];

export default memoryTestScenarios;
