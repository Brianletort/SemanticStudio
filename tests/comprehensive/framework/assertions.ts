/**
 * Test Assertions Library
 * 
 * Provides assertion functions for validating test results.
 */

import { TestAssertion, AssertionResult } from './types';

class AssertionEvaluator {
  /**
   * Evaluate an assertion against test context
   */
  async evaluate(assertion: TestAssertion, context: Record<string, unknown>): Promise<AssertionResult> {
    switch (assertion.type) {
      case 'response_contains':
        return this.responseContains(assertion.params, context);
      
      case 'response_not_contains':
        return this.responseNotContains(assertion.params, context);
      
      case 'mode_is':
        return this.modeIs(assertion.params, context);
      
      case 'has_evaluation':
        return this.hasEvaluation(context);
      
      case 'evaluation_score_above':
        return this.evaluationScoreAbove(assertion.params, context);
      
      case 'memory_contains':
        return this.memoryContains(assertion.params, context);
      
      case 'session_exists':
        return this.sessionExists(assertion.params, context);
      
      case 'event_occurred':
        return this.eventOccurred(assertion.params, context);
      
      case 'event_has_field':
        return this.eventHasField(assertion.params, context);
      
      case 'response_time_under':
        return this.responseTimeUnder(assertion.params, context);
      
      case 'custom':
        return this.customAssertion(assertion.params, context);
      
      default:
        return {
          assertion: assertion.type,
          passed: false,
          message: `Unknown assertion type: ${assertion.type}`,
        };
    }
  }
  
  /**
   * Assert response contains text
   */
  private responseContains(
    params: Record<string, unknown>,
    context: Record<string, unknown>
  ): AssertionResult {
    const response = context.response as string | undefined;
    const text = params.text as string;
    const caseSensitive = params.caseSensitive as boolean ?? false;
    
    if (!response) {
      return {
        assertion: 'response_contains',
        passed: false,
        message: 'No response in context',
      };
    }
    
    const searchText = caseSensitive ? text : text.toLowerCase();
    const searchResponse = caseSensitive ? response : response.toLowerCase();
    const passed = searchResponse.includes(searchText);
    
    return {
      assertion: 'response_contains',
      passed,
      message: passed 
        ? `Response contains "${text}"` 
        : `Response does not contain "${text}"`,
      actual: response.substring(0, 200),
      expected: text,
    };
  }
  
  /**
   * Assert response does not contain text
   */
  private responseNotContains(
    params: Record<string, unknown>,
    context: Record<string, unknown>
  ): AssertionResult {
    const response = context.response as string | undefined;
    const text = params.text as string;
    
    if (!response) {
      return {
        assertion: 'response_not_contains',
        passed: true,
        message: 'No response in context',
      };
    }
    
    const passed = !response.toLowerCase().includes(text.toLowerCase());
    
    return {
      assertion: 'response_not_contains',
      passed,
      message: passed 
        ? `Response does not contain "${text}"` 
        : `Response unexpectedly contains "${text}"`,
    };
  }
  
  /**
   * Assert mode is as expected
   */
  private modeIs(
    params: Record<string, unknown>,
    context: Record<string, unknown>
  ): AssertionResult {
    const actualMode = context.mode as string | undefined;
    const expectedMode = params.mode as string;
    const passed = actualMode === expectedMode;
    
    return {
      assertion: 'mode_is',
      passed,
      message: passed 
        ? `Mode is ${expectedMode}` 
        : `Expected mode ${expectedMode}, got ${actualMode}`,
      actual: actualMode,
      expected: expectedMode,
    };
  }
  
  /**
   * Assert evaluation exists
   */
  private hasEvaluation(context: Record<string, unknown>): AssertionResult {
    const evaluation = context.evaluation as Record<string, unknown> | undefined;
    const passed = !!evaluation && typeof evaluation.qualityScore === 'number';
    
    return {
      assertion: 'has_evaluation',
      passed,
      message: passed 
        ? 'Response has evaluation' 
        : 'Response missing evaluation',
    };
  }
  
  /**
   * Assert evaluation score above threshold
   */
  private evaluationScoreAbove(
    params: Record<string, unknown>,
    context: Record<string, unknown>
  ): AssertionResult {
    const evaluation = context.evaluation as { qualityScore?: number } | undefined;
    const threshold = params.threshold as number;
    const metric = params.metric as string ?? 'qualityScore';
    
    if (!evaluation) {
      return {
        assertion: 'evaluation_score_above',
        passed: false,
        message: 'No evaluation in context',
      };
    }
    
    const score = (evaluation as Record<string, unknown>)[metric] as number | undefined;
    if (typeof score !== 'number') {
      return {
        assertion: 'evaluation_score_above',
        passed: false,
        message: `Metric ${metric} not found in evaluation`,
      };
    }
    
    const passed = score >= threshold;
    
    return {
      assertion: 'evaluation_score_above',
      passed,
      message: passed 
        ? `${metric} (${score}) >= ${threshold}` 
        : `${metric} (${score}) < ${threshold}`,
      actual: score,
      expected: threshold,
    };
  }
  
  /**
   * Assert memory contains fact
   */
  private memoryContains(
    params: Record<string, unknown>,
    context: Record<string, unknown>
  ): AssertionResult {
    const memory = context.memory as { facts?: Array<{ value: string }> } | undefined;
    const searchText = params.text as string;
    
    if (!memory || !memory.facts) {
      return {
        assertion: 'memory_contains',
        passed: false,
        message: 'No memory facts in context',
      };
    }
    
    const passed = memory.facts.some(f => 
      f.value.toLowerCase().includes(searchText.toLowerCase())
    );
    
    return {
      assertion: 'memory_contains',
      passed,
      message: passed 
        ? `Memory contains "${searchText}"` 
        : `Memory does not contain "${searchText}"`,
    };
  }
  
  /**
   * Assert session exists
   */
  private sessionExists(
    params: Record<string, unknown>,
    context: Record<string, unknown>
  ): AssertionResult {
    const sessions = context.sessions as Array<{ id: string; title: string }> | undefined;
    const sessionId = params.sessionId as string | undefined;
    const sessionTitle = params.title as string | undefined;
    
    if (!sessions) {
      return {
        assertion: 'session_exists',
        passed: false,
        message: 'No sessions in context',
      };
    }
    
    let passed = false;
    if (sessionId) {
      passed = sessions.some(s => s.id === sessionId);
    } else if (sessionTitle) {
      passed = sessions.some(s => 
        s.title.toLowerCase().includes(sessionTitle.toLowerCase())
      );
    }
    
    return {
      assertion: 'session_exists',
      passed,
      message: passed 
        ? `Session exists` 
        : `Session not found`,
    };
  }
  
  /**
   * Assert event occurred in trace
   */
  private eventOccurred(
    params: Record<string, unknown>,
    context: Record<string, unknown>
  ): AssertionResult {
    const events = context.events as Array<{ type: string }> | undefined;
    const eventType = params.type as string;
    
    if (!events) {
      return {
        assertion: 'event_occurred',
        passed: false,
        message: 'No events in context',
      };
    }
    
    const passed = events.some(e => e.type === eventType);
    
    return {
      assertion: 'event_occurred',
      passed,
      message: passed 
        ? `Event ${eventType} occurred` 
        : `Event ${eventType} not found`,
    };
  }
  
  /**
   * Assert event has a specific field
   */
  private eventHasField(
    params: Record<string, unknown>,
    context: Record<string, unknown>
  ): AssertionResult {
    const events = context.events as Array<Record<string, unknown>> | undefined;
    const eventType = params.type as string;
    const field = params.field as string;
    
    if (!events) {
      return {
        assertion: 'event_has_field',
        passed: false,
        message: 'No events in context',
      };
    }
    
    const matchingEvent = events.find(e => e.type === eventType);
    
    if (!matchingEvent) {
      return {
        assertion: 'event_has_field',
        passed: false,
        message: `Event ${eventType} not found`,
      };
    }
    
    const passed = field in matchingEvent && matchingEvent[field] !== undefined;
    
    return {
      assertion: 'event_has_field',
      passed,
      message: passed 
        ? `Event ${eventType} has field ${field}` 
        : `Event ${eventType} missing field ${field}`,
      actual: matchingEvent[field],
    };
  }
  
  /**
   * Assert response time under threshold
   */
  private responseTimeUnder(
    params: Record<string, unknown>,
    context: Record<string, unknown>
  ): AssertionResult {
    const responseTime = context.responseTime as number | undefined;
    const threshold = params.ms as number;
    
    if (typeof responseTime !== 'number') {
      return {
        assertion: 'response_time_under',
        passed: false,
        message: 'No response time in context',
      };
    }
    
    const passed = responseTime < threshold;
    
    return {
      assertion: 'response_time_under',
      passed,
      message: passed 
        ? `Response time (${responseTime}ms) < ${threshold}ms` 
        : `Response time (${responseTime}ms) >= ${threshold}ms`,
      actual: responseTime,
      expected: threshold,
    };
  }
  
  /**
   * Custom assertion with function
   */
  private async customAssertion(
    params: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<AssertionResult> {
    const fn = params.fn as ((context: Record<string, unknown>) => boolean | Promise<boolean>) | undefined;
    const name = params.name as string ?? 'custom';
    
    if (!fn) {
      return {
        assertion: name,
        passed: false,
        message: 'No custom function provided',
      };
    }
    
    try {
      const passed = await fn(context);
      return {
        assertion: name,
        passed,
        message: passed ? `${name} passed` : `${name} failed`,
      };
    } catch (e) {
      return {
        assertion: name,
        passed: false,
        message: `${name} threw error: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }
}

// Singleton instance
export const assertions = new AssertionEvaluator();

// Helper functions for building assertions
export const assert = {
  responseContains: (text: string, caseSensitive = false): TestAssertion => ({
    type: 'response_contains',
    params: { text, caseSensitive },
  }),
  
  responseNotContains: (text: string): TestAssertion => ({
    type: 'response_not_contains',
    params: { text },
  }),
  
  modeIs: (mode: string): TestAssertion => ({
    type: 'mode_is',
    params: { mode },
  }),
  
  hasEvaluation: (): TestAssertion => ({
    type: 'has_evaluation',
    params: {},
  }),
  
  qualityAbove: (threshold: number): TestAssertion => ({
    type: 'evaluation_score_above',
    params: { threshold, metric: 'qualityScore' },
  }),
  
  relevanceAbove: (threshold: number): TestAssertion => ({
    type: 'evaluation_score_above',
    params: { threshold, metric: 'relevance' },
  }),
  
  memoryContains: (text: string): TestAssertion => ({
    type: 'memory_contains',
    params: { text },
  }),
  
  sessionExists: (title: string): TestAssertion => ({
    type: 'session_exists',
    params: { title },
  }),
  
  eventOccurred: (type: string): TestAssertion => ({
    type: 'event_occurred',
    params: { type },
  }),
  
  eventHasField: (type: string, field: string): TestAssertion => ({
    type: 'event_has_field',
    params: { type, field },
  }),
  
  responseTimeUnder: (ms: number): TestAssertion => ({
    type: 'response_time_under',
    params: { ms },
  }),
  
  custom: (name: string, fn: (context: Record<string, unknown>) => boolean | Promise<boolean>): TestAssertion => ({
    type: 'custom',
    params: { name, fn },
  }),
};
