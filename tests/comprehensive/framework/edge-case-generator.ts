/**
 * Edge Case Generator
 * 
 * Automatically generates edge cases from test failures and patterns.
 * Helps discover issues that weren't covered by initial test scenarios.
 */

import { TestResult, EdgeCase, TestStep, TestAssertion, SamplePrompt } from './types';
import { v4 as uuidv4 } from 'uuid';

class EdgeCaseGenerator {
  private generatedIds = new Set<string>();
  
  /**
   * Generate edge cases from a test failure
   */
  generateFromFailure(result: TestResult): EdgeCase[] {
    const edgeCases: EdgeCase[] = [];
    
    // Analyze failure type and generate appropriate edge cases
    if (result.error?.includes('timeout')) {
      edgeCases.push(...this.generateTimeoutVariations(result));
    }
    
    if (result.error?.includes('memory') || result.error?.includes('context')) {
      edgeCases.push(...this.generateMemoryVariations(result));
    }
    
    if (result.assertionResults.some(a => a.assertion === 'response_contains' && !a.passed)) {
      edgeCases.push(...this.generateResponseVariations(result));
    }
    
    // Always generate boundary variations
    edgeCases.push(...this.generateBoundaryVariations(result));
    
    return edgeCases.filter(ec => !this.generatedIds.has(ec.id));
  }
  
  /**
   * Generate edge cases for timeout issues
   */
  private generateTimeoutVariations(result: TestResult): EdgeCase[] {
    const edgeCases: EdgeCase[] = [];
    
    // Shorter query variation
    edgeCases.push({
      id: this.generateId('timeout-short'),
      description: 'Test with simplified query',
      sourceScenarioId: result.scenarioId,
      variation: 'simplified_query',
      steps: [
        {
          id: 'send-short',
          action: 'send_message',
          params: { message: 'Hello' },
          description: 'Send minimal message',
        },
      ],
      assertions: [
        { type: 'response_time_under', params: { ms: 5000 } },
      ],
    });
    
    // Different mode variation
    edgeCases.push({
      id: this.generateId('timeout-quick-mode'),
      description: 'Test with quick mode for faster response',
      sourceScenarioId: result.scenarioId,
      variation: 'quick_mode',
      steps: [
        {
          id: 'set-mode',
          action: 'select_mode',
          params: { mode: 'quick' },
          description: 'Select quick mode',
        },
        {
          id: 'send',
          action: 'send_message',
          params: { message: 'Brief question' },
          description: 'Send message',
        },
      ],
      assertions: [
        { type: 'response_time_under', params: { ms: 3000 } },
      ],
    });
    
    return edgeCases;
  }
  
  /**
   * Generate edge cases for memory issues
   */
  private generateMemoryVariations(result: TestResult): EdgeCase[] {
    const edgeCases: EdgeCase[] = [];
    
    // Fresh session (no memory)
    edgeCases.push({
      id: this.generateId('memory-fresh'),
      description: 'Test with fresh session (no memory)',
      sourceScenarioId: result.scenarioId,
      variation: 'fresh_session',
      steps: [
        {
          id: 'new-session',
          action: 'navigate',
          params: { url: '/chat', newSession: true },
          description: 'Start fresh session',
        },
        {
          id: 'send',
          action: 'send_message',
          params: { message: 'Test message' },
          description: 'Send message',
        },
      ],
      assertions: [
        { type: 'response_contains', params: { text: '' } },  // Just check for response
      ],
    });
    
    // Many messages (memory stress)
    edgeCases.push({
      id: this.generateId('memory-stress'),
      description: 'Test with many messages in session',
      sourceScenarioId: result.scenarioId,
      variation: 'memory_stress',
      steps: Array.from({ length: 10 }, (_, i) => ({
        id: `msg-${i}`,
        action: 'send_message' as const,
        params: { message: `Message ${i + 1}: Some content here` },
        description: `Send message ${i + 1}`,
      })),
      assertions: [
        { type: 'response_contains', params: { text: '' } },
        { type: 'memory_contains', params: { text: 'Message' } },
      ],
    });
    
    return edgeCases;
  }
  
  /**
   * Generate edge cases for response issues
   */
  private generateResponseVariations(result: TestResult): EdgeCase[] {
    const edgeCases: EdgeCase[] = [];
    
    // Rephrased query
    edgeCases.push({
      id: this.generateId('response-rephrase'),
      description: 'Test with rephrased query',
      sourceScenarioId: result.scenarioId,
      variation: 'rephrased',
      steps: [
        {
          id: 'send',
          action: 'send_message',
          params: { message: 'Can you help me with this?' },
          description: 'Send rephrased message',
        },
      ],
      assertions: [
        { type: 'response_contains', params: { text: '' } },
      ],
    });
    
    // Add more context
    edgeCases.push({
      id: this.generateId('response-context'),
      description: 'Test with additional context',
      sourceScenarioId: result.scenarioId,
      variation: 'with_context',
      steps: [
        {
          id: 'context',
          action: 'send_message',
          params: { message: 'I am working on a project related to data analysis.' },
          description: 'Provide context',
        },
        {
          id: 'query',
          action: 'send_message',
          params: { message: 'Now help me with my question.' },
          description: 'Send actual query',
        },
      ],
      assertions: [
        { type: 'response_contains', params: { text: '' } },
      ],
    });
    
    return edgeCases;
  }
  
  /**
   * Generate boundary test variations
   */
  private generateBoundaryVariations(result: TestResult): EdgeCase[] {
    const edgeCases: EdgeCase[] = [];
    
    // Empty message
    edgeCases.push({
      id: this.generateId('boundary-empty'),
      description: 'Test with empty message',
      sourceScenarioId: result.scenarioId,
      variation: 'empty_message',
      steps: [
        {
          id: 'send',
          action: 'send_message',
          params: { message: '' },
          description: 'Send empty message',
        },
      ],
      assertions: [
        // Should handle gracefully (either error or prompt for input)
      ],
    });
    
    // Very long message
    edgeCases.push({
      id: this.generateId('boundary-long'),
      description: 'Test with very long message',
      sourceScenarioId: result.scenarioId,
      variation: 'long_message',
      steps: [
        {
          id: 'send',
          action: 'send_message',
          params: { message: 'A'.repeat(10000) },
          description: 'Send 10K character message',
        },
      ],
      assertions: [
        { type: 'response_contains', params: { text: '' } },
      ],
    });
    
    // Special characters
    edgeCases.push({
      id: this.generateId('boundary-special'),
      description: 'Test with special characters',
      sourceScenarioId: result.scenarioId,
      variation: 'special_chars',
      steps: [
        {
          id: 'send',
          action: 'send_message',
          params: { message: 'Test <script>alert("xss")</script> & "quotes" \'single\' `backticks` ${template}' },
          description: 'Send message with special chars',
        },
      ],
      assertions: [
        { type: 'response_not_contains', params: { text: '<script>' } },
      ],
    });
    
    return edgeCases;
  }
  
  /**
   * Generate edge cases from prompt patterns
   */
  generateFromPromptPatterns(prompts: SamplePrompt[]): EdgeCase[] {
    const edgeCases: EdgeCase[] = [];
    
    // Ambiguous prompts
    const ambiguousPrompts = prompts.filter(p => p.category === 'ambiguous');
    for (const prompt of ambiguousPrompts.slice(0, 3)) {
      edgeCases.push({
        id: this.generateId(`ambiguous-${prompt.id}`),
        description: `Test ambiguous prompt: ${prompt.text.substring(0, 50)}...`,
        sourceScenarioId: 'prompt-patterns',
        variation: 'ambiguous',
        steps: [
          {
            id: 'send',
            action: 'send_message',
            params: { message: prompt.text },
            description: 'Send ambiguous prompt',
          },
        ],
        assertions: [
          { type: 'response_contains', params: { text: '' } },
        ],
      });
    }
    
    // Multi-domain prompts
    const complexPrompts = prompts.filter(p => p.category === 'complex');
    for (const prompt of complexPrompts.slice(0, 3)) {
      edgeCases.push({
        id: this.generateId(`complex-${prompt.id}`),
        description: `Test complex prompt: ${prompt.text.substring(0, 50)}...`,
        sourceScenarioId: 'prompt-patterns',
        variation: 'complex',
        steps: [
          {
            id: 'send',
            action: 'send_message',
            params: { message: prompt.text },
            description: 'Send complex prompt',
          },
        ],
        assertions: [
          { type: 'has_evaluation', params: {} },
          { type: 'qualityAbove', params: { threshold: 0.6 } },
        ],
      });
    }
    
    return edgeCases;
  }
  
  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    const id = `${prefix}-${uuidv4().slice(0, 8)}`;
    this.generatedIds.add(id);
    return id;
  }
  
  /**
   * Clear generated IDs (for fresh run)
   */
  reset(): void {
    this.generatedIds.clear();
  }
}

// Singleton instance
export const edgeCaseGenerator = new EdgeCaseGenerator();
