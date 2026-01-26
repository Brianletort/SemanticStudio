/**
 * Schema Registry
 * 
 * Maintains metadata about database tables and their relationships.
 * Used for query generation and data exploration.
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import type {
  SchemaDefinition,
  TableDefinition,
  TableRelationship,
  ColumnInfo,
  DataCatalogEntry,
} from './types';

// Cache for schema information
let schemaCache: SchemaDefinition | null = null;
let catalogCache: Map<string, DataCatalogEntry> = new Map();
let schemaCacheTimestamp = 0;
const SCHEMA_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Get column information for a table
 */
async function getTableColumns(tableName: string): Promise<ColumnInfo[]> {
  const result = await db.execute(sql.raw(`
    SELECT 
      c.column_name,
      c.data_type,
      c.is_nullable,
      c.column_default,
      CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
      fk.foreign_table_name,
      fk.foreign_column_name
    FROM information_schema.columns c
    LEFT JOIN (
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = '${tableName}'
        AND tc.constraint_type = 'PRIMARY KEY'
    ) pk ON c.column_name = pk.column_name
    LEFT JOIN (
      SELECT
        kcu.column_name,
        ccu.table_name as foreign_table_name,
        ccu.column_name as foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = '${tableName}'
        AND tc.constraint_type = 'FOREIGN KEY'
    ) fk ON c.column_name = fk.column_name
    WHERE c.table_name = '${tableName}'
      AND c.table_schema = 'public'
    ORDER BY c.ordinal_position
  `));

  return (result.rows as Array<Record<string, unknown>>).map(row => ({
    name: row.column_name as string,
    dataType: row.data_type as string,
    isNullable: row.is_nullable === 'YES',
    defaultValue: row.column_default,
    isPrimaryKey: row.is_primary_key as boolean,
    foreignKeyRef: row.foreign_table_name ? {
      table: row.foreign_table_name as string,
      column: row.foreign_column_name as string,
    } : undefined,
  }));
}

/**
 * Get all table relationships in the database
 */
async function getTableRelationships(): Promise<TableRelationship[]> {
  const result = await db.execute(sql.raw(`
    SELECT
      kcu.table_name as from_table,
      kcu.column_name as from_column,
      ccu.table_name as to_table,
      ccu.column_name as to_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  `));

  return (result.rows as Array<Record<string, unknown>>).map(row => ({
    fromTable: row.from_table as string,
    fromColumn: row.from_column as string,
    toTable: row.to_table as string,
    toColumn: row.to_column as string,
    type: 'one-to-many' as const, // Default assumption
  }));
}

/**
 * Get all tables in the database
 */
async function getAllTables(): Promise<string[]> {
  const result = await db.execute(sql.raw(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `));

  return (result.rows as Array<{ table_name: string }>).map(row => row.table_name);
}

/**
 * Get row count for a table
 */
async function getTableRowCount(tableName: string): Promise<number> {
  try {
    const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${tableName}`));
    return parseInt((result.rows as Array<{ count: string }>)[0]?.count || '0', 10);
  } catch {
    return 0;
  }
}

/**
 * Refresh schema cache
 */
async function refreshSchemaCache(): Promise<void> {
  const now = Date.now();
  if (now - schemaCacheTimestamp < SCHEMA_CACHE_TTL && schemaCache) {
    return;
  }

  const tables = await getAllTables();
  const tableDefinitions: TableDefinition[] = [];

  for (const tableName of tables) {
    const columns = await getTableColumns(tableName);
    const primaryKey = columns.filter(c => c.isPrimaryKey).map(c => c.name);
    
    tableDefinitions.push({
      name: tableName,
      columns,
      primaryKey,
      indexes: [], // Could fetch from pg_indexes if needed
    });
  }

  const relationships = await getTableRelationships();

  schemaCache = {
    tables: tableDefinitions,
    relationships,
  };
  schemaCacheTimestamp = now;
}

/**
 * Get full schema definition
 */
export async function getSchema(): Promise<SchemaDefinition> {
  await refreshSchemaCache();
  return schemaCache!;
}

/**
 * Get table definition by name
 */
export async function getTableDefinition(tableName: string): Promise<TableDefinition | null> {
  await refreshSchemaCache();
  return schemaCache!.tables.find(t => t.name === tableName) || null;
}

/**
 * Get relationships for a table
 */
export async function getTableRelationshipsFor(tableName: string): Promise<TableRelationship[]> {
  await refreshSchemaCache();
  return schemaCache!.relationships.filter(
    r => r.fromTable === tableName || r.toTable === tableName
  );
}

/**
 * Get data catalog entry for a table
 */
export async function getCatalogEntry(tableName: string): Promise<DataCatalogEntry | null> {
  // Check cache
  if (catalogCache.has(tableName)) {
    return catalogCache.get(tableName)!;
  }

  const tableDef = await getTableDefinition(tableName);
  if (!tableDef) return null;

  const rowCount = await getTableRowCount(tableName);

  const entry: DataCatalogEntry = {
    tableName,
    schema: 'public',
    rowCount,
    columns: tableDef.columns,
    lastUpdated: new Date(),
  };

  catalogCache.set(tableName, entry);
  return entry;
}

/**
 * Get all catalog entries
 */
export async function getFullCatalog(): Promise<DataCatalogEntry[]> {
  await refreshSchemaCache();
  const entries: DataCatalogEntry[] = [];

  for (const table of schemaCache!.tables) {
    const entry = await getCatalogEntry(table.name);
    if (entry) entries.push(entry);
  }

  return entries;
}

/**
 * Find tables with a specific column
 */
export async function findTablesWithColumn(columnName: string): Promise<string[]> {
  await refreshSchemaCache();
  return schemaCache!.tables
    .filter(t => t.columns.some(c => c.name === columnName))
    .map(t => t.name);
}

/**
 * Get join path between two tables
 */
export async function getJoinPath(
  fromTable: string,
  toTable: string
): Promise<TableRelationship[] | null> {
  await refreshSchemaCache();
  
  // Simple BFS to find path
  const visited = new Set<string>();
  const queue: Array<{ table: string; path: TableRelationship[] }> = [
    { table: fromTable, path: [] }
  ];

  while (queue.length > 0) {
    const { table, path } = queue.shift()!;
    
    if (table === toTable) {
      return path;
    }

    if (visited.has(table)) continue;
    visited.add(table);

    // Find all relationships from this table
    const rels = schemaCache!.relationships.filter(
      r => r.fromTable === table || r.toTable === table
    );

    for (const rel of rels) {
      const nextTable = rel.fromTable === table ? rel.toTable : rel.fromTable;
      if (!visited.has(nextTable)) {
        queue.push({
          table: nextTable,
          path: [...path, rel],
        });
      }
    }
  }

  return null; // No path found
}

/**
 * Generate SQL query for entity with relationships
 */
export async function generateJoinQuery(
  mainTable: string,
  relatedTables: string[],
  selectColumns?: string[]
): Promise<string> {
  const columns = selectColumns?.join(', ') || '*';
  let query = `SELECT ${columns} FROM ${mainTable}`;

  for (const relatedTable of relatedTables) {
    const path = await getJoinPath(mainTable, relatedTable);
    if (path && path.length > 0) {
      for (const rel of path) {
        query += `\n  LEFT JOIN ${rel.toTable} ON ${rel.fromTable}.${rel.fromColumn} = ${rel.toTable}.${rel.toColumn}`;
      }
    }
  }

  return query;
}

/**
 * Clear schema cache
 */
export function clearSchemaCache(): void {
  schemaCache = null;
  catalogCache.clear();
  schemaCacheTimestamp = 0;
}

/**
 * SchemaRegistry class for object-oriented usage
 */
export class SchemaRegistry {
  static async getSchema(): Promise<SchemaDefinition> {
    return getSchema();
  }

  static async getTable(name: string): Promise<TableDefinition | null> {
    return getTableDefinition(name);
  }

  static async getRelationships(tableName: string): Promise<TableRelationship[]> {
    return getTableRelationshipsFor(tableName);
  }

  static async getCatalog(): Promise<DataCatalogEntry[]> {
    return getFullCatalog();
  }

  static async getJoinPath(from: string, to: string): Promise<TableRelationship[] | null> {
    return getJoinPath(from, to);
  }

  static clearCache(): void {
    clearSchemaCache();
  }
}

export default SchemaRegistry;
