/**
 * ClarificationAgent - Gathers context before research mode execution
 * 
 * Pattern:
 * 1. Analyze user query for completeness
 * 2. Generate 2-3 targeted clarifying questions
 * 3. Use answers to enhance research instructions
 * 
 * Only activates for 'research' mode queries.
 */

import { chat } from '@/lib/llm';

// Question types
export interface ClarificationQuestion {
  id: string;
  question: string;
  type: 'single_choice' | 'multiple_choice' | 'free_text';
  options?: string[];
  required: boolean;
  context?: string;  // Why we're asking this question
}

// Clarification result
export interface ClarificationResult {
  shouldClarify: boolean;
  questions: ClarificationQuestion[];
  originalQuery: string;
  queryCategory?: string;
  skipReason?: string;
}

// Domain-specific question templates
const QUESTION_TEMPLATES: Record<string, ClarificationQuestion[]> = {
  customer: [
    {
      id: 'relationship_focus',
      question: 'What aspect of the customer should I focus on?',
      type: 'single_choice',
      options: [
        'Current status and health',
        'Transaction history',
        'Support interactions',
        'Complete 360-degree view',
      ],
      required: true,
      context: 'This determines which data domains to query',
    },
  ],
  sales: [
    {
      id: 'pipeline_scope',
      question: 'What pipeline scope should I analyze?',
      type: 'single_choice',
      options: [
        'Active opportunities only',
        'Full pipeline including closed',
        'Forecast and projections',
        'Historical trends',
      ],
      required: true,
      context: 'This helps focus the sales analysis',
    },
  ],
  product: [
    {
      id: 'product_focus',
      question: 'What product aspect are you interested in?',
      type: 'single_choice',
      options: [
        'Inventory and availability',
        'Pricing and margins',
        'Performance metrics',
        'Category analysis',
      ],
      required: true,
      context: 'This determines the product data to retrieve',
    },
  ],
  finance: [
    {
      id: 'finance_scope',
      question: 'What financial analysis do you need?',
      type: 'single_choice',
      options: [
        'Revenue and transactions',
        'Budget vs actuals',
        'Cash flow analysis',
        'Comprehensive P&L',
      ],
      required: true,
      context: 'This shapes the financial report structure',
    },
  ],
  comparison: [
    {
      id: 'comparison_metrics',
      question: 'Which metrics are most important for your comparison?',
      type: 'multiple_choice',
      options: [
        'Revenue and growth',
        'Customer metrics',
        'Operational efficiency',
        'Market positioning',
        'All key metrics',
      ],
      required: true,
      context: 'This structures the comparison analysis',
    },
  ],
  general: [
    {
      id: 'scope',
      question: 'What level of detail do you need?',
      type: 'single_choice',
      options: [
        'Executive summary (2-5 pages)',
        'Detailed analysis (10-20 pages)',
        'Comprehensive report (20+ pages)',
      ],
      required: true,
      context: 'This determines the depth and breadth of research',
    },
    {
      id: 'purpose',
      question: 'What is the primary purpose of this research?',
      type: 'single_choice',
      options: [
        'Strategic planning',
        'Operational decision',
        'Customer presentation',
        'General information',
      ],
      required: true,
      context: 'This helps tailor the content and recommendations',
    },
  ],
};

/**
 * ClarificationAgent analyzes queries and generates clarifying questions
 */
export class ClarificationAgent {
  /**
   * Analyze query and determine if clarification is needed
   */
  async analyze(
    query: string,
    options?: { skipClarification?: boolean }
  ): Promise<ClarificationResult> {
    // Allow explicit skip
    if (options?.skipClarification) {
      return {
        shouldClarify: false,
        questions: [],
        originalQuery: query,
        skipReason: 'Clarification explicitly skipped',
      };
    }
    
    // Check if query is already specific enough
    if (this.isQuerySufficient(query)) {
      return {
        shouldClarify: false,
        questions: [],
        originalQuery: query,
        skipReason: 'Query is sufficiently specific',
      };
    }
    
    // Categorize the query
    const category = this.categorizeQuery(query);
    
    // Generate clarifications based on category
    return this.generateClarifications(query, category);
  }
  
  /**
   * Check if query is specific enough to skip clarification
   */
  private isQuerySufficient(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    
    // If query has multiple specific criteria, it's probably sufficient
    const hasEntity = /\b(customer|product|employee|order|transaction)\s+\w+/i.test(query);
    const hasMetric = /\b(revenue|sales|count|total|average|growth|margin)\b/i.test(lowerQuery);
    const hasTimeframe = /\b(today|yesterday|this week|this month|this year|last|recent|q[1-4]|20\d{2})\b/i.test(lowerQuery);
    const hasAction = /\b(list|show|compare|analyze|report|find|get)\b/i.test(lowerQuery);
    
    const specificityScore = [hasEntity, hasMetric, hasTimeframe, hasAction].filter(Boolean).length;
    
    // If 3+ criteria met, query is specific enough
    return specificityScore >= 3;
  }
  
  /**
   * Categorize query into domain for template selection
   */
  private categorizeQuery(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (/\b(customer|client|account|segment)\b/i.test(lowerQuery)) {
      return 'customer';
    }
    
    if (/\b(sales|pipeline|opportunity|deal|forecast)\b/i.test(lowerQuery)) {
      return 'sales';
    }
    
    if (/\b(product|inventory|sku|category|pricing)\b/i.test(lowerQuery)) {
      return 'product';
    }
    
    if (/\b(finance|revenue|budget|p&l|cash|transaction)\b/i.test(lowerQuery)) {
      return 'finance';
    }
    
    if (/\b(compare|versus|vs|difference|better)\b/i.test(lowerQuery)) {
      return 'comparison';
    }
    
    return 'general';
  }
  
  /**
   * Generate clarification questions based on query category
   */
  private async generateClarifications(
    query: string,
    category: string
  ): Promise<ClarificationResult> {
    // Get template questions for this category
    const templateQuestions = QUESTION_TEMPLATES[category] || QUESTION_TEMPLATES.general;
    
    if (templateQuestions.length > 0) {
      return {
        shouldClarify: true,
        questions: templateQuestions.slice(0, 3),  // Max 3 questions
        originalQuery: query,
        queryCategory: category,
      };
    }
    
    // Fallback to LLM-generated questions
    return this.generateLLMClarifications(query);
  }
  
  /**
   * Use LLM to generate clarification questions for general queries
   */
  private async generateLLMClarifications(query: string): Promise<ClarificationResult> {
    const prompt = `You are helping prepare for a comprehensive research task.

USER QUERY: "${query}"

Generate 2-3 clarifying questions to ensure the research is comprehensive and targeted.

GUIDELINES:
- Be concise - max 2-3 questions
- Focus on: scope, depth, format, and specific aspects they care about
- Don't ask for info already in the query

Return JSON ONLY:
{
  "questions": [
    {
      "id": "q1",
      "question": "Your question here",
      "type": "single_choice",
      "options": ["Option 1", "Option 2", "Option 3"],
      "required": true,
      "context": "Why this matters"
    }
  ]
}`;

    try {
      const response = await chat('planner', [
        { role: 'system', content: 'You generate clarifying questions for research tasks. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ]);
      
      const parsed = JSON.parse(response.content);
      const questions = (parsed.questions || []).slice(0, 3);
      
      return {
        shouldClarify: questions.length > 0,
        questions,
        originalQuery: query,
        queryCategory: 'general',
      };
    } catch (error) {
      console.error('[Clarification] LLM generation failed:', error);
      
      // Return default questions
      return {
        shouldClarify: true,
        questions: QUESTION_TEMPLATES.general,
        originalQuery: query,
        queryCategory: 'general',
      };
    }
  }
  
  /**
   * Format clarifications for display in chat
   */
  formatForChat(result: ClarificationResult): string {
    if (!result.shouldClarify || result.questions.length === 0) {
      return '';
    }
    
    let output = `## Before I begin your research...\n\n`;
    output += `To provide you with the most comprehensive and relevant report, I have a few quick questions:\n\n`;
    
    result.questions.forEach((q, idx) => {
      output += `### ${idx + 1}. ${q.question}\n`;
      if (q.context) {
        output += `*${q.context}*\n`;
      }
      if (q.options && q.options.length > 0) {
        q.options.forEach((opt, optIdx) => {
          output += `- **${String.fromCharCode(65 + optIdx)}.** ${opt}\n`;
        });
      }
      output += `\n`;
    });
    
    output += `---\n`;
    output += `*Please answer these questions, and I'll begin your comprehensive research.*`;
    
    return output;
  }
  
  /**
   * Detect if a message is an answer to previous clarification questions
   */
  detectClarificationAnswer(
    currentMessage: string,
    previousAssistantMessage: string
  ): boolean {
    const lowerAssistant = previousAssistantMessage.toLowerCase();
    
    // Check if previous message was a clarification request
    const isClarificationMessage = 
      lowerAssistant.includes('before i begin your research') ||
      lowerAssistant.includes('clarifying questions') ||
      lowerAssistant.includes('few quick questions') ||
      (lowerAssistant.includes('**a.**') && lowerAssistant.includes('**b.**'));
    
    if (!isClarificationMessage) {
      return false;
    }
    
    // If previous was clarification, current is likely an answer
    return true;
  }
  
  /**
   * Extract answers from user response to clarification
   */
  extractAnswers(userResponse: string): Record<string, string> {
    const answers: Record<string, string> = {};
    
    // Store full response
    answers['user_response'] = userResponse;
    
    // Try to parse letter answers (A, B, C, D)
    const letterPattern = /\b([A-D])\b/gi;
    const letterMatches = userResponse.match(letterPattern);
    if (letterMatches) {
      letterMatches.forEach((letter, idx) => {
        answers[`answer_${idx + 1}`] = letter.toUpperCase();
      });
    }
    
    // Try to parse numbered answers (1, 2, 3)
    const numberPattern = /\b(\d)\.\s*([^,\n]+)/g;
    let match;
    while ((match = numberPattern.exec(userResponse)) !== null) {
      answers[`q${match[1]}`] = match[2].trim();
    }
    
    return answers;
  }
}

/**
 * Create a new clarification agent instance
 */
export function createClarificationAgent(): ClarificationAgent {
  return new ClarificationAgent();
}
