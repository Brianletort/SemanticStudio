"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Wand2,
  ArrowRight,
  ArrowLeft,
  BarChart3,
  GitCompare,
  FileText,
  Target,
  Lightbulb,
} from "lucide-react";

// Template parameter definition
interface TemplateParameter {
  name: string;
  label: string;
  placeholder: string;
}

// Builder template definition
interface BuilderTemplate {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  template: string;
  parameters: TemplateParameter[];
}

// Hardcoded templates for the prompt builder
const builderTemplates: BuilderTemplate[] = [
  {
    id: "compare",
    title: "Compare Items",
    description: "Compare two things side by side with detailed analysis",
    icon: <GitCompare className="h-5 w-5" />,
    template: "Compare {itemA} and {itemB}. Analyze their similarities, differences, strengths, and weaknesses. Provide a recommendation on which is better for {useCase}.",
    parameters: [
      { name: "itemA", label: "First Item", placeholder: "e.g., Product A, Option 1" },
      { name: "itemB", label: "Second Item", placeholder: "e.g., Product B, Option 2" },
      { name: "useCase", label: "Use Case / Context", placeholder: "e.g., small business, daily use" },
    ],
  },
  {
    id: "analyze_trend",
    title: "Analyze Trends",
    description: "Get insights on data trends and patterns",
    icon: <BarChart3 className="h-5 w-5" />,
    template: "Analyze the trends in {metric} over {timeframe}. Identify patterns, anomalies, and provide actionable insights. What factors might be driving these trends?",
    parameters: [
      { name: "metric", label: "Metric / Data", placeholder: "e.g., sales revenue, user signups" },
      { name: "timeframe", label: "Time Period", placeholder: "e.g., last 6 months, Q4 2024" },
    ],
  },
  {
    id: "explain_concept",
    title: "Explain Concept",
    description: "Get a clear, structured explanation",
    icon: <Lightbulb className="h-5 w-5" />,
    template: "Explain {concept} in detail. Include: 1) A simple definition, 2) How it works, 3) Real-world examples, 4) Why it matters for {audience}.",
    parameters: [
      { name: "concept", label: "Concept / Topic", placeholder: "e.g., machine learning, agile methodology" },
      { name: "audience", label: "Target Audience", placeholder: "e.g., business executives, beginners" },
    ],
  },
  {
    id: "action_plan",
    title: "Create Action Plan",
    description: "Build a detailed step-by-step plan",
    icon: <Target className="h-5 w-5" />,
    template: "Create a detailed action plan to {goal}. Consider the current situation: {context}. Include specific steps, timeline, resources needed, and potential obstacles with solutions.",
    parameters: [
      { name: "goal", label: "Goal / Objective", placeholder: "e.g., increase customer retention by 20%" },
      { name: "context", label: "Current Situation", placeholder: "e.g., 15% monthly churn rate" },
    ],
  },
  {
    id: "summarize",
    title: "Summarize Information",
    description: "Get a concise, structured summary",
    icon: <FileText className="h-5 w-5" />,
    template: "Summarize {topic} in {format}. Focus on the most important points and key takeaways. Target length: {length}.",
    parameters: [
      { name: "topic", label: "Topic / Content", placeholder: "e.g., Q4 sales report, meeting notes" },
      { name: "format", label: "Format", placeholder: "e.g., bullet points, executive summary" },
      { name: "length", label: "Target Length", placeholder: "e.g., 5 key points, 2 paragraphs" },
    ],
  },
];

interface PromptBuilderProps {
  onInsertPrompt: (content: string) => void;
  disabled?: boolean;
}

export function PromptBuilder({ onInsertPrompt, disabled = false }: PromptBuilderProps) {
  const [open, setOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<BuilderTemplate | null>(null);
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});

  // Reset state when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setSelectedTemplate(null);
      setParameterValues({});
    }
  };

  // Select a template
  const handleSelectTemplate = (template: BuilderTemplate) => {
    setSelectedTemplate(template);
    setParameterValues(
      template.parameters.reduce((acc, p) => ({ ...acc, [p.name]: "" }), {})
    );
  };

  // Go back to template selection
  const handleBack = () => {
    setSelectedTemplate(null);
    setParameterValues({});
  };

  // Build the prompt from template and parameters
  const buildPrompt = (): string => {
    if (!selectedTemplate) return "";
    
    let result = selectedTemplate.template;
    for (const [param, value] of Object.entries(parameterValues)) {
      result = result.replace(new RegExp(`\\{${param}\\}`, "g"), value || `[${param}]`);
    }
    return result;
  };

  // Check if all parameters are filled
  const allParametersFilled = (): boolean => {
    if (!selectedTemplate) return false;
    return selectedTemplate.parameters.every(
      (p) => parameterValues[p.name]?.trim().length > 0
    );
  };

  // Insert the built prompt
  const handleInsert = () => {
    const prompt = buildPrompt();
    onInsertPrompt(prompt);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={disabled}
          title="Prompt Builder"
        >
          <Wand2 className="h-4 w-4" />
          <span className="hidden sm:inline">Builder</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        {!selectedTemplate ? (
          // Template Selection View
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                Prompt Builder
              </DialogTitle>
              <DialogDescription>
                Select a template to build a comprehensive prompt
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[350px] pr-4">
              <div className="space-y-2">
                {builderTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className="w-full text-left p-3 rounded-lg border hover:bg-muted hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-md bg-primary/10 text-primary">
                        {template.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{template.title}</div>
                        <div className="text-sm text-muted-foreground mt-0.5">
                          {template.description}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {template.parameters.length} parameter{template.parameters.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground mt-1" />
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </>
        ) : (
          // Parameter Input View
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedTemplate.icon}
                {selectedTemplate.title}
              </DialogTitle>
              <DialogDescription>
                Fill in the details to build your prompt
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-2">
              {selectedTemplate.parameters.map((param) => (
                <div key={param.name} className="space-y-2">
                  <Label htmlFor={param.name}>{param.label}</Label>
                  <Input
                    id={param.name}
                    placeholder={param.placeholder}
                    value={parameterValues[param.name] || ""}
                    onChange={(e) =>
                      setParameterValues((prev) => ({
                        ...prev,
                        [param.name]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>

            <div className="p-3 bg-muted rounded-md">
              <div className="text-xs font-medium text-muted-foreground mb-1">Preview:</div>
              <p className="text-sm">
                {buildPrompt()}
              </p>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={handleBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button 
                onClick={handleInsert} 
                disabled={!allParametersFilled()}
                className="gap-2"
              >
                Insert Prompt
                <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
