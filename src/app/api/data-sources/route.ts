import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dataSources } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { StorageTargetConfig } from '@/lib/etl/types';

// GET /api/data-sources - List all data sources
export async function GET() {
  try {
    const sources = await db.select().from(dataSources).orderBy(desc(dataSources.createdAt));
    return NextResponse.json(sources);
  } catch (error) {
    console.error('Failed to fetch data sources:', error);
    return NextResponse.json({ error: 'Failed to fetch data sources' }, { status: 500 });
  }
}

// POST /api/data-sources - Create a new data source
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, displayName, sourceType, config, syncFrequency, storageTargets } = body;

    if (!name || !displayName || !sourceType) {
      return NextResponse.json(
        { error: 'name, displayName, and sourceType are required' },
        { status: 400 }
      );
    }

    // Validate storage targets if provided
    if (storageTargets && Array.isArray(storageTargets)) {
      for (const target of storageTargets) {
        if (!['sql_table', 'postgres_vector', 'azure_search'].includes(target.type)) {
          return NextResponse.json(
            { error: `Invalid storage target type: ${target.type}. Must be sql_table, postgres_vector, or azure_search` },
            { status: 400 }
          );
        }
      }
    }

    const [source] = await db.insert(dataSources).values({
      name,
      displayName,
      sourceType,
      config: config || {},
      syncFrequency,
      storageTargets: storageTargets || [],
    }).returning();

    return NextResponse.json(source);
  } catch (error) {
    console.error('Failed to create data source:', error);
    return NextResponse.json({ error: 'Failed to create data source' }, { status: 500 });
  }
}

// PUT /api/data-sources - Update a data source
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, displayName, sourceType, status, config, storageTargets } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Validate storage targets if provided
    if (storageTargets && Array.isArray(storageTargets)) {
      for (const target of storageTargets) {
        if (!['sql_table', 'postgres_vector', 'azure_search'].includes(target.type)) {
          return NextResponse.json(
            { error: `Invalid storage target type: ${target.type}. Must be sql_table, postgres_vector, or azure_search` },
            { status: 400 }
          );
        }
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (displayName !== undefined) updateData.displayName = displayName;
    if (sourceType !== undefined) updateData.sourceType = sourceType;
    if (status !== undefined) updateData.status = status;
    if (config !== undefined) updateData.config = config;
    if (storageTargets !== undefined) updateData.storageTargets = storageTargets;

    const [updated] = await db.update(dataSources)
      .set(updateData)
      .where(eq(dataSources.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Data source not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update data source:', error);
    return NextResponse.json({ error: 'Failed to update data source' }, { status: 500 });
  }
}

// DELETE /api/data-sources - Delete a data source
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await db.delete(dataSources).where(eq(dataSources.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete data source:', error);
    return NextResponse.json({ error: 'Failed to delete data source' }, { status: 500 });
  }
}
