import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { etlJobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ETLOrchestrator } from '@/lib/etl';
// Import agents to register them
import '@/lib/etl/agents';

// POST /api/etl/upload - Upload a CSV/JSON file and optionally trigger import
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const targetTable = formData.get('targetTable') as string | null;
    const autoImport = formData.get('autoImport') === 'true';
    const mode = (formData.get('mode') as string) || 'insert';

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
    
    // Validate content
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

    // Generate table name if not provided
    const tableName = targetTable || 
      `import_${file.name.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}`;

    // Create ETL job definition
    const jobType = isCSV ? 'csv_import' : 'json_import';
    const jobDefinition = {
      jobType,
      name: `Import ${file.name}`,
      sourceConfig: {
        type: isCSV ? 'csv' : 'json',
        fileContent,
        filePath: file.name,
      },
      targetConfig: {
        table: tableName,
        mode: mode as 'insert' | 'upsert' | 'replace',
      },
    };

    // Create the job in database
    const [job] = await db.insert(etlJobs).values({
      jobType,
      status: 'pending',
      config: jobDefinition as unknown as Record<string, unknown>,
    }).returning();

    // If auto-import is enabled, execute immediately
    if (autoImport) {
      try {
        const result = await ETLOrchestrator.executeJobDirect(jobDefinition as any);
        
        return NextResponse.json({
          message: 'File uploaded and imported successfully',
          jobId: job.id,
          runId: result.runId,
          status: result.status,
          targetTable: tableName,
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
          message: 'File uploaded but import failed',
          jobId: job.id,
          error: execError instanceof Error ? execError.message : 'Unknown error',
        }, { status: 500 });
      }
    }

    // Just return the job info if not auto-importing
    return NextResponse.json({
      message: 'File uploaded successfully. Job created.',
      jobId: job.id,
      targetTable: tableName,
      jobType,
      status: 'pending',
    });
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json({ 
      error: 'Failed to process upload',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
