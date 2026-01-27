/**
 * Sample Test Data
 * 
 * Test prompts, expected responses, and random generators for memory testing.
 */

// ============================================================================
// Structured Test Prompts
// ============================================================================

/**
 * Personal information prompts that should be extracted as facts
 */
export const personalInfoPrompts = [
  {
    prompt: "My name is Dr. Sarah Chen and I'm the VP of Engineering at TechCorp.",
    expectedFacts: [
      { key: 'name', value: 'Dr. Sarah Chen' },
      { key: 'role', value: 'VP of Engineering' },
      { key: 'company', value: 'TechCorp' },
    ],
  },
  {
    prompt: "I've been in the tech industry for 15 years and prefer detailed technical explanations.",
    expectedFacts: [
      { key: 'experience', value: '15 years' },
      { key: 'preference', value: 'detailed technical explanations' },
    ],
  },
  {
    prompt: "I work remotely from Austin, Texas and my timezone is CST.",
    expectedFacts: [
      { key: 'location', value: 'Austin, Texas' },
      { key: 'timezone', value: 'CST' },
    ],
  },
];

/**
 * Constraint prompts that should influence future responses
 */
export const constraintPrompts = [
  {
    prompt: "I'm only interested in data from Q4 2024.",
    expectedFact: { key: 'time_constraint', value: 'Q4 2024' },
  },
  {
    prompt: "Focus only on the Texas and California regions.",
    expectedFact: { key: 'region_constraint', value: 'Texas, California' },
  },
  {
    prompt: "Exclude any products under $100 from your analysis.",
    expectedFact: { key: 'price_constraint', value: '>= $100' },
  },
  {
    prompt: "I prefer data visualized as charts rather than tables.",
    expectedFact: { key: 'visualization_preference', value: 'charts' },
  },
];

/**
 * Entity discussion prompts (for context graph testing)
 */
export const entityDiscussionPrompts = [
  {
    prompt: "Tell me about our top customer Acme Corporation and their recent orders.",
    expectedEntity: 'Acme Corporation',
    entityType: 'company',
  },
  {
    prompt: "What's the status of the Enterprise Widget product line?",
    expectedEntity: 'Enterprise Widget',
    entityType: 'product',
  },
  {
    prompt: "Show me John Smith's sales performance this quarter.",
    expectedEntity: 'John Smith',
    entityType: 'person',
  },
  {
    prompt: "I need details about the Chicago warehouse operations.",
    expectedEntity: 'Chicago warehouse',
    entityType: 'location',
  },
];

/**
 * Topic change prompts (for testing context isolation)
 */
export const topicChangePrompts = [
  "Let's switch to discussing the marketing budget.",
  "Actually, I want to know about employee satisfaction.",
  "Can we look at support tickets instead?",
  "I'd like to change topics to inventory management.",
  "Let's talk about something different - customer retention.",
];

/**
 * Follow-up prompts that test context retention
 */
export const contextRetentionPrompts = [
  {
    setup: "My name is Alex and I work at Acme Corp.",
    followUp: "What's my name and where do I work?",
    expectedInResponse: ['Alex', 'Acme'],
  },
  {
    setup: "I prefer responses in bullet points.",
    followUp: "Give me 5 tips for productivity.",
    expectedInResponse: ['•', '-'], // Bullet points
  },
  {
    setup: "I'm a Python developer.",
    followUp: "Show me how to read a file.",
    expectedInResponse: ['python', 'open('],
  },
];

// ============================================================================
// Random Prompt Generators
// ============================================================================

const adjectives = ['important', 'urgent', 'detailed', 'quick', 'comprehensive', 'brief'];
const topics = ['sales', 'marketing', 'engineering', 'finance', 'HR', 'operations'];
const actions = ['analyze', 'summarize', 'explain', 'compare', 'list', 'describe'];
const timeframes = ['this week', 'last month', 'Q4 2024', 'year-to-date', 'all time'];

/**
 * Generate random normal business queries
 */
export function generateRandomQuery(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const topic = topics[Math.floor(Math.random() * topics.length)];
  const action = actions[Math.floor(Math.random() * actions.length)];
  const time = timeframes[Math.floor(Math.random() * timeframes.length)];
  
  return `Please ${action} the ${adj} ${topic} data for ${time}.`;
}

/**
 * Generate random long prompts
 */
export function generateLongPrompt(minLength: number = 500): string {
  const base = "I need a very detailed analysis of ";
  const items = [
    "sales performance across all regions",
    "customer satisfaction metrics",
    "product inventory levels",
    "employee productivity statistics",
    "marketing campaign effectiveness",
  ];
  
  let prompt = base;
  while (prompt.length < minLength) {
    prompt += items[Math.floor(Math.random() * items.length)] + ", ";
    prompt += "including " + generateRandomQuery() + " Additionally, ";
  }
  
  return prompt.slice(0, -13) + "."; // Remove trailing "Additionally, "
}

/**
 * Edge case prompts for stress testing
 */
export const edgeCasePrompts = {
  empty: "",
  whitespace: "   \n\t   ",
  singleChar: "?",
  veryLong: "a".repeat(10000),
  unicode: "What about 日本語データ? And emoji 🚀📊?",
  specialChars: "Show data where name = 'O\\'Brien' AND status <> 'inactive'",
  sqlInjection: "SELECT * FROM users; DROP TABLE users; --",
  xssAttempt: "<script>alert('xss')</script>",
  htmlTags: "<b>bold</b> and <i>italic</i> text",
  markdownHeavy: "# Header\n## Subheader\n```code```\n| a | b |\n|---|---|",
  numbersOnly: "12345678901234567890",
  repeatedQuestion: "What? ".repeat(100),
};

// ============================================================================
// Test Scenarios
// ============================================================================

/**
 * Multi-turn conversation scenario for session memory testing
 */
export const multiTurnScenario = [
  { role: 'user', content: "Hi, I'm testing the memory system." },
  { role: 'user', content: "My name is TestUser and I work on data analytics." },
  { role: 'user', content: "I'm interested in sales data from the West region." },
  { role: 'user', content: "What do you know about me so far?" },
  { role: 'user', content: "Also, I prefer charts over tables." },
  { role: 'user', content: "Summarize what you've learned about my preferences." },
];

/**
 * Progressive conversation for compression testing
 */
export function generateProgressiveConversation(turns: number): string[] {
  const messages: string[] = [];
  const topics = [
    'sales trends', 'customer behavior', 'product performance',
    'regional analysis', 'competitor insights', 'market forecasts',
  ];
  
  for (let i = 0; i < turns; i++) {
    const topic = topics[i % topics.length];
    messages.push(`Turn ${i + 1}: Tell me about ${topic} in detail with examples.`);
  }
  
  return messages;
}

/**
 * Cross-session test data
 */
export const crossSessionScenario = {
  session1: {
    prompts: [
      "Remember that my name is CrossSessionTest.",
      "I prefer dark mode interfaces.",
      "My favorite programming language is TypeScript.",
    ],
  },
  session2: {
    prompts: [
      "What's my name?",
      "What are my preferences?",
      "Which programming language do I prefer?",
    ],
    expectedRetrieval: ['CrossSessionTest', 'dark mode', 'TypeScript'],
  },
};

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if response contains expected content
 */
export function responseContains(response: string, expected: string[]): boolean {
  const lowerResponse = response.toLowerCase();
  return expected.some(exp => lowerResponse.includes(exp.toLowerCase()));
}

/**
 * Check if response contains any entity mentions
 */
export function containsEntityMention(response: string, entities: string[]): string[] {
  const lowerResponse = response.toLowerCase();
  return entities.filter(entity => lowerResponse.includes(entity.toLowerCase()));
}
