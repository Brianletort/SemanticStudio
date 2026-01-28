/**
 * ResearchFollowUpAgent - Detects follow-up messages in research mode and rewrites queries
 * 
 * Pattern:
 * 1. Detect if message is a follow-up to existing research (vs new topic)
 * 2. Extract the original research question from conversation history
 * 3. Rewrite query to combine original question + follow-up direction
 * 4. Enhanced query is used for web search and domain agent retrieval
 * 
 * This enables ChatGPT-like research behavior where follow-ups extend the original research.
 */

import { chat } from '@/lib/llm';

// Follow-up analysis result
export interface FollowUpAnalysis {
  isFollowUp: boolean;
  originalQuery: string;
  followUpIntent: string;  // What the user wants to know more about
  enhancedQuery: string;   // Rewritten query combining original + follow-up
  confidence: number;      // How confident we are this is a follow-up (0-1)
}

// Conversation message type
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Patterns that typically indicate a follow-up message
const FOLLOWUP_PATTERNS = [
  /^(tell me more|more about|expand on|elaborate|go deeper)/i,
  /^(what about|how about|and what)/i,
  /^(can you also|also include|additionally)/i,
  /^(focus on|specifically|in particular)/i,
  /^(break (this |it )?down|drill (down|into))/i,
  /^(show me|give me) (more|details|specifics)/i,
  /^(yes|sure|okay|please|go ahead)/i,
  /\b(more details?|more info(rmation)?|more on)\b/i,
  /\b(that part|this aspect|that section)\b/i,
];

// Patterns that indicate a NEW topic (not a follow-up)
const NEW_TOPIC_PATTERNS = [
  /^(new question|different topic|unrelated|separate(ly)?)/i,
  /^(actually|instead|forget that|never mind)/i,
  /^(switch(ing)? to|moving on|let's talk about something else)/i,
];

export class ResearchFollowUpAgent {
  /**
   * Analyze if the current message is a follow-up to existing research
   */
  async analyzeFollowUp(
    currentMessage: string,
    conversationHistory: ConversationMessage[]
  ): Promise<FollowUpAnalysis> {
    // If no history, can't be a follow-up
    if (!conversationHistory || conversationHistory.length === 0) {
      return {
        isFollowUp: false,
        originalQuery: '',
        followUpIntent: '',
        enhancedQuery: currentMessage,
        confidence: 1.0,
      };
    }

    // Find the original user question (first user message in history)
    const userMessages = conversationHistory.filter(m => m.role === 'user');
    if (userMessages.length === 0) {
      return {
        isFollowUp: false,
        originalQuery: '',
        followUpIntent: '',
        enhancedQuery: currentMessage,
        confidence: 1.0,
      };
    }

    const originalQuery = userMessages[0].content;

    // Quick pattern-based detection
    const isLikelyFollowUp = this.detectFollowUpPattern(currentMessage);
    const isLikelyNewTopic = this.detectNewTopicPattern(currentMessage);

    // If clearly a new topic, don't treat as follow-up
    if (isLikelyNewTopic) {
      return {
        isFollowUp: false,
        originalQuery: '',
        followUpIntent: '',
        enhancedQuery: currentMessage,
        confidence: 0.9,
      };
    }

    // If short message or pattern match, likely a follow-up
    const isShortMessage = currentMessage.split(/\s+/).length < 10;
    
    if (isLikelyFollowUp || isShortMessage) {
      // Use LLM to properly rewrite the query
      return this.rewriteWithLLM(originalQuery, currentMessage, conversationHistory);
    }

    // For longer messages, use LLM to determine if follow-up and rewrite
    return this.analyzeWithLLM(originalQuery, currentMessage, conversationHistory);
  }

  /**
   * Quick pattern-based follow-up detection
   */
  private detectFollowUpPattern(message: string): boolean {
    return FOLLOWUP_PATTERNS.some(pattern => pattern.test(message));
  }

  /**
   * Quick pattern-based new topic detection
   */
  private detectNewTopicPattern(message: string): boolean {
    return NEW_TOPIC_PATTERNS.some(pattern => pattern.test(message));
  }

  /**
   * Use LLM to analyze if message is a follow-up and determine intent
   */
  private async analyzeWithLLM(
    originalQuery: string,
    currentMessage: string,
    conversationHistory: ConversationMessage[]
  ): Promise<FollowUpAnalysis> {
    const recentContext = conversationHistory.slice(-4).map(m => 
      `${m.role.toUpperCase()}: ${m.content.substring(0, 500)}${m.content.length > 500 ? '...' : ''}`
    ).join('\n\n');

    const prompt = `Analyze if this message is a follow-up to the original research question or a completely new topic.

ORIGINAL RESEARCH QUESTION:
"${originalQuery}"

RECENT CONVERSATION:
${recentContext}

CURRENT MESSAGE:
"${currentMessage}"

Determine:
1. Is this a FOLLOW-UP to the original research (wanting more details, clarification, or specific aspects)?
2. Or is this a NEW TOPIC unrelated to the original question?

If it's a follow-up, create an ENHANCED QUERY that combines the original question with the follow-up direction.

Return JSON ONLY:
{
  "isFollowUp": true/false,
  "followUpIntent": "What the user wants to know more about (if follow-up)",
  "enhancedQuery": "Combined query for research (if follow-up, otherwise just the current message)",
  "confidence": 0.0-1.0
}`;

    try {
      const response = await chat('planner', [
        { role: 'system', content: 'You analyze conversation context to determine follow-up intent. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ]);

      const parsed = JSON.parse(response.content);
      
      return {
        isFollowUp: parsed.isFollowUp ?? false,
        originalQuery: parsed.isFollowUp ? originalQuery : '',
        followUpIntent: parsed.followUpIntent ?? '',
        enhancedQuery: parsed.enhancedQuery ?? currentMessage,
        confidence: parsed.confidence ?? 0.7,
      };
    } catch (error) {
      console.error('[ResearchFollowUp] LLM analysis failed:', error);
      
      // Fallback: treat as follow-up if short message
      const isShort = currentMessage.split(/\s+/).length < 8;
      return {
        isFollowUp: isShort,
        originalQuery: isShort ? originalQuery : '',
        followUpIntent: isShort ? currentMessage : '',
        enhancedQuery: isShort ? `${originalQuery}, with specific focus on: ${currentMessage}` : currentMessage,
        confidence: 0.5,
      };
    }
  }

  /**
   * Use LLM to rewrite query when we know it's a follow-up
   */
  private async rewriteWithLLM(
    originalQuery: string,
    followUpMessage: string,
    conversationHistory: ConversationMessage[]
  ): Promise<FollowUpAnalysis> {
    // Get any assistant response context (what was already covered)
    const lastAssistantMessage = conversationHistory
      .filter(m => m.role === 'assistant')
      .pop();
    
    const contextSnippet = lastAssistantMessage 
      ? lastAssistantMessage.content.substring(0, 800) 
      : '';

    const prompt = `Rewrite a research query to combine the original question with a follow-up request.

ORIGINAL RESEARCH QUESTION:
"${originalQuery}"

${contextSnippet ? `PREVIOUS RESPONSE COVERED:\n${contextSnippet}...\n` : ''}

FOLLOW-UP REQUEST:
"${followUpMessage}"

Create an ENHANCED QUERY that:
1. Preserves the context of the original question
2. Adds the specific direction from the follow-up
3. Is suitable for web search and database retrieval
4. Is clear and comprehensive

Return JSON ONLY:
{
  "followUpIntent": "Brief description of what user wants to know more about",
  "enhancedQuery": "The rewritten comprehensive query"
}`;

    try {
      const response = await chat('planner', [
        { role: 'system', content: 'You rewrite research queries to incorporate follow-up requests. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ]);

      const parsed = JSON.parse(response.content);
      
      return {
        isFollowUp: true,
        originalQuery,
        followUpIntent: parsed.followUpIntent ?? followUpMessage,
        enhancedQuery: parsed.enhancedQuery ?? `${originalQuery}, with specific focus on: ${followUpMessage}`,
        confidence: 0.85,
      };
    } catch (error) {
      console.error('[ResearchFollowUp] LLM rewrite failed:', error);
      
      // Fallback: simple concatenation
      return {
        isFollowUp: true,
        originalQuery,
        followUpIntent: followUpMessage,
        enhancedQuery: `${originalQuery}, with specific focus on: ${followUpMessage}`,
        confidence: 0.6,
      };
    }
  }

  /**
   * Simple query rewrite without full analysis (for direct use)
   */
  async rewriteQuery(
    originalQuery: string,
    followUpMessage: string
  ): Promise<string> {
    const result = await this.rewriteWithLLM(originalQuery, followUpMessage, []);
    return result.enhancedQuery;
  }
}

/**
 * Create a new research follow-up agent instance
 */
export function createResearchFollowUpAgent(): ResearchFollowUpAgent {
  return new ResearchFollowUpAgent();
}
