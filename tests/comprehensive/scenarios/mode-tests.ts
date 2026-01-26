/**
 * Mode Test Scenarios
 * 
 * Tests for chat mode functionality:
 * - Auto mode classification
 * - Quick mode speed
 * - Think mode with reflection
 * - Deep mode with graph traversal
 * - Research mode with clarification
 */

import { TestScenario } from '../framework/types';
import { assert } from '../framework/assertions';

export const modeTestScenarios: TestScenario[] = [
  // Auto Mode Classification
  {
    id: 'mode-auto-simple',
    name: 'Auto mode classifies simple query as quick',
    category: 'modes',
    tags: ['auto', 'classification'],
    steps: [
      {
        id: 'select-auto',
        action: 'select_mode',
        params: { mode: 'auto' },
        description: 'Select auto mode',
      },
      {
        id: 'send-simple',
        action: 'send_message',
        params: { message: 'What time is it?' },
        description: 'Send simple question',
      },
    ],
    assertions: [
      assert.modeIs('quick'),
      assert.responseTimeUnder(5000),
    ],
  },
  
  {
    id: 'mode-auto-complex',
    name: 'Auto mode classifies complex query as think or deep',
    category: 'modes',
    tags: ['auto', 'classification'],
    steps: [
      {
        id: 'select-auto',
        action: 'select_mode',
        params: { mode: 'auto' },
        description: 'Select auto mode',
      },
      {
        id: 'send-complex',
        action: 'send_message',
        params: { 
          message: 'Analyze our customer churn rate trends across all segments and compare with industry benchmarks. Include recommendations for retention strategies.' 
        },
        description: 'Send complex analysis question',
      },
    ],
    assertions: [
      // Should be think or deep, not quick
      assert.custom('mode-not-quick', (ctx) => {
        const mode = ctx.mode as string;
        return mode === 'think' || mode === 'deep' || mode === 'research';
      }),
      assert.hasEvaluation(),
    ],
  },
  
  // Quick Mode Tests
  {
    id: 'mode-quick-speed',
    name: 'Quick mode responds fast',
    category: 'modes',
    tags: ['quick', 'performance'],
    steps: [
      {
        id: 'select-quick',
        action: 'select_mode',
        params: { mode: 'quick' },
        description: 'Select quick mode',
      },
      {
        id: 'send',
        action: 'send_message',
        params: { message: 'List the top 5 customers' },
        description: 'Send quick query',
      },
    ],
    assertions: [
      assert.responseTimeUnder(3000),
      assert.hasEvaluation(),  // Evaluation runs for all modes now
    ],
  },
  
  {
    id: 'mode-quick-with-web',
    name: 'Quick mode with web search enabled',
    category: 'modes',
    tags: ['quick', 'web'],
    steps: [
      {
        id: 'select-quick',
        action: 'select_mode',
        params: { mode: 'quick' },
        description: 'Select quick mode',
      },
      {
        id: 'enable-web',
        action: 'toggle_web',
        params: { enabled: true },
        description: 'Enable web search',
      },
      {
        id: 'send',
        action: 'send_message',
        params: { message: 'What is the current stock price of Apple?' },
        description: 'Send web-requiring query',
      },
    ],
    assertions: [
      assert.eventOccurred('web_search_started'),
      assert.eventOccurred('web_search_complete'),
      assert.hasEvaluation(),
    ],
  },
  
  // Think Mode Tests
  {
    id: 'mode-think-retrieval',
    name: 'Think mode uses retrieval and reflection',
    category: 'modes',
    tags: ['think', 'retrieval'],
    steps: [
      {
        id: 'select-think',
        action: 'select_mode',
        params: { mode: 'think' },
        description: 'Select think mode',
      },
      {
        id: 'send',
        action: 'send_message',
        params: { message: 'How are our sales performing this quarter compared to last quarter?' },
        description: 'Send analysis query',
      },
    ],
    assertions: [
      assert.eventOccurred('retrieval_started'),
      assert.eventOccurred('retrieval_complete'),
      assert.eventOccurred('graph_traversal_started'),  // Think mode uses GraphRAG
      assert.hasEvaluation(),
      assert.qualityAbove(0.6),
    ],
  },
  
  // Deep Mode Tests
  {
    id: 'mode-deep-graph',
    name: 'Deep mode traverses knowledge graph',
    category: 'modes',
    tags: ['deep', 'graph'],
    steps: [
      {
        id: 'select-deep',
        action: 'select_mode',
        params: { mode: 'deep' },
        description: 'Select deep mode',
      },
      {
        id: 'send',
        action: 'send_message',
        params: { 
          message: 'Analyze the relationship between customer satisfaction scores and product return rates across all regions, including any correlations with sales rep performance.' 
        },
        description: 'Send deep analysis query',
      },
    ],
    assertions: [
      assert.eventOccurred('graph_traversal_started'),
      assert.eventOccurred('graph_traversal_complete'),
      assert.hasEvaluation(),
    ],
  },
  
  {
    id: 'mode-deep-with-web',
    name: 'Deep mode with web search for market context',
    category: 'modes',
    tags: ['deep', 'web'],
    steps: [
      {
        id: 'select-deep',
        action: 'select_mode',
        params: { mode: 'deep' },
        description: 'Select deep mode',
      },
      {
        id: 'enable-web',
        action: 'toggle_web',
        params: { enabled: true },
        description: 'Enable web search',
      },
      {
        id: 'send',
        action: 'send_message',
        params: { 
          message: 'Compare our product pricing strategy with industry competitors and suggest optimizations.' 
        },
        description: 'Send competitive analysis query',
      },
    ],
    assertions: [
      assert.eventOccurred('retrieval_complete'),
      assert.eventOccurred('web_search_complete'),
      assert.hasEvaluation(),
    ],
  },
  
  // Research Mode Tests
  {
    id: 'mode-research-clarification',
    name: 'Research mode asks clarifying questions for vague query',
    category: 'modes',
    tags: ['research', 'clarification'],
    steps: [
      {
        id: 'select-research',
        action: 'select_mode',
        params: { mode: 'research' },
        description: 'Select research mode',
      },
      {
        id: 'send',
        action: 'send_message',
        params: { message: 'Research our customer base' },
        description: 'Send vague research query',
      },
    ],
    assertions: [
      // Should ask clarifying questions for vague query
      assert.eventOccurred('clarification_requested'),
      assert.responseContains('question'),
    ],
  },
  
  {
    id: 'mode-research-job-created',
    name: 'Research mode creates background job for specific query',
    category: 'modes',
    tags: ['research', 'background', 'deep-research'],
    timeout: 120000, // 2 minute timeout for research job
    steps: [
      {
        id: 'select-research',
        action: 'select_mode',
        params: { mode: 'research' },
        description: 'Select research mode',
      },
      {
        id: 'send',
        action: 'send_message',
        params: { 
          message: 'Research market trends for AI startups in 2024, including funding rounds, growth metrics, and key players in the enterprise AI space.' 
        },
        description: 'Send specific research query',
      },
    ],
    assertions: [
      // Should create a background research job
      assert.eventOccurred('research_job_created'),
      assert.eventHasField('research_job_created', 'jobId'),
    ],
  },
  
  {
    id: 'mode-research-progress',
    name: 'Research mode emits progress events during execution',
    category: 'modes',
    tags: ['research', 'progress', 'deep-research'],
    timeout: 300000, // 5 minute timeout for full research
    steps: [
      {
        id: 'select-research',
        action: 'select_mode',
        params: { mode: 'research' },
        description: 'Select research mode',
      },
      {
        id: 'send',
        action: 'send_message',
        params: { 
          message: 'Research the competitive landscape for electric vehicles in 2024, including Tesla, BYD, and emerging players. Include market share data and growth projections.' 
        },
        description: 'Send detailed research query',
      },
    ],
    assertions: [
      assert.eventOccurred('research_job_created'),
      assert.eventOccurred('research_progress'),
    ],
  },
  
  {
    id: 'mode-research-complete',
    name: 'Research mode completes with sources and citations',
    category: 'modes',
    tags: ['research', 'completion', 'deep-research'],
    timeout: 600000, // 10 minute timeout for full research
    steps: [
      {
        id: 'select-research',
        action: 'select_mode',
        params: { mode: 'research' },
        description: 'Select research mode',
      },
      {
        id: 'send',
        action: 'send_message',
        params: { 
          message: 'Research the latest developments in quantum computing in 2024, focusing on major breakthroughs, key companies, and practical applications.' 
        },
        description: 'Send research query',
      },
    ],
    assertions: [
      assert.eventOccurred('research_job_created'),
      assert.eventOccurred('research_complete'),
      // Response should contain URLs (citations)
      assert.responseContains('http'),
      assert.hasEvaluation(),
    ],
  },
  
  {
    id: 'mode-research-specific',
    name: 'Research mode with specific query skips clarification',
    category: 'modes',
    tags: ['research', 'direct'],
    timeout: 120000, // 2 minute timeout
    steps: [
      {
        id: 'select-research',
        action: 'select_mode',
        params: { mode: 'research' },
        description: 'Select research mode',
      },
      {
        id: 'send',
        action: 'send_message',
        params: { 
          message: 'Research our enterprise customer segment including: current count, revenue contribution, churn rate trends, top accounts by revenue, and growth opportunities for Q4 2024.' 
        },
        description: 'Send specific research query',
      },
    ],
    assertions: [
      // Specific query should create job immediately (no clarification)
      assert.eventOccurred('research_job_created'),
      assert.hasEvaluation(),
    ],
  },
  
  // Mode Switching Tests
  {
    id: 'mode-switch-mid-session',
    name: 'Switching modes mid-session preserves context',
    category: 'modes',
    tags: ['switching', 'context'],
    steps: [
      {
        id: 'select-think',
        action: 'select_mode',
        params: { mode: 'think' },
        description: 'Select think mode',
      },
      {
        id: 'send-1',
        action: 'send_message',
        params: { message: 'Who is our top customer by revenue?' },
        description: 'Send first query in think mode',
      },
      {
        id: 'wait-1',
        action: 'wait',
        params: { ms: 2000 },
        description: 'Wait for response',
      },
      {
        id: 'select-deep',
        action: 'select_mode',
        params: { mode: 'deep' },
        description: 'Switch to deep mode',
      },
      {
        id: 'send-2',
        action: 'send_message',
        params: { message: 'Tell me more about their purchase history and engagement.' },
        description: 'Send follow-up in deep mode',
      },
    ],
    assertions: [
      // Should reference previous context
      assert.responseContains('customer'),
      assert.hasEvaluation(),
    ],
  },
];

export default modeTestScenarios;
