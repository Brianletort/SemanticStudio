/**
 * Sample Prompts for Testing
 * 
 * A library of prompts categorized by type for testing
 * the chat system with diverse inputs.
 */

import { SamplePrompt } from '../framework/types';

export const samplePrompts: SamplePrompt[] = [
  // Simple prompts (should be quick mode)
  {
    id: 'simple-greeting',
    text: 'Hello',
    category: 'simple',
    expectedMode: 'quick',
    tags: ['greeting'],
  },
  {
    id: 'simple-count',
    text: 'How many customers do we have?',
    category: 'simple',
    expectedMode: 'quick',
    expectedDomains: ['customer'],
    tags: ['count', 'customer'],
  },
  {
    id: 'simple-list',
    text: 'List our products',
    category: 'simple',
    expectedMode: 'quick',
    expectedDomains: ['product'],
    tags: ['list', 'product'],
  },
  {
    id: 'simple-factual',
    text: 'What is our company name?',
    category: 'simple',
    expectedMode: 'quick',
    tags: ['factual'],
  },
  
  // Complex prompts (should be think or deep mode)
  {
    id: 'complex-analysis',
    text: 'Analyze our customer churn rate trends over the past 6 months and identify the key factors contributing to churn. Include recommendations for retention strategies.',
    category: 'complex',
    expectedMode: 'deep',
    expectedDomains: ['customer', 'sales'],
    tags: ['analysis', 'churn', 'trends'],
  },
  {
    id: 'complex-comparison',
    text: 'Compare our Q3 and Q4 sales performance across all regions, breaking down by product category and sales representative. Highlight any concerning trends.',
    category: 'complex',
    expectedMode: 'think',
    expectedDomains: ['sales', 'product'],
    tags: ['comparison', 'sales', 'quarterly'],
  },
  {
    id: 'complex-multi-domain',
    text: 'How does customer satisfaction correlate with product return rates and support ticket volume? Are there patterns by customer segment?',
    category: 'complex',
    expectedMode: 'deep',
    expectedDomains: ['customer', 'product', 'support'],
    tags: ['correlation', 'multi-domain'],
  },
  {
    id: 'complex-forecast',
    text: 'Based on current pipeline and historical conversion rates, forecast our Q1 revenue and identify risks to meeting our targets.',
    category: 'complex',
    expectedMode: 'think',
    expectedDomains: ['sales', 'finance'],
    tags: ['forecast', 'risk'],
  },
  
  // Domain-specific prompts
  {
    id: 'domain-customer-health',
    text: 'What is the health score distribution across our enterprise customers?',
    category: 'domain_specific',
    expectedMode: 'think',
    expectedDomains: ['customer'],
    tags: ['customer', 'health-score'],
  },
  {
    id: 'domain-sales-pipeline',
    text: 'Show me the current sales pipeline by stage and expected close date.',
    category: 'domain_specific',
    expectedMode: 'think',
    expectedDomains: ['sales'],
    tags: ['sales', 'pipeline'],
  },
  {
    id: 'domain-product-inventory',
    text: 'Which products are low on inventory and need reordering?',
    category: 'domain_specific',
    expectedMode: 'think',
    expectedDomains: ['product', 'operations'],
    tags: ['product', 'inventory'],
  },
  {
    id: 'domain-hr-headcount',
    text: 'What is our current headcount by department?',
    category: 'domain_specific',
    expectedMode: 'quick',
    expectedDomains: ['hr'],
    tags: ['hr', 'headcount'],
  },
  {
    id: 'domain-support-tickets',
    text: 'How many support tickets are currently open and what are the top issue categories?',
    category: 'domain_specific',
    expectedMode: 'think',
    expectedDomains: ['support'],
    tags: ['support', 'tickets'],
  },
  
  // Ambiguous prompts (should trigger clarification or smart inference)
  {
    id: 'ambiguous-growth',
    text: 'Tell me about our growth',
    category: 'ambiguous',
    expectedMode: 'think',
    tags: ['ambiguous', 'growth'],
  },
  {
    id: 'ambiguous-performance',
    text: 'How are we doing?',
    category: 'ambiguous',
    expectedMode: 'think',
    tags: ['ambiguous', 'performance'],
  },
  {
    id: 'ambiguous-issues',
    text: 'What are the main issues?',
    category: 'ambiguous',
    expectedMode: 'think',
    tags: ['ambiguous', 'issues'],
  },
  {
    id: 'ambiguous-research',
    text: 'Research our customers',
    category: 'ambiguous',
    expectedMode: 'research',
    tags: ['ambiguous', 'research'],
  },
  
  // Multi-turn prompts (follow-ups)
  {
    id: 'multi-turn-followup-1',
    text: 'Tell me more about that',
    category: 'multi_turn',
    tags: ['follow-up', 'context-dependent'],
  },
  {
    id: 'multi-turn-followup-2',
    text: 'What about the top 5?',
    category: 'multi_turn',
    tags: ['follow-up', 'refinement'],
  },
  {
    id: 'multi-turn-compare',
    text: 'How does that compare to last year?',
    category: 'multi_turn',
    tags: ['follow-up', 'comparison'],
  },
  {
    id: 'multi-turn-elaborate',
    text: 'Can you elaborate on the second point?',
    category: 'multi_turn',
    tags: ['follow-up', 'elaboration'],
  },
  
  // File-related prompts
  {
    id: 'file-analyze-csv',
    text: 'Analyze the data in the uploaded file and give me key insights',
    category: 'file_related',
    tags: ['file', 'analysis'],
  },
  {
    id: 'file-compare',
    text: 'Compare these two resumes and tell me which candidate is stronger',
    category: 'file_related',
    tags: ['file', 'comparison', 'resume'],
  },
  {
    id: 'file-summarize',
    text: 'Summarize this document',
    category: 'file_related',
    tags: ['file', 'summary'],
  },
  {
    id: 'file-extract',
    text: 'Extract all dates and amounts from this contract',
    category: 'file_related',
    tags: ['file', 'extraction'],
  },
  
  // Image-related prompts
  {
    id: 'image-generate-chart',
    text: 'Create a bar chart showing sales by region',
    category: 'image_related',
    tags: ['image', 'chart', 'generation'],
  },
  {
    id: 'image-generate-diagram',
    text: 'Generate a diagram of our data pipeline architecture',
    category: 'image_related',
    tags: ['image', 'diagram', 'generation'],
  },
  {
    id: 'image-describe',
    text: 'Describe what you see in this image',
    category: 'image_related',
    tags: ['image', 'vision'],
  },
];

/**
 * Get prompts by category
 */
export function getPromptsByCategory(category: SamplePrompt['category']): SamplePrompt[] {
  return samplePrompts.filter(p => p.category === category);
}

/**
 * Get prompts by expected mode
 */
export function getPromptsByExpectedMode(mode: string): SamplePrompt[] {
  return samplePrompts.filter(p => p.expectedMode === mode);
}

/**
 * Get prompts by tag
 */
export function getPromptsByTag(tag: string): SamplePrompt[] {
  return samplePrompts.filter(p => p.tags?.includes(tag));
}

/**
 * Get random prompts
 */
export function getRandomPrompts(count: number): SamplePrompt[] {
  const shuffled = [...samplePrompts].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export default samplePrompts;
