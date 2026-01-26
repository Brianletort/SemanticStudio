"use client";

import React, { useState } from "react";
import {
  Brain,
  Network,
  Globe,
  FileText,
  MessageSquare,
  BarChart,
  Sparkles,
  HelpCircle,
  CheckCircle,
  XCircle,
  ArrowRight,
  Settings,
  Zap,
  Clock,
  Database,
  Search,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Pipeline step definition
interface PipelineStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  type: 'required' | 'conditional' | 'optional';
  enabled: boolean;
  description: string;
  configKey?: string;
}

// Detailed step information for the popup
interface StepDetails {
  title: string;
  overview: string;
  whatItDoes: string[];
  whenItRuns: string;
  settings: { label: string; value: string }[];
  tips: string[];
}

interface ModePipelineFlowProps {
  mode: 'quick' | 'think' | 'deep' | 'research';
  config: {
    maxResults: number;
    graphHops: number;
    webResultsIfEnabled: number;
    memoryTiers: string[];
    enableReflection: boolean;
    enableClarification: boolean;
    showEvaluationByDefault: boolean;
    composerRole: string;
  };
  webEnabled?: boolean;
  onStepClick?: (stepId: string) => void;
}

/**
 * Get detailed information for each step
 */
function getStepDetails(
  stepId: string,
  config: ModePipelineFlowProps['config'],
  mode: string,
  webEnabled: boolean
): StepDetails {
  const details: Record<string, StepDetails> = {
    clarification: {
      title: 'Clarification Agent',
      overview: 'Analyzes the user query to determine if clarifying questions are needed before conducting research.',
      whatItDoes: [
        'Detects ambiguous or broad queries that need refinement',
        'Generates targeted follow-up questions',
        'Gathers additional context to improve research quality',
        'Ensures the research addresses the user\'s actual intent',
      ],
      whenItRuns: config.enableClarification 
        ? 'Runs before research when query is ambiguous'
        : 'Currently disabled - enable in Pipeline Settings',
      settings: [
        { label: 'Status', value: config.enableClarification ? 'Enabled' : 'Disabled' },
        { label: 'Mode', value: 'Research only' },
      ],
      tips: [
        'Enable for complex research topics',
        'Helps avoid wasted computation on misunderstood queries',
        'Questions are presented inline in the chat',
      ],
    },
    memory: {
      title: 'Memory Retrieval',
      overview: 'Retrieves relevant context from the 3-tier memory system to personalize and contextualize responses.',
      whatItDoes: [
        'Tier 1 (Working Context): Recent conversation turns for immediate context',
        'Tier 2 (Session Memory): Facts extracted from the current session',
        'Tier 3 (Long-Term Memory): User profile facts persisted across sessions',
        'Provides relevant memories to the composer for context-aware responses',
      ],
      whenItRuns: 'Always runs - retrieves from enabled memory tiers',
      settings: [
        { label: 'Active Tiers', value: config.memoryTiers.join(', ').toUpperCase() },
        { label: 'Tier Count', value: `${config.memoryTiers.length} of 3 tiers` },
      ],
      tips: [
        'Tier 1 is always enabled for conversation continuity',
        'Session memory is great for multi-turn task contexts',
        'Long-term memory enables "miniGPT" patterns across sessions',
      ],
    },
    graphrag: {
      title: 'GraphRAG Retrieval',
      overview: 'Uses knowledge graph traversal to find relevant domain data and expand queries with related entities.',
      whatItDoes: [
        'Identifies entities in the user query (people, companies, topics)',
        'Traverses knowledge graph relationships to find related data',
        'Selects which domain agents to query based on entity matches',
        'Expands queries to include related context from connected nodes',
      ],
      whenItRuns: 'Always runs - depth controlled by graph hops setting',
      settings: [
        { label: 'Graph Hops', value: config.graphHops === 0 ? 'Entity match only' : `${config.graphHops}-hop expansion` },
        { label: 'Max Results', value: `${config.maxResults} chunks/rows` },
      ],
      tips: [
        '0 hops = fast entity matching without graph traversal',
        '1-2 hops = good balance of relevance and coverage',
        '3 hops = comprehensive but may include tangential results',
      ],
    },
    web: {
      title: 'Web Search',
      overview: 'Fetches real-time information from the web using Brave Search API to supplement internal knowledge.',
      whatItDoes: [
        'Searches the web for current information on the topic',
        'Retrieves and summarizes relevant web pages',
        'Provides citations and source URLs',
        'Supplements internal data with external sources',
      ],
      whenItRuns: webEnabled 
        ? 'Runs when web toggle is enabled by user'
        : 'Currently disabled - user must enable web toggle in chat',
      settings: [
        { label: 'Status', value: webEnabled ? 'Enabled' : 'Disabled (toggle off)' },
        { label: 'Max Results', value: `${config.webResultsIfEnabled} web results` },
      ],
      tips: [
        'Great for current events and recent information',
        'Adds external validation to internal data',
        'Results are shown with citations in the response',
      ],
    },
    compose: {
      title: mode === 'research' ? 'Deep Research Composer' : 'Response Composer',
      overview: mode === 'research'
        ? 'Uses o3-deep-research model to generate comprehensive, well-researched responses with extensive analysis.'
        : 'Generates the final response by synthesizing all retrieved context with the LLM.',
      whatItDoes: mode === 'research' ? [
        'Analyzes all retrieved context comprehensively',
        'Generates detailed, structured research reports',
        'Includes citations and source references',
        'Produces multi-section responses with clear organization',
      ] : [
        'Combines memory, domain data, and web results',
        'Generates a coherent, contextual response',
        'Applies appropriate tone and formatting',
        'Follows system instructions and user preferences',
      ],
      whenItRuns: 'Always runs - this is the core response generation step',
      settings: [
        { label: 'Model Role', value: config.composerRole },
        { label: 'Model', value: config.composerRole === 'research' ? 'o3-deep-research' : config.composerRole === 'composer_fast' ? 'gpt-5-mini' : 'gpt-5.2' },
      ],
      tips: mode === 'research' ? [
        'o3-deep-research excels at long-form analysis',
        'Best for complex topics requiring synthesis',
        'May take longer but produces comprehensive results',
      ] : [
        'composer_fast is optimized for quick responses',
        'composer provides balanced quality and speed',
        'Model selection affects response depth and latency',
      ],
    },
    reflection: {
      title: 'Reflection Agent',
      overview: 'Reviews the generated response for quality, accuracy, and completeness before delivery.',
      whatItDoes: [
        'Checks response against retrieved sources for accuracy',
        'Evaluates completeness of the answer',
        'Identifies potential improvements or gaps',
        'May trigger regeneration for low-quality responses',
      ],
      whenItRuns: config.enableReflection
        ? 'Runs after composition to review quality'
        : 'Currently disabled - enable in Pipeline Settings',
      settings: [
        { label: 'Status', value: config.enableReflection ? 'Enabled' : 'Disabled' },
        { label: 'Mode', value: 'Think, Deep, Research modes' },
      ],
      tips: [
        'Improves response accuracy and groundedness',
        'Adds latency but improves quality',
        'Skip for quick mode to prioritize speed',
      ],
    },
    judge: {
      title: 'Judge Evaluation',
      overview: 'Evaluates the final response quality using multiple criteria and generates a quality score.',
      whatItDoes: [
        'Scores relevance to the original query',
        'Evaluates groundedness in retrieved sources',
        'Assesses coherence and readability',
        'Measures completeness of the response',
      ],
      whenItRuns: 'Always runs for all modes - display is optional',
      settings: [
        { label: 'Always Runs', value: 'Yes' },
        { label: 'Show in UI', value: config.showEvaluationByDefault ? 'Yes' : 'Hidden' },
      ],
      tips: [
        'Evaluation runs even when hidden in UI',
        'Scores are logged for quality monitoring',
        'Enable display to see quality metrics per response',
      ],
    },
  };

  return details[stepId] || {
    title: 'Pipeline Step',
    overview: 'Part of the response generation pipeline.',
    whatItDoes: ['Processes the request'],
    whenItRuns: 'During pipeline execution',
    settings: [],
    tips: [],
  };
}

/**
 * Get pipeline steps for a specific mode
 */
function getPipelineSteps(
  mode: 'quick' | 'think' | 'deep' | 'research',
  config: ModePipelineFlowProps['config'],
  webEnabled: boolean
): PipelineStep[] {
  const steps: PipelineStep[] = [];

  // Clarification (research mode only)
  if (mode === 'research') {
    steps.push({
      id: 'clarification',
      label: 'Clarify',
      icon: <HelpCircle className="w-4 h-4" />,
      type: 'conditional',
      enabled: config.enableClarification,
      description: 'Ask clarifying questions before research',
      configKey: 'enableClarification',
    });
  }

  // Memory retrieval
  const memoryLabel = config.memoryTiers.length === 1 
    ? 'Memory T1'
    : config.memoryTiers.length === 2
    ? 'Memory T1+T2'
    : 'Memory All';
  
  steps.push({
    id: 'memory',
    label: memoryLabel,
    icon: <Brain className="w-4 h-4" />,
    type: 'required',
    enabled: true,
    description: `Using ${config.memoryTiers.length} memory tier(s)`,
    configKey: 'memoryTiers',
  });

  // GraphRAG retrieval
  const graphLabel = config.graphHops === 0 
    ? 'Entity Match'
    : `GraphRAG ${config.graphHops}-hop`;
  
  steps.push({
    id: 'graphrag',
    label: graphLabel,
    icon: <Network className="w-4 h-4" />,
    type: 'required',
    enabled: true,
    description: `Max ${config.maxResults} results, ${config.graphHops} graph hops`,
    configKey: 'graphHops',
  });

  // Web search (conditional on toggle)
  steps.push({
    id: 'web',
    label: 'Web Search',
    icon: <Globe className="w-4 h-4" />,
    type: 'conditional',
    enabled: webEnabled,
    description: webEnabled 
      ? `Up to ${config.webResultsIfEnabled} web results`
      : 'Enable web toggle to use',
    configKey: 'webResultsIfEnabled',
  });

  // Compose
  const composeLabel = mode === 'quick' 
    ? 'Compose Fast' 
    : mode === 'research' 
    ? 'Deep Research' 
    : 'Compose';
  
  steps.push({
    id: 'compose',
    label: composeLabel,
    icon: <FileText className="w-4 h-4" />,
    type: 'required',
    enabled: true,
    description: config.composerRole === 'research' 
      ? 'Using o3-deep-research for comprehensive analysis'
      : `Using ${config.composerRole} model`,
    configKey: 'composerRole',
  });

  // Reflection (think, deep, research)
  if (mode !== 'quick') {
    steps.push({
      id: 'reflection',
      label: 'Reflect',
      icon: <MessageSquare className="w-4 h-4" />,
      type: 'conditional',
      enabled: config.enableReflection,
      description: config.enableReflection 
        ? 'Review and improve response'
        : 'Reflection disabled',
      configKey: 'enableReflection',
    });
  }

  // Judge evaluation (always runs)
  steps.push({
    id: 'judge',
    label: 'Judge',
    icon: <BarChart className="w-4 h-4" />,
    type: 'required',
    enabled: true,
    description: config.showEvaluationByDefault 
      ? 'Evaluate and display quality'
      : 'Evaluate (hidden in UI)',
    configKey: 'showEvaluationByDefault',
  });

  return steps;
}

/**
 * Step detail dialog component
 */
function StepDetailDialog({
  step,
  details,
  open,
  onOpenChange,
}: {
  step: PipelineStep | null;
  details: StepDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!step || !details) return null;

  const isDisabled = step.type === 'conditional' && !step.enabled;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full",
              isDisabled
                ? "bg-muted text-muted-foreground"
                : step.type === 'conditional'
                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                : "bg-primary/10 text-primary"
            )}>
              {step.icon}
            </div>
            <div>
              <DialogTitle className="flex items-center gap-2">
                {details.title}
                <Badge variant={isDisabled ? "secondary" : step.type === 'conditional' ? "outline" : "default"}>
                  {isDisabled ? 'Disabled' : step.type === 'conditional' ? 'Conditional' : 'Required'}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-left">
                {details.overview}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* What it does */}
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-primary" />
              What it does
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {details.whatItDoes.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          {/* When it runs */}
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-primary" />
              When it runs
            </h4>
            <p className="text-sm text-muted-foreground">{details.whenItRuns}</p>
          </div>

          <Separator />

          {/* Current settings */}
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
              <Settings className="w-4 h-4 text-primary" />
              Current Settings
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {details.settings.map((setting, i) => (
                <div key={i} className="text-sm">
                  <span className="text-muted-foreground">{setting.label}:</span>{' '}
                  <span className="font-medium">{setting.value}</span>
                </div>
              ))}
            </div>
          </div>

          {details.tips.length > 0 && (
            <>
              <Separator />
              {/* Tips */}
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  Tips
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {details.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-500 mt-1">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Pipeline step node component
 */
function PipelineNode({
  step,
  isLast,
  onClick,
}: {
  step: PipelineStep;
  isLast: boolean;
  onClick?: () => void;
}) {
  const isDisabled = step.type === 'conditional' && !step.enabled;

  return (
    <div className="flex items-center">
      {/* Node */}
      <button
        onClick={onClick}
        className={cn(
          "group relative flex flex-col items-center p-3 rounded-lg border-2 transition-all",
          "hover:scale-105 hover:shadow-md cursor-pointer min-w-[90px]",
          isDisabled
            ? "border-dashed border-muted-foreground/30 bg-muted/30 text-muted-foreground"
            : step.type === 'conditional'
            ? "border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400"
            : "border-primary/50 bg-primary/5 text-primary"
        )}
      >
        {/* Icon */}
        <div className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full mb-1",
          isDisabled
            ? "bg-muted"
            : step.type === 'conditional'
            ? "bg-amber-100 dark:bg-amber-900/30"
            : "bg-primary/10"
        )}>
          {step.icon}
        </div>
        
        {/* Label */}
        <span className="text-xs font-medium text-center leading-tight">
          {step.label}
        </span>
        
        {/* Status indicator */}
        <div className={cn(
          "absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center",
          isDisabled
            ? "bg-muted-foreground/20"
            : "bg-green-500"
        )}>
          {isDisabled ? (
            <XCircle className="w-3 h-3 text-muted-foreground" />
          ) : (
            <CheckCircle className="w-3 h-3 text-white" />
          )}
        </div>
        
        {/* Tooltip on hover */}
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          <div className="bg-popover text-popover-foreground text-xs p-2 rounded shadow-lg border whitespace-nowrap">
            Click for details
          </div>
        </div>
      </button>
      
      {/* Arrow */}
      {!isLast && (
        <div className="flex items-center px-2">
          <ArrowRight className={cn(
            "w-4 h-4",
            isDisabled ? "text-muted-foreground/30" : "text-muted-foreground"
          )} />
        </div>
      )}
    </div>
  );
}

/**
 * Mode Pipeline Flow visualization component
 */
export function ModePipelineFlow({
  mode,
  config,
  webEnabled = false,
  onStepClick,
}: ModePipelineFlowProps) {
  const [selectedStep, setSelectedStep] = useState<PipelineStep | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const steps = getPipelineSteps(mode, config, webEnabled);

  const handleStepClick = (step: PipelineStep) => {
    setSelectedStep(step);
    setDialogOpen(true);
    onStepClick?.(step.id);
  };

  // Get mode color
  const modeColors = {
    quick: 'from-blue-500/10 to-cyan-500/10',
    think: 'from-purple-500/10 to-indigo-500/10',
    deep: 'from-orange-500/10 to-red-500/10',
    research: 'from-green-500/10 to-teal-500/10',
  };

  const stepDetails = selectedStep 
    ? getStepDetails(selectedStep.id, config, mode, webEnabled)
    : null;

  return (
    <>
      <div className={cn(
        "rounded-lg p-6 bg-gradient-to-r",
        modeColors[mode]
      )}>
        {/* Mode header */}
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="font-semibold capitalize">{mode} Mode Pipeline</h3>
          <span className="text-xs text-muted-foreground">
            ({steps.filter(s => s.enabled || s.type === 'required').length} active steps)
          </span>
          <span className="text-xs text-muted-foreground ml-auto">
            Click a step for details
          </span>
        </div>
        
        {/* Pipeline flow */}
        <div className="flex items-center overflow-x-auto pb-2">
          {steps.map((step, index) => (
            <PipelineNode
              key={step.id}
              step={step}
              isLast={index === steps.length - 1}
              onClick={() => handleStepClick(step)}
            />
          ))}
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded border-2 border-primary/50 bg-primary/5" />
            <span>Required</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded border-2 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20" />
            <span>Conditional</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded border-2 border-dashed border-muted-foreground/30 bg-muted/30" />
            <span>Disabled</span>
          </div>
        </div>
      </div>

      {/* Step detail dialog */}
      <StepDetailDialog
        step={selectedStep}
        details={stepDetails}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}

export default ModePipelineFlow;
