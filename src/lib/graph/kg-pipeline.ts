/**
 * Knowledge Graph ETL Pipeline
 * 
 * Builds and maintains the knowledge graph from sample data.
 */

import { db } from '@/lib/db';
import { knowledgeGraphNodes, knowledgeGraphEdges } from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import { embed } from '@/lib/llm';
import type { NodeExtractionConfig, EdgeExtractionConfig, GraphStats } from './types';

// Default node extraction configurations
const NODE_CONFIGS: NodeExtractionConfig[] = [
  // Core business entities
  {
    sourceTable: 'sample_customers',
    nodeType: 'customer',
    nameColumn: 'name',
    idColumn: 'id',
    propertyColumns: ['email', 'company', 'segment', 'industry', 'health_score', 'churn_risk'],
  },
  {
    sourceTable: 'sample_employees',
    nodeType: 'employee',
    nameColumn: 'name',
    idColumn: 'id',
    propertyColumns: ['email', 'department', 'title', 'status'],
  },
  // Products
  {
    sourceTable: 'sample_products',
    nodeType: 'product',
    nameColumn: 'name',
    idColumn: 'id',
    propertyColumns: ['sku', 'category', 'price', 'stock_quantity'],
  },
  {
    sourceTable: 'nw_products',
    nodeType: 'nw_product',
    nameColumn: 'product_name',
    idColumn: 'id',
    propertyColumns: ['quantity_per_unit', 'unit_price', 'units_in_stock', 'discontinued'],
  },
  // Product metadata
  {
    sourceTable: 'nw_categories',
    nodeType: 'category',
    nameColumn: 'category_name',
    idColumn: 'id',
    propertyColumns: ['description'],
  },
  {
    sourceTable: 'nw_suppliers',
    nodeType: 'supplier',
    nameColumn: 'company_name',
    idColumn: 'id',
    propertyColumns: ['contact_name', 'city', 'country', 'phone'],
  },
  // Sales & CRM
  {
    sourceTable: 'sample_opportunities',
    nodeType: 'opportunity',
    nameColumn: 'name',
    idColumn: 'id',
    propertyColumns: ['stage', 'amount', 'probability', 'owner'],
  },
  {
    sourceTable: 'sample_tickets',
    nodeType: 'ticket',
    nameColumn: 'subject',
    idColumn: 'id',
    propertyColumns: ['priority', 'status', 'category'],
  },
  // Orders (Northwind)
  {
    sourceTable: 'nw_orders',
    nodeType: 'order',
    nameColumn: 'id', // Use ID as name since orders don't have a name
    idColumn: 'id',
    propertyColumns: ['order_date', 'shipped_date', 'freight', 'ship_city', 'ship_country'],
  },
  // ============================================
  // PUBLIC DATA NODES
  // ============================================
  // Public Companies
  {
    sourceTable: 'public_companies',
    nodeType: 'public_company',
    nameColumn: 'name',
    idColumn: 'id',
    propertyColumns: ['ticker', 'sector', 'industry', 'market_cap', 'pe_ratio', 'revenue', 'employees', 'country', 'last_price'],
  },
  // Industry Statistics
  {
    sourceTable: 'industry_statistics',
    nodeType: 'industry',
    nameColumn: 'naics_title',
    idColumn: 'id',
    propertyColumns: ['naics_code', 'year', 'establishments', 'employment', 'annual_payroll', 'average_wage'],
  },
  // Economic Indicators (latest values only - grouped by indicator type)
  {
    sourceTable: 'economic_indicators',
    nodeType: 'economic_indicator',
    nameColumn: 'indicator_name',
    idColumn: 'id',
    propertyColumns: ['indicator', 'value', 'date', 'unit', 'frequency'],
  },
];

// Default edge extraction configurations
// NOTE: For FK relationships, the edge goes FROM the record with the FK TO the referenced record
// e.g., opportunity has customer_id FK, so edge: customer -> opportunity
const EDGE_CONFIGS: EdgeExtractionConfig[] = [
  // Customer relationships
  {
    name: 'customer_has_opportunity',
    relationshipType: 'HAS_OPPORTUNITY',
    sourceNodeType: 'customer',
    targetNodeType: 'opportunity',
    foreignKey: {
      table: 'sample_opportunities',
      sourceColumn: 'customer_id', // FK in opportunities pointing to customer
      targetColumn: 'id',          // opportunity's own ID
    },
  },
  {
    name: 'customer_has_ticket',
    relationshipType: 'HAS_TICKET',
    sourceNodeType: 'customer',
    targetNodeType: 'ticket',
    foreignKey: {
      table: 'sample_tickets',
      sourceColumn: 'customer_id',
      targetColumn: 'id',
    },
  },
  // Order relationships
  {
    name: 'customer_placed_order',
    relationshipType: 'PLACED_ORDER',
    sourceNodeType: 'customer',
    targetNodeType: 'order',
    foreignKey: {
      table: 'nw_orders',
      sourceColumn: 'customer_id',
      targetColumn: 'id',
    },
  },
  {
    name: 'employee_processed_order',
    relationshipType: 'PROCESSED',
    sourceNodeType: 'employee',
    targetNodeType: 'order',
    foreignKey: {
      table: 'nw_orders',
      sourceColumn: 'employee_id',
      targetColumn: 'id',
    },
  },
  // Product relationships
  {
    name: 'product_belongs_to_category',
    relationshipType: 'BELONGS_TO',
    sourceNodeType: 'nw_product',
    targetNodeType: 'category',
    foreignKey: {
      table: 'nw_products',
      sourceColumn: 'category_id',
      targetColumn: 'id',
    },
  },
  {
    name: 'product_supplied_by',
    relationshipType: 'SUPPLIED_BY',
    sourceNodeType: 'nw_product',
    targetNodeType: 'supplier',
    foreignKey: {
      table: 'nw_products',
      sourceColumn: 'supplier_id',
      targetColumn: 'id',
    },
  },
  // Employee hierarchy
  {
    name: 'employee_reports_to',
    relationshipType: 'REPORTS_TO',
    sourceNodeType: 'employee',
    targetNodeType: 'employee',
    foreignKey: {
      table: 'sample_employees',
      sourceColumn: 'manager_id',
      targetColumn: 'id',
    },
  },
  // ============================================
  // PUBLIC DATA EDGES
  // ============================================
  // Note: These edges are built using rule-based matching rather than FK relationships
  // since the public data doesn't have direct FK relationships to existing entities
];

/**
 * Knowledge Graph Pipeline
 */
export class KnowledgeGraphPipeline {
  private generateEmbeddings: boolean;

  constructor(options?: { generateEmbeddings?: boolean }) {
    this.generateEmbeddings = options?.generateEmbeddings ?? false;
  }

  /**
   * Build the complete knowledge graph
   */
  async build(): Promise<GraphStats> {
    console.log('Starting knowledge graph build...');

    // Phase 1: Extract nodes
    console.log('Phase 1: Extracting nodes...');
    const nodeCount = await this.extractAllNodes();
    console.log(`  Extracted ${nodeCount} nodes`);

    // Phase 2: Build edges
    console.log('Phase 2: Building edges...');
    const edgeCount = await this.buildAllEdges();
    console.log(`  Built ${edgeCount} edges`);

    // Phase 3: Calculate importance scores
    console.log('Phase 3: Calculating importance scores...');
    await this.calculateImportanceScores();

    // Phase 4: Generate embeddings (if enabled)
    if (this.generateEmbeddings) {
      console.log('Phase 4: Generating embeddings...');
      await this.generateNodeEmbeddings();
    }

    return this.getStats();
  }

  /**
   * Extract nodes from all configured sources
   */
  async extractAllNodes(): Promise<number> {
    let totalNodes = 0;

    for (const config of NODE_CONFIGS) {
      try {
        const count = await this.extractNodes(config);
        totalNodes += count;
      } catch (error) {
        console.error(`Failed to extract nodes from ${config.sourceTable}:`, error);
      }
    }

    return totalNodes;
  }

  /**
   * Extract nodes from a single source
   */
  async extractNodes(config: NodeExtractionConfig): Promise<number> {
    const { sourceTable, nodeType, nameColumn, idColumn, propertyColumns } = config;

    // Build property select clause
    const propSelect = propertyColumns.length > 0 
      ? `, ${propertyColumns.join(', ')}`
      : '';

    // Get data from source table
    const query = `SELECT ${idColumn} as id, ${nameColumn} as name ${propSelect} FROM ${sourceTable}`;
    const result = await db.execute(sql.raw(query));
    const rows = result.rows as Array<Record<string, unknown>>;

    let insertedCount = 0;
    for (const row of rows) {
      // Build properties object
      const properties: Record<string, unknown> = {};
      for (const col of propertyColumns) {
        if (row[col] !== undefined) {
          properties[col] = row[col];
        }
      }

      try {
        // Upsert node
        await db.execute(sql.raw(`
          INSERT INTO knowledge_graph_nodes (type, name, properties, source_table, source_id)
          VALUES ('${nodeType}', '${String(row.name || '').replace(/'/g, "''")}', '${JSON.stringify(properties).replace(/'/g, "''")}', '${sourceTable}', '${row.id}')
          ON CONFLICT (source_table, source_id) DO UPDATE SET
            name = EXCLUDED.name,
            properties = EXCLUDED.properties,
            updated_at = NOW()
        `));
        insertedCount++;
      } catch (error) {
        console.error(`Failed to insert node from ${sourceTable}:`, error);
      }
    }

    return insertedCount;
  }

  /**
   * Build all edges from configured relationships
   */
  async buildAllEdges(): Promise<number> {
    let totalEdges = 0;

    for (const config of EDGE_CONFIGS) {
      try {
        const count = await this.buildEdges(config);
        totalEdges += count;
      } catch (error) {
        console.error(`Failed to build edges for ${config.name}:`, error);
      }
    }

    return totalEdges;
  }

  /**
   * Build edges for a single relationship type
   * 
   * For FK relationships:
   * - foreignKey.sourceColumn contains the FK value (points TO the source node)
   * - foreignKey.targetColumn is the target record's own ID
   * - Edge direction: sourceNodeType -> targetNodeType
   */
  async buildEdges(config: EdgeExtractionConfig): Promise<number> {
    const { relationshipType, sourceNodeType, targetNodeType, foreignKey, weight = 1.0, confidence = 1.0 } = config;

    if (!foreignKey) {
      console.warn(`No foreignKey config for ${config.name}, skipping`);
      return 0;
    }

    // Get source and target node mappings (source_id in DB -> KG node id)
    const sourceNodes = await db.execute(sql.raw(`
      SELECT id, source_id FROM knowledge_graph_nodes WHERE type = '${sourceNodeType}'
    `));
    const targetNodes = await db.execute(sql.raw(`
      SELECT id, source_id FROM knowledge_graph_nodes WHERE type = '${targetNodeType}'
    `));

    // Map: original table ID -> KG node ID
    const sourceMap = new Map((sourceNodes.rows as Array<{ id: string; source_id: string }>)
      .map(r => [r.source_id, r.id]));
    const targetMap = new Map((targetNodes.rows as Array<{ id: string; source_id: string }>)
      .map(r => [r.source_id, r.id]));

    // Get FK relationships from the table
    // sourceColumn = FK pointing to source node type
    // targetColumn = the record's own ID (which becomes target node)
    const fkQuery = `
      SELECT ${foreignKey.sourceColumn} as fk_to_source, ${foreignKey.targetColumn || 'id'} as record_id
      FROM ${foreignKey.table}
      WHERE ${foreignKey.sourceColumn} IS NOT NULL
    `;
    
    let fkResult;
    try {
      fkResult = await db.execute(sql.raw(fkQuery));
    } catch (err) {
      console.error(`Failed to query FK for ${config.name}:`, err);
      return 0;
    }

    let edgeCount = 0;
    for (const row of fkResult.rows as Array<Record<string, unknown>>) {
      // fk_to_source = ID of the SOURCE node (e.g., customer_id points to customer)
      // record_id = ID of the TARGET node (e.g., opportunity's own ID)
      const sourceKgId = sourceMap.get(String(row.fk_to_source));
      const targetKgId = targetMap.get(String(row.record_id));

      if (sourceKgId && targetKgId) {
        try {
          await db.execute(sql.raw(`
            INSERT INTO knowledge_graph_edges (source_id, target_id, relationship_type, weight, confidence)
            VALUES ('${sourceKgId}', '${targetKgId}', '${relationshipType}', ${weight}, ${confidence})
            ON CONFLICT DO NOTHING
          `));
          edgeCount++;
        } catch (error) {
          // Ignore duplicate edges
        }
      }
    }

    return edgeCount;
  }

  /**
   * Calculate importance scores based on connectivity
   */
  async calculateImportanceScores(): Promise<void> {
    // Simple PageRank-like scoring based on edge count
    await db.execute(sql.raw(`
      UPDATE knowledge_graph_nodes n
      SET importance_score = COALESCE(
        (SELECT COUNT(*) FROM knowledge_graph_edges WHERE source_id = n.id OR target_id = n.id) / 
        (SELECT MAX(c) FROM (SELECT COUNT(*) as c FROM knowledge_graph_edges GROUP BY source_id UNION SELECT COUNT(*) as c FROM knowledge_graph_edges GROUP BY target_id) t),
        0.1
      )
    `));
  }

  /**
   * Generate embeddings for nodes
   */
  async generateNodeEmbeddings(): Promise<void> {
    // Get nodes without embeddings
    const nodes = await db.execute(sql.raw(`
      SELECT id, type, name, properties 
      FROM knowledge_graph_nodes 
      WHERE embedding IS NULL
      LIMIT 100
    `));

    for (const node of nodes.rows as Array<{ id: string; type: string; name: string; properties: Record<string, unknown> }>) {
      try {
        // Create text representation for embedding
        const text = `${node.type}: ${node.name}. ${JSON.stringify(node.properties)}`;
        
        const embeddings = await embed(text);
        const embedding = embeddings[0]; // First embedding for single text
        
        // Update node with embedding
        const embeddingStr = `[${embedding.join(',')}]`;
        await db.execute(sql.raw(`
          UPDATE knowledge_graph_nodes 
          SET embedding = '${embeddingStr}'::vector 
          WHERE id = '${node.id}'
        `));
      } catch (error) {
        console.error(`Failed to generate embedding for node ${node.id}:`, error);
      }
    }
  }

  /**
   * Get graph statistics
   */
  async getStats(): Promise<GraphStats> {
    const nodeCount = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM knowledge_graph_nodes`));
    const edgeCount = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM knowledge_graph_edges`));
    
    const nodesByType = await db.execute(sql.raw(`
      SELECT type, COUNT(*) as count FROM knowledge_graph_nodes GROUP BY type
    `));
    
    const edgesByType = await db.execute(sql.raw(`
      SELECT relationship_type, COUNT(*) as count FROM knowledge_graph_edges GROUP BY relationship_type
    `));

    const avgConnections = await db.execute(sql.raw(`
      SELECT AVG(conn_count) as avg FROM (
        SELECT COUNT(*) as conn_count FROM knowledge_graph_edges GROUP BY source_id
      ) t
    `));

    return {
      totalNodes: parseInt((nodeCount.rows as Array<{ count: string }>)[0]?.count || '0', 10),
      totalEdges: parseInt((edgeCount.rows as Array<{ count: string }>)[0]?.count || '0', 10),
      nodesByType: Object.fromEntries(
        (nodesByType.rows as Array<{ type: string; count: string }>).map(r => [r.type, parseInt(r.count, 10)])
      ),
      edgesByType: Object.fromEntries(
        (edgesByType.rows as Array<{ relationship_type: string; count: string }>).map(r => [r.relationship_type, parseInt(r.count, 10)])
      ),
      avgConnections: parseFloat((avgConnections.rows as Array<{ avg: string }>)[0]?.avg || '0'),
    };
  }

  /**
   * Clear the entire knowledge graph
   */
  async clear(): Promise<void> {
    await db.execute(sql.raw(`TRUNCATE knowledge_graph_edges`));
    await db.execute(sql.raw(`TRUNCATE knowledge_graph_nodes CASCADE`));
  }
}

export default KnowledgeGraphPipeline;
