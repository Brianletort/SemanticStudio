/**
 * Test Framework Types
 * 
 * Defines types for the PAR loop testing system.
 */

// Test step definition
export interface TestStep {
  id: string;
  action: 'navigate' | 'send_message' | 'wait' | 'click' | 'upload_file' | 'switch_session' | 'create_folder' | 'select_mode' | 'toggle_web' | 'check_memory' | 'api_call';
  params: Record<string, unknown>;
  description?: string;
  timeout?: number;
}

// Assertion definition
export interface TestAssertion {
  type: 'response_contains' | 'response_not_contains' | 'mode_is' | 'has_evaluation' | 'evaluation_score_above' | 'memory_contains' | 'session_exists' | 'event_occurred' | 'response_time_under' | 'custom';
  params: Record<string, unknown>;
  message?: string;
}

// Test scenario
export interface TestScenario {
  id: string;
  name: string;
  description?: string;
  category: 'modes' | 'memory' | 'files' | 'images' | 'sessions' | 'integration' | 'edge_case';
  tags?: string[];
  steps: TestStep[];
  assertions: TestAssertion[];
  metadata?: Record<string, unknown>;
  // Optional setup/teardown
  setup?: TestStep[];
  teardown?: TestStep[];
}

// Test result
export interface TestResult {
  scenarioId: string;
  scenarioName: string;
  passed: boolean;
  error?: string;
  assertionResults: Array<{
    assertion: string;
    passed: boolean;
    message: string;
  }>;
  durationMs: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// Edge case generated from test analysis
export interface EdgeCase {
  id: string;
  description: string;
  sourceScenarioId: string;
  variation: string;
  steps: TestStep[];
  assertions: TestAssertion[];
}

// Test plan for an iteration
export interface TestPlan {
  iteration: number;
  scenarios: TestScenario[];
  edgeCases: EdgeCase[];
  generatedAt: string;
}

// Test report for an iteration
export interface TestReport {
  iteration: number;
  timestamp: string;
  plan: TestPlan;
  results: TestResult[];
  issues: Array<{
    scenarioId: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  newEdgeCases: EdgeCase[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  };
}

// Sample prompt for testing
export interface SamplePrompt {
  id: string;
  text: string;
  category: 'simple' | 'complex' | 'domain_specific' | 'ambiguous' | 'multi_turn' | 'file_related' | 'image_related';
  expectedMode?: 'quick' | 'think' | 'deep' | 'research';
  expectedDomains?: string[];
  tags?: string[];
}

// Test fixture
export interface TestFixture {
  id: string;
  type: 'prompt' | 'file' | 'session_context' | 'memory';
  data: unknown;
}

// Test configuration
export interface TestConfig {
  baseUrl: string;
  userId: string;
  timeout: number;
  retries: number;
  parallelism: number;
  categories?: string[];
  tags?: string[];
}

// Assertion result from evaluator
export interface AssertionResult {
  assertion: string;
  passed: boolean;
  message: string;
  actual?: unknown;
  expected?: unknown;
}
