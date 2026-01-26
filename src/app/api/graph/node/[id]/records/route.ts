import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

// GET /api/graph/node/[id]/records - Get sample records from source data for a node
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: nodeId } = await params;

    // First, get the node to find its source table and source ID
    const nodeResult = await db.execute(sql.raw(`
      SELECT id, type, name, source_table, source_id, properties
      FROM knowledge_graph_nodes
      WHERE id = '${nodeId}'
      LIMIT 1
    `));

    if (nodeResult.rows.length === 0) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    const node = nodeResult.rows[0] as {
      id: string;
      type: string;
      name: string;
      source_table: string | null;
      source_id: string | null;
      properties: Record<string, unknown>;
    };

    // If no source table, return the node properties as the "record"
    if (!node.source_table) {
      return NextResponse.json({
        records: [{ ...node.properties, _node_name: node.name, _node_type: node.type }],
        source: 'properties',
      });
    }

    // Validate table name to prevent SQL injection (only allow alphanumeric and underscore)
    const tableName = node.source_table;
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      return NextResponse.json({ error: 'Invalid source table name' }, { status: 400 });
    }

    // Check if the table exists
    const tableExistsResult = await db.execute(sql.raw(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '${tableName}'
      ) as exists
    `));

    const tableExists = (tableExistsResult.rows[0] as { exists: boolean }).exists;

    if (!tableExists) {
      // Table doesn't exist, return properties
      return NextResponse.json({
        records: [{ ...node.properties, _node_name: node.name, _node_type: node.type }],
        source: 'properties',
        message: `Source table '${tableName}' not found`,
      });
    }

    // Query the source table for the specific record
    let records: Record<string, unknown>[] = [];

    if (node.source_id) {
      // Try to find by ID - first check if the table has an 'id' column
      const columnsResult = await db.execute(sql.raw(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = '${tableName}'
        AND column_name = 'id'
      `));

      if (columnsResult.rows.length > 0) {
        // Table has an id column, query by it
        const recordResult = await db.execute(sql.raw(`
          SELECT * FROM "${tableName}"
          WHERE id::text = '${node.source_id}'
          LIMIT 5
        `));
        records = recordResult.rows as Record<string, unknown>[];
      }
    }

    // If no records found by ID, try to find similar records by name/type
    if (records.length === 0) {
      // Get all columns to find a suitable name column
      const columnsResult = await db.execute(sql.raw(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = '${tableName}'
      `));

      const columns = (columnsResult.rows as { column_name: string }[]).map(r => r.column_name);
      
      // Common name columns
      const nameColumns = ['name', 'title', 'company_name', 'product_name', 'customer_name', 
                          'employee_name', 'first_name', 'label', 'description'];
      const nameColumn = nameColumns.find(col => columns.includes(col));

      if (nameColumn && node.name) {
        // Escape single quotes in the name
        const safeName = node.name.replace(/'/g, "''");
        const recordResult = await db.execute(sql.raw(`
          SELECT * FROM "${tableName}"
          WHERE "${nameColumn}" ILIKE '%${safeName}%'
          LIMIT 5
        `));
        records = recordResult.rows as Record<string, unknown>[];
      }

      // If still no records, just get a sample
      if (records.length === 0) {
        const sampleResult = await db.execute(sql.raw(`
          SELECT * FROM "${tableName}"
          LIMIT 3
        `));
        records = sampleResult.rows as Record<string, unknown>[];
      }
    }

    return NextResponse.json({
      records,
      source: tableName,
      sourceId: node.source_id,
    });
  } catch (error) {
    console.error('Failed to get node records:', error);
    return NextResponse.json({ error: 'Failed to get node records' }, { status: 500 });
  }
}
