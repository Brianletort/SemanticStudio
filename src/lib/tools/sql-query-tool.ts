/**
 * SQL Query Tool
 * 
 * Allows agents to execute SQL queries against their configured data sources.
 * Enforces table access restrictions based on agent configuration.
 */

import { UnifiedRetriever, getUnifiedRetriever } from '@/lib/search/unified-retriever';
import type { Tool, ToolDefinition, ToolContext, ToolResult } from './types';

// SQL query parameters
export interface SQLQueryParams {
  query: string;
  explain?: boolean;  // Return query plan instead of results
}

// SQL query result
export interface SQLQueryToolResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  columns: string[];
  executionTimeMs?: number;
}

// Tool definition
export const sqlQueryToolDefinition: ToolDefinition = {
  name: 'query_data',
  description: 'Execute a SQL query against the configured data sources. Use this to retrieve structured data, perform aggregations, filter records, and analyze data. Only SELECT queries are allowed.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The SQL SELECT query to execute. Must be a valid SELECT statement. No INSERT, UPDATE, DELETE, or DDL statements allowed.',
      },
      explain: {
        type: 'boolean',
        description: 'If true, returns the query execution plan instead of results. Useful for understanding query performance.',
      },
    },
    required: ['query'],
  },
};

// Tool executor
export async function executeSQLQuery(
  params: SQLQueryParams,
  context: ToolContext
): Promise<ToolResult<SQLQueryToolResult>> {
  const startTime = Date.now();
  const retriever = getUnifiedRetriever();
  
  try {
    // Validate query is a SELECT
    const normalizedQuery = params.query.trim().toLowerCase();
    if (!normalizedQuery.startsWith('select') && !normalizedQuery.startsWith('with')) {
      return {
        success: false,
        error: 'Only SELECT queries are allowed. INSERT, UPDATE, DELETE, and DDL statements are not permitted.',
      };
    }
    
    // Handle EXPLAIN request
    let queryToExecute = params.query;
    if (params.explain) {
      queryToExecute = `EXPLAIN ${params.query}`;
    }
    
    // Execute query through retriever (handles access control)
    const result = await retriever.queryStructuredData({
      query: queryToExecute,
      agentId: context.agentId,
      dataSourceId: context.dataSourceId,
    });
    
    const executionTimeMs = Date.now() - startTime;
    
    return {
      success: true,
      data: {
        rows: result.rows,
        rowCount: result.rowCount,
        columns: result.columns,
        executionTimeMs,
      },
      metadata: {
        executionTimeMs,
        agentId: context.agentId,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error executing SQL query',
      metadata: {
        executionTimeMs: Date.now() - startTime,
      },
    };
  }
}

// Complete tool export
export const sqlQueryTool: Tool<SQLQueryParams, SQLQueryToolResult> = {
  definition: sqlQueryToolDefinition,
  execute: executeSQLQuery,
};

export default sqlQueryTool;
