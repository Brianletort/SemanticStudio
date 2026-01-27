import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgres://agentkit:agentkit@localhost:5433/agentkit';

// Main pool for drizzle ORM operations
const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const db = drizzle(pool, { schema });

// Dedicated pool for memory operations (separate from drizzle to avoid connection issues)
const memoryPool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 5000,
});

// Export memory pool for direct SQL queries
export const pgPool = memoryPool;

export * from './schema';
