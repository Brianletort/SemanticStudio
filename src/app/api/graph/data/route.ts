import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

// GET /api/graph/data - Get graph data for visualization
export async function GET() {
  try {
    // Get all nodes
    const nodesResult = await db.execute(sql.raw(`
      SELECT id, type, name, properties, importance_score, source_table, source_id
      FROM knowledge_graph_nodes
      ORDER BY importance_score DESC
      LIMIT 500
    `));

    // Get all edges
    const edgesResult = await db.execute(sql.raw(`
      SELECT source_id, target_id, relationship_type, weight
      FROM knowledge_graph_edges
      LIMIT 1000
    `));

    const nodes = (nodesResult.rows as Array<{
      id: string;
      type: string;
      name: string;
      properties: Record<string, unknown>;
      importance_score: string;
      source_table: string | null;
      source_id: string | null;
    }>).map(row => ({
      id: row.id,
      type: row.type,
      name: row.name,
      properties: row.properties || {},
      importanceScore: parseFloat(row.importance_score) || 0.5,
      sourceTable: row.source_table,
      sourceId: row.source_id,
    }));

    const links = (edgesResult.rows as Array<{
      source_id: string;
      target_id: string;
      relationship_type: string;
      weight: string;
    }>).map(row => ({
      source: row.source_id,
      target: row.target_id,
      relationshipType: row.relationship_type,
      weight: parseFloat(row.weight) || 1,
    }));

    // Filter out edges where source or target doesn't exist in nodes
    const nodeIds = new Set(nodes.map(n => n.id));
    const validLinks = links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));

    return NextResponse.json({
      nodes,
      links: validLinks,
    });
  } catch (error) {
    console.error('Failed to get graph data:', error);
    return NextResponse.json({ error: 'Failed to get graph data' }, { status: 500 });
  }
}
