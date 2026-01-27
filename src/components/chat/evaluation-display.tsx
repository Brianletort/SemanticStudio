"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  CheckCircle, 
  AlertTriangle, 
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
} from "lucide-react";

interface EvaluationData {
  relevanceScore: number;
  groundednessScore: number;
  coherenceScore: number;
  completenessScore: number;
  qualityScore: number;
  hallucinationDetected: boolean;
  judgeReasoning: string;
  evaluationCostUsd: number;
  evaluationLatencyMs: number;
}

interface EvaluationDisplayProps {
  turnId?: string;
  messageContent: string;
  className?: string;
  mode?: 'quick' | 'think' | 'deep' | 'research';
}

export function EvaluationDisplay({ 
  turnId, 
  messageContent,
  className = "",
  mode = 'think'
}: EvaluationDisplayProps) {
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const pollingRef = useRef<boolean>(false);
  const maxAttemptsRef = useRef<number>(0);

  useEffect(() => {
    if (!turnId || pollingRef.current) return;

    // Check if we already have an evaluation
    if (evaluation) {
      return;
    }
    
    pollingRef.current = true;
    setLoading(true);
    setError(null);
    setAttempts(0);

    let pollAttempts = 0;
    
    // Mode-aware polling configuration
    const pollingConfig = {
      quick: { maxAttempts: 10, pollInterval: 1500, initialDelay: 500 },
      think: { maxAttempts: 20, pollInterval: 2000, initialDelay: 1000 },
      deep: { maxAttempts: 40, pollInterval: 2500, initialDelay: 2000 },
      research: { maxAttempts: 60, pollInterval: 3000, initialDelay: 3000 },
    };
    
    const config = pollingConfig[mode] || pollingConfig.think;
    const { maxAttempts, pollInterval, initialDelay } = config;
    maxAttemptsRef.current = maxAttempts;

    const pollForEvaluation = async () => {
      if (!pollingRef.current) return;
      
      pollAttempts++;
      setAttempts(pollAttempts);

      try {
        const response = await fetch(`/api/evaluations/${turnId}`);
        
        if (response.ok) {
          const data = await response.json();
          pollingRef.current = false;
          setEvaluation(data);
          setLoading(false);
          return;
        }
        
        // Check if still pending (404)
        if (response.status === 404) {
          const data = await response.json();
          if (data.pending && pollAttempts < maxAttempts) {
            setTimeout(pollForEvaluation, pollInterval);
            return;
          }
        }
        
        // Max attempts reached or other error
        if (pollAttempts >= maxAttempts) {
          pollingRef.current = false;
          setLoading(false);
          // Don't show error - evaluation might just not be available
        } else {
          setTimeout(pollForEvaluation, pollInterval);
        }
      } catch (e) {
        console.error('[EvaluationDisplay] Polling error:', e);
        if (pollAttempts < maxAttempts) {
          setTimeout(pollForEvaluation, pollInterval);
        } else {
          pollingRef.current = false;
          setLoading(false);
          setError('Failed to load evaluation');
        }
      }
    };

    // Start polling after initial delay
    const timeoutId = setTimeout(pollForEvaluation, initialDelay);

    return () => {
      pollingRef.current = false;
      clearTimeout(timeoutId);
    };
  }, [turnId, mode, evaluation]);

  if (!turnId) {
    return null;
  }

  // Note: Previously skipped evaluation for quick mode, but user wants evaluation for ALL modes
  // Evaluation will still run with appropriate polling config for each mode
  
  const getQualityColor = (score: number) => {
    if (score >= 0.8) return "text-green-600 dark:text-green-400";
    if (score >= 0.6) return "text-yellow-600 dark:text-yellow-400";
    if (score >= 0.4) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const getQualityBgColor = (score: number) => {
    if (score >= 0.8) return "bg-green-100 dark:bg-green-900/30";
    if (score >= 0.6) return "bg-yellow-100 dark:bg-yellow-900/30";
    if (score >= 0.4) return "bg-orange-100 dark:bg-orange-900/30";
    return "bg-red-100 dark:bg-red-900/30";
  };

  const getQualityLabel = (score: number) => {
    if (score >= 0.8) return "Excellent";
    if (score >= 0.6) return "Good";
    if (score >= 0.4) return "Fair";
    return "Poor";
  };

  const getProgressColor = (score: number) => {
    if (score >= 0.8) return "bg-green-500";
    if (score >= 0.6) return "bg-yellow-500";
    if (score >= 0.4) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <Card className={`mt-3 bg-muted/30 border-muted/50 ${className}`}>
      <div className="p-3">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Evaluating response quality... ({attempts}/{maxAttemptsRef.current})</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {evaluation && (
          <div className="space-y-3">
            {/* Summary Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Quality</span>
                </div>
                <Badge 
                  variant="secondary" 
                  className={`${getQualityColor(evaluation.qualityScore)} ${getQualityBgColor(evaluation.qualityScore)} font-medium`}
                >
                  {getQualityLabel(evaluation.qualityScore)} ({Math.round(evaluation.qualityScore * 100)}%)
                </Badge>
                {!evaluation.hallucinationDetected && (
                  <Badge variant="secondary" className="text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Grounded
                  </Badge>
                )}
                {evaluation.hallucinationDetected && (
                  <Badge variant="secondary" className="text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Check sources
                  </Badge>
                )}
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="h-7 text-xs gap-1"
              >
                {expanded ? (
                  <>
                    Less <ChevronUp className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    Details <ChevronDown className="w-3 h-3" />
                  </>
                )}
              </Button>
            </div>

            {/* Detailed Metrics */}
            {expanded && (
              <div className="space-y-3 pt-2 border-t border-muted/30">
                <div className="grid grid-cols-2 gap-3">
                  <MetricBar 
                    label="Relevance" 
                    score={evaluation.relevanceScore} 
                    color={getProgressColor(evaluation.relevanceScore)}
                  />
                  <MetricBar 
                    label="Groundedness" 
                    score={evaluation.groundednessScore} 
                    color={getProgressColor(evaluation.groundednessScore)}
                  />
                  <MetricBar 
                    label="Coherence" 
                    score={evaluation.coherenceScore} 
                    color={getProgressColor(evaluation.coherenceScore)}
                  />
                  <MetricBar 
                    label="Completeness" 
                    score={evaluation.completenessScore} 
                    color={getProgressColor(evaluation.completenessScore)}
                  />
                </div>

                {/* Judge Reasoning */}
                {evaluation.judgeReasoning && (
                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground mb-1">AI Assessment</div>
                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded leading-relaxed">
                      {evaluation.judgeReasoning}
                    </div>
                  </div>
                )}

                {/* Performance Metrics */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {evaluation.evaluationLatencyMs}ms
                  </div>
                  {evaluation.evaluationCostUsd > 0 && (
                    <div className="flex items-center gap-1">
                      ${evaluation.evaluationCostUsd.toFixed(4)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// Helper component for metric bars
function MetricBar({ 
  label, 
  score, 
  color 
}: { 
  label: string; 
  score: number; 
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-muted rounded-full h-1.5">
          <div 
            className={`${color} h-1.5 rounded-full transition-all duration-500`}
            style={{ width: `${score * 100}%` }}
          />
        </div>
        <span className="text-xs font-medium w-8 text-right">
          {Math.round(score * 100)}%
        </span>
      </div>
    </div>
  );
}
