/**
 * JSON Import Agent
 * 
 * Imports JSON files/data into the database with PAR loop for self-correction.
 */

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

interface JSONPerception {
  rawData: string;
  parsedData: Record<string, unknown>[];
  fields: string[];
  rowCount: number;
  sampleRows: Record<string, unknown>[];
  isArray: boolean;
  nestedPaths: string[];
}

export class JSONImportAgent extends BaseETLAgent {
  constructor(jobDefinition: ETLJobDefinition) {
    super(jobDefinition);
  }

  /**
   * Flatten nested objects to dot-notation keys
   */
  private flattenObject(
    obj: Record<string, unknown>,
    prefix: string = ''
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}_${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        Object.assign(result, this.flattenObject(value as Record<string, unknown>, newKey));
      } else if (Array.isArray(value)) {
        // Store arrays as JSON strings
        result[newKey] = JSON.stringify(value);
      } else {
        result[newKey] = value;
      }
    }

    return result;
  }

  /**
   * Detect column types from sample data
   */
  private detectColumnTypes(data: Record<string, unknown>[]): Record<string, string> {
    const types: Record<string, string> = {};
    if (data.length === 0) return types;

    const allKeys = new Set<string>();
    data.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));

    for (const key of allKeys) {
      const values = data.slice(0, 100).map(row => row[key]).filter(v => v != null);

      if (values.length === 0) {
        types[key] = 'TEXT';
        continue;
      }

      const firstVal = values[0];
      
      if (typeof firstVal === 'number') {
        const hasDecimals = values.some(v => String(v).includes('.'));
        types[key] = hasDecimals ? 'DECIMAL(15,2)' : 'INTEGER';
      } else if (typeof firstVal === 'boolean') {
        types[key] = 'BOOLEAN';
      } else if (typeof firstVal === 'string') {
        // Check for dates
        const datePattern = /^\d{4}-\d{2}-\d{2}(T|$)/;
        const allDates = values.every(v => datePattern.test(String(v)));
        if (allDates) {
          types[key] = 'TIMESTAMPTZ';
        } else {
          types[key] = 'TEXT';
        }
      } else {
        types[key] = 'JSONB';
      }
    }

    return types;
  }

  /**
   * PERCEIVE: Parse JSON and gather metadata
   */
  async perceive(): Promise<PARPerception<JSONPerception>> {
    const { sourceConfig } = this.jobDefinition;
    let rawData = '';
    let parsed: unknown;

    if (sourceConfig.fileContent) {
      rawData = sourceConfig.fileContent;
      parsed = JSON.parse(rawData);
    } else {
      throw new Error('No JSON content provided');
    }

    // Normalize to array of objects
    let dataArray: Record<string, unknown>[];
    let isArray = true;
    const nestedPaths: string[] = [];

    if (Array.isArray(parsed)) {
      dataArray = parsed as Record<string, unknown>[];
    } else if (typeof parsed === 'object' && parsed !== null) {
      // Check for nested array property
      const obj = parsed as Record<string, unknown>;
      const arrayKey = Object.keys(obj).find(k => Array.isArray(obj[k]));
      if (arrayKey) {
        nestedPaths.push(arrayKey);
        dataArray = obj[arrayKey] as Record<string, unknown>[];
      } else {
        isArray = false;
        dataArray = [obj];
      }
    } else {
      throw new Error('JSON must be an object or array');
    }

    // Flatten nested objects
    const flattenedData = dataArray.map(row => this.flattenObject(row));

    // Get all unique fields
    const fieldsSet = new Set<string>();
    flattenedData.forEach(row => Object.keys(row).forEach(k => fieldsSet.add(k)));
    const fields = Array.from(fieldsSet);

    return {
      data: {
        rawData,
        parsedData: flattenedData,
        fields,
        rowCount: flattenedData.length,
        sampleRows: flattenedData.slice(0, 5),
        isArray,
        nestedPaths,
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
  async act(perception: PARPerception<JSONPerception>): Promise<PARAction> {
    const startTime = Date.now();
    const errors: ETLError[] = [];
    let recordsProcessed = 0;
    let recordsFailed = 0;

    const { parsedData, fields } = perception.data as JSONPerception;
    const { targetConfig } = this.jobDefinition;
    const tableName = targetConfig.table;

    try {
      const detectedTypes = this.detectColumnTypes(parsedData);

      // Create table if it doesn't exist
      const columnDefs = fields.map(f => {
        const sqlType = detectedTypes[f] || 'TEXT';
        const safeColName = this.sanitizeColumnName(f);
        return `${safeColName} ${sqlType}`;
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

      // Insert data
      for (let i = 0; i < parsedData.length; i++) {
        const row = parsedData[i];
        
        try {
          const columns = fields.map(f => this.sanitizeColumnName(f));
          const values = fields.map(f => {
            const val = row[f];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            return val;
          });

          const insertSql = `
            INSERT INTO ${tableName} (${columns.join(', ')})
            VALUES (${values.join(', ')})
          `;
          
          await db.execute(sql.raw(insertSql));
          recordsProcessed++;
        } catch (rowError) {
          recordsFailed++;
          errors.push({
            code: 'ROW_INSERT_ERROR',
            message: rowError instanceof Error ? rowError.message : 'Unknown error',
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
   * REFLECT: Evaluate import quality
   */
  async reflect(action: PARAction, perception: PARPerception<JSONPerception>): Promise<PARReflection> {
    const { rowCount } = perception.data as JSONPerception;
    const { recordsProcessed, recordsFailed } = action.metrics;
    const improvements: string[] = [];

    const successRate = rowCount > 0 ? recordsProcessed / rowCount : 0;

    if (action.errors.length > 0) {
      improvements.push(`Encountered ${action.errors.length} errors during import`);
    }

    const success = successRate >= 0.95 && action.errors.length === 0;
    const retry = !success && perception.iteration < 2 && successRate < 0.8;

    let lessonsLearned: string | undefined;
    if (success) {
      lessonsLearned = `Successfully imported ${recordsProcessed} JSON records`;
    } else if (action.errors.length > 0) {
      lessonsLearned = `Import issues: ${action.errors.slice(0, 3).map(e => e.message).join('; ')}`;
    }

    return {
      success,
      retry,
      confidence: successRate,
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
registerAgent('json_import', JSONImportAgent);

export default JSONImportAgent;
