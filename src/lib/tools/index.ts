/**
 * Agent Tools Index
 * 
 * Exports all agent tools and utilities for tool management.
 */

// Types
export * from './types';

// Tools
export * from './sql-query-tool';
export * from './semantic-search-tool';

// Tool registry
import { sqlQueryTool, sqlQueryToolDefinition } from './sql-query-tool';
import { semanticSearchTool, semanticSearchToolDefinition } from './semantic-search-tool';
import type { Tool, ToolDefinition, ToolContext, ToolResult, toOpenAIFunctions } from './types';

// All available tools
export const allTools = {
  query_data: sqlQueryTool,
  search_knowledge: semanticSearchTool,
};

// All tool definitions
export const allToolDefinitions: ToolDefinition[] = [
  sqlQueryToolDefinition,
  semanticSearchToolDefinition,
];

// Get tools for an agent based on their configuration
export async function getToolsForAgent(agentId: string): Promise<Tool[]> {
  // For now, return all tools
  // In the future, this could be filtered based on agent configuration
  return Object.values(allTools);
}

// Execute a tool by name
export async function executeTool(
  toolName: string,
  params: unknown,
  context: ToolContext
): Promise<ToolResult> {
  const tool = allTools[toolName as keyof typeof allTools];
  
  if (!tool) {
    return {
      success: false,
      error: `Unknown tool: ${toolName}`,
    };
  }
  
  return tool.execute(params as never, context);
}

// Get tool definitions in OpenAI format
export function getOpenAIToolDefinitions(): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> {
  return allToolDefinitions.map(def => ({
    type: 'function',
    function: {
      name: def.name,
      description: def.description,
      parameters: {
        type: 'object',
        properties: def.parameters.properties,
        required: def.parameters.required || [],
      },
    },
  }));
}
