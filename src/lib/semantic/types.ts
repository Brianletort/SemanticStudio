/**
 * Semantic Layer Types
 * 
 * Types for the semantic data abstraction layer.
 */

// Semantic Entity - represents a business entity type
export interface SemanticEntity {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  sourceTable: string;
  domainAgent: string | null;
  fields: SemanticField[];
  aliases: string[];
  relationships: EntityRelationship[];
}

// Field definition within an entity
export interface SemanticField {
  name: string;
  type: 'text' | 'integer' | 'decimal' | 'boolean' | 'date' | 'timestamp' | 'uuid' | 'jsonb';
  description?: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  foreignKeyTarget?: string;
  isSearchable?: boolean;
  isFilterable?: boolean;
}

// Relationship between entities
export interface EntityRelationship {
  target: string; // Target entity name
  type: string; // Relationship type (e.g., "HAS_MANY", "BELONGS_TO")
  foreignKey?: string;
  description?: string;
}

// Resolved entity from a query
export interface ResolvedEntity {
  entity: SemanticEntity;
  matchedAlias: string;
  confidence: number;
  matchType: 'exact' | 'alias' | 'fuzzy';
}

// Query context with resolved entities
export interface QueryContext {
  originalQuery: string;
  entities: ResolvedEntity[];
  fields: string[];
  filters: QueryFilter[];
  relationships: string[];
}

// Filter extracted from query
export interface QueryFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'like' | 'in' | 'is_null' | 'is_not_null';
  value: unknown;
}

// Data catalog entry
export interface DataCatalogEntry {
  tableName: string;
  schema: string;
  rowCount: number;
  columns: ColumnInfo[];
  lastUpdated: Date;
  semanticEntity?: string;
}

// Column metadata
export interface ColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  defaultValue: unknown;
  isPrimaryKey: boolean;
  foreignKeyRef?: {
    table: string;
    column: string;
  };
}

// Schema registry types
export interface SchemaDefinition {
  tables: TableDefinition[];
  relationships: TableRelationship[];
}

export interface TableDefinition {
  name: string;
  columns: ColumnInfo[];
  primaryKey: string[];
  indexes: string[];
}

export interface TableRelationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}
