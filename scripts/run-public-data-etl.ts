/**
 * Run Public Data ETL Jobs
 * 
 * Executes all public data ETL jobs and rebuilds the knowledge graph.
 * Run with: npx tsx scripts/run-public-data-etl.ts
 */

import { ETLOrchestrator } from '../src/lib/etl/orchestrator';
import { KnowledgeGraphPipeline } from '../src/lib/graph/kg-pipeline';

// Import agents to ensure they're registered
import '../src/lib/etl/agents';

async function runETL() {
  console.log('='.repeat(60));
  console.log('Running Public Data ETL Jobs');
  console.log('='.repeat(60));

  const results = {
    economicIndicators: null as unknown,
    publicCompanies: null as unknown,
    industryStatistics: null as unknown,
    knowledgeGraph: null as unknown,
  };

  // Run Economic Indicators ETL
  console.log('\n📊 Running Economic Indicators ETL (FRED API)...');
  try {
    results.economicIndicators = await ETLOrchestrator.executeJobDirect({
      jobType: 'economic_indicators',
      name: 'Economic Indicators from FRED',
      sourceConfig: { type: 'api' },
      targetConfig: { table: 'economic_indicators', mode: 'replace' },
    });
    console.log('✅ Economic Indicators:', (results.economicIndicators as { recordsProcessed?: number })?.recordsProcessed || 0, 'records');
  } catch (error) {
    console.error('❌ Economic Indicators ETL failed:', error);
    results.economicIndicators = { error: String(error) };
  }

  // Run Public Companies ETL
  console.log('\n🏢 Running Public Companies ETL (Yahoo Finance)...');
  try {
    results.publicCompanies = await ETLOrchestrator.executeJobDirect({
      jobType: 'public_companies',
      name: 'Public Companies from Yahoo Finance',
      sourceConfig: { type: 'api' },
      targetConfig: { table: 'public_companies', mode: 'upsert' },
    });
    console.log('✅ Public Companies:', (results.publicCompanies as { recordsProcessed?: number })?.recordsProcessed || 0, 'records');
  } catch (error) {
    console.error('❌ Public Companies ETL failed:', error);
    results.publicCompanies = { error: String(error) };
  }

  // Run Industry Statistics ETL
  console.log('\n🏭 Running Industry Statistics ETL (Census Bureau)...');
  try {
    results.industryStatistics = await ETLOrchestrator.executeJobDirect({
      jobType: 'industry_statistics',
      name: 'Industry Statistics from Census Bureau',
      sourceConfig: { type: 'api' },
      targetConfig: { table: 'industry_statistics', mode: 'replace' },
    });
    console.log('✅ Industry Statistics:', (results.industryStatistics as { recordsProcessed?: number })?.recordsProcessed || 0, 'records');
  } catch (error) {
    console.error('❌ Industry Statistics ETL failed:', error);
    results.industryStatistics = { error: String(error) };
  }

  // Rebuild Knowledge Graph
  console.log('\n🔗 Rebuilding Knowledge Graph...');
  try {
    const kgPipeline = new KnowledgeGraphPipeline({ generateEmbeddings: false });
    const kgStats = await kgPipeline.build();
    results.knowledgeGraph = kgStats;
    console.log('✅ Knowledge Graph rebuilt:');
    console.log('   - Nodes:', kgStats.totalNodes);
    console.log('   - Edges:', kgStats.totalEdges);
    console.log('   - Avg connections:', kgStats.avgConnections?.toFixed(2));
  } catch (error) {
    console.error('❌ Knowledge Graph rebuild failed:', error);
    results.knowledgeGraph = { error: String(error) };
  }

  console.log('\n' + '='.repeat(60));
  console.log('ETL Jobs Complete');
  console.log('='.repeat(60));

  return results;
}

runETL()
  .then((results) => {
    console.log('\nFinal Results:');
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error('ETL failed:', error);
    process.exit(1);
  });
