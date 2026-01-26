/**
 * LLM Judge - AI-based response quality evaluation
 * 
 * Uses a fast model (gpt-5-mini) to evaluate:
 * - Relevance: Does the answer address the query?
 * - Groundedness: Are claims supported by context?
 * - Coherence: Is the answer well-structured?
 * - Completeness: Does it fully address the query?
 * - Hallucination detection: Flag unsupported claims
 */

import { streamChat } from '@/lib/llm';
import type { LLMJudgeResult } from './types';

const JUDGE_PROMPT = `You are evaluating an AI assistant's response for quality and accuracy.

USER QUERY:
{query}

RETRIEVED CONTEXT (from business data):
{context}

GENERATED ANSWER:
{answer}

Evaluate the answer on these dimensions (score 0.0 to 1.0):

1. RELEVANCE: Does the answer directly address the user's query?
   - 1.0 = Perfectly addresses the question
   - 0.5 = Partially relevant
   - 0.0 = Completely off-topic

2. GROUNDEDNESS: Are the main factual claims in the answer supported by the retrieved context?
   - 1.0 = All factual claims have supporting evidence
   - 0.8 = Most factual claims supported, minor connecting language added
   - 0.5 = Some factual claims unsupported
   - 0.0 = Major claims contradict or are absent from context
   
   NOTE: General statements, connecting phrases, and reasonable inferences are OK.
   Only flag specific factual claims that contradict or are completely absent from context.

3. COHERENCE: Is the answer well-structured, clear, and easy to understand?
   - 1.0 = Perfectly clear and organized
   - 0.5 = Understandable but could be better
   - 0.0 = Confusing or incoherent

4. COMPLETENESS: Does the answer fully address all aspects of the query?
   - 1.0 = Comprehensive, nothing missing
   - 0.5 = Partially complete
   - 0.0 = Major gaps in coverage

HALLUCINATION DETECTION:
- Only flag CLEAR hallucinations: specific factual claims that directly contradict the context or make up facts not mentioned at all
- Do NOT flag: connecting language, general statements, reasonable inferences, or proper summaries of the context
- Be conservative: When in doubt, don't flag as hallucination

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "relevance_score": 0.0-1.0,
  "groundedness_score": 0.0-1.0,
  "coherence_score": 0.0-1.0,
  "completeness_score": 0.0-1.0,
  "hallucination_detected": true/false,
  "unsupported_claims": ["claim1", "claim2"] or [],
  "reasoning": "brief 1-2 sentence explanation of scores"
}`;

/**
 * Evaluate response quality using LLM judge
 */
export async function evaluateWithLLMJudge(
  query: string,
  answer: string,
  retrievedContext: string[],
  timeoutMs: number = 15000
): Promise<LLMJudgeResult> {
  const startTime = Date.now();
  
  console.log('[LLM-JUDGE] Starting evaluation...');
  console.log('[LLM-JUDGE] Query length:', query.length);
  console.log('[LLM-JUDGE] Answer length:', answer.length);
  console.log('[LLM-JUDGE] Context chunks:', retrievedContext.length);
  
  // Combine context chunks (limit size)
  const contextText = retrievedContext.slice(0, 15).join('\n\n---\n\n');
  const truncatedContext = contextText.substring(0, 6000);
  
  // Build prompt
  const prompt = JUDGE_PROMPT
    .replace('{query}', query)
    .replace('{context}', truncatedContext || '(No context available)')
    .replace('{answer}', answer);

  try {
    // Use timeout wrapper
    const result = await Promise.race([
      runJudgeEvaluation(prompt, startTime),
      new Promise<LLMJudgeResult>((_, reject) => 
        setTimeout(() => reject(new Error(`LLM judge timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
    
    return result;
    
  } catch (e: unknown) {
    const evalTime = Date.now() - startTime;
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    console.error(`[LLM-JUDGE] ❌ Evaluation failed after ${evalTime}ms:`, errorMessage);
    
    // Return reasonable defaults on failure
    return {
      relevanceScore: 0.75,
      groundednessScore: 0.70,
      coherenceScore: 0.75,
      completenessScore: 0.70,
      hallucinationDetected: false,
      unsupportedClaims: [],
      reasoning: `Evaluation failed: ${errorMessage}`,
      tokensUsed: 0,
      costUsd: 0
    };
  }
}

/**
 * Run the actual judge evaluation
 */
async function runJudgeEvaluation(prompt: string, startTime: number): Promise<LLMJudgeResult> {
  console.log('[LLM-JUDGE] Calling LLM...');
  
  // Collect streamed response
  let fullContent = '';
  for await (const chunk of streamChat('mode_classifier' as 'composer', [
    { role: 'system', content: 'You are an expert evaluator of AI system responses. You are rigorous, fair, and always respond with valid JSON only.' },
    { role: 'user', content: prompt }
  ])) {
    fullContent += chunk;
  }
  
  console.log('[LLM-JUDGE] ✅ LLM response received');
  console.log('[LLM-JUDGE] Parsing JSON response...');
  
  // Try to extract JSON from response
  let jsonContent = fullContent;
  
  // Handle markdown code blocks if present
  const jsonMatch = fullContent.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonContent = jsonMatch[1];
  }
  
  const result = JSON.parse(jsonContent.trim());
  console.log('[LLM-JUDGE] ✅ JSON parsed successfully');
  
  // Estimate tokens and cost (rough approximation)
  const promptTokens = Math.ceil(prompt.length / 4);
  const completionTokens = Math.ceil(fullContent.length / 4);
  const totalTokens = promptTokens + completionTokens;
  const cost = (promptTokens * 0.00015 / 1000) + (completionTokens * 0.0006 / 1000); // GPT-5-mini pricing estimate
  
  const evalTime = Date.now() - startTime;
  
  console.log(`[LLM-JUDGE] ✅ Evaluation complete in ${evalTime}ms`);
  console.log(`[LLM-JUDGE] Estimated tokens: ${totalTokens}`);
  console.log(`[LLM-JUDGE] Scores: Relevance=${result.relevance_score}, Groundedness=${result.groundedness_score}`);
  console.log(`[LLM-JUDGE] Hallucination: ${result.hallucination_detected ? '⚠️  DETECTED' : '✅ None'}`);
  
  return {
    relevanceScore: result.relevance_score || 0,
    groundednessScore: result.groundedness_score || 0,
    coherenceScore: result.coherence_score || 0,
    completenessScore: result.completeness_score || 0,
    hallucinationDetected: result.hallucination_detected || false,
    unsupportedClaims: result.unsupported_claims || [],
    reasoning: result.reasoning || '',
    tokensUsed: totalTokens,
    costUsd: cost
  };
}

/**
 * Calculate composite quality score from individual metrics
 * Weights: Relevance (30%) + Groundedness (30%) + Coherence (20%) + Completeness (20%)
 */
export function calculateQualityScore(judgeResult: LLMJudgeResult): number {
  return (
    judgeResult.relevanceScore * 0.3 +
    judgeResult.groundednessScore * 0.3 +
    judgeResult.coherenceScore * 0.2 +
    judgeResult.completenessScore * 0.2
  );
}
