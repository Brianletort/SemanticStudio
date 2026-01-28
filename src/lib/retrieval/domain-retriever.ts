/**
 * Domain Retriever
 * 
 * Connects domain agents to the semantic layer and knowledge graph
 * for data-driven chat responses.
 * 
 * Emits per-domain events for tracing:
 * - domain_agent_started: When a domain agent begins querying
 * - domain_agent_complete: When a domain agent finishes
 * - graph_traversal_started: When GraphRAG-lite starts
 * - graph_traversal_complete: When GraphRAG-lite finishes
 */

import { db } from '@/lib/db';
import { domainAgents } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { extractEntities, getEntityByName, getAllEntities } from '@/lib/semantic/entity-resolver';
import { getTableDefinition, getJoinPath } from '@/lib/semantic/schema-registry';
import { expandQueryWithGraph, getSourceDataForNodes } from '@/lib/graph/graphrag-lite';
import type { SemanticEntity, ResolvedEntity } from '@/lib/semantic/types';
import type { GraphExpansionResult } from '@/lib/graph/types';
import type { AgentEventBus } from '@/lib/chat/event-bus';
import type { AgentEvent, DistributiveOmit } from '@/lib/chat/types';

export type RetrievalMode = 'quick' | 'think' | 'deep' | 'research';

export interface RetrievalResult {
  query: string;
  mode: RetrievalMode;
  resolvedEntities: ResolvedEntity[];
  graphContext?: GraphExpansionResult;
  dataResults: DataQueryResult[];
  context: string;
  metrics: {
    entitiesFound: number;
    tablesQueried: number;
    rowsReturned: number;
    graphNodesExpanded: number;
    retrievalTimeMs: number;
  };
}

export interface DataQueryResult {
  entity: string;
  table: string;
  rows: Record<string, unknown>[];
  rowCount: number;
}

// Mode-specific configuration
const MODE_CONFIG: Record<RetrievalMode, { maxResults: number; useGraph: boolean; graphHops: number }> = {
  quick: { maxResults: 5, useGraph: false, graphHops: 0 },
  think: { maxResults: 15, useGraph: true, graphHops: 1 },
  deep: { maxResults: 30, useGraph: true, graphHops: 2 },
  research: { maxResults: 50, useGraph: true, graphHops: 3 },
};

// Retrieval options including optional event bus for tracing
export interface RetrievalOptions {
  mode?: RetrievalMode;
  agentName?: string;
  eventBus?: AgentEventBus;
  runId?: string;
  // Override mode config if provided
  maxResults?: number;
  graphHops?: number;
}

/**
 * Domain Retriever Class
 */
export class DomainRetriever {
  /**
   * Main retrieval method - gets relevant data for a query
   */
  async retrieve(
    query: string,
    modeOrOptions: RetrievalMode | RetrievalOptions = 'think',
    agentName?: string
  ): Promise<RetrievalResult> {
    // Parse options
    const options: RetrievalOptions = typeof modeOrOptions === 'string' 
      ? { mode: modeOrOptions, agentName }
      : modeOrOptions;
    
    const mode = options.mode || 'think';
    const eventBus = options.eventBus;
    const runId = options.runId || 'unknown';
    
    const startTime = Date.now();
    const config = {
      ...MODE_CONFIG[mode],
      // Override with custom values if provided
      maxResults: options.maxResults ?? MODE_CONFIG[mode].maxResults,
      graphHops: options.graphHops ?? MODE_CONFIG[mode].graphHops,
    };
    
    // Helper to emit events
    const emitEvent = async (event: DistributiveOmit<AgentEvent, 'runId'>) => {
      if (eventBus) {
        await eventBus.emit({ ...event, runId } as AgentEvent);
      }
    };
    
    // 1. Extract entities from query
    const entityStartTime = Date.now();
    const resolvedEntities = await extractEntities(query);
    
    // Determine domains from entities
    const domains = [...new Set(resolvedEntities.map(e => e.entity.domainAgent).filter(Boolean))];
    console.log(`[DomainRetriever] Detected domains: ${domains.join(', ') || 'none'}`);
    
    // 2. Get graph context if mode supports it
    let graphContext: GraphExpansionResult | undefined;
    if (config.useGraph && config.graphHops > 0) {
      const graphStartTime = Date.now();
      const startEntities = resolvedEntities.map(e => e.entity.name);
      
      await emitEvent({
        type: 'graph_traversal_started',
        hops: config.graphHops,
        startEntities,
      });
      
      graphContext = await expandQueryWithGraph(query, config.graphHops, config.maxResults);
      
      await emitEvent({
        type: 'graph_traversal_complete',
        hops: config.graphHops,
        nodesVisited: graphContext?.expandedNodes?.length || 0,
        relationshipsFound: graphContext?.paths?.length || 0,
        durationMs: Date.now() - graphStartTime,
      });
    }
    
    // 3. Query relevant tables with per-domain events
    const dataResults = await this.queryRelevantTablesWithEvents(
      query,
      resolvedEntities,
      options.agentName,
      config.maxResults,
      emitEvent
    );
    
    // 4. Build context string
    const context = this.buildContext(resolvedEntities, graphContext, dataResults, mode);
    
    // 5. Calculate metrics
    const metrics = {
      entitiesFound: resolvedEntities.length,
      tablesQueried: dataResults.length,
      rowsReturned: dataResults.reduce((sum, r) => sum + r.rowCount, 0),
      graphNodesExpanded: graphContext ? graphContext.expandedNodes.length : 0,
      retrievalTimeMs: Date.now() - startTime,
    };
    
    return {
      query,
      mode,
      resolvedEntities,
      graphContext,
      dataResults,
      context,
      metrics,
    };
  }
  
  /**
   * Query relevant tables with event emissions per domain
   */
  private async queryRelevantTablesWithEvents(
    query: string,
    entities: ResolvedEntity[],
    agentName: string | undefined,
    maxResults: number,
    emitEvent: (event: DistributiveOmit<AgentEvent, 'runId'>) => Promise<void>
  ): Promise<DataQueryResult[]> {
    const results: DataQueryResult[] = [];
    const queriedTables = new Set<string>();

    // Query tables for resolved entities, grouped by domain
    const entitiesByDomain = new Map<string, ResolvedEntity[]>();
    for (const resolved of entities) {
      const domain = resolved.entity.domainAgent || 'general';
      if (!entitiesByDomain.has(domain)) {
        entitiesByDomain.set(domain, []);
      }
      entitiesByDomain.get(domain)!.push(resolved);
    }
    
    // Process each domain
    for (const [domain, domainEntities] of entitiesByDomain) {
      const domainStartTime = Date.now();
      
      await emitEvent({
        type: 'domain_agent_started',
        agentId: `domain_${domain}`,
        domain,
        query: query.substring(0, 100),
      });
      
      let domainResultsCount = 0;
      
      for (const resolved of domainEntities) {
        const table = resolved.entity.sourceTable;
        if (queriedTables.has(table)) continue;
        queriedTables.add(table);

        try {
          const queryResult = await this.queryTable(table, query, maxResults);
          if (queryResult.rows.length > 0) {
            results.push({
              entity: resolved.entity.name,
              table,
              rows: queryResult.rows,
              rowCount: queryResult.rows.length,
            });
            domainResultsCount += queryResult.rows.length;
          }
        } catch (error) {
          console.error(`Failed to query table ${table}:`, error);
        }
      }
      
      await emitEvent({
        type: 'domain_agent_complete',
        agentId: `domain_${domain}`,
        domain,
        resultsCount: domainResultsCount,
        durationMs: Date.now() - domainStartTime,
      });
    }

    // If agent specified, also query its associated tables
    if (agentName) {
      const agentStartTime = Date.now();
      
      await emitEvent({
        type: 'domain_agent_started',
        agentId: `agent_${agentName}`,
        domain: agentName,
        query: query.substring(0, 100),
      });
      
      let agentResultsCount = 0;
      const agentEntities = await this.getAgentEntities(agentName);
      
      for (const entity of agentEntities) {
        if (queriedTables.has(entity.sourceTable)) continue;
        queriedTables.add(entity.sourceTable);

        try {
          const queryResult = await this.queryTable(entity.sourceTable, query, maxResults);
          if (queryResult.rows.length > 0) {
            results.push({
              entity: entity.name,
              table: entity.sourceTable,
              rows: queryResult.rows,
              rowCount: queryResult.rows.length,
            });
            agentResultsCount += queryResult.rows.length;
          }
        } catch (error) {
          console.error(`Failed to query agent table ${entity.sourceTable}:`, error);
        }
      }
      
      await emitEvent({
        type: 'domain_agent_complete',
        agentId: `agent_${agentName}`,
        domain: agentName,
        resultsCount: agentResultsCount,
        durationMs: Date.now() - agentStartTime,
      });
    }

    return results;
  }

  /**
   * Query a single table with optional search
   */
  private async queryTable(
    tableName: string,
    searchQuery: string,
    limit: number
  ): Promise<{ rows: Record<string, unknown>[] }> {
    // Get table definition to find text columns
    const tableDef = await getTableDefinition(tableName);
    if (!tableDef) {
      return { rows: [] };
    }

    // Find text columns for search
    const textColumns = tableDef.columns
      .filter(c => c.dataType.toLowerCase().includes('text') || c.dataType.toLowerCase().includes('character'))
      .map(c => c.name);

    // Build search condition
    let whereClause = '';
    if (textColumns.length > 0 && searchQuery.length > 2) {
      const searchTerms = searchQuery.split(/\s+/).filter(t => t.length > 2).slice(0, 3);
      if (searchTerms.length > 0) {
        const conditions = searchTerms.map(term => {
          const colConditions = textColumns.map(col => 
            `LOWER(${col}::text) LIKE LOWER('%${term.replace(/'/g, "''")}%')`
          );
          return `(${colConditions.join(' OR ')})`;
        });
        whereClause = `WHERE ${conditions.join(' OR ')}`;
      }
    }

    const query = `SELECT * FROM ${tableName} ${whereClause} LIMIT ${limit}`;
    
    try {
      const result = await db.execute(sql.raw(query));
      return { rows: result.rows as Record<string, unknown>[] };
    } catch {
      // If search fails, just get some rows
      const fallbackQuery = `SELECT * FROM ${tableName} LIMIT ${limit}`;
      const result = await db.execute(sql.raw(fallbackQuery));
      return { rows: result.rows as Record<string, unknown>[] };
    }
  }

  /**
   * Get semantic entities associated with an agent
   */
  private async getAgentEntities(agentName: string): Promise<SemanticEntity[]> {
    const allEntities = await getAllEntities();
    return allEntities.filter(e => e.domainAgent === agentName);
  }

  /**
   * Build context string for LLM
   */
  private buildContext(
    entities: ResolvedEntity[],
    graphContext: GraphExpansionResult | undefined,
    dataResults: DataQueryResult[],
    mode: RetrievalMode
  ): string {
    const parts: string[] = [];

    // Header
    parts.push(`## Retrieved Context (${mode} mode)\n`);

    // Entity summary
    if (entities.length > 0) {
      parts.push('### Identified Entities');
      for (const e of entities) {
        parts.push(`- **${e.entity.displayName}** (matched: "${e.matchedAlias}", confidence: ${(e.confidence * 100).toFixed(0)}%)`);
      }
      parts.push('');
    }

    // Data results
    if (dataResults.length > 0) {
      parts.push('### Retrieved Data');
      for (const result of dataResults) {
        parts.push(`\n#### ${result.entity} (${result.rowCount} records from ${result.table})`);
        
        // Format as table-like structure
        if (result.rows.length > 0) {
          const sample = result.rows.slice(0, 5);
          for (const row of sample) {
            const summary = Object.entries(row)
              .filter(([k, v]) => v !== null && !k.startsWith('_') && k !== 'embedding')
              .slice(0, 6)
              .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
              .join(', ');
            parts.push(`- ${summary}`);
          }
          if (result.rows.length > 5) {
            parts.push(`  ... and ${result.rows.length - 5} more records`);
          }
        }
      }
      parts.push('');
    }

    // Graph context (for deep modes)
    if (graphContext && graphContext.context) {
      parts.push('### Knowledge Graph Context');
      parts.push(graphContext.context);
      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * Get summary statistics for a table
   */
  async getTableStats(tableName: string): Promise<{
    rowCount: number;
    columns: string[];
  }> {
    try {
      const countResult = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${tableName}`));
      const tableDef = await getTableDefinition(tableName);
      
      return {
        rowCount: parseInt((countResult.rows as Array<{ count: string }>)[0]?.count || '0', 10),
        columns: tableDef?.columns.map(c => c.name) || [],
      };
    } catch {
      return { rowCount: 0, columns: [] };
    }
  }

  /**
   * Execute a natural language query against the data
   */
  async executeNLQuery(
    question: string,
    agentName?: string
  ): Promise<{
    answer: string;
    data: Record<string, unknown>[];
    sql?: string;
  }> {
    // Simple NL to data mapping
    const lowerQuestion = question.toLowerCase();
    
    // Count queries
    if (lowerQuestion.includes('how many') || lowerQuestion.includes('count')) {
      const entities = await extractEntities(question);
      if (entities.length > 0) {
        const table = entities[0].entity.sourceTable;
        const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${table}`));
        const count = (result.rows as Array<{ count: string }>)[0]?.count || '0';
        return {
          answer: `There are ${count} ${entities[0].entity.displayName.toLowerCase()}s in the system.`,
          data: result.rows as Record<string, unknown>[],
          sql: `SELECT COUNT(*) FROM ${table}`,
        };
      }
    }

    // List queries
    if (lowerQuestion.includes('list') || lowerQuestion.includes('show') || lowerQuestion.includes('what')) {
      const entities = await extractEntities(question);
      if (entities.length > 0) {
        const table = entities[0].entity.sourceTable;
        const result = await db.execute(sql.raw(`SELECT * FROM ${table} LIMIT 10`));
        return {
          answer: `Here are the ${entities[0].entity.displayName.toLowerCase()}s:`,
          data: result.rows as Record<string, unknown>[],
          sql: `SELECT * FROM ${table} LIMIT 10`,
        };
      }
    }

    // Default: use full retrieval
    const retrieval = await this.retrieve(question, 'think', agentName);
    return {
      answer: retrieval.context,
      data: retrieval.dataResults.flatMap(r => r.rows),
    };
  }
}

// Export singleton instance
export const domainRetriever = new DomainRetriever();

export default DomainRetriever;
