/**
 * Random Prompt Generator for Chaos Testing
 * 
 * Generates various types of prompts to stress test the system
 * and discover edge cases.
 */

export type PromptCategory = 
  | 'normal'
  | 'long'
  | 'short'
  | 'special'
  | 'unicode'
  | 'injection'
  | 'ambiguous'
  | 'rapid';

interface GeneratedPrompt {
  text: string;
  category: PromptCategory;
  expectedBehavior: 'success' | 'graceful_fail' | 'error';
  description: string;
}

// Word banks for generating prompts
const subjects = [
  'sales', 'customers', 'products', 'employees', 'orders',
  'inventory', 'revenue', 'expenses', 'marketing', 'support',
];

const verbs = [
  'show', 'analyze', 'compare', 'summarize', 'list',
  'explain', 'calculate', 'find', 'get', 'display',
];

const modifiers = [
  'top 10', 'all', 'recent', 'trending', 'best performing',
  'worst performing', 'average', 'total', 'monthly', 'quarterly',
];

const timeRanges = [
  'this month', 'last quarter', 'year to date', 'all time',
  'past 30 days', 'Q4 2024', 'January 2025', 'this week',
];

// Unicode character sets
const unicodeChars = {
  japanese: '日本語テスト文字列',
  chinese: '中文测试字符串',
  korean: '한국어 테스트 문자열',
  arabic: 'نص الاختبار العربي',
  emoji: '🚀💡📊🎯✨🔥💪🌟',
  math: '∑∏∫√∞≈≠≤≥',
  special: '©®™°±µ¶',
};

// Injection patterns to test security
const injectionPatterns = [
  "'; DROP TABLE users; --",
  "1' OR '1'='1",
  "<script>alert('xss')</script>",
  "{{7*7}}",  // Template injection
  "${7*7}",   // Another template format
  "{{constructor.constructor('return this')()}}",
  "../../etc/passwd",
  "%00%0a%0d",
  "\\x00\\x0a\\x0d",
];

/**
 * Generate a normal business query
 */
function generateNormalPrompt(): GeneratedPrompt {
  const verb = verbs[Math.floor(Math.random() * verbs.length)];
  const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
  const subject = subjects[Math.floor(Math.random() * subjects.length)];
  const time = timeRanges[Math.floor(Math.random() * timeRanges.length)];
  
  return {
    text: `${verb} ${modifier} ${subject} for ${time}`,
    category: 'normal',
    expectedBehavior: 'success',
    description: 'Standard business query',
  };
}

/**
 * Generate a long prompt (1000+ characters)
 */
function generateLongPrompt(): GeneratedPrompt {
  const parts: string[] = [];
  let length = 0;
  
  while (length < 1500) {
    const prompt = generateNormalPrompt();
    parts.push(prompt.text);
    length += prompt.text.length + 20;
    parts.push('. Additionally, ');
  }
  
  const text = "I need comprehensive analysis covering: " + 
    parts.join('') + 
    ". Please be thorough.";
  
  return {
    text,
    category: 'long',
    expectedBehavior: 'success',
    description: `Very long prompt (${text.length} chars)`,
  };
}

/**
 * Generate a short/ambiguous prompt
 */
function generateShortPrompt(): GeneratedPrompt {
  const shortPrompts = [
    '?',
    'hi',
    'ok',
    'yes',
    'no',
    'help',
    'what',
    'more',
    'data',
    '...',
    'hmm',
  ];
  
  const text = shortPrompts[Math.floor(Math.random() * shortPrompts.length)];
  
  return {
    text,
    category: 'short',
    expectedBehavior: 'success',
    description: 'Very short/ambiguous prompt',
  };
}

/**
 * Generate a special characters prompt
 */
function generateSpecialPrompt(): GeneratedPrompt {
  const specialCases = [
    "What's the status of O'Brien's account?",
    'Search for "quoted text" in responses',
    "Calculate 50% of revenue vs. last year's 75%",
    "Show data where value > 100 && category != 'archived'",
    "Compare A+B vs C-D metrics (2024)",
    "Find items with tags: [urgent], {priority}, <important>",
    "Email: test@example.com Phone: +1-555-123-4567",
    "Path: C:\\Users\\test\\Documents\\report.xlsx",
    "URL: https://example.com/api?key=value&foo=bar",
    "Regex pattern: ^[a-zA-Z0-9]+@[a-z]+\\.[a-z]{2,}$",
  ];
  
  const text = specialCases[Math.floor(Math.random() * specialCases.length)];
  
  return {
    text,
    category: 'special',
    expectedBehavior: 'success',
    description: 'Prompt with special characters',
  };
}

/**
 * Generate a unicode prompt
 */
function generateUnicodePrompt(): GeneratedPrompt {
  const parts: string[] = [];
  
  // Mix English with various unicode
  parts.push('Show data for ');
  parts.push(unicodeChars.japanese);
  parts.push(' and ');
  parts.push(unicodeChars.emoji);
  parts.push(' departments. ');
  parts.push('Include metrics: ');
  parts.push(unicodeChars.math);
  
  return {
    text: parts.join(''),
    category: 'unicode',
    expectedBehavior: 'success',
    description: 'Prompt with unicode characters',
  };
}

/**
 * Generate an injection attempt prompt (for security testing)
 */
function generateInjectionPrompt(): GeneratedPrompt {
  const pattern = injectionPatterns[Math.floor(Math.random() * injectionPatterns.length)];
  const prefix = "Search for customer: ";
  
  return {
    text: prefix + pattern,
    category: 'injection',
    expectedBehavior: 'graceful_fail',
    description: 'Injection attempt - should be handled safely',
  };
}

/**
 * Generate an ambiguous prompt
 */
function generateAmbiguousPrompt(): GeneratedPrompt {
  const ambiguous = [
    "it",
    "that thing from before",
    "the usual",
    "you know what I mean",
    "same as last time",
    "do the thing",
    "fix it",
    "make it better",
    "change that",
    "update everything",
  ];
  
  const text = ambiguous[Math.floor(Math.random() * ambiguous.length)];
  
  return {
    text,
    category: 'ambiguous',
    expectedBehavior: 'success',
    description: 'Ambiguous prompt requiring clarification',
  };
}

/**
 * Generate a rapid-fire prompt (meant to be sent in quick succession)
 */
function generateRapidPrompt(): GeneratedPrompt {
  const rapid = [
    "quick: sales total",
    "fast: top customer",
    "now: revenue",
    "asap: order count",
    "urgent: status",
  ];
  
  const text = rapid[Math.floor(Math.random() * rapid.length)];
  
  return {
    text,
    category: 'rapid',
    expectedBehavior: 'success',
    description: 'Quick prompt for rapid-fire testing',
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate prompts of a specific category
 */
export function generatePrompts(
  count: number,
  category: PromptCategory
): GeneratedPrompt[] {
  const generators: Record<PromptCategory, () => GeneratedPrompt> = {
    normal: generateNormalPrompt,
    long: generateLongPrompt,
    short: generateShortPrompt,
    special: generateSpecialPrompt,
    unicode: generateUnicodePrompt,
    injection: generateInjectionPrompt,
    ambiguous: generateAmbiguousPrompt,
    rapid: generateRapidPrompt,
  };
  
  const generator = generators[category];
  const prompts: GeneratedPrompt[] = [];
  
  for (let i = 0; i < count; i++) {
    prompts.push(generator());
  }
  
  return prompts;
}

/**
 * Generate a mixed batch of prompts
 */
export function generateMixedPrompts(count: number): GeneratedPrompt[] {
  const categories: PromptCategory[] = [
    'normal', 'normal', 'normal', // Weight towards normal
    'long', 'short', 'special',
    'unicode', 'ambiguous', 'rapid',
  ];
  
  const prompts: GeneratedPrompt[] = [];
  
  for (let i = 0; i < count; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    prompts.push(...generatePrompts(1, category));
  }
  
  return prompts;
}

/**
 * Generate prompts for stress testing
 */
export function generateStressTestPrompts(count: number): GeneratedPrompt[] {
  const prompts: GeneratedPrompt[] = [];
  
  // 60% normal
  prompts.push(...generatePrompts(Math.floor(count * 0.6), 'normal'));
  
  // 15% long
  prompts.push(...generatePrompts(Math.floor(count * 0.15), 'long'));
  
  // 10% special/unicode
  prompts.push(...generatePrompts(Math.floor(count * 0.05), 'special'));
  prompts.push(...generatePrompts(Math.floor(count * 0.05), 'unicode'));
  
  // 10% edge cases
  prompts.push(...generatePrompts(Math.floor(count * 0.05), 'short'));
  prompts.push(...generatePrompts(Math.floor(count * 0.05), 'ambiguous'));
  
  // 5% injection tests
  prompts.push(...generatePrompts(Math.floor(count * 0.05), 'injection'));
  
  // Shuffle
  return prompts.sort(() => Math.random() - 0.5);
}

/**
 * Get predefined edge case prompts
 */
export const predefinedEdgeCases: GeneratedPrompt[] = [
  {
    text: "",
    category: 'short',
    expectedBehavior: 'graceful_fail',
    description: 'Empty prompt',
  },
  {
    text: "   \n\t\r   ",
    category: 'short',
    expectedBehavior: 'graceful_fail',
    description: 'Whitespace only',
  },
  {
    text: "a".repeat(50000),
    category: 'long',
    expectedBehavior: 'graceful_fail',
    description: 'Extremely long single character',
  },
  {
    text: "\0\0\0",
    category: 'special',
    expectedBehavior: 'graceful_fail',
    description: 'Null characters',
  },
  {
    text: "🔥".repeat(1000),
    category: 'unicode',
    expectedBehavior: 'graceful_fail',
    description: 'Many emoji characters',
  },
  {
    text: "SELECT * FROM users WHERE 1=1; DROP TABLE messages; --",
    category: 'injection',
    expectedBehavior: 'graceful_fail',
    description: 'SQL injection attempt',
  },
  {
    text: "<img src=x onerror=alert('XSS')>",
    category: 'injection',
    expectedBehavior: 'graceful_fail',
    description: 'XSS attempt',
  },
];

export type { GeneratedPrompt };
