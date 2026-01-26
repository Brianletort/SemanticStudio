/**
 * PAR Loop Test Runner
 * 
 * Plan-Act-Review pattern for comprehensive testing:
 * 1. Plan: Generate test plan based on scenarios
 * 2. Act: Execute tests and collect results
 * 3. Review: Analyze results, find issues, generate edge cases
 * 
 * The runner iterates until no new issues are found or max iterations reached.
 */

import { TestScenario, TestResult, EdgeCase, TestPlan, TestReport } from './types';
import { assertions } from './assertions';
import { edgeCaseGenerator } from './edge-case-generator';

export interface PARLoopConfig {
  maxIterations: number;
  stopOnFirstFailure: boolean;
  generateEdgeCases: boolean;
  verbose: boolean;
  timeout: number;  // Per-test timeout in ms
}

export const DEFAULT_PAR_CONFIG: PARLoopConfig = {
  maxIterations: 10,
  stopOnFirstFailure: false,
  generateEdgeCases: true,
  verbose: true,
  timeout: 30000,
};

export class PARTestRunner {
  private config: PARLoopConfig;
  private scenarios: TestScenario[] = [];
  private discoveredEdgeCases: EdgeCase[] = [];
  private testHistory: TestReport[] = [];
  
  constructor(config: Partial<PARLoopConfig> = {}) {
    this.config = { ...DEFAULT_PAR_CONFIG, ...config };
  }
  
  /**
   * Add test scenarios
   */
  addScenarios(scenarios: TestScenario[]): void {
    this.scenarios.push(...scenarios);
  }
  
  /**
   * Run the PAR loop
   */
  async runLoop(): Promise<TestReport[]> {
    console.log('\n========================================');
    console.log('  PAR Loop Test Runner');
    console.log('========================================\n');
    
    for (let iteration = 1; iteration <= this.config.maxIterations; iteration++) {
      console.log(`\n--- Iteration ${iteration}/${this.config.maxIterations} ---\n`);
      
      // PLAN: Generate test plan
      const plan = this.generateTestPlan(iteration);
      console.log(`Plan: ${plan.scenarios.length} scenarios, ${plan.edgeCases.length} edge cases`);
      
      // ACT: Execute tests
      const results = await this.executeTests(plan);
      console.log(`Act: ${results.filter(r => r.passed).length}/${results.length} passed`);
      
      // REVIEW: Analyze and generate edge cases
      const { issues, newEdgeCases } = this.reviewResults(results);
      console.log(`Review: ${issues.length} issues, ${newEdgeCases.length} new edge cases`);
      
      // Store report
      const report: TestReport = {
        iteration,
        timestamp: new Date().toISOString(),
        plan,
        results,
        issues,
        newEdgeCases,
        summary: {
          total: results.length,
          passed: results.filter(r => r.passed).length,
          failed: results.filter(r => !r.passed).length,
          duration: results.reduce((sum, r) => sum + r.durationMs, 0),
        },
      };
      this.testHistory.push(report);
      
      // Add new edge cases for next iteration
      if (this.config.generateEdgeCases && newEdgeCases.length > 0) {
        this.discoveredEdgeCases.push(...newEdgeCases);
      }
      
      // Stop if no issues found
      if (issues.length === 0) {
        console.log('\n✅ No issues found. Stopping PAR loop.\n');
        break;
      }
      
      // Stop on first failure if configured
      if (this.config.stopOnFirstFailure && issues.length > 0) {
        console.log('\n⚠️  Stopping on first failure.\n');
        break;
      }
    }
    
    this.printFinalSummary();
    return this.testHistory;
  }
  
  /**
   * PLAN phase: Generate test plan for this iteration
   */
  private generateTestPlan(iteration: number): TestPlan {
    const scenarios: TestScenario[] = [];
    const edgeCases: EdgeCase[] = [];
    
    // First iteration: run all base scenarios
    if (iteration === 1) {
      scenarios.push(...this.scenarios);
    } else {
      // Subsequent iterations: focus on failed scenarios + edge cases
      const lastReport = this.testHistory[this.testHistory.length - 1];
      
      // Re-run failed scenarios
      const failedIds = new Set(
        lastReport.results
          .filter(r => !r.passed)
          .map(r => r.scenarioId)
      );
      scenarios.push(
        ...this.scenarios.filter(s => failedIds.has(s.id))
      );
      
      // Add discovered edge cases
      edgeCases.push(...this.discoveredEdgeCases);
    }
    
    return {
      iteration,
      scenarios,
      edgeCases,
      generatedAt: new Date().toISOString(),
    };
  }
  
  /**
   * ACT phase: Execute all tests in the plan
   */
  private async executeTests(plan: TestPlan): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    // Execute scenarios
    for (const scenario of plan.scenarios) {
      const result = await this.executeScenario(scenario);
      results.push(result);
      
      if (this.config.verbose) {
        const status = result.passed ? '✓' : '✗';
        console.log(`  ${status} ${scenario.name} (${result.durationMs}ms)`);
      }
    }
    
    // Execute edge cases as scenarios
    for (const edgeCase of plan.edgeCases) {
      const scenario = this.edgeCaseToScenario(edgeCase);
      const result = await this.executeScenario(scenario);
      results.push(result);
      
      if (this.config.verbose) {
        const status = result.passed ? '✓' : '✗';
        console.log(`  ${status} [EDGE] ${scenario.name} (${result.durationMs}ms)`);
      }
    }
    
    return results;
  }
  
  /**
   * Execute a single test scenario
   */
  private async executeScenario(scenario: TestScenario): Promise<TestResult> {
    const startTime = Date.now();
    let passed = true;
    let error: string | undefined;
    const assertionResults: Array<{ assertion: string; passed: boolean; message: string }> = [];
    
    try {
      // Execute test steps
      const context = await this.runTestSteps(scenario);
      
      // Run assertions
      for (const assertion of scenario.assertions) {
        const result = await assertions.evaluate(assertion, context);
        assertionResults.push(result);
        if (!result.passed) {
          passed = false;
        }
      }
    } catch (e) {
      passed = false;
      error = e instanceof Error ? e.message : String(e);
    }
    
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      passed,
      error,
      assertionResults,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * Run test steps and return context
   */
  private async runTestSteps(scenario: TestScenario): Promise<Record<string, unknown>> {
    const context: Record<string, unknown> = {
      scenario,
      steps: [],
    };
    
    for (const step of scenario.steps) {
      const stepResult = await this.executeStep(step, context);
      (context.steps as unknown[]).push(stepResult);
      
      // Add step outputs to context
      if (stepResult.output) {
        Object.assign(context, stepResult.output);
      }
    }
    
    return context;
  }
  
  /**
   * Execute a single test step
   */
  private async executeStep(
    step: TestScenario['steps'][0],
    context: Record<string, unknown>
  ): Promise<{ stepId: string; success: boolean; output?: Record<string, unknown> }> {
    // TODO: Implement actual step execution (API calls, UI interactions, etc.)
    // For now, return placeholder
    return {
      stepId: step.id,
      success: true,
      output: {},
    };
  }
  
  /**
   * REVIEW phase: Analyze results and generate edge cases
   */
  private reviewResults(results: TestResult[]): {
    issues: Array<{ scenarioId: string; issue: string; severity: 'low' | 'medium' | 'high' }>;
    newEdgeCases: EdgeCase[];
  } {
    const issues: Array<{ scenarioId: string; issue: string; severity: 'low' | 'medium' | 'high' }> = [];
    const newEdgeCases: EdgeCase[] = [];
    
    for (const result of results) {
      if (!result.passed) {
        // Record issue
        issues.push({
          scenarioId: result.scenarioId,
          issue: result.error || 'Assertion failed',
          severity: this.determineSeverity(result),
        });
        
        // Generate edge cases based on failure
        if (this.config.generateEdgeCases) {
          const edgeCases = edgeCaseGenerator.generateFromFailure(result);
          newEdgeCases.push(...edgeCases);
        }
      }
    }
    
    return { issues, newEdgeCases };
  }
  
  /**
   * Determine issue severity based on result
   */
  private determineSeverity(result: TestResult): 'low' | 'medium' | 'high' {
    if (result.error?.includes('timeout')) return 'high';
    if (result.error?.includes('error') || result.error?.includes('exception')) return 'high';
    if (result.assertionResults.filter(a => !a.passed).length > 1) return 'medium';
    return 'low';
  }
  
  /**
   * Convert edge case to scenario format
   */
  private edgeCaseToScenario(edgeCase: EdgeCase): TestScenario {
    return {
      id: `edge-${edgeCase.id}`,
      name: `[Edge Case] ${edgeCase.description}`,
      category: 'edge_case',
      steps: edgeCase.steps,
      assertions: edgeCase.assertions,
      metadata: {
        sourceScenarioId: edgeCase.sourceScenarioId,
        variation: edgeCase.variation,
      },
    };
  }
  
  /**
   * Print final summary
   */
  private printFinalSummary(): void {
    console.log('\n========================================');
    console.log('  Final Test Summary');
    console.log('========================================\n');
    
    const lastReport = this.testHistory[this.testHistory.length - 1];
    console.log(`Iterations: ${this.testHistory.length}`);
    console.log(`Total tests: ${lastReport.summary.total}`);
    console.log(`Passed: ${lastReport.summary.passed}`);
    console.log(`Failed: ${lastReport.summary.failed}`);
    console.log(`Duration: ${lastReport.summary.duration}ms`);
    console.log(`Edge cases discovered: ${this.discoveredEdgeCases.length}`);
    
    if (lastReport.issues.length > 0) {
      console.log('\nOutstanding Issues:');
      lastReport.issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. [${issue.severity.toUpperCase()}] ${issue.scenarioId}: ${issue.issue}`);
      });
    }
    
    console.log('\n========================================\n');
  }
  
  /**
   * Get test history
   */
  getHistory(): TestReport[] {
    return this.testHistory;
  }
  
  /**
   * Get discovered edge cases
   */
  getDiscoveredEdgeCases(): EdgeCase[] {
    return this.discoveredEdgeCases;
  }
}

/**
 * Create a new PAR test runner
 */
export function createTestRunner(config?: Partial<PARLoopConfig>): PARTestRunner {
  return new PARTestRunner(config);
}
