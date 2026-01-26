/**
 * CSV Import Agent
 * 
 * Imports CSV/JSON files into the database with PAR loop for self-correction.
 */

import Papa from 'papaparse';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { BaseETLAgent } from '../base-agent';
import { registerAgent } from '../orchestrator';
import type {
  ETLJobDefinition,
  PARPerception,
  PARAction,
  PARReflection,
  ETLError,
} from '../types';

interface CSVPerception {
  rawData: string;
  parsedData: Record<string, unknown>[];
  headers: string[];
  rowCount: number;
  sampleRows: Record<string, unknown>[];
  detectedTypes: Record<string, string>;
}

export class CSVImportAgent extends BaseETLAgent {
  private fileContent: string = '';

  constructor(jobDefinition: ETLJobDefinition) {
    super(jobDefinition);
  }

  /**
   * Load file content from config
   */
  private async loadFileContent(): Promise<string> {
    const { sourceConfig } = this.jobDefinition;
    
    if (sourceConfig.fileContent) {
      return sourceConfig.fileContent;
    }
    
    if (sourceConfig.filePath) {
      // In a real implementation, this would read from disk or cloud storage
      // For now, we expect the content to be provided directly
      throw new Error('File path loading not implemented - provide fileContent directly');
    }
    
    throw new Error('No file content or path provided');
  }

  /**
   * Detect column types from sample data
   */
  private detectColumnTypes(data: Record<string, unknown>[]): Record<string, string> {
    const types: Record<string, string> = {};
    if (data.length === 0) return types;

    const headers = Object.keys(data[0]);
    for (const header of headers) {
      const values = data.slice(0, 100).map(row => row[header]).filter(v => v != null && v !== '');
      
      if (values.length === 0) {
        types[header] = 'TEXT';
        continue;
      }

      // Check if all values are numbers
      const allNumbers = values.every(v => !isNaN(Number(v)));
      if (allNumbers) {
        // Check if they're integers or decimals
        const hasDecimals = values.some(v => String(v).includes('.'));
        types[header] = hasDecimals ? 'DECIMAL' : 'INTEGER';
        continue;
      }

      // Check if all values are dates
      const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{2}\/\d{2}\/\d{4}/;
      const allDates = values.every(v => datePattern.test(String(v)));
      if (allDates) {
        types[header] = 'DATE';
        continue;
      }

      // Check if all values are booleans
      const boolValues = ['true', 'false', 'yes', 'no', '1', '0'];
      const allBools = values.every(v => boolValues.includes(String(v).toLowerCase()));
      if (allBools) {
        types[header] = 'BOOLEAN';
        continue;
      }

      // Check if UUIDs
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const allUuids = values.every(v => uuidPattern.test(String(v)));
      if (allUuids) {
        types[header] = 'UUID';
        continue;
      }

      // Default to TEXT
      types[header] = 'TEXT';
    }

    return types;
  }

  /**
   * PERCEIVE: Parse CSV and gather metadata
   */
  async perceive(): Promise<PARPerception<CSVPerception>> {
    this.fileContent = await this.loadFileContent();
    
    // Parse CSV
    const parseResult = Papa.parse<Record<string, unknown>>(this.fileContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    const data = parseResult.data;
    const headers = parseResult.meta.fields || [];
    const detectedTypes = this.detectColumnTypes(data);

    return {
      data: {
        rawData: this.fileContent,
        parsedData: data,
        headers,
        rowCount: data.length,
        sampleRows: data.slice(0, 5),
        detectedTypes,
      },
      context: {
        targetTable: this.jobDefinition.targetConfig.table,
        mode: this.jobDefinition.targetConfig.mode,
      },
      iteration: 0,
    };
  }

  /**
   * ACT: Insert data into database
   */
  async act(perception: PARPerception<CSVPerception>): Promise<PARAction> {
    const startTime = Date.now();
    const errors: ETLError[] = [];
    let recordsProcessed = 0;
    let recordsFailed = 0;

    const { parsedData, headers, detectedTypes } = perception.data as CSVPerception;
    const { targetConfig } = this.jobDefinition;
    const tableName = targetConfig.table;

    try {
      // Create table if it doesn't exist (dynamic schema)
      const columnDefs = headers.map(h => {
        const sqlType = detectedTypes[h] || 'TEXT';
        const safeColName = this.sanitizeColumnName(h);
        return `${safeColName} ${sqlType === 'DECIMAL' ? 'DECIMAL(15,2)' : sqlType}`;
      }).join(', ');

      await db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          _id SERIAL PRIMARY KEY,
          ${columnDefs},
          _imported_at TIMESTAMPTZ DEFAULT NOW()
        )
      `));

      // Clear table if replace mode
      if (targetConfig.mode === 'replace') {
        await db.execute(sql.raw(`TRUNCATE TABLE ${tableName}`));
      }

      // Insert data in batches
      const batchSize = 100;
      for (let i = 0; i < parsedData.length; i += batchSize) {
        const batch = parsedData.slice(i, i + batchSize);
        
        try {
          for (const row of batch) {
            const columns = headers.map(h => this.sanitizeColumnName(h));
            const values = headers.map(h => {
              const val = row[h];
              if (val === null || val === undefined || val === '') return 'NULL';
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
              return val;
            });

            const insertSql = `
              INSERT INTO ${tableName} (${columns.join(', ')})
              VALUES (${values.join(', ')})
            `;
            
            await db.execute(sql.raw(insertSql));
            recordsProcessed++;
          }
        } catch (batchError) {
          recordsFailed += batch.length;
          errors.push({
            code: 'BATCH_INSERT_ERROR',
            message: batchError instanceof Error ? batchError.message : 'Unknown error',
            row: i,
          });
        }
      }
    } catch (error) {
      errors.push({
        code: 'IMPORT_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return {
      result: {
        tableName,
        recordsProcessed,
        recordsFailed,
      },
      metrics: {
        recordsProcessed,
        recordsFailed,
        duration: Date.now() - startTime,
      },
      errors,
    };
  }

  /**
   * REFLECT: Evaluate import quality and determine if retry needed
   */
  async reflect(action: PARAction, perception: PARPerception<CSVPerception>): Promise<PARReflection> {
    const { rowCount } = perception.data as CSVPerception;
    const { recordsProcessed, recordsFailed } = action.metrics;
    const improvements: string[] = [];

    // Calculate success rate
    const successRate = rowCount > 0 ? recordsProcessed / rowCount : 0;

    // Check for errors
    if (action.errors.length > 0) {
      improvements.push(`Encountered ${action.errors.length} errors during import`);
    }

    // Determine if successful
    const success = successRate >= 0.95 && action.errors.length === 0;
    const retry = !success && perception.iteration < 2 && successRate < 0.8;

    // Generate lessons learned
    let lessonsLearned: string | undefined;
    if (success) {
      lessonsLearned = `Successfully imported ${recordsProcessed} records with ${successRate * 100}% success rate`;
    } else if (action.errors.length > 0) {
      lessonsLearned = `Import failed with errors: ${action.errors.map(e => e.message).join('; ')}`;
    }

    // Determine adjustments for retry
    let adjustment: unknown;
    if (retry) {
      // Could adjust batch size, add error handling, etc.
      adjustment = {
        batchSize: 50, // Reduce batch size
        skipErrors: true,
      };
      improvements.push('Reducing batch size for retry');
    }

    return {
      success,
      retry,
      confidence: successRate,
      adjustment,
      improvements,
      lessonsLearned,
    };
  }

  /**
   * Sanitize column name for SQL
   */
  private sanitizeColumnName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
  }
}

// Register the agent
registerAgent('csv_import', CSVImportAgent);

export default CSVImportAgent;
