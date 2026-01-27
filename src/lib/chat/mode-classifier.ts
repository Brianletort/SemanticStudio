/**
 * Mode Classifier - Automatic query mode detection
 * 
 * Two-tier approach:
 * 1. Fast heuristic classification (regex patterns, domain counting)
 * 2. LLM fallback for edge cases (confidence < 0.75)
 * 
 * Modes:
 * - quick: Simple queries, single domain, fast answers
 * - think: Balanced analysis, 2-3 domains (DEFAULT)
 * - deep: Comprehensive analysis, 4+ domains, due diligence
 * - research: Explicit research requests, in-depth investigation
 */

import { streamChat } from '@/lib/llm';
import type { ChatMode, ModeClassification } from './types';

// =============================================================================
// DOMAIN INDICATORS - Business domains for SemanticStudio
// =============================================================================

const DOMAIN_INDICATORS: Record<string, RegExp> = {
  customer: /\b(customer|client|account|buyer|user|subscriber|member|customer\s+lifetime|churn|retention|segment)\b/i,
  sales: /\b(sales|revenue|deal|opportunity|pipeline|quota|forecast|won|lost|close|conversion)\b/i,
  product: /\b(product|item|sku|catalog|inventory|stock|merchandise|goods|offering)\b/i,
  finance: /\b(finance|budget|expense|cost|profit|margin|p&l|cashflow|revenue|spending|financial)\b/i,
  operations: /\b(operations|supply\s+chain|logistics|shipping|fulfillment|order|supplier|vendor|warehouse)\b/i,
  hr: /\b(hr|human\s+resources|employee|staff|hire|salary|department|manager|team|headcount|turnover)\b/i,
  support: /\b(support|ticket|issue|complaint|sla|resolution|help\s+desk|service|escalation)\b/i,
};

// =============================================================================
// DEEP MODE DETECTION
// =============================================================================

/**
 * Check if query requires deep mode (comprehensive analysis)
 */
function shouldUseDeepMode(query: string): boolean {
  const deepIndicators = [
    /\b(comprehensive|exhaustive|complete|full)\s+(analysis|report|study|review)\b/i,
    /\b(all\s+(aspects|factors|considerations|risks))\b/i,
    /\b(detailed\s+breakdown|deep\s+dive|thorough\s+review)\b/i,
    /\b(multi-factor|multi-domain|cross-domain|cross-functional)\b/i,
    /\b(strategic|long-term|roadmap|planning)\b/i,
    /\b(generate|create|prepare|draft)\s+(a\s+)?(comprehensive|detailed|full)\b/i,
    /\b(compare\s+and\s+contrast|in-depth\s+comparison)\b/i,
    /\b(executive\s+summary|board\s+report|management\s+review)\b/i,
  ];
  
  if (deepIndicators.some(p => p.test(query))) {
    return true;
  }
  
  // Count domains - if 4+ domains detected, use deep
  const lowerQuery = query.toLowerCase();
  const detectedDomains = Object.entries(DOMAIN_INDICATORS)
    .filter(([_, pattern]) => pattern.test(lowerQuery))
    .map(([domain]) => domain);
  
  if (detectedDomains.length >= 4) {
    return true;
  }
  
  return false;
}

// =============================================================================
// RESEARCH MODE DETECTION
// =============================================================================

/**
 * Check if query requires research mode (in-depth investigation)
 */
function shouldUseResearchMode(query: string): boolean {
  const researchIndicators = [
    /\b(research|investigate|study|explore)\b.*\b(in[\-\s]?depth|thoroughly|comprehensively)\b/i,
    /\b(find\s+everything|gather\s+all|collect\s+all)\b/i,
    /\b(market\s+research|competitive\s+analysis|industry\s+analysis)\b/i,
    /\b(root\s+cause|why\s+did|how\s+did|what\s+caused)\b.*\b(happen|occur|fail)\b/i,
    /\b(historical\s+analysis|trend\s+analysis|pattern\s+analysis)\b/i,
  ];
  
  return researchIndicators.some(p => p.test(query));
}

// =============================================================================
// QUICK MODE DETECTION - CONSERVATIVE
// =============================================================================

/**
 * Check if query can use quick mode (simple, single-domain)
 * CONSERVATIVE: Only returns true for truly trivial queries
 */
function shouldUseQuickMode(query: string): boolean {
  const lowerQuery = query.toLowerCase().trim();
  
  // Always use quick: Trivial/greeting patterns
  const trivialPatterns = [
    /^(hi|hello|hey|thanks|thank you|ok|okay|got it|sure|yes|no)[\.\!\?]?$/i,
    /^what is (a |an |the )?\w{1,20}\??$/i,  // "What is X?" (single word)
    /^who is \w+\??$/i,                        // "Who is X?" (single word)
    /^(help|menu|options|commands)[\.\!\?]?$/i,
    /^how many\s+\w+\s*\??$/i,                // "How many X?"
  ];
  
  if (trivialPatterns.some(p => p.test(query))) {
    return true;
  }
  
  // Never use quick: Complex patterns that need full analysis
  const complexPatterns = [
    /\b(compare|versus|vs\.)\b/i,                    // Comparisons
    /\b(analysis|analyze|assess|evaluate)\b/i,       // Analysis requests
    /\b(comprehensive|detailed|thorough|full)\b/i,   // Depth indicators
    /\b(multiple|several|all|every)\b/i,             // Multiple items
    /(,\s*\w+){2,}/i,                                // Lists (A, B, C)
    /\b(trend|pattern|over\s+time|historically)\b/i, // Temporal analysis
    /\b(why|explain|describe\s+how)\b/i,             // Explanatory questions
  ];
  
  if (complexPatterns.some(p => p.test(query))) {
    return false;
  }
  
  // Estimate domain count
  const detectedDomains = Object.entries(DOMAIN_INDICATORS)
    .filter(([_, pattern]) => pattern.test(lowerQuery))
    .map(([domain]) => domain);
  
  // Multi-domain queries need think mode
  if (detectedDomains.length > 1) {
    return false;
  }
  
  // Short + single domain + simple question = quick OK
  const simpleQuestionPatterns = [
    /^what is\b/i,
    /^what are\b/i,
    /^how many\b/i,
    /^list\b/i,
    /^show\b/i,
    /^get\b/i,
  ];
  
  const isShortQuery = query.length < 50;
  const isSimpleQuestion = simpleQuestionPatterns.some(p => p.test(lowerQuery));
  const wantsQuick = /\b(quick|brief|simple|just)\b/i.test(lowerQuery);
  
  if (isShortQuery && isSimpleQuestion && detectedDomains.length <= 1) {
    return true;
  }
  
  if (wantsQuick && detectedDomains.length <= 1) {
    return true;
  }
  
  // Default: Use think mode (safer for quality)
  return false;
}

// =============================================================================
// HEURISTIC CLASSIFICATION
// =============================================================================

/**
 * Quick classify using heuristics only - NO LLM call
 */
export function quickClassify(query: string): ModeClassification {
  const startTime = Date.now();
  const lowerQuery = query.toLowerCase();
  
  // Detect domains for reporting
  const detectedDomains = Object.entries(DOMAIN_INDICATORS)
    .filter(([_, pattern]) => pattern.test(lowerQuery))
    .map(([domain]) => domain);
  
  // Check research mode first (highest complexity)
  if (shouldUseResearchMode(query)) {
    const elapsed = Date.now() - startTime;
    console.log(`[CLASSIFIER] → research mode (${elapsed}ms) - domains: ${detectedDomains.join(', ')}`);
    return {
      recommendedMode: 'research',
      confidence: 0.85,
      reasoning: 'Research/investigation query detected',
      complexity: 'complex',
      estimatedDomains: detectedDomains
    };
  }
  
  // Check deep mode (comprehensive analysis)
  if (shouldUseDeepMode(query)) {
    const elapsed = Date.now() - startTime;
    console.log(`[CLASSIFIER] → deep mode (${elapsed}ms) - domains: ${detectedDomains.join(', ')}`);
    return {
      recommendedMode: 'deep',
      confidence: 0.85,
      reasoning: 'Comprehensive analysis query detected',
      complexity: 'complex',
      estimatedDomains: detectedDomains
    };
  }
  
  // Check quick mode (conservative)
  if (shouldUseQuickMode(query)) {
    const elapsed = Date.now() - startTime;
    console.log(`[CLASSIFIER] → quick mode (${elapsed}ms) - domains: ${detectedDomains.join(', ')}`);
    return {
      recommendedMode: 'quick',
      confidence: 0.8,
      reasoning: 'Simple single-domain query',
      complexity: 'simple',
      estimatedDomains: detectedDomains
    };
  }
  
  // Default: Think mode (safest for quality)
  const elapsed = Date.now() - startTime;
  console.log(`[CLASSIFIER] → think mode (${elapsed}ms) - domains: ${detectedDomains.join(', ')}`);
  return {
    recommendedMode: 'think',
    confidence: 0.75,
    reasoning: 'Standard analysis query - using balanced mode',
    complexity: 'moderate',
    estimatedDomains: detectedDomains
  };
}

// =============================================================================
// LLM CLASSIFICATION PROMPT
// =============================================================================

const MODE_CLASSIFICATION_PROMPT = `You are a query complexity classifier for a business intelligence assistant.

Analyze the query and classify the appropriate response mode:

MODES:
- "quick": Simple factual questions, single topic, brief answers
  Examples: "How many customers?", "List products", "What is our revenue?"
  
- "think": Moderate analysis, comparisons, multi-topic questions
  Examples: "Compare sales by region", "What customers have declining engagement?", "Show pipeline by stage"
  
- "deep": Complex research, comprehensive analysis, reports across multiple domains
  Examples: "Full customer health analysis", "Comprehensive sales and support trends", "Executive dashboard overview"
  
- "research": In-depth investigation, root cause analysis, market research
  Examples: "Why did churn increase?", "Research competitive landscape", "Investigate support ticket patterns"

CLASSIFICATION RULES:
1. Simple lookups, definitions → quick
2. Comparisons, filtering, single-domain analysis → think
3. Multi-domain, comprehensive, strategic → deep
4. Investigation, root cause, historical → research
5. When uncertain → think (safer default)

Respond with JSON only:
{
  "recommendedMode": "quick" | "think" | "deep" | "research",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation",
  "complexity": "simple" | "moderate" | "complex",
  "estimatedDomains": ["domain1", "domain2"]
}`;

// =============================================================================
// MAIN CLASSIFICATION FUNCTION
// =============================================================================

/**
 * Classify the optimal mode for a query
 * Uses heuristics first, falls back to LLM for edge cases
 */
export async function classifyQueryMode(
  query: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<ModeClassification> {
  try {
    // Use heuristic classification (fast and reliable)
    const heuristicResult = quickClassify(query);
    
    // If high confidence, use heuristic result
    if (heuristicResult.confidence >= 0.75) {
      console.log(`[ModeClassifier] Using heuristic: ${heuristicResult.recommendedMode} (confidence: ${heuristicResult.confidence})`);
      return heuristicResult;
    }
    
    // For lower confidence, try LLM classification
    console.log(`[ModeClassifier] Low confidence (${heuristicResult.confidence}), trying LLM classification`);
    
    // Build context from conversation history
    let contextHint = '';
    if (conversationHistory && conversationHistory.length > 0) {
      const recentTurns = conversationHistory.slice(-4);
      contextHint = `\n\nRecent conversation context:\n${recentTurns.map(m => `${m.role}: ${m.content.substring(0, 100)}...`).join('\n')}`;
    }

    // Collect streamed response
    let fullContent = '';
    for await (const chunk of streamChat('mode_classifier' as 'composer', [
      { role: 'system', content: MODE_CLASSIFICATION_PROMPT },
      { role: 'user', content: `Query: "${query}"${contextHint}` }
    ])) {
      fullContent += chunk;
    }

    // Parse response
    const result = JSON.parse(fullContent);

    // Validate and normalize mode
    const validModes: Exclude<ChatMode, 'auto'>[] = ['quick', 'think', 'deep', 'research'];
    let mode: Exclude<ChatMode, 'auto'> = 'think'; // Default to think (safest)
    
    if (result.recommendedMode === 'fast') {
      mode = 'quick'; // Normalize fast → quick
    } else if (validModes.includes(result.recommendedMode)) {
      mode = result.recommendedMode;
    }

    console.log(`[ModeClassifier] LLM classification: ${mode}`);
    
    return {
      recommendedMode: mode,
      confidence: Math.min(1, Math.max(0, result.confidence || 0.7)),
      reasoning: result.reasoning || 'LLM classification',
      complexity: result.complexity || 'moderate',
      estimatedDomains: result.estimatedDomains || heuristicResult.estimatedDomains
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ModeClassifier] Classification failed:', errorMessage);
    // Fallback to heuristic classification
    return quickClassify(query);
  }
}

/**
 * Check if auto mode is enabled (can be controlled via environment variable)
 */
export function isAutoModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DISABLE_AUTO_MODE !== 'true';
}
