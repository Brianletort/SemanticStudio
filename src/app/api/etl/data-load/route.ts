import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { etlJobs, dataSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ETLOrchestrator } from '@/lib/etl';
// Import agents to register them
import '@/lib/etl/agents';
import type { StorageTargetConfig, MultiTargetConfig } from '@/lib/etl/types';

/**
 * POST /api/etl/data-load
 * 
 * Upload a CSV/JSON file and load it to multiple targets:
 * - SQL table (structured data)
 * - PostgreSQL vector store (semantic search)
 * - Azure Cognitive Search (enterprise search)
 * 
 * Request body (multipart/form-data):
 * - file: The CSV or JSON file to upload
 * - targets: JSON string array of StorageTargetConfig
 * - dataSourceId: (optional) ID of data source to associate with
 * - autoLoad: (optional) If 'true', execute ETL immediately
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const targetsJson = formData.get('targets') as string | null;
    const dataSourceId = formData.get('dataSourceId') as string | null;
    const autoLoad = formData.get('autoLoad') === 'true';
    const name = formData.get('name') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith('.csv');
    const isJSON = fileName.endsWith('.json');

    if (!isCSV && !isJSON) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only CSV and JSON files are supported.' 
      }, { status: 400 });
    }

    // Read file content
    const fileContent = await file.text();
    
    if (!fileContent.trim()) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    // For JSON, validate it's valid JSON
    if (isJSON) {
      try {
        JSON.parse(fileContent);
      } catch {
        return NextResponse.json({ error: 'Invalid JSON file' }, { status: 400 });
      }
    }

    // Parse targets configuration
    let targets: StorageTargetConfig[] = [];
    if (targetsJson) {
      try {
        targets = JSON.parse(targetsJson);
        
        // Validate targets
        for (const target of targets) {
          if (!['sql_table', 'postgres_vector', 'azure_search'].includes(target.type)) {
            return NextResponse.json({ 
              error: `Invalid target type: ${target.type}` 
            }, { status: 400 });
          }
        }
      } catch {
        return NextResponse.json({ error: 'Invalid targets JSON' }, { status: 400 });
      }
    }

    // Default targets if none provided
    if (targets.length === 0) {
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      targets = [
        {
          type: 'sql_table',
          tableName: `${baseName}_${Date.now()}`,
          mode: 'insert',
        },
      ];
    }

    // Create ETL job definition
    const jobDefinition = {
      jobType: 'data_load' as const,
      name: name || `Load ${file.name}`,
      description: `Multi-target data load from ${file.name}`,
      sourceConfig: {
        type: isCSV ? 'csv' : 'json' as const,
        fileContent,
        filePath: file.name,
      },
      targetConfig: {
        targets,
      } as MultiTargetConfig,
    };

    // Create the job in database
    const [job] = await db.insert(etlJobs).values({
      jobType: 'data_load',
      status: 'pending',
      config: jobDefinition as unknown as Record<string, unknown>,
    }).returning();

    // Update data source if provided
    if (dataSourceId) {
      await db.update(dataSources)
        .set({
          storageTargets: targets,
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(dataSources.id, dataSourceId));
    }

    // If auto-load is enabled, execute immediately
    if (autoLoad) {
      try {
        const result = await ETLOrchestrator.executeJobDirect(jobDefinition as any);
        
        return NextResponse.json({
          message: 'File uploaded and loaded successfully',
          jobId: job.id,
          runId: result.runId,
          status: result.status,
          targets: targets.map(t => ({ type: t.type, name: t.tableName || t.indexName || t.azureIndexName })),
          recordsProcessed: result.recordsProcessed,
          recordsFailed: result.recordsFailed,
          parIterations: result.parIterations,
        });
      } catch (execError) {
        // Job created but execution failed
        await db.update(etlJobs)
          .set({ 
            status: 'failed', 
            errorMessage: execError instanceof Error ? execError.message : 'Unknown error' 
          })
          .where(eq(etlJobs.id, job.id));

        return NextResponse.json({
          message: 'File uploaded but load failed',
          jobId: job.id,
          error: execError instanceof Error ? execError.message : 'Unknown error',
        }, { status: 500 });
      }
    }

    // Just return the job info if not auto-loading
    return NextResponse.json({
      message: 'File uploaded successfully. Job created.',
      jobId: job.id,
      targets: targets.map(t => ({ type: t.type, name: t.tableName || t.indexName || t.azureIndexName })),
      status: 'pending',
    });
  } catch (error) {
    console.error('Data load failed:', error);
    return NextResponse.json({ 
      error: 'Failed to process data load',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
