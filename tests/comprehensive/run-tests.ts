#!/usr/bin/env npx ts-node
/**
 * Comprehensive Test Runner
 * 
 * Entry point for running the PAR loop test system.
 * 
 * Usage:
 *   npx ts-node tests/comprehensive/run-tests.ts
 *   npx ts-node tests/comprehensive/run-tests.ts --category=modes
 *   npx ts-node tests/comprehensive/run-tests.ts --par-loops=5
 *   npx ts-node tests/comprehensive/run-tests.ts --report
 */

import { createTestRunner, PARLoopConfig } from './framework';
import { modeTestScenarios } from './scenarios/mode-tests';
import { memoryTestScenarios } from './scenarios/memory-tests';
import { samplePrompts } from './fixtures/sample-prompts';
import { edgeCaseGenerator } from './framework/edge-case-generator';
import * as fs from 'fs';
import * as path from 'path';

// Parse command line arguments
function parseArgs(): {
  category?: string;
  parLoops: number;
  report: boolean;
  verbose: boolean;
} {
  const args = process.argv.slice(2);
  const result = {
    category: undefined as string | undefined,
    parLoops: 10,
    report: false,
    verbose: true,
  };
  
  for (const arg of args) {
    if (arg.startsWith('--category=')) {
      result.category = arg.split('=')[1];
    } else if (arg.startsWith('--par-loops=')) {
      result.parLoops = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--report') {
      result.report = true;
    } else if (arg === '--quiet') {
      result.verbose = false;
    }
  }
  
  return result;
}

// Get scenarios based on category filter
function getScenarios(category?: string) {
  const allScenarios = [
    ...modeTestScenarios,
    ...memoryTestScenarios,
  ];
  
  if (category) {
    return allScenarios.filter(s => s.category === category);
  }
  
  return allScenarios;
}

// Generate report file
function generateReport(history: unknown[], outputPath: string) {
  const report = {
    generatedAt: new Date().toISOString(),
    totalIterations: history.length,
    history,
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to: ${outputPath}`);
}

// Main entry point
async function main() {
  const args = parseArgs();
  
  console.log('\n🧪 AgentKit Comprehensive Test Suite\n');
  console.log('Configuration:');
  console.log(`  Category: ${args.category || 'all'}`);
  console.log(`  PAR Loops: ${args.parLoops}`);
  console.log(`  Report: ${args.report}`);
  console.log(`  Verbose: ${args.verbose}`);
  
  // Configure test runner
  const config: Partial<PARLoopConfig> = {
    maxIterations: args.parLoops,
    verbose: args.verbose,
    generateEdgeCases: true,
    timeout: 30000,
  };
  
  // Create runner and add scenarios
  const runner = createTestRunner(config);
  const scenarios = getScenarios(args.category);
  
  console.log(`\n📋 Loaded ${scenarios.length} test scenarios`);
  
  if (scenarios.length === 0) {
    console.log('⚠️  No scenarios to run. Check category filter.');
    process.exit(1);
  }
  
  runner.addScenarios(scenarios);
  
  // Generate edge cases from sample prompts
  const promptEdgeCases = edgeCaseGenerator.generateFromPromptPatterns(samplePrompts);
  console.log(`📋 Generated ${promptEdgeCases.length} edge cases from prompts`);
  
  // Run the PAR loop
  console.log('\n🚀 Starting PAR loop...\n');
  
  try {
    const history = await runner.runLoop();
    
    // Generate report if requested
    if (args.report) {
      const reportDir = path.join(__dirname, 'reports');
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportPath = path.join(reportDir, `test-report-${timestamp}.json`);
      generateReport(history, reportPath);
    }
    
    // Exit with appropriate code
    const lastReport = history[history.length - 1];
    const hasFailures = lastReport?.summary?.failed > 0;
    process.exit(hasFailures ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ Test run failed:', error);
    process.exit(1);
  }
}

// Run
main();
