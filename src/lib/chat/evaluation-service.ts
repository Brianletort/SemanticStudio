/**
 * Evaluation Service - Coordinates response evaluation and storage
 * 
 * Combines deterministic metrics with LLM judge evaluation
 * and saves results to the database.
 */

import { db } from '@/lib/db';
import { chatEvaluations } from '@/lib/db/schema';
import { calculateDeterministicMetrics } from './deterministic-eval';
import { evaluateWithLLMJudge, calculateQualityScore } from './llm-judge';
import type { EvaluationResult } from './types';

interface RetrievedChunk {
  text?: string;
  content?: string;
  similarity?: number;
  score?: number;
  sourceId?: string;
  source?: string;
  table?: string;
}

/**
 * Evaluate a chat response and save to database
 * 
 * This runs asynchronously after the response is complete
 * to avoid blocking the streaming response.
 */
export async function evaluateAndSaveResponse(params: {
  turnId: string;
  sessionId: string;
  query: string;
  answer: string;
  retrievedChunks: RetrievedChunk[];
  mode: string;
}): Promise<EvaluationResult | null> {
  const { turnId, sessionId, query, answer, retrievedChunks, mode } = params;
  
  console.log(`[EVAL] Starting evaluation for turn ${turnId.substring(0, 8)}...`);
  const evalStartTime = Date.now();
  
  try {
    // Calculate deterministic metrics first (fast)
    const deterministicMetrics = calculateDeterministicMetrics(answer, retrievedChunks);
    console.log('[EVAL] Deterministic metrics calculated in', Date.now() - evalStartTime, 'ms');
    
    // Prepare context for LLM judge
    const contextTexts = retrievedChunks
      .map(c => c.text || c.content || '')
      .filter(Boolean);
    
    // Skip LLM judge for quick mode to save cost
    let llmJudgeResult;
    if (mode === 'quick') {
      console.log('[EVAL] Skipping LLM judge for quick mode');
      llmJudgeResult = {
        relevanceScore: 0.75,
        groundednessScore: 0.70,
        coherenceScore: 0.75,
        completenessScore: 0.70,
        hallucinationDetected: false,
        unsupportedClaims: [],
        reasoning: 'LLM judge skipped for quick mode',
        tokensUsed: 0,
        costUsd: 0
      };
    } else {
      // Run LLM judge with timeout protection
      const llmStartTime = Date.now();
      console.log('[EVAL] Starting LLM judge evaluation...');
      
      // Adjust timeout based on mode
      const timeout = mode === 'deep' || mode === 'research' ? 20000 : 15000;
      llmJudgeResult = await evaluateWithLLMJudge(query, answer, contextTexts, timeout);
      
      console.log('[EVAL] ✅ LLM judge completed in', Date.now() - llmStartTime, 'ms');
    }
    
    // Calculate composite quality score
    const qualityScore = calculateQualityScore(llmJudgeResult);
    
    const totalEvalTime = Date.now() - evalStartTime;
    console.log('[EVAL] Total evaluation time:', totalEvalTime, 'ms');
    console.log('[EVAL] Quality score:', qualityScore.toFixed(2));
    
    // Combine results
    const evaluationResult: EvaluationResult = {
      ...deterministicMetrics,
      ...llmJudgeResult,
      qualityScore
    };
    
    // Save to database
    await db.insert(chatEvaluations).values({
      turnId,
      sessionId,
      qualityScore,
      relevanceScore: llmJudgeResult.relevanceScore,
      groundednessScore: llmJudgeResult.groundednessScore,
      coherenceScore: llmJudgeResult.coherenceScore,
      completenessScore: llmJudgeResult.completenessScore,
      hallucinationDetected: llmJudgeResult.hallucinationDetected,
      judgeReasoning: llmJudgeResult.reasoning,
      citationCoverage: deterministicMetrics.citationCoverage,
      contextUtilization: deterministicMetrics.contextUtilization,
      evaluationLatencyMs: totalEvalTime,
      evaluationCostUsd: llmJudgeResult.costUsd,
    });
    
    console.log(`[EVAL] ✅ Evaluation saved for turn ${turnId.substring(0, 8)}`);
    
    return evaluationResult;
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[EVAL] ❌ Evaluation failed for turn ${turnId.substring(0, 8)}:`, errorMessage);
    return null;
  }
}

/**
 * Get evaluation for a turn from the database
 */
export async function getEvaluationByTurnId(turnId: string) {
  const { eq } = await import('drizzle-orm');
  
  const result = await db
    .select()
    .from(chatEvaluations)
    .where(eq(chatEvaluations.turnId, turnId))
    .limit(1);
  
  return result[0] || null;
}
