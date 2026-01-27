/**
 * Script to fix the memory_extractor model configuration
 * 
 * Run with: npx tsx scripts/fix-memory-extractor.ts
 */

import { db } from '../src/lib/db';
import { modelConfigs } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function fixMemoryExtractor() {
  console.log('Updating memory_extractor model to gpt-4o-mini...');
  
  try {
    // Update the model config
    const result = await db
      .update(modelConfigs)
      .set({ 
        modelName: 'gpt-4o-mini',
        updatedAt: new Date(),
      })
      .where(eq(modelConfigs.role, 'memory_extractor'))
      .returning();

    if (result.length > 0) {
      console.log('✅ Updated memory_extractor:', result[0]);
    } else {
      console.log('⚠️ No memory_extractor config found in DB, inserting...');
      
      const inserted = await db
        .insert(modelConfigs)
        .values({
          role: 'memory_extractor',
          provider: 'openai',
          modelName: 'gpt-4o-mini',
          config: { temperature: 0.3, maxTokens: 1024 },
        })
        .returning();
      
      console.log('✅ Inserted memory_extractor:', inserted[0]);
    }

    // Verify the update
    const verify = await db
      .select()
      .from(modelConfigs)
      .where(eq(modelConfigs.role, 'memory_extractor'))
      .limit(1);

    console.log('\nCurrent memory_extractor config:');
    console.log(verify[0]);

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to update:', error);
    process.exit(1);
  }
}

fixMemoryExtractor();
