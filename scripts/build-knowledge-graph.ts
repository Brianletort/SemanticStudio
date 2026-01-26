/**
 * Build Knowledge Graph
 * 
 * Run with: npx tsx scripts/build-knowledge-graph.ts
 */

import { KnowledgeGraphPipeline } from '../src/lib/graph/kg-pipeline';

async function main() {
  console.log('Building Knowledge Graph...\n');
  
  const pipeline = new KnowledgeGraphPipeline({ generateEmbeddings: false });
  
  try {
    const stats = await pipeline.build();
    
    console.log('\n=== Knowledge Graph Build Complete ===');
    console.log(`Total Nodes: ${stats.totalNodes}`);
    console.log(`Total Edges: ${stats.totalEdges}`);
    console.log(`Avg Connections: ${stats.avgConnections.toFixed(2)}`);
    
    console.log('\nNodes by Type:');
    for (const [type, count] of Object.entries(stats.nodesByType)) {
      console.log(`  ${type}: ${count}`);
    }
    
    console.log('\nEdges by Type:');
    for (const [type, count] of Object.entries(stats.edgesByType)) {
      console.log(`  ${type}: ${count}`);
    }
  } catch (error) {
    console.error('Failed to build knowledge graph:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
