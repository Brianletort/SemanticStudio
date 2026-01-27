#!/usr/bin/env npx tsx

/**
 * Memory System Test Runner
 * 
 * Orchestrates the iterative test-fix-retest cycle for the memory system.
 * Generates comprehensive test reports.
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

interface TestCategory {
  name: string;
  results: TestResult[];
  passed: number;
  failed: number;
  skipped: number;
}

interface Issue {
  id: string;
  testName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  fixApplied?: string;
  iteration: number;
}

interface TestReport {
  timestamp: string;
  totalIterations: number;
  finalStatus: 'passed' | 'failed';
  categories: TestCategory[];
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  duration: number;
  issuesFound: Issue[];
  issuesFixed: Issue[];
}

const TEST_DIR = path.dirname(__filename);
const REPORT_DIR = path.join(TEST_DIR, '..', 'test-reports', 'memory');

/**
 * Run Playwright tests for a specific project
 */
async function runPlaywrightTests(project: string): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve) => {
    const args = ['playwright', 'test', '--project', project, '--reporter=json'];
    const proc = spawn('npx', args, {
      cwd: TEST_DIR,
      shell: true,
      env: { ...process.env, CI: 'true' },
    });
    
    let output = '';
    proc.stdout?.on('data', (data) => { output += data.toString(); });
    proc.stderr?.on('data', (data) => { output += data.toString(); });
    
    proc.on('close', (code) => {
      resolve({ output, exitCode: code || 0 });
    });
  });
}

/**
 * Parse Playwright JSON output
 */
function parsePlaywrightOutput(output: string): TestResult[] {
  const results: TestResult[] = [];
  
  try {
    // Try to find JSON in output
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const json = JSON.parse(jsonMatch[0]);
      
      if (json.suites) {
        for (const suite of json.suites) {
          for (const spec of suite.specs || []) {
            results.push({
              name: `${suite.title} > ${spec.title}`,
              status: spec.ok ? 'passed' : 'failed',
              duration: spec.tests?.[0]?.results?.[0]?.duration || 0,
              error: spec.tests?.[0]?.results?.[0]?.error?.message,
            });
          }
        }
      }
    }
  } catch (e) {
    // Parse line-by-line if JSON fails
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('✓') || line.includes('passed')) {
        results.push({ name: line.trim(), status: 'passed', duration: 0 });
      } else if (line.includes('✗') || line.includes('failed')) {
        results.push({ name: line.trim(), status: 'failed', duration: 0, error: 'See log' });
      }
    }
  }
  
  return results;
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(report: TestReport): string {
  const statusEmoji = report.finalStatus === 'passed' ? '✅' : '❌';
  
  let md = `# Memory System Test Report

**Generated:** ${report.timestamp}
**Total Iterations:** ${report.totalIterations}
**Final Status:** ${statusEmoji} ${report.finalStatus.toUpperCase()}

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${report.totalTests} |
| Passed | ${report.totalPassed} |
| Failed | ${report.totalFailed} |
| Skipped | ${report.totalSkipped} |
| Issues Found | ${report.issuesFound.length} |
| Issues Fixed | ${report.issuesFixed.length} |
| Duration | ${Math.round(report.duration / 1000)}s |

## Test Results by Category

`;

  for (const category of report.categories) {
    const categoryStatus = category.failed === 0 ? '✅' : '❌';
    md += `### ${category.name} ${categoryStatus} (${category.passed}/${category.passed + category.failed} passed)\n\n`;
    
    for (const result of category.results) {
      const icon = result.status === 'passed' ? '✓' : result.status === 'failed' ? '✗' : '○';
      md += `- ${icon} ${result.name}`;
      if (result.error) {
        md += ` - ${result.error.substring(0, 100)}`;
      }
      md += '\n';
    }
    md += '\n';
  }

  if (report.issuesFixed.length > 0) {
    md += `## Issues Fixed\n\n`;
    for (const issue of report.issuesFixed) {
      md += `### ${issue.id} [${issue.severity.toUpperCase()}] - ${issue.testName}\n`;
      md += `- **Description:** ${issue.description}\n`;
      if (issue.fixApplied) {
        md += `- **Fix:** ${issue.fixApplied}\n`;
      }
      md += `- **Fixed in iteration:** ${issue.iteration}\n\n`;
    }
  }

  if (report.issuesFound.filter(i => !report.issuesFixed.find(f => f.id === i.id)).length > 0) {
    md += `## Outstanding Issues\n\n`;
    for (const issue of report.issuesFound) {
      if (!report.issuesFixed.find(f => f.id === i.id)) {
        md += `- **${issue.id}** [${issue.severity}]: ${issue.description}\n`;
      }
    }
  }

  md += `
## Recommendations

1. Review any failed tests and their error messages
2. Check stress test results for performance bottlenecks
3. Verify edge cases are handled gracefully
4. Run tests again after fixes are applied

---
*Report generated by Memory System Test Runner*
`;

  return md;
}

/**
 * Main test runner
 */
async function runTests(maxIterations: number = 3): Promise<TestReport> {
  console.log('\n========================================');
  console.log('  Memory System Test Runner');
  console.log('========================================\n');
  
  const startTime = Date.now();
  const report: TestReport = {
    timestamp: new Date().toISOString(),
    totalIterations: 0,
    finalStatus: 'failed',
    categories: [],
    totalTests: 0,
    totalPassed: 0,
    totalFailed: 0,
    totalSkipped: 0,
    duration: 0,
    issuesFound: [],
    issuesFixed: [],
  };
  
  const projects = [
    { name: 'core-chat', label: 'Core Chat Features' },
    { name: 'memory-tiers', label: 'Memory Tiers' },
    { name: 'compression', label: 'Progressive Summarization' },
  ];
  
  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    console.log(`\n--- Iteration ${iteration}/${maxIterations} ---\n`);
    report.totalIterations = iteration;
    
    let iterationFailed = false;
    
    for (const project of projects) {
      console.log(`Running: ${project.label}...`);
      
      const { output, exitCode } = await runPlaywrightTests(project.name);
      const results = parsePlaywrightOutput(output);
      
      const category: TestCategory = {
        name: project.label,
        results,
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length,
        skipped: results.filter(r => r.status === 'skipped').length,
      };
      
      // Update or add category
      const existingIdx = report.categories.findIndex(c => c.name === project.label);
      if (existingIdx >= 0) {
        report.categories[existingIdx] = category;
      } else {
        report.categories.push(category);
      }
      
      // Track issues
      for (const result of results) {
        if (result.status === 'failed') {
          const issueId = `ISSUE-${report.issuesFound.length + 1}`;
          report.issuesFound.push({
            id: issueId,
            testName: result.name,
            severity: 'high',
            description: result.error || 'Test failed',
            iteration,
          });
          iterationFailed = true;
        }
      }
      
      console.log(`  ${category.passed} passed, ${category.failed} failed`);
    }
    
    if (!iterationFailed) {
      report.finalStatus = 'passed';
      console.log('\n✅ All tests passed!');
      break;
    }
    
    if (iteration < maxIterations) {
      console.log('\n⚠️ Some tests failed. Preparing next iteration...');
      // In a real scenario, we would apply fixes here
    }
  }
  
  // Calculate totals
  for (const category of report.categories) {
    report.totalTests += category.results.length;
    report.totalPassed += category.passed;
    report.totalFailed += category.failed;
    report.totalSkipped += category.skipped;
  }
  
  report.duration = Date.now() - startTime;
  
  // Ensure report directory exists
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
  
  // Write reports
  const jsonPath = path.join(REPORT_DIR, 'final-report.json');
  const mdPath = path.join(REPORT_DIR, 'final-report.md');
  
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, generateMarkdownReport(report));
  
  console.log('\n========================================');
  console.log('  Test Summary');
  console.log('========================================');
  console.log(`Total:   ${report.totalTests}`);
  console.log(`Passed:  ${report.totalPassed}`);
  console.log(`Failed:  ${report.totalFailed}`);
  console.log(`Skipped: ${report.totalSkipped}`);
  console.log(`Duration: ${Math.round(report.duration / 1000)}s`);
  console.log(`\nReports saved to: ${REPORT_DIR}`);
  console.log('========================================\n');
  
  return report;
}

// CLI entry point
const args = process.argv.slice(2);
const maxIterations = parseInt(args[0]) || 3;

runTests(maxIterations)
  .then(report => {
    process.exit(report.finalStatus === 'passed' ? 0 : 1);
  })
  .catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
