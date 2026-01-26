/**
 * Entity Resolver
 * 
 * Resolves entity mentions in queries to semantic entities.
 * Supports aliases, fuzzy matching, and context-aware resolution.
 */

import { db } from '@/lib/db';
import { semanticEntities, entityAliases } from '@/lib/db/schema';
import { eq, ilike, or } from 'drizzle-orm';
import type { SemanticEntity, ResolvedEntity, SemanticField, EntityRelationship } from './types';

// Cache for entities (5 minute TTL)
let entityCache: Map<string, SemanticEntity> = new Map();
let aliasCache: Map<string, string> = new Map(); // alias -> entity name
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Load all entities and aliases into cache
 */
async function refreshCache(): Promise<void> {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_TTL && entityCache.size > 0) {
    return;
  }

  // Load entities
  const entities = await db.select().from(semanticEntities);
  entityCache = new Map();
  
  for (const entity of entities) {
    const semanticEntity: SemanticEntity = {
      id: entity.id,
      name: entity.name,
      displayName: entity.displayName,
      description: entity.description,
      sourceTable: entity.sourceTable,
      domainAgent: entity.domainAgent,
      fields: (entity.fields as SemanticField[]) || [],
      aliases: (entity.aliases as string[]) || [],
      relationships: (entity.relationships as EntityRelationship[]) || [],
    };
    entityCache.set(entity.name, semanticEntity);
    
    // Add display name as alias
    aliasCache.set(entity.displayName.toLowerCase(), entity.name);
    aliasCache.set(entity.name, entity.name);
    
    // Add configured aliases
    for (const alias of semanticEntity.aliases) {
      aliasCache.set(alias.toLowerCase(), entity.name);
    }
  }

  // Load explicit aliases from entity_aliases table
  const aliases = await db.select().from(entityAliases);
  for (const alias of aliases) {
    const entity = entities.find(e => e.id === alias.entityId);
    if (entity) {
      aliasCache.set(alias.alias.toLowerCase(), entity.name);
    }
  }

  cacheTimestamp = now;
}

/**
 * Get all semantic entities
 */
export async function getAllEntities(): Promise<SemanticEntity[]> {
  await refreshCache();
  return Array.from(entityCache.values());
}

/**
 * Get entity by name
 */
export async function getEntityByName(name: string): Promise<SemanticEntity | null> {
  await refreshCache();
  return entityCache.get(name) || null;
}

/**
 * Resolve entity from alias or name
 */
export async function resolveEntityByAlias(alias: string): Promise<SemanticEntity | null> {
  await refreshCache();
  const entityName = aliasCache.get(alias.toLowerCase());
  if (entityName) {
    return entityCache.get(entityName) || null;
  }
  return null;
}

/**
 * Extract and resolve entities from a query string
 */
export async function extractEntities(query: string): Promise<ResolvedEntity[]> {
  await refreshCache();
  
  const resolved: ResolvedEntity[] = [];
  const lowerQuery = query.toLowerCase();
  const words = lowerQuery.split(/\s+/);

  // Check for exact alias matches
  for (const [alias, entityName] of aliasCache.entries()) {
    if (lowerQuery.includes(alias)) {
      const entity = entityCache.get(entityName);
      if (entity && !resolved.some(r => r.entity.name === entityName)) {
        resolved.push({
          entity,
          matchedAlias: alias,
          confidence: alias === entityName ? 1.0 : 0.95,
          matchType: alias === entityName ? 'exact' : 'alias',
        });
      }
    }
  }

  // Check for partial/fuzzy matches if no exact matches
  if (resolved.length === 0) {
    for (const entity of entityCache.values()) {
      // Check if any word is similar to entity name
      for (const word of words) {
        if (word.length < 3) continue;
        
        // Simple fuzzy match: check if word is contained in entity name or vice versa
        const entityLower = entity.name.toLowerCase();
        const displayLower = entity.displayName.toLowerCase();
        
        if (entityLower.includes(word) || word.includes(entityLower) ||
            displayLower.includes(word) || word.includes(displayLower)) {
          if (!resolved.some(r => r.entity.name === entity.name)) {
            resolved.push({
              entity,
              matchedAlias: word,
              confidence: 0.7,
              matchType: 'fuzzy',
            });
          }
        }
      }
    }
  }

  // Sort by confidence
  resolved.sort((a, b) => b.confidence - a.confidence);

  return resolved;
}

/**
 * Get entities related to a given entity
 */
export async function getRelatedEntities(entityName: string): Promise<SemanticEntity[]> {
  const entity = await getEntityByName(entityName);
  if (!entity) return [];

  const related: SemanticEntity[] = [];
  for (const rel of entity.relationships) {
    const relatedEntity = await getEntityByName(rel.target);
    if (relatedEntity) {
      related.push(relatedEntity);
    }
  }

  return related;
}

/**
 * Get entity by source table
 */
export async function getEntityByTable(tableName: string): Promise<SemanticEntity | null> {
  await refreshCache();
  for (const entity of entityCache.values()) {
    if (entity.sourceTable === tableName) {
      return entity;
    }
  }
  return null;
}

/**
 * Clear the entity cache (force refresh on next call)
 */
export function clearCache(): void {
  entityCache.clear();
  aliasCache.clear();
  cacheTimestamp = 0;
}

/**
 * EntityResolver class for object-oriented usage
 */
export class EntityResolver {
  static async extractEntities(query: string): Promise<ResolvedEntity[]> {
    return extractEntities(query);
  }

  static async getEntity(name: string): Promise<SemanticEntity | null> {
    return getEntityByName(name);
  }

  static async resolveAlias(alias: string): Promise<SemanticEntity | null> {
    return resolveEntityByAlias(alias);
  }

  static async getRelated(entityName: string): Promise<SemanticEntity[]> {
    return getRelatedEntities(entityName);
  }

  static async getAll(): Promise<SemanticEntity[]> {
    return getAllEntities();
  }

  static clearCache(): void {
    clearCache();
  }
}

export default EntityResolver;
