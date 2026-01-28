/**
 * Prompt Library Seeder
 * 
 * Seeds the database with default system prompts for the prompt library.
 * Run with: npx tsx scripts/seed-prompts.ts
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://semanticstudio:semanticstudio@localhost:5433/semanticstudio',
});

// Default system prompts - simple, non-parameterized
const defaultPrompts = [
  // Data & Insights
  {
    title: 'Data Overview',
    content: 'Give me an overview of the available data and what questions I can ask.',
    category: 'general',
    displayOrder: 1,
  },
  {
    title: 'Key Insights',
    content: 'What are the key insights from the data? Highlight anything important or unusual.',
    category: 'general',
    displayOrder: 2,
  },
  {
    title: 'Recent Trends',
    content: 'What are the recent trends? Are things improving or declining?',
    category: 'general',
    displayOrder: 3,
  },
  {
    title: 'Top Performers',
    content: 'What are the top performers? Show me the best results.',
    category: 'general',
    displayOrder: 4,
  },
  {
    title: 'Areas of Concern',
    content: 'Are there any areas of concern or things I should pay attention to?',
    category: 'general',
    displayOrder: 5,
  },
  
  // Analysis
  {
    title: 'Summarize This',
    content: 'Summarize the most important points in a clear, concise format.',
    category: 'general',
    displayOrder: 10,
  },
  {
    title: 'Explain This',
    content: 'Can you explain this in simple terms? Break it down for me.',
    category: 'general',
    displayOrder: 11,
  },
  {
    title: 'What Should I Do?',
    content: 'Based on this information, what actions should I consider taking?',
    category: 'general',
    displayOrder: 12,
  },
  {
    title: 'Deep Dive',
    content: 'Give me a detailed analysis. I want to understand this thoroughly.',
    category: 'general',
    displayOrder: 13,
  },
  {
    title: 'Quick Summary',
    content: 'Give me a quick 3-bullet summary of the key points.',
    category: 'general',
    displayOrder: 14,
  },
];

async function seed() {
  const client = await pool.connect();
  
  try {
    console.log('Starting prompt library seed...');
    
    // Begin transaction
    await client.query('BEGIN');

    // Check if prompts already exist
    const existingResult = await client.query(
      'SELECT COUNT(*) as count FROM prompt_library WHERE is_system = TRUE'
    );
    const existingCount = parseInt(existingResult.rows[0].count, 10);
    
    if (existingCount > 0) {
      console.log(`Found ${existingCount} existing system prompts. Skipping seed.`);
      console.log('To re-seed, first delete existing system prompts:');
      console.log("  DELETE FROM prompt_library WHERE is_system = TRUE AND user_id IS NULL;");
      await client.query('ROLLBACK');
      return;
    }

    // Insert system prompts
    console.log('Seeding system prompts...');
    for (const prompt of defaultPrompts) {
      await client.query(
        `INSERT INTO prompt_library (title, content, category, is_system, display_order)
         VALUES ($1, $2, $3, TRUE, $4)`,
        [prompt.title, prompt.content, prompt.category, prompt.displayOrder]
      );
    }

    // Commit transaction
    await client.query('COMMIT');
    console.log(`Successfully seeded ${defaultPrompts.length} system prompts!`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
