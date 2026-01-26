import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

// GET /api/graph/stats - Get knowledge graph statistics
export async function GET() {
  try {
    const nodeCount = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM knowledge_graph_nodes`));
    const edgeCount = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM knowledge_graph_edges`));
    
    const nodesByType = await db.execute(sql.raw(`
      SELECT type, COUNT(*) as count FROM knowledge_graph_nodes GROUP BY type ORDER BY count DESC
    `));
    
    const edgesByType = await db.execute(sql.raw(`
      SELECT relationship_type, COUNT(*) as count FROM knowledge_graph_edges GROUP BY relationship_type ORDER BY count DESC
    `));

    const stats = {
      totalNodes: parseInt((nodeCount.rows as Array<{ count: string }>)[0]?.count || '0', 10),
      totalEdges: parseInt((edgeCount.rows as Array<{ count: string }>)[0]?.count || '0', 10),
      nodesByType: Object.fromEntries(
        (nodesByType.rows as Array<{ type: string; count: string }>).map(r => [r.type, parseInt(r.count, 10)])
      ),
      edgesByType: Object.fromEntries(
        (edgesByType.rows as Array<{ relationship_type: string; count: string }>).map(r => [r.relationship_type, parseInt(r.count, 10)])
      ),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to get graph stats:', error);
    return NextResponse.json({ error: 'Failed to get graph stats' }, { status: 500 });
  }
}
