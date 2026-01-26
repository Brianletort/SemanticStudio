/**
 * Agent Tools Types
 * 
 * Types for defining tools that agents can use in chat.
 * Compatible with OpenAI function calling format.
 */

// Tool parameter types
export type ToolParameterType = 'string' | 'number' | 'boolean' | 'array' | 'object';

// Tool parameter definition
export interface ToolParameter {
  type: ToolParameterType;
  description: string;
  required?: boolean;
  enum?: string[];
  items?: ToolParameter;  // For array types
  properties?: Record<string, ToolParameter>;  // For object types
}

// Tool definition
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

// Tool execution context
export interface ToolContext {
  agentId?: string;
  dataSourceId?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

// Tool execution result
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
}

// Tool executor function type
export type ToolExecutor<TParams = unknown, TResult = unknown> = (
  params: TParams,
  context: ToolContext
) => Promise<ToolResult<TResult>>;

// Complete tool with definition and executor
export interface Tool<TParams = unknown, TResult = unknown> {
  definition: ToolDefinition;
  execute: ToolExecutor<TParams, TResult>;
}

// Convert tool definition to OpenAI function format
export function toOpenAIFunction(tool: ToolDefinition): {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
} {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters.properties,
        required: tool.parameters.required || [],
      },
    },
  };
}

// Convert multiple tools to OpenAI format
export function toOpenAIFunctions(tools: ToolDefinition[]): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> {
  return tools.map(toOpenAIFunction);
}
