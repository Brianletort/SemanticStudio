import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

// GET /api/data-preview?table=<tableName> - Preview data from a table
export async function GET(request: NextRequest) {
  try {
    const table = request.nextUrl.searchParams.get('table');
    
    if (!table) {
      return NextResponse.json({ error: 'table parameter is required' }, { status: 400 });
    }

    // Validate table name (prevent SQL injection)
    const validTablePattern = /^[a-z_][a-z0-9_]*$/i;
    if (!validTablePattern.test(table)) {
      return NextResponse.json({ error: 'Invalid table name' }, { status: 400 });
    }

    // Get row count
    const countResult = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${table}`));
    const rowCount = parseInt((countResult.rows as Array<{ count: string }>)[0]?.count || '0', 10);

    // Get sample rows
    const result = await db.execute(sql.raw(`SELECT * FROM ${table} LIMIT 20`));

    return NextResponse.json({
      table,
      rowCount,
      rows: result.rows,
    });
  } catch (error) {
    console.error('Failed to preview data:', error);
    return NextResponse.json({ error: 'Failed to preview data' }, { status: 500 });
  }
}
